import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  Printer,
  FileSpreadsheet,
  FileText,
  FileType2,
  Copy,
  RefreshCw,
  Search,
  ChevronLeft,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { exportPageToWord, exportVisibleTablesToExcel } from "@/lib/documentExport";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ListPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  onAdd?: () => void;
  onDelete?: () => void;
  onPrint?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onExportWord?: () => void;
  onCopy?: () => void;
  onRefresh?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  addLabel?: string;
  showAdd?: boolean;
  showDelete?: boolean;
  showPrint?: boolean;
  showExport?: boolean;
  showCopy?: boolean;
  showRefresh?: boolean;
  showSearch?: boolean;
  extraActions?: ReactNode;
  deleteDisabled?: boolean;
  showOfficialPrint?: boolean;
  officialDocumentNumber?: string;
}


export function ListPageHeader({
  title,
  subtitle,
  breadcrumbs,
  onAdd,
  onDelete,
  onPrint,
  onExportExcel,
  onExportPdf,
  onExportWord,
  onCopy,

  onRefresh,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "بحث...",
  addLabel = "إضافة جديد",
  showAdd = true,
  showDelete = false,
  showPrint = true,
  showExport = true,
  showCopy = false,
  showRefresh = true,
  showSearch = true,
  extraActions,
  deleteDisabled = true,
  showOfficialPrint = true,
  officialDocumentNumber,
}: ListPageHeaderProps) {
  const navigate = useNavigate();

  const defaultBreadcrumbs: BreadcrumbItem[] = breadcrumbs || [
    { label: "الرئيسية", href: "/" },
    { label: title },
  ];

  const handleExportExcel = () => {
    if (onExportExcel) return onExportExcel();
    if (!exportVisibleTablesToExcel(title)) toast.info("لا يوجد جدول ظاهر لتصديره في هذه الشاشة");
  };
  const handleExportWord = () => (onExportWord ? onExportWord() : exportPageToWord(title));
  const handleExportPdf = () => (onExportPdf ? onExportPdf() : window.print());
  const handleOfficialPrint = async () => {
    const ok = await printCurrentScreen(title, officialDocumentNumber);
    if (!ok) toast.error("تم منع فتح نافذة الطباعة، يرجى السماح بالنوافذ المنبثقة");
  };

  return (
    <div className="space-y-0">
      {/* Title + Breadcrumb Bar */}
      <div className="bg-primary text-primary-foreground px-4 py-3 rounded-t-lg flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>}
        </div>
        <nav aria-label="مسار الصفحة" className="flex items-center gap-1 text-xs overflow-x-auto whitespace-nowrap print:hidden">
          {defaultBreadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronLeft className="h-3 w-3 opacity-70" />}
              {crumb.href ? (
                <button
                  type="button"
                  onClick={() => navigate(crumb.href!)}
                  className="hover:underline cursor-pointer opacity-80 hover:opacity-100 flex items-center"
                >
                  {index === 0 && <Home className="h-3.5 w-3.5 me-1" />}
                  {crumb.label}
                </button>
              ) : (
                <span className="font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>


      {/* Toolbar */}
      <div className="bg-card border border-t-0 border-border px-3 py-2 flex items-center gap-1.5 flex-wrap print:hidden">
        <TooltipProvider delayDuration={300}>
          {/* Add Button - labeled for clarity */}
          {showAdd && onAdd && (
            <Button onClick={onAdd} size="sm" className="h-9 gap-1.5">
              <Plus className="h-4 w-4" />
              <span>{addLabel}</span>
            </Button>
          )}

          {/* Delete Button */}
          {showDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  disabled={deleteDisabled}
                  aria-label="حذف"
                  className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>حذف</TooltipContent>
            </Tooltip>
          )}

          {/* Separator */}
          {(showAdd || showDelete) && (showPrint || showExport) && (
            <div className="w-px h-6 bg-border mx-1" />
          )}

          {/* Print */}
          {showPrint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPrint || (() => window.print())}
                  aria-label="طباعة"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                  <Printer className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>طباعة</TooltipContent>
            </Tooltip>
          )}

          {/* Export Excel */}
          {showExport && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExportExcel}
                  aria-label="تصدير Excel"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                  <FileSpreadsheet className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تصدير Excel</TooltipContent>
            </Tooltip>
          )}

          {/* Export Word */}
          {showExport && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExportWord}
                  aria-label="تصدير Word"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                  <FileType2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تصدير Word</TooltipContent>
            </Tooltip>
          )}

          {/* Export PDF */}
          {showExport && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExportPdf}
                  aria-label="حفظ PDF"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>حفظ PDF</TooltipContent>
            </Tooltip>
          )}


          {/* Copy */}
          {showCopy && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCopy}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>نسخ</TooltipContent>
            </Tooltip>
          )}

          {/* Separator */}
          {(showPrint || showExport || showCopy) && showRefresh && (
            <div className="w-px h-6 bg-border mx-1" />
          )}

          {/* Refresh */}
          {showRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRefresh}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تحديث</TooltipContent>
            </Tooltip>
          )}

          {/* Extra actions */}
          {extraActions}
        </TooltipProvider>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        {showSearch && onSearchChange && (
          <div className="relative w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pe-3 ps-3 pr-9 h-9"
            />
          </div>
        )}
      </div>
    </div>
  );
}
