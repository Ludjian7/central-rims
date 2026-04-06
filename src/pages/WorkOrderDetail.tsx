import React, { useState, useReducer, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Wrench, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  Cpu, 
  User, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Search,
  Package,
  CreditCard,
  Banknote,
  ArrowRight,
  Minus,
  Tag,
  FileText,
  Clock
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Modal } from '../components/ui/modal.js';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.tsx';

// --- Types ---
interface WOItem {
  name?: string;
  productId?: number;
  qty: number;
  price: number;
  subtotal: number;
  notes?: string;
}

interface WorkOrder {
  id: number;
  woNumber: string;
  status: string;
  deviceType: string;
  deviceBrand: string | null;
  deviceModel: string | null;
  serialNumber: string | null;
  complaints: string;
  notes: string | null;
  createdAt: string;
  customer: { id: number, name: string, phone: string | null };
  technician: { id: number, name: string };
  technicianId: number;
  serviceItems: any[];
  sparepartItems: any[];
}

// --- Reducer for "Service Cart" ---
type CartAction = 
  | { type: 'ADD_SERVICE'; name: string; price: number }
  | { type: 'ADD_SPAREPART'; productId: number; name: string; price: number }
  | { type: 'UPDATE_QTY'; index: number; isSparepart: boolean; qty: number }
  | { type: 'UPDATE_NAME'; index: number; name: string }
  | { type: 'UPDATE_NOTES'; index: number; isSparepart: boolean; notes: string }
  | { type: 'UPDATE_PRICE'; index: number; isSparepart: boolean; price: number }
  | { type: 'REMOVE_ITEM'; index: number; isSparepart: boolean }
  | { type: 'SET_INITIAL'; services: any[], spareparts: any[] };

function cartReducer(state: { services: WOItem[], spareparts: WOItem[] }, action: CartAction) {
  switch (action.type) {
    case 'SET_INITIAL':
      return { 
        services: action.services.map(s => ({ name: s.name, qty: s.qty, price: s.price, subtotal: s.subtotal, notes: s.notes })),
        spareparts: action.spareparts.map(p => ({ productId: p.productId, name: p.product?.name, qty: p.qty, price: p.price, subtotal: p.subtotal, notes: p.notes }))
      };
    case 'ADD_SERVICE':
      return { ...state, services: [...state.services, { name: action.name, price: action.price, qty: 1, subtotal: action.price }] };
    case 'ADD_SPAREPART':
      return { ...state, spareparts: [...state.spareparts, { productId: action.productId, name: action.name, price: action.price, qty: 1, subtotal: action.price }] };
    case 'UPDATE_QTY':
      if (action.isSparepart) {
        const newSpareparts = [...state.spareparts];
        newSpareparts[action.index] = { ...newSpareparts[action.index], qty: action.qty, subtotal: action.qty * newSpareparts[action.index].price };
        return { ...state, spareparts: newSpareparts };
      } else {
        const newServices = [...state.services];
        newServices[action.index] = { ...newServices[action.index], qty: action.qty, subtotal: action.qty * newServices[action.index].price };
        return { ...state, services: newServices };
      }
    case 'UPDATE_NAME': {
      const newServicesName = [...state.services];
      newServicesName[action.index] = { ...newServicesName[action.index], name: action.name };
      return { ...state, services: newServicesName };
    }
    case 'UPDATE_NOTES': {
      if (action.isSparepart) {
        const newSpareparts = [...state.spareparts];
        newSpareparts[action.index] = { ...newSpareparts[action.index], notes: action.notes };
        return { ...state, spareparts: newSpareparts };
      } else {
        const newServices = [...state.services];
        newServices[action.index] = { ...newServices[action.index], notes: action.notes };
        return { ...state, services: newServices };
      }
    }
    case 'UPDATE_PRICE': {
      if (action.isSparepart) {
        const newSpareparts = [...state.spareparts];
        newSpareparts[action.index] = { ...newSpareparts[action.index], price: action.price, subtotal: action.price * newSpareparts[action.index].qty };
        return { ...state, spareparts: newSpareparts };
      } else {
        const newServices = [...state.services];
        newServices[action.index] = { ...newServices[action.index], price: action.price, subtotal: action.price * newServices[action.index].qty };
        return { ...state, services: newServices };
      }
    }
    case 'REMOVE_ITEM':
      if (action.isSparepart) {
        return { ...state, spareparts: state.spareparts.filter((_, i) => i !== action.index) };
      } else {
        return { ...state, services: state.services.filter((_, i) => i !== action.index) };
      }
    default:
      return state;
  }
}

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [cart, dispatch] = useReducer(cartReducer, { services: [], spareparts: [] });
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSparepartSearchOpen, setIsSparepartSearchOpen] = useState(false);
  const toast = useToast();
  
  // Checkout States
  const [paidAmount, setPaidAmount] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [sparepartSearch, setSparepartSearch] = useState('');
  
  // Success & Receipt States
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<number | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastTransactionData, setLastTransactionData] = useState<any>(null);

  // --- Queries ---
  const { data: wo, isLoading } = useQuery({
    queryKey: ['work-order', id],
    queryFn: async () => {
      const response = await api.get(`/work-orders/${id}`);
      return response.data.data as WorkOrder;
    }
  });

  const { data: storeSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data.data;
    }
  });

  const { data: technicians } = useQuery({
    queryKey: ['technicians'], 
    queryFn: async () => {
        const resp = await api.get('/technicians');
        return resp.data.data;
    }
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
        const resp = await api.get('/products');
        return resp.data.data;
    }
  });

  // Sync cart when WO details loaded
  useEffect(() => {
    if (wo) {
      dispatch({ type: 'SET_INITIAL', services: wo.serviceItems, spareparts: wo.sparepartItems });
      setSelectedTechnicianId(wo.technicianId);
    }
  }, [wo]);

  // --- Mutations ---
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/work-orders/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-order', id] }),
  });

  const updateWorkOrderMutation = useMutation({
    mutationFn: (data: any) => api.put(`/work-orders/${id}`, data),
    onSuccess: () => {
      toast.success('Perubahan berhasil disimpan!');
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menyimpan perubahan')
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/work-orders/${id}/checkout`, payload),
    onSuccess: (resp) => {
      setIsCheckoutOpen(false);
      setLastTransactionData(resp.data?.data);
      setIsSuccessOpen(true);
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal checkout WO')
  });

  // --- Logic ---
  const subtotal = [...cart.services, ...cart.spareparts].reduce((acc, item) => acc + item.subtotal, 0);
  const total = subtotal - parseFloat(discount || '0');

  const handleCheckout = () => {
    const payload = {
        discount: parseFloat(discount || '0'),
        paidAmount: parseFloat(paidAmount || '0'),
        paymentMethod,
        technicianId: selectedTechnicianId,
        serviceItems: cart.services,
        sparepartItems: cart.spareparts
    };
    checkoutMutation.mutate(payload);
  };

  const steps = [
    { id: 'MASUK', label: 'Terima', icon: FileText },
    { id: 'DIKERJAKAN', label: 'Servis', icon: Wrench },
    { id: 'SELESAI', label: 'Selesai', icon: Package },
    { id: 'DIAMBIL', label: 'Diambil', icon: CheckCircle2 }
  ];

  if (isLoading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-blue-600" /></div>;
  if (!wo) return <div className="text-center p-8 bg-white rounded-xl border">Data WO tidak ditemukan.</div>;

  const currentStepIdx = steps.findIndex(s => s.id === wo.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-xl hover:bg-white hover:shadow-sm transition-all" 
                onClick={() => navigate('/work-orders')}
            >
              <ChevronLeft className="h-6 w-6 text-slate-400" />
            </Button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{wo.woNumber}</h1>
                <div className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider",
                    wo.status === 'MASUK' ? "bg-blue-50 text-blue-600 border-blue-100" :
                    wo.status === 'DIKERJAKAN' ? "bg-amber-50 text-amber-600 border-amber-100" :
                    wo.status === 'SELESAI' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                    "bg-slate-100 text-slate-500 border-slate-200"
                )}>
                  {wo.status}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(wo.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="uppercase tracking-widest">{wo.customer.name}</span>
              </div>
            </div>
          </div>
          
          {/* Progress Stepper */}
          <div className="flex items-center gap-1.5 ml-12 mt-1">
            {steps.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                    <React.Fragment key={step.id}>
                        <div className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all",
                            isCurrent ? "bg-white shadow-sm ring-1 ring-slate-200" : ""
                        )}>
                            <div className={cn(
                                "w-4 h-4 rounded-full flex items-center justify-center transition-all",
                                isActive ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-400"
                            )}>
                                <Icon className="h-2.5 w-2.5" />
                            </div>
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-wider",
                                isActive ? "text-slate-700" : "text-slate-300"
                            )}>{step.label}</span>
                        </div>
                        {idx < steps.length - 1 && (
                            <div className={cn("w-4 h-[2px] rounded-full", idx < currentStepIdx ? "bg-blue-200" : "bg-slate-100")}></div>
                        )}
                    </React.Fragment>
                );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {wo.status !== 'DIAMBIL' && (
            <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded-2xl border border-slate-200/50 shadow-sm">
              <Button 
                onClick={() => updateWorkOrderMutation.mutate({ 
                    technicianId: selectedTechnicianId,
                    serviceItems: cart.services, 
                    sparepartItems: cart.spareparts 
                })} 
                variant="ghost" 
                className="h-10 text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-black rounded-xl px-4 transition-all"
                disabled={updateWorkOrderMutation.isPending}
              >
                {updateWorkOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 opacity-50" /> Simpan</div>}
              </Button>

              <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>

              {wo.status === 'MASUK' && (
                <Button onClick={() => updateStatusMutation.mutate('DIKERJAKAN')} variant="outline" className="h-10 text-amber-600 border-amber-200 hover:bg-amber-50 font-black rounded-xl px-5 shadow-sm">
                  Mulai Kerjakan
                </Button>
              )}
              {wo.status === 'DIKERJAKAN' && (
                <Button onClick={() => updateStatusMutation.mutate('SELESAI')} variant="outline" className="h-10 text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-black rounded-xl px-5 shadow-sm">
                  Tandai Selesai
                </Button>
              )}

              <Button onClick={() => setIsCheckoutOpen(true)} className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 px-6 transition-all hover:scale-[1.02] active:scale-95 group">
                Pembayaran <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          )}
          {wo.status === 'DIAMBIL' && (
            <Button onClick={() => setIsReceiptOpen(true)} className="h-12 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl gap-3 px-8 shadow-xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-95">
              <CreditCard className="h-5 w-5" /> Cetak Ulang Kwitansi
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detail Unit & Keluhan */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4 text-slate-500" /> Detail Perangkat</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 text-sm">
                <span className="text-slate-600 font-medium">Pemilik</span>
                <span className="font-bold text-slate-900 text-right">{wo.customer.name}</span>
              </div>
              <div className="grid grid-cols-2 text-sm">
                <span className="text-slate-600 font-medium">Tipe / Merk</span>
                <span className="font-semibold text-slate-900 text-right">{wo.deviceBrand} {wo.deviceType}</span>
              </div>
              {wo.deviceModel && (
                <div className="grid grid-cols-2 text-sm">
                  <span className="text-slate-600 font-medium">Seri Laptop</span>
                  <span className="font-semibold text-slate-900 text-right">{wo.deviceModel}</span>
                </div>
              )}
              {wo.serialNumber && (
                <div className="grid grid-cols-2 text-sm">
                  <span className="text-slate-600 font-medium">S/N</span>
                  <span className="font-mono text-xs text-right bg-slate-100 text-slate-700 px-2 py-0.5 rounded tracking-widest border border-slate-200">{wo.serialNumber}</span>
                </div>
              )}
              <div className="pt-3 border-t border-slate-100">
                 <Label className="text-xs text-slate-500 font-bold uppercase mb-2 block">Keluhan / Masalah</Label>
                 <div className="bg-red-50/80 p-3 rounded-lg text-sm text-red-900 font-bold border border-red-200 shadow-sm min-h-[60px]">
                   {wo.complaints}
                 </div>
              </div>
              <div className="pt-3">
                 <Label className="text-xs text-slate-500 font-bold uppercase mb-2 block">Teknisi Penanggung Jawab</Label>
                 {wo.status !== 'DIAMBIL' ? (
                     <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <select 
                            className="w-full h-11 pl-10 pr-4 bg-slate-50 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                            value={selectedTechnicianId || ''}
                            onChange={(e) => setSelectedTechnicianId(parseInt(e.target.value))}
                        >
                            {technicians?.map((t: any) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-black">↓</div>
                     </div>
                 ) : (
                     <div className="flex items-center gap-2 font-bold text-sm text-slate-800 bg-slate-50/50 p-2 rounded-xl border border-dotted border-slate-200">
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shadow-sm ring-2 ring-blue-100">T</div>
                        {wo.technician.name}
                     </div>
                 )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing & Items Management */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white overflow-hidden shadow-xl border-slate-200 rounded-2xl group/card">
             <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm"><Wrench className="h-4 w-4 text-blue-600" /> Daftar Biaya & Barang</h3>
                {wo.status !== 'DIAMBIL' && (
                    <div className="flex gap-2">
                       <Button size="sm" variant="outline" className="h-9 border-blue-200 text-blue-700 bg-white hover:bg-blue-600 hover:text-white font-bold rounded-xl shadow-sm transition-all" onClick={() => dispatch({ type: 'ADD_SERVICE', name: 'Jasa Servis Baru', price: 0 })}>
                         <Plus className="h-3.5 w-3.5 mr-1.5" /> Jasa
                       </Button>
                       <Button size="sm" variant="outline" className="h-9 border-amber-200 text-amber-700 bg-white hover:bg-amber-600 hover:text-white font-bold rounded-xl shadow-sm transition-all" onClick={() => setIsSparepartSearchOpen(true)}>
                         <Plus className="h-3.5 w-3.5 mr-1.5" /> Barang / Part
                       </Button>
                    </div>
                )}
             </div>
             
             <div className="overflow-x-auto min-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow className="text-[10px] uppercase font-black text-slate-400 tracking-[0.15em] bg-slate-50/30">
                       <TableHead className="pl-6">Deskripsi Item</TableHead>
                       <TableHead className="w-32">Harga (Rp)</TableHead>
                       <TableHead className="w-24 text-center">Unit</TableHead>
                       <TableHead className="text-right pr-6">Subtotal</TableHead>
                       {wo.status !== 'DIAMBIL' && <TableHead className="w-12"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Services */}
                    {cart.services.map((item, idx) => (
                      <TableRow key={`svc-${idx}`} className="group/row hover:bg-slate-50/50 transition-colors">
                        <TableCell className="align-top pt-5 pb-5 pl-6">
                          <div className="flex flex-col items-start gap-2">
                              <Input 
                                className="h-10 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-sm font-bold px-3 rounded-xl bg-white shadow-sm w-full transition-all" 
                                value={item.name} 
                                onChange={(e) => dispatch({ type: 'UPDATE_NAME', index: idx, name: e.target.value })}
                                readOnly={wo.status === 'DIAMBIL'}
                              />
                              <div className="flex items-center gap-2 w-full mt-1.5">
                                <span className="shrink-0 inline-block text-[9px] text-blue-600 font-black bg-blue-50 px-2 py-1 rounded-lg border border-blue-100/50 tracking-wider">JASA</span>
                                <div className="relative flex-1 group/note">
                                   <div className="absolute inset-0 bg-slate-50/50 rounded-lg -m-1 border border-transparent group-focus-within/note:bg-white group-focus-within/note:border-blue-200 group-focus-within/note:shadow-sm transition-all duration-200"></div>
                                   <div className="relative flex items-center px-2 py-0.5">
                                       <Tag className="h-3 w-3 text-slate-300 group-focus-within/note:text-blue-500 transition-colors mr-2" />
                                       <input 
                                         placeholder="Tambahkan catatan (SN, Garansi, dll)..."
                                         className="flex-1 bg-transparent border-none text-[11px] font-semibold text-slate-600 focus:text-slate-900 focus:ring-0 p-0 placeholder:text-slate-300 placeholder:italic transition-colors"
                                         value={item.notes || ''}
                                         onChange={(e) => dispatch({ type: 'UPDATE_NOTES', index: idx, isSparepart: false, notes: e.target.value })}
                                         readOnly={wo.status === 'DIAMBIL'}
                                       />
                                   </div>
                                </div>
                              </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top pt-5 pb-5">
                          <Input 
                            type="number" 
                            className="h-10 text-sm font-black px-3 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl bg-white shadow-sm tabular-nums transition-all" 
                            value={item.price} 
                            onChange={e => dispatch({ type: 'UPDATE_PRICE', index: idx, isSparepart: false, price: parseFloat(e.target.value || '0') })} 
                            readOnly={wo.status === 'DIAMBIL'}
                          />
                        </TableCell>
                        <TableCell className="align-top pt-5 pb-5">
                           <div className="flex items-center justify-center gap-2 h-10">
                              {wo.status !== 'DIAMBIL' && <button onClick={() => dispatch({ type: 'UPDATE_QTY', index: idx, isSparepart: false, qty: item.qty - 1 })} className="p-1 hover:bg-slate-100 rounded-lg text-slate-300 hover:text-slate-600 transition-colors"><Minus className="h-3.5 w-3.5"/></button>}
                              <span className="text-sm font-black w-6 text-center tabular-nums">{item.qty}</span>
                              {wo.status !== 'DIAMBIL' && <button onClick={() => dispatch({ type: 'UPDATE_QTY', index: idx, isSparepart: false, qty: item.qty + 1 })} className="p-1 hover:bg-slate-100 rounded-lg text-slate-300 hover:text-slate-600 transition-colors"><Plus className="h-3.5 w-3.5" /></button>}
                           </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-base text-slate-900 tabular-nums align-top pt-5 pb-5 pr-6 tracking-tight">
                           <div className="h-10 flex flex-col justify-center">Rp {item.subtotal.toLocaleString("id-ID")}</div>
                        </TableCell>
                        {wo.status !== 'DIAMBIL' && (
                            <TableCell className="align-top pt-5 pb-5 pr-4">
                                <button onClick={() => dispatch({ type: 'REMOVE_ITEM', index: idx, isSparepart: false })} className="opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-red-500 transition-all h-10 flex flex-col justify-center">
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </TableCell>
                        )}
                      </TableRow>
                    ))}

                    {/* Spareparts */}
                    {cart.spareparts.map((item, idx) => (
                      <TableRow key={`sp-${idx}`} className="group/row bg-amber-50/20 hover:bg-amber-50/40 transition-colors">
                        <TableCell className="align-top pt-5 pb-5 pl-6">
                          <div className="flex flex-col items-start gap-2">
                              <div className="h-10 flex items-center">
                                  <p className="text-sm font-black text-slate-800">{item.name}</p>
                              </div>
                              <div className="flex items-center gap-2 w-full mt-1.5">
                                <span className="shrink-0 inline-block text-[9px] text-amber-700 font-black bg-amber-100 px-2 py-1 rounded-lg border border-amber-200/50 tracking-wider">BARANG / PART</span>
                                <div className="relative flex-1 group/note">
                                   <div className="absolute inset-0 bg-amber-50/50 rounded-lg -m-1 border border-transparent group-focus-within/note:bg-white group-focus-within/note:border-amber-200 group-focus-within/note:shadow-sm transition-all duration-200"></div>
                                   <div className="relative flex items-center px-2 py-0.5">
                                       <Tag className="h-3 w-3 text-amber-300 group-focus-within/note:text-amber-500 transition-colors mr-2" />
                                       <input 
                                         placeholder="Tambahkan catatan (SN, Garansi, dll)..."
                                         className="flex-1 bg-transparent border-none text-[11px] font-semibold text-amber-900/60 focus:text-amber-900 focus:ring-0 p-0 placeholder:text-amber-300 placeholder:italic transition-colors"
                                         value={item.notes || ''}
                                         onChange={(e) => dispatch({ type: 'UPDATE_NOTES', index: idx, isSparepart: true, notes: e.target.value })}
                                         readOnly={wo.status === 'DIAMBIL'}
                                       />
                                   </div>
                                </div>
                              </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top pt-5 pb-5">
                          <Input 
                            type="number" 
                            className="h-10 text-sm font-black px-3 border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-xl bg-white shadow-sm tabular-nums transition-all" 
                            value={item.price} 
                            onChange={e => dispatch({ type: 'UPDATE_PRICE', index: idx, isSparepart: true, price: parseFloat(e.target.value || '0') })} 
                            readOnly={wo.status === 'DIAMBIL'}
                          />
                        </TableCell>
                        <TableCell className="align-top pt-5 pb-5">
                           <div className="flex items-center justify-center gap-2 h-10">
                              {wo.status !== 'DIAMBIL' && <button onClick={() => dispatch({ type: 'UPDATE_QTY', index: idx, isSparepart: true, qty: item.qty - 1 })} className="p-1 hover:bg-amber-100 rounded-lg text-amber-300 hover:text-amber-600 transition-colors"><Minus className="h-3.5 w-3.5"/></button>}
                              <span className="text-sm font-black w-6 text-center tabular-nums">{item.qty}</span>
                              {wo.status !== 'DIAMBIL' && <button onClick={() => dispatch({ type: 'UPDATE_QTY', index: idx, isSparepart: true, qty: item.qty + 1 })} className="p-1 hover:bg-amber-100 rounded-lg text-amber-300 hover:text-amber-600 transition-colors"><Plus className="h-3.5 w-3.5" /></button>}
                           </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-base text-amber-900 tabular-nums align-top pt-5 pb-5 pr-6 tracking-tight">
                           <div className="h-10 flex flex-col justify-center">Rp {item.subtotal.toLocaleString("id-ID")}</div>
                        </TableCell>
                        {wo.status !== 'DIAMBIL' && (
                            <TableCell className="align-top pt-5 pb-5 pr-4">
                                <button onClick={() => dispatch({ type: 'REMOVE_ITEM', index: idx, isSparepart: true })} className="opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-red-500 transition-all h-10 flex flex-col justify-center">
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </TableCell>
                        )}
                      </TableRow>
                    ))}

                    {cart.services.length === 0 && cart.spareparts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center text-slate-300 font-medium italic text-xs">
                          <div className="flex flex-col items-center gap-2">
                             <Wrench className="h-8 w-8 opacity-20" />
                             <p>Belum ada rincian biaya.<br/>Tambahkan Jasa atau Barang untuk memulai.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
             </div>

             <div className="p-6 bg-slate-900 text-white flex justify-between items-center rounded-b-2xl shadow-inner border-t border-slate-800">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-none mb-2">Estimasi Total Tagihan</span>
                    <span className="text-3xl font-black tabular-nums tracking-tighter">Rp {total.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex gap-3">
                    {wo.status !== 'DIAMBIL' ? (
                        <>
                            <Button 
                                className="bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl h-14 px-10 shadow-2xl shadow-blue-900/40 transition-all hover:scale-[1.02] active:scale-95 group"
                                onClick={() => setIsCheckoutOpen(true)}
                            >
                                Proses Pembayaran <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </>
                    ) : (
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl h-14 px-10 flex items-center gap-3 shadow-2xl shadow-emerald-900/40 transition-all hover:scale-[1.02] active:scale-95"
                            onClick={() => setIsReceiptOpen(true)}
                        >
                            <CreditCard className="h-6 w-6" /> Cetak Ulang Kwitansi
                        </Button>
                    )}
                </div>
             </div>
          </Card>
        </div>
      </div>

      {/* Sparepart Search Modal */}
      <Modal 
        isOpen={isSparepartSearchOpen} 
        onClose={() => setIsSparepartSearchOpen(false)} 
        title="Ambil Suku Cadang (Stok DB)"
        description="Pilih komponen atau barang dari inventori untuk ditambahkan ke biaya servis."
      >
        <div className="space-y-5">
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <Input 
                autoFocus
                placeholder="Cari nama barang atau SKU..." 
                className="pl-12 h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium" 
                value={sparepartSearch}
                onChange={e => setSparepartSearch(e.target.value)}
              />
           </div>
           
           <div className="max-h-[450px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {products?.filter((p: any) => 
                p.stock > 0 && 
                (p.name.toLowerCase().includes(sparepartSearch.toLowerCase()) || 
                 p.sku?.toLowerCase().includes(sparepartSearch.toLowerCase()))
              ).length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                    <Search className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm font-medium">Produk tidak ditemukan atau stok habis.</p>
                </div>
              ) : (
                products?.filter((p: any) => 
                  p.stock > 0 && 
                  (p.name.toLowerCase().includes(sparepartSearch.toLowerCase()) || 
                   p.sku?.toLowerCase().includes(sparepartSearch.toLowerCase()))
                ).map((p: any) => (
                  <div 
                      key={p.id} 
                      className="group flex flex-col p-4 border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                      onClick={() => {
                          dispatch({ type: 'ADD_SPAREPART', productId: p.id, name: p.name, price: p.price });
                          setIsSparepartSearchOpen(false);
                          setSparepartSearch('');
                      }}
                  >
                      <div className="flex justify-between items-start mb-3">
                          <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                      {p.category?.name || 'PART'}
                                  </span>
                                  {p.sku && <code className="text-[9px] font-mono font-bold text-slate-400">#{p.sku}</code>}
                              </div>
                              <h4 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{p.name}</h4>
                          </div>
                          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-50 group-hover:bg-blue-600 group-hover:text-white transition-all">
                              <Plus className="h-5 w-5" />
                          </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                          <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">Harga Satuan</span>
                              <span className="text-base font-black text-slate-900 tabular-nums">Rp {p.price.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-400">Tersedia:</span>
                              <span className={cn(
                                  "px-3 py-1 rounded-lg text-xs font-black tabular-nums border shadow-sm",
                                  p.stock <= (p.minStock || 5) 
                                    ? "bg-amber-50 text-amber-600 border-amber-100" 
                                    : "bg-v2-green/10 text-v2-green border-v2-green/20"
                              )}>
                                  {p.stock} Unit
                              </span>
                          </div>
                      </div>
                  </div>
                ))
              )}
           </div>
        </div>
      </Modal>

      {/* Checkout Modal */}
      <Modal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        title="Finalisasi & Serah Terima"
        description="Pastikan semua biaya servis dan barang sudah tertera dengan benar."
      >
        <div className="space-y-6">
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Metode Pembayaran</Label>
                <div className="grid grid-cols-3 gap-3">
                    <button 
                        onClick={() => setPaymentMethod('cash')}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 h-16 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-[0.1em]",
                            paymentMethod === 'cash' ? "border-emerald-600 bg-emerald-50 text-emerald-600" : "border-slate-100 hover:bg-slate-50 text-slate-400"
                        )}
                    >
                        <Banknote className="h-5 w-5" /> Tunai
                    </button>
                    <button 
                        onClick={() => setPaymentMethod('transfer')}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 h-16 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-[0.1em]",
                            paymentMethod === 'transfer' ? "border-emerald-600 bg-emerald-50 text-emerald-600" : "border-slate-100 hover:bg-slate-50 text-slate-400"
                        )}
                    >
                        <CreditCard className="h-5 w-5" /> Bank
                    </button>
                    <button 
                        onClick={() => setPaymentMethod('qris')}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 h-16 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-[0.1em]",
                            paymentMethod === 'qris' ? "border-emerald-600 bg-emerald-50 text-emerald-600" : "border-slate-100 hover:bg-slate-50 text-slate-400"
                        )}
                    >
                        <Package className="h-5 w-5" /> QRIS
                    </button>
                </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl space-y-4 border border-slate-100">
                 <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Potongan Diskon</Label>
                    <Input 
                        type="number" 
                        className="w-32 h-10 text-right font-black text-base rounded-xl border-slate-200" 
                        value={discount}
                        onChange={e => setDiscount(e.target.value)}
                    />
                 </div>
                 <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">TOTAL TAGIHAN</span>
                    <span className="text-3xl font-black text-v1-orange tabular-nums">Rp {total.toLocaleString("id-ID")}</span>
                 </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                     <div className="h-[2px] flex-1 bg-slate-100"></div>
                     <Label className="text-[10px] font-black text-v1-green uppercase tracking-[0.4em]">NOMINAL BAYAR</Label>
                     <div className="h-[2px] flex-1 bg-slate-100"></div>
                </div>
                <Input 
                    type="number" 
                    className="h-24 text-5xl font-black text-center border-emerald-600/20 focus:ring-emerald-600 bg-slate-50 rounded-2xl tabular-nums shadow-inner" 
                    placeholder="0"
                    autoFocus
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                />
                
                {/* Quick Cash Buttons */}
                <div className="grid grid-cols-5 gap-2">
                    {[10000, 20000, 50000, 100000].map(amount => (
                        <Button 
                            key={amount}
                            type="button"
                            variant="outline" 
                            className="h-10 text-[10px] font-black rounded-xl border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 tabular-nums"
                            onClick={() => setPaidAmount(amount.toString())}
                        >
                            {amount >= 1000 ? `${amount/1000}rb` : amount}
                        </Button>
                    ))}
                    <Button 
                        type="button" 
                        variant="outline" 
                        className="h-10 text-[10px] font-black rounded-xl border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 uppercase tracking-widest"
                        onClick={() => setPaidAmount(total.toString())}
                    >
                        Pas
                    </Button>
                </div>
                <div className="flex justify-between text-[11px] font-black px-1">
                    {(parseFloat(paidAmount || '0') - total) >= 0 ? (
                        <span className="flex items-center gap-1 text-emerald-600 uppercase tracking-widest">
                            <CheckCircle2 className="h-4 w-4" /> KEMBALIAN: Rp {(parseFloat(paidAmount || '0') - total).toLocaleString("id-ID")}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-red-600 uppercase tracking-widest animate-pulse">
                            <AlertCircle className="h-4 w-4" /> PIUTANG: Rp {Math.abs(parseFloat(paidAmount || '0') - total).toLocaleString("id-ID")}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex gap-4 pt-2">
                <Button variant="outline" className="flex-1 h-14 font-black rounded-2xl text-slate-400 hover:bg-slate-50 border-slate-100" onClick={() => setIsCheckoutOpen(false)}>Batal</Button>
                <Button 
                    className="flex-[2] h-14 text-base font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50"
                    disabled={checkoutMutation.isPending || total <= 0 || (paymentMethod === 'cash' && parseFloat(paidAmount || '0') < total)}
                    onClick={handleCheckout}
                >
                    {checkoutMutation.isPending ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <div className="flex items-center gap-2"><span>Selesaikan & Serahkan</span> <ArrowRight className="h-4 w-4" /></div>}
                </Button>
            </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal 
        isOpen={isSuccessOpen} 
        onClose={() => setIsSuccessOpen(false)} 
        title=""
        description=""
      >
        <div className="flex flex-col items-center justify-center py-10 space-y-8 animate-in zoom-in-95 fade-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                <div className="relative h-28 w-28 bg-emerald-500 flex items-center justify-center rounded-full shadow-2xl shadow-emerald-500/50">
                    <CheckCircle2 className="h-16 w-16 text-white" />
                </div>
            </div>

            <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Checkout Berhasil!</h2>
                <p className="text-slate-500 text-sm max-w-[280px] mx-auto font-medium">Jasa Service telah diselesaikan dan kwitansi pembayaran siap dicetak.</p>
            </div>

            <div className="w-full space-y-3 pt-4">
                <Button 
                    className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-slate-200"
                    onClick={() => setIsReceiptOpen(true)}
                >
                   <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Lihat & Cetak Struk
                </Button>
                <Button 
                    variant="outline"
                    className="w-full h-14 bg-slate-50 hover:bg-slate-100 text-slate-600 font-black rounded-2xl border-none transition-all"
                    onClick={() => navigate('/work-order')}
                >
                    Kembali ke Daftar WO
                </Button>
            </div>
        </div>
      </Modal>

      {/* Receipt Modal (Kwitansi A5 Horizontal) */}
      <Modal 
        isOpen={isReceiptOpen} 
        onClose={() => setIsReceiptOpen(false)} 
        title="Pratinjau Kwitansi"
        description="Format cetak A5 Landscape (Horizontal)."
        className="!max-w-[1100px] w-[95vw] bg-slate-50/98 backdrop-blur-3xl ring-1 ring-white/20 border-none rounded-[40px] p-0 overflow-hidden shadow-2xl"
      >
        <div className="flex flex-col items-center p-0 overflow-hidden">
            <div className="w-full bg-slate-100/50 p-6 md:p-12 flex justify-center border-y border-slate-200/50 shadow-inner overflow-x-hidden overflow-y-auto max-h-[75vh] custom-scrollbar">
                <div id="a5-nota" className="w-[850px] min-h-[600px] bg-white p-16 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.15)] border border-white font-sans text-xs text-slate-800 leading-normal space-y-10 flex-shrink-0 animate-in fade-in zoom-in-95 duration-700 origin-top">
                    <style>{`
                        @media print {
                            @page { size: A5 landscape; margin: 0; }
                            html, body, #root, main, .flex-1, .flex, [role="dialog"], .relative {
                                margin: 0 !important; padding: 0 !important; height: auto !important; width: 100% !important; overflow: visible !important; visibility: visible !important; display: block !important; background: white !important; position: static !important; opacity: 1 !important; transform: none !important; border: none !important; box-shadow: none !important;
                            }
                            .no-print, nav, aside, header, button, .modal-backdrop, [role="dialog"] > div:first-child { display: none !important; visibility: hidden !important; }
                            #a5-nota { 
                                visibility: visible !important; display: block !important; position: fixed !important; left: 0 !important; top: 0 !important; width: 210mm !important; height: 148mm !important; padding: 10mm !important; background: white !important; font-size: 11pt !important; z-index: 9999999 !important; -webkit-print-color-adjust: exact; border: none !important; box-shadow: none !important;
                            }
                            #a5-nota * { visibility: visible !important; }
                            #a5-nota .grid { display: grid !important; }
                            #a5-nota .flex { display: flex !important; }
                            #a5-nota table { width: 100% !important; border-collapse: collapse !important; }
                            #a5-nota h3, #a5-nota h4, #a5-nota td, #a5-nota th { color: black !important; }
                        }
                    `}</style>
                    
                    <div className="grid grid-cols-2 items-start text-[14px]">
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-slate-900 leading-none mb-1">{storeSettings?.STORE_NAME || 'CENTRAL COMPUTER'}</h3>
                            <p className="text-slate-500 font-medium leading-normal text-[11px] whitespace-pre-line">
                                {storeSettings?.STORE_ADDRESS || 'Jl. Raya Demo No. 123, Blok C4\nJakarta Barat'}
                                <br/>
                                Telp/WA: {storeSettings?.STORE_PHONE || '08123456789'}
                            </p>
                        </div>
                        <div className="text-right space-y-1">
                            <h4 className="text-2xl font-black text-slate-300 uppercase tracking-tighter">Kwitansi</h4>
                            <div className="space-y-0.5 text-[11px] text-slate-600 font-semibold border-t-2 border-slate-100 pt-2 inline-block text-left">
                                <div className="flex justify-between gap-8">
                                    <span>No. WO :</span>
                                    <span className="text-slate-900 font-black">#{wo?.woNumber}</span>
                                </div>
                                <div className="flex justify-between gap-8">
                                    <span>Tanggal :</span>
                                    <span className="text-slate-900 font-black">{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                </div>
                                <div className="flex justify-between gap-8">
                                    <span>Customer :</span>
                                    <span className="text-slate-900 font-black">{wo?.customer?.name || 'UMUM'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1 font-bold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px]">
                        <span className="text-slate-400 font-black text-[9px]">UNIT: </span>
                        <span className="uppercase">{wo?.deviceBrand} {wo?.deviceModel} ({wo?.serialNumber || '-'})</span>
                    </div>

                    <table className="w-full text-left border-collapse border-y-2 border-slate-900">
                        <thead>
                            <tr className="bg-slate-950 text-white uppercase text-[9px] tracking-widest font-black">
                                <th className="py-2 px-3 border-r border-slate-800 w-10 text-center">NO</th>
                                <th className="py-2 px-3 border-r border-slate-800 text-[10px]">NAMA JASA / BARANG</th>
                                <th className="py-2 px-3 border-r border-slate-800 w-16 text-center">QTY</th>
                                <th className="py-2 px-3 border-r border-slate-800 text-right">HARGA (Rp)</th>
                                <th className="py-2 px-3 text-right">TOTAL (Rp)</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] font-semibold">
                            {[...cart.services, ...cart.spareparts].map((item: any, index) => (
                                <tr key={index} className="border-b border-slate-100">
                                    <td className="py-2 px-3 border-r border-slate-100 text-center">{index + 1}</td>
                                    <td className="py-2 px-3 border-r border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900">{item.name}</span>
                                            {item.notes && <span className="text-[9px] text-slate-500 italic leading-none mt-1 bg-slate-50 p-1 rounded-sm border border-slate-100/50">Catatan: {item.notes}</span>}
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 border-r border-slate-100 text-center tabular-nums">{item.qty || 1}</td>
                                    <td className="py-2 px-3 border-r border-slate-100 text-right tabular-nums">{item.price.toLocaleString("id-ID")}</td>
                                    <td className="py-2 px-3 text-right tabular-nums font-black">{(item.price * (item.qty || 1)).toLocaleString("id-ID")}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="grid grid-cols-2 gap-10 items-end">
                        <div className="grid grid-cols-2 text-center text-[10px] uppercase font-black text-slate-400 gap-4 h-24">
                            <div className="flex flex-col justify-between items-center border border-dashed border-slate-200 p-2 rounded-xl">
                                <span className="text-[8px]">Tanda Terima</span>
                                <div className="w-24 border-b border-slate-200 mb-1"></div>
                            </div>
                            <div className="flex flex-col justify-between items-center bg-slate-50 p-2 rounded-xl">
                                <span className="text-[8px]">Hormat Kami</span>
                                <div className="w-24 border-b border-slate-300 mb-1"></div>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-bold text-slate-400 uppercase text-[9px]">Subtotal:</span>
                                <span className="font-black tabular-nums">Rp {subtotal.toLocaleString("id-ID")}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-bold text-slate-400 uppercase text-[9px]">Potongan:</span>
                                <span className="font-black text-red-500 tabular-nums">-Rp {parseFloat(discount || '0').toLocaleString("id-ID")}</span>
                            </div>
                            <div className="flex justify-between border-t-2 border-slate-900 pt-3 mt-2 text-slate-900">
                                <span className="font-black uppercase tracking-tight text-[11px]">Grand Total:</span>
                                <span className="text-xl font-black tabular-nums">Rp {total.toLocaleString("id-ID")}</span>
                            </div>
                            <div className="flex justify-between text-[10px] pt-1 px-1">
                                <span className="font-bold text-slate-400 uppercase italic text-[8px]">Metode Bayar: {paymentMethod.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-center pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] italic border-t border-dashed border-slate-100">
                        {storeSettings?.RECEIPT_FOOTER || 'Bukti pembayaran servis ini sah. Terima kasih.'}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between w-full p-8 bg-white/50 backdrop-blur-sm no-print border-t border-slate-100">
                <Button variant="ghost" className="h-14 px-10 text-slate-400 hover:text-slate-600 font-bold rounded-2xl transition-all" onClick={() => setIsReceiptOpen(false)}>Tutup Pratinjau</Button>
                <Button 
                    className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl gap-3 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] px-12 group transition-all hover:scale-[1.02] active:scale-95"
                    onClick={() => {
                        const printContent = document.getElementById('a5-nota')?.innerHTML;
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                            let allCss = '';
                            try {
                                for (let i = 0; i < document.styleSheets.length; i++) {
                                    const sheet = document.styleSheets[i];
                                    try {
                                        const rules = sheet.cssRules || sheet.rules;
                                        for (let j = 0; j < rules.length; j++) allCss += rules[j].cssText + '\n';
                                    } catch (e) {}
                                }
                            } catch (e) {}
                            printWindow.document.write(`
                                <html>
                                    <head>
                                        <title>&nbsp;</title>
                                        <style>
                                            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
                                            @page { size: A5 landscape; margin: 0 !important; }
                                            body { margin: 0 !important; padding: 0 !important; background: white !important; font-family: 'Inter', sans-serif; }
                                            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                                            .print-container { width: 210mm; height: 148mm; padding: 10mm; position: relative; visibility: visible !important; display: block !important; }
                                            table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; }
                                            ${allCss}
                                        </style>
                                    </head>
                                    <body><div id="a5-nota" class="print-container">${printContent}</div>
                                        <script>window.onload = () => { setTimeout(() => { window.print(); window.onafterprint = () => window.close(); }, 1000); };</script>
                                    </body>
                                </html>
                            `);
                            printWindow.document.close();
                        }
                    }}
                >
                    <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" /> Cetak Kwitansi Sekarang
                </Button>
            </div>
        </div>
      </Modal>
    </div>
  );
}
