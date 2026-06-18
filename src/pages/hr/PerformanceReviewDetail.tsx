import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function PerformanceReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [emps, setEmps] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [activeReview, setActiveReview] = useState<any>(null);
  const [ratings, setRatings] = useState<Record<string, { score: number; comment: string }>>({});
  const [reviewForm, setReviewForm] = useState<any>({ employee_id: "", overall_rating: "good", strengths: "", weaknesses: "", development_plan: "", comments: "" });

  const fetch = async () => {
    setLoading(true);
    const [c, r, e, cr] = await Promise.all([
      supabase.from("hr_performance_cycles").select("*").eq("id", id).maybeSingle(),
      supabase.from("hr_performance_reviews").select("*").eq("cycle_id", id),
      supabase.from("hr_employees").select("id, full_name, employee_number").eq("is_active", true),
      supabase.from("hr_performance_criteria").select("*").eq("is_active", true).order("weight", { ascending: false }),
    ]);
    setCycle(c.data); setReviews(r.data || []); setEmps(e.data || []); setCriteria(cr.data || []);
    setLoading(false);
  };
  useEffect(() => { if (id) fetch(); }, [id]);

  const openReview = async (review?: any) => {
    if (review) {
      setActiveReview(review);
      setReviewForm({ ...review });
      const { data } = await supabase.from("hr_review_ratings").select("*").eq("review_id", review.id);
      const map: any = {};
      (data || []).forEach(r => { map[r.criteria_id] = { score: r.score, comment: r.comment || "" }; });
      setRatings(map);
    } else {
      setActiveReview(null);
      setReviewForm({ employee_id: "", overall_rating: "good", strengths: "", weaknesses: "", development_plan: "", comments: "" });
      setRatings({});
    }
    setOpen(true);
  };

  const computeScore = () => {
    let total = 0, weightSum = 0;
    criteria.forEach(c => {
      const r = ratings[c.id];
      if (r && r.score) {
        total += (Number(r.score) / Number(c.max_score)) * Number(c.weight) * 100;
        weightSum += Number(c.weight);
      }
    });
    return weightSum > 0 ? Math.round(total / weightSum) : 0;
  };

  const save = async () => {
    if (!reviewForm.employee_id) return toast.error("اختر الموظف");
    const payload: any = {
      cycle_id: id,
      employee_id: reviewForm.employee_id,
      overall_score: computeScore(),
      overall_rating: reviewForm.overall_rating,
      strengths: reviewForm.strengths,
      weaknesses: reviewForm.weaknesses,
      development_plan: reviewForm.development_plan,
      comments: reviewForm.comments,
      status: reviewForm.status || "draft",
    };
    let reviewId = activeReview?.id;
    if (activeReview) {
      const r = await supabase.from("hr_performance_reviews").update(payload).eq("id", activeReview.id);
      if (r.error) return toast.error(r.error.message);
    } else {
      const r = await supabase.from("hr_performance_reviews").insert(payload).select().single();
      if (r.error) return toast.error(r.error.message);
      reviewId = r.data.id;
    }
    // Save ratings
    await supabase.from("hr_review_ratings").delete().eq("review_id", reviewId);
    const lines = Object.entries(ratings).filter(([_, v]) => v.score).map(([cid, v]) => ({
      review_id: reviewId, criteria_id: cid, score: v.score, comment: v.comment || null,
    }));
    if (lines.length) {
      const r = await supabase.from("hr_review_ratings").insert(lines);
      if (r.error) return toast.error(r.error.message);
    }
    toast.success("تم الحفظ");
    setOpen(false);
    fetch();
  };

  const del = async (rid: string) => {
    if (!confirm("حذف التقييم؟")) return;
    const r = await supabase.from("hr_performance_reviews").delete().eq("id", rid);
    if (r.error) toast.error(r.error.message); else fetch();
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!cycle) return <div className="p-8 text-center">الدورة غير موجودة</div>;

  const ratingColor = (r: string) => ({
    excellent: "text-green-600", good: "text-blue-600", satisfactory: "text-amber-600",
    needs_improvement: "text-orange-600", poor: "text-red-600",
  }[r] || "");

  return (
    <div className="space-y-4">
      <ListPageHeader
        title={`دورة التقييم: ${cycle.cycle_name}`}
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "تقييم الأداء", href: "/hr/performance" }, { label: cycle.cycle_name }]}
        showSearch={false}
        showAdd={false}
      />
      <div className="flex justify-between items-center px-4">
        <Button variant="outline" onClick={() => navigate("/hr/performance")}><ArrowRight className="me-2 h-4 w-4" />رجوع</Button>
        <Button onClick={() => openReview()}><Plus className="me-2 h-4 w-4" />تقييم موظف</Button>
      </div>

      <Card className="mx-4">
        <CardHeader><CardTitle>تقييمات الموظفين</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>الموظف</TableHead><TableHead>الدرجة</TableHead><TableHead>التقدير</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {reviews.map(r => {
                const emp = emps.find(e => e.id === r.employee_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{emp?.full_name || "-"}</TableCell>
                    <TableCell className="font-mono">{r.overall_score || 0}%</TableCell>
                    <TableCell className={ratingColor(r.overall_rating)}>{r.overall_rating || "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openReview(r)}>تعديل</Button>
                      <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {reviews.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">لا توجد تقييمات</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تقييم موظف</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الموظف *</Label>
                <Select value={reviewForm.employee_id} onValueChange={v => setReviewForm({ ...reviewForm, employee_id: v })} disabled={!!activeReview}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>{emps.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>التقدير العام</Label>
                <Select value={reviewForm.overall_rating} onValueChange={v => setReviewForm({ ...reviewForm, overall_rating: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">ممتاز</SelectItem>
                    <SelectItem value="good">جيد جداً</SelectItem>
                    <SelectItem value="satisfactory">مرضي</SelectItem>
                    <SelectItem value="needs_improvement">يحتاج تحسين</SelectItem>
                    <SelectItem value="poor">ضعيف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-base">معايير التقييم</Label>
              <div className="space-y-2 mt-2 border rounded-lg p-3">
                {criteria.map(c => {
                  const r = ratings[c.id] || { score: 0, comment: "" };
                  return (
                    <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <div className="font-medium text-sm">{c.name}</div>
                        <div className="text-xs text-muted-foreground">وزن {c.weight} / من {c.max_score}</div>
                      </div>
                      <div className="col-span-3">
                        <Input type="number" min="0" max={c.max_score} step="0.5" value={r.score}
                          onChange={e => setRatings({ ...ratings, [c.id]: { ...r, score: Number(e.target.value) } })}
                          placeholder="الدرجة" />
                      </div>
                      <div className="col-span-5">
                        <Input value={r.comment} onChange={e => setRatings({ ...ratings, [c.id]: { ...r, comment: e.target.value } })} placeholder="ملاحظة (اختياري)" />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t flex justify-end">
                  <Badge variant="default" className="text-base">الدرجة الإجمالية: {computeScore()}%</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div><Label>نقاط القوة</Label><Textarea rows={2} value={reviewForm.strengths || ""} onChange={e => setReviewForm({ ...reviewForm, strengths: e.target.value })} /></div>
              <div><Label>نقاط للتحسين</Label><Textarea rows={2} value={reviewForm.weaknesses || ""} onChange={e => setReviewForm({ ...reviewForm, weaknesses: e.target.value })} /></div>
              <div><Label>خطة التطوير</Label><Textarea rows={2} value={reviewForm.development_plan || ""} onChange={e => setReviewForm({ ...reviewForm, development_plan: e.target.value })} /></div>
              <div><Label>ملاحظات إضافية</Label><Textarea rows={2} value={reviewForm.comments || ""} onChange={e => setReviewForm({ ...reviewForm, comments: e.target.value })} /></div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save}><Save className="me-2 h-4 w-4" />حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
