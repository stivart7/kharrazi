import { Metadata } from 'next';
import { PaymentsContent } from '@/components/payments/payments-content';

export const metadata: Metadata = { title: 'Paiements' };

export default function PaymentsPage() {
  return <PaymentsContent />;
}
