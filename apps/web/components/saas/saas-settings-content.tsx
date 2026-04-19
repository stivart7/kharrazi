'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  Settings, Mail, MessageSquare, CreditCard, Palette,
  Globe, Shield, Bell, Save, CheckCircle, ExternalLink,
  Building2, Loader2,
} from 'lucide-react';

// ── Section wrapper ───────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ── Toggle row ────────────────────────────────────
function ToggleRow({ label, sub, value, onChange }: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-blue-600' : 'bg-muted-foreground/30'}`}
        style={{ height: '22px', width: '40px' }}
      >
        <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-[18px]' : ''}`}
          style={{ width: '18px', height: '18px' }} />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────
export function SaasSettingsContent() {
  const { user } = useAuthStore();

  // ── SMTP state ──
  const [smtp, setSmtp] = useState({
    host:     'smtp.gmail.com',
    port:     '587',
    user:     '',
    pass:     '',
    from:     'Kharrazi Fleet <noreply@kharrazi.ma>',
    enabled:  false,
  });

  // ── WhatsApp state ──
  const [wa, setWa] = useState({
    sid:     '',
    token:   '',
    from:    'whatsapp:+14155238886',
    enabled: false,
  });

  // ── Branding state ──
  const [brand, setBrand] = useState({
    name:    'Kharrazi Fleet',
    tagline: 'Location de voitures au Maroc',
    website: '',
    support: '',
  });

  // ── Notifications state ──
  const [notifs, setNotifs] = useState({
    newAgency:   true,
    expiring:    true,
    churn:       false,
    systemAlerts: true,
  });

  // ── Security state ──
  const [security, setSecurity] = useState({
    mfaRequired:       false,
    sessionTimeout:    '60',
    maxLoginAttempts:  '5',
    auditLogging:      true,
  });

  const [saving, setSaving] = useState<string | null>(null);

  const handleSave = async (section: string) => {
    setSaving(section);
    await new Promise((r) => setTimeout(r, 800)); // Simulate save
    setSaving(null);
    toast({ title: `✅ Paramètres ${section} enregistrés` });
  };

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Accès réservé au Super Administrateur
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Paramètres SaaS</h1>
        <p className="text-muted-foreground text-sm">Configuration globale de la plateforme Kharrazi Fleet</p>
      </div>

      {/* Branding */}
      <Section title="Identité de la plateforme" icon={<Palette className="w-4 h-4 text-pink-500" />}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Nom de la plateforme</Label>
            <Input value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Slogan</Label>
            <Input value={brand.tagline} onChange={(e) => setBrand({ ...brand, tagline: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Site web</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="https://kharrazi.ma" value={brand.website}
                onChange={(e) => setBrand({ ...brand, website: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email support</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="support@kharrazi.ma" value={brand.support}
                onChange={(e) => setBrand({ ...brand, support: e.target.value })} />
            </div>
          </div>
        </div>
        <Button size="sm" disabled={saving === 'branding'} onClick={() => handleSave('branding')}>
          {saving === 'branding' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
          Enregistrer
        </Button>
      </Section>

      {/* SMTP */}
      <Section title="Configuration SMTP — Emails" icon={<Mail className="w-4 h-4 text-blue-500" />}>
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
          <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Les credentials sont aussi configurables via le fichier <code>.env</code> du serveur.</span>
        </div>
        <ToggleRow
          label="Activer l'envoi d'emails"
          sub="Notifications, confirmations de réservation, etc."
          value={smtp.enabled}
          onChange={(v) => setSmtp({ ...smtp, enabled: v })}
        />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Serveur SMTP</Label>
            <Input placeholder="smtp.gmail.com" value={smtp.host}
              onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} disabled={!smtp.enabled} />
          </div>
          <div className="space-y-1">
            <Label>Port</Label>
            <Input placeholder="587" value={smtp.port}
              onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} disabled={!smtp.enabled} />
          </div>
          <div className="space-y-1">
            <Label>Utilisateur</Label>
            <Input type="email" placeholder="noreply@kharrazi.ma" value={smtp.user}
              onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} disabled={!smtp.enabled} />
          </div>
          <div className="space-y-1">
            <Label>Mot de passe / App Password</Label>
            <Input type="password" placeholder="••••••••" value={smtp.pass}
              onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} disabled={!smtp.enabled} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Expéditeur (From)</Label>
            <Input placeholder='Kharrazi Fleet <noreply@kharrazi.ma>' value={smtp.from}
              onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} disabled={!smtp.enabled} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={saving === 'smtp' || !smtp.enabled} onClick={() => handleSave('SMTP')}>
            {saving === 'smtp' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Enregistrer
          </Button>
          <Button size="sm" variant="outline" disabled={!smtp.enabled}>
            Envoyer un email test
          </Button>
        </div>
      </Section>

      {/* WhatsApp / Twilio */}
      <Section title="WhatsApp — Twilio" icon={<MessageSquare className="w-4 h-4 text-green-500" />}>
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300">
          <p className="font-semibold mb-1">Configuration Twilio requise</p>
          <p>Créez votre compte sur{' '}
            <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1">
              twilio.com <ExternalLink className="w-2.5 h-2.5" />
            </a>
            {' '}puis copiez vos credentials ci-dessous.
          </p>
        </div>
        <ToggleRow
          label="Activer WhatsApp (Twilio)"
          sub="Notifications automatiques pour toutes les agences"
          value={wa.enabled}
          onChange={(v) => setWa({ ...wa, enabled: v })}
        />
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1">
            <Label>Account SID</Label>
            <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={wa.sid}
              onChange={(e) => setWa({ ...wa, sid: e.target.value })} disabled={!wa.enabled} />
          </div>
          <div className="space-y-1">
            <Label>Auth Token</Label>
            <Input type="password" placeholder="••••••••••••••••••••••••••••••••" value={wa.token}
              onChange={(e) => setWa({ ...wa, token: e.target.value })} disabled={!wa.enabled} />
          </div>
          <div className="space-y-1">
            <Label>Numéro WhatsApp (From)</Label>
            <Input placeholder="whatsapp:+14155238886" value={wa.from}
              onChange={(e) => setWa({ ...wa, from: e.target.value })} disabled={!wa.enabled} />
            <p className="text-xs text-muted-foreground">Sandbox Twilio : whatsapp:+14155238886</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={saving === 'whatsapp' || !wa.enabled} onClick={() => handleSave('WhatsApp')}>
            {saving === 'whatsapp' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Enregistrer
          </Button>
          <Button size="sm" variant="outline" disabled={!wa.enabled}>
            Envoyer un message test
          </Button>
        </div>
      </Section>

      {/* Payment Gateway */}
      <Section title="Passerelle de paiement — Stripe" icon={<CreditCard className="w-4 h-4 text-violet-500" />}>
        <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-xs text-violet-700 dark:text-violet-300">
          <p className="font-semibold mb-1">Intégration Stripe (prochaine version)</p>
          <p>La facturation automatique des abonnements via Stripe sera disponible dans une prochaine mise à jour.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 opacity-50 pointer-events-none">
          <div className="space-y-1 col-span-2">
            <Label>Clé publique Stripe (Publishable Key)</Label>
            <Input placeholder="pk_live_..." disabled />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Clé secrète Stripe (Secret Key)</Label>
            <Input type="password" placeholder="sk_live_..." disabled />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Webhook Secret</Label>
            <Input placeholder="whsec_..." disabled />
          </div>
        </div>
        <Button size="sm" disabled variant="outline">
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
          Configurer Stripe — Bientôt disponible
        </Button>
      </Section>

      {/* Notifications */}
      <Section title="Alertes Super Admin" icon={<Bell className="w-4 h-4 text-amber-500" />}>
        <p className="text-xs text-muted-foreground">Choisissez les événements pour lesquels vous souhaitez être notifié.</p>
        <div className="space-y-3">
          <ToggleRow label="Nouvelle agence créée" sub="Notification à chaque onboarding" value={notifs.newAgency} onChange={(v) => setNotifs({ ...notifs, newAgency: v })} />
          <ToggleRow label="Abonnement expirant" sub="Alerte 30j, 7j et 1j avant expiration" value={notifs.expiring} onChange={(v) => setNotifs({ ...notifs, expiring: v })} />
          <ToggleRow label="Agence inactive (churn)" sub="Alerte si une agence ne s'est pas connectée depuis 30j" value={notifs.churn} onChange={(v) => setNotifs({ ...notifs, churn: v })} />
          <ToggleRow label="Alertes système" sub="Erreurs critiques, surcharge serveur, etc." value={notifs.systemAlerts} onChange={(v) => setNotifs({ ...notifs, systemAlerts: v })} />
        </div>
        <Button size="sm" disabled={saving === 'notifs'} onClick={() => handleSave('Alertes')}>
          {saving === 'notifs' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
          Enregistrer
        </Button>
      </Section>

      {/* Security */}
      <Section title="Sécurité" icon={<Shield className="w-4 h-4 text-red-500" />}>
        <div className="space-y-3">
          <ToggleRow label="MFA obligatoire" sub="Authentification à deux facteurs pour tous les admins" value={security.mfaRequired} onChange={(v) => setSecurity({ ...security, mfaRequired: v })} />
          <ToggleRow label="Journaux d'audit" sub="Enregistrement de toutes les actions critiques" value={security.auditLogging} onChange={(v) => setSecurity({ ...security, auditLogging: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="space-y-1">
            <Label>Timeout de session (minutes)</Label>
            <Input type="number" min={5} max={1440} value={security.sessionTimeout}
              onChange={(e) => setSecurity({ ...security, sessionTimeout: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Max. tentatives de connexion</Label>
            <Input type="number" min={3} max={20} value={security.maxLoginAttempts}
              onChange={(e) => setSecurity({ ...security, maxLoginAttempts: e.target.value })} />
          </div>
        </div>
        <Button size="sm" disabled={saving === 'security'} onClick={() => handleSave('Sécurité')}>
          {saving === 'security' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
          Enregistrer
        </Button>
      </Section>

      {/* Platform info */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 flex items-start gap-3 text-sm text-muted-foreground">
          <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground mb-0.5">Informations système</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mt-1">
              <span>Plateforme : <strong>Kharrazi Fleet v1.0</strong></span>
              <span>Base de données : <strong>PostgreSQL 16</strong></span>
              <span>Runtime : <strong>Node.js 20 LTS</strong></span>
              <span>Framework : <strong>Next.js 14 + Express</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
