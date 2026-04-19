import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Kharrazi Fleet',
    template: '%s | Kharrazi Fleet',
  },
  description: 'Kharrazi Fleet — Plateforme de gestion de location de voitures au Maroc',
  keywords: ['location voiture', 'Maroc', 'gestion', 'agence'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
