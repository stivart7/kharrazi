'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Car, Loader2, CheckCircle, XCircle } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { Button } from '@/components/ui/button';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de vérification manquant.');
      return;
    }

    apiClient
      .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus('success');
        setMessage('Votre adresse email a été confirmée avec succès.');
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err.response?.data?.message ?? 'Lien invalide ou expiré.');
      });
  }, [token]);

  return (
    <div className="text-center space-y-4">
      {status === 'loading' && (
        <>
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Vérification en cours…</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold">Email confirmé !</h2>
          <p className="text-muted-foreground">{message}</p>
          <Link href="/login">
            <Button className="mt-4">Se connecter</Button>
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold">Vérification échouée</h2>
          <p className="text-muted-foreground">{message}</p>
          <div className="flex gap-3 justify-center mt-4">
            <Link href="/login">
              <Button variant="outline">Se connecter</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 flex-col items-center justify-center p-12 text-white">
        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl mb-8">
            <Car className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Kharrazi Fleet</h1>
          <p className="text-xl text-blue-100">Plateforme professionnelle de gestion de location de voitures</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-xl">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Kharrazi Fleet</span>
          </div>
          <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />}>
            <VerifyEmailContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
