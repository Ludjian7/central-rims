import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  PackageSearch, 
  Users, 
  Wrench, 
  LogOut,
  Menu,
  X,
  CreditCard,
  Building2,
  Wallet,
  PieChart,
  Handshake,
  Settings,
  Truck,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Button } from '../ui/button.tsx';
import { cn } from '../../lib/utils.js';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Master Produk', href: '/products', icon: PackageSearch },
    { name: 'Kategori', href: '/categories', icon: Menu },
    { name: 'Point of Sales', href: '/pos', icon: ShoppingCart },
    { name: 'Jasa Service', href: '/work-orders', icon: Wrench },
    { name: 'Data Pelanggan', href: '/customers', icon: Users },
    { name: 'Data Teknisi', href: '/technicians', icon: Users },
    { name: 'Data Agen', href: '/agents', icon: Handshake },
    { name: 'Partner Suplier', href: '/suppliers', icon: Building2 },
    { name: 'Pembelian (PO)', href: '/purchase-orders', icon: Truck },
    { name: 'Inventori & Stok', href: '/inventory', icon: ClipboardList },
    { name: 'Piutang', href: '/receivables', icon: CreditCard },
    { name: 'Keuangan', href: '/finance', icon: Wallet },
    { name: 'Laporan', href: '/reports', icon: PieChart },
    { name: 'Pengaturan', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex h-full">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:w-64 flex flex-col no-print",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-v1-gradient flex items-center justify-center shadow-lg shadow-green-900/20">
              <span className="font-black text-white text-lg italic">C</span>
            </div>
            <span className="font-black text-sm tracking-[0.1em] uppercase text-slate-100">Central Komputer</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-8">
          <nav className="space-y-2 px-3">
            <div className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4 opacity-50">
              Main Navigation
            </div>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "group flex items-center px-4 py-3.5 text-xs font-bold rounded-xl transition-all duration-200",
                    isActive 
                      ? "bg-v1-gradient text-white shadow-lg shadow-orange-500/20 translate-x-1" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  )}
                >
                  <item.icon className={cn("mr-4 h-4 w-4 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-500 group-hover:text-v1-green")} />
                  <span className="tracking-wide text-xs">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-6 bg-slate-950/50 border-t border-slate-800/50 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-6 px-2">
             <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 shadow-inner">
               <Users className="w-5 h-5 text-slate-400" />
             </div>
            <div>
              <p className="text-[11px] font-black text-white uppercase tracking-widest">{user?.username || 'GUEST'}</p>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{user?.role || 'User'}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-[11px] font-bold text-red-500 hover:bg-red-500/10 hover:text-red-400 rounded-xl group h-12 px-4 transition-all" 
            onClick={() => logout()}
          >
            <LogOut className="w-4 h-4 mr-3 group-hover:-translate-x-1 transition-transform" />
            KELUAR SISTEM
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/50">
        {/* Top Header Bar (Premium Glossy Noir) */}
        <header className="sticky top-0 bg-slate-950/90 backdrop-blur-md h-16 flex items-center justify-between px-8 border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.3)] relative z-40 no-print transition-all">
          <div className="flex items-center gap-6">
             <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all active:scale-90"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-v2-green animate-pulse shadow-[0_0_8px_#10b981]"></span>
                <h2 className="text-[10px] font-black text-v2-green uppercase tracking-[0.45em] drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]">Control Center</h2>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="relative group p-2 rounded-xl hover:bg-white/5 transition-all">
              <div className="absolute top-2 right-2 w-2 h-2 bg-v2-orange rounded-full border-2 border-slate-950 animate-pulse shadow-[0_0_8px_#f59e0b]"></div>
              <svg className="w-5 h-5 text-slate-400 group-hover:text-v2-orange transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            
            <div className="flex items-center gap-4 pl-6 border-l border-white/5 h-10">
              <div className="text-right hidden md:block">
                <p className="text-[11px] font-black text-white uppercase tracking-widest mb-0.5">{user?.username}</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-v2-orange"></span>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter opacity-80">{user?.role}</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 border border-white/10 flex items-center justify-center text-v2-green font-black text-sm ring-1 ring-white/5 shadow-inner group cursor-pointer hover:border-v2-green/30 transition-all">
                {user?.username?.substring(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-8 px-6 lg:px-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
