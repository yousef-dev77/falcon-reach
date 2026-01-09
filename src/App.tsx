import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./components/DashboardLayout";
import { AuthProvider } from "./contexts/AuthContext";
import { ConnectionProvider } from "./contexts/ConnectionContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
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
import FiscalPeriods from "./pages/finance/FiscalPeriods";
import CostCenters from "./pages/finance/CostCenters";

// Inventory Pages
import Warehouses from "./pages/inventory/Warehouses";
import Products from "./pages/inventory/Products";
import Categories from "./pages/inventory/Categories";
import Units from "./pages/inventory/Units";
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
        <AuthProvider>
          <ConnectionProvider>
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><DashboardLayout><Index /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
            
            {/* Finance Routes */}
            <Route path="/finance/accounts" element={<ProtectedRoute><DashboardLayout><Accounts /></DashboardLayout></ProtectedRoute>} />
            <Route path="/finance/journal-entries" element={<ProtectedRoute><DashboardLayout><JournalEntries /></DashboardLayout></ProtectedRoute>} />
            <Route path="/finance/general-ledger" element={<ProtectedRoute><DashboardLayout><GeneralLedger /></DashboardLayout></ProtectedRoute>} />
            <Route path="/finance/reports" element={<ProtectedRoute><DashboardLayout><FinancialReports /></DashboardLayout></ProtectedRoute>} />
            <Route path="/finance/cash-bank" element={<ProtectedRoute><DashboardLayout><CashBank /></DashboardLayout></ProtectedRoute>} />
            <Route path="/finance/expenses-revenue" element={<ProtectedRoute><DashboardLayout><ExpensesRevenue /></DashboardLayout></ProtectedRoute>} />
            <Route path="/finance/fixed-assets" element={<ProtectedRoute><DashboardLayout><FixedAssets /></DashboardLayout></ProtectedRoute>} />
            <Route path="/finance/fiscal-periods" element={<ProtectedRoute><DashboardLayout><FiscalPeriods /></DashboardLayout></ProtectedRoute>} />
            <Route path="/finance/cost-centers" element={<ProtectedRoute><DashboardLayout><CostCenters /></DashboardLayout></ProtectedRoute>} />
            
            {/* Inventory Routes */}
            <Route path="/inventory/warehouses" element={<ProtectedRoute><DashboardLayout><Warehouses /></DashboardLayout></ProtectedRoute>} />
            <Route path="/inventory/products" element={<ProtectedRoute><DashboardLayout><Products /></DashboardLayout></ProtectedRoute>} />
            <Route path="/inventory/categories" element={<ProtectedRoute><DashboardLayout><Categories /></DashboardLayout></ProtectedRoute>} />
            <Route path="/inventory/units" element={<ProtectedRoute><DashboardLayout><Units /></DashboardLayout></ProtectedRoute>} />
            <Route path="/inventory/movements" element={<ProtectedRoute><DashboardLayout><Movements /></DashboardLayout></ProtectedRoute>} />
            <Route path="/inventory/reports" element={<ProtectedRoute><DashboardLayout><InventoryReports /></DashboardLayout></ProtectedRoute>} />
            
            {/* Sales Routes */}
            <Route path="/sales/customers" element={<ProtectedRoute><DashboardLayout><Customers /></DashboardLayout></ProtectedRoute>} />
            <Route path="/sales/invoices" element={<ProtectedRoute><DashboardLayout><SalesInvoices /></DashboardLayout></ProtectedRoute>} />
            <Route path="/sales/collections" element={<ProtectedRoute><DashboardLayout><Collections /></DashboardLayout></ProtectedRoute>} />
            <Route path="/sales/reports" element={<ProtectedRoute><DashboardLayout><SalesReports /></DashboardLayout></ProtectedRoute>} />
            
            {/* Purchases Routes */}
            <Route path="/purchases/suppliers" element={<ProtectedRoute><DashboardLayout><Suppliers /></DashboardLayout></ProtectedRoute>} />
            <Route path="/purchases/invoices" element={<ProtectedRoute><DashboardLayout><PurchaseInvoices /></DashboardLayout></ProtectedRoute>} />
            <Route path="/purchases/payments" element={<ProtectedRoute><DashboardLayout><Payments /></DashboardLayout></ProtectedRoute>} />
            <Route path="/purchases/reports" element={<ProtectedRoute><DashboardLayout><PurchaseReports /></DashboardLayout></ProtectedRoute>} />
            
            {/* Settings Routes */}
            <Route path="/settings/general" element={<ProtectedRoute><DashboardLayout><GeneralSettings /></DashboardLayout></ProtectedRoute>} />
            <Route path="/settings/users" element={<ProtectedRoute><DashboardLayout><Users /></DashboardLayout></ProtectedRoute>} />
            <Route path="/settings/branches" element={<ProtectedRoute><DashboardLayout><Branches /></DashboardLayout></ProtectedRoute>} />
            <Route path="/settings/logs" element={<ProtectedRoute><DashboardLayout><SystemLogs /></DashboardLayout></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
            </Routes>
          </ConnectionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
