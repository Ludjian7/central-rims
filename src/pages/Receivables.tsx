import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Search, Loader2, AlertCircle, Receipt, History } from 'lucide-react';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.js';
import { Modal } from '../components/ui/modal.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table.js';
import { useToast } from '../contexts/ToastContext.tsx';

export default function Receivables() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceivable, setSelectedReceivable] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailReceivableId, setDetailReceivableId] = useState<number | null>(null);
  const toast = useToast();

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');

  const { data: receivablesResult, isLoading } = useQuery({
    queryKey: ['receivables'],
    queryFn: async () => {
      const response = await api.get('/receivables');
      return response.data;
    },
  });

  const payMutation = useMutation({
    mutationFn: (data: { id: number; payload: any }) => api.post(`/receivables/${data.id}/pay`, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['activeShift'] });
      queryClient.invalidateQueries({ queryKey: ['receivableDetail'] });
      setIsPaymentModalOpen(false);
      resetPaymentForm();
      toast.success('Pembayaran cicilan piutang berhasil!');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Gagal memproses pembayaran';
      toast.error('Error: ' + msg);
    }
  });

  const { data: detailResult, isLoading: isDetailLoading } = useQuery({
    queryKey: ['receivableDetail', detailReceivableId],
    queryFn: async () => {
      if (!detailReceivableId) return null;
      const response = await api.get(`/receivables/${detailReceivableId}`);
      return response.data.data;
    },
    enabled: !!detailReceivableId
  });

  const detailData = detailResult;

  const openDetailModal = (id: number) => {
    setDetailReceivableId(id);
    setIsDetailModalOpen(true);
  };

  const resetPaymentForm = () => {
    setPaymentAmount('');
    setPaymentMethod('cash');
    setReferenceNumber('');
    setSelectedReceivable(null);
  };

  const openPaymentModal = (receivable: any) => {
    setSelectedReceivable(receivable);
    setPaymentAmount(receivable.remaining.toString());
    setIsPaymentModalOpen(true);
  };

  const submitPayment = () => {
    if (!selectedReceivable) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    payMutation.mutate({
      id: selectedReceivable.id,
      payload: {
        amount,
        paymentMethod,
        referenceNumber
      }
    });
  };

  const receivables = receivablesResult?.data || [];
  
  const filteredReceivables = receivables.filter((r: any) => 
    r.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.toString().includes(searchTerm)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Piutang</h1>
          <p className="text-gray-500">Kelola buku piutang pelanggan dan penerimaan cicilan.</p>
        </div>
        <div className="w-72 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cari nama pelanggan..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
             <div className="flex justify-center p-8">
               <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID/Ref</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead className="text-right">Total Hutang</TableHead>
                  <TableHead className="text-right">Sudah Dibayar</TableHead>
                  <TableHead className="text-right font-bold text-red-600">Sisa Hutang</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceivables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Tidak ada data piutang ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReceivables.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        PI-{r.id.toString().padStart(4, '0')}
                        <div className="text-xs text-gray-500">{r.referenceType} #{r.referenceId}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{r.customer?.name}</div>
                        <div className="text-xs text-gray-500">{r.customer?.phone || '-'}</div>
                      </TableCell>
                      <TableCell className="text-right">Rp {r.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600">Rp {r.paidAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        Rp {r.remaining.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          r.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          r.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-blue-600 hover:bg-blue-50"
                          onClick={() => openDetailModal(r.id)}
                        >
                          <Receipt className="w-4 h-4 mr-1" />
                          Detail
                        </Button>
                        {r.status !== 'PAID' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            onClick={() => openPaymentModal(r)}
                          >
                            <CreditCard className="w-4 h-4 mr-1" />
                            Bayar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Modal 
        isOpen={isPaymentModalOpen} 
        onClose={() => {
          setIsPaymentModalOpen(false);
          resetPaymentForm();
        }}
        title="Pembayaran Cicilan Piutang"
        description="Masukkan nominal uang yang diterima untuk memotong sisa hutang."
      >
        {selectedReceivable && (
          <div className="space-y-6 mt-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Pelanggan</span>
                <span className="font-bold">{selectedReceivable.customer?.name}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Total Piutang Awal</span>
                <span className="font-mono">Rp {selectedReceivable.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t mt-2">
                <span className="text-red-600 font-bold">Sisa Hutang Saat Ini</span>
                <span className="text-red-600 font-black font-mono text-base">
                  Rp {selectedReceivable.remaining.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nominal Pembayaran (Rp)</Label>
                <div className="relative">
                   <span className="absolute left-3 top-2.5 text-gray-400">Rp</span>
                   <Input 
                     type="number" 
                     className="pl-10 font-bold text-lg"
                     value={paymentAmount}
                     onChange={(e) => setPaymentAmount(e.target.value)}
                     max={selectedReceivable.remaining}
                   />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Metode Pembayaran</Label>
                <select 
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Kas Fisik (CASH)</option>
                  <option value="transfer">Transfer Bank</option>
                </select>
              </div>

              {paymentMethod === 'transfer' && (
                <div className="space-y-2">
                  <Label>Nomor Referensi (Opsional)</Label>
                  <Input 
                    placeholder="Ref transaksi bank..."
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                  />
                </div>
              )}
            </div>

            <Button 
              className="w-full h-12 bg-green-600 hover:bg-green-700" 
              onClick={submitPayment}
              disabled={payMutation.isPending || !paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > selectedReceivable.remaining}
            >
              {payMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Proses Pembayaran
            </Button>
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailReceivableId(null);
        }}
        title="Detail Hutang Piutang"
        description="Rincian transaksi awal dan riwayat cicilan"
        className="max-w-2xl lg:max-w-3xl"
      >
        {isDetailLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
        ) : detailData ? (
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs text-gray-500 mb-1">Pelanggan</p>
                <p className="font-bold">{detailData.customer?.name}</p>
                <p className="text-xs text-gray-500">{detailData.customer?.phone || '-'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs text-gray-500 mb-1">Status Piutang</p>
                <p className="font-bold text-lg">Rp {detailData.remaining.toLocaleString()} <span className="text-xs font-normal text-gray-500">Sisa dari Rp {detailData.total.toLocaleString()}</span></p>
                <p className="text-xs text-gray-500">Telah dibayar: Rp {detailData.paidAmount.toLocaleString()}</p>
              </div>
            </div>

            {/* Original Items */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Receipt className="w-4 h-4" /> Transaksi Referensi ({detailData.referenceType})
                </h3>
                {detailData.originalDetail && (
                  <div className="text-right text-xs text-gray-500">
                    <span className="font-bold font-mono text-gray-900 border rounded px-1.5 py-0.5 bg-white shadow-sm mr-2">
                      {detailData.originalDetail.invoiceNumber || detailData.originalDetail.woNumber || `#${detailData.referenceId}`}
                    </span>
                    {new Date(detailData.originalDetail.createdAt).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="border rounded-md overflow-hidden text-sm max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Deskripsi</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailData.originalDetail?.items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name}</TableCell>
                        <TableCell className="text-center">{item.qty}</TableCell>
                        <TableCell className="text-right">Rp {item.price.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">Rp {item.subtotal.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {detailData.originalDetail?.serviceItems?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name} (Jasa)</TableCell>
                        <TableCell className="text-center">{item.qty}</TableCell>
                        <TableCell className="text-right">Rp {item.price.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">Rp {item.subtotal.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {detailData.originalDetail?.sparepartItems?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name} (Part)</TableCell>
                        <TableCell className="text-center">{item.qty}</TableCell>
                        <TableCell className="text-right">Rp {item.price.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">Rp {item.subtotal.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {!detailData.originalDetail?.items && !detailData.originalDetail?.serviceItems && (
                      <TableRow>
                         <TableCell colSpan={4} className="text-center text-gray-500 py-4">Item transaksi tidak ditemukan.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Payment History */}
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2 mb-2"><History className="w-4 h-4" /> Riwayat Cicilan</h3>
              <div className="border rounded-md overflow-hidden text-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Metode & Ref</TableHead>
                      <TableHead>Kasir</TableHead>
                      <TableHead className="text-right">Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const payments = detailData.payments || [];
                      const totalInstallments = payments.reduce((acc: number, p: any) => acc + p.amount, 0);
                      const dpAmount = detailData.paidAmount - totalInstallments;
                      const hasDp = dpAmount > 0.01;

                      if (payments.length === 0 && !hasDp) {
                        return (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4 text-gray-500">Belum ada pembayaran masuk.</TableCell>
                          </TableRow>
                        );
                      }

                      return (
                        <>
                          {hasDp && (
                            <TableRow className="bg-blue-50/50">
                              <TableCell>{new Date(detailData.originalDetail?.createdAt || detailData.createdAt).toLocaleString()}</TableCell>
                              <TableCell>
                                <span className="uppercase font-medium text-[10px] rounded border border-blue-200 bg-white px-1 mr-1 text-blue-700">DP / AWAL</span>
                                Sistem (Otomatis)
                              </TableCell>
                              <TableCell>-</TableCell>
                              <TableCell className="text-right font-bold text-blue-600">Rp {dpAmount.toLocaleString()}</TableCell>
                            </TableRow>
                          )}
                          {payments.map((payment: any) => (
                            <TableRow key={payment.id}>
                              <TableCell>{new Date(payment.createdAt).toLocaleString()}</TableCell>
                              <TableCell>
                                <span className="uppercase font-medium text-[10px] rounded border border-gray-300 bg-white px-1 mr-1 text-gray-700">{payment.paymentMethod}</span>
                                {payment.referenceNumber || '-'}
                              </TableCell>
                              <TableCell>{payment.shift?.user?.username || '-'}</TableCell>
                              <TableCell className="text-right font-bold text-green-600">Rp {payment.amount.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })()}
                  </TableBody>
                </Table>
              </div>
            </div>
            
          </div>
        ) : (
          <div className="text-center p-8 text-red-500">Gagal mengambil data detail</div>
        )}
      </Modal>
    </div>
  );
}
