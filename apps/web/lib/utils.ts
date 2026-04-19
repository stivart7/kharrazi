import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency in MAD
export function formatMAD(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Format date in French
export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy'): string {
  return format(new Date(date), fmt, { locale: fr });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr });
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { locale: fr, addSuffix: true });
}

// Calculate rental days between two dates
export function calcDays(start: Date | string, end: Date | string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

// Moroccan phone number formatter
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('212')) return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  if (digits.length === 10) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
  return phone;
}

// Get initials from name
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

// Car status colors
export const CAR_STATUS_CONFIG = {
  AVAILABLE: { label: 'Disponible', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  RENTED: { label: 'En location', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  OUT_OF_SERVICE: { label: 'Hors service', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
} as const;

export const RESERVATION_STATUS_CONFIG = {
  PENDING: { label: 'En attente', color: 'bg-gray-100 text-gray-800' },
  CONFIRMED: { label: 'Confirmée', color: 'bg-blue-100 text-blue-800' },
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-800' },
  COMPLETED: { label: 'Terminée', color: 'bg-purple-100 text-purple-800' },
  CANCELLED: { label: 'Annulée', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Non présenté', color: 'bg-orange-100 text-orange-800' },
} as const;

export const FUEL_TYPE_LABELS = {
  GASOLINE: 'Essence',
  DIESEL: 'Diesel',
  HYBRID: 'Hybride',
  ELECTRIC: 'Électrique',
} as const;

export const TRANSMISSION_LABELS = {
  MANUAL: 'Manuelle',
  AUTOMATIC: 'Automatique',
} as const;
