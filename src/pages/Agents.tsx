import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Search, Handshake, Phone, Percent } from "lucide-react";
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

const agentSchema = z.object({
  name: z.string().min(1, "Nama agen wajib diisi"),
  phone: z.string().optional(),
  commissionRate: z.number().min(0, "Nilai komisi tidak boleh negatif"),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]),
});

type AgentFormValues = z.infer<typeof agentSchema>;

interface Agent {
  id: number;
  name: string;
  phone: string | null;
  commissionRate: number;
  commissionType: "PERCENTAGE" | "FIXED";
  isActive: boolean;
}

export default function Agents() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: "",
      phone: "",
      commissionRate: 0,
      commissionType: "PERCENTAGE",
    }
  });

  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const response = await api.get("/agents");
      return response.data.data as Agent[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: AgentFormValues) => api.post("/agents", values),
    onSuccess: () => {
      toast.success("Agen baru berhasil didaftarkan");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal menambahkan agen")
  });

  const updateMutation = useMutation({
    mutationFn: (values: AgentFormValues) =>
      api.put(`/agents/${editingAgent?.id}`, values),
    onSuccess: () => {
      toast.success("Data agen berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal memperbarui agen")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/agents/${id}`),
    onSuccess: () => {
      toast.success("Agen berhasil dinonaktifkan");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Gagal menonaktifkan agen")
  });

  const onSubmit = (values: AgentFormValues) => {
    if (editingAgent) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const openModal = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent);
      reset({
        name: agent.name,
        phone: agent.phone || "",
        commissionRate: agent.commissionRate,
        commissionType: agent.commissionType,
      });
    } else {
      setEditingAgent(null);
      reset({ 
        name: "", 
        phone: "", 
        commissionRate: 0,
        commissionType: "PERCENTAGE",
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAgent(null);
    reset();
  };

  const filteredAgents = agents?.filter((a) => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Agen Komisi</h1>
          <p className="text-gray-500 text-sm">Kelola daftar pihak ketiga dan persentase bagi hasil mereka.</p>
        </div>
        <Button onClick={() => openModal()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Tambah Agen
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Database Agen</CardTitle>
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
                  <TableHead className="pl-6">Nama Agen</TableHead>
                  <TableHead>No. Telepon</TableHead>
                  <TableHead>Rate Komisi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents && filteredAgents.length > 0 ? (
                  filteredAgents.map((agent) => (
                    <TableRow key={agent.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-bold text-gray-800 pl-6">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black border border-emerald-200">
                              <Handshake className="h-3.5 w-3.5" />
                           </div>
                           {agent.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Phone className="h-3.5 w-3.5 text-slate-300" /> {agent.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit border border-emerald-100 italic">
                            {agent.commissionType === "FIXED" && "Rp "}
                            {agent.commissionType === "PERCENTAGE" ? agent.commissionRate : agent.commissionRate.toLocaleString()}
                            {agent.commissionType === "PERCENTAGE" && "%"}
                         </div>
                      </TableCell>
                      <TableCell>
                         {agent.isActive ? (
                            <span className="text-[9px] font-black uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">AKTIF</span>
                         ) : (
                            <span className="text-[9px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">NON-AKTIF</span>
                         )}
                      </TableCell>
                      <TableCell className="text-right space-x-2 pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openModal(agent)}
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            const ok = await confirm({
                               title: "Nonaktifkan Agen?",
                               message: "Ini akan mengatur status mereka menjadi Tidak Aktif dan mereka tidak bisa menerima komisi.",
                               danger: true,
                               confirmText: "Ya, Nonaktifkan"
                            });
                            if (ok) {
                              deleteMutation.mutate(agent.id);
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
                      Data agen tidak ditemukan.
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
        title={editingAgent ? "Edit Profil Agen" : "Daftarkan Agen Baru"}
        description="Agen ini akan muncul di menu pembayaran POS untuk perhitungan komisi otomatis."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Agen / Makelar</Label>
            <Input id="name" {...register("name")} placeholder="Contoh: Pak Haji / Bengkel Partner" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Tipe Komisi</Label>
            <div className="flex gap-6 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  value="PERCENTAGE" 
                  {...register("commissionType")} 
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500" 
                />
                <span className="text-sm font-bold text-gray-700">Persentase (%)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  value="FIXED" 
                  {...register("commissionType")} 
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500" 
                />
                <span className="text-sm font-bold text-gray-700">Nominal Tetap (Rp)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">No. Handphone / WhatsApp</Label>
              <Input id="phone" {...register("phone")} placeholder="0812xxxx" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commissionRate">Nilai Komisi</Label>
              <div className="relative">
                <div className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">
                   {/* Visual indicator changes based on type */}
                </div>
                <Input 
                   type="number" 
                   id="commissionRate" 
                   {...register("commissionRate", { valueAsNumber: true })} 
                   placeholder="0" 
                />
              </div>
              {errors.commissionRate && <p className="text-xs text-red-500">{errors.commissionRate.message}</p>}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Batal</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingAgent ? "Simpan Perbaikan" : "Daftarkan Agen"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
