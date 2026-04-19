'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '@/lib/api/client';
import { formatDate, formatRelative, getInitials } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Loader2, Users, ShieldCheck, User, Trash2,
  ToggleLeft, ToggleRight, Eye, EyeOff,
} from 'lucide-react';

const usersApi = {
  getAll:  ()                      => apiClient.get('/users').then((r) => r.data.data),
  create:  (data: any)             => apiClient.post('/users', data),
  toggle:  (id: string)            => apiClient.patch(`/users/${id}/toggle`),
  delete:  (id: string)            => apiClient.delete(`/users/${id}`),
};

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  AGENCY_ADMIN: { label: 'Administrateur', color: 'bg-purple-100 text-purple-800' },
  EMPLOYEE:     { label: 'Employé',         color: 'bg-blue-100 text-blue-800' },
  ACCOUNTANT:   { label: 'Comptable',       color: 'bg-green-100 text-green-800' },
  SUPER_ADMIN:  { label: 'Super Admin',     color: 'bg-red-100 text-red-800' },
};

const createSchema = z.object({
  firstName: z.string().min(2, 'Prénom requis'),
  lastName:  z.string().min(2, 'Nom requis'),
  email:     z.string().email('Email invalide'),
  password:  z.string().min(8, 'Min 8 caractères').regex(/[A-Z]/, '1 majuscule').regex(/[0-9]/, '1 chiffre'),
  role:      z.enum(['AGENCY_ADMIN', 'EMPLOYEE', 'ACCOUNTANT']),
  phone:     z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

export function UsersContent() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => usersApi.create(data),
    onSuccess: () => {
      toast({ title: '✅ Utilisateur créé' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      reset();
      setOpen(false);
    },
    onError: (err: any) =>
      toast({ title: 'Erreur', description: err.response?.data?.message ?? 'Erreur création', variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => usersApi.toggle(id),
    onSuccess: () => {
      toast({ title: 'Statut mis à jour' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) =>
      toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast({ title: 'Utilisateur supprimé' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) =>
      toast({ title: 'Erreur', description: err.response?.data?.message, variant: 'destructive' }),
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'EMPLOYEE' },
  });

  const activeCount   = users.filter((u: any) => u.isActive).length;
  const adminCount    = users.filter((u: any) => u.role === 'AGENCY_ADMIN').length;
  const employeeCount = users.filter((u: any) => u.role === 'EMPLOYEE').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground">{users.length} utilisateur(s) dans votre agence</p>
        </div>

        {/* Nouveau utilisateur */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouvel utilisateur</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un utilisateur</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Prénom *</Label>
                  <Input placeholder="Mohamed" {...register('firstName')} />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Nom *</Label>
                  <Input placeholder="Alami" {...register('lastName')} />
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" placeholder="user@agence.ma" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Mot de passe *</Label>
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Min 8 car., 1 majuscule, 1 chiffre"
                    {...register('password')}
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPass((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Rôle *</Label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMPLOYEE">Employé</SelectItem>
                        <SelectItem value="AGENCY_ADMIN">Administrateur</SelectItem>
                        <SelectItem value="ACCOUNTANT">Comptable</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Téléphone</Label>
                <Input placeholder="0612345678" {...register('phone')} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Créer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Comptes actifs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{adminCount}</p>
              <p className="text-xs text-muted-foreground">Administrateurs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{employeeCount}</p>
              <p className="text-xs text-muted-foreground">Employés</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Utilisateur</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Rôle</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Téléphone</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Dernière connexion</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Statut</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                        Aucun utilisateur — créez le premier
                      </td>
                    </tr>
                  ) : users.map((u: any) => {
                    const roleCfg = ROLE_CONFIG[u.role] ?? { label: u.role, color: 'bg-gray-100 text-gray-800' };
                    return (
                      <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {getInitials(u.firstName, u.lastName)}
                            </div>
                            <div>
                              <p className="font-medium">{u.firstName} {u.lastName}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleCfg.color}`}>
                            {roleCfg.label}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground text-sm">
                          {u.phone ?? '—'}
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">
                          {u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Jamais connecté'}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {u.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${u.isActive ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                              title={u.isActive ? 'Désactiver' : 'Activer'}
                              onClick={() => toggleMutation.mutate(u.id)}
                            >
                              {u.isActive
                                ? <ToggleRight className="w-4 h-4" />
                                : <ToggleLeft className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Supprimer"
                              onClick={() => {
                                if (confirm(`Supprimer ${u.firstName} ${u.lastName} ?`)) {
                                  deleteMutation.mutate(u.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
