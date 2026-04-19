import { Metadata } from 'next';
import { ContractsContent } from '@/components/contracts/contracts-content';

export const metadata: Metadata = { title: 'Contrats' };

export default function ContractsPage() {
  return <ContractsContent />;
}
