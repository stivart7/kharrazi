import { Metadata } from 'next';
import { AgenciesContent } from '@/components/agencies/agencies-content';

export const metadata: Metadata = { title: 'Gestion des Agences' };

export default function AgenciesPage() {
  return <AgenciesContent />;
}
