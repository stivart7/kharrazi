'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  Package, Check, Pencil, Zap, Shield, Star,
  Car, Users, Calendar, BarChart3, MessageSquare, Wrench,
  HardDrive, Headphones, Globe,
} from 'lucide-react';

// ── Plan definitions (local — no backend needed yet) ──
const DEFAULT_PLANS = [
  {
    id:          'basic',
    name:        'Basic',
    price:       299,
    color:       'slate',
    icon:        Package,
    description: 'Idéal pour les petites agences débutantes',
    highlight:   false,
    features: [
      { label: 'Jusqu\'à 10 véhicules',       icon: Car,           included: true  },
      { label: '2 utilisateurs',               icon: Users,         included: true  },
      { label: 'Réservations illimitées',      icon: Calendar,      included: true  },
      { label: 'Rapports basiques',            icon: BarChart3,     included: true  },
      { label: 'Notifications WhatsApp',       icon: MessageSquare, included: false },
      { label: 'Suivi maintenance',            icon: Wrench,        included: false },
      { label: 'Export CSV / PDF',             icon: HardDrive,     included: false },
      { label: 'Support prioritaire',          icon: Headphones,    included: false },
      { label: 'Sous-domaine personnalisé',    icon: Globe,         included: false },
    ],
    limits: { vehicles: 10, users: 2 },
  },
  {
    id:          'pro',
    name:        'Pro',
    price:       599,
    color:       'blue',
    icon:        Zap,
    description: 'Pour les agences en croissance avec plus de besoins',
    highlight:   true,
    features: [
      { label: 'Jusqu\'à 50 véhicules',       icon: Car,           included: true  },
      { label: '10 utilisateurs',              icon: Users,         included: true  },
      { label: 'Réservations illimitées',      icon: Calendar,      included: true  },
      { label: 'Rapports avancés',             icon: BarChart3,     included: true  },
      { label: 'Notifications WhatsApp',       icon: MessageSquare, included: true  },
      { label: 'Suivi maintenance',            icon: Wrench,        included: true  },
      { label: 'Export CSV / PDF',             icon: HardDrive,     included: true  },
      { label: 'Support prioritaire',          icon: Headphones,    included: false },
      { label: 'Sous-domaine personnalisé',    icon: Globe,         included: false },
    ],
    limits: { vehicles: 50, users: 10 },
  },
  {
    id:          'enterprise',
    name:        'Enterprise',
    price:       1299,
    color:       'violet',
    icon:        Shield,
    description: 'Pour les grandes agences avec des besoins spécifiques',
    highlight:   false,
    features: [
      { label: 'Véhicules illimités',          icon: Car,           included: true  },
      { label: 'Utilisateurs illimités',       icon: Users,         included: true  },
      { label: 'Réservations illimitées',      icon: Calendar,      included: true  },
      { label: 'Rapports & analytics complets',icon: BarChart3,     included: true  },
      { label: 'Notifications WhatsApp',       icon: MessageSquare, included: true  },
      { label: 'Suivi maintenance',            icon: Wrench,        included: true  },
      { label: 'Export CSV / PDF',             icon: HardDrive,     included: true  },
      { label: 'Support prioritaire 24/7',     icon: Headphones,    included: true  },
      { label: 'Sous-domaine personnalisé',    icon: Globe,         included: true  },
    ],
    limits: { vehicles: -1, users: -1 },
  },
];

const COLOR_MAP: Record<string, {
  badge: string; card: string; btn: string; highlight: string; check: string; icon: string;
}> = {
  slate:  { badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', card: 'border-border', btn: 'bg-slate-700 hover:bg-slate-600 text-white', highlight: '', check: 'text-slate-600', icon: 'text-slate-500' },
  blue:   { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', card: 'border-blue-500 ring-2 ring-blue-500/20', btn: 'bg-blue-600 hover:bg-blue-500 text-white', highlight: 'bg-blue-600/10 dark:bg-blue-900/20', check: 'text-blue-600', icon: 'text-blue-500' },
  violet: { badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300', card: 'border-violet-300', btn: 'bg-violet-700 hover:bg-violet-600 text-white', highlight: '', check: 'text-violet-600', icon: 'text-violet-500' },
};

// ── Component ─────────────────────────────────────
export function PlansContent() {
  const { user } = useAuthStore();
  const [plans, setPlans]   = useState(DEFAULT_PLANS);
  const [editPlan, setEditPlan] = useState<typeof DEFAULT_PLANS[0] | null>(null);
  const [editPrice, setEditPrice] = useState('');

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Accès réservé au Super Administrateur
      </div>
    );
  }

  const savePrice = () => {
    const price = parseInt(editPrice, 10);
    if (isNaN(price) || price < 0) {
      toast({ title: 'Prix invalide', variant: 'destructive' });
      return;
    }
    setPlans((prev) => prev.map((p) => p.id === editPlan?.id ? { ...p, price } : p));
    toast({ title: `✅ Tarif ${editPlan?.name} mis à jour — ${price} MAD/mois` });
    setEditPlan(null);
  };

  const toggleFeature = (planId: string, featureLabel: string) => {
    setPlans((prev) => prev.map((p) => {
      if (p.id !== planId) return p;
      return {
        ...p,
        features: p.features.map((f) =>
          f.label === featureLabel ? { ...f, included: !f.included } : f
        ),
      };
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plans & Tarifs</h1>
          <p className="text-muted-foreground text-sm">
            Configurez les offres proposées aux agences clientes
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-full">
          <Star className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Les modifications s'appliquent aux nouveaux abonnements uniquement
          </span>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const cfg   = COLOR_MAP[plan.color] ?? COLOR_MAP.slate;
          const Icon  = plan.icon;
          return (
            <Card key={plan.id} className={`relative overflow-hidden ${cfg.card}`}>
              {plan.highlight && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
              )}
              <CardHeader className={`pb-4 ${plan.highlight ? cfg.highlight : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      plan.color === 'blue' ? 'bg-blue-600 text-white' :
                      plan.color === 'violet' ? 'bg-violet-600 text-white' :
                      'bg-slate-700 text-white'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      {plan.highlight && (
                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                          Populaire
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => { setEditPlan(plan); setEditPrice(String(plan.price)); }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Price */}
                <div className="mt-4">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold">{plan.price.toLocaleString('fr-MA')}</span>
                    <span className="text-sm text-muted-foreground mb-1">MAD/mois</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                </div>

                {/* Limits */}
                <div className="flex gap-3 mt-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                    {plan.limits.vehicles === -1 ? '∞ véhicules' : `≤${plan.limits.vehicles} véhicules`}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                    {plan.limits.users === -1 ? '∞ users' : `≤${plan.limits.users} users`}
                  </span>
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature) => {
                    const FIcon = feature.icon;
                    return (
                      <li
                        key={feature.label}
                        className={`flex items-center gap-2.5 text-sm cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1 transition-colors group ${!feature.included ? 'opacity-50' : ''}`}
                        onClick={() => toggleFeature(plan.id, feature.label)}
                        title="Cliquer pour activer/désactiver"
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          feature.included ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
                        }`}>
                          {feature.included
                            ? <Check className="w-3 h-3 text-green-600" />
                            : <span className="w-2 h-0.5 bg-muted-foreground/40 rounded-full" />}
                        </div>
                        <FIcon className={`w-3.5 h-3.5 flex-shrink-0 ${feature.included ? cfg.icon : 'text-muted-foreground/40'}`} />
                        <span className={feature.included ? '' : 'line-through text-muted-foreground'}>
                          {feature.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <Button className={`w-full mt-5 text-sm ${cfg.btn}`} disabled>
                  Plan {plan.name} actif
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison note */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground flex items-start gap-3">
          <Package className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground mb-1">À propos de la gestion des plans</p>
            <p>
              Les prix et fonctionnalités configurés ici servent de référence lors de l'onboarding de nouvelles agences.
              Chaque agence peut avoir un tarif personnalisé défini depuis la page <strong>Gestion des Agences</strong>.
              L'intégration Stripe permettra la facturation automatique dans une prochaine version.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit price dialog */}
      {editPlan && (
        <Dialog open onOpenChange={() => setEditPlan(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-500" />
                Modifier le tarif — {editPlan.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label>Prix mensuel (MAD)</Label>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && savePrice()}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Prix de référence lors de l'onboarding. Actuel : {editPlan.price.toLocaleString('fr-MA')} MAD/mois
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setEditPlan(null)}>Annuler</Button>
                <Button className="flex-1" onClick={savePrice}>Enregistrer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
