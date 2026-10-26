import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mountain, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dashboardLogin } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export function Login() {
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await dashboardLogin(secret.trim());
      if (res.esito) {
        await refresh();
        navigate('/olimpo/private-dashboard', { replace: true });
      } else {
        setError(res.error || 'Codice di accesso non valido.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante il login.';
      if (msg.includes('429') || msg.toLowerCase().includes('retry')) {
        setError('Troppi tentativi. Riprova più tardi.');
      } else if (msg.includes('403')) {
        navigate('/olimpo/private-forbidden', { replace: true });
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Subtle background pattern */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, hsl(215 80% 58%) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-2xl olimpo-glow">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 olimpo-glow">
              <Mountain className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold tracking-widest text-gradient-olimpo uppercase">
                Olimpo
              </h1>
              <p className="mt-1 text-xs text-muted-foreground uppercase tracking-widest">
                Dashboard Privata
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="secret">Codice di accesso</Label>
              <div className="relative">
                <Input
                  id="secret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowSecret((v) => !v)}
                  tabIndex={-1}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading || !secret.trim()}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              {loading ? 'Accesso in corso…' : 'Accedi'}
            </Button>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs text-muted-foreground/50">
          Accesso riservato · Solo uso interno
        </p>
      </div>
    </div>
  );
}
