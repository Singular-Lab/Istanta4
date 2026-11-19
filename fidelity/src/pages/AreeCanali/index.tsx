import Button from "@/components/Base/Button";
import { FormCheck, FormField, FormHelp, FormInput, FormSelect, FormSwitch } from "@/components/Base/Form";
import BarraFiltri from "@/components/Base/BarraFiltri";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { Dialog, Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { PermissionGate } from "@/components/PermissionGate";
import Table from "@/components/Base/Table";
import withSessionChecked from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from "@/context/NotificationContext";
import { useFetchAreeCanaliECombinazioni } from "@/query/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { AnagraficaAreeCanali, CombinazioneAnagrafica, VoceAnagraficaDTO } from "../../../lib/areeCanali/anagrafica";
import { codiceDoppio, codiciDoppi, eProxy, pezziDellaCombinazione, proxyDaVoci, type TipoVoce } from "../../../lib/areeCanali/proxy";
import { ServerCall } from "../../../lib/server_call";

/**
 * Aree, canali e loro combinazioni della GDO. Un canale (o un'area) proxy raccoglie piu' membri
 * per un volantino uguale fra insegne o aree: il design e' uno, e per Istanta ogni suo kit si divide
 * in un pezzo per combinazione membro attiva (lib/areeCanali/proxy.ts).
 */

// Dopo ogni salvataggio si rileggono anche le copie delle altre pagine (filtri, form dei PV)
const CHIAVI_DA_RILEGGERE = [
  ["fetchAreeCanaliECombinazioni"],
  ["allAreeForGDO"],
  ["allCanaliForGDO"],
  ["fetchCanali"],
  ["fetchAree"],
  ["combinazioniDisponibili"],
];

interface FormVoce {
  tipo: TipoVoce;
  id: string | null;
  nome: string;
  codice: string;
  proxy: boolean;
  membri: string[];
}

/** Solo creazione: di una combinazione esistente si cambia lo stato, dalla tabella. */
interface FormCombinazione {
  idCanale: string;
  idArea: string;
  attiva: boolean;
}

type DaEliminare = { tipo: TipoVoce | "combinazione"; id: string; nome: string } | null;

const ETICHETTE: Record<TipoVoce, { singolare: string; articolo: string; icona: "MapPin" | "Radio" }> = {
  area: { singolare: "Area", articolo: "l'area", icona: "MapPin" },
  canale: { singolare: "Canale", articolo: "il canale", icona: "Radio" },
};

const formVuoto = (tipo: TipoVoce): FormVoce => ({ tipo, id: null, nome: "", codice: "", proxy: false, membri: [] });

const nomeCombinazione = (c: CombinazioneAnagrafica) =>
  `${c.canale_nome || c.canale_codice || "?"} · ${c.area_nome || c.area_codice || "?"}`;

function Main() {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const { data, isLoading, isError, error, refetch } = useFetchAreeCanaliECombinazioni();
  const anagrafica: AnagraficaAreeCanali = {
    // La query e' condivisa con le regole del menabo, che usano i DTO di canali e aree
    aree: (data?.aree ?? []) as unknown as VoceAnagraficaDTO[],
    canali: (data?.canali ?? []) as unknown as VoceAnagraficaDTO[],
    combinazioni: (data?.combinazioni ?? []) as unknown as CombinazioneAnagrafica[],
  };

  const [ricerca, setRicerca] = useState("");
  const [formVoce, setFormVoce] = useState<FormVoce | null>(null);
  const [formCombinazione, setFormCombinazione] = useState<FormCombinazione | null>(null);
  const [daEliminare, setDaEliminare] = useState<DaEliminare>(null);
  // Stato chiesto con l'interruttore, per combinazione, finche' il salvataggio non e' riletto
  const [statiInAttesa, setStatiInAttesa] = useState<Record<string, boolean>>({});

  const vociDi = (tipo: TipoVoce) => (tipo === "area" ? anagrafica.aree : anagrafica.canali);
  const perId = useMemo(() => {
    const mappa = new Map<string, VoceAnagraficaDTO>();
    for (const v of [...anagrafica.aree, ...anagrafica.canali]) mappa.set(v.id, v);
    return mappa;
  }, [anagrafica.aree, anagrafica.canali]);
  const doppi = useMemo(
    () => ({ area: codiciDoppi(anagrafica.aree), canale: codiciDoppi(anagrafica.canali) }),
    [anagrafica.aree, anagrafica.canali]
  );

  const notifica = (titolo: string, dettaglio?: string, errore = false) =>
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon={errore ? "CircleAlert" : "CircleCheck"} className={`${errore ? "text-danger" : "text-success"} w-8 h-8`} />
        <div className="ml-4 mr-4">
          <div className="font-bold">{titolo}</div>
          {dettaglio && <div className="mt-1 text-slate-500">{dettaglio}</div>}
        </div>
      </div>
    );

  const rileggi = () => Promise.all(CHIAVI_DA_RILEGGERE.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  const salvaVoce = useMutation<{ isUpdate?: boolean }, Error, FormVoce>({
    mutationFn: (form) => {
      const membri = form.proxy ? form.membri : [];
      const corpo = form.tipo === "area"
        ? { id: form.id ?? undefined, nome: form.nome.trim(), codice: form.codice.trim(), membri }
        : { id: form.id ?? undefined, nome: form.nome.trim(), sigla: form.codice.trim(), membri };
      return ServerCall.put(form.tipo === "area" ? "/ACPV/salvaArea" : "/ACPV/salvaCanale", corpo);
    },
    onSuccess: async (_risposta, form) => {
      notifica(`${ETICHETTE[form.tipo].singolare} ${form.id ? "modificat" : "creat"}${form.tipo === "area" ? "a" : "o"} con successo`);
      setFormVoce(null);
      await rileggi();
    },
    onError: (errore, form) =>
      notifica(`Errore nel salvataggio ${form.tipo === "area" ? "dell'area" : "del canale"}`, errore?.message || "Si è verificato un errore durante il salvataggio.", true),
  });

  const salvaCombinazione = useMutation<unknown, Error, FormCombinazione>({
    mutationFn: (form) =>
      ServerCall.put("/ACPV/setCombinazione", {
        guidID: "",
        guidIDCanale: form.idCanale,
        guidIDArea: form.idArea,
        enabled: form.attiva,
      }),
    onSuccess: async () => {
      notifica("Combinazione creata con successo");
      setFormCombinazione(null);
      await rileggi();
    },
    onError: (errore) => notifica("Errore nel salvataggio della combinazione", errore?.message || "Si è verificato un errore durante il salvataggio.", true),
  });

  const togliInAttesa = (id: string) =>
    setStatiInAttesa((attuali) => Object.fromEntries(Object.entries(attuali).filter(([chiave]) => chiave !== id)));

  // L'interruttore salva subito lo stato, anche in Istanta; se non riesce torna com'era
  const cambiaStato = useMutation<unknown, Error, { combinazione: CombinazioneAnagrafica; attiva: boolean }>({
    mutationFn: ({ combinazione, attiva }) =>
      ServerCall.put("/ACPV/setCombinazione", {
        guidID: combinazione.id,
        guidIDCanale: combinazione.id_canale,
        guidIDArea: combinazione.id_area,
        enabled: attiva,
      }),
    onMutate: ({ combinazione, attiva }) => setStatiInAttesa((attuali) => ({ ...attuali, [combinazione.id]: attiva })),
    onSuccess: async (_risposta, { combinazione }) => {
      await rileggi();
      togliInAttesa(combinazione.id);
    },
    onError: (errore, { combinazione }) => {
      togliInAttesa(combinazione.id);
      notifica(
        `Stato di ${combinazione.sigla} non salvato`,
        errore?.message || "Si è verificato un errore durante il salvataggio.",
        true
      );
    },
  });

  const elimina = useMutation<unknown, Error, NonNullable<DaEliminare>>({
    mutationFn: ({ tipo, id }) =>
      ServerCall.delete(
        tipo === "area" ? `/ACPV/eliminaArea/${id}` : tipo === "canale" ? `/ACPV/eliminaCanale/${id}` : `/ACPV/deleteCombinazione/${id}`
      ),
    onSuccess: () => rileggi(),
    onError: (errore, { tipo }) =>
      notifica(
        `Errore nell'eliminazione ${tipo === "area" ? "dell'area" : tipo === "canale" ? "del canale" : "della combinazione"}`,
        errore?.message || "Si è verificato un errore durante l'eliminazione.",
        true
      ),
  });

  const apriVoce = (tipo: TipoVoce, voce?: VoceAnagraficaDTO) => {
    if (!voce) return setFormVoce(formVuoto(tipo));
    const membri = voce.membri ?? [];
    setFormVoce({ tipo, id: voce.id, nome: voce.nome, codice: voce.codice, proxy: eProxy(membri), membri: [...membri] });
  };

  const apriCombinazione = () =>
    setFormCombinazione({ idCanale: anagrafica.canali[0]?.id ?? "", idArea: anagrafica.aree[0]?.id ?? "", attiva: true });

  // Ricerca locale, senza distinzione fra maiuscole e minuscole
  const termine = ricerca.trim().toLowerCase();
  const corrisponde = (...valori: (string | null | undefined)[]) =>
    !termine || valori.some((valore) => (valore ?? "").toLowerCase().includes(termine));
  const visibili = (tipo: TipoVoce) => vociDi(tipo).filter((v) => corrisponde(v.nome, v.codice));
  const combinazioniVisibili = anagrafica.combinazioni.filter((c) =>
    corrisponde(c.sigla, c.canale_nome, c.canale_codice, c.area_nome, c.area_codice)
  );

  const nomiMembri = (voce: VoceAnagraficaDTO) => (voce.membri ?? []).map((id) => perId.get(id)?.nome ?? "voce eliminata");

  const tabellaVoci = (tipo: TipoVoce) => {
    const { singolare, articolo, icona } = ETICHETTE[tipo];
    const righe = visibili(tipo);
    return (
      <div className="col-span-12 overflow-hidden rounded-card border border-slate-200 bg-white lg:col-span-6">
        <h3 className="title-card px-4 py-3">{tipo === "area" ? "Aree" : "Canali"}</h3>
        <div className="overflow-x-auto">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className="w-12">#</Table.Th>
                <Table.Th>Nome {singolare}</Table.Th>
                <Table.Th>Codice {singolare}</Table.Th>
                <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {righe.length === 0
                ? rigaVuota(4, vociDi(tipo).length === 0, `Nessun${tipo === "area" ? "a area disponibile" : " canale disponibile"}`, icona)
                : righe.map((voce, indice) => {
                  const proxy = eProxy(voce.membri);
                  const membri = nomiMembri(voce);
                  return (
                    <Table.Tr key={voce.id}>
                      <Table.Td className="whitespace-nowrap tabular-nums align-top">{indice + 1}</Table.Td>
                      <Table.Td className="align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{voce.nome}</span>
                          {proxy && <StatusBadge tono="brand" etichetta="Proxy" />}
                        </div>
                        {proxy && (
                          <p className="mt-1 text-xs text-slate-500">
                            Raccoglie {membri.join(", ")}. Per Istanta ogni kit si divide in un kit per membro.
                          </p>
                        )}
                      </Table.Td>
                      <Table.Td className="whitespace-nowrap align-top">
                        <div className="flex items-center gap-2">
                          <span>{voce.codice}</span>
                          {codiceDoppio(voce.codice, doppi[tipo]) && (
                            <StatusBadge tono="warning" etichetta="Codice doppio" />
                          )}
                        </div>
                      </Table.Td>
                      <Table.Td className="whitespace-nowrap text-right align-top">
                        <div className="flex justify-end gap-2">
                          <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI} mode="disable">
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => apriVoce(tipo, voce)}
                              title={`Modifica ${articolo}`}
                              aria-label={`Modifica ${tipo} ${voce.nome}`}
                            >
                              <Lucide icon="Pencil" aria-hidden="true" className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI}>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => setDaEliminare({ tipo, id: voce.id, nome: voce.nome })}
                              title={`Elimina ${articolo}`}
                              aria-label={`Elimina ${tipo} ${voce.nome}`}
                            >
                              <Lucide icon="Trash2" aria-hidden="true" className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
            </Table.Tbody>
          </Table>
        </div>
      </div>
    );
  };

  // Riga vuota della tabella: distingue l'assenza di dati da una ricerca senza risultati
  const rigaVuota = (colonne: number, senzaDati: boolean, titolo: string, icona: "MapPin" | "Radio" | "Box") => (
    <Table.Tr>
      <Table.Td colSpan={colonne} className="p-0">
        {senzaDati ? (
          <EmptyState compatta icon={icona} title={titolo} description="Usa Crea per aggiungerne." />
        ) : (
          <EmptyState compatta icon="SearchX" title="Nessun risultato" description={`Nessun elemento corrisponde a "${ricerca.trim()}".`} />
        )}
      </Table.Td>
    </Table.Tr>
  );

  const proxyNoti = useMemo(
    () => proxyDaVoci(
      anagrafica.canali.map((v) => ({ ...v, membri: v.membri ?? [] })),
      anagrafica.aree.map((v) => ({ ...v, membri: v.membri ?? [] }))
    ),
    [anagrafica.canali, anagrafica.aree]
  );
  const codiceDi = (id: string) => perId.get(id)?.codice ?? "?";

  // In che combinazioni si divide per Istanta una combinazione proxy, e quali mancano o sono disattive
  const pezziPerIstanta = (c: CombinazioneAnagrafica) => {
    const pezzi = pezziDellaCombinazione(c, proxyNoti, anagrafica.combinazioni);
    const sigla = (p: (typeof pezzi)[number]) => p.combinazione?.sigla || `${codiceDi(p.idCanale)}_${codiceDi(p.idArea)}`;
    const attivi = pezzi.filter((p) => p.attiva).map(sigla);
    const esclusi = pezzi.filter((p) => !p.attiva).map((p) => `${sigla(p)} ${p.combinazione ? "disattiva" : "non esiste"}: nessun pezzo`);
    return (
      <p className="text-xs text-slate-500">
        Per Istanta diventa: {attivi.length > 0 ? attivi.join(", ") : "nessuna combinazione"}
        {esclusi.length > 0 && <span className="block">{esclusi.join(". ")}.</span>}
      </p>
    );
  };

  const rigaCombinazione = (c: CombinazioneAnagrafica) => {
    const attiva = statiInAttesa[c.id] ?? c.stato === "ATTIVO";
    const inSalvataggio = c.id in statiInAttesa;
    return [
      <Table.Tr key={c.id}>
        <Table.Td className="align-top">{c.canale_nome || c.canale_codice}</Table.Td>
        <Table.Td className="align-top">{c.area_nome || c.area_codice}</Table.Td>
        <Table.Td className="whitespace-nowrap align-top">{c.sigla}</Table.Td>
        <Table.Td className="whitespace-nowrap align-top">
          <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI} mode="disable">
            <FormSwitch>
              <FormSwitch.Input
                id={`attiva-${c.id}`}
                type="checkbox"
                checked={attiva}
                disabled={inSalvataggio}
                aria-label={`Attiva ${c.sigla}`}
                onChange={(e) => cambiaStato.mutate({ combinazione: c, attiva: e.target.checked })}
              />
              <FormSwitch.Label htmlFor={`attiva-${c.id}`} className="text-sm">
                {attiva ? "Attiva" : "Disattiva"}
              </FormSwitch.Label>
            </FormSwitch>
          </PermissionGate>
        </Table.Td>
        <Table.Td className="whitespace-nowrap text-right align-top">
          <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI}>
            <Button
              size="sm"
              variant="outline-danger"
              onClick={() => setDaEliminare({ tipo: "combinazione", id: c.id, nome: nomeCombinazione(c) })}
              title="Elimina combinazione"
              aria-label={`Elimina combinazione ${c.sigla}`}
            >
              <Lucide icon="Trash2" aria-hidden="true" className="h-4 w-4" />
            </Button>
          </PermissionGate>
        </Table.Td>
      </Table.Tr>,
      ...(c.proxy
        ? [
          <Table.Tr key={`${c.id}-pezzi`}>
            <Table.Td colSpan={5} className="border-t-0 pt-0">{pezziPerIstanta(c)}</Table.Td>
          </Table.Tr>,
        ]
        : []),
    ];
  };

  const tabellaCombinazioni = (righe: CombinazioneAnagrafica[], etichetta: string) => (
    <div className="overflow-x-auto">
      <Table aria-label={etichetta}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Canale</Table.Th>
            <Table.Th>Area</Table.Th>
            <Table.Th>Sigla</Table.Th>
            <Table.Th>Attiva</Table.Th>
            <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{righe.flatMap(rigaCombinazione)}</Table.Tbody>
      </Table>
    </div>
  );

  const sezioneCombinazioni = () => {
    const normali = combinazioniVisibili.filter((c) => !c.proxy);
    const proxy = combinazioniVisibili.filter((c) => Boolean(c.proxy));
    const vuote = normali.length === 0 && proxy.length === 0;
    return (
      <div className="col-span-12 overflow-hidden rounded-card border border-slate-200 bg-white">
        <h3 className="title-card px-4 py-3">Combinazioni</h3>
        {vuote ? (
          anagrafica.combinazioni.length === 0 ? (
            <EmptyState compatta icon="Box" title="Nessuna combinazione disponibile" description="Usa Crea per aggiungerne." />
          ) : (
            <EmptyState compatta icon="SearchX" title="Nessun risultato" description={`Nessun elemento corrisponde a "${ricerca.trim()}".`} />
          )
        ) : (
          <>
            {normali.length > 0 && tabellaCombinazioni(normali, "Combinazioni")}
            {proxy.length > 0 && (
              <div className="border-t border-slate-200">
                <div className="bg-slate-50 px-4 py-2">
                  <div className="text-sm font-medium">Combinazioni proxy</div>
                  <div className="text-xs text-slate-500">
                    Servono per i kit e non hanno punti vendita. Per Istanta ogni kit si divide nelle combinazioni attive dei membri.
                  </div>
                </div>
                {tabellaCombinazioni(proxy, "Combinazioni proxy")}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const dialogoVoce = () => {
    if (!formVoce) return null;
    const { tipo } = formVoce;
    const { singolare } = ETICHETTE[tipo];
    // Membri possibili: le voci normali della GDO, mai un altro proxy ne' la voce stessa
    const candidati = vociDi(tipo).filter((v) => v.id !== formVoce.id && !eProxy(v.membri));
    const membriScelti = candidati.filter((v) => formVoce.membri.includes(v.id));
    const proxyIncompleto = formVoce.proxy && membriScelti.length < 2;
    const aggiorna = (modifica: Partial<FormVoce>) => setFormVoce({ ...formVoce, ...modifica });
    const cambiaMembro = (id: string, scelto: boolean) =>
      aggiorna({ membri: scelto ? [...formVoce.membri, id] : formVoce.membri.filter((m) => m !== id) });
    return (
      <Dialog open onClose={() => setFormVoce(null)}>
        <Dialog.Panel>
          <Dialog.Title>{formVoce.id ? `Modifica ${singolare}` : `Crea ${singolare}`}</Dialog.Title>
          <Dialog.Description className="grid grid-cols-12 gap-4 gap-y-3">
            <FormField className="col-span-12 sm:col-span-6" etichetta="Nome" obbligatorio>
              <FormInput type="text" value={formVoce.nome} onChange={(e) => aggiorna({ nome: e.target.value })} />
            </FormField>
            <FormField className="col-span-12 sm:col-span-6" etichetta="Sigla" obbligatorio>
              <FormInput type="text" value={formVoce.codice} onChange={(e) => aggiorna({ codice: e.target.value })} />
            </FormField>
            <div className="col-span-12">
              <FormSwitch>
                <FormSwitch.Input
                  id={`proxy-${tipo}`}
                  type="checkbox"
                  checked={formVoce.proxy}
                  disabled={Boolean(formVoce.id)}
                  onChange={(e) => aggiorna({ proxy: e.target.checked })}
                />
                <FormSwitch.Label htmlFor={`proxy-${tipo}`}>
                  {tipo === "area" ? "Area proxy" : "Canale proxy"}
                </FormSwitch.Label>
              </FormSwitch>
              <FormHelp>
                {formVoce.id
                  ? "Il tipo si sceglie alla creazione e non cambia."
                  : `Raccoglie ${tipo === "area" ? "più aree" : "più canali"} con lo stesso volantino: un solo design, e per Istanta un kit per membro.`}
              </FormHelp>
            </div>
            {formVoce.proxy && (
              <>
                <fieldset className="col-span-12">
                  <legend className="mb-2 text-sm font-medium">Membri (almeno 2)</legend>
                  {candidati.length === 0 ? (
                    <p className="text-sm text-slate-500">Nessun{tipo === "area" ? "a area" : " canale"} da aggiungere.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {candidati.map((v) => (
                        <FormCheck key={v.id}>
                          <FormCheck.Input
                            id={`membro-${v.id}`}
                            type="checkbox"
                            checked={formVoce.membri.includes(v.id)}
                            onChange={(e) => cambiaMembro(v.id, e.target.checked)}
                          />
                          <FormCheck.Label htmlFor={`membro-${v.id}`}>
                            {v.nome} <span className="text-slate-500">{v.codice}</span>
                          </FormCheck.Label>
                        </FormCheck>
                      ))}
                    </div>
                  )}
                </fieldset>
              </>
            )}
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="outline-secondary" onClick={() => setFormVoce(null)}>
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={!formVoce.nome.trim() || !formVoce.codice.trim() || proxyIncompleto}
              loading={salvaVoce.isPending}
              onClick={() => salvaVoce.mutate(formVoce)}
            >
              {formVoce.id ? "Modifica" : "Crea"}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
    );
  };

  const dialogoCombinazione = () => {
    if (!formCombinazione) return null;
    const aggiorna = (cambi: Partial<FormCombinazione>) => setFormCombinazione({ ...formCombinazione, ...cambi });
    return (
      <Dialog open onClose={() => setFormCombinazione(null)}>
        <Dialog.Panel>
          <Dialog.Title>Crea Combinazione</Dialog.Title>
          <Dialog.Description className="grid grid-cols-12 gap-4 gap-y-3">
            <FormField className="col-span-12 sm:col-span-6" etichetta="Area">
              <FormSelect className="w-full" value={formCombinazione.idArea} onChange={(e) => aggiorna({ idArea: e.target.value })}>
                {anagrafica.aree.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nome} ({area.codice})
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField className="col-span-12 sm:col-span-6" etichetta="Canale">
              <FormSelect className="w-full" value={formCombinazione.idCanale} onChange={(e) => aggiorna({ idCanale: e.target.value })}>
                {anagrafica.canali.map((canale) => (
                  <option key={canale.id} value={canale.id}>
                    {canale.nome} ({canale.codice})
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField className="col-span-12" etichetta="Stato">
              <FormSelect className="w-full" value={formCombinazione.attiva ? "true" : "false"} onChange={(e) => aggiorna({ attiva: e.target.value === "true" })}>
                <option value="true">Attivo</option>
                <option value="false">Disattivo</option>
              </FormSelect>
            </FormField>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="outline-secondary" onClick={() => setFormCombinazione(null)}>
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={!formCombinazione.idArea || !formCombinazione.idCanale}
              loading={salvaCombinazione.isPending}
              onClick={() => salvaCombinazione.mutate(formCombinazione)}
            >
              Crea
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
    );
  };

  const titoloEliminazione = daEliminare?.tipo === "area" ? "Elimina area" : daEliminare?.tipo === "canale" ? "Elimina canale" : "Elimina combinazione";
  const vocePerEliminazione = daEliminare && daEliminare.tipo !== "combinazione" ? ETICHETTE[daEliminare.tipo] : null;

  return (
    <>
      <ConfirmDialog
        open={daEliminare !== null}
        title={titoloEliminazione}
        description={
          vocePerEliminazione
            ? `Sei sicuro di voler eliminare ${vocePerEliminazione.articolo} ${daEliminare?.nome ?? ""}?`
            : `Sei sicuro di voler eliminare la combinazione ${daEliminare?.nome ?? ""}?`
        }
        confirmLabel="Elimina"
        onClose={() => setDaEliminare(null)}
        onConfirm={() => {
          if (daEliminare) elimina.mutate(daEliminare);
          setDaEliminare(null);
        }}
      />
      {dialogoVoce()}
      {dialogoCombinazione()}
      <Pagina
        titolo="Aree e Canali"
        descrizione="Le aree e i canali dei punti vendita e le loro combinazioni"
        azioni={
          <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI} mode="disable">
            <Menu className="inline-block text-left">
              <Menu.Button as={Button} variant="primary">
                <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
                Crea
                <Lucide icon="ChevronDown" aria-hidden="true" className="ml-2 h-4 w-4" />
              </Menu.Button>
              <Menu.Items className="w-56">
                <Menu.Item onClick={() => apriVoce("area")}>
                  <Lucide icon="MapPin" aria-hidden="true" className="mr-2 h-4 w-4" />
                  Crea Area
                </Menu.Item>
                <Menu.Item onClick={() => apriVoce("canale")}>
                  <Lucide icon="Radio" aria-hidden="true" className="mr-2 h-4 w-4" />
                  Crea Canale
                </Menu.Item>
                <Menu.Item onClick={() => apriCombinazione()}>
                  <Lucide icon="Box" aria-hidden="true" className="mr-2 h-4 w-4" />
                  Crea Combinazione
                </Menu.Item>
              </Menu.Items>
            </Menu>
          </PermissionGate>
        }
      >
        {/* Titolo e descrizione sono quelli della pagina: la sezione non li ripete */}
        <Sezione senzaPadding>
          <BarraFiltri>
            <CampoRicerca
              etichetta="Cerca aree, canali e combinazioni"
              placeholder="Cerca per nome, codice o sigla"
              value={ricerca}
              onChange={setRicerca}
            />
          </BarraFiltri>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner etichetta="Caricamento aree e canali…" />
            </div>
          ) : isError ? (
            <div className="p-5">
              <PageError
                compatta
                titolo="Aree e canali non caricati"
                motivo={(error as Error)?.message || "Errore durante il recupero di aree e canali"}
                onRiprova={() => refetch()}
              />
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-5 p-5">
              {tabellaVoci("area")}
              {tabellaVoci("canale")}
              {sezioneCombinazioni()}
            </div>
          )}
        </Sezione>
      </Pagina>
    </>
  );
}

export default withSessionChecked(Main);
