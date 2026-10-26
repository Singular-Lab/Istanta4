import { Mountain, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm animate-fade-in">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20">
            <Mountain className="h-8 w-8 text-destructive/60" />
          </div>
          <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-destructive/20 border border-destructive/30">
            <ShieldOff className="h-4 w-4 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-destructive/80 font-mono">403</h1>
          <h2 className="text-lg font-semibold text-foreground">Accesso non consentito</h2>
          <p className="text-sm text-muted-foreground">
            Questo IP non è autorizzato ad accedere alla dashboard privata di Olimpo.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground font-mono">
          PRIVATE_DASHBOARD_ALLOWED_IPS
        </div>

        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          Indietro
        </Button>
      </div>
    </div>
  );
}
