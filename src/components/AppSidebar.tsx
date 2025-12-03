import { NavLink } from "react-router-dom";
import {
  Building2,
  Wallet,
  Package,
  ShoppingCart,
  ShoppingBag,
  Settings,
  BarChart3,
  FileText,
  Receipt,
  TrendingUp,
  Warehouse,
  Box,
  Users,
  DollarSign,
  CreditCard,
  LandPlot,
  Layers,
  ArrowDownUp,
  UserPlus,
  PackagePlus,
  FileBarChart,
  UserCog,
  MapPin,
  Clock,
  ChevronDown,
  Home,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

const navigationItems = [
  {
    title: "لوحة التحكم",
    icon: Home,
    url: "/",
  },
  {
    title: "النظام المالي",
    icon: Wallet,
    items: [
      { title: "شجرة الحسابات", url: "/finance/accounts", icon: Layers },
      { title: "القيود اليومية", url: "/finance/journal-entries", icon: FileText },
      { title: "الأستاذ العام", url: "/finance/general-ledger", icon: Receipt },
      { title: "التقارير المالية", url: "/finance/reports", icon: BarChart3 },
      { title: "الصناديق والبنوك", url: "/finance/cash-bank", icon: Building2 },
      { title: "المصاريف والإيرادات", url: "/finance/expenses-revenue", icon: TrendingUp },
      { title: "الأصول الثابتة", url: "/finance/fixed-assets", icon: LandPlot },
    ],
  },
  {
    title: "النظام المخزني",
    icon: Package,
    items: [
      { title: "المستودعات", url: "/inventory/warehouses", icon: Warehouse },
      { title: "الأصناف والمنتجات", url: "/inventory/products", icon: Box },
      { title: "فئات المنتجات", url: "/inventory/categories", icon: Layers },
      { title: "وحدات القياس", url: "/inventory/units", icon: Box },
      { title: "الحركات المخزنية", url: "/inventory/movements", icon: ArrowDownUp },
      { title: "تقارير المخزون", url: "/inventory/reports", icon: FileBarChart },
    ],
  },
  {
    title: "نظام المبيعات",
    icon: ShoppingCart,
    items: [
      { title: "العملاء", url: "/sales/customers", icon: Users },
      { title: "فواتير المبيعات", url: "/sales/invoices", icon: Receipt },
      { title: "التحصيلات", url: "/sales/collections", icon: DollarSign },
      { title: "تقارير المبيعات", url: "/sales/reports", icon: BarChart3 },
    ],
  },
  {
    title: "نظام المشتريات",
    icon: ShoppingBag,
    items: [
      { title: "الموردين", url: "/purchases/suppliers", icon: UserPlus },
      { title: "فواتير المشتريات", url: "/purchases/invoices", icon: PackagePlus },
      { title: "المدفوعات", url: "/purchases/payments", icon: CreditCard },
      { title: "تقارير المشتريات", url: "/purchases/reports", icon: FileBarChart },
    ],
  },
  {
    title: "الإعدادات",
    icon: Settings,
    items: [
      { title: "المستخدمين والصلاحيات", url: "/settings/users", icon: UserCog },
      { title: "الفروع", url: "/settings/branches", icon: MapPin },
      { title: "الإعدادات العامة", url: "/settings/general", icon: Settings },
      { title: "سجلات النظام", url: "/settings/logs", icon: Clock },
    ],
  },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const [openItems, setOpenItems] = useState<string[]>(["النظام المالي"]);

  const toggleItem = (title: string) => {
    setOpenItems((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]
    );
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Building2 className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          {open && (
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">Falcon ERP</h1>
              <p className="text-xs text-sidebar-foreground/70">نظام إدارة متكامل</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navigationItems.map((item) =>
              item.items ? (
                <Collapsible
                  key={item.title}
                  open={openItems.includes(item.title)}
                  onOpenChange={() => toggleItem(item.title)}
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full hover:bg-sidebar-accent">
                        <item.icon className="h-5 w-5" />
                        {open && <span>{item.title}</span>}
                        {open && (
                          <ChevronDown
                            className={`ml-auto h-4 w-4 transition-transform ${
                              openItems.includes(item.title) ? "rotate-180" : ""
                            }`}
                          />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.url}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={subItem.url}
                                className={({ isActive }) =>
                                  isActive
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                    : "hover:bg-sidebar-accent"
                                }
                              >
                                <subItem.icon className="h-4 w-4" />
                                {open && <span>{subItem.title}</span>}
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "hover:bg-sidebar-accent"
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
