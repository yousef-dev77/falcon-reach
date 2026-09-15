import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Play, Save, Trash2 } from "lucide-react";
import { printOfficialDocument } from "@/lib/officialPrint";

type Column = { key: string; label: string; numeric?: boolean };

type Dataset = {
  key: string;
  label: string;
  table: string;
  select: string;
  dateField: string;
  branchField?: string;
  columns: Column[];
  resolve?: (row: any) => Record<string, unknown>;
};

const DATASETS: Dataset[] = [
  {
    key: "sales_invoices",
    label: "فواتير المبيعات",
    table: "sales_invoices",
    select: "invoice_number, invoice_date, status, subtotal, tax_amount, discount_amount, total_amount, paid_amount, customers(name)",
    dateField: "invoice_date",
    branchField: "branch_id",
    columns: [
      { key: "invoice_number", label: "رقم الفاتورة" },
      { key: "invoice_date", label: "التاريخ" },
      { key: "customer", label: "العميل" },
      { key: "status", label: "الحالة" },
      { key: "subtotal", label: "قبل الضريبة", numeric: true },
      { key: "tax_amount", label: "الضريبة", numeric: true },
      { key: "discount_amount", label: "الخصم", numeric: true },
      { key: "total_amount", label: "الإجمالي", numeric: true },
      { key: "paid_amount", label: "المدفوع", numeric: true },
    ],
    resolve: (r) => ({ ...r, customer: r.customers?.name ?? "-" }),
  },
  {
    key: "purchase_invoices",
    label: "فواتير المشتريات",
    table: "purchase_invoices",
    select: "invoice_number, invoice_date, status, subtotal, tax_amount, total_amount, paid_amount, suppliers(name)",
    dateField: "invoice_date",
    branchField: "branch_id",
    columns: [
      { key: "invoice_number", label: "رقم الفاتورة" },
      { key: "invoice_date", label: "التاريخ" },
      { key: "supplier", label: "المورد" },
      { key: "status", label: "الحالة" },
      { key: "subtotal", label: "قبل الضريبة", numeric: true },
      { key: "tax_amount", label: "الضريبة", numeric: true },
      { key: "total_amount", label: "الإجمالي", numeric: true },
      { key: "paid_amount", label: "المدفوع", numeric: true },
    ],
    resolve: (r) => ({ ...r, supplier: r.suppliers?.name ?? "-" }),
  },
  {
    key: "collections",
    label: "سندات التحصيل",
    table: "collections",
    select: "receipt_number, receipt_date, amount, payment_method, notes, customers(name)",
    dateField: "receipt_date",
    columns: [
      { key: "receipt_number", label: "رقم السند" },
      { key: "receipt_date", label: "التاريخ" },
      { key: "customer", label: "العميل" },
      { key: "payment_method", label: "طريقة الدفع" },
      { key: "amount", label: "المبلغ", numeric: true },
      { key: "notes", label: "ملاحظات" },
    ],
    resolve: (r) => ({ ...r, customer: r.customers?.name ?? "-" }),
  },
  {
    key: "payments",
    label: "سندات الدفع للموردين",
    table: "payments",
    select: "payment_number, payment_date, amount, payment_method, notes, suppliers(name)",
    dateField: "payment_date",
    columns: [
      { key: "payment_number", label: "رقم السند" },
      { key: "payment_date", label: "التاريخ" },
      { key: "supplier", label: "المورد" },
      { key: "payment_method", label: "طريقة الدفع" },
      { key: "amount", label: "المبلغ", numeric: true },
      { key: "notes", label: "ملاحظات" },
    ],
    resolve: (r) => ({ ...r, supplier: r.suppliers?.name ?? "-" }),
  },
  {
    key: "expenses_revenues",
    label: "المصروفات والإيرادات",
    table: "expenses_revenues",
    select: "transaction_number, transaction_date, transaction_type, category, amount, description, payment_method",
    dateField: "transaction_date",
    columns: [
      { key: "transaction_number", label: "رقم العملية" },
      { key: "transaction_date", label: "التاريخ" },
      { key: "transaction_type", label: "النوع" },
      { key: "category", label: "التصنيف" },
      { key: "amount", label: "المبلغ", numeric: true },
      { key: "description", label: "البيان" },
      { key: "payment_method", label: "طريقة الدفع" },
    ],
  },
  {
    key: "journal_entries",
    label: "القيود اليومية",
    table: "journal_entries",
    select: "entry_number, entry_date, description, reference, is_posted",
    dateField: "entry_date",
    branchField: "branch_id",
    columns: [
      { key: "entry_number", label: "رقم القيد" },
      { key: "entry_date", label: "التاريخ" },
      { key: "description", label: "البيان" },
      { key: "reference", label: "المرجع" },
      { key: "posted", label: "مرحّل" },
    ],
    resolve: (r) => ({ ...r, posted: r.is_posted ? "نعم" : "لا" }),
  },
  {
    key: "inventory_movements",
    label: "حركات المخزون",
    table: "inventory_movements",
    select: "movement_date, movement_type, quantity, unit_cost, products(name, code), warehouses(name)",
    dateField: "movement_date",
    columns: [
      { key: "movement_date", label: "التاريخ" },
      { key: "product", label: "الصنف" },
      { key: "warehouse", label: "المخزن" },
      { key: "movement_type", label: "نوع الحركة" },
      { key: "quantity", label: "الكمية", numeric: true },
      { key: "unit_cost", label: "التكلفة", numeric: true },
    ],
    resolve: (r) => ({
      ...r,
      product: r.products ? `${r.products.code} - ${r.products.name}` : "-",
      warehouse: r.warehouses?.name ?? "-",
    }),
  },
];

const PRESET_KEY = "report-builder-presets";
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

interface Preset {
  name: string;
  dataset: string;
  columns: string[];
  from: string;
  to: string;
  branchId: string;
}

export default function ReportBuilder() {
  const [datasetKey, setDatasetKey] = useState(DATASETS[0].key);
  const dataset = DATASETS.find((d) => d.key === datasetKey)!;
  const [selected, setSelected] = useState<string[]>(dataset.columns.map((c) => c.key));
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [branchId, setBranchId] = useState("all");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    try {
      setPresets(JSON.parse(localStorage.getItem(PRESET_KEY) || "[]"));
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    setSelected(dataset.columns.map((c) => c.key));
    setRows([]);
  }, [datasetKey]);

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    supabase
      .from("branches")
      .select("id, name")
      .order("name")
      .then(({ data }) => setBranches(data ?? []));
  }, []);

  const run = async () => {
    setLoading(true);
    let query = supabase
      .from(dataset.table as any)
      .select(dataset.select)
      .gte(dataset.dateField, from)
      .lte(dataset.dateField, to)
      .order(dataset.dateField, { ascending: false })
      .limit(1000);
    if (dataset.branchField && branchId !== "all") query = query.eq(dataset.branchField, branchId);
    const { data, error } = await query;
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows(((data ?? []) as any[]).map((r) => (dataset.resolve ? dataset.resolve(r) : r)));
  };

  const activeColumns = useMemo(
    () => dataset.columns.filter((c) => selected.includes(c.key)),
    [dataset, selected],
  );

  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    activeColumns
      .filter((c) => c.numeric)
      .forEach((c) => {
        map[c.key] = rows.reduce((s, r) => s + Number(r[c.key] ?? 0), 0);
      });
    return map;
  }, [activeColumns, rows]);

  const savePreset = () => {
    if (!presetName.trim()) return toast.error("اكتب اسماً للتقرير");
    const next = [
      ...presets.filter((p) => p.name !== presetName.trim()),
      { name: presetName.trim(), dataset: datasetKey, columns: selected, from, to, branchId },
    ];
    setPresets(next);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    setPresetName("");
    toast.success("تم حفظ التقرير");
  };

  const applyPreset = (p: Preset) => {
    setDatasetKey(p.dataset);
    window.setTimeout(() => {
      setSelected(p.columns);
      setFrom(p.from);
      setTo(p.to);
      setBranchId(p.branchId);
    }, 0);
  };

  const removePreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
  };

  const printReport = () => {
    if (rows.length === 0) return toast.info("نفّذ التقرير أولاً");
    const head = activeColumns.map((c) => `<th>${c.label}</th>`).join("");
    const body = rows
      .map(
        (r) =>
          `<tr>${activeColumns
            .map((c) => `<td>${c.numeric ? Number(r[c.key] ?? 0).toLocaleString() : String(r[c.key] ?? "-")}</td>`)
            .join("")}</tr>`,
      )
      .join("");
    const footer = activeColumns
      .map((c) => `<th>${c.numeric ? totals[c.key]?.toLocaleString() ?? "" : ""}</th>`)
      .join("");
    printOfficialDocument({
      title: `تقرير ${dataset.label}`,
      meta: `الفترة من ${from} إلى ${to} — عدد السجلات ${rows.length}`,
      bodyHtml: `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot><tr>${footer}</tr></tfoot></table>`,
      showSignatures: false,
    });
  };

  return (
    <div>
      <ListPageHeader
        title="منشئ التقارير المرن"
        subtitle="اختر البيانات والفترة والأعمدة ثم نفّذ التقرير أو صدّره"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "منشئ التقارير" }]}
        showAdd={false}
        showSearch={false}
        onPrint={printReport}
        onExportPdf={printReport}
        onRefresh={run}
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-5 items-end">
          <div className="md:col-span-2">
            <Label>البيانات</Label>
            <Select value={datasetKey} onValueChange={setDatasetKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATASETS.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>الفرع</Label>
            <Select value={branchId} onValueChange={setBranchId} disabled={!dataset.branchField}>
              <SelectTrigger>
                <SelectValue placeholder="كل الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفروع</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">الأعمدة المعروضة</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {dataset.columns.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selected.includes(c.key)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => (v ? [...prev, c.key] : prev.filter((k) => k !== c.key)))
                  }
                />
                {c.label}
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-end gap-2">
          <Button onClick={run} className="gap-1.5">
            <Play className="h-4 w-4" />
            تنفيذ التقرير
          </Button>
          <div className="flex items-end gap-2">
            <div>
              <Label>حفظ باسم</Label>
              <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} className="w-48" placeholder="مثال: مبيعات الربع" />
            </div>
            <Button variant="outline" onClick={savePreset} className="gap-1.5">
              <Save className="h-4 w-4" />
              حفظ
            </Button>
          </div>
        </div>

        {presets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Badge key={p.name} variant="outline" className="gap-2 py-1.5 px-2">
                <button type="button" onClick={() => applyPreset(p)} className="hover:underline">
                  {p.name}
                </button>
                <button type="button" onClick={() => removePreset(p.name)} aria-label={`حذف ${p.name}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {loading ? (
          <Loader2 className="animate-spin mx-auto my-8" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {activeColumns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeColumns.length || 1} className="text-center text-muted-foreground py-8">
                    اضغط "تنفيذ التقرير" لعرض النتائج
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      {activeColumns.map((c) => (
                        <TableCell key={c.key} className={c.numeric ? "font-mono" : ""}>
                          {c.numeric ? Number(r[c.key] ?? 0).toLocaleString() : String(r[c.key] ?? "-")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    {activeColumns.map((c) => (
                      <TableCell key={c.key}>
                        {c.numeric ? totals[c.key]?.toLocaleString() : c === activeColumns[0] ? "الإجمالي" : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
