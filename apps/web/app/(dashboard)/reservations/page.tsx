import { Metadata } from 'next';
import { ReservationsContent } from '@/components/reservations/reservations-content';

export const metadata: Metadata = { title: 'Réservations' };

export default function ReservationsPage() {
  return <ReservationsContent />;
}
