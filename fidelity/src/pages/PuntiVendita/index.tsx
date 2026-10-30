import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { Dialog, Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Segmenti, { type OpzioneSegmento } from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import Tippy from "@/components/Base/Tippy";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PermissionGate } from "@/components/PermissionGate";
import { codiciIdentificativi, storiaDi, storiaNellElenco, useElencoPuntiVendita, type ConStoria, type FiltroAggiuntivo } from "@/components/PuntiVendita/elenco";
import { FiltriPuntiVendita } from "@/components/PuntiVendita/FiltriPuntiVendita";
import { MappaPuntiVendita } from "@/components/PuntiVendita/MappaPuntiVendita";
import { problemiDati, StatoDati } from "@/components/PuntiVendita/StatoDati";
import { TabellaPuntiVendita } from "@/components/PuntiVendita/TabellaPuntiVendita";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from "@/context/NotificationContext";
import { useFetchPuntiVenditaConsultazione, useFetchPuntiVenditaFromIdGDO, useFetchQualitaPuntiVendita } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RigaNonAbbinata } from "../../../lib/puntiVendita/analisi";
import { ServerCall } from "../../../lib/server_call";
import { EsitoRigaImportPuntoVenditaDTO, PuntoVenditaResponseDTO, StatoImportPuntiVenditaDTO } from "../../../server/core/dto";
import { classePunteggio, percentualeImport, riepilogoAnteprima, testoRiepilogoImport } from "../../utils/importPuntiVendita";
import { contaPer, valoriFormPuntoVendita } from "../../utils/puntoVendita";
import { AvanzamentoImport } from "./AvanzamentoImport";
import {
  CampiPuntoVendita,
  corpoSalvataggio,
  useCombinazioniPerCanale,
  useFormPuntoVendita,
  valoriNuovoPuntoVendita,
  type DatiFormPuntoVendita,
  type RispostaSalvataggioPuntoVendita,
} from "./formPuntoVendita";
import { ImportStoricoVolantini } from "./ImportStoricoVolantini";
import { InserimentoManualeImport } from "./InserimentoManualeImport";
import { ETICHETTA_FILTRO_QUALITA, QualitaDati, type FiltroQualita } from "./QualitaDati";
import { RigheNonAbbinate } from "./RigheNonAbbinate";
import { useImportPuntiVendita } from "./useImportPuntiVendita";

/** Il punto vendita dell'anagrafica con la sua storia nei volantini, quando il server la manda. */
type PuntoVenditaGestione = PuntoVenditaResponseDTO & ConStoria;

type Vista = "tabella" | "mappa";

const OPZIONI_VISTA: OpzioneSegmento<Vista>[] = [
  { valore: "tabella", etichetta: "Tabella" },
  { valore: "mappa", etichetta: "Mappa" },
];

const percorsoGestione = (pv: { id: string }) => `/gestione-interna/punti-vendita/${pv.id}`;
const percorsoScheda = (pv: { id: string }) => `/punti-vendita/${pv.id}`;

/**
 * Gestione dei punti vendita (/gestione-interna/punti-vendita, "gdo.gestisci_punti_vendita"):
 * in alto i problemi dei dati, che fanno da filtro; una sola azione primaria (Nuovo punto vendita)
 * e i due import sotto "Importa"; tabella o mappa con i filtri accanto ai risultati; in fondo le
 * righe dei volantini che non corrispondono a nessun punto vendita.
 */
function Main() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showNotification } = useNotification();
  const [pvDaEliminare, setPvDaEliminare] = useState<PuntoVenditaResponseDTO | null>(null);
  const navigate = useNavigate();
  const form = useFormPuntoVendita();
  const { handleSubmit, reset, getValues } = form;

  /* --------------------------------------------------
   * QUERY
   * ------------------------------------------------*/
  const queryClient = useQueryClient();
  const { combinazioni: combinazioniDisponibili, perCanale: combinazioniPerCanale } = useCombinazioniPerCanale();
  const puntiVenditaQuery = useFetchPuntiVenditaFromIdGDO();
  // La storia nei volantini di ogni punto vendita arriva con l'elenco della consultazione
  const consultazioneQuery = useFetchPuntiVenditaConsultazione();
  const qualitaQuery = useFetchQualitaPuntiVendita();
  const storiaNota = useMemo(() => storiaNellElenco(consultazioneQuery.data ?? []), [consultazioneQuery.data]);
  const tuttiPuntiVendita = useMemo<PuntoVenditaGestione[]>(() => {
    const storie = new Map((consultazioneQuery.data ?? []).map(pv => [pv.id, storiaDi(pv)]));
    return (puntiVenditaQuery.data ?? []).map(pv => ({ ...pv, storia: storie.get(pv.id) }));
  }, [puntiVenditaQuery.data, consultazioneQuery.data]);
  // La colonna e il problema "senza codice" valgono solo per le GDO che usano i codici (es. id ANACAN)
  const gdoConCodici = useMemo(() => tuttiPuntiVendita.some(pv => codiciIdentificativi(pv.meta).length > 0), [tuttiPuntiVendita]);
  const contestoDati = useMemo(() => ({ gdoConCodici, storiaNota }), [gdoConCodici, storiaNota]);

  // Le tessere della qualità dei dati accendono un filtro dell'elenco
  const [filtroQualita, setFiltroQualita] = useState<FiltroQualita | null>(null);
  const azzeraFiltroQualita = useCallback(() => setFiltroQualita(null), []);
  const filtro = useMemo<FiltroAggiuntivo<PuntoVenditaGestione> | null>(() => {
    if (!filtroQualita) return null;
    const test = (pv: PuntoVenditaGestione) => {
      const problemi = problemiDati(pv, contestoDati);
      if (filtroQualita === "senzaCoordinate") return problemi.senzaCoordinate;
      if (filtroQualita === "senzaCodice") return problemi.senzaCodice;
      return problemi.maiNeiVolantini;
    };
    return { chiave: filtroQualita, test, azzera: azzeraFiltroQualita };
  }, [filtroQualita, contestoDati, azzeraFiltroQualita]);
  const elenco = useElencoPuntiVendita(tuttiPuntiVendita, { filtro });
  const [vista, setVista] = useState<Vista>("tabella");
  const errore = puntiVenditaQuery.isError
    ? (puntiVenditaQuery.error as Error)?.message || "Errore durante il recupero dei punti vendita"
    : null;
  const riepilogo = useMemo(() => {
    if (!puntiVenditaQuery.data) return undefined;
    const insegne = contaPer(tuttiPuntiVendita, "canale").length;
    const aree = contaPer(tuttiPuntiVendita, "area").length;
    return [
      tuttiPuntiVendita.length === 1 ? "1 punto vendita" : `${formatNumero(tuttiPuntiVendita.length)} punti vendita`,
      insegne === 1 ? "1 insegna" : `${formatNumero(insegne)} insegne`,
      aree === 1 ? "1 area" : `${formatNumero(aree)} aree`,
    ].join(" · ");
  }, [puntiVenditaQuery.data, tuttiPuntiVendita]);

  const invalidatePuntiVendita = () => {
    queryClient.invalidateQueries({ queryKey: ["dataPuntiVendita"] });
    // Consultazione, rete per insegna e qualità dei dati contano gli stessi punti vendita
    queryClient.invalidateQueries({ queryKey: ["puntiVendita"] });
  };

  /* --------------------------------------------------
   * STATE UI & DIALOG
   * ------------------------------------------------*/
  const [isPuntoVenditaDialogOpen, setIsPuntoVenditaDialogOpen] =
    useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPuntoVendita, setCurrentPuntoVendita] =
    useState<PuntoVenditaResponseDTO | null>(null);
  const [isExcelImportDialogOpen, setIsExcelImportDialogOpen] = useState(false);
  const [isImportStoricoOpen, setIsImportStoricoOpen] = useState(false);
  const [fileImport, setFileImport] = useState<File | null>(null);
  const [anteprimaImport, setAnteprimaImport] = useState<EsitoRigaImportPuntoVenditaDTO[]>([]);
  // Il modale della riga in attesa si apre da solo; "Più tardi" lo nasconde fino alla riga successiva
  const [rigaRidotta, setRigaRidotta] = useState<number | null>(null);
  const didSetDefaultCanaleRef = useRef(false);

  // L'import gira in background: l'avanzamento arriva via socket, anche dopo aver ricaricato la pagina
  const alTermineImport = useCallback((stato: StatoImportPuntiVenditaDTO) => {
    queryClient.invalidateQueries({ queryKey: ["dataPuntiVendita"] });
    queryClient.invalidateQueries({ queryKey: ["puntiVendita"] });
    const riepilogo = testoRiepilogoImport(stato);
    if (stato.stato === "annullato") showNotification(`Importazione annullata: ${riepilogo}`, { variant: "warning" });
    else if (stato.stato === "errore") showNotification(`Importazione interrotta per un errore: ${riepilogo}`, { variant: "error" });
    else showNotification(`Importazione completata: ${riepilogo}`, { variant: stato.errori.length ? "warning" : "success" });
  }, [queryClient, showNotification]);
  const importJob = useImportPuntiVendita(alTermineImport);
  const statoImport = importJob.stato;
  const rigaInAttesa = statoImport?.stato === "in_attesa" ? statoImport.rigaInAttesa : undefined;
  const combinazioniOrdinate = useMemo(
    () => combinazioniPerCanale.flatMap(([, combinazioni]) => combinazioni),
    [combinazioniPerCanale]
  );
  // Un import in corso trovato riaprendo la pagina si vede nella fascia dell'avanzamento, sopra l'elenco

  const chiudiImport = () => {
    setIsExcelImportDialogOpen(false);
    // Chiudere la finestra non ferma l'import: si riapre col pulsante e si vede l'avanzamento
    if (importJob.inCorso) return;
    setFileImport(null);
    setAnteprimaImport([]);
    importJob.azzera();
  };

  /* --------------------------------------------------
   * FIX LOOP INFINITO:
   * imposto canaleArea una sola volta (solo se il campo è vuoto/diverso)
   * ------------------------------------------------*/
  useEffect(() => {
    if (
      isPuntoVenditaDialogOpen &&          // dialog aperto
      !isEditMode &&                       // nuova creazione
      !didSetDefaultCanaleRef.current &&   // non l'abbiamo già fatto
      (combinazioniDisponibili.data ?? []).length
    ) {
      const defaultId = combinazioniDisponibili.data![0].id;
      reset({                               // un unico reset, nessun loop
        ...getValues(),                     // preserva eventuali altri campi
        canaleArea: defaultId,
      });
      didSetDefaultCanaleRef.current = true;
    }

    /* quando il dialog si chiude, azzera il flag
       così al prossimo open torneremo a impostare il default una sola volta */
    if (!isPuntoVenditaDialogOpen) {
      didSetDefaultCanaleRef.current = false;
    }
  }, [
    isPuntoVenditaDialogOpen,
    isEditMode,
    combinazioniDisponibili.data,
    reset,
    getValues,
  ]);

  /* --------------------------------------------------
   * MUTAZIONI
   * ------------------------------------------------*/
  const esitoSalvataggio = (result: RispostaSalvataggioPuntoVendita) => {
    if (result.esito && result.data) {
      const message = result.isUpdate
        ? "Punto vendita aggiornato con successo"
        : "Punto vendita creato con successo";
      showNotification(message, { variant: "success" });
      invalidatePuntiVendita();
      reset();
      setIsPuntoVenditaDialogOpen(false);
    }
  };

  // salvaPV e modificaPV scrivono prima su Istanta e poi in Fidelity, con lo stesso GUID
  const mutationCreate = useMutation({
    mutationFn: (data: DatiFormPuntoVendita) =>
      ServerCall.put<RispostaSalvataggioPuntoVendita>("/ACPV/salvaPV", corpoSalvataggio(data, "")),
    onSuccess: esitoSalvataggio,
    onError: (e: Error) =>
      showNotification(e?.message || "Errore durante la creazione del punto vendita", { variant: "error" }),
  });

  const mutationUpdate = useMutation({
    mutationFn: ({ data, guidID }: { data: DatiFormPuntoVendita; guidID: string }) =>
      ServerCall.put<RispostaSalvataggioPuntoVendita>("/ACPV/modificaPV", corpoSalvataggio(data, guidID)),
    onSuccess: esitoSalvataggio,
    onError: (e: Error) =>
      showNotification(e?.message || "Errore durante la modifica del punto vendita", { variant: "error" }),
  });

  const mutationDelete = useMutation({
    mutationFn: async (id: string) =>
      await ServerCall.delete(`/ACPV/eliminaPV/${id}`),
    onSuccess: () => {
      invalidatePuntiVendita();
      setPvDaEliminare(null);
      showNotification("Punto vendita eliminato", { variant: "success" });
    },
    onError: (e) =>
      showNotification(
        e?.message ||
        "Errore durante l'eliminazione del punto vendita",
        { variant: "error" }
      ),
  });

  // Il server legge il file col tracciato della GDO: con anteprima dice solo cosa farebbe di ogni riga
  const inviaFileImport = <T,>(file: File, anteprima: boolean) => {
    const formData = new FormData();
    formData.append("file", file);
    return ServerCall.post<T>(`/ACPV/importaPV${anteprima ? "?anteprima=true" : ""}`, formData, true);
  };

  const mutationAnteprimaImport = useMutation({
    mutationFn: (file: File) => inviaFileImport<{ righe: EsitoRigaImportPuntoVenditaDTO[] }>(file, true),
    onSuccess: (data) => setAnteprimaImport(data.righe),
    onError: (e: Error) => {
      setFileImport(null);
      showNotification(e?.message || "Errore durante la lettura del file Excel", {
        variant: "error",
      });
    },
  });

  const messaggioErrore = (e: unknown) => (e instanceof Error ? e.message : "");

  const avviaImport = async () => {
    if (!fileImport) return;
    try {
      await importJob.avvia(fileImport);
    } catch (e) {
      showNotification(messaggioErrore(e) || "Errore durante l'importazione dei punti vendita", { variant: "error" });
    }
  };

  const annullaImport = async () => {
    try {
      await importJob.annulla();
    } catch (e) {
      showNotification(messaggioErrore(e) || "Impossibile annullare l'importazione", { variant: "error" });
    }
  };

  /* --------------------------------------------------
   * HANDLERS CRUD
   * ------------------------------------------------*/

  const handleModify = (pv: PuntoVenditaResponseDTO) => {
    setIsEditMode(true);
    setCurrentPuntoVendita(pv);
    reset(valoriFormPuntoVendita(pv));
    setIsPuntoVenditaDialogOpen(true);
  };

  /** Nuovo punto vendita, con la prima combinazione; dai volantini arrivano già indirizzo, città e telefono. */
  const openNewPuntoVenditaDialog = (precompilati: Partial<ReturnType<typeof valoriNuovoPuntoVendita>> = {}) => {
    reset({ ...valoriNuovoPuntoVendita(combinazioniDisponibili.data?.[0]?.id || ""), ...precompilati });
    setIsEditMode(false);
    setCurrentPuntoVendita(null);
    setIsPuntoVenditaDialogOpen(true);
  };

  const aggiungiDaRiga = (riga: RigaNonAbbinata) =>
    openNewPuntoVenditaDialog({
      indirizzo: riga.indirizzo ?? "",
      citta: riga.localita ?? "",
      telefono: riga.telefono ?? "",
    });

  const onSubmit = (data: DatiFormPuntoVendita) => {
    if (isEditMode && currentPuntoVendita) {
      mutationUpdate.mutate({ data, guidID: currentPuntoVendita.id });
    } else {
      mutationCreate.mutate(data);
    }
  };

  /* --------------------------------------------------
   * HANDLER EXCEL
   * ------------------------------------------------*/
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // per poter riscegliere lo stesso file dopo averlo corretto
    if (!file) return;
    setFileImport(file);
    setAnteprimaImport([]);
    importJob.azzera();
    mutationAnteprimaImport.mutate(file);
  };

  const conteggiAnteprima = riepilogoAnteprima(anteprimaImport);
  const righeDaElaborare = conteggiAnteprima.importabili + conteggiAnteprima.daInserireAMano;

  const openFileSelector = () => fileInputRef.current?.click();

  /** Comandi di riga compatti: Modifica a icona in vista, scheda, dispositivi ed eliminazione nel menu "⋯". */
  const azioniRiga = (pv: PuntoVenditaGestione) => (
    <div className="inline-flex items-center justify-end gap-1">
      <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
        <Tippy content="Modifica">
          <Button size="sm" variant="outline-secondary" onClick={() => handleModify(pv)} aria-label={`Modifica ${pv.nome}`}>
            <Lucide icon="Pencil" aria-hidden="true" className="h-4 w-4" />
          </Button>
        </Tippy>
      </PermissionGate>
      <Menu className="inline-block text-left">
        <Menu.Button as={Button} size="sm" variant="outline-secondary" aria-label={`Altre azioni punto vendita ${pv.nome}`}>
          <Lucide icon="Ellipsis" aria-hidden="true" className="h-4 w-4" />
        </Menu.Button>
        <Menu.Items className="w-52">
          {/* La scheda di consultazione, con i volantini attivi e la storia */}
          <Menu.Item onClick={() => navigate(percorsoScheda(pv))}>
            <Lucide icon="Store" aria-hidden="true" className="mr-2 h-4 w-4" />
            Apri scheda
          </Menu.Item>
          <Menu.Item onClick={() => navigate(`${percorsoGestione(pv)}?scheda=dispositivi`)}>
            <Lucide icon="Monitor" aria-hidden="true" className="mr-2 h-4 w-4" />
            Dispositivi e display
          </Menu.Item>
          <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA}>
            <Menu.Item className="text-danger" onClick={() => setPvDaEliminare(pv)}>
              <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
              Elimina
            </Menu.Item>
          </PermissionGate>
        </Menu.Items>
      </Menu>
    </div>
  );

  /* --------------------------------------------------
   * RENDER
   * ------------------------------------------------*/
  return (
    <>
      <ConfirmDialog
        open={!!pvDaEliminare}
        title="Eliminare il punto vendita?"
        description={<>Il punto vendita <strong>{pvDaEliminare?.nome}</strong> verrà eliminato.</>}
        confirmLabel="Elimina"
        loading={mutationDelete.isPending}
        onClose={() => setPvDaEliminare(null)}
        onConfirm={() => pvDaEliminare && mutationDelete.mutate(pvDaEliminare.id as string)}
      />
      {/* Dialog creazione/modifica punto vendita */}
      <Dialog
        size="lg"
        open={isPuntoVenditaDialogOpen}
        onClose={() => setIsPuntoVenditaDialogOpen(false)}
      >
        <Dialog.Panel>
          <Dialog.Title>{isEditMode ? "Modifica punto vendita" : "Nuovo punto vendita"}</Dialog.Title>
          <Dialog.Description>
            <form id="punto-vendita-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <p className="mb-4 text-xs text-slate-500">Il salvataggio scrive prima su Istanta e poi in Fidelity.</p>
              <CampiPuntoVendita form={form} combinazioniPerCanale={combinazioniPerCanale} />
            </form>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              onClick={() => setIsPuntoVenditaDialogOpen(false)}
              disabled={mutationCreate.isPending || mutationUpdate.isPending}
            >
              Annulla
            </Button>
            {/* Solo submit del form: con anche onClick il salvataggio partirebbe due volte */}
            <Button
              type="submit"
              variant="primary"
              form="punto-vendita-form"
              loading={mutationCreate.isPending || mutationUpdate.isPending}
            >
              {isEditMode ? "Salva modifiche" : "Crea punto vendita"}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {rigaInAttesa && rigaRidotta !== rigaInAttesa.riga && (
        <InserimentoManualeImport
          riga={rigaInAttesa}
          combinazioni={combinazioniOrdinate}
          onDecidi={async decisione => {
            await importJob.decidi(decisione);
            queryClient.invalidateQueries({ queryKey: ["dataPuntiVendita"] });
          }}
          onAnnullaImport={annullaImport}
          onRiduci={() => setRigaRidotta(rigaInAttesa.riga)}
          annullamentoInCorso={importJob.annullamentoInCorso}
        />
      )}

      {/* Dialog importazione Excel */}
      <Dialog
        size="xl"
        open={isExcelImportDialogOpen}
        onClose={chiudiImport}
      >
        <Dialog.Panel>
          <Dialog.Title>Importa l&apos;anagrafica da Excel</Dialog.Title>
          <Dialog.Description>
            <div className="grid grid-cols-12 gap-4 gap-y-3">
              <div className="col-span-12">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline-secondary"
                  className="w-full"
                  onClick={openFileSelector}
                  disabled={importJob.inCorso || importJob.avvioInCorso}
                  loading={mutationAnteprimaImport.isPending}
                >
                  {!mutationAnteprimaImport.isPending && (
                    <Lucide icon="Upload" aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  {fileImport ? fileImport.name : "Seleziona file Excel"}
                </Button>
                <div className="mt-2 text-xs text-slate-500">
                  Il file viene letto con il tracciato previsto per la tua GDO.
                </div>
              </div>

              {statoImport && (
                <div className="col-span-12 mt-4">
                  <div className="flex items-center justify-between text-sm font-medium mb-2">
                    <span>
                      {importJob.inCorso
                        ? importJob.annullamentoInCorso
                          ? "Annullamento in corso…"
                          : statoImport.stato === "in_attesa"
                            ? "Importazione in pausa"
                            : "Importazione in corso…"
                        : statoImport.stato === "annullato"
                          ? "Importazione annullata"
                          : statoImport.stato === "errore"
                            ? "Importazione interrotta"
                            : "Importazione completata"}
                    </span>
                    <span>
                      {statoImport.elaborate} / {statoImport.totale} righe
                    </span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full bg-slate-200 dark:bg-darkmode-400 overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentualeImport(statoImport)}
                  >
                    <div
                      className={clsx(
                        "h-full transition-all",
                        statoImport.stato === "annullato" || statoImport.stato === "errore" ? "bg-warning" : "bg-primary"
                      )}
                      style={{ width: `${percentualeImport(statoImport)}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div>Creati: <strong>{statoImport.creati}</strong></div>
                    <div>Aggiornati: <strong>{statoImport.aggiornati}</strong></div>
                    <div>Scartati: <strong>{statoImport.scartati}</strong></div>
                    <div>Inseriti a mano: <strong>{statoImport.inseritiAMano}</strong></div>
                    <div>Geolocalizzati: <strong>{statoImport.geolocalizzati}</strong></div>
                    <div>Senza coordinate: <strong>{statoImport.senzaCoordinate}</strong></div>
                    {(statoImport.stato === "annullato" || statoImport.stato === "errore") && (
                      <div>Non elaborati: <strong>{statoImport.nonElaborate}</strong></div>
                    )}
                  </div>
                  {statoImport.erroriNominatim > 0 && (
                    <Alert variant="soft-danger" icona="CircleAlert" className="mt-3 px-3 py-2 text-xs">
                      Nominatim in errore ({statoImport.erroriNominatim} righe senza coordinate): {statoImport.ultimoErroreNominatim}
                    </Alert>
                  )}
                  {statoImport.soloFp > 0 && (
                    <div className="mt-3 text-xs text-warning flex items-center">
                      <Lucide icon="TriangleAlert" aria-hidden="true" className="mr-1 h-4 w-4" />
                      {statoImport.soloFp} punti vendita salvati solo in FP: Istanta non era raggiungibile, i due sistemi non sono allineati
                    </div>
                  )}
                  {rigaInAttesa && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-warning">In pausa sulla riga {rigaInAttesa.riga}: serve il tuo inserimento manuale.</span>
                      {rigaRidotta === rigaInAttesa.riga && (
                        <Button variant="outline-warning" size="sm" onClick={() => setRigaRidotta(null)}>
                          Apri la riga in attesa
                        </Button>
                      )}
                    </div>
                  )}
                  {!importJob.inCorso && statoImport.errori.length > 0 && (
                    <ul className="mt-3 max-h-64 overflow-y-auto rounded-control border border-slate-200 p-3 text-xs text-danger">
                      {statoImport.errori.map((e, i) => (
                        <li key={`${e.row}-${i}`}>
                          Riga {e.row}: {e.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {!statoImport && anteprimaImport.length > 0 && (
                <div className="col-span-12 mt-4">
                  <h3 className="title-card mb-2">
                    Anteprima ({anteprimaImport.length} righe)
                  </h3>
                  <div className="max-h-64 overflow-y-auto rounded-card border border-slate-200">
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Riga</Table.Th>
                          <Table.Th>Nome</Table.Th>
                          <Table.Th>Città</Table.Th>
                          <Table.Th>Indirizzo</Table.Th>
                          <Table.Th>Cap</Table.Th>
                          <Table.Th>Canale/Area</Table.Th>
                          <Table.Th>Affidabilità</Table.Th>
                          <Table.Th>Esito</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {anteprimaImport.map(r => (
                          <Table.Tr
                            key={r.riga}
                            className={clsx(
                              r.azione === "scarta" && "bg-danger/5 dark:bg-danger/10",
                              r.azione === "revisiona" && "bg-warning/5 dark:bg-warning/10"
                            )}
                          >
                            <Table.Td>{r.riga}</Table.Td>
                            <Table.Td>{r.letto?.nome || "-"}</Table.Td>
                            <Table.Td>{r.letto?.citta || "-"}</Table.Td>
                            <Table.Td>{r.letto?.indirizzo || "-"}</Table.Td>
                            <Table.Td>{r.letto?.cap || "-"}</Table.Td>
                            <Table.Td>
                              {r.letto?.canaleArea ||
                                [r.letto?.canale, r.letto?.area].filter(Boolean).join(" / ") ||
                                "-"}
                            </Table.Td>
                            <Table.Td>
                              {r.azione === "scarta" ? (
                                "-"
                              ) : (
                                <div>
                                  <StatusBadge tono={classePunteggio(r.punteggio)} etichetta={String(r.punteggio)} />
                                  {r.motivi.length > 0 && (
                                    <div className="text-2xs mt-1 text-slate-500">{r.motivi.join(" · ")}</div>
                                  )}
                                </div>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {r.azione === "scarta" ? (
                                <div>
                                  <StatusBadge tono="danger" etichetta="Scartata" icon="CircleAlert" />
                                  <div className="text-xs mt-1 text-danger">
                                    {r.errore}
                                  </div>
                                </div>
                              ) : r.azione === "revisiona" ? (
                                <StatusBadge tono="warning" etichetta="Da inserire a mano" icon="ClipboardCheck" />
                              ) : (
                                <StatusBadge
                                  tono="success"
                                  etichetta={r.azione === "crea" ? "Nuovo" : "Aggiorna"}
                                  icon="CircleCheck"
                                />
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </div>
                  <div className="mt-4 text-sm">
                    Importabili: {conteggiAnteprima.importabili} · Da inserire a mano: {conteggiAnteprima.daInserireAMano} ·
                    Scartate: {conteggiAnteprima.scartate} (su {anteprimaImport.length} righe)
                  </div>
                </div>
              )}
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            {importJob.inCorso ? (
              <>
                <Button variant="outline-secondary" onClick={chiudiImport}>
                  Nascondi
                </Button>
                <Button
                  variant="danger"
                  onClick={annullaImport}
                  loading={importJob.annullamentoInCorso}
                >
                  Annulla importazione
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline-secondary"
                  onClick={chiudiImport}
                >
                  {statoImport ? "Chiudi" : "Annulla"}
                </Button>
                {!statoImport && (
                  <Button
                    variant="primary"
                    onClick={avviaImport}
                    disabled={!fileImport || righeDaElaborare === 0}
                    loading={importJob.avvioInCorso}
                  >
                    Importa {righeDaElaborare} righe
                  </Button>
                )}
              </>
            )}
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <ImportStoricoVolantini open={isImportStoricoOpen} onClose={() => setIsImportStoricoOpen(false)} />

      <Pagina
        titolo="Gestione punti vendita"
        descrizione={riepilogo}
        azioni={
          <>
            {/* I due import sotto un solo comando: l'azione primaria resta "Nuovo punto vendita" */}
            <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
              <Menu className="inline-block text-left">
                <Menu.Button as={Button} variant="outline-secondary">
                  <Lucide icon="Upload" aria-hidden="true" className="mr-2 h-4 w-4" />
                  Importa
                  <Lucide icon="ChevronDown" aria-hidden="true" className="ml-1.5 h-4 w-4" />
                </Menu.Button>
                <Menu.Items className="w-72">
                  <Menu.Item onClick={() => setIsExcelImportDialogOpen(true)} className="items-start">
                    <Lucide icon="FileSpreadsheet" aria-hidden="true" className="mr-3 mt-0.5 h-4 w-4 flex-none" />
                    <span>
                      <span className="block font-medium">Anagrafica da Excel</span>
                      <span className="block text-xs text-slate-500">
                        {importJob.inCorso
                          ? `Import in corso (${percentualeImport(statoImport ?? { elaborate: 0, totale: 0 })}%)`
                          : "Crea e aggiorna i punti vendita dal file della GDO"}
                      </span>
                    </span>
                  </Menu.Item>
                  <Menu.Item onClick={() => setIsImportStoricoOpen(true)} className="items-start">
                    <Lucide icon="History" aria-hidden="true" className="mr-3 mt-0.5 h-4 w-4 flex-none" />
                    <span>
                      <span className="block font-medium">Storia dai volantini</span>
                      <span className="block text-xs text-slate-500">Export JSON del Plugin, non modifica l&apos;anagrafica</span>
                    </span>
                  </Menu.Item>
                </Menu.Items>
              </Menu>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
              <Button variant="primary" onClick={() => openNewPuntoVenditaDialog()}>
                <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
                Nuovo punto vendita
              </Button>
            </PermissionGate>
          </>
        }
      >
        {statoImport && importJob.inCorso && (
          <AvanzamentoImport
            stato={statoImport}
            annullamento={importJob.annullamentoInCorso}
            onDettagli={() => setIsExcelImportDialogOpen(true)}
            onApriRiga={rigaInAttesa && rigaRidotta === rigaInAttesa.riga ? () => setRigaRidotta(null) : undefined}
          />
        )}

        <QualitaDati
          query={qualitaQuery}
          filtroAttivo={filtroQualita}
          onFiltro={scelto => setFiltroQualita(attuale => (attuale === scelto ? null : scelto))}
          filtriDisponibili={{ senzaCodice: gdoConCodici, senzaStoria: storiaNota }}
          onRigheDaRevisionare={statoImport ? () => setIsExcelImportDialogOpen(true) : undefined}
        />

        <Sezione
          senzaPadding
          titolo="Punti vendita"
          descrizione="Il nome apre la gestione del punto vendita: anagrafica, dispositivi e display context."
        >
          <FiltriPuntiVendita
            elenco={elenco}
            aggiornamento={puntiVenditaQuery.isFetching && !puntiVenditaQuery.isLoading}
            destra={<Segmenti etichetta="Vista" opzioni={OPZIONI_VISTA} valore={vista} onChange={setVista} />}
          />
          {!puntiVenditaQuery.isLoading && errore === null && (
            <div className="flex flex-wrap items-center gap-2 border-b border-dashed border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-darkmode-400">
              <span>
                <strong className="tabular-nums text-slate-700 dark:text-slate-200">{formatNumero(elenco.filtrati.length)}</strong>{" "}
                {elenco.filtrati.length === 1 ? "punto vendita" : "punti vendita"}
              </span>
              {filtroQualita && (
                <button
                  type="button"
                  onClick={azzeraFiltroQualita}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
                >
                  Solo: {ETICHETTA_FILTRO_QUALITA[filtroQualita]}
                  <Lucide icon="X" aria-hidden="true" className="h-3 w-3" />
                  <span className="sr-only">(togli il filtro)</span>
                </button>
              )}
            </div>
          )}
          {vista === "tabella" ? (
            <TabellaPuntiVendita
              elenco={elenco}
              caricamento={puntiVenditaQuery.isLoading}
              errore={errore}
              onRiprova={() => puntiVenditaQuery.refetch()}
              percorso={percorsoGestione}
              statoDati={pv => <StatoDati problemi={problemiDati(pv, contestoDati)} />}
              azioni={azioniRiga}
              vuoto={{
                titolo: "Nessun punto vendita disponibile",
                descrizione: "Usa Nuovo punto vendita o Importa per aggiungerne.",
              }}
            />
          ) : (
            <div className="p-5">
              <MappaPuntiVendita
                tutti={tuttiPuntiVendita}
                elenco={elenco}
                caricamento={puntiVenditaQuery.isLoading}
                errore={errore}
                onRiprova={() => puntiVenditaQuery.refetch()}
                onDettagli={pv => navigate(percorsoGestione(pv))}
                etichettaDettagli="Apri gestione"
                descrizioneSenzaPosizione="Inserisci latitudine e longitudine per vederli sulla mappa."
              />
            </div>
          )}
        </Sezione>

        <RigheNonAbbinate coloreDelCanale={elenco.coloreDelCanale} onAggiungi={aggiungiDaRiga} />
      </Pagina>
    </>
  );
}

export default withSessionCheck(Main);
