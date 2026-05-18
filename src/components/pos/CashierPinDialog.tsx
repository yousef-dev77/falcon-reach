import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Delete, LogIn } from "lucide-react";

export interface ActiveCashier {
  user_id: string;
  full_name: string;
  is_manager: boolean;
}

interface Props {
  open: boolean;
  onClose?: () => void;          // optional — gate has no close when initial
  onSuccess: (c: ActiveCashier) => void;
  branchId?: string | null;
  title?: string;
  /** Require the verified user to be a manager (override) */
  requireManager?: boolean;
  /** If true, dialog cannot be dismissed */
  blocking?: boolean;
}

export function CashierPinDialog({
  open, onClose, onSuccess, branchId,
  title = "تسجيل دخول الكاشير",
  requireManager = false,
  blocking = false,
}: Props) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) setPin(""); }, [open]);

  const press = (d: string) => setPin(p => (p.length >= 8 ? p : p + d));
  const back = () => setPin(p => p.slice(0, -1));

  const submit = async () => {
    if (pin.length < 4) return toast.error("الرمز يجب أن يكون 4 أرقام على الأقل");
    setLoading(true);
    const { data, error } = await supabase.rpc("verify_user_pin" as any, {
      _pin: pin,
      _branch_id: branchId ?? null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.user_id) return toast.error("الرمز غير صحيح أو لا تملك صلاحية على هذا الفرع");
    if (requireManager && !row.is_manager) return toast.error("يحتاج صلاحية مشرف");
    onSuccess({ user_id: row.user_id, full_name: row.full_name, is_manager: row.is_manager });
    setPin("");
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !blocking) onClose?.(); }}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={e => blocking && e.preventDefault()}
        onEscapeKeyDown={e => blocking && e.preventDefault()}
        
      >
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            أدخل رمز PIN الخاص بك
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="password"
            value={pin}
            readOnly
            className="text-center text-3xl tracking-[1em] h-14"
            placeholder="••••"
          />
          <div className="grid grid-cols-3 gap-2">
            {["1","2","3","4","5","6","7","8","9"].map(d => (
              <Button key={d} variant="outline" className="h-14 text-xl" onClick={() => press(d)}>{d}</Button>
            ))}
            <Button variant="outline" className="h-14" onClick={back}><Delete className="h-5 w-5" /></Button>
            <Button variant="outline" className="h-14 text-xl" onClick={() => press("0")}>0</Button>
            <Button className="h-14" onClick={submit} disabled={loading}>
              <LogIn className="h-5 w-5 me-1" /> دخول
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
