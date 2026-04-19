'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '@/lib/api/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';

const schema = z.object({
  firstName:      z.string().min(2, 'Prénom requis'),
  lastName:       z.string().min(2, 'Nom requis'),
  cin:            z.string().min(5, 'CIN requis'),
  phone:          z.string().min(8, 'Téléphone requis'),
  email:          z.string().email('Email invalide').optional().or(z.literal('')),
  passportNumber: z.string().optional(),
  city:           z.string().optional(),
  address:        z.string().optional(),
  licenseNumber:  z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function ClientForm() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiClient.post('/clients', {
      ...data,
      email:          data.email          || null,
      city:           data.city           || null,
      address:        data.address        || null,
      licenseNumber:  data.licenseNumber  || null,
      passportNumber: data.passportNumber || null,
    }),
    onSuccess: () => {
      toast({ title: '✅ Client créé avec succès' });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
      reset();
      setOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message ?? 'Erreur lors de la création',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau client
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">

          {/* Nom / Prénom */}
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

          {/* CIN + Passeport */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>CIN *</Label>
              <Input placeholder="A123456" {...register('cin')} />
              {errors.cin && <p className="text-xs text-destructive">{errors.cin.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>N° Passeport</Label>
              <Input placeholder="AB1234567" {...register('passportNumber')} />
            </div>
          </div>

          {/* Téléphone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Téléphone *</Label>
              <Input placeholder="0612345678" {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" placeholder="client@email.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          {/* Ville + Adresse */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Ville</Label>
              <Input placeholder="Casablanca" {...register('city')} />
            </div>
            <div className="space-y-1">
              <Label>Adresse</Label>
              <Input placeholder="123 Rue Mohammed V" {...register('address')} />
            </div>
          </div>

          {/* Permis */}
          <div className="space-y-1">
            <Label>N° Permis de conduire</Label>
            <Input placeholder="C123456" {...register('licenseNumber')} />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
