import { Metadata } from 'next';
import { CarsContent } from '@/components/cars/cars-content';

export const metadata: Metadata = { title: 'Flotte de véhicules' };

export default function CarsPage() {
  return <CarsContent />;
}
