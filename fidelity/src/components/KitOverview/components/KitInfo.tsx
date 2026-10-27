import Sezione from "@/components/Base/Sezione";
import { formatDataOraEstesa, formatNumero } from "@/utils/format";
import { FC } from "react";
import { KitInfoProps } from "../types";

/**
 * KitInfo - Pannello con informazioni dettagliate del kit.
 * Mostra ID, codici, quantità e date.
 */
type Riga = { etichetta: string; valore: string; titolo?: string; mono?: boolean };

const KitInfo: FC<KitInfoProps> = ({ lavorazione }) => {
  const righe = ([
    { etichetta: "ID kit", valore: `${lavorazione.guidId.slice(0, 8)}…`, titolo: lavorazione.guidId, mono: true },
    lavorazione.codiceArea ? { etichetta: "Codice area", valore: lavorazione.codiceArea } : null,
    lavorazione.codiceCanale ? { etichetta: "Codice canale", valore: lavorazione.codiceCanale } : null,
    lavorazione.quantitaCopie ? { etichetta: "Quantità copie", valore: formatNumero(lavorazione.quantitaCopie) } : null,
    lavorazione.promo.nome ? { etichetta: "Promo", valore: lavorazione.promo.nome, titolo: lavorazione.promo.nome } : null,
    { etichetta: "Data creazione", valore: formatDataOraEstesa(lavorazione.createdAt) },
  ] as (Riga | null)[]).filter((riga): riga is Riga => riga !== null);

  return (
    <Sezione icona="Info" titolo="Informazioni kit" descrizione="Dettagli configurazione">
      <dl className="divide-y divide-slate-100">
        {righe.map((riga) => (
          <div key={riga.etichetta} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-sm text-slate-500">{riga.etichetta}</dt>
            <dd
              title={riga.titolo}
              className={riga.mono ? "max-w-40 truncate font-mono text-sm text-slate-700" : "max-w-40 truncate text-sm font-semibold text-slate-700"}
            >
              {riga.valore}
            </dd>
          </div>
        ))}
      </dl>
    </Sezione>
  );
};

export default KitInfo;
