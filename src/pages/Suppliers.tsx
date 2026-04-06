import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Search, Building2, Phone, Mail, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { api } from "../lib/api.js";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Label } from "../components/ui/label.js";
import { Modal } from "../components/ui/modal.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { useToast } from "../contexts/ToastContext.tsx";
import { useConfirm } from "../contexts/ConfirmContext.tsx";

const supplierSchema = z.object({
  name: z.string().min(1, "Nama supplier wajib diisi"),
  phone: z.string().optional(),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  address: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
}

export default function Suppliers() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
  });

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const response = await api.get("/suppliers");
      return response.data.data as Supplier[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: SupplierFormValues) => api.post("/suppliers", values),
    onSuccess: () => {
      toast.success("Suplier baru berhasil didaftarkan");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal menambah suplier")
  });

  const updateMutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      api.put(`/suppliers/${editingSupplier?.id}`, values),
    onSuccess: () => {
      toast.success("Profil suplier berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal memperbarui suplier")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      toast.success("Suplier berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal menghapus suplier")
  });

  const onSubmit = (values: SupplierFormValues) => {
    if (editingSupplier) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const openModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      reset({
        name: supplier.name,
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
      });
    } else {
      setEditingSupplier(null);
      reset({ name: "", phone: "", email: "", address: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    reset();
  };

  const filteredSuppliers = suppliers?.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner Suplier</h1>
          <p className="text-gray-500">Kelola daftar pemasok barang Anda untuk Kulakan.</p>
        </div>
        <Button onClick={() => openModal()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Tambah Suplier
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Daftar Supplier</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari nama suplier..."
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
                  <TableHead className="pl-6">Nama Provider</TableHead>
                  <TableHead>Kontak Telepon</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Alamat Kantor</TableHead>
                  <TableHead className="text-right pr-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers && filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-bold text-gray-800 pl-6">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-black border border-slate-200 uppercase">
                              {supplier.name.substring(0,2)}
                           </div>
                           {supplier.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Phone className="h-3.5 w-3.5 text-slate-300" /> {supplier.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Mail className="h-3.5 w-3.5 text-slate-300" /> {supplier.email || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-gray-400 text-xs">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" /> {supplier.address || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2 pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openModal(supplier)}
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Hapus Suplier",
                              message: "Apakah Anda yakin ingin menghapus suplier ini? Data terkait PO mungkin terpengaruh.",
                              danger: true,
                              confirmText: "Ya, Hapus"
                            });
                            if (ok) {
                              deleteMutation.mutate(supplier.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-gray-400 font-medium">
                      Data suplier tidak ditemukan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingSupplier ? "Edit Profil Suplier" : "Registrasi Suplier Baru"}
        description="Data ini vital untuk memproses Purchase Order (PO) Gudang."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Instansi / Provider</Label>
            <Input id="name" {...register("name")} placeholder="Contoh: PT. Distributor Maju" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">No. Telepon Kantor</Label>
              <Input id="phone" {...register("phone")} placeholder="(021) xxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Sales</Label>
              <Input id="email" type="email" {...register("email")} placeholder="sales@provider.com" />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Alamat Gudang/Kantor</Label>
            <textarea 
               id="address"
               {...register("address")}
               className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:ring-blue-600"
               placeholder="Lokasi distribusi..."
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Batal</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingSupplier ? "Simpan Perubahan" : "Daftarkan Suplier"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
