import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  ShoppingCart, 
  Wrench, 
  AlertTriangle, 
  DollarSign, 
  ArrowUpRight, 
  Loader2,
  Calendar,
  Users
} from 'lucide-react';
import { api } from '../lib/api.js';
import { cn } from '../lib/utils.js';

interface Activity {
  id: string;
  type: string;
  txId: string;
  category: string;
  title: string;
  operator: string;
  amount: number;
  status: string;
  date: string;
}

interface Stats {
  totalSales: number;
  transactionCount: number;
  activeWorkOrders: number;
  lowStockAlerts: number;
  estimatedProfit: number;
  topTechnicians: { name: string; woCount: number; revenue: number }[];
  agingWorkOrders: { id: number; woNumber: string; customerName: string; createdAt: string; status: string; days: number }[];
  recentActivity: { type: string; title: string; subtitle: string; amount: number; time: string }[];
}

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/reports/dashboard-stats');
      return response.data.data as Stats;
    },
    refetchInterval: 30000, 
  });

  const [activityFilter, setActivityFilter] = React.useState<'today' | '7days' | '30days'>('today');
  const [selectedRetailTxId, setSelectedRetailTxId] = React.useState<number | null>(null);

  const { data: activities, isLoading: actsLoading } = useQuery({
    queryKey: ['recent-activities', activityFilter],
    queryFn: async () => {
      const res = await api.get(`/reports/recent-activities?period=${activityFilter}`);
      return res.data.data as Activity[];
    },
    refetchInterval: 30000,
  });

  const { data: retailDetail, isLoading: retailDetailLoading } = useQuery({
    queryKey: ['transaction-detail', selectedRetailTxId],
    queryFn: async () => {
      if (!selectedRetailTxId) return null;
      const res = await api.get(`/transactions/${selectedRetailTxId}`);
      return res.data.data;
    },
    enabled: !!selectedRetailTxId
  });

  const cards = [
    {
      name: 'Omzet Hari Ini',
      value: `Rp ${stats?.totalSales.toLocaleString() || '0'}`,
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      desc: `${stats?.transactionCount || 0} Transaksi Lunas`,
    },
    {
      name: 'Estimasi Laba',
      value: `Rp ${stats?.estimatedProfit.toLocaleString() || '0'}`,
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
      desc: 'Profit Bersih (Retail + Jasa)',
    },
    {
      name: 'Servisan Aktif',
      value: stats?.activeWorkOrders.toString() || '0',
      icon: Wrench,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      desc: 'Unit di Toko (Belum Diambil)',
    },
    {
      name: 'Stok Kritis',
      value: stats?.lowStockAlerts.toString() || '0',
      icon: AlertTriangle,
      color: stats?.lowStockAlerts && stats.lowStockAlerts > 0 ? 'text-red-600' : 'text-gray-400',
      bg: stats?.lowStockAlerts && stats.lowStockAlerts > 0 ? 'bg-red-50' : 'bg-gray-50',
      desc: 'Produk Menipis',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Central Computer RIMS</h1>
          <p className="text-gray-500 text-sm">Dashboard Pemilik — {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-[10px] font-black text-gray-400 tracking-widest uppercase">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
           Real-Time Monitoring
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div key={card.name} className="glass-card p-6 rounded-3xl relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-start mb-5 relative z-10">
              <div className={cn("p-4 rounded-2xl transition-all group-hover:scale-110 shadow-sm", card.bg)}>
                <card.icon className={cn("h-6 w-6", card.color)} />
              </div>
              <div className="flex items-center text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50">
                <ArrowUpRight className="h-3 w-3 mr-1 animate-bounce" /> LIVE
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1.5">{card.name}</p>
              <h3 className="text-3xl font-black text-slate-900 tabular-nums">
                {isLoading ? <Loader2 className="animate-spin h-6 w-6 text-slate-200" /> : card.value}
              </h3>
              <p className="text-[10px] text-slate-400 mt-3 font-bold flex items-center gap-1.5 opacity-80 uppercase tracking-tighter">
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                {card.desc}
              </p>
            </div>
            {/* Glossy Background Effect */}
            <div className={cn("absolute -bottom-6 -right-6 h-32 w-32 opacity-[0.04] group-hover:opacity-[0.1] group-hover:scale-125 transition-all duration-500", card.color)}>
               <card.icon className="h-full w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Aging Alert Banner */}
      {stats?.agingWorkOrders && stats.agingWorkOrders.length > 0 && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="bg-red-100 p-2 rounded-lg text-red-600">
                 <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                 <p className="text-sm font-bold text-red-900">Perhatian: Ada {stats.agingWorkOrders.length} Unit Menginap &gt; 7 Hari</p>
                 <p className="text-xs text-red-700">Segera cek progress dengan teknisi untuk menjaga kepuasan pelanggan.</p>
              </div>
           </div>
           <div className="flex -space-x-2 overflow-hidden">
              {stats.agingWorkOrders.map((wo, i) => (
                <div key={wo.id} className="w-8 h-8 rounded-full bg-red-600 border-2 border-red-50 flex items-center justify-center text-[10px] text-white font-bold" title={`${wo.woNumber} - ${wo.customerName}`}>
                    {wo.customerName[0]}
                </div>
              ))}
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Papan Skor Teknisi */}
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
           <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <h3 className="font-black text-slate-900 flex items-center gap-2.5 text-sm uppercase tracking-wider">
                 <Users className="h-4 w-4 text-v2-blue glow-blue" />
                 Papan Skor Teknisi (30 Hari Terakhir)
              </h3>
              <span className="text-[10px] bg-v2-blue/10 text-v2-blue px-3 py-1 rounded-full font-black tracking-widest uppercase">TOP PERFORMANCE</span>
           </div>
           <div className="p-8">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-slate-100" /></div>
              ) : !stats?.topTechnicians || stats.topTechnicians.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm italic">Belum ada data performa teknisi</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {stats?.topTechnicians.map((tech, index) => (
                    <div key={tech.name} className="flex items-center gap-5 group bg-slate-50/50 hover:bg-white p-5 rounded-2xl border border-transparent hover:border-slate-100 transition-all hover:shadow-lg hover:shadow-slate-200/40">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 transition-transform group-hover:rotate-12",
                        index === 0 ? "bg-amber-100 text-amber-600 border border-amber-200 shadow-sm" :
                        index === 1 ? "bg-slate-100 text-slate-500 border border-slate-200 shadow-sm" :
                        index === 2 ? "bg-orange-50 text-orange-600 border border-orange-100 shadow-sm" :
                        "bg-white text-slate-300 border border-slate-100"
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-end mb-2">
                          <p className="text-sm font-black text-slate-800 truncate">{tech.name}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter shrink-0">{tech.woCount} Unit</p>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                           <div 
                             className={cn("h-full rounded-full transition-all duration-1000", index === 0 ? "bg-v2-blue shadow-[0_0_8px_#3b82f6]" : "bg-slate-300 group-hover:bg-slate-400")} 
                             style={{ width: `${(tech.woCount / (stats.topTechnicians[0].woCount || 1)) * 100}%` }}
                           ></div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 min-w-[85px]">
                         <p className="text-sm font-black text-slate-900 tabular-nums">Rp {(tech.revenue/1000).toLocaleString()}k</p>
                         <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter opacity-70">Omzet</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
           </div>
        </div>

        {/* Tabel Detail Aktivitas Toko */}
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm flex flex-col">
           <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between md:items-center gap-6 bg-slate-50/30">
              <h3 className="font-black text-slate-900 flex items-center gap-3 text-sm uppercase tracking-wider">
                 <ShoppingCart className="h-4 w-4 text-v2-green glow-emerald" />
                 Detail Aktivitas Toko
              </h3>
              <div className="flex items-center gap-1 bg-white border border-slate-100 p-1.5 rounded-2xl shadow-sm self-start md:self-auto">
                 {(['today', '7days', '30days'] as const).map(t => (
                    <button 
                      key={t}
                      onClick={() => setActivityFilter(t)}
                      className={cn(
                        "px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all", 
                        activityFilter === t ? "bg-emerald-50 text-emerald-600 shadow-sm" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                      )}
                    >
                       {t === 'today' ? 'Hari Ini' : t === '7days' ? '7 Hari' : '1 Bulan'}
                    </button>
                 ))}
              </div>
           </div>
           
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-white text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 border-b border-slate-100">
                       <th className="px-8 py-5">Waktu & Referensi</th>
                       <th className="px-8 py-5">Kategori</th>
                       <th className="px-8 py-5">Pelanggan & PIC</th>
                       <th className="px-8 py-5 text-right">Nominal (Rp)</th>
                       <th className="px-8 py-5 text-center w-32">Aksi</th>
                    </tr>
                 </thead>
                 <tbody className="text-sm">
                    {actsLoading ? (
                       <tr><td colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 text-gray-300 mx-auto" /></td></tr>
                    ) : !activities || activities.length === 0 ? (
                       <tr><td colSpan={5} className="h-32 text-center text-gray-400 italic">Tidak ada transaksi tercatat pada rentang ini.</td></tr>
                    ) : (
                       activities.map((act) => (
                         <tr key={act.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                               <div className="flex items-start gap-3">
                                  <div className={cn("p-2 rounded-lg shrink-0 mt-0.5", act.type === 'SALE' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600")}>
                                     {act.type === 'SALE' ? <ShoppingCart className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                                  </div>
                                  <div>
                                     <p className="font-bold text-gray-900 tabular-nums">
                                        {act.date.split('T')[0]} <span className="text-gray-400 font-medium">
                                          {new Date(act.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                     </p>
                                     <p className="text-[10px] font-mono font-bold text-gray-500 mt-1">{act.txId}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               <span className={cn("px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md", act.type === 'SALE' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
                                  {act.category}
                               </span>
                            </td>
                            <td className="px-6 py-4">
                               <p className="font-bold text-gray-800 line-clamp-1">{act.title}</p>
                               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Oleh: {act.operator}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <p className="font-black text-gray-900 tabular-nums">Rp {act.amount.toLocaleString()}</p>
                               <p className={cn("text-[9px] font-black uppercase tracking-widest mt-0.5", act.status === 'DIAMBIL' || act.status === 'LUNAS' ? 'text-green-500' : 'text-orange-400')}>{act.status}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                               <button 
                                 onClick={() => {
                                   if (act.type === 'SERVICE') {
                                     navigate(`/work-orders/${act.id.replace('WO-', '')}`);
                                   } else {
                                     setSelectedRetailTxId(parseInt(act.id.replace('TX-', ''), 10));
                                   }
                                 }}
                                 className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm whitespace-nowrap"
                               >
                                 Lihat Detail
                               </button>
                            </td>
                         </tr>
                       ))
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* RETAIL TRANSACTION MODAL */}
      {selectedRetailTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-emerald-600" />
                  Detail Penjualan Ritel
                </h3>
                {retailDetailLoading ? (
                  <p className="text-xs text-slate-400 mt-1">Memuat data...</p>
                ) : retailDetail ? (
                  <p className="text-xs font-bold text-slate-500 font-mono mt-1">{retailDetail.invoiceNumber}</p>
                ) : null}
              </div>
              <button 
                onClick={() => setSelectedRetailTxId(null)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {retailDetailLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="animate-spin h-8 w-8 text-emerald-500 mb-4" />
                  <p className="text-sm font-bold text-slate-500">Mengambil data transaksi...</p>
                </div>
              ) : !retailDetail ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertTriangle className="h-8 w-8 text-red-400 mb-4" />
                  <p className="text-sm font-bold text-slate-500">Data transaksi tidak ditemukan.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Info Header */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Kasir</p>
                      <p className="text-xs font-bold text-slate-800 mt-1">{retailDetail.shift?.user?.username || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pelanggan</p>
                      <p className="text-xs font-bold text-slate-800 mt-1">{retailDetail.customer?.name || 'Umum'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Metode</p>
                      <p className="text-xs font-bold text-slate-800 mt-1 uppercase">{retailDetail.paymentMethod}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status</p>
                      <p className={cn("text-xs font-black uppercase tracking-widest mt-1", retailDetail.status === 'LUNAS' ? 'text-emerald-600' : 'text-orange-500')}>{retailDetail.status}</p>
                    </div>
                  </div>

                  {/* Item List */}
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Rincian Item</h4>
                    <div className="space-y-3">
                      {retailDetail.items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-start group">
                          <div>
                            <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{item.product.name}</p>
                            <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                              {item.qty} x Rp {item.price.toLocaleString()} {item.discount > 0 && <span className="text-red-500 ml-1">(Diskon: Rp {item.discount.toLocaleString()})</span>}
                            </p>
                          </div>
                          <p className="text-sm font-black text-slate-900 tabular-nums">Rp {item.subtotal.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                      <span>Subtotal</span>
                      <span className="tabular-nums">Rp {retailDetail.subtotal.toLocaleString()}</span>
                    </div>
                    {retailDetail.discountTotal > 0 && (
                      <div className="flex justify-between items-center text-xs font-bold text-red-500">
                        <span>Diskon Transaksi</span>
                        <span className="tabular-nums">- Rp {retailDetail.discountTotal.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-lg font-black text-slate-900 pt-2 border-t border-slate-100 border-dashed">
                      <span>Total Akhir</span>
                      <span className="tabular-nums">Rp {retailDetail.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
                      <span>Dibayar</span>
                      <span className="tabular-nums">Rp {retailDetail.paidAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedRetailTxId(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
