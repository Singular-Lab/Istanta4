import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import type { Tinta } from "@/components/Grafici";
import { percorsoScheda } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { KitPromozioneConsultazione, PuntoVenditaPromozioneConsultazione } from "../../../lib/consultazione/tipi";
import { nomeRegione } from "../../../lib/consultazione/regioni";
import { nomeKit } from "./analisi";
import { LogoInsegna } from "./LogoInsegna";

/** Righe mostrate all'inizio e a ogni "Mostra altre": l'elenco di una promo grande arriva a migliaia. */
export const RIGHE_PER_VOLTA = 25;

export interface ElencoRigheProps {
  /** I punti vendita che passano regione e ricerca, una volta sola ciascuno. */
  righe: readonly PuntoVenditaPromozioneConsultazione[];
  kitPerId: ReadonlyMap<string, KitPromozioneConsultazione>;
  tinta: (idCanale: string) => Tinta;
  /** Con "gdo.visualizza" i punti vendita riconosciuti portano alla loro scheda. */
  conScheda: boolean;
  /** Testo dello stato vuoto, quando regione e ricerca non lasciano punti vendita. */
  vuoto: string;
}

/**
 * L'elenco dei punti vendita stampati nei volantini, uno per riga anche se lo stampano più kit:
 * località (con la regione), indirizzo come stampato, i volantini che lo stampano e se è riconosciuto
 * nell'anagrafica. Paginato qui, a blocchi di RIGHE_PER_VOLTA: la pagina lo rimonta (key) quando
 * cambiano regione o ricerca, e riparte dall'inizio.
 */
export function ElencoRighe({ righe, kitPerId, tinta, conScheda, vuoto }: ElencoRigheProps) {
  const [mostrate, setMostrate] = useState(RIGHE_PER_VOLTA);
  const visibili = righe.slice(0, mostrate);
  const altre = Math.min(RIGHE_PER_VOLTA, righe.length - visibili.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-control border border-slate-200 dark:border-darkmode-400">
        <Table sm>
          <caption className="sr-only">Punti vendita stampati nei volantini della promozione</caption>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Località</Table.Th>
              <Table.Th>Indirizzo stampato</Table.Th>
              <Table.Th>Volantini</Table.Th>
              <Table.Th>Anagrafica</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibili.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4} className="border-b-0 text-sm text-slate-500 dark:text-slate-400">
                  {vuoto}
                </Table.Td>
              </Table.Tr>
            ) : (
              visibili.map(riga => {
                const kit = riga.idKit.flatMap(id => kitPerId.get(id) ?? []);
                const pv = riga.puntoVendita;
                return (
                  <Table.Tr key={riga.id}>
                    <Table.Td className="min-w-32 align-top">
                      <span className="block font-semibold text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{riga.localita ?? "—"}</span>
                      <span className="block text-2xs text-slate-500 dark:text-slate-400">
                        {riga.regione ? nomeRegione(riga.regione) : "Regione non indicata"}
                      </span>
                    </Table.Td>
                    {/* Senza indirizzo letto, la riga come è stampata */}
                    <Table.Td className="min-w-48 align-top text-sm text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300">
                      {riga.indirizzo ?? riga.riga}
                    </Table.Td>
                    <Table.Td className="align-top">
                      {kit.length > 0 ? (
                        // Un punto vendita stampato da più volantini li elenca tutti, uno sotto l'altro
                        <ul aria-label={`Volantini che stampano ${riga.localita ?? riga.riga}`} className="flex flex-col gap-1">
                          {kit.map(k => (
                            <li key={k.id} className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-200">
                              <LogoInsegna idCanale={k.canale.id} tinta={tinta(k.canale.id)} />
                              {nomeKit(k)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </Table.Td>
                    <Table.Td className="align-top">
                      {pv ? (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <StatusBadge tono="success" etichetta="Riconosciuto" icon="BadgeCheck" />
                          {conScheda ? (
                            <Link
                              to={percorsoScheda(pv.id)}
                              aria-label={`Scheda del punto vendita ${pv.nome}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-indigo-300"
                            >
                              {pv.nome}
                              <Lucide icon="ChevronRight" aria-hidden="true" className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400">{pv.nome}</span>
                          )}
                        </span>
                      ) : (
                        <StatusBadge tono="neutral" etichetta="Solo nel volantino" icon="Newspaper" />
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {formatNumero(visibili.length)} di {formatNumero(righe.length)} {righe.length === 1 ? "punto vendita" : "punti vendita"}
        </p>
        {altre > 0 && (
          <Button type="button" size="sm" variant="outline-secondary" onClick={() => setMostrate(numero => numero + RIGHE_PER_VOLTA)}>
            <Lucide icon="ChevronDown" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Mostra altri {formatNumero(altre)}
          </Button>
        )}
      </div>
    </div>
  );
}

export default ElencoRighe;
