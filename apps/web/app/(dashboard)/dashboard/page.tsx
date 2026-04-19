import { Metadata } from 'next';
import { DashboardContent } from '@/components/dashboard/dashboard-content';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default function DashboardPage() {
  return <DashboardContent />;
}
