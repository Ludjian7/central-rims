import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Search, UserCheck, ShieldCheck, Phone } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card.js";
import { useToast } from "../contexts/ToastContext.tsx";
import { useConfirm } from "../contexts/ConfirmContext.tsx";
import { cn } from "../lib/utils.js";

const customerSchema = z.object({
  name: z.string().min(1, "Nama pelanggan wajib diisi"),
  phone: z.string().optional(),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  address: z.string().optional(),
  type: z.enum(["RETAIL", "MEMBER"]),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  type: "RETAIL" | "MEMBER";
  isActive: boolean;
}

export default function Customers() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "RETAIL" | "MEMBER">("ALL");
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const response = await api.get("/customers");
      return response.data.data as Customer[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CustomerFormValues) => api.post("/customers", values),
    onSuccess: () => {
      toast.success("Pelanggan berhasil didaftarkan");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal menambahkan pelanggan")
  });

  const updateMutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      api.put(`/customers/${editingCustomer?.id}`, values),
    onSuccess: () => {
      toast.success("Data pelanggan berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal memperbarui data")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success("Customer berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal menghapus customer")
  });

  const onSubmit = (values: CustomerFormValues) => {
    if (editingCustomer) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      reset({
        name: customer.name,
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        type: customer.type,
      });
    } else {
      setEditingCustomer(null);
      reset({ name: "", phone: "", email: "", address: "", type: "RETAIL" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    reset();
  };

  const filteredCustomers = customers?.filter((c) => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "ALL") return matchesSearch;
    return matchesSearch && c.type === activeTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Pelanggan</h1>
          <p className="text-gray-500">Kelola profil klien retail dan member Anda.</p>
        </div>
        <Button onClick={() => openModal()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Tambah Pelanggan
        </Button>
      </div>

      <div className="flex gap-2 p-1 bg-gray-200/50 rounded-lg w-fit">
        {(["ALL", "RETAIL", "MEMBER"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 text-sm font-semibold rounded-md transition-all",
              activeTab === tab 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
            )}
          >
            {tab === "ALL" ? "Semua" : tab === "RETAIL" ? "Retail" : "Member"}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Database Klien</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari nama atau telepon..."
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
                  <TableHead className="pl-6">Nama Pelanggan</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>No. Telepon</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead className="text-right pr-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers && filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-bold text-gray-800 pl-6">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-black border border-slate-200">
                              {customer.name.substring(0,2).toUpperCase()}
                           </div>
                           {customer.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.type === "MEMBER" ? (
                          <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[10px] uppercase px-2.5 py-1 rounded-full border border-blue-100 bg-blue-50 w-fit">
                            <ShieldCheck className="h-3 w-3" /> Member
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase px-2.5 py-1 rounded-full border border-slate-100 bg-slate-50 w-fit">
                            <UserCheck className="h-3 w-3" /> Retail
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Phone className="h-3.5 w-3.5 text-slate-300" /> {customer.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-gray-400 text-xs">
                        {customer.address || "-"}
                      </TableCell>
                      <TableCell className="text-right space-x-2 pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openModal(customer)}
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            const ok = await confirm({
                               title: "Hapus Pelanggan?",
                               message: "Apakah Anda yakin ingin menghapus data pelanggan ini? Operasi ini mungkin akan gagal jika pelanggan memiliki riwayat transaksi.",
                               danger: true,
                               confirmText: "Ya, Hapus"
                            });
                            if (ok) {
                              deleteMutation.mutate(customer.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-gray-400 font-medium">
                      Data pelanggan tidak ditemukan.
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
        title={editingCustomer ? "Edit Profil Pelanggan" : "Input Pelanggan Baru"}
        description="Informasi ini diperlukan untuk pencatatan nota transaksional POS."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input id="name" {...register("name")} placeholder="Budi Santoso" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">No. Handphone</Label>
              <Input id="phone" {...register("phone")} placeholder="0812xxxx" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipe Pelanggan</Label>
              <select 
                id="type" 
                {...register("type")} 
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus-visible:ring-blue-600 ring-offset-2"
              >
                <option value="RETAIL">RETAIL (Umum)</option>
                <option value="MEMBER">MEMBER (Prioritas)</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (Opsional)</Label>
            <Input id="email" type="email" {...register("email")} placeholder="customer@example.com" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Alamat Domisili</Label>
            <textarea 
               id="address"
               {...register("address")}
               className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:ring-blue-600"
               placeholder="Jl. Raya No. 123..."
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Batal</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingCustomer ? "Simpan Perbaikan" : "Tambah Pelanggan"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
