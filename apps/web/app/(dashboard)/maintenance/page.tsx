import { Metadata } from 'next';
import { MaintenanceContent } from '@/components/maintenance/maintenance-content';
import { UpgradeGate } from '@/components/shared/upgrade-gate';

export const metadata: Metadata = { title: 'Maintenance' };

export default function MaintenancePage() {
  return (
    <UpgradeGate feature="maintenance">
      <MaintenanceContent />
    </UpgradeGate>
  );
}
