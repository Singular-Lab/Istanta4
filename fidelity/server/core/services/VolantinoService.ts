import type { Request } from 'express';
import { EXPORT_DI_SISTEMA } from '../../../lib/enums';
import { isAppError, wrapDatabaseError, wrapNotFoundError } from '../../../lib/errors';
import type { RepartoInsight } from '../../../lib/insightVolantino/tipi';
import { FileItemKit } from '../../../lib/types';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import type { IAgenziaLib, InsightVolantinoAgenzia } from '../agenzia_lib/types';
import type { ICatalogoLoghiService, LogoDelCatalogo } from '../interfaces/ICatalogoLoghiService';
import { log } from '../logger';
import { regoleLinee, type RegoleLinee, sigleAssegnate, urlImmagineLogo } from '../utils/lineeDistributore';
import { type FonteRepartiGdo, type RisolutoreReparti, SENZA_REPARTI_GDO } from '../utils/repartiGdo';
import { urlFotoOlimpo } from '../utils/urlOlimpo';
import { caricaRisolutoreReparti } from './risolutoreRepartiGdo';
import {
  ContestoFlyerInsightsDTO,
  FlyerInsightsDTO,
  ReferenzaPosizioneDTO,
  RiepilogoMeccanicaDTO,
  RiepilogoPaginaDTO,
  RiepilogoRepartoDTO
} from '../dto';
import { IConfigService } from '../interfaces/IConfigService';
import { IVolantinoService } from '../interfaces/IVolantinoService';
import { TipiDiExport } from '../models';
import { FilesRuntime } from '../models/files_runtime';
import { ReferenzeGruppo } from '../models/referenze_gruppo';
import { kitNellAmbito, pdfDelKit, righeDelKit } from '../repositories/InsightVolantinoRepository';
import { boxDelKit } from '../utils/analisiKit';
import { applicaAnagraficaReparti, leggiAnagraficaReparti, valoreCampo, type PercorsoCampo } from '../utils/campiInsights';
import { sezioniInsight, type OpzioniInsight } from '../utils/insightVolantino';
import { origineStoricoPerReport } from '../utils/origineStorico';
import { leggiReferenza, percentualeIngombro } from '../utils/referenzaStampata';

/** Un campo mappato dalla config come testo: '' se manca o non e' un valore semplice. */
function testoDelCampo(valore: unknown): string {
  return typeof valore === 'string' || typeof valore === 'number' ? String(valore).trim() : '';
}

/**
 * Il reparto della referenza come l'ha mappato la config, gia' ricondotto all'anagrafica: stesso
 * codice dei riepiloghi e dei colori della config. null se la config non lo mappa o la referenza non lo ha.
 */
function repartoDellaConfig(referenza: ReferenzaPosizioneDTO | undefined, campoCodice: string, campoDescrizione?: string): RepartoInsight | null {
  if (!referenza) return null;
  const codice = testoDelCampo(referenza[campoCodice]);
  if (!codice) return null;
  const descrizione = campoDescrizione ? testoDelCampo(referenza[campoDescrizione]) : '';
  return { codice, descrizione: descrizione || codice };
}

/**
 * Il reparto della referenza con nome per il marketing e colore della GDO (Impostazioni GDO): codici
 * con lo stesso nome per il marketing diventano un reparto solo, nei riepiloghi come nei box.
 */
function applicaRepartoGdo(referenza: Record<string, unknown>, risolutore: RisolutoreReparti, campoCodice: string, campoDescrizione?: string): void {
  const codice = testoDelCampo(referenza[campoCodice]);
  const descrizione = campoDescrizione ? testoDelCampo(referenza[campoDescrizione]) : '';
  if (!codice && !descrizione) return;
  const risolto = risolutore.risolvi({ codice, descrizione });
  if (!risolto.marketing) return;
  referenza[campoCodice] = risolto.codice;
  if (campoDescrizione) referenza[campoDescrizione] = risolto.descrizione;
}

/** Le marche del distributore dalla config (marche.distributore, facoltativa): solo testi non vuoti. */
function marcheDelDistributore(valore: unknown): string[] {
  return Array.isArray(valore) ? valore.filter((voce): voce is string => typeof voce === 'string' && voce.trim() !== '') : [];
}

/**
 * Autonomous VolantinoService with its own implementation.
 * Manages volantino (flyer) file queries and insights.
 */
/** La composizione della descrizione del box dichiarata dalla libreria agenzia, legata al suo modulo; undefined senza. */
const descrizioneDellAgenzia = (agenzia: InsightVolantinoAgenzia | undefined): OpzioniInsight['descrizioneBox'] =>
  agenzia?.descrizioneBox ? testi => agenzia.descrizioneBox!(testi) : undefined;

export class VolantinoService implements IVolantinoService {
  constructor(
    private readonly configService: IConfigService,
    // Reparti della GDO, linee del distributore e catalogo dei loghi: il container li passa, i test possono non farlo
    private readonly reparti: FonteRepartiGdo = SENZA_REPARTI_GDO,
    private readonly agenziaLib: Pick<IAgenziaLib, 'insightVolantino'> = {},
    private readonly catalogoLoghi: Pick<ICatalogoLoghiService, 'catalogo'> | null = null
  ) { }

  /** Il catalogo dei loghi di Istanta per le linee del distributore; vuoto se non si legge. */
  private async catalogo(richiesta?: Request): Promise<Map<string, LogoDelCatalogo>> {
    if (!this.catalogoLoghi) return new Map();
    try {
      return await this.catalogoLoghi.catalogo(richiesta);
    } catch (error) {
      log.warn('Insight volantino: catalogo dei loghi non disponibile, linee senza logo', {
        errore: error instanceof Error ? error.message : String(error)
      });
      return new Map();
    }
  }

  async prendiIVolantiniCaricatiDaDB(): Promise<any> {
    try {
      const tipoExportVol = await TipiDiExport.findOne({
        where: {
          codice_tipiexport: EXPORT_DI_SISTEMA.VOL
        }
      })
      const result = await FilesRuntime.findAll({ where: { tipo_export: tipoExportVol.id_tipiexport }, raw: true }) as unknown as FileItemKit[];
      return result || [];
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei volantini"), {
        message: "Errore durante il recupero dei volantini",
        operation: 'get',
        entity: 'FileItemKit',
        details: { error }
      });
    }
  }

  async getFlyerInsights(guidIdKitRuntime: string, ambito: AmbitoGdo = 'tutte', richiesta?: Request): Promise<FlyerInsightsDTO> {
    try {
      // 0. Il kit solo nella GDO della richiesta: per chi non la vede e' come se non esistesse
      const kit = await kitNellAmbito(guidIdKitRuntime, ambito);
      if (!kit) {
        throw wrapNotFoundError(new Error('Volantino non trovato'), {
          message: 'Volantino non trovato',
          entityType: 'RuntimeKit',
          entityId: guidIdKitRuntime
        });
      }

      // 1. Calcola le pagine totali dai file VOL reali in FilesRuntime
      // (RuntimeKit.files_data è un template senza campo "pages")
      let totalePaginePdf = 0;
      const tipoExportVol = await TipiDiExport.findOne({
        where: {
          codice_tipiexport: EXPORT_DI_SISTEMA.VOL
        }
      })
      const volFiles = await FilesRuntime.findAll({
        where: { id_runtime: guidIdKitRuntime, tipo_export: tipoExportVol.id_tipiexport },
        raw: true
      });
      if (volFiles.length > 0) {
        totalePaginePdf = volFiles.reduce((max: number, f: any) => Math.max(max, f.pages || 0), 0);
      } else {
        // Fallback: massimo numero di pagine da qualsiasi file del kit
        const anyFiles = await FilesRuntime.findAll({
          where: { id_runtime: guidIdKitRuntime },
          attributes: ['pages'],
          raw: true
        }) as any[];
        totalePaginePdf = anyFiles.reduce((max: number, f: any) => Math.max(max, f.pages || 0), 0);
      }

      // 2. Le referenze del kit per pagina e posizione (la prima di un box e' la pilota) e il PDF del volantino.
      // Senza referenze si prosegue lo stesso: i riepiloghi vengono vuoti e le sezioni nuove pure.
      const [righe, pdf] = await Promise.all([righeDelKit(guidIdKitRuntime), pdfDelKit(guidIdKitRuntime)]);
      const referenze = righe as unknown as any[];

      /*
        L'origine sta sul kit, non sulla singola referenza: se la lavorazione e
        stata recuperata dallo storico lo sono tutte le sue referenze. Le fuori
        listino si riconoscono per codice box, che e il ponte verso il box del
        volantino da cui sono state compilate.
      */
      const contesto: ContestoFlyerInsightsDTO = {
        titolo: kit.titolo,
        nomeArea: kit.area || undefined,
        nomeCanale: kit.canale || undefined,
        idPromo: kit.idPromo,
        // Le date della promo come le legge kitNellAmbito: YYYY-MM-DD nel fuso delle promo
        validitaDal: kit.validitaDal,
        validitaAl: kit.validitaAl
      };
      const importStorico = kit.importStorico;
      const codiciBoxFuoriListino = new Set(
        (importStorico?.fuoriListino ?? []).map((voce) => String(voce.codiceBox)).filter(Boolean)
      );
      const origineStorico = origineStoricoPerReport(importStorico);

      // 2b. Recupera le foto di gruppo dalla tabella ReferenzeGruppo
      const codiciReferenza = referenze
        .map((r: any) => r.data_fields?.codice_referenza)
        .filter(Boolean) as string[];
      const fotoGruppoMap = new Map<string, string>();
      if (codiciReferenza.length > 0) {
        const gruppoRows = await ReferenzeGruppo.findAll({
          where: { codice_referenza: codiciReferenza },
          raw: true
        }) as any[];
        for (const row of gruppoRows) {
          fotoGruppoMap.set(row.codice_referenza, row.guid_id_olympo);
        }
      }

      // 2. Mappa referenze in DTO usando la config degli insight della GDO del kit (o quella del file)
      const insightsConfig = await this.configService.getFlyerInsightsConfig(kit.gdo);
      const fieldMapping: Record<string, PercorsoCampo> = insightsConfig.dataMapping?.referenzaFields ?? {};
      const anagraficaReparti = leggiAnagraficaReparti(insightsConfig.dataMapping?.reparti);
      // Nome per il marketing e colore dei reparti della GDO (Impostazioni GDO)
      const risolutore = await caricaRisolutoreReparti(this.reparti, kit.gdo, anagraficaReparti, 'Insight volantino');

      // Config per groupBy
      const repartiGroupBy = insightsConfig.reparti?.groupBy ?? { field: 'reparto', descriptionField: 'descrizioneReparto' };
      const meccanicheGroupBy = insightsConfig.meccaniche?.groupBy ?? { field: 'meccanica' };
      const repartiField = repartiGroupBy.field;
      const repartiDescField = repartiGroupBy.descriptionField;
      const meccanicheField = meccanicheGroupBy.field;

      const referenzeDTO: ReferenzaPosizioneDTO[] = referenze.map(ref => {
        // PG raw: true restituisce data_fields (snake_case), ma il config usa dataFields (camelCase).
        // Aggiunge l'alias in modo che valoreCampo possa seguire entrambi i path.
        // fotoGruppo non è colonna del modello PG: lo risolviamo dalla tabella ReferenzeGruppo.
        const codRef = ref.data_fields?.codice_referenza;
        const fotoGruppoGuid = codRef ? fotoGruppoMap.get(codRef) : undefined;
        const normalizedRef = { ...ref, dataFields: ref.data_fields, fotoGruppo: fotoGruppoGuid };

        // Conversione esplicita a numero per sicurezza (InDesign potrebbe inviare stringhe)
        const pagNum = ref.pag !== undefined ? Number(ref.pag) : undefined;
        const hasPosizione = pagNum !== undefined && !isNaN(pagNum) && ref.x !== undefined && ref.y !== undefined;
        const posizione = hasPosizione ? {
          pag: pagNum!,
          x: Number(ref.x) || 0,
          y: Number(ref.y) || 0,
          w: Number(ref.w) || 0,
          h: Number(ref.h) || 0,
          wPage: Number(ref.w_page) || 210,
          hPage: Number(ref.h_page) || 297,
          percIngombro: Number(ref.perc_ingombro) || 0,
          aspectRatio: Number(ref.aspect_ratio) || 1
        } : null;

        // Mappa campi dinamici dalla config
        const mapped: Record<string, any> = { id: ref.id, posizione };
        if (origineStorico) {
          mapped.origine = codiciBoxFuoriListino.has(String(ref.codice_box)) ? 'fuori_listino' : 'listino';
        }
        for (const [dtoField, sourcePath] of Object.entries(fieldMapping)) {
          mapped[dtoField] = valoreCampo(normalizedRef, sourcePath);
        }
        // Stesso reparto per Istanta ("01") e storico ("1", senza descrizione): quello dell'anagrafica
        applicaAnagraficaReparti(mapped, anagraficaReparti, repartiField, repartiDescField);
        if (!risolutore.vuoto) applicaRepartoGdo(mapped, risolutore, repartiField, repartiDescField);

        // Normalizza stringhe numeriche in formato italiano (es. "0,85" → 0.85)
        // Il componente usa Number(ref.prezzo) che non gestisce la virgola come separatore decimale
        for (const key of Object.keys(mapped)) {
          const val = mapped[key];
          if (typeof val === 'string' && /^-?\d+,\d+$/.test(val)) {
            const num = parseFloat(val.replace(',', '.'));
            if (!isNaN(num)) mapped[key] = num;
          }
        }

        // Trasforma gli URL delle foto con il prefisso OLYMPUS
        if (mapped.foto && Array.isArray(mapped.foto)) {
          mapped.foto = mapped.foto
            .map((f: any) => typeof f === 'string' ? f : f?.guidId)
            .filter(Boolean)
            .map((f: string) =>
              urlFotoOlimpo(f, { performante: true })
            );
        }
        if (mapped.fotoGruppo && typeof mapped.fotoGruppo === 'string') {
          mapped.fotoGruppo = urlFotoOlimpo(mapped.fotoGruppo, { performante: true });
        }

        return mapped as ReferenzaPosizioneDTO;
      });

      // 3. Calcola riepilogo per pagina
      // L'ingombro e' in percentuale della pagina qualunque sia la fonte: Istanta manda perc_ingombro
      // come frazione, lo storico (sync del Plugin) gia' in percentuale; si decide riga per riga.
      const pagineMap = new Map<number, { refs: ReferenzaPosizioneDTO[], ingombro: number }>();
      referenzeDTO.forEach((ref, indice) => {
        if (!ref.posizione) return;
        const pag = ref.posizione.pag;
        if (!pagineMap.has(pag)) {
          pagineMap.set(pag, { refs: [], ingombro: 0 });
        }
        pagineMap.get(pag)!.refs.push(ref);
        pagineMap.get(pag)!.ingombro += percentualeIngombro(referenze[indice]);
      });

      const riepilogoPagine: RiepilogoPaginaDTO[] = Array.from(pagineMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([pagina, data]) => {
          const repartiCount = new Map<string, { sigla: string; descrizione: string; count: number }>();
          data.refs.forEach(r => {
            const sigla = r[repartiField] || '';
            const desc = repartiDescField ? (r[repartiDescField] || '') : '';
            if (!repartiCount.has(sigla)) {
              repartiCount.set(sigla, { sigla, descrizione: desc, count: 0 });
            }
            repartiCount.get(sigla)!.count++;
          });

          return {
            pagina,
            numeroReferenze: data.refs.length,
            ingombroTotalePerc: Math.round(data.ingombro * 100) / 100,
            reparti: Array.from(repartiCount.values())
          };
        });

      // 4. Calcola riepilogo per reparto (campo groupBy dalla config)
      const repartiMap = new Map<string, { descrizione: string; count: number; pagine: Set<number> }>();
      referenzeDTO.forEach(ref => {
        const sigla = ref[repartiField] || '';
        const desc = repartiDescField ? (ref[repartiDescField] || '') : '';
        if (!repartiMap.has(sigla)) {
          repartiMap.set(sigla, { descrizione: desc, count: 0, pagine: new Set() });
        }
        repartiMap.get(sigla)!.count++;
        if (ref.posizione) {
          repartiMap.get(sigla)!.pagine.add(ref.posizione.pag);
        }
      });

      const riepilogoReparti: RiepilogoRepartoDTO[] = Array.from(repartiMap.entries())
        .map(([sigla, data]) => {
          const voce: RiepilogoRepartoDTO = {
            sigla,
            descrizione: data.descrizione,
            numeroReferenze: data.count,
            pagine: Array.from(data.pagine).sort((a, b) => a - b)
          };
          // Il colore impostato per la GDO, solo se c'e': senza, quello della config o automatico
          const colore = risolutore.vuoto || !sigla ? null : risolutore.risolvi({ codice: sigla, descrizione: data.descrizione }).colore;
          if (colore) voce.colore = colore;
          return voce;
        })
        .sort((a, b) => b.numeroReferenze - a.numeroReferenze);

      // 5. Calcola riepilogo per meccanica (campo groupBy dalla config)
      const meccanicheMap = new Map<string, number>();
      referenzeDTO.forEach(ref => {
        const key = ref[meccanicheField] || '';
        meccanicheMap.set(key, (meccanicheMap.get(key) || 0) + 1);
      });

      const totale = referenzeDTO.length;
      const riepilogoMeccaniche: RiepilogoMeccanicaDTO[] = Array.from(meccanicheMap.entries())
        .map(([key, count]) => ({
          [meccanicheField]: key,
          numeroReferenze: count,
          percentuale: Math.round((count / totale) * 10000) / 100
        }))
        .sort((a, b) => b.numeroReferenze - a.numeroReferenze);

      // Usa il numero di pagine dal PDF, o se non disponibile, il massimo numero di pagina dalle referenze
      const maxPageFromRefs = Math.max(...Array.from(pagineMap.keys()), 0);
      const actualTotalePagine = totalePaginePdf > 0 ? totalePaginePdf : maxPageFromRefs;

      // 6. Le sezioni nuove (box sulle pagine, sintesi, prezzi, spazio, marche): lettura
      // generica delle referenze, uguale per ogni GDO e per Istanta e storico. Dalla config solo
      // reparto e meccanica gia' mappati qui sopra, cosi' codici e colori restano quelli dei riepiloghi.
      const dtoPerId = new Map(referenzeDTO.map(ref => [String(ref.id), ref] as const));
      const codiciFuoriListino = new Set([...codiciBoxFuoriListino].map(codice => codice.trim()));
      // Linee del distributore e bolli, se la libreria agenzia del cliente li dichiara: i loghi
      // assegnati da Istanta alle referenze e il catalogo dei loghi, letto prima delle sezioni
      const regole: RegoleLinee | null = regoleLinee(this.agenziaLib.insightVolantino?.lineeDistributore);
      const loghiPerReferenza = new Map(righe.map(riga => [String(riga.id), sigleAssegnate(riga.foto_extra)] as const));
      const catalogo = regole ? await this.catalogo(richiesta) : new Map<string, LogoDelCatalogo>();
      const sezioni = sezioniInsight(
        boxDelKit(righe.map(riga => leggiReferenza(riga, { storico: kit.storico }))),
        {
          // Le pagine come nei confronti (InsightConfrontiService.pagineDelKit): quelle del PDF in Olimpo,
          // o fino all'ultima pagina con un box. Cosi' la sintesi e il confronto con l'edizione
          // precedente contano le stesse pagine; totalePagine di sempre resta per i riepiloghi.
          totalePagine: pdf?.pagine ?? 0,
          anagraficaReparti,
          marcheDistributore: marcheDelDistributore(insightsConfig.marche?.distributore),
          repartoConfigurato: (idReferenza) => repartoDellaConfig(dtoPerId.get(idReferenza), repartiField, repartiDescField),
          meccanicaOriginale: (idReferenza) => testoDelCampo(dtoPerId.get(idReferenza)?.[meccanicheField]) || null,
          urlFoto: (guid) => urlFotoOlimpo(guid, { performante: true }),
          origine: origineStorico
            ? (codiceBox) => (codiciFuoriListino.has(codiceBox) ? 'fuori_listino' : 'listino')
            : undefined,
          risolviReparto: risolutore.vuoto ? undefined : (reparto) => risolutore.risolvi(reparto),
          lineeDistributore: regole,
          loghiAssegnati: (idReferenza) => loghiPerReferenza.get(idReferenza) ?? [],
          urlLogo: (sigla) => {
            const voce = catalogo.get(sigla.trim().toLowerCase());
            return voce ? urlImmagineLogo(voce.guidId) : null;
          },
          // La descrizione completa del box nella scheda, se la libreria agenzia del cliente la compone a modo suo
          descrizioneBox: descrizioneDellAgenzia(this.agenziaLib.insightVolantino)
        }
      );

      return {
        guidIdKitRuntime,
        contesto,
        origineStorico,
        totaleReferenze: referenzeDTO.length,
        totalePagine: actualTotalePagine,
        riepilogoPagine,
        riepilogoReparti,
        riepilogoMeccaniche,
        referenze: referenzeDTO,
        // Le pagine del PDF quando il file non le dice sono quelle della sintesi, come pdfAltra nelle varianti
        pdf: pdf ? { ...pdf, pagine: pdf.pagine > 0 ? pdf.pagine : sezioni.sintesi.pagine } : null,
        ...sezioni
      };

    } catch (error) {
      if (isAppError(error)) throw error;
      throw wrapDatabaseError(new Error("Errore durante il recupero degli insights volantino"), {
        message: "Errore durante il recupero degli insights volantino",
        operation: 'getFlyerInsights',
        entity: 'ReferenzeIstanta',
        details: { guidIdKitRuntime, error }
      });
    }
  }
}
