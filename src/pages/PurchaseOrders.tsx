import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Loader2, Search, Truck, FileText, CheckCircle2,
  ChevronDown, ChevronUp, Package, AlertTriangle, X, Eye,
  ArrowRight, Send
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
import { useConfirm } from '../contexts/ConfirmContext.tsx';

// --- Types ---
interface POItem {
  id: number;
  productId: number;
  qty: number;
  expectedCost: number;
  actualQty: number | null;
  actualCost: number | null;
  product: { id: number; name: string; sku: string | null; stock: number };
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'COMPLETED';
  estimatedTotal: number;
  actualTotal: number;
  expectedDate: string | null;
  receivedDate: string | null;
  createdAt: string;
  supplier: { id: number; name: string };
  items?: POItem[];
  _count?: { items: number };
}

interface DraftPOItem {
  productId: string;
  qty: string;
  expectedCost: string;
}

const STATUS_MAP = {
  DRAFT:     { label: 'Draft',    color: 'bg-slate-100 text-slate-600 ring-slate-200' },
  SENT:      { label: 'Dikirim', color: 'bg-blue-50 text-blue-700 ring-blue-200' },
  PARTIAL:   { label: 'Parsial', color: 'bg-amber-50 text-amber-700 ring-amber-200' },
  COMPLETED: { label: 'Selesai', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

export default function PurchaseOrders() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  // --- State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Draft PO Modal
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [draftSupplierId, setDraftSupplierId] = useState('');
  const [draftExpectedDate, setDraftExpectedDate] = useState('');
  const [draftItems, setDraftItems] = useState<DraftPOItem[]>([
    { productId: '', qty: '1', expectedCost: '0' }
  ]);

  // Receive Modal
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<{ purchaseOrderItemId: string; actualQty: string; actualCost: string }[]>([]);

  // Detail Modal
  const [detailTarget, setDetailTarget] = useState<PurchaseOrder | null>(null);

  // --- Queries ---
  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['purchase-orders', statusFilter],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/purchase-orders', { params });
      return res.data.data as PurchaseOrder[];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/suppliers')).data.data,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data.data,
  });

  const { data: detailFull, isLoading: detailLoading } = useQuery({
    queryKey: ['purchase-orders', detailTarget?.id],
    enabled: !!detailTarget,
    queryFn: async () => {
      const res = await api.get(`/purchase-orders/${detailTarget!.id}`);
      return res.data.data as PurchaseOrder;
    },
  });

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/purchase-orders', payload),
    onSuccess: () => {
      toast.success('Draft Purchase Order berhasil dibuat!');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      closeDraftModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal membuat Draft PO'),
  });

  const receiveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      api.post(`/purchase-orders/${id}/receive`, payload),
    onSuccess: () => {
      toast.success('Barang berhasil diterima & stok telah diperbarui!');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setReceiveTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal memproses penerimaan barang'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/purchase-orders/${id}/status`, { status }),
    onSuccess: (_, variables) => {
      toast.success(`Status PO berhasil diubah menjadi ${STATUS_MAP[variables.status as keyof typeof STATUS_MAP].label}`);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mengubah status PO'),
  });

  // --- Handlers ---
  const closeDraftModal = () => {
    setIsDraftOpen(false);
    setDraftSupplierId('');
    setDraftExpectedDate('');
    setDraftItems([{ productId: '', qty: '1', expectedCost: '0' }]);
  };

  const handleAddDraftItem = () => {
    setDraftItems(prev => [...prev, { productId: '', qty: '1', expectedCost: '0' }]);
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleDraftItemChange = (index: number, field: keyof DraftPOItem, value: string) => {
    setDraftItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-fill HPP dari master produk
      if (field === 'productId' && value) {
        const prod = products?.find((p: any) => p.id === parseInt(value));
        if (prod) updated[index].expectedCost = prod.cost?.toString() || '0';
      }
      return updated;
    });
  };

  const handleCreateDraft = () => {
    if (!draftSupplierId) { toast.error('Pilih Supplier terlebih dahulu'); return; }
    const validItems = draftItems.filter(i => i.productId && parseInt(i.qty) > 0);
    if (validItems.length === 0) { toast.error('Tambahkan minimal 1 item untuk dipesan'); return; }
    createMutation.mutate({
      supplierId: draftSupplierId,
      expectedDate: draftExpectedDate || null,
      items: validItems.map(i => ({
        productId: i.productId,
        qty: i.qty,
        expectedCost: i.expectedCost,
      })),
    });
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setReceiveTarget(po);
  };

  const { data: receiveDetail } = useQuery({
    queryKey: ['purchase-orders', receiveTarget?.id, 'detail'],
    enabled: !!receiveTarget,
    queryFn: async () => {
      const res = await api.get(`/purchase-orders/${receiveTarget!.id}`);
      return res.data.data as PurchaseOrder;
    },
  });

  // Sync receive items when detail data arrives
  useEffect(() => {
    if (receiveDetail?.items) {
      setReceiveItems(receiveDetail.items.map(item => ({
        purchaseOrderItemId: item.id.toString(),
        actualQty: item.qty.toString(),
        actualCost: item.expectedCost.toString(),
      })));
    }
  }, [receiveDetail]);

  const handleReceiveSubmit = async () => {
    if (!receiveTarget) return;
    const hasQty = receiveItems.some(i => parseInt(i.actualQty) > 0);
    if (!hasQty) { toast.error('Isi qty penerimaan minimal 1 item'); return; }
    const ok = await confirm({
      title: 'Konfirmasi Penerimaan Barang',
      message: `Stok produk akan bertambah dan HPP master akan diperbarui sesuai faktur. Proses tidak dapat dibatalkan. Lanjutkan?`,
      confirmText: 'Terima & Simpan Stok',
    });
    if (!ok) return;
    receiveMutation.mutate({ id: receiveTarget.id, payload: { receivedItems: receiveItems } });
  };

  const filtered = purchaseOrders?.filter(po =>
    po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const estimatedDraftTotal = draftItems.reduce((acc, i) => {
    return acc + (parseFloat(i.expectedCost || '0') * parseInt(i.qty || '0'));
  }, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-black text-v2-blue uppercase tracking-[0.3em] mb-1">Logistik</h2>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Purchase Order</h1>
          <p className="text-slate-500 text-sm font-medium">Kelola pengadaan & restock barang dari supplier.</p>
        </div>
        <Button
          onClick={() => setIsDraftOpen(true)}
          className="bg-v2-blue hover:bg-v2-blue/90 text-white shadow-xl shadow-v2-blue/10 rounded-xl h-12 px-6 font-bold gap-2 transform transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" /> Buat Draft PO
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-v2-blue/5 flex items-center justify-center border border-v2-blue/10">
              <Truck className="h-6 w-6 text-v2-blue" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Riwayat Pembelian</h3>
              <p className="text-slate-400 text-xs font-medium">{filtered?.length || 0} PO Terdaftar</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex gap-2">
              {['all', 'DRAFT', 'SENT', 'PARTIAL', 'COMPLETED'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all',
                    statusFilter === s
                      ? 'bg-v2-blue text-white shadow-lg shadow-v2-blue/20'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  )}
                >
                  {s === 'all' ? 'Semua' : STATUS_MAP[s as keyof typeof STATUS_MAP]?.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input
                placeholder="Cari no. PO / Supplier..."
                className="pl-10 h-10 bg-slate-50 border-none rounded-xl text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-v2-blue" />
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-white border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-black text-slate-800 text-[10px] uppercase tracking-[0.2em] py-6 pl-8">No. PO</TableHead>
                <TableHead className="font-black text-slate-800 text-[10px] uppercase tracking-[0.2em] py-6">Supplier / Distributor</TableHead>
                <TableHead className="font-black text-slate-800 text-[10px] uppercase tracking-[0.2em] py-6 text-center">Items</TableHead>
                <TableHead className="font-black text-slate-800 text-[10px] uppercase tracking-[0.2em] py-6">Status</TableHead>
                <TableHead className="font-black text-slate-800 text-[10px] uppercase tracking-[0.2em] py-6 text-right">Nominal Transaksi</TableHead>
                <TableHead className="font-black text-slate-800 text-[10px] uppercase tracking-[0.2em] py-6 pr-8 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered && filtered.length > 0 ? (
                filtered.map(po => (
                  <TableRow key={po.id} className="group hover:bg-v2-blue/[0.02] transition-all border-b border-slate-50">
                    <TableCell className="py-6 pl-8">
                      <div className="flex flex-col gap-1">
                        <code className="w-fit px-3 py-1 rounded-lg bg-v2-blue/10 text-v2-blue text-[11px] font-mono font-bold border border-v2-blue/20">
                          {po.poNumber}
                        </code>
                        <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase tracking-tighter">
                          {new Date(po.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-6">
                       <span className="font-black text-slate-900 tracking-tight text-[15px] block">{po.supplier.name}</span>
                       <span className="text-[10px] text-slate-400 font-medium">Mitra Suplier</span>
                    </TableCell>
                    <TableCell className="py-6 text-center">
                      <div className="flex flex-col items-center">
                        <span className="w-9 h-6 flex items-center justify-center bg-slate-100 rounded-lg font-black text-slate-900 text-xs">
                          {po._count?.items || 0}
                        </span>
                        <span className="text-[9px] text-slate-400 font-black uppercase mt-1">Item SKU</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-6">
                      <span className={cn(
                        'inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ring-1 ring-inset',
                        STATUS_MAP[po.status]?.color
                      )}>
                        {STATUS_MAP[po.status]?.label}
                      </span>
                    </TableCell>
                    <TableCell className="py-6 text-right">
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">
                        {po.status === 'COMPLETED' ? 'Aktual Bayar' : 'Estimasi Nilai'}
                       </p>
                       <p className="text-lg font-black text-slate-900 tabular-nums tracking-tighter">
                          Rp {po.estimatedTotal.toLocaleString('id-ID')}
                       </p>
                    </TableCell>
                    <TableCell className="py-6 pr-8 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          variant="outline"
                          className="h-9 px-3 rounded-xl text-[11px] font-bold gap-2 border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-v2-blue transition-all"
                          onClick={() => setDetailTarget(po)}
                        >
                          <Eye className="h-4 w-4" />
                          Detail
                        </Button>
                        
                        {po.status === 'DRAFT' && (
                          <Button
                            className="h-9 px-4 rounded-xl bg-v2-blue hover:bg-v2-blue/90 text-white text-[11px] font-black gap-2 transition-all active:scale-95 shadow-lg shadow-v2-blue/10"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Kirim PO ke Supplier?',
                                message: 'Apakah Anda sudah yakin data pesanan ini benar dan ingin mengirimnya ke supplier?',
                                confirmText: 'Ya, Kirim Sekarang'
                              });
                              if (ok) statusMutation.mutate({ id: po.id, status: 'SENT' });
                            }}
                          >
                            <Send className="h-4 w-4" />
                            Kirim PO
                          </Button>
                        )}

                        {(po.status === 'SENT' || po.status === 'PARTIAL') && (
                          <Button
                            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black gap-2 shadow-lg shadow-emerald-600/20 border-none transition-all active:scale-95"
                            onClick={() => openReceiveModal(po)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Terima Barang
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="h-8 w-8 opacity-20" />
                      <p>Belum ada Purchase Order.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ─── Modal: Buat Draft PO ─── */}
      <Modal
        isOpen={isDraftOpen}
        onClose={closeDraftModal}
        title="Buat Draft Purchase Order"
        description="Buat pesanan pembelian barang ke supplier. HPP produk akan diperbarui saat barang diterima."
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <select
                value={draftSupplierId}
                onChange={e => setDraftSupplierId(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium"
              >
                <option value="">-- Pilih Supplier --</option>
                {suppliers?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Estimasi Tiba (Opsional)</Label>
              <Input type="date" value={draftExpectedDate} onChange={e => setDraftExpectedDate(e.target.value)} className="h-10" />
            </div>
          </div>

          {/* Item Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-700 font-black">Item Pesanan</Label>
              <button
                onClick={handleAddDraftItem}
                className="text-[11px] font-black text-v2-blue hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Tambah Item
              </button>
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-12 gap-0 bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <div className="col-span-5">Produk</div>
                <div className="col-span-3 text-center">Qty</div>
                <div className="col-span-3 text-right">HPP Prediksi</div>
                <div className="col-span-1"></div>
              </div>
              {draftItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 border-t border-slate-50">
                  <div className="col-span-5">
                    <select
                      value={item.productId}
                      onChange={e => handleDraftItemChange(index, 'productId', e.target.value)}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium"
                    >
                      <option value="">-- Pilih --</option>
                      {products?.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number" min="1"
                      value={item.qty}
                      onChange={e => handleDraftItemChange(index, 'qty', e.target.value)}
                      className="h-9 text-center text-sm font-bold border-slate-200"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number" min="0"
                      value={item.expectedCost}
                      onChange={e => handleDraftItemChange(index, 'expectedCost', e.target.value)}
                      className="h-9 text-right text-sm font-bold border-slate-200"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {draftItems.length > 1 && (
                      <button
                        onClick={() => handleRemoveDraftItem(index)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estimated Total */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-5 py-3">
            <span className="text-sm font-black text-slate-500 uppercase tracking-wider">Estimasi Total</span>
            <span className="text-xl font-black text-slate-900 tabular-nums">
              Rp {estimatedDraftTotal.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-white">
            <Button variant="outline" onClick={closeDraftModal}>Batal</Button>
            <Button
              onClick={handleCreateDraft}
              disabled={createMutation.isPending}
              className="bg-v2-blue hover:bg-v2-blue/90 text-white font-bold rounded-xl"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Buat Draft PO
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Modal: Terima Barang ─── */}
      {receiveTarget && (
        <Modal
          isOpen={!!receiveTarget}
          onClose={() => setReceiveTarget(null)}
          title={`Penerimaan Barang — ${receiveTarget.poNumber}`}
          description="Isi qty dan harga faktur asli dari supplier. HPP master produk akan diperbarui otomatis."
        >
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
            {!receiveDetail ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-v2-blue" />
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <div className="col-span-4">Produk</div>
                    <div className="col-span-2 text-center">Dipesan</div>
                    <div className="col-span-3 text-center">Qty Diterima</div>
                    <div className="col-span-3 text-right">HPP Faktur</div>
                  </div>
                  {receiveDetail.items?.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center px-3 py-3 border-t border-slate-50">
                      <div className="col-span-4">
                        <p className="text-xs font-bold text-slate-800 leading-tight">{item.product.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Stok: {item.product.stock}</p>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-sm font-black text-slate-500">{item.qty}</span>
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number" min="0"
                          value={receiveItems[index]?.actualQty || ''}
                          onChange={e => {
                            const updated = [...receiveItems];
                            if (updated[index]) updated[index].actualQty = e.target.value;
                            setReceiveItems(updated);
                          }}
                          className="h-10 text-center text-sm font-black bg-white border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number" min="0"
                          value={receiveItems[index]?.actualCost || ''}
                          onChange={e => {
                            const updated = [...receiveItems];
                            if (updated[index]) updated[index].actualCost = e.target.value;
                            setReceiveItems(updated);
                          }}
                          className="h-10 text-right text-sm font-black bg-white border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  HPP master produk akan diperbarui berdasarkan harga faktur yang Anda isi. Transaksi sebelumnya tidak terpengaruh.
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setReceiveTarget(null)}>Batal</Button>
                  <Button
                    onClick={handleReceiveSubmit}
                    disabled={receiveMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-2"
                  >
                    {receiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Konfirmasi Terima Barang
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ─── Modal: Detail PO ─── */}
      {detailTarget && (
        <Modal
          isOpen={!!detailTarget}
          onClose={() => setDetailTarget(null)}
          title={`Detail ${detailTarget.poNumber}`}
          description={`Supplier: ${detailTarget.supplier.name} | Status: ${STATUS_MAP[detailTarget.status]?.label}`}
        >
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {detailLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-v2-blue" />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <div className="col-span-5">Produk</div>
                  <div className="col-span-2 text-center">Qty Order</div>
                  <div className="col-span-2 text-center">Qty Terima</div>
                  <div className="col-span-3 text-right">HPP Faktur</div>
                </div>
                {detailFull?.items?.map(item => (
                  <div key={item.id} className="grid grid-cols-12 items-center px-3 py-3 border-t border-slate-50">
                    <div className="col-span-5">
                      <p className="text-xs font-bold text-slate-800">{item.product.name}</p>
                      {item.product.sku && <code className="text-[10px] text-slate-400">{item.product.sku}</code>}
                    </div>
                    <div className="col-span-2 text-center font-bold text-slate-700">{item.qty}</div>
                    <div className="col-span-2 text-center font-bold text-emerald-600">{item.actualQty ?? '—'}</div>
                    <div className="col-span-3 text-right text-sm font-black text-slate-700 tabular-nums">
                      {(item.actualCost || 0) > 0 ? `Rp ${item.actualCost?.toLocaleString('id-ID')}` : '—'}
                    </div>
                  </div>
                ))}
                <div className="px-3 py-3 border-t-2 border-slate-200 flex justify-between items-center bg-slate-50/50">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                    {detailTarget.status === 'COMPLETED' ? 'Total Faktur Aktual' : 'Estimasi Total'}
                  </span>
                  <span className="text-lg font-black text-slate-900 tabular-nums">
                    Rp {(detailFull?.actualTotal || detailFull?.estimatedTotal || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
