import EmptyState from "@/components/EmptyState";
import { BarreOrizzontali } from "@/components/Grafici";
import { coperturaParziale, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { useMemo } from "react";
import type { CoperturaDati, QuotaSpazio, ScontoPerGruppo } from "../../../../lib/insightVolantino/tipi";
import { BarreAppaiate, type VoceAppaiata } from "./BarreAppaiate";
import { Blocco, Nota } from "./comuni";
import { vociScontoMedio } from "./PrezziSconti";

/**
 * "Reparti": quanto spazio di pagina va a ogni reparto rispetto a quante referenze ha, e lo sconto
 * medio di ogni reparto (spec insight-volantino). Chi ha piu' spazio che referenze e' spinto dal
 * volantino oltre il suo peso nell'assortimento. I nomi sono quelli per il marketing della GDO quando
 * impostati, gia' scelti dal server (EstensioneInsight.spazio.perReparto e prezziSconti.perReparto).
 */

export interface RepartiVolantinoProps {
  perReparto: readonly QuotaSpazio[];
  /** Lo sconto medio di ogni reparto (prezziSconti.perReparto); assente se il server non lo manda. */
  scontoPerReparto?: readonly ScontoPerGruppo[];
  /** Copertura dei dati (sintesi.copertura): sotto la soglia la sezione dice che il dato e' parziale. */
  copertura?: CoperturaDati;
}

/** Dalla quota di spazio piu' alta: il volantino si legge da chi occupa di piu'. */
export const vociSpazio = (quote: readonly QuotaSpazio[]): VoceAppaiata[] =>
  [...quote]
    .sort((a, b) => b.quotaSpazio - a.quotaSpazio || b.quotaReferenze - a.quotaReferenze || a.etichetta.localeCompare(b.etichetta, "it"))
    .map(quota => ({ id: quota.chiave || quota.etichetta, etichetta: quota.etichetta, principale: quota.quotaSpazio, confronto: quota.quotaReferenze }));

export function RepartiVolantino({ perReparto, scontoPerReparto, copertura }: RepartiVolantinoProps) {
  const voci = vociSpazio(perReparto);
  const sconti = useMemo(() => (scontoPerReparto ? vociScontoMedio(scontoPerReparto) : null), [scontoPerReparto]);
  const geometriaParziale = copertura !== undefined && coperturaParziale(copertura.geometria);
  const repartoParziale = copertura !== undefined && coperturaParziale(copertura.reparto);

  return (
    <div className="space-y-6">
      <Blocco titolo="Spazio e referenze" descrizione="Quota dello spazio di pagina accanto alla quota delle referenze di ogni reparto.">
        {voci.length === 0 ? (
          <EmptyState
            compatta
            icon="LayoutGrid"
            title="Reparti non disponibili"
            description="Le referenze di questo volantino non hanno un reparto riconosciuto."
          />
        ) : (
          <BarreAppaiate
            voci={voci}
            titolo="Spazio e referenze per reparto"
            nomePrincipale="Quota di spazio"
            nomeConfronto="Quota di referenze"
            testoEvidenza="più spazio che referenze"
          />
        )}
      </Blocco>

      {sconti && (
        <Blocco titolo="Sconto medio per reparto" descrizione="Media degli sconti dei box del reparto che ne hanno uno.">
          <BarreOrizzontali
            voci={sconti}
            titolo="Sconto medio per reparto"
            descrizioneValore="Sconto medio"
            formatta={valore => formatPercentuale(valore)}
            vuoto="Nessun reparto con uno sconto calcolabile."
          />
        </Blocco>
      )}

      {repartoParziale && copertura && (
        <Nota>Dato parziale: il reparto è noto per il {formatPercentuale(copertura.reparto, 0)} dei box, quindi le quote valgono su quelli.</Nota>
      )}
      {geometriaParziale && copertura && (
        <Nota>
          Dato parziale: la posizione nella pagina è nota per il {formatPercentuale(copertura.geometria, 0)} dei box, quindi le quote di spazio
          valgono su quelli.
        </Nota>
      )}
    </div>
  );
}

export default RepartiVolantino;
