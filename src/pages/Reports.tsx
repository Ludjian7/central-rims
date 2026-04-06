import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  AlertTriangle, 
  Download,
  Loader2,
  Table as TableIcon,
  PieChart,
  User,
  PackageSearch,
  DollarSign,
  Activity
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.tsx';
import * as XLSX from 'xlsx';

type ReportTab = 'sales' | 'profit' | 'kpis' | 'commissions' | 'stock';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetTypeFilter, setTargetTypeFilter] = useState<'ALL' | 'TECHNICIAN' | 'AGENT'>('ALL');
  const toast = useToast();

  // --- Queries ---
  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['report-sales', startDate, endDate],
    queryFn: async () => {
      const resp = await api.get(`/reports/sales?startDate=${startDate}&endDate=${endDate}`);
      return resp.data.data;
    },
    enabled: activeTab === 'sales'
  });

  const { data: profitData, isLoading: profitLoading } = useQuery({
    queryKey: ['report-profit', startDate, endDate],
    queryFn: async () => {
      const resp = await api.get(`/reports/profit?startDate=${startDate}&endDate=${endDate}`);
      return resp.data.data;
    },
    enabled: activeTab === 'profit'
  });

  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['report-kpis', startDate, endDate],
    queryFn: async () => {
      const resp = await api.get(`/reports/technician-kpi?startDate=${startDate}&endDate=${endDate}`);
      return resp.data.data;
    },
    enabled: activeTab === 'kpis'
  });

  const { data: commissionsData, isLoading: commsLoading } = useQuery({
    queryKey: ['report-commissions', startDate, endDate, targetTypeFilter],
    queryFn: async () => {
      let qs = `startDate=${startDate}&endDate=${endDate}`;
      if(targetTypeFilter !== 'ALL') qs += `&targetType=${targetTypeFilter}`;
      const resp = await api.get(`/reports/commissions?${qs}`);
      return resp.data.data;
    },
    enabled: activeTab === 'commissions'
  });

  const { data: stockAlerts, isLoading: stockLoading } = useQuery({
    queryKey: ['report-stock'],
    queryFn: async () => {
      const resp = await api.get('/reports/inventory-alerts');
      return resp.data.data;
    },
    enabled: activeTab === 'stock'
  });

  const tabs = [
    { id: 'sales', name: 'Penjualan OMNI', icon: TrendingUp },
    { id: 'profit', name: 'Laba Rugi', icon: DollarSign },
    { id: 'kpis', name: 'KPI Teknisi', icon: User },
    { id: 'commissions', name: 'Komisi', icon: PieChart },
    { id: 'stock', name: 'Stok Kritis', icon: AlertTriangle },
  ];

  const exportToExcel = () => {
    let rawData: any[] = [];
    let filename = `Laporan_${activeTab}_${startDate}_${endDate}.xlsx`;
    
    const wb = XLSX.utils.book_new();

    if (activeTab === 'sales' && sales) {
       rawData = sales.map((s: any) => ({
          'Tanggal': new Date(s.date).toLocaleString(),
          'Tipe Transaksi': s.type,
          'No Nota/Referensi': s.referenceNumber,
          'Pelanggan': s.customerName,
          'Kasir': s.cashier,
          'Metode Pembayaran': s.paymentMethod,
          'Total Bersih (Rp)': s.total
       }));
       const ws = XLSX.utils.json_to_sheet(rawData);
       XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan");
    }
    
    if (activeTab === 'commissions' && commissionsData) {
       const rekapData = commissionsData.leaderboard.map((r: any, i: number) => ({
          'Peringkat': i + 1,
          'Nama Penerima': r.name,
          'Posisi': r.type === 'TECHNICIAN' ? 'Teknisi Internal' : 'Mitra Agen',
          'Total Tiket/Nota': r.totalWo,
          'Total Komisi (Rp)': r.amount
       }));
       const wsRekap = XLSX.utils.json_to_sheet(rekapData);
       XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Pembayaran Komisi");

       const ledgerData = commissionsData.list.map((c: any) => ({
          'Tanggal': new Date(c.createdAt).toLocaleString(),
          'Penerima': c.technician?.name || c.agent?.name,
          'Posisi': c.targetType === 'TECHNICIAN' ? 'Teknisi Internal' : 'Mitra Agen',
          'Tipe Referensi': c.referenceType === 'TRANSACTION' ? 'Penjualan Ritel' : 'Work Order Servis',
          'ID Nota': c.referenceId,
          'Nominal Komisi (Rp)': c.amount
       }));
       const wsLedger = XLSX.utils.json_to_sheet(ledgerData);
       XLSX.utils.book_append_sheet(wb, wsLedger, "Rincian Transaksi Komisi");
       
       rawData = rekapData;
    }
    
    if (activeTab === 'stock' && stockAlerts) {
       filename = `Laporan_Stok_Kritis.xlsx`;
       rawData = stockAlerts.map((p: any) => ({
          'Nama Produk': p.name,
          'Kategori': p.category?.name || '-',
          'Batas Minimum Stok': p.minStock,
          'SISA STOK AKTUAL': p.stock
       }));
       const ws = XLSX.utils.json_to_sheet(rawData);
       XLSX.utils.book_append_sheet(wb, ws, "Stok Kritis");
    }
    
    if (activeTab === 'profit' && profitData) {
       rawData = [{
          'Periode Laporan': `${startDate} s/d ${endDate}`,
          'Laba Penjualan Ritel (Rp)': profitData.retailProfit,
          'Laba Bersih Servis (Rp)': profitData.serviceProfit,
          'TOTAL Laba Kotor (Rp)': profitData.grossProfit,
          'Beban Usaha / Pengeluaran (Rp)': profitData.totalExpenses,
          'Pencairan Komisi (Rp)': profitData.totalCommissions,
          'TOTAL LABA BERSIH (NET PROFIT) (Rp)': profitData.netProfit
       }];
       const ws = XLSX.utils.json_to_sheet(rawData);
       XLSX.utils.book_append_sheet(wb, ws, "Laba Rugi (Profit)");
    }
    
    if (activeTab === 'kpis' && kpiData) {
       rawData = kpiData.map((k: any) => ({
          'Nama Teknisi': k.name,
          'Total Pekerjaan Masuk': k.totalWOs,
          'Selesai & Diambil': k.completed,
          'Masih Sedang Berjalan': k.inProgress,
          'Rata-Rata Pengerjaan (Hari)': k.avgTatDays,
          'Tingkat Kesuksesan (%)': k.successRate
       }));
       const ws = XLSX.utils.json_to_sheet(rawData);
       XLSX.utils.book_append_sheet(wb, ws, "Penilaian Teknisi");
    }

    if (rawData.length === 0) return toast.info('Tidak ada data untuk diekspor');

    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pusat Laporan & Analitik</h1>
          <p className="text-gray-500 text-sm">Pantau statistik operasional dan finansial Central Komputer.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
           {tabs.map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as ReportTab)}
               className={cn(
                 "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all",
                 activeTab === tab.id ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
               )}
             >
               <tab.icon className="h-4 w-4" /> {tab.name}
             </button>
           ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[600px] flex flex-col">
        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-end gap-4 mb-8 pb-6 border-b">
          {activeTab !== 'stock' && (
            <>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-gray-400 uppercase">DARI TANGGAL</label>
                 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 border rounded-lg px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-gray-400 uppercase">SAMPAI TANGGAL</label>
                 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 border rounded-lg px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </>
          )}
          <Button variant="outline" className="h-10" onClick={exportToExcel}>
             <Download className="h-4 w-4 mr-2" /> Ekspor Excel
          </Button>
        </div>

        <div className="flex-1">
            {activeTab === 'sales' && (
                <div className="space-y-4">
                   <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><TableIcon className="h-4 w-4 text-blue-600" /> Transaksi Omnichannel</h3>
                   <Table>
                      <TableHeader className="bg-gray-50">
                         <TableRow>
                            <TableHead>Tipe</TableHead>
                            <TableHead>Referensi</TableHead>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Pelanggan</TableHead>
                            <TableHead>Kasir</TableHead>
                            <TableHead className="text-right">Total (Net)</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                         {salesLoading ? <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow> : 
                          sales?.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-gray-400 italic font-medium">Tidak ada data transaksi.</TableCell></TableRow> :
                          sales?.map((s: any) => (
                            <TableRow key={s.id}>
                               <TableCell>
                                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", 
                                      s.type === 'RETAIL' ? "bg-blue-100 text-blue-700" :
                                      s.type === 'SERVICE' ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                                  )}>
                                     {s.type}
                                  </span>
                               </TableCell>
                               <TableCell className="font-mono font-bold text-xs">{s.referenceNumber}</TableCell>
                               <TableCell className="text-xs text-gray-500">{new Date(s.date).toLocaleDateString()}</TableCell>
                               <TableCell className="text-gray-700">{s.customerName}</TableCell>
                               <TableCell className="text-[10px] uppercase font-bold text-gray-400">{s.cashier}</TableCell>
                               <TableCell className="text-right font-bold tabular-nums">Rp {s.total.toLocaleString()}</TableCell>
                            </TableRow>
                          ))
                         }
                      </TableBody>
                   </Table>
                </div>
            )}

            {activeTab === 'profit' && (
                <div className="space-y-4">
                   <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><DollarSign className="h-4 w-4 text-green-600" /> Analisa Laba Rugi Operasional</h3>
                   {profitLoading ? <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div> : 
                    profitData ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                           <div className="bg-slate-50 p-6 rounded-2xl border">
                              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Laba Penjualan Retail</p>
                              <p className="text-2xl font-black text-slate-700">Rp {profitData.retailProfit.toLocaleString()}</p>
                           </div>
                           <div className="bg-slate-50 p-6 rounded-2xl border">
                              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Laba Bersih Servis</p>
                              <p className="text-2xl font-black text-slate-700">Rp {profitData.serviceProfit.toLocaleString()}</p>
                           </div>
                           <div className="bg-red-50 p-6 rounded-2xl border border-red-100 lg:col-span-2">
                              <p className="text-xs font-bold text-red-400 uppercase mb-2">Beban Usaha (Pengeluaran + Komisi)</p>
                              <p className="text-2xl font-black text-red-600">Rp {(profitData.totalExpenses + profitData.totalCommissions).toLocaleString()}</p>
                              <p className="text-xs text-red-400 mt-1">Exp: Rp {profitData.totalExpenses.toLocaleString()} / Komisi: Rp {profitData.totalCommissions.toLocaleString()}</p>
                           </div>
                           <div className="bg-green-50 p-6 rounded-2xl border border-green-200 mt-4 lg:col-span-4">
                              <p className="text-sm font-bold text-green-600 uppercase mb-2">NET PROFIT (Laba Bersih Periode Ini)</p>
                              <p className="text-4xl font-black text-green-700">Rp {profitData.netProfit.toLocaleString()}</p>
                           </div>
                        </div>
                    ) : (
                        <div className="text-center p-8 text-gray-400">Data tidak tersedia</div>
                    )
                   }
                </div>
            )}

            {activeTab === 'kpis' && (
                <div className="space-y-4">
                   <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><Activity className="h-4 w-4 text-blue-600" /> Penilaian Performa Teknisi (KPIs)</h3>
                   <Table>
                      <TableHeader className="bg-gray-50">
                         <TableRow>
                            <TableHead>Nama Teknisi</TableHead>
                            <TableHead className="text-center">Total WO Masuk</TableHead>
                            <TableHead className="text-center">Diselesaikan</TableHead>
                            <TableHead className="text-center">Sedang Berjalan</TableHead>
                            <TableHead className="text-center">Rata-rata Waktu (TAT)</TableHead>
                            <TableHead className="text-right">Success Rate</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                         {kpiLoading ? <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow> : 
                          kpiData?.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-gray-400 italic font-medium">Belum ada data teknisi.</TableCell></TableRow> :
                          kpiData?.map((k: any) => (
                            <TableRow key={k.id}>
                               <TableCell className="font-bold">{k.name}</TableCell>
                               <TableCell className="text-center font-mono">{k.totalWOs}</TableCell>
                               <TableCell className="text-center font-bold text-green-600">{k.completed}</TableCell>
                               <TableCell className="text-center font-bold text-orange-500">{k.inProgress}</TableCell>
                               <TableCell className="text-center font-mono">{k.avgTatDays} Hari</TableCell>
                               <TableCell className="text-right">
                                  <span className={cn("px-2 py-1 rounded text-xs font-bold", parseFloat(k.successRate) > 80 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                                    {k.successRate}%
                                  </span>
                               </TableCell>
                            </TableRow>
                          ))
                         }
                      </TableBody>
                   </Table>
                </div>
            )}

            {activeTab === 'commissions' && (
                <div className="space-y-6">
                   <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2"><PieChart className="h-5 w-5 text-purple-600" /> Analitik Komisi Afiliasi</h3>
                      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                         {(['ALL', 'TECHNICIAN', 'AGENT'] as const).map(t => (
                            <button 
                              key={t}
                              onClick={() => setTargetTypeFilter(t)}
                              className={cn("flex-1 md:flex-none px-4 py-1.5 text-[11px] font-black tracking-wider uppercase rounded-lg transition-all", targetTypeFilter === t ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700")}
                            >
                               {t === 'ALL' ? 'Semua' : t === 'TECHNICIAN' ? 'Teknisi' : 'Agen'}
                            </button>
                         ))}
                      </div>
                   </div>

                   {commsLoading ? <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div> : !commissionsData ? null : (
                     <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-purple-500/20 relative overflow-hidden">
                               <PieChart className="absolute right-4 bottom-4 h-24 w-24 text-white/10 -rotate-12" />
                               <p className="text-[10px] font-black uppercase tracking-widest text-purple-200 mb-1">Total Hak Komisi</p>
                               <p className="text-3xl font-black tabular-nums">Rp {commissionsData.summary.total.toLocaleString()}</p>
                            </div>
                            <div className="bg-white border rounded-2xl p-6 shadow-sm flex flex-col justify-center">
                               <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Porsi Teknisi Internal</p>
                               <p className="text-2xl font-black text-gray-800 tabular-nums">Rp {commissionsData.summary.technician.toLocaleString()}</p>
                            </div>
                            <div className="bg-white border rounded-2xl p-6 shadow-sm flex flex-col justify-center">
                               <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Porsi Mitra Agen</p>
                               <p className="text-2xl font-black text-gray-800 tabular-nums">Rp {commissionsData.summary.agent.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                           <div className="bg-white border rounded-2xl p-5 shadow-sm h-fit">
                              <h4 className="font-bold text-gray-800 text-sm mb-4">Peringkat Penerima 🏆</h4>
                              <div className="space-y-3">
                                 {commissionsData.leaderboard.length === 0 ? <p className="text-xs font-bold text-gray-400 italic text-center p-4 bg-gray-50 rounded-xl">Tidak ada penerima komisi.</p> :
                                  commissionsData.leaderboard.map((row: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                                       <div className="flex items-center gap-3">
                                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-sm", i === 0 ? "bg-amber-100 text-amber-600 ring-2 ring-amber-100 ring-offset-1" : i === 1 ? "bg-slate-200 text-slate-700" : i === 2 ? "bg-orange-100 text-orange-800" : "bg-white text-gray-400 border")}>
                                             {i + 1}
                                          </div>
                                          <div className="flex flex-col">
                                             <p className="text-xs font-bold text-gray-800 line-clamp-1">{row.name}</p>
                                             <p className="text-[9px] font-black tracking-wider uppercase text-gray-400">{row.type === 'TECHNICIAN' ? 'TEKNISI' : 'AGEN'} • {row.totalWo} Tiket</p>
                                          </div>
                                       </div>
                                       <p className="font-bold text-green-600 tabular-nums text-sm">Rp{row.amount > 1000000 ? (row.amount / 1000000).toFixed(1) + 'M' : (row.amount / 1000) + 'k'}</p>
                                    </div>
                                 ))}
                              </div>
                           </div>

                           <div className="lg:col-span-2 bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col">
                              <div className="p-4 border-b bg-gray-50">
                                 <h4 className="font-bold text-gray-800 text-sm">Histori Komisi Terperinci (Ledger)</h4>
                              </div>
                              <div className="p-0 overflow-auto max-h-[500px]">
                                 <Table>
                                    <TableHeader className="bg-white sticky top-0 shadow-sm z-10">
                                       <TableRow>
                                          <TableHead>Penerima</TableHead>
                                          <TableHead>Referensi</TableHead>
                                          <TableHead>Tanggal</TableHead>
                                          <TableHead className="text-right">Nominal</TableHead>
                                       </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                       {commissionsData.list.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center font-bold text-gray-400 italic bg-gray-50/50">Belum ada transaksi</TableCell></TableRow> : 
                                        commissionsData.list.map((c: any) => (
                                          <TableRow key={c.id}>
                                             <TableCell>
                                                <div className="flex flex-col">
                                                   <span className="font-bold text-gray-800">{c.technician?.name || c.agent?.name}</span>
                                                   <span className={cn("text-[9px] font-black uppercase tracking-wider mt-1 w-fit rounded", c.targetType === 'TECHNICIAN' ? "text-blue-500" : "text-orange-500")}>
                                                      {c.targetType === 'TECHNICIAN' ? 'TEKNISI INTERNAL' : 'MITRA AGEN'}
                                                   </span>
                                                </div>
                                             </TableCell>
                                             <TableCell>
                                                <span className="text-xs text-blue-600 font-mono font-bold tracking-tight bg-blue-50 px-2 py-1 rounded-md border border-blue-100">#{c.referenceId}</span>
                                                <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">{c.referenceType === 'TRANSACTION' ? 'Ritel' : 'Servis'}</p>
                                             </TableCell>
                                             <TableCell className="text-gray-500 text-xs tabular-nums font-medium">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                                             <TableCell className="text-right font-black text-green-600 tabular-nums">Rp {c.amount.toLocaleString()}</TableCell>
                                          </TableRow>
                                        ))
                                       }
                                    </TableBody>
                                 </Table>
                              </div>
                           </div>
                        </div>
                     </>
                   )}
                </div>
            )}

            {activeTab === 'stock' && (
                <div className="space-y-4">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" /> Produk Segera Habis (Stock Alert)</h3>
                      <p className="text-[10px] text-gray-400 font-medium italic">* Produk dengan stok di bawah atau sama dengan batas minimum.</p>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stockLoading ? <div className="col-span-full h-32 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div> : 
                       stockAlerts?.length === 0 ? <div className="col-span-full h-32 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed">
                           <TrendingUp className="h-10 w-10 mb-2 opacity-20" />
                           <p>Semua produk memiliki stok aman.</p>
                       </div> :
                       stockAlerts?.map((p: any) => (
                         <div key={p.id} className="bg-red-50/30 p-4 rounded-xl border border-red-100 flex items-center gap-4 hover:shadow-md transition-all">
                            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                               <PackageSearch className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                               <p className="text-xs font-bold text-red-800 line-clamp-1">{p.name}</p>
                               <p className="text-[10px] text-gray-500 font-medium uppercase">{p.category.name}</p>
                               <div className="mt-2 flex items-center justify-between">
                                  <span className="text-xs text-gray-400">Min: <span className="font-bold text-gray-800 tabular-nums">{p.minStock}</span></span>
                                  <span className="text-xs font-black text-red-600 bg-white px-2 rounded border border-red-200 tabular-nums">SISA: {p.stock}</span>
                               </div>
                            </div>
                         </div>
                       ))
                      }
                   </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
