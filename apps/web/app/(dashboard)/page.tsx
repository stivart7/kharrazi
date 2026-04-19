import { redirect } from 'next/navigation';

// /dashboard root → redirect to actual dashboard
export default function DashboardIndexPage() {
  redirect('/dashboard');
}
