'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MailWarning, X, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { toast } from '@/hooks/use-toast';

export function EmailVerificationBanner() {
  const [dismissed, setDismissed] = useState(false);

  const resendMutation = useMutation({
    mutationFn: () => apiClient.post('/auth/resend-verification'),
    onSuccess: () =>
      toast({ title: 'Email envoyé', description: 'Vérifiez votre boîte mail (et le dossier spam).' }),
    onError: (err: any) =>
      toast({ title: 'Erreur', description: err.response?.data?.message ?? 'Réessayez plus tard.', variant: 'destructive' }),
  });

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3 text-sm text-amber-800">
      <MailWarning className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        Votre adresse email n'est pas encore confirmée.{' '}
        <button
          onClick={() => resendMutation.mutate()}
          disabled={resendMutation.isPending || resendMutation.isSuccess}
          className="underline font-medium hover:no-underline disabled:opacity-50 inline-flex items-center gap-1"
        >
          {resendMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          {resendMutation.isSuccess ? 'Email envoyé ✓' : 'Renvoyer le lien'}
        </button>
      </span>
      <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-900 ml-auto">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
