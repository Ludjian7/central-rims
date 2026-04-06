import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Lock, 
  Unlock, 
  Loader2, 
  History,
  AlertCircle,
  Plus,
  X,
  FileEdit,
  Trash2,
  User
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.js';
import { useConfirm } from '../contexts/ConfirmContext.js';
import { useAuth } from '../contexts/AuthContext.js';

export default function Finance() {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const { user: currentUser } = useAuth();
  const [openingCash, setOpeningCash] = useState('0');
  const [closingCash, setClosingCash] = useState('0');
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  // Modal & Form State for Expenses
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [expenseForm, setExpenseForm] = useState({ categoryId: '', amount: '', description: '', paymentMethod: 'cash' });

  const resetExpenseForm = () => setExpenseForm({ categoryId: '', amount: '', description: '', paymentMethod: 'cash' });

  const { data: activeShift, isLoading } = useQuery({
    queryKey: ['activeShift'],
    queryFn: async () => {
      const response = await api.get('/shifts/active');
      return response.data.data;
    },
  });

  const openShiftMutation = useMutation({
    mutationFn: (data: { openingCash: number }) => api.post('/shifts/open', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activeShift'] }),
  });

  const closeShiftMutation = useMutation({
    mutationFn: (data: { closingCash: number }) => api.post('/shifts/close', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeShift'] });
      queryClient.invalidateQueries({ queryKey: ['shiftsHistory'] });
    },
  });

  const { data: shiftsHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['shiftsHistory'],
    queryFn: async () => {
      const response = await api.get('/shifts');
      return response.data.data;
    },
    enabled: activeTab === 'history' && (currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER'),
  });

  const { data: expenseCategories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const res = await api.get('/expenses/categories');
      return res.data.data;
    }
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', activeShift?.id],
    queryFn: async () => {
      if (!activeShift?.id) return [];
      const res = await api.get(`/expenses?shiftId=${activeShift.id}`);
      return res.data.data;
    },
    enabled: !!activeShift?.id,
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string }) => api.post('/expenses/categories', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      setExpenseForm(prev => ({ ...prev, categoryId: res.data.data.id.toString() }));
      toast.success('Kategori baru ditambahkan');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menambah kategori baru')
  });

  const saveExpenseMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingExpenseId) {
        return api.put(`/expenses/${editingExpenseId}`, data);
      }
      return api.post('/expenses', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['activeShift'] });
      setIsExpenseModalOpen(false);
      resetExpenseForm();
      setEditingExpenseId(null);
      toast.success('Data pengeluaran berhasil disimpan');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menyimpan pengeluaran')
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['activeShift'] });
      toast.success('Pengeluaran berhasil dihapus');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menghapus pengeluaran')
  });

  const openExpenseModal = (exp?: any) => {
    if (exp) {
      setEditingExpenseId(exp.id);
      setExpenseForm({
        categoryId: exp.categoryId?.toString() || '',
        amount: exp.amount?.toString() || '',
        description: exp.description || '',
        paymentMethod: exp.paymentMethod || 'cash'
      });
    } else {
      setEditingExpenseId(null);
      setExpenseForm({ categoryId: expenseCategories?.[0]?.id?.toString() || '', amount: '', description: '', paymentMethod: 'cash' });
    }
    setIsExpenseModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
             <Wallet className="w-6 h-6 text-slate-800" />
             Menu Kasir & Uang Laci Toko
          </h1>
          <p className="text-slate-500 text-sm">Cek saldo laci, uang masuk/keluar, dan tutup kasir.</p>
        </div>
        {(currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER') && (
           <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200">
              <button 
                onClick={() => setActiveTab('active')}
                className={cn(
                   "px-5 py-1.5 text-xs font-bold rounded-lg transition-all", 
                   activeTab === 'active' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Sesi Laci Aktif
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn(
                   "px-5 py-1.5 text-xs font-bold rounded-lg transition-all", 
                   activeTab === 'history' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Rekap Laporan
              </button>
           </div>
        )}
      </div>

      {activeTab === 'history' ? (
         <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-50 border-b border-slate-200 px-6 py-4">
               <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                     <History className="h-5 w-5 text-slate-600" />
                     Rekap Penutupan Laci
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-xs">Daftar laporan harian sesi laci yang sudah selesai.</CardDescription>
               </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                     <thead className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                        <tr>
                           <th className="px-6 py-4">Tanggal & Jam</th>
                           <th className="px-6 py-4">Kasir/Petugas</th>
                           <th className="px-6 py-4 text-right">Modal Awal</th>
                           <th className="px-6 py-4 text-right">Uang Fisik</th>
                           <th className="px-6 py-4 text-right">Uang Sistem</th>
                           <th className="px-6 py-4 text-center">Selisih</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {isHistoryLoading ? (
                           <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-slate-300" /></td></tr>
                        ) : !shiftsHistory || shiftsHistory.length === 0 ? (
                           <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic text-xs">Belum ada riwayat laporan laci.</td></tr>
                        ) : (
                           shiftsHistory.map((s: any) => {
                              const disc = (s.closingCash || 0) - (s.systemCash || 0);
                              return (
                                 <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                       <div className="flex flex-col">
                                          <span className="font-bold text-slate-900">{new Date(s.startTime).toLocaleDateString()}</span>
                                          <span className="text-[10px] text-slate-500">
                                             {new Date(s.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {s.endTime ? new Date(s.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'AKTIF'}
                                          </span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className="text-xs font-bold text-slate-700">{s.user?.username || 'Sistem'}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium tabular-nums text-slate-500">Rp {s.openingCash?.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold tabular-nums text-slate-900">Rp {s.closingCash?.toLocaleString() || '-'}</td>
                                    <td className="px-6 py-4 text-right font-medium tabular-nums text-slate-400 italic">Rp {s.systemCash?.toLocaleString() || '-'}</td>
                                    <td className="px-6 py-4 text-center">
                                       {s.status === 'ACTIVE' ? (
                                          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase">Sedang Jalan</span>
                                       ) : (
                                          <div className={cn(
                                             "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-[10px] uppercase",
                                             Math.abs(disc) < 2 ? "bg-slate-100 text-slate-500" :
                                             disc < 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                                          )}>
                                             {Math.abs(disc) < 2 ? 'PAS' : `${disc < 0 ? '-' : '+'} Rp ${Math.abs(disc).toLocaleString()}`}
                                          </div>
                                       )}
                                    </td>
                                 </tr>
                              )
                           })
                        )}
                     </tbody>
                  </table>
               </div>
            </CardContent>
         </Card>
      ) : !activeShift ? (
         <Card className="border-2 border-dashed border-slate-200 bg-slate-50/30 rounded-2xl">
          <CardHeader className="text-center pt-10">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
               <Unlock className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-xl font-bold">Mulai Sesi Laci / Buka Kasir</CardTitle>
            <CardDescription className="max-w-xs mx-auto text-sm">Masukan jumlah uang Modal Awal di dalam laci sekarang.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-sm mx-auto pb-12">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openingCash" className="text-xs font-bold text-slate-600">Jumlah Modal Awal (Laci)</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">Rp</div>
                  <Input 
                    id="openingCash" 
                    type="number" 
                    className="h-12 pl-10 text-xl font-bold tabular-nums" 
                    placeholder="0"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                className="w-full h-12 text-sm font-bold bg-blue-600" 
                disabled={openShiftMutation.isPending}
                onClick={() => openShiftMutation.mutate({ openingCash: parseFloat(openingCash) })}
              >
                {openShiftMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Buka Sesi Laci Kasir
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-slate-200 bg-slate-900 text-white shadow-sm rounded-2xl">
              <CardHeader className="p-5">
                <CardDescription className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Total Uang Sistem</CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  Rp {activeShift.calculatedSystemCash?.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-2 gap-4 lg:col-span-1">
              <Card className="border border-slate-100 bg-white shadow-sm flex flex-col justify-center p-4 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Uang Masuk Tunai</span>
                <p className="text-base font-bold text-emerald-600 tabular-nums">
                  + {activeShift.metrics.totalCashIn?.toLocaleString()}
                </p>
              </Card>
              <Card className="border border-slate-100 bg-white shadow-sm flex flex-col justify-center p-4 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Uang Keluar Sesi</span>
                <p className="text-base font-bold text-red-600 tabular-nums">
                  - {activeShift.metrics.totalCashOut?.toLocaleString()}
                </p>
              </Card>
            </div>

            <Card className="border border-blue-100 bg-blue-50/30 rounded-2xl">
              <CardHeader className="p-5">
                <CardDescription className="text-blue-600/70 font-bold text-[10px] uppercase tracking-widest mb-1">Total Non-Tunai (QRIS/Bank)</CardDescription>
                <CardTitle className="text-xl font-bold text-blue-700 tabular-nums">
                  Rp {activeShift.metrics.totalTransferIn?.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="border border-slate-100 bg-slate-50/50 rounded-2xl opacity-50">
              <CardHeader className="p-5">
                <CardDescription className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Tranfer Keluar</CardDescription>
                <CardTitle className="text-xl font-bold text-slate-300 tabular-nums line-through">
                  Rp {activeShift.metrics.totalTransferOut?.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="border border-slate-200 rounded-2xl shadow-sm">
              <CardHeader className="border-b border-slate-100 p-5">
                <CardTitle className="text-base">Detail Sesi Aktif</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Mulai Sesi</span>
                    <span className="font-bold text-slate-900">{new Date(activeShift.startTime).toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Modal Awal</span>
                    <span className="font-bold text-blue-600">Rp {activeShift.openingCash?.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-50 opacity-50">
                    <span className="text-slate-500">ID Sesi</span>
                    <span className="font-mono text-xs">IDX-{activeShift.id}</span>
                 </div>
              </CardContent>
            </Card>

            <Card className="border border-amber-200 bg-amber-50/50 rounded-2xl shadow-sm">
              <CardHeader className="p-5">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base text-amber-900">Tutup Laci Sekarang</CardTitle>
                </div>
                <CardDescription className="text-amber-700 text-xs">Masukan jumlah uang fisik yang ada di laci sekarang.</CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="closingCash" className="text-xs font-bold text-amber-900">Hitung Uang Fisik (Tunai)</Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-xs font-mono">Rp</div>
                      <Input 
                        id="closingCash" 
                        type="number" 
                        className="h-12 pl-10 border-amber-200 bg-white text-xl font-bold tabular-nums" 
                        value={closingCash}
                        onChange={(e) => setClosingCash(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button 
                    className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    disabled={closeShiftMutation.isPending}
                    onClick={async () => {
                       const ok = await confirm({
                          title: "Setor & Tutup Laci?",
                          message: "Pastikan uang di laci sudah dihitung dengan benar. Sesi akan berakhir setelah ini.",
                          confirmText: "Ya, Tutup Sesi"
                       });
                       if(ok) {
                          closeShiftMutation.mutate({ closingCash: parseFloat(closingCash) });
                       }
                    }}
                  >
                    {closeShiftMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
                    Tutup & Setor Laci
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between p-5 bg-slate-50 border-b border-slate-200">
               <div>
                 <CardTitle className="text-base flex items-center gap-2">
                    <ArrowDownRight className="h-5 w-5 text-red-500" />
                    Catatan Pengeluaran Biaya
                 </CardTitle>
                 <CardDescription className="text-xs">Input biaya operasional (bensin, makan, dll) yang ambil dari laci.</CardDescription>
               </div>
               <Button onClick={() => openExpenseModal()} className="bg-white border border-slate-200 text-slate-900 text-xs h-10 font-bold px-5 hover:bg-slate-50 transition-colors shadow-sm">
                  <Plus className="h-4 w-4 mr-2 text-red-500" /> Catat Pengeluaran Baru
               </Button>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                     <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b">
                        <tr>
                           <th className="px-6 py-3">Jam</th>
                           <th className="px-6 py-3">Keterangan</th>
                           <th className="px-6 py-3 text-center">Metode</th>
                           <th className="px-6 py-3 text-right">Jumlah</th>
                           <th className="px-6 py-3 text-center w-24">Aksi</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {expensesLoading ? (
                           <tr><td colSpan={5} className="py-12 text-center text-slate-300"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                        ) : !expenses || expenses.length === 0 ? (
                           <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-xs italic">Belum ada pengeluaran hari ini.</td></tr>
                        ) : (
                           expenses.map((exp: any) => (
                              <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-6 py-3 text-xs text-slate-500 tabular-nums">{new Date(exp.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                                 <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                       <span className="font-bold text-slate-800 text-xs">{exp.category?.name || 'Umum'}</span>
                                       <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{exp.description || '-'}</span>
                                    </div>
                                 </td>
                                 <td className="px-6 py-3 text-center">
                                    <span className={cn(
                                       "text-[9px] font-bold uppercase px-2 py-0.5 rounded", 
                                       exp.paymentMethod === 'cash' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                    )}>
                                       {exp.paymentMethod}
                                    </span>
                                 </td>
                                 <td className="px-6 py-3 text-right font-bold text-red-600 tabular-nums">
                                    - {exp.amount.toLocaleString()}
                                 </td>
                                 <td className="px-6 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                       <button onClick={() => openExpenseModal(exp)} className="p-1.5 text-slate-400 hover:text-blue-600">
                                          <FileEdit className="h-4 w-4" />
                                       </button>
                                       <button 
                                          onClick={async () => {
                                            const ok = await confirm({
                                              title: "Hapus Catatan?",
                                              message: "Data ini akan dihapus permanen. Lanjutkan?",
                                              danger: true,
                                              confirmText: "Ya, Hapus"
                                            });
                                            if (ok) {
                                              deleteExpenseMutation.mutate(exp.id);
                                            }
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-red-500"
                                       >
                                          <Trash2 className="h-4 w-4" />
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">
                {editingExpenseId ? 'Ubah Catatan Kas' : 'Catat Kas Keluar'}
              </h3>
              <button 
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <Label className="text-xs font-bold text-slate-500">Kategori</Label>
                     <select 
                       className="flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                       value={expenseForm.categoryId}
                       onChange={e => {
                         if (e.target.value === 'NEW') {
                           const newCat = window.prompt('Masukkan nama kategori baru:');
                           if (newCat) createCategoryMutation.mutate({ name: newCat });
                         } else {
                           setExpenseForm({...expenseForm, categoryId: e.target.value});
                         }
                       }}
                     >
                       <option value="" disabled>-- Pilih --</option>
                       {expenseCategories?.map((cat: any) => (
                         <option key={cat.id} value={cat.id}>{cat.name}</option>
                       ))}
                       <option value="NEW" className="text-blue-600 font-bold">+ Kategori Baru</option>
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <Label className="text-xs font-bold text-slate-500">Sumber Uang</Label>
                     <select 
                       className="flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                       value={expenseForm.paymentMethod}
                       onChange={e => setExpenseForm({...expenseForm, paymentMethod: e.target.value})}
                     >
                       <option value="cash">Uang Laci</option>
                       <option value="transfer">Transfer/Bank</option>
                     </select>
                  </div>
               </div>
               <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500">Jumlah Uang (Rp)</Label>
                  <div className="relative">
                     <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rp</div>
                     <Input 
                       type="number" 
                       className="h-12 pl-10 text-xl font-bold" 
                       placeholder="0"
                       value={expenseForm.amount}
                       onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                     />
                  </div>
               </div>
               <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500">Keterangan</Label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Contoh: Beli bensin, bayar sampah..."
                    value={expenseForm.description}
                    onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                  />
               </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/50 flex gap-3 justify-end items-center">
              <button className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700" onClick={() => setIsExpenseModalOpen(false)}>Batal</button>
              <Button 
                onClick={() => saveExpenseMutation.mutate({...expenseForm, amount: parseFloat(expenseForm.amount)})}
                disabled={!expenseForm.amount || !expenseForm.categoryId || saveExpenseMutation.isPending}
                className="bg-slate-900 text-white font-bold px-6 h-11 rounded-xl"
              >
                {saveExpenseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Catatan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
