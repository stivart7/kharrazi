import { Metadata } from 'next';
import { UsersContent } from '@/components/users/users-content';

export const metadata: Metadata = { title: 'Utilisateurs' };

export default function UsersPage() {
  return <UsersContent />;
}
