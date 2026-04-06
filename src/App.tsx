import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import DashboardLayout from './components/layout/DashboardLayout.tsx';
import Login from './pages/Login.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Categories from './pages/Categories.tsx';
import Products from './pages/Products.tsx';
import Customers from './pages/Customers.tsx';
import Suppliers from './pages/Suppliers.tsx';
import POS from './pages/POS.tsx';
import Finance from './pages/Finance.tsx';
import WorkOrders from './pages/WorkOrders.tsx';
import WorkOrderDetail from './pages/WorkOrderDetail.tsx';
import Technicians from './pages/Technicians.tsx';
import Agents from './pages/Agents.tsx';
import Reports from './pages/Reports.tsx';
import Receivables from './pages/Receivables.tsx';
import Settings from './pages/Settings.tsx';
import PurchaseOrders from './pages/PurchaseOrders.tsx';
import Inventory from './pages/Inventory.tsx';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes Wrapper */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/products" element={<Products />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
          <Route path="/technicians" element={<Technicians />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/receivables" element={<Receivables />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/inventory" element={<Inventory />} />
        </Route>
      </Route>
      
      {/* 404 Fallback */}
      <Route path="*" element={<div className="p-8 text-center text-gray-500 font-medium">404 - Halaman Tidak Ditemukan</div>} />
    </Routes>
  );
}

export default App;
