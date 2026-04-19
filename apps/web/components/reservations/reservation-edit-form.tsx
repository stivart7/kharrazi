'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { reservationsApi } from '@/lib/api/reservations';
import { toast } from '@/hooks/use-toast';
import { formatMAD } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CalendarDays, MapPin, FileText, Percent } from 'lucide-react';

const schema = z.object({
  startDate:       z.string().min(1, 'Requis'),
  endDate:         z.string().min(1, 'Requis'),
  pickupLocation:  z.string().optional(),
  returnLocation:  z.string().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  notes:           z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function toDateInput(iso: string) {
  return iso ? new Date(iso).toISOString().split('T')[0] : '';
}

interface Props {
  reservation: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ReservationEditForm({ reservation, open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (reservation && open) {
      reset({
        startDate:       toDateInput(reservation.startDate),
        endDate:         toDateInput(reservation.endDate),
        pickupLocation:  reservation.pickupLocation ?? '',
        returnLocation:  reservation.returnLocation ?? '',
        discountPercent: Number(reservation.discountPercent ?? 0),
        notes:           reservation.notes ?? '',
      });
    }
  }, [reservation, open]);

  const startDate      = watch('startDate');
  const endDate        = watch('endDate');
  const discountPct    = watch('discountPercent') ?? 0;

  const totalDays = (() => {
    if (!startDate || !endDate) return 0;
    const d = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
    return d > 0 ? d : 0;
  })();
  const pricePerDay  = Number(reservation?.pricePerDay ?? 0);
  const subtotal     = pricePerDay * totalDays;
  const discount     = (subtotal * discountPct) / 100;
  const total        = subtotal - discount;

  const mutation = useMutation({
    mutationFn: (data: FormData) => reservationsApi.update(reservation.id, {
      startDate:       new Date(data.startDate).toISOString(),
      endDate:         new Date(data.endDate).toISOString(),
      pickupLocation:  data.pickupLocation || '',
      returnLocation:  data.returnLocation || '',
      discountPercent: data.discountPercent,
      notes:           data.notes || '',
    }),
    onSuccess: () => {
      toast({ title: '✅ Réservation modifiée' });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reservations-stats'] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message ?? 'Erreur lors de la modification',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Modifier la réservation
            {reservation?.reservationNumber && (
              <span className="text-xs font-mono text-muted-foreground ml-1">
                — {reservation.reservationNumber}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {reservation && (
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 mb-1">
            <span className="font-medium text-foreground">
              {reservation.client?.firstName} {reservation.client?.lastName}
            </span>
            {' · '}
            {reservation.car?.brand} {reservation.car?.model}
            {reservation.car?.licensePlate && (
              <span className="font-mono ml-1 text-xs">({reservation.car.licensePlate})</span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5 mt-1">

          {/* Dates */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Dates</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date de début *</Label>
                <Input type="date" {...register('startDate')} className="h-9" />
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date de fin *</Label>
                <Input type="date" {...register('endDate')} min={startDate} className="h-9" />
                {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
              </div>
            </div>
            {totalDays > 0 && (
              <p className="text-xs text-primary font-medium">
                {totalDays} jour{totalDays > 1 ? 's' : ''} de location
              </p>
            )}
          </div>

          {/* Lieux */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b">
              <MapPin className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Lieux de livraison</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Lieu de prise en charge</Label>
                <Input placeholder="Ex: Agence, Aéroport…" {...register('pickupLocation')} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lieu de retour</Label>
                <Input placeholder="Ex: Agence, Hôtel…" {...register('returnLocation')} className="h-9" />
              </div>
            </div>
          </div>

          {/* Remise */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b">
              <Percent className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Remise</h3>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Remise (%)</Label>
              <Input
                type="number" min={0} max={100} step={1}
                placeholder="0"
                {...register('discountPercent', { valueAsNumber: true })}
                className="h-9 max-w-[140px]"
              />
            </div>
            {totalDays > 0 && (
              <div className="bg-muted/60 rounded-xl p-3 space-y-1.5 text-sm border">
                <div className="flex justify-between text-muted-foreground">
                  <span>{totalDays} j × {formatMAD(pricePerDay)}</span>
                  <span>{formatMAD(subtotal)}</span>
                </div>
                {discountPct > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Remise {discountPct}%</span>
                    <span className="text-green-600">− {formatMAD(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1.5 text-primary">
                  <span>Total</span>
                  <span>{formatMAD(total)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Notes</h3>
            </div>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Remarques, instructions spéciales…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1 border-t">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enregistrement…</>
                : 'Enregistrer les modifications'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
