import { Metadata } from 'next';
import { InvoicesContent } from '@/components/invoices/invoices-content';

export const metadata: Metadata = { title: 'Facturation' };

export default function InvoicesPage() {
  return <InvoicesContent />;
}
