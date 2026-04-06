import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, Loader2, Search, Plus, Minus, ArrowUpCircle,
  ArrowDownCircle, AlertTriangle, RefreshCw, Package, Filter
} from 'lucide-react';
import { api } from '../lib/api.js';
import { cn } from '../lib/utils.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Modal } from '../components/ui/modal.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table.js';
import { useToast } from '../contexts/ToastContext.tsx';

// --- Types ---
interface StockMovement {
  id: number;
  productId: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  qty: number;
  referenceType: string;
  referenceId: number | null;
  remarks: string | null;
  createdAt: string;
  product: { id: number; name: string; sku: string | null };
}

interface Product {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  category: { name: string };
}

const TYPE_MAP = {
  IN:         { label: 'Masuk',       color: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: ArrowUpCircle },
  OUT:        { label: 'Keluar',      color: 'bg-red-50 text-red-700 ring-red-200',         icon: ArrowDownCircle },
  ADJUSTMENT: { label: 'Opname',      color: 'bg-amber-50 text-amber-700 ring-amber-200',   icon: RefreshCw },
};

const REF_LABEL: Record<string, string> = {
  TRANSACTION:    'Penjualan Kasir',
  WORK_ORDER:     'Jasa Servis',
  PURCHASE_ORDER: 'Pembelian (PO)',
  MANUAL:         'Opname Manual',
};

export default function Inventory() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // Filter state
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Adjustment Modal
  const [isAdjOpen, setIsAdjOpen] = useState(false);
  const [adjProductId, setAdjProductId] = useState('');
  const [adjQty, setAdjQty] = useState('0');
  const [adjMode, setAdjMode] = useState<'add' | 'sub'>('add');
  const [adjRemarks, setAdjRemarks] = useState('');

  // --- Queries ---
  const { data: movements, isLoading: movementsLoading } = useQuery({
    queryKey: ['stock-movements', typeFilter],
    queryFn: async () => {
      const params: any = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      const res = await api.get('/inventory/movements', { params });
      return res.data.data as StockMovement[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data.data as Product[],
  });

  // --- Mutations ---
  const adjMutation = useMutation({
    mutationFn: (payload: any) => api.post('/inventory/adjustment', payload),
    onSuccess: () => {
      toast.success('Penyesuaian stok berhasil disimpan!');
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeAdjModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal melakukan penyesuaian stok'),
  });

  const closeAdjModal = () => {
    setIsAdjOpen(false);
    setAdjProductId('');
    setAdjQty('0');
    setAdjMode('add');
    setAdjRemarks('');
  };

  const handleAdjust = () => {
    if (!adjProductId) { toast.error('Pilih produk terlebih dahulu'); return; }
    const qty = parseInt(adjQty);
    if (!qty || qty <= 0) { toast.error('Jumlah penyesuaian tidak boleh 0 atau negatif'); return; }
    const finalQty = adjMode === 'sub' ? -qty : qty;
    adjMutation.mutate({
      productId: adjProductId,
      adjustmentQty: finalQty,
      remarks: adjRemarks || `Opname Manual: ${adjMode === 'add' ? '+' : '-'}${qty}`,
    });
  };

  // Stock alert stats
  const lowStockProducts = products?.filter(p => p.stock > 0 && p.stock <= p.minStock) || [];
  const outOfStockProducts = products?.filter(p => p.stock <= 0) || [];

  // Filtered movements
  const filteredMovements = movements?.filter(m =>
    m.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.remarks?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProduct = products?.find(p => p.id === parseInt(adjProductId));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-black text-v2-blue uppercase tracking-[0.3em] mb-1">Logistik</h2>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Inventori & Stok</h1>
          <p className="text-slate-500 text-sm font-medium">Pantau pergerakan stok dan lakukan penyesuaian manual.</p>
        </div>
        <Button
          onClick={() => setIsAdjOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/20 rounded-xl h-12 px-6 font-bold gap-2 transition-all active:scale-95"
        >
          <RefreshCw className="h-4 w-4" /> Stock Opname / Adjustment
        </Button>
      </div>

      {/* Alert Cards */}
      {(outOfStockProducts.length > 0 || lowStockProducts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {outOfStockProducts.length > 0 && (
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-red-50 border border-red-100">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-red-700 text-sm uppercase tracking-wider mb-2">
                  {outOfStockProducts.length} Produk Stok Kosong
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {outOfStockProducts.slice(0, 4).map(p => (
                    <span key={p.id} className="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg">
                      {p.name}
                    </span>
                  ))}
                  {outOfStockProducts.length > 4 && (
                    <span className="px-2.5 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded-lg">
                      +{outOfStockProducts.length - 4} lainnya
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          {lowStockProducts.length > 0 && (
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-amber-700 text-sm uppercase tracking-wider mb-2">
                  {lowStockProducts.length} Produk Stok Menipis
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {lowStockProducts.slice(0, 4).map(p => (
                    <span key={p.id} className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg">
                      {p.name} <span className="opacity-60">({p.stock}/{p.minStock})</span>
                    </span>
                  ))}
                  {lowStockProducts.length > 4 && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-600 text-[10px] font-bold rounded-lg">
                      +{lowStockProducts.length - 4} lainnya
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Buku Besar Stok */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-v2-blue/5 flex items-center justify-center border border-v2-blue/10">
              <ClipboardList className="h-6 w-6 text-v2-blue" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Buku Besar Mutasi Stok</h3>
              <p className="text-slate-400 text-xs font-medium">{filteredMovements?.length || 0} entri (100 terbaru)</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Type filter */}
            <div className="flex gap-2">
              {(['all', 'IN', 'OUT', 'ADJUSTMENT'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all',
                    typeFilter === t
                      ? 'bg-v2-blue text-white shadow-lg shadow-v2-blue/20'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  )}
                >
                  {t === 'all' ? 'Semua' : TYPE_MAP[t]?.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input
                placeholder="Cari produk / keterangan..."
                className="pl-10 h-10 bg-slate-50 border-none rounded-xl text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {movementsLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-v2-blue" />
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-white border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] py-5 pl-8">Tanggal</TableHead>
                <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Produk</TableHead>
                <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Tipe</TableHead>
                <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Qty</TableHead>
                <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Sumber</TableHead>
                <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] pr-8">Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements && filteredMovements.length > 0 ? (
                filteredMovements.map(m => {
                  const typeInfo = TYPE_MAP[m.type];
                  const Icon = typeInfo.icon;
                  return (
                    <TableRow key={m.id} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50">
                      <TableCell className="py-4 pl-8 text-xs text-slate-400 font-medium whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <br />
                        <span className="text-[10px] text-slate-300">
                          {new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="text-sm font-bold text-slate-800">{m.product.name}</p>
                        {m.product.sku && <code className="text-[10px] text-slate-400">{m.product.sku}</code>}
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black ring-1 ring-inset',
                          typeInfo.color
                        )}>
                          <Icon className="h-3 w-3" />
                          {typeInfo.label}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <span className={cn(
                          'text-lg font-black tabular-nums',
                          m.type === 'IN' ? 'text-emerald-600' :
                          m.type === 'OUT' ? 'text-red-600' :
                          'text-amber-600'
                        )}>
                          {m.type === 'IN' ? '+' : m.type === 'OUT' ? '−' : '±'}{m.qty}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                          {REF_LABEL[m.referenceType] || m.referenceType}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 pr-8 text-xs text-slate-500 font-medium max-w-[220px] truncate">
                        {m.remarks || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="h-8 w-8 opacity-20" />
                      <p>Belum ada mutasi stok tercatat.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ─── Modal: Stock Adjustment ─── */}
      <Modal
        isOpen={isAdjOpen}
        onClose={closeAdjModal}
        title="Stock Opname / Penyesuaian Manual"
        description="Lakukan koreksi stok karena ada barang hilang, rusak, atau selisih fisik gudang."
      >
        <div className="space-y-5">
          {/* Product Picker */}
          <div className="space-y-2">
            <Label>Pilih Produk</Label>
            <select
              value={adjProductId}
              onChange={e => setAdjProductId(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-v2-blue/20"
            >
              <option value="">-- Pilih Produk --</option>
              {products?.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(${p.sku})` : ''} — Stok: {p.stock}
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Info */}
          {selectedProduct && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-v2-blue/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-v2-blue" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Stok Saat Ini (Sistem)</p>
                <p className={cn(
                  'text-2xl font-black tabular-nums',
                  selectedProduct.stock <= 0 ? 'text-red-600' :
                  selectedProduct.stock <= selectedProduct.minStock ? 'text-amber-600' :
                  'text-slate-900'
                )}>
                  {selectedProduct.stock} <span className="text-sm font-medium text-slate-400">unit</span>
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Min. Stok Alarm</p>
                <p className="text-lg font-black text-slate-500">{selectedProduct.minStock}</p>
              </div>
            </div>
          )}

          {/* Add / Sub Toggle + Qty */}
          <div className="space-y-3">
            <Label>Jenis Koreksi & Jumlah</Label>
            <div className="flex gap-3">
              <button
                onClick={() => setAdjMode('add')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all border-2',
                  adjMode === 'add'
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                    : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-200 hover:text-emerald-600'
                )}
              >
                <Plus className="h-4 w-4" /> Tambah Stok
              </button>
              <button
                onClick={() => setAdjMode('sub')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all border-2',
                  adjMode === 'sub'
                    ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                    : 'bg-white text-slate-400 border-slate-200 hover:border-red-200 hover:text-red-600'
                )}
              >
                <Minus className="h-4 w-4" /> Kurangi Stok
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className={cn(
                'text-3xl font-black w-12 text-center',
                adjMode === 'add' ? 'text-emerald-500' : 'text-red-500'
              )}>
                {adjMode === 'add' ? '+' : '−'}
              </div>
              <Input
                type="number" min="1"
                placeholder="Jumlah unit..."
                value={adjQty}
                onChange={e => setAdjQty(e.target.value)}
                className="h-12 text-center text-xl font-black border-slate-200 flex-1"
              />
              <div className="text-sm text-slate-400 font-bold w-12">unit</div>
            </div>
            {selectedProduct && parseInt(adjQty) > 0 && (
              <div className="text-center text-xs text-slate-500 font-medium">
                Stok akan berubah dari{' '}
                <span className="font-black text-slate-700">{selectedProduct.stock}</span>
                {' '}→{' '}
                <span className={cn(
                  'font-black',
                  adjMode === 'add' ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {adjMode === 'add'
                    ? selectedProduct.stock + parseInt(adjQty || '0')
                    : selectedProduct.stock - parseInt(adjQty || '0')}
                </span>
              </div>
            )}
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label>Alasan / Catatan</Label>
            <textarea
              value={adjRemarks}
              onChange={e => setAdjRemarks(e.target.value)}
              placeholder="Contoh: Barang rusak karena jatuh, Selisih hasil opname fisik..."
              className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-v2-blue/20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeAdjModal}>Batal</Button>
            <Button
              onClick={handleAdjust}
              disabled={adjMutation.isPending}
              className={cn(
                'font-bold rounded-xl text-white gap-2',
                adjMode === 'add'
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
                  : 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
              )}
            >
              {adjMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Simpan Penyesuaian
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
