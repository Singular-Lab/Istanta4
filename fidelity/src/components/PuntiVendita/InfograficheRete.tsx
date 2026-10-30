import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import { BarreOrizzontali, GraficoLinee, type SerieLinea, type Tinta, type VoceBarra } from "@/components/Grafici";
import { formatNumero } from "@/utils/format";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ReteInsegne } from "../../../lib/puntiVendita/analisi";

interface InfograficheReteProps {
  query: Pick<UseQueryResult<ReteInsegne>, "data" | "isLoading" | "isError" | "error" | "refetch">;
  /** Il colore dell'insegna, lo stesso della mappa, dei filtri e delle righe. */
  tintaDelCanale: (idCanale: string) => Tinta;
  /** L'insegna filtrata nell'elenco, in evidenza nelle barre. */
  filtroCanale: string;
  onFiltroCanale: (idCanale: string) => void;
}

const testoAnno = (anno: number) => String(anno);

/**
 * Le due infografiche in testa all'elenco dei punti vendita (contratto ReteInsegne): quanti punti
 * vendita ha oggi ogni insegna, e quanti punti vendita diversi compaiono nelle liste dei volantini
 * di ogni anno. Un clic su una barra filtra l'elenco per quell'insegna. Senza volantini importati
 * resta solo la rete di oggi, a tutta larghezza, con una nota al posto del grafico vuoto.
 */
export function InfograficheRete({ query, tintaDelCanale, filtroCanale, onFiltroCanale }: InfograficheReteProps) {
  const rete = query.data;

  // Dall'insegna con più punti vendita; quelle senza punti vendita oggi stanno solo nelle linee
  const barre = useMemo<VoceBarra[]>(() => {
    if (!rete) return [];
    const ultimoAnno = rete.anni.length > 0 ? Math.max(...rete.anni) : null;
    return rete.insegne
      .filter(i => i.puntiVendita > 0)
      .sort((a, b) => b.puntiVendita - a.puntiVendita || a.canale.nome.localeCompare(b.canale.nome))
      .map(i => {
        const ultimo = ultimoAnno === null ? undefined : i.nelleListe.find(v => v.anno === ultimoAnno);
        return {
          id: i.canale.id,
          etichetta: i.canale.nome,
          valore: i.puntiVendita,
          tinta: tintaDelCanale(i.canale.id),
          dettagli: ultimo ? [{ etichetta: `Nei volantini del ${ultimoAnno}`, valore: formatNumero(ultimo.puntiVendita) }] : undefined,
        };
      });
  }, [rete, tintaDelCanale]);

  // Un anno senza volantini dell'insegna resta un vuoto nella linea, non uno zero
  const serie = useMemo<SerieLinea[]>(() => {
    if (!rete) return [];
    const anni = [...rete.anni].sort((a, b) => a - b);
    return rete.insegne
      .filter(i => i.nelleListe.length > 0)
      .sort((a, b) => b.puntiVendita - a.puntiVendita || a.canale.nome.localeCompare(b.canale.nome))
      .map(i => ({
        id: i.canale.id,
        nome: i.canale.nome,
        tono: tintaDelCanale(i.canale.id),
        punti: anni.map(anno => ({ x: anno, y: i.nelleListe.find(v => v.anno === anno)?.puntiVendita ?? null })),
      }));
  }, [rete, tintaDelCanale]);

  if (query.isError) {
    return (
      <Sezione titolo="La rete per insegna">
        <PageError
          compatta
          titolo="Infografiche non disponibili"
          motivo={(query.error as Error | null)?.message || "Errore durante il calcolo della rete per insegna"}
          onRiprova={() => query.refetch()}
        />
      </Sezione>
    );
  }

  const caricamento = (etichetta: string) => (
    <div aria-busy="true" aria-label={etichetta} className="flex flex-col gap-3">
      {Array.from({ length: 5 }, (_, indice) => (
        <Skeleton key={indice} className="h-5" />
      ))}
    </div>
  );

  const reteOggi = (
    <Sezione
      titolo="La rete per insegna"
      descrizione="Punti vendita per insegna oggi. Un clic su una barra filtra l'elenco."
    >
      {query.isLoading ? (
        caricamento("Caricamento della rete per insegna")
      ) : (
        <BarreOrizzontali
          voci={barre}
          titolo="Punti vendita per insegna"
          descrizioneValore="Punti vendita oggi"
          evidenziata={filtroCanale || null}
          onSeleziona={id => onFiltroCanale(id === filtroCanale ? "" : id)}
          vuoto="Nessuna insegna ha punti vendita in anagrafica."
        />
      )}
      {/* Senza volantini la seconda infografica sarebbe un riquadro vuoto: basta una nota qui */}
      {!query.isLoading && serie.length === 0 && (
        <p className="mt-4 flex items-start gap-2 border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500 dark:border-darkmode-400">
          <Lucide icon="Info" aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
          Nessun volantino importato: quanti punti vendita compaiono nei volantini di ogni anno si vedrà con l&apos;import dei volantini.
        </p>
      )}
    </Sezione>
  );

  if (!query.isLoading && serie.length === 0) return reteOggi;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {reteOggi}
      <Sezione
        titolo="Punti vendita nei volantini"
        descrizione="Quanti punti vendita diversi compaiono nelle liste dei volantini di ogni anno."
      >
        {query.isLoading ? (
          caricamento("Caricamento dei punti vendita nei volantini")
        ) : (
          <GraficoLinee
            serie={serie}
            titolo="Punti vendita nelle liste dei volantini, per anno e insegna"
            formattaY={v => formatNumero(v)}
            formattaX={testoAnno}
            descrizioneX="Anno"
            daZero
            vuoto="Nessun volantino importato: la storia arriva con l'import dei volantini."
          />
        )}
      </Sezione>
    </div>
  );
}

export default InfograficheRete;
