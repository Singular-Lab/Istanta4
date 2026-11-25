import CleanCSS from 'clean-css';
import type { Request } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type {
  BolloDichiarato,
  ConfigurazioneInsightGdo,
  EsitoProvaMenabo,
  EsitoVerificaConfigurazione,
  ImpostazioniGdo,
  LineaDichiarata,
  SuggerimentiCampiMenabo,
  SuggerimentiValoriMenabo,
  VolantinoProvaMenabo,
} from '../../../lib/impostazioniGdo/tipi';
import { verificaConfigurazioneInsight } from '../../../lib/insightVolantino/configurazione';
import { BadRequestError, ExternalApiError, NotFoundError } from '../../../lib/errors';
import type { ConfigWebpliant } from '../../../lib/types';
import type { IAgenziaLib } from '../agenzia_lib/types';
import { inviaFormDataAOlimpo } from '../http/olimpo';
import type { ICatalogoLoghiService, LogoDelCatalogo } from '../interfaces/ICatalogoLoghiService';
import type { IConfigService } from '../interfaces/IConfigService';
import type { IImpostazioniGdoService } from '../interfaces/IImpostazioniGdoService';
import { log } from '../logger';
import type { IConfigWebpliantGdoRepository } from '../repositories/ConfigWebpliantGdoRepository';
import type { IImpostazioniGdoRepository, ImpostazioniGdoSalvate } from '../repositories/ImpostazioniGdoRepository';
import { type LetturaReparti, nomeRepartoDellaReferenza, opzioniDellAgenzia } from '../utils/insightAgenzia';
import { menaboDi } from '../utils/insightVolantino';
import { boxDelKit } from '../utils/analisiKit';
import { leggiReferenza, type RigaReferenza } from '../utils/referenzaStampata';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import { kitNellAmbito, righeDelKit } from '../repositories/InsightVolantinoRepository';
import { urlImmagineLogo } from '../utils/lineeDistributore';
import { COLORE_ESADECIMALE, dizionarioNormalizzato, repartiDellaGdo, verificaRepartiDaSalvare } from '../utils/repartiGdo';
import { verificaRegoleMenabo } from '../utils/regoleMenabo';
import { isUrlOlimpo, urlFotoOlimpo, urlOlimpo } from '../utils/urlOlimpo';
import { dimenticaConfigInsight } from './cacheConfigInsight';
import { contestoDallaConfig, contestoDellaGdo, repartoConfigurato } from './InsightConfrontiService';

/**
 * Impostazioni GDO (spec impostazioni-gdo, contratto in lib/impostazioniGdo/tipi.ts): identita',
 * reparti per il marketing, linee del distributore, campi delle referenze, sito web e configurazione
 * degli insight del volantino di una GDO.
 *
 * - Identita', campi delle referenze e sito web stanno nella riga config che WebPliant legge per la
 *   GDO (ConfigWebpliantGdoRepository): ogni salvataggio cambia solo le sue chiavi, mai la riga intera.
 * - Reparti e configurazione degli insight stanno in impostazioni_gdo. La configurazione degli insight
 *   salvata vale per la GDO al posto del file dell'installazione; la cache di ConfigService si
 *   dimentica a ogni salvataggio.
 * - I reparti uniscono l'anagrafica della configurazione degli insight in uso, le voci salvate e i
 *   reparti trovati nelle referenze dei volantini della GDO (letti in SQL con i percorsi della config).
 * - Le linee del distributore sono quelle della libreria agenzia, in sola lettura, con i loghi del
 *   catalogo di Istanta.
 */

/** Carica un'immagine su Olimpo e ne restituisce il guidId: qui per poterlo sostituire nei test. */
export type CaricatoreOlimpo = (file: Blob, nomeFile: string, chiaveOlimpo: string | undefined) => Promise<string>;

/** Come saveWebpliantConfig: /foto/updateFotoPathWeb con la chiave privata dell'utente; un esito negativo interrompe. */
export const CARICATORE_OLIMPO: CaricatoreOlimpo = async (file, nomeFile, chiaveOlimpo) => {
  const formData = new FormData();
  formData.append('file', file, nomeFile);
  formData.append('id', '');
  const risultato = await inviaFormDataAOlimpo<{ esito: boolean; guidId: string; error: string }>('/foto/updateFotoPathWeb', formData, chiaveOlimpo);
  if (!risultato.data?.esito) {
    // Il testo grezzo di Olympus resta nella cause (log), non nel messaggio al client
    throw new ExternalApiError({
      message: "Olympus non ha caricato l'immagine del sito web della GDO",
      service: 'OLYMPUS',
      endpoint: '/foto/updateFotoPathWeb',
      cause: new Error(risultato.data?.error || 'esito false'),
    });
  }
  return risultato.data.guidId;
};

let dizionarioInMemoria: Promise<unknown> | null = null;

/** config/dictionary_translation.json, come lo legge GPTController; letto una volta, {} se manca. */
export const DIZIONARIO_TRADUZIONI = (): Promise<unknown> => {
  dizionarioInMemoria ??= readFile(path.join(path.resolve(), 'config/dictionary_translation.json'), 'utf8')
    .then(testo => JSON.parse(testo) as unknown)
    .catch((errore: unknown) => {
      log.warn('Dizionario delle traduzioni non disponibile: reparti senza suggerimenti', {
        errore: errore instanceof Error ? errore.message : String(errore),
      });
      return {};
    });
  return dizionarioInMemoria;
};

/** Nome e cognome dell'utente (o l'email), per dire chi ha salvato la configurazione degli insight. */
export const NOME_UTENTE = async (idUtente: string): Promise<string | null> => {
  const { Utente } = await import('../models/utenti');
  const utente = await Utente.findByPk(idUtente, { attributes: ['nome_utenti', 'cognome_utenti', 'email_utenti'], raw: true }) as
    { nome_utenti?: string | null; cognome_utenti?: string | null; email_utenti?: string | null } | null;
  if (!utente) return null;
  const nome = `${utente.nome_utenti ?? ''} ${utente.cognome_utenti ?? ''}`.trim();
  return nome || utente.email_utenti?.trim() || null;
};

export interface OpzioniImpostazioniGdo {
  dizionario?: () => Promise<unknown>;
  caricaSuOlimpo?: CaricatoreOlimpo;
  dimenticaConfigInsight?: (idGdo: string | null) => Promise<void>;
  nomeUtente?: (idUtente: string) => Promise<string | null>;
  /** Le letture di un kit per provare le regole del menabò; senza, quelle degli insight. */
  lettureKit?: LettureProvaMenabo;
}

/** Quello che serve di un kit per provare le regole del menabò. */
export interface LettureProvaMenabo {
  kitNellAmbito(idKit: string, ambito: AmbitoGdo): Promise<{ id: string; storico: boolean; gdo: string | null } | null>;
  righeDelKit(idKit: string): Promise<RigaReferenza[]>;
}

/** I volantini proposti per la prova e le pagine confrontate: abbastanza per scegliere, senza leggere tutto lo storico. */
const VOLANTINI_PER_PROVA = 40;

/** Quanti campi e quanti valori si suggeriscono al massimo. */
const CAMPI_SUGGERITI = 120;
const VALORI_SUGGERITI = 300;
const LUNGHEZZA_MASSIMA_CAMPO = 100;

const BASE64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;

const oggetto = (valore: unknown): Record<string, unknown> | null =>
  valore !== null && typeof valore === 'object' && !Array.isArray(valore) ? valore as Record<string, unknown> : null;

const testo = (valore: unknown): string => (typeof valore === 'string' ? valore : '');

const messaggio = (errore: unknown): string => (errore instanceof Error ? errore.message : String(errore));

/** Le chiavi della sezione sito web: le sole che PUT sito-web puo' cambiare in webpliant. */
const CHIAVI_SITO_WEB = ['css_text', 'icona_pagina', 'logo_header', 'stili', 'stili_minimal', 'meta_volantino'] as const;

/** L'icona salvata (GUID di Olimpo) come la mostra get_config: l'URL del proxy; il base64 resta com'e'. */
function iconaDaMostrare(icona: unknown): string {
  const valore = testo(icona);
  if (valore === '' || BASE64.test(valore)) return valore;
  return urlFotoOlimpo(valore);
}

function sitoWebDa(webpliant: Record<string, unknown>): ImpostazioniGdo['sitoWeb'] {
  const sito: ImpostazioniGdo['sitoWeb'] = {
    css_text: testo(webpliant.css_text),
    icona_pagina: iconaDaMostrare(webpliant.icona_pagina),
    logo_header: Array.isArray(webpliant.logo_header) ? webpliant.logo_header as ConfigWebpliant['logo_header'] : [],
    stili: Array.isArray(webpliant.stili) ? webpliant.stili as ConfigWebpliant['stili'] : [],
  };
  if (Array.isArray(webpliant.stili_minimal)) sito.stili_minimal = webpliant.stili_minimal as ConfigWebpliant['stili_minimal'];
  const meta = oggetto(webpliant.meta_volantino);
  if (meta) sito.meta_volantino = meta as ConfigWebpliant['meta_volantino'];
  return sito;
}

/** I data_fields_refs da salvare, come li normalizzava saveConfigWebPliantFromVolantino (input e output come testo). */
export function campiReferenzeDaSalvare(dati: unknown): ConfigWebpliant['data_fields_refs'] {
  const campi = oggetto(dati)?.campiReferenze;
  if (!Array.isArray(campi)) throw new BadRequestError({ message: 'campiReferenze deve essere un elenco' });
  return campi.map((voce: unknown, indice) => {
    const campo = oggetto(voce);
    if (!campo || campo.expected_input === undefined || campo.expected_input === null
      || campo.expected_output === undefined || campo.expected_output === null) {
      throw new BadRequestError({ message: `campiReferenze.${indice}: servono expected_input ed expected_output` });
    }
    if (campo.core !== undefined && typeof campo.core !== 'boolean') {
      throw new BadRequestError({ message: `campiReferenze.${indice}.core: deve essere vero o falso` });
    }
    return {
      ...campo,
      expected_input: String(campo.expected_input),
      expected_output: String(campo.expected_output),
    } as ConfigWebpliant['data_fields_refs'][number];
  });
}

export class ImpostazioniGdoService implements IImpostazioniGdoService {
  private readonly dizionario: () => Promise<unknown>;
  private readonly caricaSuOlimpo: CaricatoreOlimpo;
  private readonly dimentica: (idGdo: string | null) => Promise<void>;
  private readonly nomeUtente: (idUtente: string) => Promise<string | null>;
  private readonly lettureKit: LettureProvaMenabo;

  constructor(
    private readonly repository: IImpostazioniGdoRepository,
    private readonly righeConfig: IConfigWebpliantGdoRepository,
    private readonly configInsight: Pick<IConfigService, 'getFlyerInsightsConfig'>,
    private readonly agenziaLib: Pick<IAgenziaLib, 'insightVolantino'>,
    private readonly catalogoLoghi: Pick<ICatalogoLoghiService, 'catalogo'>,
    opzioni: OpzioniImpostazioniGdo = {},
  ) {
    this.dizionario = opzioni.dizionario ?? DIZIONARIO_TRADUZIONI;
    this.caricaSuOlimpo = opzioni.caricaSuOlimpo ?? CARICATORE_OLIMPO;
    this.dimentica = opzioni.dimenticaConfigInsight ?? dimenticaConfigInsight;
    this.nomeUtente = opzioni.nomeUtente ?? NOME_UTENTE;
    this.lettureKit = opzioni.lettureKit ?? { kitNellAmbito, righeDelKit };
  }

  // ─── Lettura ───────────────────────────────────────────────────────

  async leggi(idGdo: string, richiesta?: Request): Promise<ImpostazioniGdo> {
    const gdo = await this.repository.gdo(idGdo);
    if (!gdo) throw new NotFoundError({ message: 'GDO non trovata', entityType: 'GDO', entityId: idGdo });

    const [salvate, riga, configurazioneFile] = await Promise.all([
      this.repository.trova(idGdo),
      this.righeConfig.leggi(idGdo),
      this.configurazioneDelFile(),
    ]);
    const insightVolantino = configurazioneInsight(salvate, configurazioneFile);
    const webpliant = riga?.webpliant ?? {};

    const [reparti, lineeDistributore] = await Promise.all([
      this.reparti(idGdo, salvate, insightVolantino.configurazione),
      this.lineeDichiarate(richiesta),
    ]);

    return {
      gdo,
      identita: { colore: riga?.colore || null },
      reparti,
      lineeDistributore,
      campiReferenze: Array.isArray(webpliant.data_fields_refs) ? webpliant.data_fields_refs as ConfigWebpliant['data_fields_refs'] : [],
      sitoWeb: sitoWebDa(webpliant),
      insightVolantino,
      regoleMenabo: salvate?.regoleMenabo ?? [],
    };
  }

  /** Il file config/flyerInsightsConfig.json dell'installazione; null se manca o non si legge. */
  private async configurazioneDelFile(): Promise<Record<string, unknown> | null> {
    try {
      return await this.configInsight.getFlyerInsightsConfig(null);
    } catch (errore) {
      if (!(errore instanceof NotFoundError)) {
        log.warn('Impostazioni GDO: configurazione degli insight del file non leggibile', { errore: messaggio(errore) });
      }
      return null;
    }
  }

  private async reparti(idGdo: string, salvate: ImpostazioniGdoSalvate | null, configurazione: Record<string, unknown> | null): Promise<ImpostazioniGdo['reparti']> {
    // L'anagrafica e i campi del reparto della configurazione degli insight che la GDO usa
    const contesto = contestoDallaConfig(configurazione);
    const [nelleReferenze, dizionario] = await Promise.all([
      this.repository.repartiNelleReferenze(idGdo, { codice: contesto.percorsoReparto, descrizione: contesto.percorsoDescrizioneReparto }),
      this.dizionario(),
    ]);
    return repartiDellaGdo(contesto.anagraficaReparti, salvate?.reparti ?? [], nelleReferenze, dizionarioNormalizzato(dizionario));
  }

  /** Le linee e i bolli dichiarati dalla libreria agenzia, con il logo del catalogo di Istanta; null senza. */
  private async lineeDichiarate(richiesta?: Request): Promise<ImpostazioniGdo['lineeDistributore']> {
    const dichiarate = this.agenziaLib.insightVolantino?.lineeDistributore;
    if (!dichiarate) return null;
    let catalogo = new Map<string, LogoDelCatalogo>();
    try {
      catalogo = await this.catalogoLoghi.catalogo(richiesta);
    } catch (errore) {
      log.warn('Impostazioni GDO: catalogo dei loghi non disponibile, linee senza logo', { errore: messaggio(errore) });
    }
    const logo = (sigla: string): string | null => {
      const voce = catalogo.get(sigla.trim().toLowerCase());
      return voce ? urlImmagineLogo(voce.guidId) : null;
    };
    const linee: LineaDichiarata[] = dichiarate.linee.map(linea => ({ sigla: linea.sigla, nome: linea.nome, colore: linea.colore ?? null, logo: logo(linea.sigla) }));
    const bolli: BolloDichiarato[] = (dichiarate.bolli ?? []).map(bollo => ({ sigla: bollo.sigla, nome: bollo.nome, logo: logo(bollo.sigla) }));
    return { linee, bolli };
  }

  // ─── Identita', campi delle referenze, sito web (riga config) ──────

  async salvaIdentita(idGdo: string, dati: unknown, richiesta?: Request): Promise<ImpostazioniGdo> {
    await this.gdoEsistente(idGdo);
    const valore = oggetto(dati)?.colore;
    const colore = typeof valore === 'string' && COLORE_ESADECIMALE.test(valore) ? valore : null;
    if (valore !== null && colore === null) {
      throw new BadRequestError({ message: 'colore: deve essere un colore #rrggbb o null' });
    }
    await this.righeConfig.aggiornaColore(idGdo, colore);
    return this.leggi(idGdo, richiesta);
  }

  async salvaCampiReferenze(idGdo: string, dati: unknown, richiesta?: Request): Promise<ImpostazioniGdo> {
    await this.gdoEsistente(idGdo);
    await this.righeConfig.aggiornaWebpliant(idGdo, { data_fields_refs: campiReferenzeDaSalvare(dati) });
    return this.leggi(idGdo, richiesta);
  }

  async salvaSitoWeb(idGdo: string, dati: unknown, chiaveOlimpo: string | undefined, richiesta?: Request): Promise<ImpostazioniGdo> {
    await this.gdoEsistente(idGdo);
    const chiavi = await this.sitoWebDaSalvare(dati, chiaveOlimpo);
    if (Object.keys(chiavi).length > 0) await this.righeConfig.aggiornaWebpliant(idGdo, chiavi);
    return this.leggi(idGdo, richiesta);
  }

  /**
   * Le chiavi del sito web presenti nella richiesta, pronte da salvare come faceva
   * saveWebpliantConfig: CSS minificato, loghi dell'header e icona in base64 caricati su Olimpo
   * (il logo prende l'URL del proxy, l'icona il GUID), l'URL Olimpo dell'icona riportato al GUID.
   */
  private async sitoWebDaSalvare(dati: unknown, chiaveOlimpo: string | undefined): Promise<Record<string, unknown>> {
    const sito = oggetto(dati);
    if (!sito) throw new BadRequestError({ message: 'Il sito web deve essere un oggetto' });
    const chiavi: Record<string, unknown> = {};
    for (const chiave of CHIAVI_SITO_WEB) {
      if (sito[chiave] !== undefined) chiavi[chiave] = sito[chiave];
    }

    if (chiavi.css_text !== undefined) {
      if (typeof chiavi.css_text !== 'string') throw new BadRequestError({ message: 'css_text deve essere un testo' });
      if (chiavi.css_text !== '') chiavi.css_text = new CleanCSS().minify(chiavi.css_text).styles;
    }
    for (const chiave of ['stili', 'stili_minimal', 'logo_header'] as const) {
      if (chiavi[chiave] !== undefined && !Array.isArray(chiavi[chiave])) throw new BadRequestError({ message: `${chiave} deve essere un elenco` });
    }
    if (chiavi.meta_volantino !== undefined && !oggetto(chiavi.meta_volantino)) {
      throw new BadRequestError({ message: 'meta_volantino deve essere un oggetto' });
    }

    if (Array.isArray(chiavi.logo_header)) {
      chiavi.logo_header = await Promise.all(chiavi.logo_header.map(async (voce: unknown) => {
        const logo = oggetto(voce);
        if (!logo) throw new BadRequestError({ message: 'Ogni logo dell\'header deve essere un oggetto' });
        // La regex accetta anche la stringa vuota: senza contenuto non si carica nulla
        if (typeof logo.base64 === 'string' && logo.base64 !== '' && BASE64.test(logo.base64) && !logo.url) {
          const guidId = await this.caricaSuOlimpo(new Blob([Buffer.from(logo.base64, 'base64')], { type: 'image/png' }), `${uuidv4()}.png`, chiaveOlimpo);
          return { ...logo, url: urlOlimpo('/foto/getThumbNailOnDemand', { guidId }) };
        }
        return logo;
      }));
    }

    if (chiavi.icona_pagina !== undefined) {
      if (typeof chiavi.icona_pagina !== 'string') throw new BadRequestError({ message: 'icona_pagina deve essere un testo' });
      const icona = chiavi.icona_pagina;
      if (icona !== '' && BASE64.test(icona)) {
        chiavi.icona_pagina = await this.caricaSuOlimpo(new Blob([Buffer.from(icona, 'base64')], { type: 'image/x-icon' }), `${uuidv4()}.ico`, chiaveOlimpo);
      } else if (isUrlOlimpo(icona)) {
        // Il frontend rimanda l'URL ricevuto (assoluto o /olimpo/...): si salva il GUID
        chiavi.icona_pagina = new URL(icona, 'http://fidelity.invalid').searchParams.get('guidId') || '';
      }
    }
    return chiavi;
  }

  // ─── Reparti (impostazioni_gdo) ────────────────────────────────────

  async salvaReparti(idGdo: string, dati: unknown, richiesta?: Request): Promise<ImpostazioniGdo> {
    await this.gdoEsistente(idGdo);
    const { reparti, errori } = verificaRepartiDaSalvare(dati);
    if (errori.length > 0) throw new BadRequestError({ message: `Reparti non validi: ${errori.join('; ')}`, details: { errori } });
    await this.repository.salvaReparti(idGdo, reparti);
    return this.leggi(idGdo, richiesta);
  }

  // ─── Regole delle sezioni del menabò (impostazioni_gdo) ────────────

  async salvaRegoleMenabo(idGdo: string, dati: unknown, richiesta?: Request): Promise<ImpostazioniGdo> {
    await this.gdoEsistente(idGdo);
    const { regole, errori } = verificaRegoleMenabo(dati);
    if (errori.length > 0) throw new BadRequestError({ message: `Regole del menabò non valide: ${errori.join('; ')}`, details: { errori } });
    await this.repository.salvaRegoleMenabo(idGdo, regole);
    // Le regole viaggiano con la configurazione degli insight in cache: si dimentica per usarle subito
    await this.dimenticaCache(idGdo);
    return this.leggi(idGdo, richiesta);
  }

  async volantiniPerProvaMenabo(idGdo: string): Promise<VolantinoProvaMenabo[]> {
    await this.gdoEsistente(idGdo);
    return this.repository.volantiniDellaGdo(idGdo, VOLANTINI_PER_PROVA);
  }

  /**
   * Per autocompilare le regole: senza `campo` i campi reali delle referenze della GDO e il campo da cui la libreria
   * agenzia ricava la sezione (per Conad CNO «mastro»); con `campo` i suoi valori reali, e per il campo del menabò
   * anche il nome leggibile che la libreria ne ricava (null se il valore non è una sezione).
   */
  async suggerimentiMenabo(idGdo: string, campo?: string): Promise<SuggerimentiCampiMenabo | SuggerimentiValoriMenabo> {
    await this.gdoEsistente(idGdo);
    const dichiarato = this.agenziaLib.insightVolantino?.menabo;
    const campoMenabo = dichiarato?.campo?.trim() || null;
    const richiesto = testo(campo).trim();
    if (richiesto === '') {
      return { campoMenabo, campi: await this.repository.campiDelleReferenze(idGdo, CAMPI_SUGGERITI) };
    }
    if (richiesto.length > LUNGHEZZA_MASSIMA_CAMPO) throw new BadRequestError({ message: `campo: al massimo ${LUNGHEZZA_MASSIMA_CAMPO} caratteri` });
    const valori = await this.repository.valoriDelCampo(idGdo, richiesto, VALORI_SUGGERITI);
    if (!dichiarato || campoMenabo === null || richiesto.toLowerCase() !== campoMenabo.toLowerCase()) return { campo: richiesto, valori };
    return {
      campo: richiesto,
      valori: valori.map(voce => ({ ...voce, nomeLeggibile: dichiarato.nome ? dichiarato.nome(voce.valore) : voce.valore })),
    };
  }

  /**
   * Il menabò di un volantino della GDO prima e dopo le regole (anche non salvate): niente si salva.
   * Le due letture usano le stesse referenze e le stesse opzioni della libreria agenzia, solo le regole cambiano.
   */
  async provaRegoleMenabo(idGdo: string, dati: unknown): Promise<EsitoProvaMenabo> {
    await this.gdoEsistente(idGdo);
    const { regole, errori } = verificaRegoleMenabo(dati);
    if (errori.length > 0) throw new BadRequestError({ message: `Regole del menabò non valide: ${errori.join('; ')}`, details: { errori } });
    const idKit = testo(oggetto(dati)?.idKit);
    const kit = idKit === '' ? null : await this.lettureKit.kitNellAmbito(idKit, { idGdo });
    if (!kit || (kit.gdo !== null && kit.gdo !== idGdo)) {
      throw new NotFoundError({ message: 'Volantino non trovato', entityType: 'RuntimeKit', entityId: idKit });
    }
    const righe = await this.lettureKit.righeDelKit(kit.id);
    const box = boxDelKit(righe.map(riga => leggiReferenza(riga, { storico: kit.storico })));
    // I reparti come li vedono gli insight: quello della config e i nomi per il marketing della GDO
    const contesto = await contestoDellaGdo(this.configInsight, this.repository, idGdo, 'Prova delle regole del menabò');
    const repartiDelleRighe = new Map(righe.map(riga => [String(riga.id), repartoConfigurato(riga, contesto)] as const));
    const lettura: LetturaReparti = {
      repartoConfigurato: idReferenza => repartiDelleRighe.get(idReferenza) ?? null,
      risolviReparto: contesto.risolviReparto,
    };
    const prima = menaboDi(box, opzioniDellAgenzia(this.agenziaLib.insightVolantino, righe, [], lettura));
    const dopo = menaboDi(box, opzioniDellAgenzia(this.agenziaLib.insightVolantino, righe, regole, lettura));
    const rigaPerId = new Map(righe.map(riga => [String(riga.id), riga] as const));
    // Il reparto con più box nella pagina, per capire perché una pagina ha quel nome
    const repartoDellaPagina = (pagina: number): string | null => {
      const conteggi = new Map<string, number>();
      for (const scatola of box.filter(voce => voce.pagina === pagina)) {
        for (const referenza of scatola.referenze) {
          const nome = nomeRepartoDellaReferenza(String(referenza.id), rigaPerId.get(String(referenza.id)), lettura);
          if (nome) conteggi.set(nome, (conteggi.get(nome) ?? 0) + 1);
        }
      }
      return [...conteggi.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };
    const perPagina = (menabo: typeof prima) => new Map((menabo?.pagine ?? []).map(voce => [voce.pagina, voce] as const));
    const vistaPrima = perPagina(prima);
    const vistaDopo = perPagina(dopo);
    const numeri = [...new Set([...vistaPrima.keys(), ...vistaDopo.keys()])].sort((a, b) => a - b);
    const pagine = numeri.map(pagina => {
      const nomePrima = vistaPrima.get(pagina)?.nome ?? null;
      const nomeDopo = vistaDopo.get(pagina)?.nome ?? null;
      return {
        pagina,
        reparto: repartoDellaPagina(pagina),
        prima: nomePrima,
        dopo: nomeDopo,
        cambia: (nomePrima ?? '').toLocaleLowerCase('it-IT') !== (nomeDopo ?? '').toLocaleLowerCase('it-IT'),
        regola: vistaDopo.get(pagina)?.regola ?? null,
      };
    });
    const volantino = (await this.repository.volantiniDellaGdo(idGdo, VOLANTINI_PER_PROVA)).find(v => v.idKit.toLowerCase() === kit.id.toLowerCase());
    return {
      volantino: volantino ?? { idKit: kit.id, titolo: '', nomePromo: '' },
      pagine,
      cambiate: pagine.filter(voce => voce.cambia).length,
    };
  }

  // ─── Configurazione degli insight (impostazioni_gdo) ───────────────

  verificaInsightVolantino(configurazione: unknown): EsitoVerificaConfigurazione {
    return verificaConfigurazioneInsight(configurazione);
  }

  async salvaInsightVolantino(idGdo: string, configurazione: unknown, idUtente: string | null, richiesta?: Request): Promise<ImpostazioniGdo> {
    await this.gdoEsistente(idGdo);
    const esito = verificaConfigurazioneInsight(configurazione);
    if (!esito.valida) {
      // L'esito intero nei dettagli dell'errore: il client legge details.errori (percorso e messaggio)
      throw new BadRequestError({ message: 'Configurazione degli insight non valida', details: { ...esito } });
    }
    const aggiornatoDa = idUtente ? await this.nomeUtente(idUtente).catch(() => null) : null;
    await this.repository.salvaInsightVolantino(idGdo, configurazione as Record<string, unknown>, aggiornatoDa);
    await this.dimenticaCache(idGdo);
    return this.leggi(idGdo, richiesta);
  }

  async eliminaInsightVolantino(idGdo: string, richiesta?: Request): Promise<ImpostazioniGdo> {
    await this.gdoEsistente(idGdo);
    await this.repository.eliminaInsightVolantino(idGdo);
    await this.dimenticaCache(idGdo);
    return this.leggi(idGdo, richiesta);
  }

  /** La cache della configurazione degli insight della GDO; Redis che non risponde non ferma il salvataggio. */
  private async dimenticaCache(idGdo: string): Promise<void> {
    try {
      await this.dimentica(idGdo);
    } catch (errore) {
      log.warn('Impostazioni GDO: cache della configurazione degli insight non svuotata', { idGdo, errore: messaggio(errore) });
    }
  }

  private async gdoEsistente(idGdo: string): Promise<void> {
    if (!(await this.repository.gdo(idGdo))) throw new NotFoundError({ message: 'GDO non trovata', entityType: 'GDO', entityId: idGdo });
  }
}

/** La configurazione degli insight in uso per la GDO: la sua, o quella del file, o nessuna. */
export function configurazioneInsight(salvate: ImpostazioniGdoSalvate | null, file: Record<string, unknown> | null): ConfigurazioneInsightGdo {
  if (salvate?.insightVolantino) {
    return {
      configurazione: salvate.insightVolantino,
      origine: 'gdo',
      aggiornatoIl: salvate.insightAggiornatoIl ? salvate.insightAggiornatoIl.toISOString() : null,
      aggiornatoDa: salvate.insightAggiornatoDa,
    };
  }
  if (file) return { configurazione: file, origine: 'file', aggiornatoIl: null, aggiornatoDa: null };
  return { configurazione: null, origine: 'assente', aggiornatoIl: null, aggiornatoDa: null };
}

