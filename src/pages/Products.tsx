import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Search, Package, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { api } from "../lib/api.js";
import { cn } from "../lib/utils.js";
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

const productSchema = z.object({
  name: z.string().min(1, "Nama produk wajib diisi"),
  sku: z.string().optional().nullable(),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  supplierId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  cost: z.string().catch("0"),
  price: z.string().catch("0"),
  stock: z.string().catch("0"),
  minStock: z.string().catch("0"),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface Product {
  id: number;
  name: string;
  sku: string | null;
  categoryId: number;
  supplierId: number | null;
  description: string | null;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  category: { name: string };
  supplier: { name: string } | null;
}

export default function Products() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await api.get("/products");
      return response.data.data as Product[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.get("/categories");
      return response.data.data;
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const response = await api.get("/suppliers");
      return response.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: ProductFormValues) => api.post("/products", values),
    onSuccess: () => {
      toast.success("Produk baru berhasil ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal menambahkan produk")
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProductFormValues) =>
      api.put(`/products/${editingProduct?.id}`, values),
    onSuccess: () => {
      toast.success("Produk berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal memperbarui produk")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Produk dinonaktifkan");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal menonaktifkan produk")
  });

  const onSubmit = (values: ProductFormValues) => {
    if (editingProduct) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      reset({
        name: product.name,
        sku: product.sku || "",
        categoryId: product.categoryId.toString(),
        supplierId: product.supplierId?.toString() || "",
        description: product.description || "",
        cost: product.cost.toString(),
        price: product.price.toString(),
        stock: product.stock.toString(),
        minStock: product.minStock.toString(),
      });
    } else {
      setEditingProduct(null);
      reset({
        name: "",
        sku: "",
        categoryId: "",
        supplierId: "",
        description: "",
        cost: "0",
        price: "0",
        stock: "0",
        minStock: "0",
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    reset();
  };

  const filteredProducts = products?.filter((p) =>
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.sku?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-black text-v2-blue uppercase tracking-[0.3em] mb-1">Inventory Management</h2>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Produk & Inventori</h1>
          <p className="text-slate-500 text-sm font-medium">Master data barang dagangan Anda.</p>
        </div>
        <Button onClick={() => openModal()} className="bg-v2-blue hover:bg-v2-blue/90 text-white shadow-xl shadow-v2-blue/10 rounded-xl h-12 px-6 font-bold transform transition-all active:scale-95 space-x-2">
           <span>Tambah Produk</span>
           <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-v2-blue/5 flex items-center justify-center border border-v2-blue/10">
              <Package className="h-6 w-6 text-v2-blue" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Database Barang</h3>
              <p className="text-slate-400 text-xs font-medium">Total {products?.length || 0} SKU Terdaftar</p>
            </div>
          </div>
          
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-v2-blue transition-colors" />
            <Input
              placeholder="Cari nama atau SKU..."
              className="pl-12 h-12 bg-slate-50 border-transparent rounded-2xl text-sm placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-v2-blue/5 focus:border-v2-blue/20 transition-all font-bold shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                <TableRow className="hover:bg-transparent px-8">
                  <TableHead className="w-[160px] font-black text-slate-400 text-[10px] uppercase tracking-[0.25em] py-6 pl-12">SKU / Kode</TableHead>
                  <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-[0.25em] py-6">Nama Produk</TableHead>
                  <TableHead className="w-[140px] font-black text-slate-400 text-[10px] uppercase tracking-[0.25em] py-6 text-center">Kategori</TableHead>
                  <TableHead className="w-[180px] text-right font-black text-slate-400 text-[10px] uppercase tracking-[0.25em] py-6">HPP (Modal)</TableHead>
                  <TableHead className="w-[200px] text-right font-black text-slate-400 text-[10px] uppercase tracking-[0.25em] py-6">Harga Jual</TableHead>
                  <TableHead className="w-[120px] text-center font-black text-slate-400 text-[10px] uppercase tracking-[0.25em] py-6">Stok</TableHead>
                  <TableHead className="w-[120px] text-right font-black text-slate-400 text-[10px] uppercase tracking-[0.25em] py-6 pr-12">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts && filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="group hover:bg-slate-50/50 transition-all duration-200 border-b border-slate-50">
                      <TableCell className="py-7 pl-12">
                        <div className="flex items-center">
                          <code className="px-4 py-1.5 rounded-xl bg-v2-blue/5 text-v2-blue text-[11px] font-mono font-bold tracking-wider border border-v2-blue/10">
                            {product.sku || "N/A"}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 2xl:py-7">
                        <span className="font-black text-[15px] text-slate-800 tracking-tight">{product.name}</span>
                      </TableCell>
                      <TableCell className="py-7 text-center">
                        <span className={cn(
                          "inline-flex items-center px-4 py-1 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] ring-1 ring-inset",
                          product.category.name.toLowerCase() === 'laptop' ? "bg-v2-blue/10 text-v2-blue ring-v2-blue/20" : "bg-slate-50 text-slate-400 ring-slate-100"
                        )}>
                          {product.category.name}
                        </span>
                      </TableCell>
                      <TableCell className="py-7 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] mb-1">Modal</span>
                          <span className="text-sm font-bold text-slate-400 tabular-nums">Rp {product.cost.toLocaleString("id-ID")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 2xl:py-7 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] text-v2-blue/40 font-black uppercase tracking-[0.2em] mb-1">Sale Price</span>
                          <span className="text-xl font-black text-slate-900 tabular-nums tracking-tight">Rp {product.price.toLocaleString("id-ID")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-7 text-center">
                        <div className="flex justify-center">
                          <span className={cn(
                            "w-12 h-9 flex items-center justify-center rounded-2xl text-xs font-black tabular-nums tracking-tighter ring-1 ring-inset shadow-sm transition-all group-hover:scale-110",
                            product.stock <= 0 ? "bg-red-50 text-red-700 ring-red-600/20" :
                            product.stock <= product.minStock ? "bg-v2-orange/10 text-v2-orange ring-v2-orange/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]" : 
                            "bg-emerald-50 text-emerald-600 ring-emerald-600/20"
                          )}>
                            {product.stock}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-7 text-right pr-12">
                        <div className="flex items-center justify-end gap-2 sm:opacity-20 group-hover:opacity-100 transition-all duration-300">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-v1-green/10 hover:text-v1-green"
                            onClick={() => openModal(product)}
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
                                 title: "Nonaktifkan Produk?",
                                 message: "Produk ini tidak akan muncul di katalog transaksi.",
                                 danger: true,
                                 confirmText: "Ya, Nonaktifkan"
                              });
                              if (ok) {
                                deleteMutation.mutate(product.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package className="h-8 w-8 opacity-20" />
                        <p>Belum ada data produk atau hasil pencarian nihil.</p>
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
        title={editingProduct ? "Edit Detail Produk" : "Tambah Produk Baru"}
        description="Master data ini digunakan pada Transaksi Kasir, PO, dan Servis."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Nama Barang</Label>
              <Input id="name" {...register("name")} placeholder="Contoh: Laptop ASUS ROG" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Kode Unik</Label>
              <Input id="sku" {...register("sku")} placeholder="A-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Kategori</Label>
              <select 
                id="categoryId" 
                {...register("categoryId")} 
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus-visible:ring-blue-600 ring-offset-2"
              >
                <option value="">-- Pilih Kategori --</option>
                {categories?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Harga Beli (Modal)</Label>
              <Input id="cost" type="number" {...register("cost")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Harga Jual</Label>
              <Input id="price" type="number" {...register("price")} />
            </div>
            {!editingProduct && (
               <div className="space-y-2">
                <Label htmlFor="stock">Stok Awal</Label>
                <Input id="stock" type="number" {...register("stock")} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="minStock">Min. Stok (Alarm)</Label>
              <Input id="minStock" type="number" {...register("minStock")} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="supplierId">Pilihan Suplier Utama</Label>
              <select 
                id="supplierId" 
                {...register("supplierId")} 
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
              >
                <option value="">-- Tanpa Suplier --</option>
                {suppliers?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">Keterangan Spesifikasi</Label>
              <textarea 
                id="description"
                {...register("description")}
                className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:ring-blue-600"
                placeholder="Rincian RAM, Processor, dsb..."
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-6 sticky bottom-0 bg-white">
            <Button type="button" variant="outline" onClick={closeModal}>Batal</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingProduct ? "Simpan Perubahan" : "Simpan Produk"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
