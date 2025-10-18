import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

// Finance Pages
import Accounts from "./pages/finance/Accounts";
import JournalEntries from "./pages/finance/JournalEntries";
import GeneralLedger from "./pages/finance/GeneralLedger";
import FinancialReports from "./pages/finance/FinancialReports";
import CashBank from "./pages/finance/CashBank";
import ExpensesRevenue from "./pages/finance/ExpensesRevenue";
import FixedAssets from "./pages/finance/FixedAssets";

// Inventory Pages
import Warehouses from "./pages/inventory/Warehouses";
import Products from "./pages/inventory/Products";
import Movements from "./pages/inventory/Movements";
import InventoryReports from "./pages/inventory/InventoryReports";

// Sales Pages
import Customers from "./pages/sales/Customers";
import SalesInvoices from "./pages/sales/SalesInvoices";
import Collections from "./pages/sales/Collections";
import SalesReports from "./pages/sales/SalesReports";

// Purchases Pages
import Suppliers from "./pages/purchases/Suppliers";
import PurchaseInvoices from "./pages/purchases/PurchaseInvoices";
import Payments from "./pages/purchases/Payments";
import PurchaseReports from "./pages/purchases/PurchaseReports";

// Settings Pages
import Users from "./pages/settings/Users";
import Branches from "./pages/settings/Branches";
import GeneralSettings from "./pages/settings/GeneralSettings";
import SystemLogs from "./pages/settings/SystemLogs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
          
          {/* Finance Routes */}
          <Route path="/finance/accounts" element={<DashboardLayout><Accounts /></DashboardLayout>} />
          <Route path="/finance/journal-entries" element={<DashboardLayout><JournalEntries /></DashboardLayout>} />
          <Route path="/finance/general-ledger" element={<DashboardLayout><GeneralLedger /></DashboardLayout>} />
          <Route path="/finance/reports" element={<DashboardLayout><FinancialReports /></DashboardLayout>} />
          <Route path="/finance/cash-bank" element={<DashboardLayout><CashBank /></DashboardLayout>} />
          <Route path="/finance/expenses-revenue" element={<DashboardLayout><ExpensesRevenue /></DashboardLayout>} />
          <Route path="/finance/fixed-assets" element={<DashboardLayout><FixedAssets /></DashboardLayout>} />
          
          {/* Inventory Routes */}
          <Route path="/inventory/warehouses" element={<DashboardLayout><Warehouses /></DashboardLayout>} />
          <Route path="/inventory/products" element={<DashboardLayout><Products /></DashboardLayout>} />
          <Route path="/inventory/movements" element={<DashboardLayout><Movements /></DashboardLayout>} />
          <Route path="/inventory/reports" element={<DashboardLayout><InventoryReports /></DashboardLayout>} />
          
          {/* Sales Routes */}
          <Route path="/sales/customers" element={<DashboardLayout><Customers /></DashboardLayout>} />
          <Route path="/sales/invoices" element={<DashboardLayout><SalesInvoices /></DashboardLayout>} />
          <Route path="/sales/collections" element={<DashboardLayout><Collections /></DashboardLayout>} />
          <Route path="/sales/reports" element={<DashboardLayout><SalesReports /></DashboardLayout>} />
          
          {/* Purchases Routes */}
          <Route path="/purchases/suppliers" element={<DashboardLayout><Suppliers /></DashboardLayout>} />
          <Route path="/purchases/invoices" element={<DashboardLayout><PurchaseInvoices /></DashboardLayout>} />
          <Route path="/purchases/payments" element={<DashboardLayout><Payments /></DashboardLayout>} />
          <Route path="/purchases/reports" element={<DashboardLayout><PurchaseReports /></DashboardLayout>} />
          
          {/* Settings Routes */}
          <Route path="/settings/users" element={<DashboardLayout><Users /></DashboardLayout>} />
          <Route path="/settings/branches" element={<DashboardLayout><Branches /></DashboardLayout>} />
          <Route path="/settings/general" element={<DashboardLayout><GeneralSettings /></DashboardLayout>} />
          <Route path="/settings/logs" element={<DashboardLayout><SystemLogs /></DashboardLayout>} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
