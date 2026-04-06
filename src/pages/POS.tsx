import React, { useState, useReducer, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  ShoppingCart, 
  User, 
  Users, 
  CreditCard, 
  Banknote, 
  Loader2, 
  ChevronRight,
  Package,
  X,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Info
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card.js';
import { Modal } from '../components/ui/modal.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.js';

// --- Types ---
interface Product {
  id: number;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  categoryId: number;
  category: { name: string };
}

interface CartItem {
  productId: number;
  name: string;
  qty: number;
  price: number;
  discount: number;
  subtotal: number;
  notes?: string;
}

type CartAction = 
  | { type: 'ADD_ITEM'; product: Product }
  | { type: 'UPDATE_QTY'; productId: number; qty: number }
  | { type: 'UPDATE_DISCOUNT'; productId: number; discount: number }
  | { type: 'UPDATE_NOTES'; productId: number; notes: string }
  | { type: 'REMOVE_ITEM'; productId: number }
  | { type: 'CLEAR_CART' };

// --- Cart Reducer ---
function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.find(item => item.productId === action.product.id);
      if (existing) {
        return state.map(item => 
          item.productId === action.product.id 
            ? { ...item, qty: item.qty + 1, subtotal: (item.qty + 1) * item.price - item.discount }
            : item
        );
      }
      return [...state, {
        productId: action.product.id,
        name: action.product.name,
        qty: 1,
        price: action.product.price,
        discount: 0,
        subtotal: action.product.price
      }];
    }
    case 'UPDATE_QTY': {
      if (action.qty < 1) {
        return state.filter(item => item.productId !== action.productId);
      }
      return state.map(item => 
        item.productId === action.productId 
          ? { ...item, qty: action.qty, subtotal: (action.qty * item.price) - item.discount } 
          : item
      );
    }
    case 'UPDATE_DISCOUNT':
      return state.map(item => 
        item.productId === action.productId 
          ? { ...item, discount: action.discount, subtotal: (item.qty * item.price) - action.discount } 
          : item
      );
    case 'UPDATE_NOTES':
      return state.map(item =>
        item.productId === action.productId ? { ...item, notes: action.notes } : item
      );
    case 'REMOVE_ITEM':
      return state.filter(item => item.productId !== action.productId);
    case 'CLEAR_CART':
      return [];
    default:
      return state;
  }
}

export default function POS() {
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Checkout States
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastTransactionData, setLastTransactionData] = useState<any>(null);
  const [customerId, setCustomerId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountTotal, setDiscountTotal] = useState('0');
  
  // Quick Customer Creation
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Queries ---
  const { data: activeShift, isLoading: shiftLoading } = useQuery({
    queryKey: ['activeShift'],
    queryFn: async () => {
      const response = await api.get('/shifts/active');
      return response.data.data;
    },
  });

  const { data: storeSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data.data;
    }
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const resp = await api.get('/products');
      return resp.data.data as Product[];
    }
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const resp = await api.get('/categories');
      return resp.data.data;
    }
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const resp = await api.get('/customers');
      return resp.data.data;
    }
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const resp = await api.get('/agents');
      return resp.data.data;
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload: any) => api.post('/transactions', payload),
    onSuccess: (resp) => {
      setIsCheckoutOpen(false);
      setLastTransactionData(resp.data?.data);
      setIsSuccessOpen(true);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['activeShift'] });
    },
    onError: (err: any) => {
       toast.error(err.response?.data?.message || 'Gagal memproses transaksi');
    }
  });

  const createCustomerMutation = useMutation({
    mutationFn: (payload: any) => api.post('/customers', payload),
    onSuccess: (resp) => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        setCustomerId(resp.data.data.id.toString());
        setIsCreatingCustomer(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        toast.success('Pelanggan berhasil ditambahkan');
    },
    onError: (err: any) => {
        toast.error(err.response?.data?.message || 'Gagal menambahkan data pelanggan');
    }
  });

  // --- Logic ---
  useEffect(() => {
    if (!shiftLoading && !activeShift) {
      toast.error('Shift belum dibuka. Silakan buka shift terlebih dahulu.');
      navigate('/finance');
    }
  }, [activeShift, shiftLoading]);

  const handleNewTransaction = () => {
    dispatch({ type: 'CLEAR_CART' });
    setCustomerId('');
    setAgentId('');
    setPaidAmount('');
    setPaymentMethod('cash');
    setDiscountTotal('0');
    setIsSuccessOpen(false);
    setLastTransactionData(null);
    setIsCreatingCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const finalTotal = cartSubtotal - parseFloat(discountTotal || '0');
  const changeAmount = parseFloat(paidAmount || '0') - finalTotal;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    
    // Validasi piutang
    if (parseFloat(paidAmount || '0') < finalTotal && !customerId) {
        toast.error('Penjualan Piutang wajib memilih data Pelanggan!');
        return;
    }

    const payload = {
        customerId: customerId || null,
        agentId: agentId || null,
        discountItem: 0, // Kami hitung di tingkat item subtotal
        discountTotal: parseFloat(discountTotal || '0'),
        paidAmount: parseFloat(paidAmount || '0'),
        paymentMethod,
        items: cart.map(item => ({
            productId: item.productId,
            qty: item.qty,
            price: item.price,
            discount: item.discount,
            subtotal: item.subtotal,
            notes: item.notes || ""
        }))
    };

    checkoutMutation.mutate(payload);
  };

  const filteredProducts = products?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory ? p.categoryId === selectedCategory : true;
    return matchesSearch && matchesCat;
  });

  if (shiftLoading || productsLoading) {
    return (
        <div className="min-h-[400px] flex items-center justify-center">
            <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
        </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Kiri: Browser Produk */}
      <div className="flex-1 flex flex-col min-w-0 space-y-6 no-print">
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kasir Toko</h1>
          <p className="text-slate-500 font-medium text-sm">Pilih produk atau jasa untuk ditambahkan ke keranjang.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-5 items-center">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-v2-green transition-colors" />
            <Input 
                placeholder="Cari produk atau jasa..." 
                className="pl-14 h-14 bg-white border-transparent shadow-sm rounded-2xl text-base placeholder:text-slate-300 focus:ring-4 focus:ring-v2-green/5 focus:border-v2-green/20 focus:bg-white transition-all font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 gap-1.5 self-start md:self-center overflow-x-auto max-w-full no-scrollbar scroll-smooth">
            <button 
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                selectedCategory === null ? "bg-v2-noir text-white shadow-lg shadow-slate-900/20 scale-105" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              Semua
            </button>
            {categories?.map((c: any) => (
              <button 
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={cn(
                  "px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                  selectedCategory === c.id ? "bg-v2-noir text-white shadow-lg shadow-slate-900/20 scale-105" : "text-slate-400 hover:bg-slate-50"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 min-[1600px]:grid-cols-3 2xl:grid-cols-4 gap-8 pr-3 -mx-3 p-3 no-scrollbar">
            {filteredProducts?.map(product => (
                <div 
                    key={product.id} 
                    className={cn(
                        "glass-card group relative cursor-pointer hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-v2-green/40 transition-all duration-500 rounded-[2.5rem] p-7 flex flex-col h-full bg-white/80 active:scale-95 overflow-hidden",
                        product.stock <= 0 ? "opacity-50 grayscale pointer-events-none" : ""
                    )}
                    onClick={() => dispatch({ type: 'ADD_ITEM', product })}
                >
                    <div className="mb-4 flex justify-between items-start relative z-10">
                         <code className="text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] bg-slate-50 px-2 py-0.5 rounded-md">{product.sku || 'N/A'}</code>
                         <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                            {product.category.name}
                         </div>
                    </div>
                    
                    <h4 className="font-black text-lg text-slate-800 leading-tight mb-5 group-hover:text-v2-green transition-colors line-clamp-2 min-h-[3rem] tracking-tight relative z-10">
                      {product.name}
                    </h4>
                    
                    <div className="mb-7 relative z-10">
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 opacity-60">Harga</div>
                       <div className="text-2xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">
                         Rp {product.price.toLocaleString("id-ID")}
                       </div>
                    </div>

                    <div className="mt-auto pt-5 border-t border-slate-100/60 flex justify-between items-center relative z-10">
                         <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.15em] text-slate-500">
                            <div className={cn("w-2 h-2 rounded-full", product.stock < 10 ? "bg-red-500 animate-pulse glow-red" : "bg-emerald-500 glow-emerald")}></div>
                            Stok: <span className="text-slate-900 font-black">{product.stock}</span>
                         </div>
                         <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20 group-hover:bg-v2-green group-hover:shadow-emerald-500/30 transition-all duration-300 group-hover:scale-110">
                            <Plus className="w-5 h-5 fill-current" />
                         </div>
                    </div>

                    {/* Decorative Background Glow */}
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                </div>
            ))}
        </div>
      </div>

      {/* Kanan: Keranjang Belanja */}
      <div className="w-full lg:w-[340px] 2xl:w-[400px] flex flex-col min-w-0 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden h-full no-print">
        <div className="p-8 bg-white border-b border-slate-50">
            <div className="flex items-center gap-3 mb-1">
                <ShoppingCart className="h-6 w-6 text-v1-green font-black" />
                <h3 className="font-black text-xl text-slate-900 tracking-tight">Keranjang Belanja</h3>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Order #ORD-{new Date().getTime().toString().slice(-4)}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
            {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-200 space-y-6 py-12">
                    <div className="w-20 h-20 rounded-[2rem] bg-slate-50 flex items-center justify-center border border-slate-100 rotate-12">
                      <ShoppingCart className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="font-black text-slate-400 uppercase text-[9px] tracking-[0.4em] text-center px-10 leading-loose">Pilih barang untuk transaksi</p>
                </div>
            ) : (
                cart.map(item => {
                  const productRef = products?.find(p => p.id === item.productId);
                  const isMaxStock = item.qty >= (productRef?.stock || 0);

                  return (
                    <div key={item.productId} className="group relative bg-white p-4 rounded-3xl hover:bg-slate-50 transition-all duration-300 border border-slate-100 shadow-sm hover:shadow-md animate-in slide-in-from-right-2">
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-start gap-3">
                                <h5 className="text-xs font-black text-slate-800 leading-normal line-clamp-2 flex-1">
                                    {item.name}
                                </h5>
                                <button 
                                    onClick={() => dispatch({ type: 'REMOVE_ITEM', productId: item.productId })} 
                                    className="p-1.5 hover:bg-red-50 text-red-300 hover:text-red-500 rounded-xl transition-all"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                    <p className="text-[12px] font-black text-slate-900 tabular-nums tracking-tight">
                                        Rp{item.subtotal.toLocaleString("id-ID")}
                                    </p>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                        @{item.price.toLocaleString("id-ID")}
                                    </p>
                                </div>

                                <div className="flex items-center h-9 bg-slate-900 rounded-2xl p-1 shadow-lg shadow-slate-900/10">
                                    <button 
                                        onClick={() => dispatch({ type: 'UPDATE_QTY', productId: item.productId, qty: item.qty - 1 })} 
                                        className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                                    >
                                        {item.qty === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                                    </button>
                                    <div className="w-8 text-center text-[12px] font-black text-white tabular-nums">
                                        {item.qty}
                                    </div>
                                    <button 
                                        disabled={isMaxStock}
                                        onClick={() => dispatch({ type: 'UPDATE_QTY', productId: item.productId, qty: item.qty + 1 })} 
                                        className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-white transition-all disabled:opacity-20"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="relative group/note">
                                <input 
                                    type="text"
                                    placeholder="Serial / Garansi / Note..."
                                    value={item.notes || ""}
                                    onChange={(e) => dispatch({ type: 'UPDATE_NOTES', productId: item.productId, notes: e.target.value })}
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-bold text-slate-600 placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-v2-green/10 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                  );
                })
            )}
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-slate-400 uppercase tracking-widest">Subtotal</span>
                  <span className="font-black text-slate-900 tabular-nums">Rp {cartSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-slate-400 uppercase tracking-widest">PPN (0%)</span>
                  <span className="font-black text-slate-900">Rp 0</span>
              </div>
            </div>

            {/* Promo Code Section Removed per User Request */}
            
            <div className="flex justify-between items-end pt-2">
               <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Total</span>
               <span className="text-4xl font-black text-v1-green tracking-tighter tabular-nums shadow-green-500/10 [text-shadow:_0_4px_12px_rgb(34_197_94_/_20%)]">Rp {finalTotal.toLocaleString("id-ID")}</span>
            </div>

            <Button 
                className="w-full h-16 text-lg font-black flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 shadow-xl rounded-2xl transition-all active:scale-[0.95] disabled:opacity-30 disabled:grayscale border-none"
                disabled={cart.length === 0}
                onClick={() => setIsCheckoutOpen(true)}
            >
                <CheckCircle2 className="w-6 h-6" />
                Selesaikan Bayar
            </Button>
        </div>
      </div>

      {/* Checkout Modal */}
      <Modal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        title="Konfirmasi Pembayaran"
        description={`Menyelesaikan transaksi untuk ${cart.length} item.`}
        className="no-print"
      >
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span className="flex items-center gap-2"><User className="h-3 w-3" /> Pelanggan</span>
                        {!isCreatingCustomer && (
                            <button 
                                type="button"
                                className="text-emerald-600 flex items-center gap-1 hover:underline tracking-tight" 
                                onClick={() => setIsCreatingCustomer(true)}
                            >
                                <Plus className="h-3 w-3" /> Pelanggan Baru
                            </button>
                        )}
                    </Label>
                    
                    {isCreatingCustomer ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 relative animate-in slide-in-from-top-2">
                            <button type="button" onClick={() => setIsCreatingCustomer(false)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><X className="h-4 w-4"/></button>
                            <div className="space-y-1.5 mt-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Nama Lengkap</Label>
                                <Input 
                                    className="h-9 text-xs bg-white border-slate-200" 
                                    placeholder="Wajib diisi..." 
                                    value={newCustomerName} 
                                    onChange={e => setNewCustomerName(e.target.value)} 
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">No. WhatsApp</Label>
                                <Input 
                                    className="h-9 text-xs bg-white border-slate-200" 
                                    placeholder="08..." 
                                    value={newCustomerPhone} 
                                    onChange={e => setNewCustomerPhone(e.target.value)} 
                                />
                            </div>
                            <Button 
                                type="button"
                                className="w-full h-9 text-[11px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700" 
                                onClick={() => createCustomerMutation.mutate({ name: newCustomerName, phone: newCustomerPhone, type: 'RETAIL' })}
                                disabled={!newCustomerName || createCustomerMutation.isPending}
                            >
                                {createCustomerMutation.isPending ? <Loader2 className="animate-spin h-3 w-3 mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />}
                                Simpan & Pilih
                            </Button>
                        </div>
                    ) : (
                        <select 
                            className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm focus:ring-v1-green cursor-pointer"
                            value={customerId}
                            onChange={e => setCustomerId(e.target.value)}
                        >
                            <option value="">PELANGGAN UMUM</option>
                            {customers?.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
                        </select>
                    )}
                </div>
                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><Users className="h-3 w-3" /> Penarik Komisi</Label>
                    <select 
                        className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm focus:ring-v1-green"
                        value={agentId}
                        onChange={e => setAgentId(e.target.value)}
                    >
                        <option value="">TANPA AGEN</option>
                        {agents?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
            </div>

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
                        value={discountTotal}
                        onChange={e => setDiscountTotal(e.target.value)}
                    />
                 </div>
                 <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">TOTAL TAGIHAN</span>
                    <span className="text-3xl font-black text-v1-orange tabular-nums">Rp {finalTotal.toLocaleString("id-ID")}</span>
                 </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                     <div className="h-[2px] flex-1 bg-slate-100"></div>
                     <Label className="text-[10px] font-black text-v1-green uppercase tracking-[0.4em]">UANG DITERIMA (CASH)</Label>
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
                        onClick={() => setPaidAmount(finalTotal.toString())}
                    >
                        Pas
                    </Button>
                </div>
                <div className="flex justify-between text-[11px] font-black px-1">
                    {changeAmount >= 0 ? (
                        <span className="flex items-center gap-1 text-emerald-600 uppercase tracking-widest">
                            <CheckCircle2 className="h-4 w-4" /> KEMBALIAN: Rp {changeAmount.toLocaleString("id-ID")}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-red-600 uppercase tracking-widest animate-pulse">
                            <AlertCircle className="h-4 w-4" /> KURANG: Rp {Math.abs(changeAmount).toLocaleString("id-ID")}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex gap-4 pt-2">
                <Button variant="outline" className="flex-1 h-14 font-black rounded-2xl text-slate-400 hover:bg-slate-50 border-slate-100" onClick={() => setIsCheckoutOpen(false)}>Batal</Button>
                {(() => {
                    const isDebt = changeAmount < 0;
                    const isPelangganUmum = !customerId;
                    const isInvalid = isDebt && isPelangganUmum;

                    return (
                        <Button 
                            className={cn(
                                "flex-[2] h-14 text-xl font-black shadow-xl rounded-2xl transition-all",
                                isInvalid ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            )}
                            disabled={checkoutMutation.isPending || !paidAmount || isInvalid}
                            onClick={handleCheckout}
                        >
                            {checkoutMutation.isPending ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <CheckCircle2 className="mr-2 h-5 w-5" />
                            )}
                            {isInvalid ? 'LENGKAPI DATA' : 'BAYAR SEKARANG'}
                        </Button>
                    );
                })()}
            </div>
        </div>
      </Modal>
      {/* Success Modal */}
      <Modal 
        isOpen={isSuccessOpen} 
        onClose={handleNewTransaction} 
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
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Transaksi Berhasil!</h2>
                <p className="text-slate-500 text-sm max-w-[280px] mx-auto font-medium">Pembayaran telah diterima dan dicatat ke dalam sistem.</p>
            </div>

            <div className="w-full space-y-3 pt-4">
                <Button 
                    className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-slate-200"
                    onClick={() => setIsReceiptOpen(true)}
                >
                   <ShoppingCart className="w-5 h-5" /> Lihat & Cetak Struk
                </Button>
                <Button 
                    variant="outline"
                    className="w-full h-14 bg-slate-50 hover:bg-slate-100 text-slate-600 font-black rounded-2xl border-none transition-all"
                    onClick={handleNewTransaction}
                >
                    Transaksi Baru
                </Button>
            </div>
        </div>
      </Modal>
      {/* Receipt Modal (Kwitansi A5 Horizontal) */}
      <Modal 
        isOpen={isReceiptOpen} 
        onClose={() => setIsReceiptOpen(false)} 
        title="Pratinjau Kwitansi"
        description="Pastikan printer Anda menggunakan kertas A4 yang sudah terpotong (A5)."
        className="max-w-[1000px] w-[95%] bg-slate-100/90 backdrop-blur-md rounded-3xl"
      >
        <div className="flex flex-col items-center space-y-8 overflow-hidden">
            {/* Area Preview "Kertas" */}
            <div className="w-full h-full p-6 bg-slate-200/50 rounded-2xl flex justify-center border border-slate-200/50 shadow-inner overflow-auto max-h-[60vh] no-scrollbar">
                <div id="a5-nota" className="w-[800px] bg-white p-10 rounded-sm shadow-2xl border border-slate-100 font-sans text-xs text-slate-800 leading-normal space-y-6 flex-shrink-0 animate-in fade-in slide-in-from-bottom-5 duration-500">
                    <style>{`
                        @media print {
                            /* Step 1: Force A5 Landscape */
                            @page { 
                                size: A5 landscape; 
                                margin: 0;
                            }

                            /* Step 2: Global Reset for Print Engine */
                            html, body, #root, main, .flex-1, .flex, [role="dialog"], .relative {
                                margin: 0 !important;
                                padding: 0 !important;
                                height: auto !important;
                                width: 100% !important;
                                overflow: visible !important;
                                visibility: visible !important;
                                display: block !important;
                                background: white !important;
                                position: static !important;
                                opacity: 1 !important;
                                transform: none !important;
                                border: none !important;
                                box-shadow: none !important;
                            }

                            /* Step 3: Hard Hide Everything marked as no-print or UI Shell */
                            .no-print, nav, aside, header, button, .modal-backdrop, [role="dialog"] > div:first-child { 
                                display: none !important; 
                                visibility: hidden !important;
                            }

                            /* Step 4: THE NOTA - Take full control of the print surface */
                            #a5-nota { 
                                visibility: visible !important;
                                display: block !important;
                                position: fixed !important; 
                                left: 0 !important; 
                                top: 0 !important; 
                                width: 210mm !important; 
                                height: 148mm !important;
                                padding: 10mm !important; 
                                background: white !important;
                                font-size: 11pt !important;
                                z-index: 9999999 !important;
                                -webkit-print-color-adjust: exact;
                                border: none !important;
                                box-shadow: none !important;
                            }

                            /* Step 5: Fix internal elements and ensure high-contrast */
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
                            <div className="space-y-0.5 text-[11px] text-slate-600 font-semibold border-t-2 border-slate-100 pt-2 inline-block">
                                <div className="flex justify-between gap-8">
                                    <span>No. Invoice :</span>
                                    <span className="text-slate-900 font-black">#{lastTransactionData?.id?.toString().padStart(6, '0')}</span>
                                </div>
                                <div className="flex justify-between gap-8">
                                    <span>Tanggal :</span>
                                    <span className="text-slate-900 font-black">{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                </div>
                                <div className="flex justify-between gap-8">
                                    <span>Kasir :</span>
                                    <span className="text-slate-900 font-black">{activeShift?.user?.name || 'Admin'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1 font-bold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px]">
                        <span className="text-slate-400 font-black text-[9px]">KEPADA: </span>
                        <span className="uppercase">{customers?.find((c: any) => c.id === parseInt(customerId, 10))?.name || 'PELANGGAN UMUM'}</span>
                    </div>

                    {/* Table Items */}
                    <table className="w-full text-left border-collapse border-y-2 border-slate-900">
                        <thead>
                            <tr className="bg-slate-950 text-white uppercase text-[9px] tracking-widest font-black">
                                <th className="py-2 px-3 border-r border-slate-800 w-10 text-center">NO</th>
                                <th className="py-2 px-3 border-r border-slate-800 text-[10px]">NAMA BARANG / JASA</th>
                                <th className="py-2 px-3 border-r border-slate-800 w-16 text-center">QTY</th>
                                <th className="py-2 px-3 border-r border-slate-800 text-right">HARGA (Rp)</th>
                                <th className="py-2 px-3 text-right">TOTAL (Rp)</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] font-semibold">
                            {cart.map((item, index) => (
                                <tr key={item.productId} className="border-b border-slate-100">
                                    <td className="py-2 px-3 border-r border-slate-100 text-center">{index + 1}</td>
                                    <td className="py-2 px-3 border-r border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900">{item.name}</span>
                                            {item.notes && <span className="text-[9px] text-slate-400 italic">SN/ Ket: {item.notes}</span>}
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 border-r border-slate-100 text-center tabular-nums">{item.qty}</td>
                                    <td className="py-2 px-3 border-r border-slate-100 text-right tabular-nums">{item.price.toLocaleString("id-ID")}</td>
                                    <td className="py-2 px-3 text-right tabular-nums font-black">{item.subtotal.toLocaleString("id-ID")}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Footer Nota */}
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
                                <span className="font-black tabular-nums">Rp {cartSubtotal.toLocaleString("id-ID")}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-bold text-slate-400 uppercase text-[9px]">Potongan:</span>
                                <span className="font-black text-red-500 tabular-nums">-Rp {parseFloat(discountTotal || '0').toLocaleString("id-ID")}</span>
                            </div>
                            <div className="flex justify-between border-t-2 border-slate-900 pt-3 mt-2 text-slate-900">
                                <span className="font-black uppercase tracking-tight text-[11px]">Grand Total:</span>
                                <span className="text-xl font-black tabular-nums">Rp {finalTotal.toLocaleString("id-ID")}</span>
                            </div>
                            <div className="flex justify-between text-[10px] pt-1 px-1">
                                <span className="font-bold text-slate-400 uppercase italic text-[8px]">Metode Bayar: {lastTransactionData?.paymentMethod || 'TUNAI'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-center pt-4 text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] italic border-t border-dashed border-slate-100">
                        {storeSettings?.RECEIPT_FOOTER || 'Struk ini adalah bukti pembayaran yang sah. Terima kasih.'}
                    </div>
                </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-between w-full no-print px-2 pb-4">
                <Button 
                    variant="outline" 
                    className="h-14 bg-white hover:bg-slate-50 text-slate-500 font-bold rounded-2xl border-2 border-slate-200 px-10 transition-all active:scale-95 shadow-sm"
                    onClick={() => setIsReceiptOpen(false)}
                >
                    Tutup
                </Button>
                <Button 
                    className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl gap-3 shadow-xl shadow-emerald-500/30 px-12 transition-all active:scale-95 group"
                    onClick={() => {
                        const printContent = document.getElementById('a5-nota')?.innerHTML;
                        const printWindow = window.open('', '_blank');
                        
                        if (printWindow) {
                            // Extract all active CSS rules from the current document
                            let allCss = '';
                            try {
                                for (let i = 0; i < document.styleSheets.length; i++) {
                                    const sheet = document.styleSheets[i];
                                    try {
                                        const rules = sheet.cssRules || sheet.rules;
                                        for (let j = 0; j < rules.length; j++) {
                                            allCss += rules[j].cssText + '\n';
                                        }
                                    } catch (e) {
                                        // Skip cross-origin sheets that we can't read
                                    }
                                }
                            } catch (e) {
                                console.error('Error extracting CSS:', e);
                            }

                            printWindow.document.write(`
                                <html>
                                    <head>
                                        <title>Cetak Kwitansi - Central Computer</title>
                                        <style>
                                            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
                                            @page { size: A5 landscape; margin: 0; }
                                            body { margin: 0; padding: 0; background: white !important; font-family: 'Inter', sans-serif; }
                                            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                                            .print-container { 
                                                width: 210mm; 
                                                height: 148mm; 
                                                padding: 10mm; 
                                                position: relative; 
                                                visibility: visible !important;
                                                display: block !important;
                                            }
                                            table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; }
                                            ${allCss}
                                        </style>
                                    </head>
                                    <body>
                                        <div id="a5-nota" class="print-container">
                                            ${printContent}
                                        </div>
                                        <script>
                                            // Final check to ensure everything is settled
                                            window.onload = function() {
                                                setTimeout(() => {
                                                    window.print();
                                                    window.onafterprint = function() { window.close(); };
                                                }, 1000);
                                            };
                                        </script>
                                    </body>
                                </html>
                            `);
                            printWindow.document.close();
                        }
                    }}
                >
                    <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" /> 
                    Cetak Kwitansi Sekarang
                </Button>
            </div>
        </div>
      </Modal>
    </div>
  );
}
