import { EXPORT_DI_SISTEMA } from '../../../lib/enums';
import { wrapDatabaseError } from '../../../lib/errors';
import { FileItemKit } from '../../../lib/types';
import config from '../config';
import {
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
import { Referenze } from '../models/referenze';
import { ReferenzeGruppo } from '../models/referenze_gruppo';

/**
 * Autonomous VolantinoService with its own implementation.
 * Manages volantino (flyer) file queries and insights.
 */
export class VolantinoService implements IVolantinoService {
  constructor(private readonly configService: IConfigService) { }

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

  async getFlyerInsights(guidIdKitRuntime: string): Promise<FlyerInsightsDTO> {
    try {
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

      // 2. Recupera tutte le referenze per il kit runtime
      const referenzePg = await Referenze.findAll({ where: { id_runtime_kit: guidIdKitRuntime }, raw: true });
      const referenze = referenzePg as unknown as any[];

      if (!referenze || referenze.length === 0) {
        return {
          guidIdKitRuntime,
          totaleReferenze: 0,
          totalePagine: totalePaginePdf,
          riepilogoPagine: [],
          riepilogoReparti: [],
          riepilogoMeccaniche: [],
          referenze: []
        };
      }

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

      // 2. Mappa referenze in DTO usando la config per i campi dinamici
      const insightsConfig = await this.configService.getFlyerInsightsConfig();
      const fieldMapping: Record<string, string> = insightsConfig.dataMapping?.referenzaFields ?? {};

      const resolveFieldValue = (source: any, path: string): any => {
        const parts = path.split('.');
        let value: any = source;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined || value === null) return '';
        }
        // Return arrays and objects as-is, only stringify primitives
        if (Array.isArray(value) || typeof value === 'object') {
          return value;
        }
        return String(value);
      };

      const referenzeDTO: ReferenzaPosizioneDTO[] = referenze.map(ref => {
        // PG raw: true restituisce data_fields (snake_case), ma il config usa dataFields (camelCase).
        // Aggiunge l'alias in modo che resolveFieldValue possa seguire entrambi i path.
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
        for (const [dtoField, sourcePath] of Object.entries(fieldMapping)) {
          mapped[dtoField] = resolveFieldValue(normalizedRef, sourcePath);
        }

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
          mapped.foto = mapped.foto.map((f: string) =>
            f.startsWith('http') ? f : `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${f}&performante=true`
          );
        }
        if (mapped.fotoGruppo && typeof mapped.fotoGruppo === 'string' && !mapped.fotoGruppo.startsWith('http')) {
          mapped.fotoGruppo = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${mapped.fotoGruppo}&performante=true`;
        }

        return mapped as ReferenzaPosizioneDTO;
      });

      // 3. Calcola riepilogo per pagina
      const pagineMap = new Map<number, { refs: ReferenzaPosizioneDTO[], ingombro: number }>();
      referenzeDTO.filter(r => r.posizione).forEach(ref => {
        const pag = ref.posizione!.pag;
        if (!pagineMap.has(pag)) {
          pagineMap.set(pag, { refs: [], ingombro: 0 });
        }
        pagineMap.get(pag)!.refs.push(ref);
        pagineMap.get(pag)!.ingombro += ref.posizione!.percIngombro;
      });

      // Config per groupBy
      const repartiGroupBy = insightsConfig.reparti?.groupBy ?? { field: 'reparto', descriptionField: 'descrizioneReparto' };
      const meccanicheGroupBy = insightsConfig.meccaniche?.groupBy ?? { field: 'meccanica' };
      const repartiField = repartiGroupBy.field;
      const repartiDescField = repartiGroupBy.descriptionField;
      const meccanicheField = meccanicheGroupBy.field;

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
            ingombroTotalePerc: Math.round(data.ingombro * 10000) / 100,
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
        .map(([sigla, data]) => ({
          sigla,
          descrizione: data.descrizione,
          numeroReferenze: data.count,
          pagine: Array.from(data.pagine).sort((a, b) => a - b)
        }))
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

      return {
        guidIdKitRuntime,
        totaleReferenze: referenzeDTO.length,
        totalePagine: actualTotalePagine,
        riepilogoPagine,
        riepilogoReparti,
        riepilogoMeccaniche,
        referenze: referenzeDTO
      };

    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero degli insights volantino"), {
        message: "Errore durante il recupero degli insights volantino",
        operation: 'getFlyerInsights',
        entity: 'ReferenzeIstanta',
        details: { guidIdKitRuntime, error }
      });
    }
  }
}
