import { Car, WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl">
        <Car className="w-10 h-10 text-white" />
      </div>
      <div>
        <h1 className="text-2xl font-bold mb-2">Kharrazi Fleet</h1>
        <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
          <WifiOff className="w-4 h-4" />
          <span>Pas de connexion internet</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Vérifiez votre connexion et réessayez. Vos données sont sauvegardées et seront synchronisées dès que vous serez en ligne.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}
