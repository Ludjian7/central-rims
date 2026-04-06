import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Wrench, 
  Plus, 
  Search, 
  Loader2, 
  Calendar, 
  User, 
  Cpu, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  Filter,
  ArrowRight,
  UserPlus,
  Laptop,
  Printer,
  Monitor
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { useToast } from '../contexts/ToastContext.tsx';
import { Modal } from '../components/ui/modal.js';
import { cn } from '../lib/utils.js';

type WorkOrderStatus = 'MASUK' | 'DIKERJAKAN' | 'SELESAI' | 'DIAMBIL';

interface WorkOrder {
  id: number;
  woNumber: string;
  status: WorkOrderStatus;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string | null;
  complaints: string;
  createdAt: string;
  customer: { name: string; phone: string | null } | null;
  technician: { name: string } | null;
}

export default function WorkOrders() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Intake Form State
  const [customerId, setCustomerId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [deviceData, setDeviceData] = useState({
    deviceType: 'Laptop',
    deviceBrand: '',
    deviceModel: '',
    serialNumber: '',
    complaints: '',
  });
  const [stayOpen, setStayOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const toast = useToast();
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPhone, setQuickAddPhone] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);

  const { 
    data: workOrders, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch 
  } = useInfiniteQuery({
    queryKey: ['work-orders', statusFilter, searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get(`/work-orders`, {
        params: {
          status: statusFilter,
          search: searchTerm,
          page: pageParam,
          limit: 20
        }
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.hasMore) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const resp = await api.get('/customers');
      return resp.data.data;
    }
  });

  const { data: technicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const resp = await api.get('/technicians?isActive=true');
      return resp.data.data;
    }
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data: any) => api.post('/customers', data),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setCustomerId(resp.data.data.id.toString());
      setIsQuickAddOpen(false);
      setQuickAddName('');
      setQuickAddPhone('');
      setCustomerSearch(resp.data.data.name);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/work-orders', data),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      if (stayOpen) {
        setDeviceData({
            deviceType: 'Laptop',
            deviceBrand: '',
            deviceModel: '',
            serialNumber: '',
            complaints: '',
        });
      } else {
        setIsModalOpen(false);
        navigate(`/work-orders/${resp.data.data.id}`);
      }
    },
  });

  const handleIntakeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customerId) {
        toast.error("Silakan pilih pelanggan terlebih dahulu.");
        return;
    }
    const payload = {
        customerId,
        technicianId,
        ...deviceData
    };
    createMutation.mutate(payload);
  };

  const statusColors = {
    MASUK: "bg-blue-100 text-blue-700 border-blue-200",
    DIKERJAKAN: "bg-amber-100 text-amber-700 border-amber-200",
    SELESAI: "bg-green-100 text-green-700 border-green-200",
    DIAMBIL: "bg-gray-100 text-gray-500 border-gray-200",
  };

  const allWOs = workOrders?.pages.flatMap(page => page.data as WorkOrder[]) || [];

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'MASUK': return "border-t-blue-500";
      case 'DIKERJAKAN': return "border-t-amber-500";
      case 'SELESAI': return "border-t-green-500";
      case 'DIAMBIL': return "border-t-slate-400";
      default: return "border-t-transparent";
    }
  };

  const getDeviceIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('laptop') || t.includes('macbook')) return <Laptop className="h-4 w-4" />;
    if (t.includes('printer')) return <Printer className="h-4 w-4" />;
    if (t.includes('cpu') || t.includes('pc') || t.includes('rakitan')) return <Monitor className="h-4 w-4" />;
    return <Cpu className="h-4 w-4" />;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-black text-v2-orange uppercase tracking-[0.3em] mb-1">Service & Maintenance</h2>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Pusat Servis (Jasa Service)</h1>
          <p className="text-slate-500 text-sm font-medium">Kelola antrean perbaikan unit laptop, printer, dan CPU rakitan.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-v2-orange hover:bg-v2-orange/90 text-white shadow-xl shadow-v2-orange/10 rounded-xl h-12 px-6 font-bold transform transition-all active:scale-95 space-x-2">
           <span>Terima Servisan Baru</span>
           <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="relative flex-1 w-full bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center">
            <Search className="absolute left-6 h-5 w-5 text-slate-400 font-bold" />
            <Input 
                placeholder="Cari No. WO, Nama Pelanggan..." 
                className="pl-14 h-12 bg-transparent border-none shadow-none text-base placeholder:text-slate-300 focus:ring-0 font-medium w-full" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 gap-1 overflow-x-auto no-scrollbar max-w-full">
            <button 
                onClick={() => setStatusFilter('')}
                className={cn(
                    "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    statusFilter === '' ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10" : "text-slate-400 hover:bg-slate-50"
                )}
            >
                Semua Status
            </button>
            {(['MASUK', 'DIKERJAKAN', 'SELESAI', 'DIAMBIL'] as const).map(status => (
                <button 
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                        "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                        statusFilter === status 
                          ? statusColors[status as WorkOrderStatus] + " shadow-sm border-transparent scale-105" 
                          : "border-transparent text-slate-400 hover:bg-slate-50"
                    )}
                >
                    {status === 'DIAMBIL' ? 'DIAMBIL (CLOSING)' : status}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
            <div className="col-span-full h-32 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
        ) : (
            allWOs.map((wo) => {
              const customerName = wo.customer?.name || "Pelanggan Umum";
              return (
                <Link to={`/work-orders/${wo.id}`} key={wo.id} className="block group">
                    <Card className={cn(
                        "relative border-t-4 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 bg-white border-slate-100/80 rounded-2xl overflow-hidden",
                        getStatusBorder(wo.status)
                    )}>
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                    <span className="font-mono text-[9px] font-black text-slate-500 tracking-wider uppercase leading-none">{wo.woNumber}</span>
                                </div>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest flex items-center gap-1.5",
                                    statusColors[wo.status as WorkOrderStatus]
                                )}>
                                    <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", 
                                        wo.status === 'MASUK' ? "bg-blue-500" :
                                        wo.status === 'DIKERJAKAN' ? "bg-amber-500" :
                                        wo.status === 'SELESAI' ? "bg-green-500" : "bg-slate-400"
                                    )} />
                                    {wo.status === 'DIAMBIL' ? 'CLOSED' : wo.status}
                                </span>
                            </div>
                            
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 group-hover:text-v2-orange transition-colors">
                                    <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:text-v2-orange group-hover:bg-v2-orange/5 transition-all">
                                        {getDeviceIcon(wo.deviceType)}
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-base leading-tight">
                                        {wo.deviceBrand} {wo.deviceModel || wo.deviceType}
                                    </h4>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1 font-medium pl-9">
                                    <span className="text-[10px] text-slate-300 mr-2">KELUHAN:</span>
                                    {wo.complaints}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-y-3">
                                <div className="flex items-center text-[10px] gap-2.5 font-bold text-slate-600">
                                    <User className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="truncate">{customerName}</span>
                                </div>
                                <div className="flex items-center text-[10px] gap-2.5 font-bold text-slate-400 justify-end">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span className="tabular-nums">{new Date(wo.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}</span>
                                </div>
                                <div className="col-span-2 flex items-center text-[10px] gap-2.5 font-bold text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                                    <Cpu className="h-3.5 w-3.5 text-v2-orange" />
                                    <div className="flex flex-col">
                                        <span className="text-[8px] uppercase text-slate-400 leading-none mb-0.5">Teknisi Penanggungjawab</span>
                                        <span className="text-slate-900">{wo.technician?.name || "TBA"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </Link>
              );
            })
        )}
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-8 pb-12">
            <Button 
                variant="outline" 
                onClick={() => fetchNextPage()} 
                disabled={isFetchingNextPage}
                className="bg-white border-2 border-slate-200 text-slate-600 font-black px-12 h-12 rounded-2xl hover:bg-slate-50 transition-all space-x-3 shadow-xl shadow-slate-100"
            >
                {isFetchingNextPage ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>MENGAMBIL DATA...</span>
                    </>
                ) : (
                    <>
                        <Clock className="h-4 w-4" />
                        <span>MUAT 20 DATA LAGI</span>
                    </>
                )}
            </Button>
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
            setIsModalOpen(false);
            setCustomerId('');
            setTechnicianId('');
            setDeviceData({ deviceType: 'Laptop', deviceBrand: '', deviceModel: '', serialNumber: '', complaints: '' });
            setCustomerSearch('');
            setIsQuickAddOpen(false);
        }} 
        title="Terima Barang Servisan (Intake)"
        description="Pencatatan awal perangkat masuk dan keluhan pelanggan."
      >
        <form onSubmit={handleIntakeSubmit} className="space-y-4 pt-4">
          <div className="space-y-2 relative">
            <Label>Pelanggan</Label>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Cari Nama atau No HP..."
                        className="w-full h-10 pl-10 pr-4 border rounded-md text-sm bg-white focus:ring-2 focus:ring-v2-orange/20 focus:border-v2-orange transition-all"
                        value={isQuickAddOpen ? "Sedang Menambah Pelanggan Baru..." : (customers?.find((c: any) => c.id.toString() === customerId)?.name || customerSearch)}
                        onChange={(e) => {
                            setCustomerSearch(e.target.value);
                            setIsCustomerListOpen(true);
                        }}
                        onFocus={() => setIsCustomerListOpen(true)}
                        disabled={isQuickAddOpen}
                    />
                    
                    {isCustomerListOpen && !isQuickAddOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto no-scrollbar py-2">
                            {customers?.filter((c: any) => 
                                c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                                c.phone?.toLowerCase().includes(customerSearch.toLowerCase())
                            ).map((c: any) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-v2-orange/5 flex flex-col transition-colors border-b last:border-0 border-slate-50"
                                    onClick={() => {
                                        setCustomerId(c.id.toString());
                                        setCustomerSearch(c.name);
                                        setIsCustomerListOpen(false);
                                    }}
                                >
                                    <span className="font-bold text-slate-800">{c.name}</span>
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{c.phone || "No Phone"}</span>
                                </button>
                            ))}
                            {(customers?.filter((c: any) => 
                                c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                                c.phone?.toLowerCase().includes(customerSearch.toLowerCase())
                            ).length === 0) && (
                                <div className="px-4 py-8 text-center text-slate-400 text-xs italic">
                                    <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    Pelanggan tidak ditemukan.
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <Button 
                    type="button" 
                    variant="outline" 
                    className={cn(
                        "h-10 px-3 transition-all font-bold",
                        isQuickAddOpen ? "bg-red-50 text-red-500 border-red-200" : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                    )}
                    onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                >
                    {isQuickAddOpen ? "Batal" : <div className="flex items-center gap-2"><Plus className="h-4 w-4" /> Baru</div>}
                </Button>
            </div>

            {isQuickAddOpen && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 mt-2">
                    <div className="flex items-center gap-2 text-slate-900 mb-1">
                        <UserPlus className="h-4 w-4 text-v2-orange" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Pendaftaran Cepat Pelanggan</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-slate-500 font-black">Nama Lengkap</Label>
                            <Input 
                                value={quickAddName}
                                onChange={e => setQuickAddName(e.target.value)}
                                placeholder="Budi Santoso"
                                className="h-9 text-xs"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-slate-500 font-black">No. HP / WA</Label>
                            <Input 
                                value={quickAddPhone}
                                onChange={e => setQuickAddPhone(e.target.value)}
                                placeholder="0812..."
                                className="h-9 text-xs"
                            />
                        </div>
                    </div>
                    <Button 
                        type="button" 
                        size="sm"
                        disabled={!quickAddName || createCustomerMutation.isPending}
                        className="w-full bg-v2-orange hover:bg-v2-orange/90 text-white font-black h-9 text-xs rounded-lg shadow-lg shadow-v2-orange/20"
                        onClick={() => createCustomerMutation.mutate({ name: quickAddName, phone: quickAddPhone, type: 'RETAIL' })}
                    >
                        {createCustomerMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "KONFIRMASI PELANGGAN BARU"}
                    </Button>
                </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label>Tipe Barang</Label>
                  <select 
                    value={deviceData.deviceType}
                    onChange={e => setDeviceData({ ...deviceData, deviceType: e.target.value })}
                    className="w-full h-10 border rounded-md px-3 text-sm bg-white" 
                    required
                  >
                      <option value="Laptop">Laptop / Macbook</option>
                      <option value="CPU">CPU Rakitan / PC</option>
                      <option value="Printer">Printer</option>
                      <option value="Monitor">Monitor</option>
                      <option value="Lainnya">Lainnya</option>
                  </select>
              </div>
              <div className="space-y-2">
                  <Label>Merk Barang</Label>
                  <Input 
                    value={deviceData.deviceBrand}
                    onChange={e => setDeviceData({ ...deviceData, deviceBrand: e.target.value })}
                    placeholder="Misal: Asus, Acer, HP..." 
                    required 
                  />
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label>Seri / Model</Label>
                  <Input 
                    value={deviceData.deviceModel}
                    onChange={e => setDeviceData({ ...deviceData, deviceModel: e.target.value })}
                    placeholder="Misal: ROG G531, Vivobook..." 
                  />
              </div>
              <div className="space-y-2">
                  <Label>Serial Number (SN)</Label>
                  <Input 
                    value={deviceData.serialNumber}
                    onChange={e => setDeviceData({ ...deviceData, serialNumber: e.target.value })}
                    placeholder="Masukan No Seri..." 
                    className="font-mono" 
                  />
              </div>
          </div>

          <div className="space-y-2">
              <Label>Keluhan Pelanggan</Label>
              <textarea 
                  value={deviceData.complaints}
                  onChange={e => setDeviceData({ ...deviceData, complaints: e.target.value })}
                  className="w-full min-h-[80px] border rounded-md p-3 text-sm bg-white"
                  placeholder="Ceritakan kerusakan barang di sini..."
                  required
              />
          </div>

          <div className="space-y-2">
              <Label>Ditugaskan Ke (Teknisi)</Label>
              <select 
                value={technicianId}
                onChange={e => setTechnicianId(e.target.value)}
                className="w-full h-10 border rounded-md px-3 text-sm bg-white" 
                required
              >
                <option value="">Pilih Teknisi...</option>
                {technicians?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t mt-6">
            <Button 
                type="submit" 
                variant="outline"
                onClick={() => setStayOpen(true)}
                className="flex-1 border-v2-orange text-v2-orange hover:bg-v2-orange/10 font-black h-12 rounded-xl"
                disabled={createMutation.isPending}
            >
              {createMutation.isPending && stayOpen ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "SIMPAN & INPUT LAIN"}
            </Button>
            <Button 
                type="submit" 
                onClick={() => setStayOpen(false)}
                className="flex-[1.5] bg-slate-900 hover:bg-slate-800 text-white font-black h-12 rounded-xl shadow-xl shadow-slate-200"
                disabled={createMutation.isPending}
            >
              {createMutation.isPending && !stayOpen ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "BUAT WO & PRINT NOTA"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Card({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) {
  return <div onClick={onClick} className={cn("rounded-xl border border-gray-200", className)}>{children}</div>;
}
