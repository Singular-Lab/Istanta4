import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, ShieldCheck, ShieldOff, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getDashboardOverview } from '@/lib/api';
import { formatDate, truncate } from '@/lib/utils';

const TIPO_COLORS: Record<string, string> = {
  Superadmin: 'bg-gold/20 text-gold border-gold/30',
  IT: 'bg-blue-900/60 text-blue-400 border-blue-800/50',
  Marketing: 'bg-violet-900/60 text-violet-400 border-violet-800/50',
  Agenzia: 'bg-cyan-900/60 text-cyan-400 border-cyan-800/50',
  PuntoVendita: 'bg-emerald-900/60 text-emerald-400 border-emerald-800/50',
  GDO: 'bg-orange-900/60 text-orange-400 border-orange-800/50',
  Category: 'bg-pink-900/60 text-pink-400 border-pink-800/50',
  Guest: 'bg-muted text-muted-foreground border-border',
};

function TipoBadge({ tipo }: { tipo: string }) {
  const cls = TIPO_COLORS[tipo] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <Badge variant="outline" className={`${cls} border`}>
      {tipo}
    </Badge>
  );
}

function OriginBadge({ origin }: { origin: string }) {
  return (
    <span className="font-mono text-xs text-muted-foreground px-1.5 py-0.5 rounded border border-border bg-muted/30">
      {origin}
    </span>
  );
}

export function Utenti() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: getDashboardOverview,
    staleTime: 60_000,
    select: (d) => d.utenti,
  });

  const filtered = (data ?? []).filter((u) => {
    const q = search.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.tipoUtente.toLowerCase().includes(q) ||
      u.origin.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Utenti API</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? '…' : `${data?.length ?? 0} chiavi registrate`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Aggiorna
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per nome, email, tipo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {isLoading ? '…' : `${filtered.length} risultati`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex items-center justify-center py-12 text-destructive text-sm">
              Errore nel caricamento. Riprova.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Nome</TableHead>
                  <TableHead>Email / Username</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead>Ruoli</TableHead>
                  <TableHead>Scadenza</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filtered.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          {u.isValid ? (
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <ShieldOff className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-sm">{u.displayName}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground font-mono">
                            {truncate(u.email, 36)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <TipoBadge tipo={u.tipoUtente} />
                        </TableCell>
                        <TableCell>
                          <OriginBadge origin={u.origin} />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{u.ruoliCount}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {u.expiresAt ? formatDate(u.expiresAt) : '∞'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
