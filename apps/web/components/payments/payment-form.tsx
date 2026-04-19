'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '@/lib/api/client';
import { reservationsApi } from '@/lib/api/reservations';
import { toast } from '@/hooks/use-toast';
import { formatMAD } from '@/lib/utils';
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
  reservationId: z.string().min(1, 'Réservation requise'),
  amount:        z.number().positive('Montant requis'),
  type:          z.enum(['RENTAL', 'DEPOSIT', 'EXTRA', 'REFUND']),
  method:        z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE']),
  reference:     z.string().optional(),
  notes:         z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function PaymentForm() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'RENTAL', method: 'CASH' },
  });

  const selectedReservationId = watch('reservationId');

  // Load active reservations
  const { data: reservationsData } = useQuery({
    queryKey: ['reservations-for-payment'],
    queryFn: () =>
      reservationsApi.getAll({ limit: 100, status: 'CONFIRMED' })
        .then((r) => r.data.data),
    enabled: open,
  });

  // Load also ACTIVE reservations
  const { data: activeReservationsData } = useQuery({
    queryKey: ['reservations-active-for-payment'],
    queryFn: () =>
      reservationsApi.getAll({ limit: 100, status: 'ACTIVE' })
        .then((r) => r.data.data),
    enabled: open,
  });

  const allReservations = [
    ...(reservationsData ?? []),
    ...(activeReservationsData ?? []),
  ];

  const selectedRes = allReservations.find((r: any) => r.id === selectedReservationId);

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiClient.post('/payments', data),
    onSuccess: () => {
      toast({ title: '✅ Paiement enregistré' });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments-summary'] });
      reset();
      setOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message ?? 'Erreur lors de l\'enregistrement',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Enregistrer un paiement
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">

          {/* Réservation */}
          <div className="space-y-1">
            <Label>Réservation *</Label>
            <Select onValueChange={(v) => {
              setValue('reservationId', v);
              const res = allReservations.find((r: any) => r.id === v);
              if (res) setValue('amount', Number(res.totalAmount));
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une réservation" />
              </SelectTrigger>
              <SelectContent>
                {allReservations.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    Aucune réservation confirmée/active
                  </SelectItem>
                ) : allReservations.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.reservationNumber} — {r.client?.firstName} {r.client?.lastName} ({formatMAD(r.totalAmount)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.reservationId && <p className="text-xs text-destructive">{errors.reservationId.message}</p>}
          </div>

          {/* Info réservation sélectionnée */}
          {selectedRes && (
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Véhicule</span>
                <span className="font-medium">{selectedRes.car?.brand} {selectedRes.car?.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant total</span>
                <span className="font-bold text-primary">{formatMAD(selectedRes.totalAmount)}</span>
              </div>
            </div>
          )}

          {/* Type */}
          <div className="space-y-1">
            <Label>Type de paiement *</Label>
            <Select defaultValue="RENTAL" onValueChange={(v) => setValue('type', v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RENTAL">Location</SelectItem>
                <SelectItem value="DEPOSIT">Caution</SelectItem>
                <SelectItem value="EXTRA">Supplément</SelectItem>
                <SelectItem value="REFUND">Remboursement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Méthode */}
          <div className="space-y-1">
            <Label>Mode de paiement *</Label>
            <Select defaultValue="CASH" onValueChange={(v) => setValue('method', v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Espèces</SelectItem>
                <SelectItem value="CARD">Carte bancaire</SelectItem>
                <SelectItem value="BANK_TRANSFER">Virement bancaire</SelectItem>
                <SelectItem value="CHEQUE">Chèque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Montant */}
          <div className="space-y-1">
            <Label>Montant (MAD) *</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          {/* Référence */}
          <div className="space-y-1">
            <Label>Référence</Label>
            <Input placeholder="N° chèque, reçu…" {...register('reference')} />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input placeholder="Remarques…" {...register('notes')} />
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
