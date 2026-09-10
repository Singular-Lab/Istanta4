import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, FileImage, RefreshCw, ExternalLink } from 'lucide-react';
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
import { getAllMateriali, type MaterialeRecord } from '@/lib/api';
import { formatDate, truncate } from '@/lib/utils';

function getExtension(record: MaterialeRecord): string {
  const src = record.file_name ?? record.original_name ?? '';
  return src.split('.').pop()?.toLowerCase() ?? '';
}

function ExtBadge({ ext }: { ext: string }) {
  if (ext === 'pdf') return <Badge variant="destructive" className="bg-red-900/50 text-red-400 border-red-800/50">PDF</Badge>;
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return <Badge variant="default" className="bg-violet-900/60 text-violet-400 border-violet-800/50">{ext.toUpperCase()}</Badge>;
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return <Badge variant="success">{ext.toUpperCase()}</Badge>;
  return <Badge variant="outline">{ext.toUpperCase() || '?'}</Badge>;
}

export function Materiali() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['all-materiali'],
    queryFn: getAllMateriali,
    staleTime: 60_000,
  });

  const filtered = (data ?? []).filter((m) => {
    const q = search.toLowerCase();
    return (
      (m.original_name ?? '').toLowerCase().includes(q) ||
      (m.file_name ?? '').toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Materiali</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? '…' : `${data?.length ?? 0} materiali nel sistema`}
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
          placeholder="Cerca per nome o ID…"
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
                  <TableHead className="w-12">Tipo</TableHead>
                  <TableHead>Nome originale</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="w-20">Pagine</TableHead>
                  <TableHead>Caricato</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filtered.map((mat) => {
                      const ext = getExtension(mat);
                      const isPdf = ext === 'pdf';
                      return (
                        <TableRow key={mat.id}>
                          <TableCell>
                            <div className="flex items-center justify-center h-8 w-8 rounded border border-border bg-muted">
                              {isPdf ? (
                                <FileText className="h-4 w-4 text-red-400" />
                              ) : (
                                <FileImage className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {truncate(mat.original_name ?? '—', 50)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ExtBadge ext={ext} />
                              <span className="text-xs font-mono text-muted-foreground">
                                {truncate(mat.file_name ?? '—', 28)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {mat.pagine ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(mat.created_at)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <a
                              href={`/olimpo/materiali/getMaterialePDF?id=${mat.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-emerald-400 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
