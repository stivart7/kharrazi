import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kharrazi Fleet',
    short_name: 'Kharrazi',
    description: 'Plateforme de gestion de location de voitures au Maroc',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: 'Réservations',
        url: '/reservations',
        description: 'Voir les réservations',
      },
      {
        name: 'Véhicules',
        url: '/cars',
        description: 'Gérer les véhicules',
      },
    ],
  };
}
