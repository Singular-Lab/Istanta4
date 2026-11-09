import Segmenti from "@/components/Base/Segmenti";
import EmptyState from "@/components/EmptyState";
import { Colonne } from "@/components/Grafici";
import { coperturaParziale, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import type { icons } from "lucide-react";
import { useMemo, useState } from "react";
import type { CoperturaDati, DensitaPagina, QuotaSpazio, UsoSpazio as DatiUsoSpazio } from "../../../../lib/insightVolantino/tipi";
import { BarreAppaiate, type VoceAppaiata } from "./BarreAppaiate";
import { Blocco, Nota } from "./comuni";

/**
 * Scheda "Spazio": quanto spazio di pagina va a reparti, meccaniche e marche rispetto a quante
 * referenze hanno, e quanto e' piena ogni pagina. Chi ha piu' spazio che referenze e' spinto dal
 * volantino oltre il suo peso nell'assortimento. Per ogni GDO, Istanta e storico (EstensioneInsight.spazio).
 */

export interface UsoSpazioProps {
  spazio: DatiUsoSpazio;
  /** Copertura dei dati (sintesi.copertura): sotto la soglia la scheda dice che il dato e' parziale. */
  copertura?: CoperturaDati;
}

type Gruppo = "reparto" | "meccanica" | "marca";

const GRUPPI: ReadonlyArray<{
  valore: Gruppo;
  etichetta: string;
  campo: "perReparto" | "perMeccanica" | "perMarca";
  vuoto: { icona: keyof typeof icons; titolo: string; descrizione: string };
}> = [
  {
    valore: "reparto",
    etichetta: "Reparto",
    campo: "perReparto",
    vuoto: { icona: "LayoutGrid", titolo: "Reparti non disponibili", descrizione: "Le referenze di questo volantino non hanno un reparto riconosciuto." },
  },
  {
    valore: "meccanica",
    etichetta: "Meccanica",
    campo: "perMeccanica",
    vuoto: { icona: "Tags", titolo: "Meccaniche non riconosciute", descrizione: "Le referenze non dicono con quale meccanica sono promosse." },
  },
  {
    valore: "marca",
    etichetta: "Marca",
    campo: "perMarca",
    vuoto: { icona: "Award", titolo: "Nessuna marca riconosciuta", descrizione: "Le referenze di questo volantino non hanno la marca." },
  },
];

/** Dalla quota di spazio piu' alta: il volantino si legge da chi occupa di piu'. */
export const vociSpazio = (quote: readonly QuotaSpazio[]): VoceAppaiata[] =>
  [...quote]
    .sort((a, b) => b.quotaSpazio - a.quotaSpazio || b.quotaReferenze - a.quotaReferenze || a.etichetta.localeCompare(b.etichetta, "it"))
    .map(quota => ({ id: quota.chiave || quota.etichetta, etichetta: quota.etichetta, principale: quota.quotaSpazio, confronto: quota.quotaReferenze }));

/** "In media i box coprono il 62% della pagina; la più piena è la 4 (91%)." */
export const sintesiDensita = (pagine: readonly DensitaPagina[]): string | null => {
  if (pagine.length === 0) return null;
  const media = pagine.reduce((somma, pagina) => somma + pagina.spazioOccupato, 0) / pagine.length;
  const piuPiena = pagine.reduce((migliore, pagina) => (pagina.spazioOccupato > migliore.spazioOccupato ? pagina : migliore));
  return `In media i box coprono il ${formatPercentuale(media)} della pagina; la più piena è la ${formatNumero(piuPiena.pagina)} (${formatPercentuale(piuPiena.spazioOccupato)}).`;
};

export function UsoSpazio({ spazio, copertura }: UsoSpazioProps) {
  const [gruppo, setGruppo] = useState<Gruppo>("reparto");
  const scelto = GRUPPI.find(voce => voce.valore === gruppo) ?? GRUPPI[0];
  const voci = useMemo(() => vociSpazio(spazio[scelto.campo]), [spazio, scelto.campo]);
  const pagine = useMemo(() => [...spazio.perPagina].sort((a, b) => a.pagina - b.pagina), [spazio.perPagina]);
  const geometriaParziale = copertura !== undefined && coperturaParziale(copertura.geometria);

  return (
    <div className="space-y-6 p-4">
      <Blocco
        titolo={`Spazio e referenze per ${scelto.etichetta.toLowerCase()}`}
        descrizione="Quota dello spazio di pagina accanto alla quota delle referenze del volantino."
        azioni={
          <Segmenti
            etichetta="Raggruppa per"
            valore={gruppo}
            onChange={setGruppo}
            opzioni={GRUPPI.map(voce => ({ valore: voce.valore, etichetta: voce.etichetta, conteggio: spazio[voce.campo].length }))}
          />
        }
      >
        {voci.length === 0 ? (
          <EmptyState compatta icon={scelto.vuoto.icona} title={scelto.vuoto.titolo} description={scelto.vuoto.descrizione} />
        ) : (
          <BarreAppaiate
            key={gruppo}
            voci={voci}
            titolo={`Spazio e referenze per ${scelto.etichetta.toLowerCase()}`}
            nomePrincipale="Quota di spazio"
            nomeConfronto="Quota di referenze"
            testoEvidenza="più spazio che referenze"
          />
        )}
      </Blocco>

      <Blocco titolo="Densità per pagina" descrizione={sintesiDensita(pagine) ?? "Quanta parte di ogni pagina coprono i box."}>
        {pagine.length === 0 ? (
          <EmptyState
            compatta
            icon="LayoutTemplate"
            title="Posizioni non disponibili"
            description="I box di questo volantino non hanno la posizione nella pagina."
          />
        ) : (
          <Colonne
            voci={pagine.map(pagina => ({
              id: `pagina-${pagina.pagina}`,
              etichetta: String(pagina.pagina),
              titolo: `Pagina ${pagina.pagina}`,
              valore: pagina.spazioOccupato,
              dettagli: [{ etichetta: "Box", valore: formatNumero(pagina.box) }],
            }))}
            titolo="Pagina coperta dai box"
            descrizioneValore="Pagina coperta dai box"
            descrizioneVoce="Pagina"
            formatta={valore => formatPercentuale(valore)}
            massimo={100}
            altezza={140}
          />
        )}
      </Blocco>

      {geometriaParziale && copertura && (
        <Nota>
          Dato parziale: la posizione nella pagina è nota per il {formatPercentuale(copertura.geometria, 0)} dei box, quindi le quote di spazio
          valgono su quelli.
        </Nota>
      )}
    </div>
  );
}

export default UsoSpazio;
