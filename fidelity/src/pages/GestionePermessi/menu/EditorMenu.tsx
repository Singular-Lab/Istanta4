import Alert from '@/components/Base/Alert';
import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import { FormSelect } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import PageError from '@/components/Base/PageError';
import Segmenti, { type OpzioneSegmento } from '@/components/Base/Segmenti';
import Sezione from '@/components/Base/Sezione';
import Spinner from '@/components/Base/Spinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { twMerge } from '@/utils/twMerge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { applicaRegoleArea } from '../../../../lib/accessi/catalogo';
import { titoloSezione } from '../../../../lib/accessi/sezioni';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { ServerCall } from '../../../../lib/server_call';
import { useConfigurazione } from '../api';
import AnteprimaMenu, { type StatoPermessi } from './AnteprimaMenu';
import CatalogoPagine from './CatalogoPagine';
import {
  aggiornaVoce,
  aggiungiGruppo,
  anteprimaMenu,
  aperturaConsentita,
  areeDellePagine,
  firmaMenu,
  impostaPaginaIniziale,
  inserisciPagina,
  leggiMenu,
  MODELLO_VUOTO,
  rinominaGruppo,
  serializzaMenu,
  spostaConTastiera,
  spostaTitolo,
  spostaTitoloConTastiera,
  spostaVoce,
  titoliEreditati,
  togliGruppo,
  togliVoce,
  trovaVoce,
  TRASCINA_TITOLO,
  TRASCINA_VOCE,
  trovaGruppo,
  vicinaDi,
  vociDelModello,
  type MenuItemDTO,
  type ModelloMenu,
  type VoceScartata,
} from './modelloMenu';
import StrutturaMenu, { type AzioniStruttura } from './StrutturaMenu';

/** Argomenti di un rilascio nella struttura: tipo trascinato, oggetto, destinazione. */
type Rilascio = Parameters<AzioniStruttura['onRilascia']>;

interface RuoloGdoOption {
  id: string;
  ruolo: string;
}

const TIPI_UTENTE_MENU = [
  TIPO_UTENTI.SUPERADMIN,
  TIPO_UTENTI.AGENZIA,
  TIPO_UTENTI.CATEGORY,
  TIPO_UTENTI.GDO,
  TIPO_UTENTI.MARKETING,
  TIPO_UTENTI.PUNTOVENDITA,
  TIPO_UTENTI.IT,
  TIPO_UTENTI.GUEST,
];

const TIPO_LABELS: Record<string, string> = {
  [TIPO_UTENTI.SUPERADMIN]: 'Superadmin',
  [TIPO_UTENTI.AGENZIA]: 'Agenzia',
  [TIPO_UTENTI.CATEGORY]: 'Category',
  [TIPO_UTENTI.GDO]: 'GDO',
  [TIPO_UTENTI.MARKETING]: 'Marketing',
  [TIPO_UTENTI.PUNTOVENDITA]: 'Punto Vendita',
  [TIPO_UTENTI.IT]: 'Reparto IT',
  [TIPO_UTENTI.GUEST]: 'Guest',
};

const OPZIONI_TIPO: OpzioneSegmento<TIPO_UTENTI>[] = TIPI_UTENTE_MENU.map((tipo) => ({ valore: tipo, etichetta: TIPO_LABELS[tipo] }));

const nomeSottoRuolo = (ruolo: string) => ruolo.replace(/_/g, ' ');

type MenuScelto = { tipo: TIPO_UTENTI; ruoloGdo: string };

/**
 * Editor del menu di un tipo di utente (e di un suo sotto-ruolo), a tre colonne: le pagine del
 * catalogo, la struttura per area con gruppi e voci, l'anteprima del menu come lo vedrà il ruolo.
 * Le modifiche restano locali fino a "Salva", che sostituisce il menu sul server.
 */
export default function EditorMenu() {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [scelto, setScelto] = useState<MenuScelto>({ tipo: TIPO_UTENTI.SUPERADMIN, ruoloGdo: '' });
  const { tipo, ruoloGdo } = scelto;
  const superadmin = tipo === TIPO_UTENTI.SUPERADMIN;

  const [modello, setModello] = useState<ModelloMenu>(MODELLO_VUOTO);
  const [salvato, setSalvato] = useState<ModelloMenu>(MODELLO_VUOTO);
  const [scartate, setScartate] = useState<VoceScartata[]>([]);
  const [modifiche, setModifiche] = useState(0);
  const ultimaModifica = useRef<string | null>(null);
  const [richiestaCambio, setRichiestaCambio] = useState<MenuScelto | null>(null);
  const [mostraRipristino, setMostraRipristino] = useState(false);
  const [mostraIncolla, setMostraIncolla] = useState(false);
  const [appunti, setAppunti] = useState<{ modello: ModelloMenu; etichetta: string; voci: number } | null>(null);
  const [paginaAnteprima, setPaginaAnteprima] = useState<string | null>(null);
  const griglia = useRef<HTMLDivElement>(null);
  const daFocalizzare = useRef<string | null>(null);

  const { data: ruoliGdo } = useQuery<RuoloGdoOption[]>({
    queryKey: ['ruoli-gdo-permessi'],
    queryFn: () => ServerCall.get<RuoloGdoOption[]>('/get_all_ruoli_gdo'),
    enabled: !superadmin,
  });

  const parametroRuolo = ruoloGdo ? `?ruoloGdo=${ruoloGdo}` : '';
  const menu = useQuery<MenuItemDTO[]>({
    queryKey: ['menu-items', tipo, ruoloGdo || 'base'],
    queryFn: () => ServerCall.get<MenuItemDTO[]>(`/menu/${tipo}${parametroRuolo}`),
    // Un nuovo caricamento al ritorno sulla finestra cancellerebbe le modifiche non salvate
    refetchOnWindowFocus: false,
  });

  // Permessi del ruolo per l'anteprima e per gli avvisi: il Superadmin li ha tutti
  const configurazione = useConfigurazione({ tipo, idRuoloGdo: ruoloGdo || null, idGdo: null }, !superadmin);
  const permessi = useMemo(() => {
    const elenco = configurazione.data?.permessi;
    if (superadmin || !Array.isArray(elenco)) return null;
    // Un'azione vale solo con il permesso di consultazione della sua area
    return new Set<string>(applicaRegoleArea(elenco.filter((p) => p.efficace).map((p) => p.codice)));
  }, [superadmin, configurazione.data]);
  const statoPermessi: StatoPermessi = superadmin
    ? 'superadmin'
    : permessi
      ? 'pronti'
      : configurazione.isError || configurazione.data
        ? 'errore'
        : 'caricamento';
  const puoAprire = useMemo(() => aperturaConsentita(permessi, superadmin), [permessi, superadmin]);

  // Il menu letto dal server diventa il modello salvato
  useEffect(() => {
    if (!Array.isArray(menu.data)) return;
    const lettura = leggiMenu(menu.data);
    setModello(lettura.modello);
    setSalvato(lettura.modello);
    setScartate(lettura.scartate);
    setModifiche(0);
    ultimaModifica.current = null;
  }, [menu.data]);

  // Dopo uno spostamento da tastiera o un nuovo gruppo il focus va sull'elemento giusto
  useEffect(() => {
    const selettore = daFocalizzare.current;
    if (!selettore) return;
    daFocalizzare.current = null;
    griglia.current?.querySelector<HTMLElement>(selettore)?.focus();
  }, [modello]);

  const firmaSalvata = useMemo(() => firmaMenu(salvato), [salvato]);
  const firmaAttuale = useMemo(() => firmaMenu(modello), [modello]);
  const sporco = firmaAttuale !== firmaSalvata;
  const daSalvare = sporco || scartate.length > 0;
  const modificheVisibili = sporco ? Math.max(modifiche, 1) : 0;

  const areeUsate = useMemo(() => areeDellePagine(modello), [modello]);
  const ereditati = useMemo(() => titoliEreditati(modello), [modello]);
  const anteprima = useMemo(() => anteprimaMenu(modello, puoAprire), [modello, puoAprire]);

  const nomeRuolo = ruoloGdo
    ? `${TIPO_LABELS[tipo]} / ${nomeSottoRuolo(ruoliGdo?.find((r) => r.id === ruoloGdo)?.ruolo ?? '')}`
    : TIPO_LABELS[tipo];

  /**
   * Applica un modello modificato. Le modifiche consecutive allo stesso campo (`chiave`, per esempio
   * il titolo di una voce mentre si scrive) contano una volta; tornando al menu salvato il conto si azzera.
   */
  const applica = (nuovo: ModelloMenu, chiave?: string) => {
    const firma = firmaMenu(nuovo);
    setModello(nuovo);
    if (firma === firmaAttuale) return;
    if (firma === firmaSalvata) {
      setModifiche(0);
      ultimaModifica.current = null;
      return;
    }
    if (!chiave || chiave !== ultimaModifica.current) setModifiche((n) => n + 1);
    ultimaModifica.current = chiave ?? null;
  };

  const avvisa = (testo: string, variant: 'info' | 'warning' = 'info') => showNotification(testo, { variant });

  const giaNellArea = (sezione: Parameters<typeof titoloSezione>[0]) =>
    avvisa(`Questa pagina è già in ${titoloSezione(sezione)}: ogni area la può avere una volta sola`, 'warning');

  /** Mette una pagina nel menu, partendo da `base` (il modello, o il modello con un gruppo nuovo). */
  const aggiungiPagina = (percorso: string, destinazione?: { gruppoId: string; indice: number }, base: ModelloMenu = modello) => {
    const esito = inserisciPagina(base, percorso, destinazione);
    if (esito.esito === 'gia-presente') {
      giaNellArea(esito.sezione);
      return;
    }
    if (esito.esito !== 'aggiunta') return;
    applica(esito.modello);
    // L'anteprima passa alla pagina aggiunta, se il ruolo può aprirla
    const aggiunta = trovaVoce(esito.modello, esito.voceId);
    if (aggiunta && puoAprire(aggiunta.gruppo.voci[aggiunta.indice].pathname)) {
      setPaginaAnteprima(aggiunta.gruppo.voci[aggiunta.indice].pathname);
    }
  };

  /** Lascia una pagina, una voce o il titolo di un gruppo nel punto indicato, in qualunque area. */
  const rilascia = (
    tipoTrascinato: Rilascio[0],
    oggetto: Rilascio[1],
    destinazione: Rilascio[2],
    base: ModelloMenu = modello
  ) => {
    if (tipoTrascinato === TRASCINA_TITOLO && 'gruppoId' in oggetto) {
      const esito = spostaTitolo(base, oggetto.gruppoId, destinazione);
      if (esito.esito === 'spostato') applica(esito.modello);
      return;
    }
    if ('gruppoId' in oggetto) return;
    if (tipoTrascinato !== TRASCINA_VOCE || !('voceId' in oggetto)) {
      aggiungiPagina(oggetto.percorso, destinazione, base);
      return;
    }
    const esito = spostaVoce(base, oggetto.voceId, destinazione);
    if (esito.esito === 'gia-presente') {
      giaNellArea(esito.sezione);
      return;
    }
    if (esito.esito === 'spostata') applica(esito.modello);
  };

  const azioni: AzioniStruttura = {
    onRilascia: (tipoTrascinato, oggetto, destinazione) => rilascia(tipoTrascinato, oggetto, destinazione),
    // In un'area senza gruppi si crea un gruppo senza titolo: resta solo se il rilascio riesce
    onRilasciaInArea: (tipoTrascinato, oggetto, sezione) => {
      const conGruppo = aggiungiGruppo(modello, sezione);
      rilascia(tipoTrascinato, oggetto, { gruppoId: conGruppo.gruppoId, indice: 0 }, conGruppo.modello);
    },
    onTastiera: (voceId, direzione) => {
      const esito = spostaConTastiera(modello, voceId, direzione);
      const area = trovaVoce(modello, voceId)?.area;
      if (esito.esito === 'spostata') {
        daFocalizzare.current = `[data-presa="${voceId}"]`;
        applica(esito.modello);
      } else if (esito.esito === 'gia-presente') {
        giaNellArea(esito.sezione);
      } else if (area && esito.esito !== 'invariata') {
        avvisa(`È già ${esito.esito === 'prima' ? 'la prima' : "l'ultima"} voce del menu`);
      }
    },
    onTastieraTitolo: (gruppoId, direzione) => {
      const esito = spostaTitoloConTastiera(modello, gruppoId, direzione);
      const area = trovaGruppo(modello, gruppoId)?.area;
      if (esito.esito === 'spostato') {
        daFocalizzare.current = `[data-presa-titolo="${gruppoId}"]`;
        applica(esito.modello);
      } else if (area && esito.esito !== 'invariato') {
        avvisa(`Il titolo è già ${esito.esito === 'prima' ? 'in cima' : 'in fondo'} a ${titoloSezione(area.sezione)}`);
      }
    },
    onTogli: (voceId, daTastiera) => {
      const vicina = daTastiera ? vicinaDi(modello, voceId) : undefined;
      if (vicina) daFocalizzare.current = `[data-presa="${vicina}"]`;
      applica(togliVoce(modello, voceId));
    },
    onTitoloVoce: (voceId, titolo) => applica(aggiornaVoce(modello, voceId, { titolo }), `titolo:${voceId}`),
    onAttiva: (voceId) => {
      const voce = trovaVoce(modello, voceId);
      if (voce) applica(aggiornaVoce(modello, voceId, { disabilitato: !voce.gruppo.voci[voce.indice].disabilitato }));
    },
    onIniziale: (voceId) => applica(impostaPaginaIniziale(modello, voceId)),
    onAggiungiGruppo: (sezione) => {
      const esito = aggiungiGruppo(modello, sezione);
      daFocalizzare.current = `[data-titolo-gruppo="${esito.gruppoId}"]`;
      applica(esito.modello);
    },
    onTitoloGruppo: (gruppoId, titolo) => applica(rinominaGruppo(modello, gruppoId, titolo), `gruppo:${gruppoId}`),
    onTogliGruppo: (gruppoId) => applica(togliGruppo(modello, gruppoId)),
  };

  // Cambiare menu con modifiche non salvate chiede conferma; annullando si resta dove si è
  const apriMenu = (nuovo: MenuScelto) => {
    setScelto(nuovo);
    setPaginaAnteprima(null);
    setModello(MODELLO_VUOTO);
    setSalvato(MODELLO_VUOTO);
    setScartate([]);
    setModifiche(0);
    ultimaModifica.current = null;
  };
  const chiediMenu = (nuovo: MenuScelto) => {
    if (nuovo.tipo === tipo && nuovo.ruoloGdo === ruoloGdo) return;
    if (sporco) setRichiestaCambio(nuovo);
    else apriMenu(nuovo);
  };

  const annulla = () => {
    setModello(salvato);
    setModifiche(0);
    ultimaModifica.current = null;
  };

  const salva = useMutation({
    mutationFn: (dati: { url: string; items: MenuItemDTO[]; modello: ModelloMenu }) =>
      ServerCall.put(dati.url, { items: dati.items }),
    onSuccess: (_risposta, dati) => {
      setSalvato(dati.modello);
      setScartate([]);
      setModifiche(0);
      ultimaModifica.current = null;
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showNotification('Menu salvato', { variant: 'success' });
    },
    onError: (errore) => {
      const motivo = errore instanceof Error && errore.message ? `: ${errore.message}` : '';
      showNotification(`Errore durante il salvataggio del menu${motivo}`, { variant: 'error' });
    },
  });

  // Ripristino del menu predefinito del Superadmin (solo le sue voci; gli altri menu restano)
  const ripristina = useMutation({
    mutationFn: () => ServerCall.post('/menu/ripristina-predefiniti', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showNotification('Menu predefinito del Superadmin ripristinato', { variant: 'success' });
    },
    onError: () => {
      showNotification('Errore durante il ripristino del menu: il menu è rimasto invariato', { variant: 'error' });
    },
  });

  const copia = () => {
    setAppunti({ modello, etichetta: nomeRuolo, voci: vociDelModello(modello).length });
    showNotification(`Menu copiato: ${nomeRuolo}`, { variant: 'success' });
  };

  const incolla = () => {
    if (appunti) applica(appunti.modello);
    setMostraIncolla(false);
  };

  const testoStato = sporco
    ? `${modificheVisibili} ${modificheVisibili === 1 ? 'modifica non salvata' : 'modifiche non salvate'}`
    : scartate.length > 0
      ? 'Da salvare per togliere le voci senza pagina'
      : 'Tutto salvato';

  return (
    <div className="flex flex-col gap-4">
      {/* Barra: quale menu, stato e azioni */}
      <Sezione compatta as="div">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="title-eyebrow">Menu di</span>
            <Segmenti
              etichetta="Tipo di utente"
              opzioni={OPZIONI_TIPO}
              valore={tipo}
              onChange={(nuovoTipo) => chiediMenu({ tipo: nuovoTipo, ruoloGdo: '' })}
            />
            {!superadmin && ruoliGdo && ruoliGdo.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="menu-ruolo-gdo" className="title-eyebrow">
                  Sotto-ruolo
                </label>
                <FormSelect
                  id="menu-ruolo-gdo"
                  value={ruoloGdo}
                  onChange={(e) => chiediMenu({ tipo, ruoloGdo: e.target.value })}
                  className="w-56"
                >
                  <option value="">Base (tutti)</option>
                  {ruoliGdo.map((r) => (
                    <option key={r.id} value={r.id}>
                      {nomeSottoRuolo(r.ruolo)}
                    </option>
                  ))}
                </FormSelect>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 2xl:ml-auto 2xl:flex-none 2xl:justify-end">
            <span
              aria-live="polite"
              className={twMerge(
                'mr-1 inline-flex items-center gap-1.5 text-xs',
                daSalvare ? 'text-amber-800 dark:text-amber-300' : 'text-slate-500'
              )}
            >
              {daSalvare && <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-amber-500" />}
              {testoStato}
            </span>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={copia}
              disabled={modello.aree.length === 0}
              title="Copia questo menu per incollarlo in un altro"
            >
              <Lucide icon="Copy" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Copia menu
            </Button>
            {appunti && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setMostraIncolla(true)}
                title={`Incolla il menu copiato da ${appunti.etichetta}`}
              >
                <Lucide icon="ClipboardPaste" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Copia da: {appunti.etichetta}
                <Badge variant="primary" size="sm" className="ml-1.5 tabular-nums">
                  {appunti.voci}
                </Badge>
              </Button>
            )}
            {superadmin && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setMostraRipristino(true)}
                disabled={ripristina.isPending}
                loading={ripristina.isPending}
              >
                {!ripristina.isPending && <Lucide icon="RotateCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                Ripristina menu predefinito
              </Button>
            )}
            <Button variant="outline-secondary" size="sm" onClick={annulla} disabled={!sporco || salva.isPending}>
              Annulla
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                salva.mutate({ url: `/menu/${tipo}${parametroRuolo}`, items: serializzaMenu(modello, tipo), modello })
              }
              disabled={!daSalvare || salva.isPending || !menu.data}
              loading={salva.isPending}
            >
              {!salva.isPending && <Lucide icon="Check" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
              Salva
            </Button>
          </div>
        </div>

        {ruoloGdo && (
          <Alert variant="soft-info" icona="Info" className="mt-3">
            Stai modificando il menu specifico del sotto-ruolo: chi non ha un menu proprio usa quello base del tipo.
          </Alert>
        )}
      </Sezione>

      {menu.isLoading ? (
        <Sezione>
          <div className="flex justify-center py-12">
            <Spinner size="lg" etichetta="Caricamento menu..." />
          </div>
        </Sezione>
      ) : menu.isError ? (
        <Sezione>
          <PageError
            compatta
            titolo="Menu non caricato"
            motivo={menu.error instanceof Error && menu.error.message ? menu.error.message : 'Impossibile caricare il menu'}
            onRiprova={() => menu.refetch()}
          />
        </Sezione>
      ) : (
        <DndProvider backend={HTML5Backend}>
          <div ref={griglia} className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
            <CatalogoPagine areeUsate={areeUsate} puoAprire={puoAprire} onAggiungi={(percorso) => aggiungiPagina(percorso)} />
            <StrutturaMenu modello={modello} scartate={scartate} ereditati={ereditati} puoAprire={puoAprire} azioni={azioni} />
            <AnteprimaMenu
              anteprima={anteprima}
              nomeRuolo={nomeRuolo}
              statoPermessi={statoPermessi}
              selezionata={paginaAnteprima}
              onSeleziona={setPaginaAnteprima}
            />
          </div>
        </DndProvider>
      )}

      {/* Cambio di menu con modifiche non salvate */}
      <ConfirmDialog
        open={richiestaCambio !== null}
        title="Modifiche non salvate"
        subtitle={`Menu di ${nomeRuolo}`}
        confirmLabel="Scarta e cambia menu"
        description={
          <p>
            Il menu di <strong>{nomeRuolo}</strong> ha {modificheVisibili}{' '}
            {modificheVisibili === 1 ? 'modifica non salvata' : 'modifiche non salvate'}. Cambiando menu andranno perse.
          </p>
        }
        onClose={() => setRichiestaCambio(null)}
        onConfirm={() => {
          if (richiestaCambio) apriMenu(richiestaCambio);
          setRichiestaCambio(null);
        }}
      />

      {/* Conferma ripristino del menu predefinito */}
      <ConfirmDialog
        open={mostraRipristino}
        title="Ripristina menu predefinito"
        confirmLabel="Ripristina"
        confirmVariant="primary"
        description={
          <div className="space-y-4">
            <Alert variant="soft-warning" icona="TriangleAlert" titolo="Attenzione">
              Il menu del Superadmin tornerà quello con cui nasce l&apos;installazione.
            </Alert>
            <ul className="list-inside list-disc space-y-1">
              <li>Le voci aggiunte, tolte o spostate nel menu del Superadmin andranno perse</li>
              <li>I menu degli altri tipi di utente non cambiano</li>
              <li>Se il ripristino non riesce, il menu resta quello attuale</li>
            </ul>
          </div>
        }
        onClose={() => setMostraRipristino(false)}
        onConfirm={() => {
          setMostraRipristino(false);
          ripristina.mutate();
        }}
      />

      {/* Conferma della copia da un altro menu */}
      <ConfirmDialog
        open={mostraIncolla}
        title={`Copia da ${appunti?.etichetta ?? ''}`}
        subtitle="Sostituisce il menu corrente"
        confirmLabel="Sostituisci menu"
        confirmVariant="primary"
        description={
          <div className="space-y-4">
            <Alert variant="soft-info" icona="ClipboardPaste" titolo="Conferma la copia">
              Stai per sostituire il menu di <strong>{nomeRuolo}</strong> con le <strong>{appunti?.voci ?? 0} voci</strong>{' '}
              copiate da <strong>{appunti?.etichetta}</strong>.
            </Alert>
            <p>Il menu attuale verrà sovrascritto. Le modifiche saranno visibili al salvataggio.</p>
          </div>
        }
        onClose={() => setMostraIncolla(false)}
        onConfirm={incolla}
      />
    </div>
  );
}
