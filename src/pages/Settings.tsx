import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Settings as SettingsIcon, 
  Store, 
  Users, 
  Save, 
  UserPlus, 
  Edit, 
  Trash2, 
  Loader2,
  ShieldAlert,
  X
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.tsx';
import { useConfirm } from '../contexts/ConfirmContext.tsx';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'store' | 'users'>('store');
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  // --- TAB: STORE SETTINGS ---
  const { data: currentSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data.data; // Record<string, string>
    }
  });

  const [storeForm, setStoreForm] = useState<Record<string, string>>({});

  // Sync form when data arrives
  React.useEffect(() => {
    if (currentSettings) {
      setStoreForm({
        STORE_NAME: currentSettings.STORE_NAME || '',
        STORE_ADDRESS: currentSettings.STORE_ADDRESS || '',
        STORE_PHONE: currentSettings.STORE_PHONE || '',
        RECEIPT_FOOTER: currentSettings.RECEIPT_FOOTER || '',
      });
    }
  }, [currentSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => api.put('/settings/bulk', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Pengaturan toko berhasil disimpan');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menyimpan pengaturan')
  });

  const handleSaveStore = async () => {
    const ok = await confirm({
      title: 'Simpan Profil Toko',
      message: 'Simpan pengaturan profil toko terbaru? Data akan terpengaruh pada kwitansi selanjutnya.',
      confirmText: 'Ya, Simpan'
    });
    if (ok) {
      updateSettingsMutation.mutate(storeForm);
    }
  };

  // --- TAB: USERS ---
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data.data;
    },
    enabled: activeTab === 'users'
  });

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ id: null as number | null, username: '', email: '', password: '', role: 'KASIR', isActive: true });

  const saveUserMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.id) {
        return api.put(`/users/${data.id}`, {
          username: data.username,
          email: data.email,
          role: data.role,
          isActive: data.isActive
        }); // password ignore on edit specifically built here
      }
      return api.post('/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsUserModalOpen(false);
      toast.success('Karyawan berhasil direkam');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal merekam karyawan')
  });

  const deactivateUserMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Akses karyawan dinonaktifkan');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menonaktifkan akun')
  });

  const openAddUser = () => {
    setUserForm({ id: null, username: '', email: '', password: '', role: 'KASIR', isActive: true });
    setIsUserModalOpen(true);
  };

  const openEditUser = (user: any) => {
    setUserForm({ id: user.id, username: user.username, email: user.email, password: '', role: user.role, isActive: user.isActive });
    setIsUserModalOpen(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-slate-400" />
          Pengaturan Sistem
        </h1>
        <p className="text-gray-500">Sesuaikan profil toko dan pendaftaran akun pengguna aplikasi.</p>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('store')}
          className={cn("px-6 py-3 font-bold text-sm tracking-wide transition-colors", activeTab === 'store' ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800")}
        >
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Profil Toko & Nota
          </div>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={cn("px-6 py-3 font-bold text-sm tracking-wide transition-colors", activeTab === 'users' ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800")}
        >
           <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Manajemen Karyawan
          </div>
        </button>
      </div>

      {activeTab === 'store' && (
        <div className="animate-in fade-in duration-300">
          <Card className="border-slate-200 shadow-sm max-w-2xl">
             <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl mb-6">
                <CardTitle className="text-lg">Informasi Profil Toko</CardTitle>
                <CardDescription>Data ini akan muncul di atas kover struk dan invoice digital.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
                {settingsLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="storeName">Nama Toko (Header)</Label>
                      <Input 
                        id="storeName" 
                        value={storeForm.STORE_NAME || ''}
                        onChange={e => setStoreForm({...storeForm, STORE_NAME: e.target.value})}
                        placeholder="Contoh: Central Computer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storeAddress">Alamat Lengkap</Label>
                      <textarea 
                         id="storeAddress"
                         rows={2}
                         className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                         value={storeForm.STORE_ADDRESS || ''}
                         onChange={e => setStoreForm({...storeForm, STORE_ADDRESS: e.target.value})}
                         placeholder="Contoh: Jl Raya Kota Baru No. 8..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storePhone">Nomor WhatsApp / Hubungi Kasir</Label>
                      <Input 
                        id="storePhone" 
                        value={storeForm.STORE_PHONE || ''}
                        onChange={e => setStoreForm({...storeForm, STORE_PHONE: e.target.value})}
                        placeholder="Contoh: 0812345678"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receiptFooter">Pesan Kaki Nota (Footer Note)</Label>
                      <Input 
                        id="receiptFooter" 
                        value={storeForm.RECEIPT_FOOTER || ''}
                        onChange={e => setStoreForm({...storeForm, RECEIPT_FOOTER: e.target.value})}
                        placeholder="Contoh: Garansi servis 1 minggu dari bon cetak."
                      />
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button onClick={handleSaveStore} disabled={updateSettingsMutation.isPending} className="bg-slate-900 hover:bg-slate-800">
                        {updateSettingsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Simpan Perubahan
                      </Button>
                    </div>
                  </>
                )}
             </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="animate-in fade-in duration-300">
          <Card className="border-slate-200 shadow-sm">
             <CardHeader className="flex flex-row justify-between items-center bg-slate-50 border-b border-slate-100 rounded-t-xl mb-4">
                <div>
                  <CardTitle className="text-lg">Daftar Akun Pegawai</CardTitle>
                  <CardDescription>Hak akses untuk masuk ke sistem.</CardDescription>
                </div>
                <Button onClick={openAddUser} className="bg-blue-600 hover:bg-blue-700">
                  <UserPlus className="h-4 w-4 mr-2" />
                  + Akun Karyawan
                </Button>
             </CardHeader>
             <CardContent className="p-0">
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-white text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                         <tr>
                            <th className="px-6 py-4">Username / Email</th>
                            <th className="px-6 py-4">Hak Akses (Role)</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Aksi</th>
                         </tr>
                      </thead>
                      <tbody>
                        {usersLoading ? (
                          <tr><td colSpan={4} className="py-12 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                        ) : !users || users.length === 0 ? (
                           <tr><td colSpan={4} className="py-12 text-center text-slate-400">Belum ada user terdaftar.</td></tr>
                        ) : (
                          users.map((u: any) => (
                            <tr key={u.id} className={cn("border-b border-slate-50 hover:bg-slate-50 transition-colors", !u.isActive && "opacity-50")}>
                               <td className="px-6 py-4">
                                  <p className="font-bold text-slate-800">{u.username}</p>
                                  <p className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</p>
                               </td>
                               <td className="px-6 py-4">
                                 <span className={cn("px-2.5 py-1 text-[10px] font-black tracking-widest uppercase rounded-md", 
                                   u.role === 'OWNER' ? 'bg-purple-100 text-purple-700' :
                                   u.role === 'MANAGER' ? 'bg-amber-100 text-amber-700' :
                                   u.role === 'KASIR' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                 )}>
                                   {u.role}
                                 </span>
                               </td>
                               <td className="px-6 py-4">
                                 <span className={cn("text-xs font-bold", u.isActive ? 'text-green-600' : 'text-red-500 flex items-center gap-1')}>
                                   {u.isActive ? 'Aktif' : <><ShieldAlert className="h-3 w-3" /> Nonaktif</>}
                                 </span>
                               </td>
                               <td className="px-6 py-4 text-center">
                                  <button onClick={() => openEditUser(u)} className="p-2 text-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded-lg mr-2 transition-colors">
                                     <Edit className="h-4 w-4" />
                                  </button>
                                  {u.isActive && u.role !== 'OWNER' && (
                                    <button 
                                      onClick={async () => {
                                        const ok = await confirm({
                                          title: "Hapus Karyawan?",
                                          message: `Hapus akses karyawan ${u.username}?`,
                                          danger: true,
                                          confirmText: "Ya, Hapus"
                                        });
                                        if(ok) deactivateUserMutation.mutate(u.id);
                                      }}
                                      className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                               </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                   </table>
                </div>
             </CardContent>
          </Card>
        </div>
      )}

      {/* USER MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col pt-6 animate-in zoom-in-95 duration-200">
             <div className="px-6 pb-4 border-b border-slate-100 flex justify-between items-center relative">
               <h3 className="font-black text-lg text-slate-900">
                  {userForm.id ? 'Edit Karyawan' : 'Tambah Akun Baru'}
               </h3>
               <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-red-500"><X className="h-5 w-5" /></button>
             </div>
             <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                   <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Username Akses</Label>
                   <Input 
                     placeholder="Budi_Kasir_1"
                     value={userForm.username}
                     onChange={e => setUserForm({...userForm, username: e.target.value})}
                   />
                </div>
                <div className="space-y-1.5">
                   <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Alamat Email</Label>
                   <Input 
                     type="email"
                     placeholder="budi@central.com"
                     value={userForm.email}
                     onChange={e => setUserForm({...userForm, email: e.target.value})}
                   />
                </div>
                {!userForm.id && (
                  <div className="space-y-1.5">
                     <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Password Default</Label>
                     <Input 
                       type="password"
                       placeholder="******"
                       value={userForm.password}
                       onChange={e => setUserForm({...userForm, password: e.target.value})}
                     />
                  </div>
                )}
                
                <div className="space-y-1.5">
                   <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Posisi / Role</Label>
                   <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                      value={userForm.role}
                      onChange={e => setUserForm({...userForm, role: e.target.value})}
                   >
                     <option value="KASIR">KASIR</option>
                     <option value="MANAGER">MANAGER</option>
                     <option value="OWNER">OWNER</option>
                   </select>
                </div>
             </div>
             <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
               <Button variant="ghost" onClick={() => setIsUserModalOpen(false)}>Batal</Button>
               <Button 
                onClick={() => saveUserMutation.mutate(userForm)} 
                disabled={saveUserMutation.isPending || (!userForm.id && !userForm.password) || !userForm.username || !userForm.email}
                className="bg-blue-600 hover:bg-blue-700"
               >
                 {saveUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Karyawan'}
               </Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
