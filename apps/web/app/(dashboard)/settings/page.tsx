import { Metadata } from 'next';
import { SettingsContent } from '@/components/settings/settings-content';

export const metadata: Metadata = { title: 'Paramètres' };

export default function SettingsPage() {
  return <SettingsContent />;
}
