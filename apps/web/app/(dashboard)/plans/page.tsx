import { Metadata } from 'next';
import { PlansContent } from '@/components/saas/plans-content';

export const metadata: Metadata = { title: 'Plans & Tarifs — Kharrazi Fleet' };

export default function PlansPage() {
  return <PlansContent />;
}
