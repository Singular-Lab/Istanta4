import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormInput } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { useNotification } from "@/context/NotificationContext";
import { useSalvaRepartiGdo } from "@/query/impostazioniGdo";
import { formatNumero } from "@/utils/format";
import { useMemo, useState } from "react";
import type { RepartoGdo } from "../../../lib/impostazioniGdo/tipi";
import { useBozza } from "./useBozza";

type Filtro = "tutti" | "da-nominare";

/** Colore mostrato dal selettore quando il reparto non ne ha uno. */
const COLORE_NEUTRO = "#94a3b8";

const normalizza = (testo: string | null | undefined) => (testo ?? "").trim().toLowerCase();

/** Reparto senza nome per il marketing che compare nelle referenze. */
export const repartoDaNominare = (reparto: RepartoGdo) =>
  !(reparto.nomeMarketing ?? "").trim() && (reparto.daNominare || reparto.referenze > 0);

/** Nomi per il marketing, colori e reparti da nominare (codici trovati nelle referenze senza nome). */
function SezioneReparti({ reparti }: { reparti: RepartoGdo[] }) {
  const { showNotification } = useNotification();
  const salva = useSalvaRepartiGdo();
  const { bozza, setBozza, modificata } = useBozza(reparti);
  const [filtro, setFiltro] = useState<Filtro>("tutti");
  const [ricerca, setRicerca] = useState("");

  const aggiorna = (codice: string, modifiche: Partial<RepartoGdo>) =>
    setBozza(bozza.map((r) => (r.codice === codice ? { ...r, ...modifiche } : r)));

  // Codici con lo stesso nome per il marketing: diventano un reparto solo
  const codiciPerNome = useMemo(() => {
    const gruppi = new Map<string, string[]>();
    for (const r of bozza) {
      const nome = normalizza(r.nomeMarketing);
      if (nome) gruppi.set(nome, [...(gruppi.get(nome) ?? []), r.codice]);
    }
    return gruppi;
  }, [bozza]);

  // Il filtro guarda i reparti salvati: un reparto a cui si sta dando il nome resta in elenco
  const daNominareSalvati = useMemo(() => new Set(reparti.filter(repartoDaNominare).map((r) => r.codice)), [reparti]);
  const cercato = normalizza(ricerca);
  const visibili = bozza.filter(
    (r) =>
      (filtro === "tutti" || daNominareSalvati.has(r.codice)) &&
      (!cercato || [r.codice, r.nomeDati, r.nomeMarketing].some((v) => normalizza(v).includes(cercato)))
  );

  const salvaReparti = () =>
    salva.mutate(
      {
        reparti: bozza.map(({ codice, nomeDati, nomeMarketing, colore }) => ({
          codice,
          nomeDati,
          nomeMarketing: nomeMarketing?.trim() || null,
          colore,
        })),
      },
      {
        onSuccess: () => showNotification("Reparti salvati", { variant: "success" }),
        onError: (errore) => showNotification(`Reparti non salvati: ${errore.message}`, { variant: "error" }),
      }
    );

  return (
    <Sezione
      id="reparti"
      className="scroll-mt-24"
      icona="Tags"
      titolo="Reparti"
      descrizione={
        <>
          Il nome per il marketing compare negli insight, nella mappa, nei punti vendita e nei report.
          Più codici con lo stesso nome per il marketing diventano un reparto solo. I codici nuovi trovati
          nelle referenze compaiono qui da soli, segnati «da nominare».
        </>
      }
      azioni={
        <Button
          variant="primary"
          size="sm"
          onClick={salvaReparti}
          loading={salva.isPending}
          disabled={!modificata || salva.isPending}
        >
          Salva reparti
        </Button>
      }
    >
      {bozza.length === 0 ? (
        <EmptyState
          compatta
          icon="Tags"
          title="Nessun reparto"
          description="I reparti compaiono quando arrivano le referenze dei volantini della GDO."
        />
      ) : (
        <>
          <BarraFiltri variante="interna">
            <Segmenti<Filtro>
              etichetta="Reparti da mostrare"
              valore={filtro}
              onChange={setFiltro}
              opzioni={[
                { valore: "tutti", etichetta: "Tutti", conteggio: bozza.length },
                { valore: "da-nominare", etichetta: "Solo da nominare", conteggio: daNominareSalvati.size },
              ]}
            />
            <CampoRicerca etichetta="Cerca reparti" placeholder="Cerca codice o nome…" value={ricerca} onChange={setRicerca} />
          </BarraFiltri>
          {visibili.length === 0 ? (
            <EmptyState
              compatta
              icon={filtro === "da-nominare" && !cercato ? "CircleCheck" : "SearchX"}
              title={filtro === "da-nominare" && !cercato ? "Nessun reparto da nominare" : "Nessun reparto trovato"}
              description={
                filtro === "da-nominare" && !cercato
                  ? "Tutti i reparti delle referenze hanno un nome per il marketing."
                  : "Nessun reparto corrisponde alla ricerca."
              }
            />
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <Table sm>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th className="pl-5">Codice</Table.Th>
                    <Table.Th>Nome nei dati</Table.Th>
                    <Table.Th>Nome per il marketing</Table.Th>
                    <Table.Th>Colore</Table.Th>
                    <Table.Th className="pr-5 text-right">Referenze</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visibili.map((reparto) => {
                    const nome = reparto.nomeMarketing ?? "";
                    const insieme = (codiciPerNome.get(normalizza(nome)) ?? []).filter((c) => c !== reparto.codice);
                    const proponi = reparto.suggerimento && !nome.trim() ? reparto.suggerimento : null;
                    return (
                      <Table.Tr key={reparto.codice}>
                        <Table.Td className="whitespace-nowrap pl-5 font-mono text-sm">{reparto.codice}</Table.Td>
                        <Table.Td className="text-slate-500">{reparto.nomeDati}</Table.Td>
                        <Table.Td className="min-w-64">
                          <div className="flex flex-wrap items-center gap-2">
                            <FormInput
                              type="text"
                              formInputSize="sm"
                              aria-label={`Nome per il marketing del reparto ${reparto.codice}`}
                              placeholder={reparto.suggerimento ?? "Da nominare"}
                              value={nome}
                              onChange={(e) => aggiorna(reparto.codice, { nomeMarketing: e.target.value })}
                              className="min-w-0 flex-1"
                            />
                            {proponi && (
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => aggiorna(reparto.codice, { nomeMarketing: proponi })}
                              >
                                <Lucide icon="Wand2" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Usa «{proponi}»
                              </Button>
                            )}
                          </div>
                          {insieme.length > 0 && (
                            <p className="mt-1 text-xs text-slate-500">Un reparto solo con {insieme.join(", ")}</p>
                          )}
                        </Table.Td>
                        <Table.Td className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              aria-label={`Colore del reparto ${reparto.codice}`}
                              value={reparto.colore ?? COLORE_NEUTRO}
                              onChange={(e) => aggiorna(reparto.codice, { colore: e.target.value.toLowerCase() })}
                              className="h-8 w-10 cursor-pointer rounded-control border border-slate-200 bg-white p-0.5"
                            />
                            {reparto.colore ? (
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                aria-label={`Togli il colore del reparto ${reparto.codice}`}
                                onClick={() => aggiorna(reparto.codice, { colore: null })}
                              >
                                <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-500">automatico</span>
                            )}
                          </div>
                        </Table.Td>
                        <Table.Td className="whitespace-nowrap pr-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {repartoDaNominare(reparto) && <StatusBadge tono="warning" etichetta="da nominare" />}
                            <span className="tabular-nums">{formatNumero(reparto.referenze)}</span>
                          </div>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </>
      )}
    </Sezione>
  );
}

export default SezioneReparti;
