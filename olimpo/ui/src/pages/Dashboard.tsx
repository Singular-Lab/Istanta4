import { useQuery } from '@tanstack/react-query';
import {
  Image,
  FileText,
  Users,
  CheckCircle2,
  Zap,
  FileImage,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardOverview, type DashboardOverview } from '@/lib/api';
import { formatDate, truncate } from '@/lib/utils';

const statCards = (stats: DashboardOverview['stats']) => [
  {
    label: 'Foto totali',
    value: stats.totalFoto,
    icon: Image,
    description: `${stats.fotoConvertiteWeb} convertite web`,
    color: 'text-blue-400',
    bg: 'bg-blue-950/40 border-blue-900/50',
  },
  {
    label: 'Foto WebP',
    value: stats.fotoPerformanti,
    icon: Zap,
    description: 'formato performante',
    color: 'text-violet-400',
    bg: 'bg-violet-950/40 border-violet-900/50',
  },
  {
    label: 'Materiali',
    value: stats.totalMateriali,
    icon: FileText,
    description: `${stats.materialiPdf} PDF`,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40 border-emerald-900/50',
  },
  {
    label: 'Utenti API',
    value: stats.totalUtenti,
    icon: Users,
    description: 'chiavi attive',
    color: 'text-gold',
    bg: 'bg-amber-950/40 border-amber-900/50',
  },
];

function StatSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: getDashboardOverview,
    staleTime: 30_000,
  });

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive text-sm">Errore nel caricamento dei dati.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        {data && (
          <p className="text-sm text-muted-foreground mt-0.5">
            Aggiornato {formatDate(data.generatedAt)}
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : statCards(data!.stats).map(({ label, value, icon: Icon, description, color, bg }) => (
              <Card key={label} className={`border ${bg}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                  <Icon className={`h-4 w-4 ${color}`} />
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${color}`}>{value.toLocaleString('it-IT')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent photos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              Foto recenti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              : data!.foto.slice(0, 8).map((foto) => (
                  <div
                    key={foto.id}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/30 transition-colors group"
                  >
                    {foto.previewUrl ? (
                      <img
                        src={foto.previewUrl}
                        alt=""
                        className="h-10 w-14 rounded object-cover border border-border bg-muted flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-10 w-14 rounded border border-border bg-muted flex-shrink-0 flex items-center justify-center">
                        <FileImage className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono truncate text-foreground/80">
                        {truncate(foto.archivioFileName || foto.id, 36)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {foto.hasWebAsset && (
                          <Badge variant="success" className="text-[10px] py-0">web</Badge>
                        )}
                        {foto.hasWebpAsset && (
                          <Badge variant="default" className="text-[10px] py-0 bg-violet-900/60 text-violet-400 border-violet-800/50">webp</Badge>
                        )}
                        {!foto.hasWebAsset && (
                          <Badge variant="warning" className="text-[10px] py-0">non conv.</Badge>
                        )}
                      </div>
                    </div>
                    {foto.webUrl && (
                      <a
                        href={foto.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
          </CardContent>
        </Card>

        {/* Recent materials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              Materiali recenti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              : data!.materiali.slice(0, 8).map((mat) => (
                  <div
                    key={mat.id}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="h-10 w-10 rounded border border-border bg-muted flex-shrink-0 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-emerald-400/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate text-foreground/80">
                        {truncate(mat.originalName || mat.fileName || mat.id, 40)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] py-0 uppercase">
                          {mat.extension || '?'}
                        </Badge>
                        {mat.pagine > 0 && (
                          <span className="text-[10px] text-muted-foreground">{mat.pagine} pag.</span>
                        )}
                      </div>
                    </div>
                    <a
                      href={mat.openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-emerald-400"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>

      {/* Utenti summary */}
      {!isLoading && data!.utenti.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-gold" />
              Utenti API attivi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data!.utenti.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5"
                >
                  <CheckCircle2
                    className={`h-3 w-3 ${u.isValid ? 'text-emerald-400' : 'text-muted-foreground'}`}
                  />
                  <span className="text-sm">{u.displayName}</span>
                  <Badge variant="gold" className="text-[10px] py-0">
                    {u.tipoUtente}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
