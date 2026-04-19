'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { reservationsApi } from '@/lib/api/reservations';
import apiClient from '@/lib/api/client';
import { toast } from '@/hooks/use-toast';
import { formatMAD } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Car, User, CalendarDays, MapPin, CreditCard, FileText } from 'lucide-react';

// ── Zod Schema ──────────────────────────────────────────────────────
const schema = z.object({
  // Client
  clientFirstName: z.string().min(2, 'Prénom requis'),
  clientLastName:  z.string().min(2, 'Nom requis'),
  clientPhone:     z.string().min(8, 'Téléphone requis'),
  clientCin:       z.string().optional(),

  // Vehicle
  carBrand:        z.string().min(1, 'Marque requise'),
  carModel:        z.string().min(1, 'Modèle requis'),
  carLicensePlate: z.string().optional(),
  carYear:         z.number({ invalid_type_error: 'Année invalide' }).int().min(1980).max(new Date().getFullYear() + 1),
  carPricePerDay:  z.number({ invalid_type_error: 'Prix invalide' }).positive('Prix/jour requis'),

  // Dates
  startDate: z.string().min(1, 'Date début requise'),
  endDate:   z.string().min(1, 'Date fin requise'),

  // Locations
  pickupLocation: z.string().optional(),
  returnLocation: z.string().optional(),

  // Payment
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER']),
  amountPaid:    z.number().min(0).default(0),

  // Status & notes
  status: z.enum(['PENDING', 'CONFIRMED']).default('PENDING'),
  notes:  z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ── Section header ──────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────
export function ReservationForm() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const {
    register, handleSubmit, reset, watch, control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      paymentMethod: 'CASH',
      status: 'PENDING',
      amountPaid: 0,
      carPricePerDay: 0,
      carYear: new Date().getFullYear(),
    },
  });

  const startDate    = watch('startDate');
  const endDate      = watch('endDate');
  const pricePerDay  = watch('carPricePerDay') ?? 0;
  const amountPaid   = watch('amountPaid') ?? 0;

  const totalDays = (() => {
    if (!startDate || !endDate) return 0;
    const d = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
    return d > 0 ? d : 0;
  })();
  const totalAmount     = pricePerDay * totalDays;
  const remainingAmount = Math.max(0, totalAmount - amountPaid);

  // ── Find-or-create client ───────────────────────────────────────
  async function findOrCreateClient(data: FormData): Promise<string> {
    const cin = data.clientCin?.trim();

    if (cin) {
      // Search by CIN
      const res = await apiClient.get('/clients', { params: { search: cin, limit: 10 } });
      const found = (res.data.data ?? []).find((c: any) =>
        c.cin?.toLowerCase() === cin.toLowerCase()
      );
      if (found) return found.id;
    } else {
      // Search by phone
      const res = await apiClient.get('/clients', { params: { search: data.clientPhone, limit: 10 } });
      const found = (res.data.data ?? []).find((c: any) => c.phone === data.clientPhone);
      if (found) return found.id;
    }

    // Create new client
    const created = await apiClient.post('/clients', {
      firstName: data.clientFirstName,
      lastName:  data.clientLastName,
      phone:     data.clientPhone,
      cin:       cin || `NC-${Date.now()}`,
    });
    return created.data.data.id;
  }

  // ── Find fleet car or create reservation-only car ────────────
  async function findOrCreateCar(data: FormData): Promise<string> {
    const plate = data.carLicensePlate?.trim();

    // 1. Search by license plate if provided
    if (plate) {
      const res = await apiClient.get('/cars', { params: { search: plate, limit: 20 } });
      const found = (res.data.data ?? []).find((c: any) =>
        c.licensePlate?.toLowerCase() === plate.toLowerCase()
      );
      if (found) return found.id;
    }

    // 2. Search fleet by brand + model + year
    const res2 = await apiClient.get('/cars', {
      params: { search: data.carBrand, limit: 50 },
    });
    const match = (res2.data.data ?? []).find((c: any) =>
      c.brand?.toLowerCase() === data.carBrand.toLowerCase() &&
      c.model?.toLowerCase() === data.carModel.toLowerCase() &&
      c.year === data.carYear
    );
    if (match) return match.id;

    // 3. Create new car invisible in fleet
    const created = await apiClient.post('/cars', {
      brand:        data.carBrand,
      model:        data.carModel,
      licensePlate: plate || `NI-${Date.now()}`,
      year:         data.carYear,
      pricePerDay:  data.carPricePerDay,
      isActive:     false,
    });
    return created.data.data.id;
  }

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const [clientId, carId] = await Promise.all([
        findOrCreateClient(data),
        findOrCreateCar(data),
      ]);

      return reservationsApi.create({
        clientId,
        carId,
        startDate:       new Date(data.startDate).toISOString(),
        endDate:         new Date(data.endDate).toISOString(),
        pickupLocation:  data.pickupLocation || undefined,
        returnLocation:  data.returnLocation || undefined,
        discountPercent: 0,
        status:          data.status as any,
        notes:           data.notes || undefined,
        amountPaid:      data.amountPaid,
        paymentMethod:   data.paymentMethod,
      });
    },
    onSuccess: () => {
      toast({ title: '✅ Réservation créée avec succès' });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reservations-stats'] });
      qc.invalidateQueries({ queryKey: ['cars'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
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
          Nouvelle réservation
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Nouvelle réservation
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6 mt-2">

          {/* ── 1. Client ── */}
          <Section icon={User} title="Informations client">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Prénom *</Label>
                <Input placeholder="Mohamed" {...register('clientFirstName')} className="h-9" />
                {errors.clientFirstName && <p className="text-xs text-destructive">{errors.clientFirstName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nom *</Label>
                <Input placeholder="Alami" {...register('clientLastName')} className="h-9" />
                {errors.clientLastName && <p className="text-xs text-destructive">{errors.clientLastName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Téléphone *</Label>
                <Input placeholder="0612345678" {...register('clientPhone')} className="h-9" />
                {errors.clientPhone && <p className="text-xs text-destructive">{errors.clientPhone.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CIN <span className="text-muted-foreground">(optionnel)</span></Label>
                <Input placeholder="A123456" {...register('clientCin')} className="h-9" />
              </div>
            </div>
          </Section>

          {/* ── 2. Véhicule ── */}
          <Section icon={Car} title="Informations véhicule">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Marque *</Label>
                <Input placeholder="Dacia" {...register('carBrand')} className="h-9" />
                {errors.carBrand && <p className="text-xs text-destructive">{errors.carBrand.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Modèle *</Label>
                <Input placeholder="Logan" {...register('carModel')} className="h-9" />
                {errors.carModel && <p className="text-xs text-destructive">{errors.carModel.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Année *</Label>
                <Input
                  type="number"
                  placeholder="2022"
                  {...register('carYear', { valueAsNumber: true })}
                  className="h-9"
                />
                {errors.carYear && <p className="text-xs text-destructive">{errors.carYear.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Immatriculation <span className="text-muted-foreground">(optionnel)</span></Label>
                <Input placeholder="123456-A-1" {...register('carLicensePlate')} className="h-9" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prix par jour (MAD) *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="350.00"
                {...register('carPricePerDay', { valueAsNumber: true })}
                className="h-9"
              />
              {errors.carPricePerDay && <p className="text-xs text-destructive">{errors.carPricePerDay.message}</p>}
            </div>
          </Section>

          {/* ── 3. Dates ── */}
          <Section icon={CalendarDays} title="Dates de location">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date de prise en charge *</Label>
                <Input
                  type="date"
                  {...register('startDate')}
                  min={new Date().toISOString().split('T')[0]}
                  className="h-9"
                />
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date de retour *</Label>
                <Input
                  type="date"
                  {...register('endDate')}
                  min={startDate || new Date().toISOString().split('T')[0]}
                  className="h-9"
                />
                {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
              </div>
            </div>
            {totalDays > 0 && (
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <CalendarDays className="w-3.5 h-3.5" />
                {totalDays} jour{totalDays > 1 ? 's' : ''} de location
              </div>
            )}
          </Section>

          {/* ── 4. Lieux ── */}
          <Section icon={MapPin} title="Lieux de livraison">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Lieu de prise en charge</Label>
                <Input
                  placeholder="Ex: Agence, Aéroport…"
                  {...register('pickupLocation')}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lieu de retour</Label>
                <Input
                  placeholder="Ex: Agence, Hôtel…"
                  {...register('returnLocation')}
                  className="h-9"
                />
              </div>
            </div>
          </Section>

          {/* ── 5. Paiement ── */}
          <Section icon={CreditCard} title="Paiement">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Méthode de paiement</Label>
                <Controller
                  name="paymentMethod"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">💵 Espèces</SelectItem>
                        <SelectItem value="BANK_TRANSFER">🏦 Virement bancaire</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Montant versé (MAD)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  {...register('amountPaid', { valueAsNumber: true })}
                  className="h-9"
                />
              </div>
            </div>

            {totalDays > 0 && (
              <div className="bg-muted/60 rounded-xl p-4 space-y-2 text-sm border">
                <div className="flex justify-between text-muted-foreground">
                  <span>{totalDays} jour{totalDays > 1 ? 's' : ''} × {formatMAD(pricePerDay)}</span>
                  <span>{formatMAD(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Montant versé</span>
                  <span className="text-green-600 font-medium">− {formatMAD(amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2 text-base">
                  <span>Reste à payer</span>
                  <span className={remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                    {formatMAD(remainingAmount)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-primary">
                  <span>Total location</span>
                  <span>{formatMAD(totalAmount)}</span>
                </div>
              </div>
            )}
          </Section>

          {/* ── 6. Statut ── */}
          <Section icon={CalendarDays} title="Statut de la réservation">
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">
                      <span className="text-yellow-600">En attente</span>
                    </SelectItem>
                    <SelectItem value="CONFIRMED">
                      <span className="text-green-600">Confirmée</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Section>

          {/* ── 7. Notes ── */}
          <Section icon={FileText} title="Notes internes">
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Remarques, instructions spéciales…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </Section>

          {/* ── Buttons ── */}
          <div className="flex gap-3 pt-2 border-t">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Création en cours…</>
                : <><Plus className="w-4 h-4 mr-2" />Créer la réservation</>
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
