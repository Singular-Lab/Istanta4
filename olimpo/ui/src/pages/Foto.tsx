import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search, FileImage, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
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
import { getFotoPage, type FotoRecord } from '@/lib/api';
import { formatDate, truncate } from '@/lib/utils';

const FOTO_PAGE_SIZE = 100;

function FotoStatus({ foto }: { foto: FotoRecord }) {
  const hasWeb = Boolean(foto.file_name_web);
  const hasWebp = Boolean(foto.file_name_web_performante);

  if (hasWebp) return <Badge variant="success">Completo</Badge>;
  if (hasWeb) return <Badge variant="default" className="bg-blue-900/60 text-blue-400 border-blue-800/50">Solo web</Badge>;
  return <Badge variant="warning">Non convertito</Badge>;
}

function ThumbCell({ foto }: { foto: FotoRecord }) {
  const hasWeb = Boolean(foto.file_name_web);
  const hasWebp = Boolean(foto.file_name_web_performante);
  const url = hasWeb
    ? `/olimpo/foto/getThumbNailOnDemand?guidId=${foto.id}&width=80&height=56&performante=${hasWebp}`
    : null;

  if (!url) {
    return (
      <div className="h-10 w-14 rounded border border-border bg-muted flex items-center justify-center">
        <FileImage className="h-3.5 w-3.5 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="h-10 w-14 rounded border border-border object-cover bg-muted"
      loading="lazy"
    />
  );
}

export function Foto() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['foto-page', search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getFotoPage({
        offset: pageParam,
        limit: FOTO_PAGE_SIZE,
        search,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset ?? undefined : undefined),
    staleTime: 60_000,
  });

  const foto = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const totalResults = data?.pages[0]?.total ?? 0;
  const isSearchPending = searchInput.trim() !== search;

  useEffect(() => {
    const node = loadMoreRef.current;

    if (!node || !hasNextPage) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, foto.length, search]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Foto</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? '…' : `${totalResults} foto nel sistema`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Aggiorna
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per ID o nome file…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {isLoading
              ? '…'
              : `${foto.length} caricati su ${totalResults}${search ? ` risultati per "${search}"` : ' risultati'}`}
          </CardTitle>
          {isSearchPending ? (
            <p className="text-xs text-muted-foreground">Aggiorno la ricerca…</p>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex items-center justify-center py-12 text-destructive text-sm">
              Errore nel caricamento. Riprova.
            </div>
          ) : !isLoading && foto.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Nessuna foto trovata.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Preview</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>File archivio</TableHead>
                    <TableHead>File web</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Creato</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : foto.map((fotoItem) => (
                        <TableRow key={fotoItem.id}>
                          <TableCell>
                            <ThumbCell foto={fotoItem} />
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-muted-foreground">
                              {fotoItem.id.slice(0, 8)}…
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono">
                              {truncate(fotoItem.file_name ?? '—', 30)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-muted-foreground">
                              {fotoItem.file_name_web ? truncate(fotoItem.file_name_web, 30) : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <FotoStatus foto={fotoItem} />
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(fotoItem.created_at)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {fotoItem.file_name_web && (
                              <a
                                href={`/olimpo/foto/getFotoOnDemand?guidId=${fotoItem.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>

              <div className="border-t border-border px-6 py-4">
                {isFetchingNextPage ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Caricamento di altre foto…
                  </div>
                ) : hasNextPage ? (
                  <div className="flex flex-col items-center gap-3">
                    <div ref={loadMoreRef} className="h-1 w-full" />
                    <p className="text-xs text-muted-foreground">
                      Scorri verso il basso per caricare altre foto.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchNextPage()}
                    >
                      Carica altre
                    </Button>
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    Hai raggiunto la fine dell&apos;elenco.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
