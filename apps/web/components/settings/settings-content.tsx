'use client';

import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Lock, Building2, CheckCircle, Camera, Trash2, Moon, Sun, Palette, PanelLeft } from 'lucide-react';
import { useThemeStore, ACCENT_CONFIGS, SIDEBAR_STYLE_CONFIGS, type AccentColor, type SidebarStyle } from '@/store/theme.store';
import { cn } from '@/lib/utils';

// ── Schemas ────────────────────────────────────────────
const profileSchema = z.object({
  firstName: z.string().min(2, 'Prénom requis'),
  lastName:  z.string().min(2, 'Nom requis'),
  phone:     z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type ProfileForm   = z.infer<typeof profileSchema>;
type PasswordForm  = z.infer<typeof passwordSchema>;

// ── Main Component ─────────────────────────────────────
export function SettingsContent() {
  const { user, updateUser } = useAuthStore();

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/auth/me').then((r) => r.data.data),
  });

  const currentUser = meData ?? user;

  const { mode, accent, sidebarStyle, setMode, setAccent, setSidebarStyle } = useThemeStore();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">Gérez votre profil, la sécurité et l'apparence</p>
      </div>

      <AvatarCard user={currentUser} onUpdated={(u) => updateUser(u)} />
      <ProfileCard user={currentUser} onUpdated={(u) => updateUser(u)} />
      <PasswordCard />
      {currentUser?.agency && <AgencyCard agency={currentUser.agency} />}

      {/* ── Theme ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="w-4 h-4 text-primary" />
            Apparence & Thème
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Mode */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Mode d'affichage</p>
            <div className="flex gap-2">
              {(['light', 'dark'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    mode === m
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border hover:border-primary/40 hover:bg-muted'
                  )}
                >
                  {m === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {m === 'light' ? 'Clair' : 'Sombre'}
                </button>
              ))}
            </div>
          </div>

          {/* Accent color */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Couleur principale</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(ACCENT_CONFIGS) as [AccentColor, typeof ACCENT_CONFIGS[AccentColor]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setAccent(key)}
                  title={cfg.label}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all',
                    accent === key
                      ? 'border-2 shadow-md scale-105'
                      : 'border-border hover:scale-105 hover:shadow-sm'
                  )}
                  style={{
                    borderColor: accent === key ? cfg.hex : undefined,
                    backgroundColor: accent === key ? `${cfg.hex}18` : undefined,
                    color: accent === key ? cfg.hex : undefined,
                  }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: cfg.hex }}
                  />
                  {cfg.label}
                  {accent === key && <CheckCircle className="w-3 h-3 ml-0.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar style */}
          <div className="space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <PanelLeft className="w-4 h-4" />
              Style de la barre latérale
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(SIDEBAR_STYLE_CONFIGS) as [SidebarStyle, typeof SIDEBAR_STYLE_CONFIGS[SidebarStyle]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setSidebarStyle(key)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border text-xs transition-all',
                    sidebarStyle === key
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border hover:border-primary/40 hover:bg-muted'
                  )}
                >
                  {/* Mini sidebar preview */}
                  <div className={cn(
                    'w-full h-12 rounded-lg overflow-hidden flex',
                    key === 'default' ? 'bg-white border' :
                    key === 'dark'    ? 'bg-[#0f1117]' :
                                        'border'
                  )}
                  style={key === 'colored' ? { backgroundColor: ACCENT_CONFIGS[accent].hex } : undefined}>
                    <div className={cn(
                      'w-1/3 h-full flex flex-col gap-1 p-1',
                    )}>
                      {[1,2,3].map(i => (
                        <div key={i} className={cn(
                          'rounded w-full h-1.5',
                          key === 'default' ? (i===1 ? 'bg-primary/40' : 'bg-gray-200') :
                          key === 'dark'    ? (i===1 ? 'bg-blue-500/50' : 'bg-white/10') :
                                              (i===1 ? 'bg-white/40' : 'bg-white/20')
                        )} />
                      ))}
                    </div>
                    <div className="flex-1 bg-gray-50/80 dark:bg-gray-900/80" />
                  </div>
                  <span className="font-medium">{cfg.label}</span>
                  <span className="text-muted-foreground text-[10px] text-center">{cfg.desc}</span>
                </button>
              ))}
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

// ── Avatar Card ────────────────────────────────────────
function AvatarCard({ user, onUpdated }: { user: any; onUpdated: (u: any) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (avatarUrl: string) => apiClient.patch('/auth/profile', { avatarUrl }),
    onSuccess: (res) => {
      toast({ title: '✅ Photo de profil mise à jour' });
      onUpdated(res.data.data);
      setPreview(null);
    },
    onError: () => toast({ title: 'Erreur', description: 'Impossible de mettre à jour la photo', variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: () => apiClient.patch('/auth/profile', { avatarUrl: '' }),
    onSuccess: (res) => {
      toast({ title: 'Photo supprimée' });
      onUpdated(res.data.data);
      setPreview(null);
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Erreur', description: 'Image trop grande (max 2 Mo)', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const currentAvatar = preview ?? user?.avatarUrl;
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;
  const isPending = mutation.isPending || removeMutation.isPending;

  return (
    <div className="flex items-center gap-5 p-4 rounded-xl border bg-card">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {currentAvatar ? (
          <img src={currentAvatar} alt="avatar"
            className="w-20 h-20 rounded-full object-cover border-2 border-primary/20" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {initials}
          </div>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute bottom-0 right-0 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors shadow"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Info + actions */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-lg truncate">{user?.firstName} {user?.lastName}</p>
        <p className="text-muted-foreground text-sm truncate">{user?.email}</p>
        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
          {user?.role}
        </span>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={isPending}>
            <Camera className="w-3.5 h-3.5 mr-1.5" />
            {preview ? 'Changer' : 'Choisir une photo'}
          </Button>
          {preview && (
            <Button size="sm" onClick={() => mutation.mutate(preview)} disabled={isPending}>
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Enregistrer
            </Button>
          )}
          {user?.avatarUrl && !preview && (
            <Button size="sm" variant="outline"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => removeMutation.mutate()} disabled={isPending}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Profile Card ───────────────────────────────────────
function ProfileCard({ user, onUpdated }: { user: any; onUpdated: (u: any) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: user?.firstName ?? '',
      lastName:  user?.lastName  ?? '',
      phone:     user?.phone     ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) => apiClient.patch('/auth/profile', data),
    onSuccess: (res) => {
      toast({ title: '✅ Profil mis à jour' });
      onUpdated(res.data.data);
    },
    onError: (err: any) => {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message ?? 'Erreur lors de la mise à jour',
        variant: 'destructive',
      });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="w-4 h-4" />
          Informations personnelles
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Prénom *</Label>
              <Input {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Téléphone</Label>
            <Input placeholder="+212 6XX XXX XXX" {...register('phone')} />
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Email</Label>
            <Input value={user?.email ?? ''} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Enregistrer les modifications
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Password Card ──────────────────────────────────────
function PasswordCard() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      apiClient.put('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword:     data.newPassword,
      }),
    onSuccess: () => {
      toast({ title: '✅ Mot de passe modifié', description: 'Reconnectez-vous avec votre nouveau mot de passe' });
      reset();
    },
    onError: (err: any) => {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message ?? 'Erreur lors du changement',
        variant: 'destructive',
      });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="w-4 h-4" />
          Changer le mot de passe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1">
            <Label>Mot de passe actuel *</Label>
            <Input type="password" {...register('currentPassword')} />
            {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Nouveau mot de passe *</Label>
            <Input type="password" {...register('newPassword')} />
            {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
            <p className="text-xs text-muted-foreground">Min. 8 caractères, 1 majuscule, 1 chiffre</p>
          </div>
          <div className="space-y-1">
            <Label>Confirmer le nouveau mot de passe *</Label>
            <Input type="password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Changer le mot de passe
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Agency Card ────────────────────────────────────────
function AgencyCard({ agency }: { agency: any }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="w-4 h-4" />
          Informations de l'agence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Nom de l'agence</p>
            <p className="font-medium">{agency.name}</p>
          </div>
          {agency.city && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Ville</p>
              <p className="font-medium">{agency.city}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-muted-foreground">Agence active</span>
        </div>
      </CardContent>
    </Card>
  );
}

