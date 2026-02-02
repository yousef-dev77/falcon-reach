import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./components/DashboardLayout";
import { AuthProvider } from "./contexts/AuthContext";
import { ConnectionProvider } from "./contexts/ConnectionContext";
import { BranchProvider } from "./contexts/BranchContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
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
import Currencies from "./pages/finance/Currencies";
import ExchangeRates from "./pages/finance/ExchangeRates";
import BankReconciliation from "./pages/finance/BankReconciliation";
import SubLedger from "./pages/finance/SubLedger";
import JournalTypes from "./pages/finance/JournalTypes";
import YearEndClosing from "./pages/finance/YearEndClosing";
import FxAdjustment from "./pages/finance/FxAdjustment";

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
import SetupWizard from "./pages/SetupWizard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ConnectionProvider>
            <BranchProvider>
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/setup" element={<ProtectedRoute><SetupWizard /></ProtectedRoute>} />
              <Route path="/" element={<ProtectedRoute><DashboardLayout><Index /></DashboardLayout></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
              
              {/* Finance Routes - Admin + Branch Manager + Accountant */}
              <Route path="/finance/accounts" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><Accounts /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/journal-entries" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><JournalEntries /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/general-ledger" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><GeneralLedger /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/reports" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><FinancialReports /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/cash-bank" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><CashBank /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/expenses-revenue" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><ExpensesRevenue /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/fixed-assets" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><FixedAssets /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/fiscal-periods" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><FiscalPeriods /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/cost-centers" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><CostCenters /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/currencies" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><Currencies /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/exchange-rates" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><ExchangeRates /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/bank-reconciliation" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><BankReconciliation /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/sub-ledger" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><SubLedger /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/journal-types" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><JournalTypes /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/year-end-closing" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><YearEndClosing /></DashboardLayout></AdminRoute>} />
              <Route path="/finance/fx-adjustment" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><FxAdjustment /></DashboardLayout></AdminRoute>} />
              
              {/* Inventory Routes - Admin + Branch Manager + Inventory Manager */}
              <Route path="/inventory/warehouses" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'inventory_manager']}><DashboardLayout><Warehouses /></DashboardLayout></AdminRoute>} />
              <Route path="/inventory/products" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'inventory_manager']}><DashboardLayout><Products /></DashboardLayout></AdminRoute>} />
              <Route path="/inventory/categories" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'inventory_manager']}><DashboardLayout><Categories /></DashboardLayout></AdminRoute>} />
              <Route path="/inventory/units" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'inventory_manager']}><DashboardLayout><Units /></DashboardLayout></AdminRoute>} />
              <Route path="/inventory/movements" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'inventory_manager']}><DashboardLayout><Movements /></DashboardLayout></AdminRoute>} />
              <Route path="/inventory/reports" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'inventory_manager']}><DashboardLayout><InventoryReports /></DashboardLayout></AdminRoute>} />
              
              {/* Sales Routes - Admin + Branch Manager + Sales Manager */}
              <Route path="/sales/customers" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'sales_manager']}><DashboardLayout><Customers /></DashboardLayout></AdminRoute>} />
              <Route path="/sales/invoices" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'sales_manager']}><DashboardLayout><SalesInvoices /></DashboardLayout></AdminRoute>} />
              <Route path="/sales/collections" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'sales_manager']}><DashboardLayout><Collections /></DashboardLayout></AdminRoute>} />
              <Route path="/sales/reports" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'sales_manager']}><DashboardLayout><SalesReports /></DashboardLayout></AdminRoute>} />
              
              {/* Purchases Routes - Admin + Branch Manager + Accountant */}
              <Route path="/purchases/suppliers" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><Suppliers /></DashboardLayout></AdminRoute>} />
              <Route path="/purchases/invoices" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><PurchaseInvoices /></DashboardLayout></AdminRoute>} />
              <Route path="/purchases/payments" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><Payments /></DashboardLayout></AdminRoute>} />
              <Route path="/purchases/reports" element={<AdminRoute allowedRoles={['admin', 'branch_manager', 'accountant']}><DashboardLayout><PurchaseReports /></DashboardLayout></AdminRoute>} />
              
              {/* Settings Routes - Admin + Branch Manager (for Users) */}
              <Route path="/settings/general" element={<AdminRoute allowedRoles={['admin']}><DashboardLayout><GeneralSettings /></DashboardLayout></AdminRoute>} />
              <Route path="/settings/users" element={<AdminRoute allowedRoles={['admin', 'branch_manager']}><DashboardLayout><Users /></DashboardLayout></AdminRoute>} />
              <Route path="/settings/branches" element={<AdminRoute allowedRoles={['admin']}><DashboardLayout><Branches /></DashboardLayout></AdminRoute>} />
              <Route path="/settings/logs" element={<AdminRoute allowedRoles={['admin']}><DashboardLayout><SystemLogs /></DashboardLayout></AdminRoute>} />
              
              <Route path="*" element={<NotFound />} />
              </Routes>
            </BranchProvider>
          </ConnectionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;