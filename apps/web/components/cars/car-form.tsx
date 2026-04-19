'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { carsApi } from '@/lib/api/cars';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';

const schema = z.object({
  brand:        z.string().min(1, 'Marque requise'),
  model:        z.string().min(1, 'Modèle requis'),
  year:         z.number({ invalid_type_error: 'Année requise' }).int().min(2000).max(new Date().getFullYear() + 1),
  licensePlate: z.string().min(1, 'Plaque requise'),
  color:        z.string().optional(),
  fuelType:     z.enum(['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID']),
  transmission: z.enum(['MANUAL', 'AUTOMATIC']),
  seats:        z.number({ invalid_type_error: 'Requis' }).int().min(2).max(9),
  doors:        z.number({ invalid_type_error: 'Requis' }).int().min(2).max(5),
  pricePerDay:  z.number({ invalid_type_error: 'Prix requis' }).positive('Prix doit être > 0'),
  deposit:      z.preprocess((v) => (typeof v === 'number' && isNaN(v) ? undefined : v), z.number().positive().optional()),
  mileage:      z.number({ invalid_type_error: 'Requis' }).int().min(0).default(0),
  description:  z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CarFormProps {
  car?: any;          // if provided → edit mode
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export function CarForm({ car, open: controlledOpen, onOpenChange }: CarFormProps) {
  const isEdit = !!car;
  const [internalOpen, setInternalOpen] = useState(false);
  const queryClient = useQueryClient();

  const open        = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen     = (v: boolean) => {
    onOpenChange ? onOpenChange(v) : setInternalOpen(v);
  };

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fuelType:     'GASOLINE',
      transmission: 'MANUAL',
      seats:        5,
      doors:        4,
      mileage:      0,
      year:         new Date().getFullYear(),
    },
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (open && isEdit && car) {
      reset({
        brand:        car.brand,
        model:        car.model,
        year:         car.year,
        licensePlate: car.licensePlate,
        color:        car.color ?? '',
        fuelType:     car.fuelType,
        transmission: car.transmission,
        seats:        car.seats,
        doors:        car.doors,
        pricePerDay:  Number(car.pricePerDay),
        deposit:      Number(car.deposit),
        mileage:      car.mileage ?? 0,
        description:  car.description ?? '',
      });
    } else if (open && !isEdit) {
      reset({
        fuelType: 'GASOLINE', transmission: 'MANUAL',
        seats: 5, doors: 4, mileage: 0,
        year: new Date().getFullYear(),
      });
    }
  }, [open, isEdit, car]);

  const createMutation = useMutation({
    mutationFn: (data: FormData) => carsApi.create({
      ...data,
      color:       data.color       || undefined,
      description: data.description || undefined,
    }),
    onSuccess: () => {
      toast({ title: '✅ Véhicule ajouté avec succès' });
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      queryClient.invalidateQueries({ queryKey: ['cars-stats'] });
      reset(); setOpen(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? 'Erreur lors de la création';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => carsApi.update(car.id, {
      ...data,
      color:       data.color       || undefined,
      description: data.description || undefined,
    }),
    onSuccess: () => {
      toast({ title: '✅ Véhicule modifié' });
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      queryClient.invalidateQueries({ queryKey: ['cars-stats'] });
      setOpen(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? 'Erreur modification';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const onSubmit  = (d: FormData) => isEdit ? updateMutation.mutate(d) : createMutation.mutate(d);

  const dialogContent = (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? `Modifier — ${car?.brand} ${car?.model}` : 'Ajouter un véhicule'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Marque *</Label>
            <Input placeholder="Toyota, Dacia…" {...register('brand')} />
            {errors.brand && <p className="text-xs text-destructive">{errors.brand.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Modèle *</Label>
            <Input placeholder="Corolla, Logan…" {...register('model')} />
            {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Année *</Label>
            <Input type="number" min={2000} max={new Date().getFullYear() + 1}
              {...register('year', { valueAsNumber: true })} />
            {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Plaque d'immatriculation *</Label>
            <Input placeholder="12345-A-1" {...register('licensePlate')} />
            {errors.licensePlate && <p className="text-xs text-destructive">{errors.licensePlate.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Couleur</Label>
          <Input placeholder="Blanc, Noir, Rouge…" {...register('color')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Carburant *</Label>
            <Controller name="fuelType" control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GASOLINE">Essence</SelectItem>
                    <SelectItem value="DIESEL">Diesel</SelectItem>
                    <SelectItem value="ELECTRIC">Électrique</SelectItem>
                    <SelectItem value="HYBRID">Hybride</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            {errors.fuelType && <p className="text-xs text-destructive">{errors.fuelType.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Boîte de vitesse *</Label>
            <Controller name="transmission" control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manuelle</SelectItem>
                    <SelectItem value="AUTOMATIC">Automatique</SelectItem>
                  </SelectContent>
                </Select>
              )} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nombre de places *</Label>
            <Input type="number" min={2} max={9} {...register('seats', { valueAsNumber: true })} />
            {errors.seats && <p className="text-xs text-destructive">{errors.seats.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Nombre de portes *</Label>
            <Input type="number" min={2} max={5} {...register('doors', { valueAsNumber: true })} />
            {errors.doors && <p className="text-xs text-destructive">{errors.doors.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Prix par jour (MAD) *</Label>
            <Input type="number" min={1} placeholder="350"
              {...register('pricePerDay', { valueAsNumber: true })} />
            {errors.pricePerDay && <p className="text-xs text-destructive">{errors.pricePerDay.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Caution (MAD)</Label>
            <Input type="number" min={1} placeholder="5000"
              {...register('deposit', { valueAsNumber: true })} />
            {errors.deposit && <p className="text-xs text-destructive">{errors.deposit.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Kilométrage actuel</Label>
          <Input type="number" min={0} placeholder="0"
            {...register('mileage', { valueAsNumber: true })} />
          {errors.mileage && <p className="text-xs text-destructive">{errors.mileage.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>Description</Label>
          <Input placeholder="Informations supplémentaires…" {...register('description')} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1"
            onClick={() => { reset(); setOpen(false); }}>
            Annuler
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {isEdit ? 'Enregistrer les modifications' : 'Ajouter le véhicule'}
          </Button>
        </div>
      </form>
    </DialogContent>
  );

  // Edit mode: controlled externally (no trigger button)
  if (isEdit) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  // Create mode: has its own trigger button
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un véhicule
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
