import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
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

const categorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface Category {
  id: number;
  name: string;
  description: string | null;
  _count?: {
    products: number;
  };
}

export default function Categories() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories", "v2-force-refresh"],
    queryFn: async () => {
      const response = await api.get("/categories");
      return response.data.data as Category[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CategoryFormValues) => api.post("/categories", values),
    onSuccess: () => {
      toast.success("Kategori baru ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal menambahkan kategori")
  });

  const updateMutation = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      api.put(`/categories/${editingCategory?.id}`, values),
    onSuccess: () => {
      toast.success("Kategori berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal memperbarui kategori")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success("Kategori berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menghapus kategori");
    },
  });

  const onSubmit = (values: CategoryFormValues) => {
    if (editingCategory) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const openModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      reset({
        name: category.name,
        description: category.description || "",
      });
    } else {
      setEditingCategory(null);
      reset({ name: "", description: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    reset();
  };

  const filteredCategories = categories?.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-black text-v2-blue uppercase tracking-[0.3em] mb-1">Taxonomy & Organization</h2>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Kategori Produk</h1>
          <p className="text-slate-500 text-sm font-medium">Klasifikasi barang untuk mempermudah pencarian dan laporan.</p>
        </div>
        <Button onClick={() => openModal()} className="bg-v2-blue hover:bg-v2-blue/90 text-white shadow-xl shadow-v2-blue/10 rounded-xl h-12 px-6 font-bold transform transition-all active:scale-95 space-x-2">
           <span>Tambah Kategori</span>
           <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-v2-blue/5 flex items-center justify-center border border-v2-blue/10">
              <Search className="h-6 w-6 text-v2-blue" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Daftar Kategori</h3>
              <p className="text-slate-400 text-xs font-medium">Total {categories?.length || 0} Kategori Aktif</p>
            </div>
          </div>
          
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 font-bold" />
            <Input
              placeholder="Cari kategori..."
              className="pl-12 h-12 bg-slate-50 border-none rounded-xl text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-v2-blue/5 transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-v2-blue" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-white border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-5 pl-8 font-black text-slate-400 text-[9px] uppercase tracking-[0.15em]">Nama Kategori</TableHead>
                  <TableHead className="py-5 font-black text-slate-400 text-[9px] uppercase tracking-[0.15em]">Deskripsi</TableHead>
                  <TableHead className="py-5 text-center font-black text-slate-400 text-[9px] uppercase tracking-[0.15em]">Jumlah Produk</TableHead>
                  <TableHead className="py-5 pr-8 text-right font-black text-slate-400 text-[9px] uppercase tracking-[0.15em]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories && filteredCategories.length > 0 ? (
                  filteredCategories.map((category) => (
                    <TableRow key={category.id} className="group hover:bg-slate-50/50 transition-all duration-200 border-b border-slate-50">
                      <TableCell className="py-3 pl-8">
                        <span className="font-bold text-base text-slate-800 tracking-tight">{category.name}</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <p className="text-slate-400 font-medium text-xs line-clamp-1">
                          {category.description || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <div className="flex justify-center">
                          <span className="px-3 py-0.5 rounded-lg bg-v2-blue/5 text-v2-blue text-[10px] font-bold tracking-wider ring-1 ring-inset ring-v2-blue/10 tabular-nums">
                            {category._count?.products || 0} Barang
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 pr-8 text-right">
                        <div className="flex items-center justify-end gap-2 sm:opacity-20 group-hover:opacity-100 transition-all duration-300">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-v2-blue/10 hover:text-v2-blue"
                            onClick={() => openModal(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            disabled={deleteMutation.isPending}
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Hapus Kategori",
                                message: "Hapus kategori ini? Data produk di dalamnya tidak akan hilang, namun kategori akan terlepas dari produk terkait.",
                                danger: true,
                                confirmText: "Ya, Hapus"
                              });
                              if (ok) {
                                deleteMutation.mutate(category.id);
                              }
                            }}
                          >
                            {deleteMutation.isPending && deleteMutation.variables === category.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center text-slate-300">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                           <Search className="h-6 w-6 opacity-20" />
                        </div>
                        <p className="font-black uppercase tracking-[0.2em] text-[10px]">Kategori tidak ditemukan</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCategory ? "Edit Kategori" : "Tambah Kategori Baru"}
        description={
          editingCategory
            ? "Perbarui informasi kategori produk Anda."
            : "Buat klasifikasi baru untuk inventori Anda."
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Kategori</Label>
            <Input id="name" {...register("name")} placeholder="Contoh: Perangkat Keras" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi (Opsional)</Label>
            <Input
              id="description"
              {...register("description")}
              placeholder="Berikan deskripsi singkat..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingCategory ? "Simpan Perubahan" : "Tambah Kategori"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
