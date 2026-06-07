import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

const statuses = [
  { value: "present", label: "حاضر", variant: "default" },
  { value: "absent", label: "غائب", variant: "destructive" },
  { value: "late", label: "متأخر", variant: "secondary" },
  { value: "leave", label: "إجازة", variant: "secondary" },
  { value: "holiday", label: "عطلة رسمية", variant: "outline" },
  { value: "weekend", label: "نهاية أسبوع", variant: "outline" },
];

export default function Attendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [employees, setEmployees] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [e, a] = await Promise.all([
      supabase.from("hr_employees").select("id, employee_number, full_name").eq("is_active", true).order("employee_number"),
      supabase.from("hr_attendance").select("*").eq("attendance_date", date),
    ]);
    if (e.data) setEmployees(e.data);
    const map: any = {};
    (a.data || []).forEach(r => { map[r.employee_id] = r; });
    // default empty records for employees without one
    (e.data || []).forEach(emp => { if (!map[emp.id]) map[emp.id] = { employee_id: emp.id, attendance_date: date, status: "present", check_in: "", check_out: "" }; });
    setRecords(map);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, [date]);

  const updateField = (empId: string, field: string, value: any) => setRecords({ ...records, [empId]: { ...records[empId], [field]: value } });

  const saveAll = async () => {
    setSaving(true);
    const rows = Object.values(records).map((r: any) => ({
      employee_id: r.employee_id, attendance_date: date, status: r.status,
      check_in: r.check_in || null, check_out: r.check_out || null,
      hours_worked: r.check_in && r.check_out ? ((new Date(`2000-01-01T${r.check_out}`).getTime() - new Date(`2000-01-01T${r.check_in}`).getTime()) / 3600000) : 0,
    }));
    const r = await supabase.from("hr_attendance").upsert(rows, { onConflict: "employee_id,attendance_date" });
    if (r.error) toast.error(r.error.message); else toast.success(`تم حفظ ${rows.length} سجل`);
    setSaving(false);
  };

  return (
    <div>
      <ListPageHeader title="الحضور اليومي" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "الحضور" }]} showAdd={false} onRefresh={fetchData} showSearch={false} extraActions={
        <>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-40 ms-2" />
          <Button onClick={saveAll} disabled={saving} className="ms-2">{saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}حفظ الكل</Button>
        </>
      } />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>الموظف</TableHead><TableHead>الحالة</TableHead><TableHead>الحضور</TableHead><TableHead>الانصراف</TableHead></TableRow></TableHeader>
            <TableBody>
              {employees.map(emp => {
                const rec = records[emp.id] || {};
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono">{emp.employee_number}</TableCell>
                    <TableCell>{emp.full_name}</TableCell>
                    <TableCell>
                      <Select value={rec.status || "present"} onValueChange={v => updateField(emp.id, "status", v)}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="time" value={rec.check_in || ""} onChange={e => updateField(emp.id, "check_in", e.target.value)} className="w-28 h-8" /></TableCell>
                    <TableCell><Input type="time" value={rec.check_out || ""} onChange={e => updateField(emp.id, "check_out", e.target.value)} className="w-28 h-8" /></TableCell>
                  </TableRow>
                );
              })}
              {employees.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">أضف موظفين أولاً</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
