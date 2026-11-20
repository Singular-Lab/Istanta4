import EmptyState from "@/components/EmptyState";
import { coperturaParziale, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import type { CoperturaDati, QuotaSpazio } from "../../../../lib/insightVolantino/tipi";
import { BarreAppaiate, type VoceAppaiata } from "./BarreAppaiate";
import { Blocco, Nota } from "./comuni";

/**
 * "Reparti": quanto spazio di pagina va a ogni reparto rispetto a quante referenze ha, senza lo sconto
 * medio (spec insight-volantino). Chi ha piu' spazio che referenze e' spinto dal volantino oltre il suo
 * peso nell'assortimento. I nomi sono quelli per il marketing della GDO quando impostati, gia' scelti
 * dal server (EstensioneInsight.spazio.perReparto).
 */

export interface RepartiVolantinoProps {
  perReparto: readonly QuotaSpazio[];
  /** Copertura dei dati (sintesi.copertura): sotto la soglia la sezione dice che il dato e' parziale. */
  copertura?: CoperturaDati;
}

/** Dalla quota di spazio piu' alta: il volantino si legge da chi occupa di piu'. */
export const vociSpazio = (quote: readonly QuotaSpazio[]): VoceAppaiata[] =>
  [...quote]
    .sort((a, b) => b.quotaSpazio - a.quotaSpazio || b.quotaReferenze - a.quotaReferenze || a.etichetta.localeCompare(b.etichetta, "it"))
    .map(quota => ({ id: quota.chiave || quota.etichetta, etichetta: quota.etichetta, principale: quota.quotaSpazio, confronto: quota.quotaReferenze }));

export function RepartiVolantino({ perReparto, copertura }: RepartiVolantinoProps) {
  const voci = vociSpazio(perReparto);
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
