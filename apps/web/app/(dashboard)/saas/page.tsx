import { Metadata } from 'next';
import { SaasContent } from '@/components/saas/saas-content';

export const metadata: Metadata = { title: 'Tableau de bord SaaS' };

export default function SaasPage() {
  return <SaasContent />;
}
