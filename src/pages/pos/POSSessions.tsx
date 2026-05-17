import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Lock } from "lucide-react";

export default function POSSessions() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [openDlg, setOpenDlg] = useState(false);
  const [closeDlg, setCloseDlg] = useState<any>(null);
  const [openForm, setOpenForm] = useState<any>({ config_id: "", opening_balance: 0 });
  const [closing, setClosing] = useState({ closing_balance: 0 });

  const load = async () => {
    const { data } = await supabase.from("pos_sessions").select("*, pos_configs(name, code)").order("opened_at", { ascending: false });
    setRows(data || []);
  };

  useEffect(() => {
    load();
    supabase.from("pos_configs").select("*").eq("is_active", true).then(({ data }) => setConfigs(data || []));
  }, []);

  const openSession = async () => {
    if (!openForm.config_id) return toast.error("اختر نقطة البيع");
    const { data, error } = await supabase.rpc("open_pos_session" as any, {
      _config_id: openForm.config_id,
      _opening_balance: Number(openForm.opening_balance) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("تم فتح الجلسة");
    setOpenDlg(false);
    navigate(`/pos/terminal/${data}`);
  };

  const closeSession = async () => {
    const { error } = await supabase.rpc("close_pos_session" as any, {
      _session_id: closeDlg.id,
      _closing_balance: Number(closing.closing_balance) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("تم إقفال الجلسة وتوليد القيد المحاسبي");
    setCloseDlg(null);
    load();
  };

  return (
    <div className="p-4 space-y-4">
      <ListPageHeader
        title="جلسات نقاط البيع"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "نقاط البيع" }, { label: "الجلسات" }]}
        onAdd={() => setOpenDlg(true)}
        addLabel="فتح جلسة جديدة"
        onRefresh={load}
      />

      <div className="bg-card border border-t-0 rounded-b-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الجلسة</TableHead>
              <TableHead>نقطة البيع</TableHead>
              <TableHead>تاريخ الفتح</TableHead>
              <TableHead>الرصيد الافتتاحي</TableHead>
              <TableHead>إجمالي المبيعات</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.session_number}</TableCell>
                <TableCell>{r.pos_configs?.name}</TableCell>
                <TableCell>{new Date(r.opened_at).toLocaleString("ar-SA")}</TableCell>
                <TableCell>{Number(r.opening_balance).toFixed(2)}</TableCell>
                <TableCell>{Number(r.total_sales || 0).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "opened" ? "default" : "secondary"}>
                    {r.status === "opened" ? "مفتوحة" : "مغلقة"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.status === "opened" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => navigate(`/pos/terminal/${r.id}`)}>
                        <Play className="h-4 w-4 me-1" /> بيع
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => { setCloseDlg(r); setClosing({ closing_balance: 0 }); }}>
                        <Lock className="h-4 w-4 me-1" /> إقفال
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={openDlg} onOpenChange={setOpenDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>فتح جلسة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>نقطة البيع</Label>
              <Select value={openForm.config_id} onValueChange={v => setOpenForm({ ...openForm, config_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{configs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الرصيد الافتتاحي للصندوق</Label>
              <Input type="number" value={openForm.opening_balance} onChange={e => setOpenForm({ ...openForm, opening_balance: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={openSession}>فتح الجلسة</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeDlg} onOpenChange={(o) => !o && setCloseDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>إقفال الجلسة {closeDlg?.session_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الرصيد الفعلي في الصندوق</Label>
              <Input type="number" value={closing.closing_balance} onChange={e => setClosing({ closing_balance: Number(e.target.value) })} />
            </div>
            <p className="text-sm text-muted-foreground">
              سيتم توليد قيد محاسبي تلقائي بالمبيعات وخصم المخزون.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDlg(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={closeSession}>تأكيد الإقفال</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
