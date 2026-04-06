import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Phone, 
  Percent, 
  Loader2, 
  Search,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Modal } from '../components/ui/modal.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.js';
import { cn } from '../lib/utils.js';
import { useConfirm } from '../contexts/ConfirmContext.tsx';
import { useToast } from '../contexts/ToastContext.tsx';

interface Technician {
  id: number;
  name: string;
  phone: string | null;
  commissionRate: number;
  isActive: boolean;
}

export default function Technicians() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const confirm = useConfirm();
  const toast = useToast();
  
  const queryClient = useQueryClient();

  const { data: technicians, isLoading } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const response = await api.get('/technicians?isActive=true');
      return response.data.data as Technician[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingTech) {
        return api.put(`/technicians/${editingTech.id}`, data);
      }
      return api.post('/technicians', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      setIsModalOpen(false);
      setEditingTech(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/technicians/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      toast.success('Hapus teknisi berhasil');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menghapus teknisi'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      commissionRate: formData.get('commissionRate'),
    };
    upsertMutation.mutate(data);
  };

  const filteredTechs = technicians?.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Teknisi</h1>
          <p className="text-gray-500">Kelola tim teknisi dan pengaturan bagi hasil (komisi) jasa servis.</p>
        </div>
        <Button onClick={() => { setEditingTech(null); setIsModalOpen(true); }} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Tambah Teknisi
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Daftar Teknisi</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Cari nama teknisi..." 
                className="pl-9 h-10 border-gray-200" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow>
                  <TableHead className="pl-6">Nama Teknisi</TableHead>
                  <TableHead>No. Telepon</TableHead>
                  <TableHead>Komisi Jasa (%)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filteredTechs || filteredTechs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-gray-400 font-medium">
                      Data teknisi tidak ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTechs.map((tech) => (
                    <TableRow key={tech.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-bold text-gray-800 pl-6">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black border border-blue-200">
                              {tech.name.substring(0,2).toUpperCase()}
                           </div>
                           {tech.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Phone className="h-3.5 w-3.5 text-slate-300" /> {tech.phone || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {tech.commissionRate}%
                        </div>
                      </TableCell>
                      <TableCell>
                        {tech.isActive ? (
                          <div className="flex items-center gap-1.5 text-green-600 font-bold text-[10px] uppercase px-2.5 py-1 rounded-full border border-green-100 bg-green-50 w-fit">
                            <CheckCircle2 className="h-3 w-3" /> Aktif
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-500 font-bold text-[10px] uppercase px-2.5 py-1 rounded-full border border-rose-100 bg-rose-50 w-fit">
                            <XCircle className="h-3 w-3" /> Nonaktif
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2 pr-6">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingTech(tech); setIsModalOpen(true); }}>
                          <Edit2 className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={async () => {
                            const confirmed = await confirm({
                              title: 'Hapus Teknisi?',
                              message: 'Apakah Anda yakin ingin menghapus teknisi ini?',
                              danger: true,
                              confirmText: 'Ya, Hapus'
                            });
                            if (confirmed) deleteMutation.mutate(tech.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingTech ? "Edit Data Teknisi" : "Tambah Teknisi Baru"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input id="name" name="name" defaultValue={editingTech?.name} required placeholder="Masukkan nama..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Nomor Telepon (WhatsApp)</Label>
            <Input id="phone" name="phone" defaultValue={editingTech?.phone || ''} placeholder="08xxxx" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commissionRate">Persentase Komisi Jasa (%)</Label>
            <div className="relative">
              <Percent className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <Input 
                id="commissionRate" 
                name="commissionRate" 
                type="number" 
                min="0" 
                max="100" 
                defaultValue={editingTech?.commissionRate || 10} 
                required 
              />
            </div>
            <p className="text-[10px] text-gray-400 italic font-medium">* Komisi dihitung dari total pendapatan item Jasa Servis (tanpa Sparepart).</p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button type="submit" className="flex-1" disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Simpan Data"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
