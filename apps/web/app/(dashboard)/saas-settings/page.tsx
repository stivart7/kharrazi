import { Metadata } from 'next';
import { SaasSettingsContent } from '@/components/saas/saas-settings-content';

export const metadata: Metadata = { title: 'Paramètres SaaS — Kharrazi Fleet' };

export default function SaasSettingsPage() {
  return <SaasSettingsContent />;
}
