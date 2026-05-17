import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Plus, Minus, CreditCard, Banknote, Wallet } from "lucide-react";

interface CartLine {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
}

export default function POSTerminal() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [payDlg, setPayDlg] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [payments, setPayments] = useState({ cash: 0, card: 0, transfer: 0 });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("pos_sessions").select("*, pos_configs(*)").eq("id", sessionId!).maybeSingle();
      if (!s) { toast.error("الجلسة غير موجودة"); navigate("/pos/sessions"); return; }
      if (s.status !== "opened") { toast.error("الجلسة مغلقة"); navigate("/pos/sessions"); return; }
      setSession(s);
      setConfig(s.pos_configs);
      if (s.pos_configs?.default_tax_id) {
        const { data: t } = await supabase.from("taxes").select("rate").eq("id", s.pos_configs.default_tax_id).maybeSingle();
        if (t) setTaxRate(Number(t.rate));
      }
    })();
    supabase.from("products").select("id,code,name,retail_price,selling_price,cost_price,category_id,barcode").eq("is_active", true).limit(500).then(({ data }) => setProducts(data || []));
    supabase.from("product_categories").select("*").eq("is_active", true).then(({ data }) => setCategories(data || []));
    supabase.from("customers").select("id,name,code").eq("is_active", true).limit(200).then(({ data }) => setCustomers(data || []));
  }, [sessionId, navigate]);

  const filteredProducts = useMemo(() => {
    let p = products;
    if (activeCategory !== "all") p = p.filter(x => x.category_id === activeCategory);
    if (search) {
      const s = search.toLowerCase();
      p = p.filter(x => x.name.toLowerCase().includes(s) || x.code?.toLowerCase().includes(s) || x.barcode?.toLowerCase().includes(s));
    }
    return p.slice(0, 60);
  }, [products, activeCategory, search]);

  const addToCart = (p: any) => {
    const price = Number(p.retail_price || p.selling_price || 0);
    setCart(prev => {
      const idx = prev.findIndex(l => l.product_id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product_id: p.id, name: p.name, quantity: 1, unit_price: price, discount_percent: 0, tax_percent: taxRate }];
    });
  };

  const onBarcodeEnter = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const v = search.trim();
    if (!v) return;
    const p = products.find(x => x.barcode === v || x.code === v);
    if (p) { addToCart(p); setSearch(""); }
    else toast.error("الصنف غير موجود");
  };

  const updateQty = (i: number, q: number) => {
    if (q <= 0) return removeLine(i);
    setCart(prev => prev.map((l, idx) => idx === i ? { ...l, quantity: q } : l));
  };
  const removeLine = (i: number) => setCart(prev => prev.filter((_, idx) => idx !== i));

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    cart.forEach(l => {
      const lineSub = l.quantity * l.unit_price * (1 - l.discount_percent / 100);
      const lineTax = lineSub * l.tax_percent / 100;
      subtotal += lineSub;
      tax += lineTax;
    });
    return { subtotal, tax, total: subtotal + tax };
  }, [cart]);

  const openPay = () => {
    if (cart.length === 0) return toast.error("السلة فارغة");
    if (config?.require_customer && (!customerId || customerId === "walk-in")) return toast.error("يجب اختيار عميل");
    setPayments({ cash: totals.total, card: 0, transfer: 0 });
    setPayDlg(true);
  };

  const confirmPayment = async () => {
    const paid = (payments.cash || 0) + (payments.card || 0) + (payments.transfer || 0);
    if (paid < totals.total) return toast.error("المبلغ المدفوع أقل من المطلوب");

    const order_number = `POS-${Date.now()}`;
    const { data: order, error } = await supabase.from("pos_orders").insert({
      order_number,
      session_id: session.id,
      config_id: config.id,
      customer_id: customerId && customerId !== "walk-in" ? customerId : null,
      cashier_id: session.cashier_id,
      status: "draft",
      subtotal: totals.subtotal,
      tax_amount: totals.tax,
      total: totals.total,
      paid_amount: paid,
      change_amount: paid - totals.total,
    }).select().single();
    if (error || !order) return toast.error(error?.message || "خطأ في إنشاء الطلب");

    const lines = cart.map(l => ({
      order_id: order.id,
      product_id: l.product_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_percent: l.discount_percent,
      tax_percent: l.tax_percent,
      line_subtotal: l.quantity * l.unit_price * (1 - l.discount_percent / 100),
      line_tax: l.quantity * l.unit_price * (1 - l.discount_percent / 100) * l.tax_percent / 100,
      line_total: l.quantity * l.unit_price * (1 - l.discount_percent / 100) * (1 + l.tax_percent / 100),
    }));
    await supabase.from("pos_order_lines").insert(lines);

    const pays: any[] = [];
    if (payments.cash > 0) pays.push({ order_id: order.id, payment_method: "cash", amount: payments.cash });
    if (payments.card > 0) pays.push({ order_id: order.id, payment_method: "card", amount: payments.card });
    if (payments.transfer > 0) pays.push({ order_id: order.id, payment_method: "transfer", amount: payments.transfer });
    if (pays.length) await supabase.from("pos_payments").insert(pays);

    const { error: payErr } = await supabase.rpc("pay_pos_order" as any, { _order_id: order.id });
    if (payErr) return toast.error(payErr.message);

    toast.success(`تمت الفاتورة ${order.order_number}. الباقي: ${(paid - totals.total).toFixed(2)}`);
    setCart([]); setCustomerId(""); setPayDlg(false); setSearch("");
    searchRef.current?.focus();
  };

  if (!session) return <div className="p-8 text-center">جارٍ التحميل...</div>;

  return (
    <div className="h-[calc(100vh-100px)] flex gap-3 p-3 bg-muted/30">
      {/* Right: Cart */}
      <div className="w-[380px] flex flex-col bg-card rounded-lg border shadow-sm">
        <div className="bg-primary text-primary-foreground p-3 rounded-t-lg flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10" onClick={() => navigate("/pos/sessions")}>
            <ArrowLeft className="h-4 w-4 me-1" /> خروج
          </Button>
          <div className="text-sm font-mono">{session.session_number}</div>
        </div>

        <div className="p-3 border-b">
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="عميل نقدي (اختياري)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="walk-in">عميل نقدي</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">السلة فارغة</div>
          ) : cart.map((l, i) => (
            <div key={i} className="border rounded-lg p-2 mb-2 bg-background">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium flex-1">{l.name}</div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(i)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i, l.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                <Input className="h-7 w-14 text-center" value={l.quantity} onChange={e => updateQty(i, Number(e.target.value) || 0)} />
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i, l.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                <div className="flex-1 text-end text-sm">
                  {(l.quantity * l.unit_price).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-3 space-y-1 bg-muted/20">
          <div className="flex justify-between text-sm"><span>المجموع</span><span>{totals.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span>الضريبة</span><span>{totals.tax.toFixed(2)}</span></div>
          <div className="flex justify-between text-lg font-bold text-primary border-t pt-2"><span>الإجمالي</span><span>{totals.total.toFixed(2)}</span></div>
          <Button className="w-full h-12 text-lg mt-2" onClick={openPay} disabled={cart.length === 0}>
            <CreditCard className="h-5 w-5 me-2" /> دفع
          </Button>
        </div>
      </div>

      {/* Left: Products */}
      <div className="flex-1 flex flex-col bg-card rounded-lg border shadow-sm">
        <div className="p-3 border-b flex gap-2">
          <Input
            ref={searchRef}
            autoFocus
            placeholder="بحث / مسح باركود..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={onBarcodeEnter}
            className="text-base"
          />
        </div>

        <div className="p-2 border-b flex gap-2 overflow-x-auto">
          <Badge variant={activeCategory === "all" ? "default" : "outline"} className="cursor-pointer px-3 py-1" onClick={() => setActiveCategory("all")}>الكل</Badge>
          {categories.map(c => (
            <Badge key={c.id} variant={activeCategory === c.id ? "default" : "outline"} className="cursor-pointer px-3 py-1 whitespace-nowrap" onClick={() => setActiveCategory(c.id)}>{c.name}</Badge>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredProducts.map(p => (
              <Card key={p.id} className="p-3 cursor-pointer hover:shadow-md hover:border-primary transition-all active:scale-95" onClick={() => addToCart(p)}>
                <div className="text-sm font-medium line-clamp-2 min-h-[40px]">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.code}</div>
                <div className="text-lg font-bold text-primary mt-1">{Number(p.retail_price || p.selling_price || 0).toFixed(2)}</div>
              </Card>
            ))}
          </div>
          {filteredProducts.length === 0 && <div className="text-center py-8 text-muted-foreground">لا توجد منتجات</div>}
        </div>
      </div>

      {/* Payment dialog */}
      <Dialog open={payDlg} onOpenChange={setPayDlg}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>الدفع — الإجمالي: {totals.total.toFixed(2)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm flex items-center gap-1"><Banknote className="h-4 w-4" /> نقدي</label>
              <Input type="number" value={payments.cash} onChange={e => setPayments({ ...payments, cash: Number(e.target.value) || 0 })} className="h-12 text-lg" />
            </div>
            <div>
              <label className="text-sm flex items-center gap-1"><CreditCard className="h-4 w-4" /> شبكة / بطاقة</label>
              <Input type="number" value={payments.card} onChange={e => setPayments({ ...payments, card: Number(e.target.value) || 0 })} className="h-12 text-lg" />
            </div>
            <div>
              <label className="text-sm flex items-center gap-1"><Wallet className="h-4 w-4" /> تحويل</label>
              <Input type="number" value={payments.transfer} onChange={e => setPayments({ ...payments, transfer: Number(e.target.value) || 0 })} className="h-12 text-lg" />
            </div>
            <div className="flex justify-between font-bold text-lg p-2 bg-muted rounded">
              <span>الباقي للعميل:</span>
              <span className={(payments.cash + payments.card + payments.transfer - totals.total) < 0 ? "text-destructive" : "text-green-600"}>
                {(payments.cash + payments.card + payments.transfer - totals.total).toFixed(2)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDlg(false)}>إلغاء</Button>
            <Button onClick={confirmPayment}>تأكيد الدفع</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
