import {
  Wallet, Package, ShoppingCart, ShoppingBag, Settings, Users, Monitor,
  Layers, FileText, Receipt, TrendingUp, DollarSign, Building2, Calendar,
  Target, Warehouse, Box, ArrowDownUp, PackagePlus, UserPlus, CreditCard,
  FileBarChart, BarChart3, UserCog, MapPin, Clock, User, Home, LandPlot,
  type LucideIcon,
} from "lucide-react";

export interface ModuleNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

export interface ModuleDefinition {
  key: string;                    // stable module key stored in DB
  name: string;                   // Arabic display name
  shortName?: string;             // shorter chip label
  description: string;            // one-line pitch shown in launcher
  icon: LucideIcon;
  color: string;                  // tailwind class for icon tint bg
  permission?: string;            // usePermissions key
  roles: string[];                // fallback role check
  home: string;                   // entry URL when opened
  items: ModuleNavItem[];         // sidebar items
  installable?: boolean;          // false => always available (settings)
  dependsOn?: string[];           // modules auto-installed with this one
}

export const MODULES: ModuleDefinition[] = [
  {
    key: "finance",
    name: "النظام المالي",
    shortName: "المالية",
    description: "المحاسبة العامة، القيود، دفتر الأستاذ، التقارير المالية والضرائب.",
    icon: Wallet,
    color: "bg-blue-500",
    permission: "finance",
    roles: ["admin", "branch_manager", "accountant"],
    home: "/finance/accounts",
    installable: false, // core module
    items: [
      { title: "شجرة الحسابات", url: "/finance/accounts", icon: Layers },
      { title: "القيود اليومية", url: "/finance/journal-entries", icon: FileText },
      { title: "سندات صرف HR", url: "/finance/hr-vouchers", icon: FileText },
      { title: "أنواع القيود", url: "/finance/journal-types", icon: FileText },
      { title: "الأستاذ العام", url: "/finance/general-ledger", icon: Receipt },
      { title: "دفتر الأستاذ المساعد", url: "/finance/sub-ledger", icon: Receipt },
      { title: "العملات", url: "/finance/currencies", icon: DollarSign },
      { title: "أسعار الصرف", url: "/finance/exchange-rates", icon: TrendingUp },
      { title: "تسوية فروقات العملة", url: "/finance/fx-adjustment", icon: ArrowDownUp },
      { title: "كشوفات البنك", url: "/finance/bank-statements", icon: FileText },
      { title: "التسوية البنكية", url: "/finance/bank-reconciliation", icon: Building2 },
      { title: "الفترات المحاسبية", url: "/finance/fiscal-periods", icon: Calendar },
      { title: "الإقفال السنوي", url: "/finance/year-end-closing", icon: Calendar },
      { title: "مراكز التكلفة", url: "/finance/cost-centers", icon: Target },
      { title: "التقارير المالية", url: "/finance/reports", icon: BarChart3 },
      { title: "الصناديق والبنوك", url: "/finance/cash-bank", icon: Building2 },
      { title: "حركة البنوك والصناديق", url: "/finance/bank-cash-report", icon: FileBarChart },
      { title: "المصاريف والإيرادات", url: "/finance/expenses-revenue", icon: TrendingUp },
      { title: "الأصول الثابتة", url: "/finance/fixed-assets", icon: LandPlot },
      { title: "إهلاك الأصول", url: "/finance/asset-depreciation", icon: TrendingUp },
      { title: "إدارة الضرائب", url: "/finance/taxes", icon: Receipt },
      { title: "الإقرار الضريبي (VAT)", url: "/finance/vat-declaration", icon: FileBarChart },
      { title: "تحليل أعمار الذمم", url: "/finance/aging-report", icon: Clock },
    ],
  },
  {
    key: "inventory",
    name: "النظام المخزني",
    shortName: "المخزون",
    description: "المستودعات، الأصناف، الحركات المخزنية والجرد.",
    icon: Package,
    color: "bg-emerald-500",
    permission: "inventory",
    roles: ["admin", "branch_manager", "inventory_manager"],
    home: "/inventory/products",
    items: [
      { title: "المستودعات", url: "/inventory/warehouses", icon: Warehouse },
      { title: "الأصناف والمنتجات", url: "/inventory/products", icon: Box },
      { title: "فئات المنتجات", url: "/inventory/categories", icon: Layers },
      { title: "وحدات القياس", url: "/inventory/units", icon: Box },
      { title: "إذن استلام (وارد)", url: "/inventory/vouchers/receipt", icon: PackagePlus },
      { title: "إذن صرف (صادر)", url: "/inventory/vouchers/issue", icon: ArrowDownUp },
      { title: "تحويل بين مستودعات", url: "/inventory/vouchers/transfer", icon: ArrowDownUp },
      { title: "جرد المخزون", url: "/inventory/vouchers/count", icon: FileText },
      { title: "أرصدة وكرت الصنف", url: "/inventory/stock-balance", icon: FileBarChart },
      { title: "الحركات المخزنية", url: "/inventory/movements", icon: ArrowDownUp },
      { title: "تقارير المخزون", url: "/inventory/reports", icon: FileBarChart },
    ],
  },
  {
    key: "sales",
    name: "نظام المبيعات",
    shortName: "المبيعات",
    description: "العملاء، عروض الأسعار، أوامر البيع، الفواتير والتحصيلات.",
    icon: ShoppingCart,
    color: "bg-orange-500",
    permission: "sales",
    roles: ["admin", "branch_manager", "sales_manager"],
    home: "/sales/invoices",
    dependsOn: ["inventory"],
    items: [
      { title: "العملاء", url: "/sales/customers", icon: Users },
      { title: "عروض الأسعار", url: "/sales/quotations", icon: FileText },
      { title: "أوامر البيع", url: "/sales/orders", icon: ShoppingCart },
      { title: "إذونات التسليم", url: "/sales/delivery-notes", icon: PackagePlus },
      { title: "فواتير المبيعات", url: "/sales/invoices", icon: Receipt },
      { title: "مرتجعات المبيعات", url: "/sales/returns", icon: ArrowDownUp },
      { title: "التحصيلات", url: "/sales/collections", icon: DollarSign },
      { title: "تقارير المبيعات", url: "/sales/reports", icon: BarChart3 },
    ],
  },
  {
    key: "purchases",
    name: "نظام المشتريات",
    shortName: "المشتريات",
    description: "الموردين، طلبات وأوامر الشراء، الاستلام والفواتير والمدفوعات.",
    icon: ShoppingBag,
    color: "bg-purple-500",
    permission: "purchases",
    roles: ["admin", "branch_manager", "accountant"],
    home: "/purchases/invoices",
    dependsOn: ["inventory"],
    items: [
      { title: "الموردين", url: "/purchases/suppliers", icon: UserPlus },
      { title: "طلبات الشراء", url: "/purchases/requests", icon: FileText },
      { title: "أوامر الشراء", url: "/purchases/orders", icon: ShoppingBag },
      { title: "إذونات الاستلام", url: "/purchases/goods-receipts", icon: PackagePlus },
      { title: "فواتير المشتريات", url: "/purchases/invoices", icon: Receipt },
      { title: "التكاليف الإضافية", url: "/purchases/landed-costs", icon: TrendingUp },
      { title: "مرتجعات المشتريات", url: "/purchases/returns", icon: ArrowDownUp },
      { title: "المدفوعات", url: "/purchases/payments", icon: CreditCard },
      { title: "تقارير المشتريات", url: "/purchases/reports", icon: FileBarChart },
    ],
  },
  {
    key: "pos",
    name: "نقاط البيع (POS)",
    shortName: "POS",
    description: "شاشة كاشير حديثة، جلسات، مدفوعات وتقارير يومية.",
    icon: Monitor,
    color: "bg-pink-500",
    permission: "pos",
    roles: ["admin", "branch_manager", "sales_manager", "accountant", "cashier"],
    home: "/pos/sessions",
    dependsOn: ["sales", "inventory"],
    items: [
      { title: "جلسات الكاشير", url: "/pos/sessions", icon: Monitor },
      { title: "فواتير POS", url: "/pos/orders", icon: Receipt },
      { title: "تقارير POS", url: "/pos/reports", icon: BarChart3 },
      { title: "إعدادات نقاط البيع", url: "/pos/configs", icon: Settings },
    ],
  },
  {
    key: "hr",
    name: "الموارد البشرية",
    shortName: "HR",
    description: "الموظفين، العقود، الحضور، الإجازات، الرواتب والتقييمات.",
    icon: Users,
    color: "bg-cyan-500",
    permission: "hr",
    roles: ["admin", "branch_manager", "hr_manager"],
    home: "/hr",
    items: [
      { title: "لوحة الموارد البشرية", url: "/hr", icon: Home },
      { title: "الموظفين", url: "/hr/employees", icon: Users },
      { title: "الأقسام", url: "/hr/departments", icon: Layers },
      { title: "المسميات الوظيفية", url: "/hr/job-titles", icon: UserCog },
      { title: "العقود", url: "/hr/contracts", icon: FileText },
      { title: "الحضور اليومي", url: "/hr/attendance", icon: Clock },
      { title: "أنواع الإجازات", url: "/hr/leave-types", icon: Calendar },
      { title: "طلبات الإجازات", url: "/hr/leave-requests", icon: FileText },
      { title: "مكونات الراتب", url: "/hr/salary-components", icon: DollarSign },
      { title: "سلف الرواتب", url: "/hr/advances", icon: CreditCard },
      { title: "قروض الموظفين", url: "/hr/loans", icon: CreditCard },
      { title: "تشغيل الرواتب", url: "/hr/payroll", icon: Wallet },
      { title: "تقييم الأداء", url: "/hr/performance", icon: Target },
      { title: "برامج التدريب", url: "/hr/training-programs", icon: Layers },
      { title: "جلسات التدريب", url: "/hr/training-sessions", icon: Calendar },
      { title: "تنبيهات الوثائق", url: "/hr/alerts", icon: Clock },
      { title: "نهاية الخدمة", url: "/hr/end-of-service", icon: TrendingUp },
      { title: "تقارير الموارد البشرية", url: "/hr/reports", icon: BarChart3 },
    ],
  },
  {
    key: "portal",
    name: "بوابتي",
    shortName: "بوابتي",
    description: "بوابة الموظف: الراتب، الإجازات، الحضور والوثائق الشخصية.",
    icon: User,
    color: "bg-teal-500",
    roles: ["admin", "branch_manager", "hr_manager", "accountant", "sales_manager", "inventory_manager", "cashier", "user", "employee_self_service"],
    home: "/my/portal",
    installable: false,
    items: [
      { title: "بوابتي", url: "/my/portal", icon: User },
    ],
  },
  {
    key: "settings",
    name: "الإعدادات",
    shortName: "الإعدادات",
    description: "المستخدمين، الصلاحيات، الفروع، الإعدادات العامة وسجل النظام.",
    icon: Settings,
    color: "bg-slate-600",
    permission: "settings",
    roles: ["admin", "branch_manager"],
    home: "/settings/general",
    installable: false,
    items: [
      { title: "المستخدمون", url: "/settings/users", icon: UserCog },
      { title: "أنواع المستخدمين", url: "/settings/user-types", icon: UserCog },
      { title: "مجموعات المستخدمين", url: "/settings/user-groups", icon: Users },
      { title: "استثناءات المستخدمين", url: "/settings/user-overrides", icon: UserCog },
      { title: "سياسات الوصول", url: "/settings/access-policies", icon: Target },
      { title: "شاشات النظام", url: "/settings/screens", icon: Target },
      { title: "محاكي الصلاحيات", url: "/settings/permission-simulator", icon: Target },
      { title: "سجل تغييرات الصلاحيات", url: "/settings/permission-audit", icon: Clock },
      { title: "الفروع", url: "/settings/branches", icon: MapPin },
      { title: "الإعدادات العامة", url: "/settings/general", icon: Settings },
      { title: "سجلات النظام", url: "/settings/logs", icon: Clock },

    ],
  },
];

export function findModuleByPath(pathname: string): ModuleDefinition | undefined {
  // sort by url length so longer prefixes match first
  const sorted = [...MODULES].sort((a, b) => b.home.length - a.home.length);
  return sorted.find((m) => {
    const prefix = "/" + m.home.split("/").filter(Boolean)[0];
    return pathname === prefix || pathname.startsWith(prefix + "/");
  });
}

export function getModule(key: string): ModuleDefinition | undefined {
  return MODULES.find((m) => m.key === key);
}
