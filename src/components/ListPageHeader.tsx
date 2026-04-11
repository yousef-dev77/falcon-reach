import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plus,
  Trash2,
  Printer,
  FileSpreadsheet,
  FileText,
  Copy,
  RefreshCw,
  Search,
  ChevronLeft,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}: ListPageHeaderProps) {
  const navigate = useNavigate();

  const defaultBreadcrumbs: BreadcrumbItem[] = breadcrumbs || [
    { label: "الرئيسية", href: "/" },
    { label: title },
  ];

  return (
    <div className="space-y-0">
      {/* Breadcrumb Bar */}
      <div className="bg-primary text-primary-foreground px-4 py-2 rounded-t-lg flex items-center gap-2 text-sm">
        {defaultBreadcrumbs.map((crumb, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronLeft className="h-3 w-3" />}
            {crumb.href ? (
              <button
                onClick={() => navigate(crumb.href!)}
                className="hover:underline cursor-pointer opacity-80 hover:opacity-100"
              >
                {index === 0 && <Home className="h-3.5 w-3.5 inline me-1" />}
                {crumb.label}
              </button>
            ) : (
              <span className="font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-card border border-t-0 border-border px-4 py-2 flex items-center gap-1 flex-wrap">
        <TooltipProvider delayDuration={300}>
          {/* Add Button */}
          {showAdd && onAdd && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onAdd}
                  className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{addLabel}</TooltipContent>
            </Tooltip>
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
                  onClick={onExportExcel}
                  className="h-9 w-9 text-green-700 hover:text-green-800 hover:bg-green-50"
                >
                  <FileSpreadsheet className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تصدير Excel</TooltipContent>
            </Tooltip>
          )}

          {/* Export PDF */}
          {showExport && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onExportPdf}
                  className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <FileText className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تصدير PDF</TooltipContent>
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
