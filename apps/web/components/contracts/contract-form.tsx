'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { reservationsApi } from '@/lib/api/reservations';
import { carsApi } from '@/lib/api/cars';
import apiClient from '@/lib/api/client';
import { toast } from '@/hooks/use-toast';
import { formatMAD } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Loader2, Car, User, CalendarDays, MapPin,
  CreditCard, FileText, Copy, Search, Gauge, Fuel,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Schema ──────────────────────────────────────────────────────────
const schema = z.object({
  clientId:       z.string().min(1, 'Client requis'),
  carId:          z.string().min(1, 'Véhicule requis'),
  brandFilter:    z.string().optional(),
  startDate:      z.string().min(1, 'Date début requise'),
  endDate:        z.string().min(1, 'Date fin requise'),
  pricePerDay:    z.number().positive('Prix requis'),
  pickupLocation: z.string().optional(),
  returnLocation: z.string().optional(),
  // Vehicle state
  startMileage:   z.number().int().min(0).optional(),
  fuelLevelStart: z.string().optional(),
  // Payment
  paymentMethod:  z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
  amountPaid:     z.number().min(0).default(0),
  discountPercent:z.number().min(0).max(100).default(0),
  // 2ème conducteur
  secondDriverFirstName: z.string().optional(),
  secondDriverLastName:  z.string().optional(),
  secondDriverCin:       z.string().optional(),
  secondDriverPhone:     z.string().optional(),
  // Status
  status:         z.enum(['CONFIRMED', 'ACTIVE']).default('CONFIRMED'),
  notes:          z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const LOCATION_PRESETS = ['Agence', 'Aéroport', 'Hôtel', 'Domicile'];
const FUEL_LEVELS = [
  { value: 'empty',   label: 'Vide' },
  { value: '1/4',     label: '1/4' },
  { value: '1/2',     label: '1/2' },
  { value: '3/4',     label: '3/4' },
  { value: 'full',    label: 'Plein' },
];
const PAYMENT_METHODS = [
  { value: 'CASH',          label: 'Espèces' },
  { value: 'CARD',          label: 'Carte' },
  { value: 'BANK_TRANSFER', label: 'Virement' },
  { value: 'CHEQUE',        label: 'Chèque' },
];

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

export function ContractForm() {
  const [open, setOpen]                         = useState(false);
  const [clientSearch, setClientSearch]         = useState('');
  const [secondDriverSearch, setSecondDriverSearch] = useState('');
  const [pickupCustom, setPickupCustom]         = useState(false);
  const [returnCustom, setReturnCustom]         = useState(false);
  const qc = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      brandFilter: '',
      paymentMethod: 'CASH',
      amountPaid: 0,
      discountPercent: 0,
      status: 'ACTIVE',
      fuelLevelStart: 'full',
    },
  });

  const { watch, setValue, control, register, handleSubmit, reset, formState: { errors } } = form;
  const brandFilter    = watch('brandFilter');
  const carId          = watch('carId');
  const startDate      = watch('startDate');
  const endDate        = watch('endDate');
  const pricePerDay    = watch('pricePerDay') ?? 0;
  const discountPct    = watch('discountPercent') ?? 0;
  const amountPaid     = watch('amountPaid') ?? 0;
  const status         = watch('status');

  // Derived totals
  const totalDays   = (startDate && endDate)
    ? Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
    : 0;
  const subtotal    = pricePerDay * totalDays;
  const discount    = (subtotal * discountPct) / 100;
  const total       = subtotal - discount;
  const remaining   = Math.max(0, total - amountPaid);

  // Fetch clients (search)
  const { data: clientsData } = useQuery({
    queryKey: ['clients-search', clientSearch],
    queryFn: () => apiClient.get('/clients', { params: { search: clientSearch || undefined, limit: 50 } }).then(r => r.data),
    enabled: open,
  });

  // Fetch available cars
  const { data: carsData } = useQuery({
    queryKey: ['cars-available'],
    queryFn: () => carsApi.getAll({ status: 'AVAILABLE', limit: 100 }).then(r => r.data),
    enabled: open,
  });

  const clients = clientsData?.data ?? [];
  const allCars = carsData?.data ?? [];

  // Unique brands from available cars
  const brands = Array.from(new Set(allCars.map((c: any) => c.brand))).sort() as string[];
  const filteredCars = brandFilter
    ? allCars.filter((c: any) => c.brand === brandFilter)
    : allCars;

  // Auto-fill price when car changes
  useEffect(() => {
    if (!carId) return;
    const car = allCars.find((c: any) => c.id === carId);
    if (car) setValue('pricePerDay', Number(car.pricePerDay));
  }, [carId, allCars]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const startMileage = data.startMileage;
      const res = await reservationsApi.create({
        carId:           data.carId,
        clientId:        data.clientId,
        startDate:       new Date(data.startDate).toISOString(),
        endDate:         new Date(data.endDate).toISOString(),
        pickupLocation:  data.pickupLocation,
        returnLocation:  data.returnLocation,
        pricePerDay:     data.pricePerDay,
        discountPercent: data.discountPercent,
        amountPaid:      data.amountPaid,
        paymentMethod:   data.paymentMethod,
        notes:                 data.notes,
        status:                'CONFIRMED',
        isContract:            true,
        secondDriverFirstName: data.secondDriverFirstName || undefined,
        secondDriverLastName:  data.secondDriverLastName  || undefined,
        secondDriverCin:       data.secondDriverCin       || undefined,
        secondDriverPhone:     data.secondDriverPhone      || undefined,
      });
      const resId = res.data?.data?.id;

      // If status = ACTIVE → activate directly (already CONFIRMED)
      if (data.status === 'ACTIVE' && resId) {
        await reservationsApi.activate(resId, startMileage);
      }

      return res;
    },
    onSuccess: () => {
      toast({ title: 'Contrat créé avec succès' });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      qc.invalidateQueries({ queryKey: ['cars-available'] });
      setOpen(false);
      reset();
      setClientSearch('');
      setPickupCustom(false);
      setReturnCustom(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message ?? 'Impossible de créer le contrat',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

  const selectedClientId = watch('clientId');

  const filteredClients = clientSearch
    ? clients.filter((c: any) =>
        `${c.firstName} ${c.lastName} ${c.cin} ${c.phone}`
          .toLowerCase()
          .includes(clientSearch.toLowerCase())
      )
    : clients;

  // 2nd driver: same client list but exclude the main client
  const filteredSecondDriverClients = clients.filter((c: any) => {
    if (c.id === selectedClientId) return false; // exclude main client
    if (!secondDriverSearch) return true;
    return `${c.firstName} ${c.lastName} ${c.cin} ${c.phone}`
      .toLowerCase()
      .includes(secondDriverSearch.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { reset(); setClientSearch(''); setSecondDriverSearch(''); } }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Nouveau contrat
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Nouveau contrat de location
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">

          {/* ── 1. Client ── */}
          <Section icon={User} title="Locataire">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, CIN, téléphone…"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className="pl-9 mb-2"
              />
            </div>
            <Controller name="clientId" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className={errors.clientId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {filteredClients.length === 0 && (
                    <div className="py-4 text-center text-sm text-muted-foreground">Aucun client trouvé</div>
                  )}
                  {filteredClients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-medium">{c.firstName} {c.lastName}</span>
                      <span className="ml-2 text-xs text-muted-foreground font-mono">{c.cin}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
            {errors.clientId && <p className="text-xs text-red-500">{errors.clientId.message}</p>}
          </Section>

          {/* ── 2. Véhicule ── */}
          <Section icon={Car} title="Véhicule">
            {brands.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button type="button"
                  onClick={() => setValue('brandFilter', '')}
                  className={cn('px-2.5 py-1 text-xs rounded-full border transition-colors',
                    !brandFilter ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'
                  )}>Tous</button>
                {brands.map((b) => (
                  <button key={b} type="button"
                    onClick={() => { setValue('brandFilter', b); setValue('carId', ''); }}
                    className={cn('px-2.5 py-1 text-xs rounded-full border transition-colors',
                      brandFilter === b ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'
                    )}>{b}</button>
                ))}
              </div>
            )}
            <Controller name="carId" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className={errors.carId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Sélectionner un véhicule disponible" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCars.length === 0 && (
                    <div className="py-4 text-center text-sm text-muted-foreground">Aucun véhicule disponible</div>
                  )}
                  {filteredCars.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-medium">{c.brand} {c.model}</span>
                      <span className="ml-2 text-xs font-mono text-muted-foreground">{c.licensePlate}</span>
                      <span className="ml-2 text-xs text-green-600">{formatMAD(c.pricePerDay)}/j</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
            {errors.carId && <p className="text-xs text-red-500">{errors.carId.message}</p>}
            {carId && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Prix/jour (MAD)</Label>
                <Input
                  type="number"
                  className="w-32 h-8 text-sm"
                  {...register('pricePerDay', { valueAsNumber: true })}
                />
              </div>
            )}
          </Section>

          {/* ── 3. Période ── */}
          <Section icon={CalendarDays} title="Période de location">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date de départ</Label>
                <Input type="datetime-local" {...register('startDate')}
                  className={errors.startDate ? 'border-red-500' : ''} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date de retour prévue</Label>
                <Input type="datetime-local" {...register('endDate')}
                  className={errors.endDate ? 'border-red-500' : ''} />
              </div>
            </div>
            {totalDays > 0 && (
              <p className="text-xs text-muted-foreground">
                Durée : <span className="font-semibold text-foreground">{totalDays} jour(s)</span>
              </p>
            )}
            {/* Locations */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs">Lieu de prise en charge</Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {LOCATION_PRESETS.map(p => (
                    <button key={p} type="button"
                      onClick={() => { setValue('pickupLocation', p); setPickupCustom(p === 'Personnalisé'); }}
                      className="px-2 py-0.5 text-[11px] rounded border border-input hover:bg-muted transition-colors">
                      {p}
                    </button>
                  ))}
                </div>
                <Input placeholder="ex: Agence, Aéroport…" {...register('pickupLocation')} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lieu de retour</Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {LOCATION_PRESETS.map(p => (
                    <button key={p} type="button"
                      onClick={() => setValue('returnLocation', p)}
                      className="px-2 py-0.5 text-[11px] rounded border border-input hover:bg-muted transition-colors">
                      {p}
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => {
                      const v = watch('pickupLocation');
                      if (v) setValue('returnLocation', v);
                    }}
                    className="px-2 py-0.5 text-[11px] rounded border border-dashed border-primary text-primary hover:bg-primary/10 transition-colors flex items-center gap-1">
                    <Copy className="w-2.5 h-2.5" /> Copier départ
                  </button>
                </div>
                <Input placeholder="ex: Agence, Aéroport…" {...register('returnLocation')} className="h-8 text-sm" />
              </div>
            </div>
          </Section>

          {/* ── 4. État du véhicule ── */}
          <Section icon={Gauge} title="État du véhicule au départ">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Kilométrage départ</Label>
                <Input
                  type="number"
                  placeholder="ex: 45000"
                  {...register('startMileage', { valueAsNumber: true })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Niveau carburant</Label>
                <Controller name="fuelLevelStart" control={control} render={({ field }) => (
                  <div className="flex gap-1">
                    {FUEL_LEVELS.map(f => (
                      <button key={f.value} type="button"
                        onClick={() => field.onChange(f.value)}
                        className={cn(
                          'flex-1 py-1.5 text-[11px] rounded border transition-colors',
                          field.value === f.value
                            ? 'bg-primary text-primary-foreground border-primary font-medium'
                            : 'border-input hover:bg-muted'
                        )}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )} />
              </div>
            </div>
          </Section>

          {/* ── 5. Tarification ── */}
          <Section icon={CreditCard} title="Tarification & paiement">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Remise (%)</Label>
                <Input type="number" min="0" max="100" step="1"
                  {...register('discountPercent', { valueAsNumber: true })}
                  className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mode de règlement</Label>
                <Controller name="paymentMethod" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Montant versé (MAD)</Label>
                <Input type="number" min="0" step="0.01"
                  {...register('amountPaid', { valueAsNumber: true })}
                  className="h-9" />
              </div>
            </div>

            {totalDays > 0 && pricePerDay > 0 && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1.5 mt-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{formatMAD(pricePerDay)} × {totalDays} j</span>
                  <span className="font-medium">{formatMAD(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Remise ({discountPct}%)</span>
                    <span>- {formatMAD(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1.5">
                  <span>Total</span>
                  <span>{formatMAD(total)}</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>Versé</span>
                  <span>{formatMAD(amountPaid)}</span>
                </div>
                <div className="flex justify-between font-semibold text-orange-600">
                  <span>Reste à payer</span>
                  <span>{formatMAD(remaining)}</span>
                </div>
              </div>
            )}
          </Section>

          {/* ── 6. Statut ── */}
          <Section icon={FileText} title="Statut du contrat">
            <Controller name="status" control={control} render={({ field }) => (
              <div className="flex gap-3">
                {[
                  { value: 'CONFIRMED', label: 'Confirmé', desc: 'Voiture pas encore remise', color: 'border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-300' },
                  { value: 'ACTIVE',    label: 'Actif',    desc: 'Voiture déjà remise au client', color: 'border-green-400 text-green-700 bg-green-50 dark:bg-green-500/10 dark:text-green-300' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      'flex-1 p-3 rounded-lg border-2 text-left transition-all',
                      field.value === opt.value ? opt.color : 'border-input hover:bg-muted'
                    )}>
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            )} />
            {status === 'ACTIVE' && (
              <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 rounded p-2 border border-green-200 dark:border-green-800">
                La voiture sera marquée comme "En location" et le kilométrage de départ sera enregistré.
              </p>
            )}
          </Section>

          {/* ── 7. 2ème conducteur ── */}
          <Section icon={User} title="2ème conducteur (optionnel)">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, CIN, téléphone…"
                value={secondDriverSearch}
                onChange={e => setSecondDriverSearch(e.target.value)}
                className="pl-9 mb-2"
              />
            </div>
            <Select
              value={watch('secondDriverCin') ? '__selected__' : ''}
              onValueChange={(clientId) => {
                if (clientId === '__clear__') {
                  setValue('secondDriverFirstName', '');
                  setValue('secondDriverLastName', '');
                  setValue('secondDriverCin', '');
                  setValue('secondDriverPhone', '');
                  return;
                }
                const c = clients.find((x: any) => x.id === clientId);
                if (c) {
                  setValue('secondDriverFirstName', c.firstName);
                  setValue('secondDriverLastName',  c.lastName);
                  setValue('secondDriverCin',       c.cin);
                  setValue('secondDriverPhone',     c.phone ?? '');
                }
              }}
            >
              <SelectTrigger>
                {watch('secondDriverCin')
                  ? <span>{watch('secondDriverFirstName')} {watch('secondDriverLastName')} <span className="text-xs text-muted-foreground font-mono ml-1">{watch('secondDriverCin')}</span></span>
                  : <SelectValue placeholder="Sélectionner un client" />
                }
              </SelectTrigger>
              <SelectContent>
                {watch('secondDriverCin') && (
                  <SelectItem value="__clear__">
                    <span className="text-muted-foreground italic">— Aucun 2ème conducteur —</span>
                  </SelectItem>
                )}
                {filteredSecondDriverClients.length === 0 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">Aucun client trouvé</div>
                )}
                {filteredSecondDriverClients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="font-medium">{c.firstName} {c.lastName}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{c.cin}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>

          {/* ── 8. Notes ── */}
          <Section icon={FileText} title="Notes (optionnel)">
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Remarques, conditions particulières…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Section>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <FileText className="w-4 h-4 mr-2" />
              Créer le contrat
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
