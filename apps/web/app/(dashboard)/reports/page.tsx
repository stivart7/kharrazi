import { Metadata } from 'next';
import { ReportsContent } from '@/components/reports/reports-content';
import { UpgradeGate } from '@/components/shared/upgrade-gate';

export const metadata: Metadata = { title: 'Rapports' };

export default function ReportsPage() {
  return (
    <UpgradeGate feature="reports">
      <ReportsContent />
    </UpgradeGate>
  );
}
