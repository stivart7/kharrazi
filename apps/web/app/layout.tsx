import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/providers';
import { RegisterSW } from '@/components/layout/register-sw';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Kharrazi Fleet',
    template: '%s | Kharrazi Fleet',
  },
  description: 'Kharrazi Fleet — Plateforme de gestion de location de voitures au Maroc',
  keywords: ['location voiture', 'Maroc', 'gestion', 'agence'],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kharrazi Fleet',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'Kharrazi Fleet',
    description: 'Plateforme de gestion de location de voitures au Maroc',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Kharrazi Fleet" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <RegisterSW />
      </body>
    </html>
  );
}
