import axios from 'axios';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { Request } from 'express';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../logger';
import { Colorize } from '../../../lib/Colorize';
import { decryptString, encryptString } from '../../../lib/encryption';
import { CATEGORIA_ATTIVITA, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_ORDINI_STAMPA, TIPO_ATTIVITA } from '../../../lib/enums';
import { BadRequestError, ExternalApiError, NotFoundError, wrapDatabaseError } from '../../../lib/errors';
import { ContrattoTipografiaAttributes, FileItemKit, FileTreeCondition, FileTreeNode, MergedGroupFile, OrdiniDiStampaAttributes, RUNTIME_KIT_MONGO, RootFileTree, VirtualDirectory } from '../../../lib/types';
import { emitToClients } from '../../ws-server';
import config from '../config';
import { AreaResponseDTO, CanaleResponseDTO, ContrattoTipografiaResponseDTO, type OrdiniDiStampaResponseDTO, type PromoResponseDTO } from '../dto';
import { IGdoService } from '../interfaces/IGdoService';
import { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import { IOrdiniStampaService } from '../interfaces/IOrdiniStampaService';
import { Area } from '../models/aree';
import { Canale } from '../models/canali';
import { ContrattoTipografia } from '../models/contratto_tipografia';
import { FilesRuntime } from '../models/files_runtime';
import { GDO } from '../models/gdo';
import { OrdiniDiStampa } from '../models/ordini_di_stampa';
import { OrdiniDiStampaInvii } from '../models/ordini_di_stampa_invii';
import { Promo, PromoAttributes } from '../models/promo';
import { RuntimeKit } from '../models/runtime_kit';
import { ServerUtils } from '../utils/ServerUtils';

// Declare global.io type to avoid implicit 'any' error


interface ProcessFTPPopOlimpoParams {
  req: Express.Request;
  idOrdineDiStampa: string;
  kitIds: Record<string, boolean>;
  socketId: string;
}

interface EmitProgressParams {
  fase: string;
  completato?: boolean;
  kit?: string;
  progress?: number;
  message: string;
  totalKits?: number;
  kits?: string[];
}

interface EmitErrorParams {
  error: string;
  esito: boolean;
  kit?: string;
}

interface EmitCompleteParams {
  esito: boolean;
  message: string;
  totalFiles: number;
  totalKit: number;
}

const decryptOrRaw = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    return decryptString(value, config.FICO_SECRET);
  } catch {
    return value;
  }
};

const encryptForBody = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  return encryptString(value, config.FICO_SECRET);
};

export interface GroupingJobState {
  socketId: string;
  status: 'running' | 'completed' | 'failed';
  result?: {
    totalFiles: number;
    analyzedFiles: number;
    groupCount: number;
    groups: Array<{
      groupId: string;
      size: number;
      files: Array<{
        id_olimpo_cloud: string;
        nome: string;
        id_runtime: string;
        nome_kit: string;
        tipo_export: string;
        pages?: number;
      }>;
    }>;
    unmatchedIds: string[];
  };
  error?: string;
  startedAt: number;
}

const GROUPING_JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

export class OrdiniStampaService implements IOrdiniStampaService {

  private readonly gdoService: IGdoService;
  private readonly kitRuntimeService: IKitRuntimeService;
  private groupingJobs = new Map<string, GroupingJobState>();
  private virtualDir = new Map<string, VirtualDirectory[]>()

  constructor(gdoService: IGdoService, kitRuntimeService: IKitRuntimeService) {
    this.gdoService = gdoService;
    this.kitRuntimeService = kitRuntimeService;
  }

  getGroupingStatus(idOrdineDiStampa: string): GroupingJobState | null {
    const job = this.groupingJobs.get(idOrdineDiStampa);
    if (!job) return null;
    // Clean up expired jobs
    if (Date.now() - job.startedAt > GROUPING_JOB_TTL_MS) {
      this.groupingJobs.delete(idOrdineDiStampa);
      return null;
    }
    return job;
  }

  async getOrdineById(id: string): Promise<OrdiniDiStampaAttributes> {
    try {
      const ordine = await OrdiniDiStampa.findByPk(id);
      if (!ordine) {
        throw new NotFoundError({
          message: "Ordine non trovato",
          entityType: 'OrdiniDiStampa',
          entityId: id
        });
      }
      return ordine.dataValues;
    }
    catch (error) {
      console.error(error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante il recupero dell'ordine"), {
        message: "Errore durante il recupero dell'ordine",
        operation: 'findByPk',
        entity: 'OrdiniDiStampa',
        details: { id },
      });
    }
  }

  async creaOrdineStampa(data: {
    idPromo: string;
    idUtente: string;
  }): Promise<OrdiniDiStampaAttributes> {
    try {
      const ordineStampa: OrdiniDiStampaAttributes = {
        id_ordinistampa: uuidv4(),
        id_promo_ordinistampa: data.idPromo,
        stato_ordinistampa: STATO_ORDINI_STAMPA.IN_REVISIONE,
        data_di_conferma_ordinistampa: new Date().toISOString(),
        idutente_ordinistampa: data.idUtente
      };

      const result = await OrdiniDiStampa.create(ordineStampa);
      return result;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante la creazione dell\'ordine di stampa:'), error);
      throw wrapDatabaseError(new Error("Errore durante la creazione dell'ordine di stampa"), {
        message: "Errore durante la creazione dell'ordine di stampa",
        operation: 'create',
        entity: 'OrdiniDiStampa',
        details: { data },
      });
    }
  }

  async getOrdiniStampaByPromo(idPromo: string): Promise<OrdiniDiStampaAttributes[]> {
    try {
      const ordini = await OrdiniDiStampa.findAll({
        where: { id_promo_ordinistampa: idPromo }
      });
      return ordini;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero degli ordini di stampa per promo:'), error);
      throw wrapDatabaseError(new Error("Errore durante il recupero degli ordini di stampa per promo"), {
        message: "Errore durante il recupero degli ordini di stampa per promo",
        operation: 'findAll',
        entity: 'OrdiniDiStampa',
        details: { idPromo },
      });
    }
  }


  async updateStatoOrdineStampa(id: string, stato: STATO_ORDINI_STAMPA): Promise<OrdiniDiStampaAttributes> {
    try {
      const ordine = await OrdiniDiStampa.findByPk(id);
      if (!ordine) {
        throw new NotFoundError({
          message: "Ordine di stampa non trovato",
          entityType: 'OrdiniDiStampa',
          entityId: id
        });
      }
      ordine.stato_ordinistampa = stato;
      await ordine.save();
      return ordine;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante l\'aggiornamento dello stato dell\'ordine di stampa:'), error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento dello stato dell'ordine di stampa"), {
        message: "Errore durante l'aggiornamento dello stato dell'ordine di stampa",
        operation: 'update',
        entity: 'OrdiniDiStampa',
        details: { id, stato },
      });
    }
  }

  async deleteOrdineStampa(id: string): Promise<boolean> {
    try {
      const result = await OrdiniDiStampa.destroy({
        where: { id_ordinistampa: id }
      });

      if (result === 0) {
        throw new NotFoundError({
          message: "Ordine di stampa non trovato",
          entityType: 'OrdiniDiStampa',
          entityId: id
        });
      }

      return result > 0;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante l\'eliminazione dell\'ordine di stampa:'), error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione dell'ordine di stampa"), {
        message: "Errore durante l'eliminazione dell'ordine di stampa",
        operation: 'destroy',
        entity: 'OrdiniDiStampa',
        details: { id },
      });
    }
  }

  async getAllOrdiniDiStampaInCorso(): Promise<(OrdiniDiStampaResponseDTO & { nomePromo: string })[]> {
    try {
      // Query ottimizzata con JOIN per recuperare ordini + promo in una sola query
      const ordini = await OrdiniDiStampa.findAll({
        where: {
          stato_ordinistampa: {
            [Op.ne]: STATO_ORDINI_STAMPA.FINITO
          }
        },
        include: [{
          model: Promo,
          as: 'promo',
          attributes: ['nome_promo'], // Seleziona solo il campo necessario
          required: false // LEFT JOIN (include ordini anche senza promo)
        }],
        order: [['createdat', 'DESC']]
      });

      // Mappa direttamente i risultati (no query aggiuntive)
      const mappedDTO: (OrdiniDiStampaResponseDTO & { nomePromo: string })[] = ordini.map(ordine => ({
        id: ordine.id_ordinistampa!,
        id_utente: ordine.idutente_ordinistampa!,
        id_promo: ordine.id_promo_ordinistampa!,
        stato: ordine.stato_ordinistampa!,
        data_di_conferma: ordine.data_di_conferma_ordinistampa!,
        createdat: ordine.createdat,
        updatedat: ordine.updatedat,
        nomePromo: (ordine as any).promo?.nome_promo || ''
      }));

      return mappedDTO;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero degli ordini in corso:'), error);
      throw wrapDatabaseError(new Error("Errore durante il recupero degli ordini in corso"), {
        message: "Errore durante il recupero degli ordini in corso",
        operation: 'findAll',
        entity: 'OrdiniDiStampa',
        details: { error }
      });
    }
  }



  async processFTPPopOlimpo({ req, idOrdineDiStampa, kitIds, socketId }: ProcessFTPPopOlimpoParams): Promise<void> {
    try {
      // Funzione di utilità per individuare file duplicati (problema nei kit)
      const fileProblematici = (allKit: RUNTIME_KIT_MONGO[]): FileItemKit[][] => {
        const fileMap = new Map<string, FileItemKit[]>();
        allKit.forEach(kit => {
          kit.files?.forEach(file => {
            if (!fileMap.has(file.nome)) {
              fileMap.set(file.nome, []);
            }
            fileMap.get(file.nome)?.push(file);
          });
        });
        return Array.from(fileMap.values()).filter(files => files.length > 1);
      };
      // Validazione parametri iniziali
      if (!idOrdineDiStampa || !kitIds) {
        emitToClients(`${socketId}_error`, {
          error: "Id promo mancante",
          esito: false
        } as EmitErrorParams);
        return;
      }

      // Recupero ordine
      const ordine = await this.getOrdineById(idOrdineDiStampa);
      if (!ordine) {
        emitToClients(`${socketId}_error`, {
          error: "Ordine non trovato",
          esito: false
        } as EmitErrorParams);
        return;
      }

      const idPromo = ordine.id_promo_ordinistampa;

      // Recupero GDO
      const gdo = (await GDO.findAll())[0];
      if (!gdo) {
        emitToClients(`${socketId}_error`, {
          error: "GDO non trovata",
          esito: false
        } as EmitErrorParams);
        return;
      }

      // Recupero contratto tipografia
      const data = await ContrattoTipografia.findAll({
        where: {
          id_gdo_contrattotipografia: gdo.id_gdo
        }
      });
      if (!data || data.length === 0) {
        emitToClients(`${socketId}_error`, {
          error: "Contratto non trovato",
          esito: false
        } as EmitErrorParams);
        return;
      }

      const contrattoDbRecord = data[0].dataValues as ContrattoTipografiaAttributes;
      const hostFtpDecrypted = decryptOrRaw(contrattoDbRecord.host_ftp_contrattotipografia);
      const userFtpDecrypted = decryptOrRaw(contrattoDbRecord.user_ftp_contrattotipografia);
      const pwdFtpDecrypted = decryptOrRaw(contrattoDbRecord.pwd_ftp_contrattotipografia);
      const ftpCredenziali = {
        host_ftp: encryptForBody(hostFtpDecrypted),
        user_ftp: encryptForBody(userFtpDecrypted),
        pwd_ftp: encryptForBody(pwdFtpDecrypted),
        port_ftp: contrattoDbRecord.port_ftp_contrattotipografia ?? undefined
      };

      let contratto = contrattoDbRecord.json_contrattotipografia as RootFileTree;

      // Recupero kit selezionati
      const selectedKits = await RuntimeKit.findAll({
        where: {
          id: { [Op.in]: Object.keys(kitIds).filter(id => kitIds[id] === true) },
          stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO
        },
        raw: true
      }) as any[];

      // Recupero file per ogni kit
      await Promise.all(selectedKits.map(async (kit) => {
        kit.files = await FilesRuntime.findAll({
          where: { id_runtime: kit.id },
          raw: true
        }) as unknown as FileItemKit[];
      }));

      // Recupero invii precedenti
      const previousInvii = await OrdiniDiStampaInvii.findAll({
        where: {
          idordinestampa_ordinistampainvii: idOrdineDiStampa
        }
      });
      const previouslySentKitIds = previousInvii?.map(invii => invii.report_ordinistampainvii.kit_guids).flat();
      const kitsToProcess = selectedKits.filter(kit => !previouslySentKitIds?.includes(kit.id));

      // Recupero aree e canali
      const all_aree = await Area.findAll({
        where: {
          id_gdo_aree: gdo.id_gdo
        }
      });
      const all_canali = await Canale.findAll({
        where: {
          id_gdo_canali: gdo.id_gdo
        }
      });

      // Recupero promo
      let promo = await Promo.findOne({
        where: {
          id_promo: idPromo
        }
      });
      if (!promo) {
        emitToClients(`${socketId}_error`, {
          error: "Promo non trovata",
          esito: false
        } as EmitErrorParams);
        return;
      }

      emitToClients(`${socketId}_progress`, {
        fase: "caricamento_dati",
        completato: true,
        message: "Caricamento dati completato"
      } as EmitProgressParams);

      // Aggiorna ciascun kit con i codici relativi ad area e canale
      for (const kit of kitsToProcess) {
        const foundArea = all_aree.find(a => a.id_aree === kit.id_area);
        const foundCanale = all_canali.find(c => c.id_canali === kit.id_canale);
        kit.codiceArea = foundArea?.codice_aree || "";
        kit.codiceCanale = foundCanale?.codice_canali || "";
      }

      const totalKits = kitsToProcess.length;
      let processedKits = 0;

      // Elaborazione di ciascun kit
      for (const kit of kitsToProcess) {
        emitToClients(`${socketId}_progress`, {
          fase: "creazione_cartelle",
          kit: kit.titolo,
          progress: (processedKits + 1) / totalKits,
          totalKits,
          message: `Elaborazione kit ${processedKits + 1}/${totalKits}: ${kit.titolo}`
        } as EmitProgressParams);

        const contattoNonElaborato = structuredClone(contratto) as RootFileTree;
        // Effettua il mapping dei canali e delle aree per rispettare i tipi attesi da processaContrattoTipografiaGDO
        const canaliDTO: CanaleResponseDTO[] = all_canali.map(canale => ({
          id: canale.id_canali,
          codice: canale.codice_canali,
          nome: canale.nome_canali,
          id_gdo: canale.id_gdo_canali,
          updatedat: canale.updatedat
        }));

        const areeDTO: AreaResponseDTO[] = all_aree.map(area => ({
          id: area.id_aree,
          codice: area.codice_aree,
          nome: area.nome_aree,
          id_gdo: area.id_gdo_aree,
          updatedat: area.updatedat
        }));

        const contrattoElaborato = await processaContrattoTipografiaGDO(
          contattoNonElaborato,
          { canali: canaliDTO, aree: areeDTO, promo: promo, kit }
        );

        const resultAPI = await ServerUtils.sendToFICOApi<{ esito: boolean; error: string }>(
          req as Request,
          process.env.OLYMPUS_IP_ADDRESS + "/ftp/creazioneCartelleContratto",
          "POST",
          {
            contratto: contrattoElaborato,
            kit,
            socketId: `${socketId}`,
            ...ftpCredenziali
          }
        );

        if (!resultAPI.data || !resultAPI.data.esito) {
          emitToClients(`${socketId}_error`, {
            error: `Errore durante la creazione delle cartelle per il kit ${kit.titolo}`,
            kit: kit.titolo,
            esito: false
          } as EmitErrorParams);
        }

        processedKits++;
      }

      emitToClients(`${socketId}_progress`, {
        fase: "creazione_excel",
        completato: false,
        message: "Creazione report Excel in corso..."
      } as EmitProgressParams);

      // Calcola l'insieme dei possibili "combo" (concatenazione codice canale e codice area)
      const allCombosSet: string[] = [];
      for (const canale of all_canali) {
        for (const area of all_aree) {
          allCombosSet.push(`${canale.codice_canali} ${area.codice_aree}`);
        }
      }
      const allCombos = Array.from(new Set(allCombosSet)).sort();

      // Colori tema Istanta 2 GDO Suite - palette ispirata ai colori del progetto
      const fidelityColors = {
        primary: "03045E",      // Theme 1 - blu scuro principale
        secondary: "0C4A6E",    // Theme 2 - blu medio
        accent1: "247BA0",      // Theme 6 - blu accento
        accent2: "357266",      // Theme 8 - verde teal
        accent3: "5E548E",      // Theme 13 - viola
        light: "E2E8F0",       // Slate 200 - grigio chiaro
        white: "FFFFFF"
      };

      // Mappa colori per canali usando la palette Istanta 2 GDO Suite
      const channelColors = [fidelityColors.accent1, fidelityColors.accent2, fidelityColors.accent3, fidelityColors.secondary, fidelityColors.primary];
      const sortedCanali = [...all_canali].sort((a, b) => (a.codice_canali || "").localeCompare(b.codice_canali || ""));
      const channelColorMap = new Map<string, string>();
      let channelColorIndex = 0;
      for (const canale of sortedCanali) {
        if (canale.codice_canali && !channelColorMap.has(canale.codice_canali)) {
          channelColorMap.set(canale.codice_canali, channelColors[channelColorIndex % channelColors.length]);
          channelColorIndex++;
        }
      }

      // Prepara l'array di dati (aoaData) per l'Excel con header Istanta 2 GDO Suite
      const currentDate = new Date().toLocaleDateString('it-IT');
      const titleRow = [`Report Istanta 2 GDO Suite - ${promo.nome_promo} - ${currentDate}`, ...new Array(allCombos.length).fill("")];
      const spacerRow = new Array(1 + allCombos.length).fill("");
      const headerRow = ["Kit / File"].concat(allCombos);
      const excelData: any[][] = [];
      excelData.push(titleRow);
      excelData.push(spacerRow);
      excelData.push(headerRow);

      // Per ciascun kit, inserisce una riga per il titolo (da fondere) e una o più righe per i file
      for (const kit of kitsToProcess) {
        const comboKit = `${kit.codiceCanale} ${kit.codiceArea}`;
        const idxKit = allCombos.indexOf(comboKit);

        // Riga titolo del kit
        const rowKit = new Array(1 + allCombos.length).fill("");
        rowKit[0] = kit.titolo;
        excelData.push(rowKit);

        // Riga/e dei file del kit
        if (kit.files && kit.files.length > 0) {
          for (const file of kit.files) {
            const rowFile = new Array(1 + allCombos.length).fill("");
            rowFile[0] = file.nome;
            if (idxKit >= 0) {
              rowFile[idxKit + 1] = "1";
            }
            excelData.push(rowFile);
          }
        } else {
          const emptyRow = new Array(1 + allCombos.length).fill("");
          emptyRow[0] = "(Nessun file)";
          excelData.push(emptyRow);
        }
      }

      /* ---------------------- GENERAZIONE DEL REPORT CON EXCELJS ---------------------- */

      // Crea workbook Istanta 2 GDO Suite con branding
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Istanta 2 GDO Suite System';
      workbook.lastModifiedBy = 'Istanta 2 GDO Suite';
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.subject = `Report Ordini di Stampa - ${promo.nome_promo}`;
      workbook.description = 'Report generato automaticamente dal sistema Istanta 2 GDO Suite per la gestione degli ordini di stampa';

      const sheet = workbook.addWorksheet(`Istanta 2 GDO Suite - ${promo.nome_promo.substring(0, 20)}`);

      // Funzione per calcolare dinamicamente la larghezza delle colonne
      const calculateColumnWidth = (columnIndex: number, allData: any[][]): number => {
        let maxLength = 0;

        // Analizza tutti i dati della colonna per trovare il contenuto più lungo
        for (const row of allData) {
          const cellValue = row[columnIndex] || '';
          const cellLength = cellValue.toString().length;
          if (cellLength > maxLength) {
            maxLength = cellLength;
          }
        }

        // Larghezza minima e massima con buffer per padding
        const minWidth = 8;  // Larghezza minima
        const maxWidth = 60; // Larghezza massima per evitare colonne troppo larghe
        const bufferFactor = 1.2; // 20% di buffer per il padding

        // Calcola la larghezza ottimale
        const calculatedWidth = Math.max(minWidth, Math.min(maxWidth, maxLength * bufferFactor));

        return calculatedWidth;
      };

      // Imposta le larghezze delle colonne dinamicamente
      // Prima colonna (Kit/File) - larghezza maggiore per contenuti lunghi
      const firstColumnWidth = calculateColumnWidth(0, excelData);
      sheet.getColumn(1).width = Math.max(firstColumnWidth, 35); // Minimo 35 per nomi kit/file

      // Colonne degli header combo (canale + area) - larghezza dinamica
      for (let i = 2; i <= headerRow.length; i++) {
        const columnWidth = calculateColumnWidth(i - 1, excelData);
        // Per le colonne combo, usiamo una larghezza minima di 12 per assicurare leggibilità
        sheet.getColumn(i).width = Math.max(columnWidth, 12);
      }

      // Aggiungi tutti i dati prima di applicare gli stili
      // IMPORTANTE: ExcelJS richiede che i valori siano primitivi (string, number, boolean, Date, null)
      // Non oggetti o array complessi
      for (const row of excelData) {
        const cleanedRow = row.map(cell => {
          // Assicura che ogni cella sia un valore primitivo
          if (cell === null || cell === undefined) return "";
          if (typeof cell === 'object') return String(cell);
          return cell;
        });
        sheet.addRow(cleanedRow);
      }

      // Applica stili al titolo Istanta 2 GDO Suite (riga 1)
      const titleRowExcel = sheet.getRow(1);
      titleRowExcel.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber === 1) {
          const titleStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, size: 16, color: { argb: `FF${fidelityColors.white}` } },
            alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fidelityColors.primary}` } },
            border: {
              top: { style: 'medium' },
              left: { style: 'medium' },
              bottom: { style: 'medium' },
              right: { style: 'medium' }
            }
          };
          cell.style = titleStyle;
        } else {
          // Estendi il colore di sfondo del titolo su tutte le colonne
          cell.style = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fidelityColors.primary}` } },
            border: {
              top: { style: 'medium' },
              bottom: { style: 'medium' },
              right: colNumber === headerRow.length ? { style: 'medium' } : { style: 'thin' }
            }
          };
        }
      });

      // Unisci le celle del titolo
      sheet.mergeCells(1, 1, 1, headerRow.length);

      // Applica stili all'intestazione (riga 3)
      const headerRowExcel = sheet.getRow(3);
      headerRowExcel.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // Crea un nuovo oggetto stile per ogni cella per evitare condivisione
        const cellStyle: Partial<ExcelJS.Style> = {
          font: { bold: true, color: { argb: `FF${fidelityColors.white}` } },
          alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
          border: {
            top: { style: 'medium' },
            left: { style: 'medium' },
            bottom: { style: 'medium' },
            right: { style: 'medium' }
          }
        };

        if (colNumber === 1) {
          // Prima colonna con colore primario Istanta 2 GDO Suite
          cellStyle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fidelityColors.secondary}` } };
          cellStyle.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        } else {
          // Colonne combo con colore basato sul canale
          const combo = excelData[2][colNumber - 1]; // Riga 2 nell'array (riga 3 nell'Excel)
          if (combo) {
            const comboCanaleCode = combo.split(' ')[0];
            const color = channelColorMap.get(comboCanaleCode) || fidelityColors.light;
            cellStyle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
          }
        }

        // Applica lo stile completo
        cell.style = cellStyle;
      });

      // Applica stili ai dati dei kit
      let currentRow = 4; // Inizia dalla quarta riga (dopo titolo, spacer e header)
      let kitColorIndex = 0;
      const kitBlockColors = [fidelityColors.white, fidelityColors.light];

      for (const kit of kitsToProcess) {
        const kitColor = kitBlockColors[kitColorIndex % kitBlockColors.length];
        const numFiles = (kit.files && kit.files.length > 0) ? kit.files.length : 1;

        // Riga titolo del kit con styling Istanta 2 GDO Suite
        const kitTitleRowExcel = sheet.getRow(currentRow);
        kitTitleRowExcel.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const cellStyle: Partial<ExcelJS.Style> = {
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
            border: {
              top: { style: 'medium' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            }
          };

          if (colNumber === 1) {
            // Prima colonna del titolo del kit
            cellStyle.font = { bold: true, color: { argb: `FF${fidelityColors.white}` } };
            cellStyle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fidelityColors.accent1}` } };
            cellStyle.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          } else {
            // Altre colonne del titolo del kit
            cellStyle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fidelityColors.accent1}` } };
          }

          cell.style = cellStyle;
        });

        // Imposta altezza dinamica per la riga del titolo del kit
        const kitTitleLength = kit.titolo.length;
        const estimatedHeight = Math.max(20, Math.min(60, kitTitleLength / 3)); // Altezza basata sulla lunghezza del titolo
        kitTitleRowExcel.height = estimatedHeight;

        currentRow++;

        // Righe dei file con alternanza di colori
        for (let i = 0; i < numFiles; i++) {
          const fileRowExcel = sheet.getRow(currentRow);
          let maxFileNameLength = 0;

          fileRowExcel.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const cellStyle: Partial<ExcelJS.Style> = {
              fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${kitColor}` } },
              alignment: {
                vertical: 'middle',
                horizontal: colNumber === 1 ? 'left' : 'center',
                wrapText: true
              },
              border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              }
            };

            // Evidenzia le celle con "1" (file presente)
            if (colNumber > 1 && cell.value === "1") {
              cellStyle.font = { bold: true, color: { argb: `FF${fidelityColors.primary}` } };
            }

            // Traccia la lunghezza del nome del file per calcolare l'altezza
            if (colNumber === 1 && cell.value) {
              maxFileNameLength = Math.max(maxFileNameLength, cell.value.toString().length);
            }

            cell.style = cellStyle;
          });

          // Imposta altezza dinamica per la riga del file
          const estimatedHeight = Math.max(18, Math.min(45, maxFileNameLength / 4)); // Altezza basata sulla lunghezza del nome file
          fileRowExcel.height = estimatedHeight;

          currentRow++;
        }

        kitColorIndex++;
      }

      // Aggiungi footer Istanta 2 GDO Suite
      const footerRow = currentRow + 1;
      const footerText = `Generato da Istanta 2 GDO Suite - Sistema di gestione promozioni e stampe - ${new Date().toLocaleString('it-IT')}`;
      sheet.getCell(footerRow, 1).value = footerText;
      sheet.mergeCells(footerRow, 1, footerRow, headerRow.length);

      const footerCellStyle: Partial<ExcelJS.Style> = {
        font: { italic: true, size: 10, color: { argb: `FF${fidelityColors.secondary}` } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fidelityColors.light}` } },
        border: {
          top: { style: 'thin' },
          left: { style: 'medium' },
          bottom: { style: 'medium' },
          right: { style: 'medium' }
        }
      };
      sheet.getCell(footerRow, 1).style = footerCellStyle;

      // Imposta altezze delle righe per migliore presentazione
      sheet.getRow(1).height = 35; // Titolo principale - maggiore per il branding
      sheet.getRow(2).height = 5;  // Riga spaziatore
      sheet.getRow(3).height = 30; // Header - maggiore per leggibilità dei combo
      sheet.getRow(footerRow).height = 25; // Footer - maggiore per il testo del branding

      // Congela i pannelli per mantenere visibile l'header durante lo scroll
      // xSplit: 1 = congela la prima colonna, ySplit: 3 = congela le prime 3 righe
      sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];

      // Genera il buffer Excel
      const buffer = await workbook.xlsx.writeBuffer();

      /* --------------------------------------------------------------------------------------- */

      emitToClients(`${socketId}_progress`, {
        fase: "creazione_excel",
        completato: true,
        message: "Report Excel completato"
      } as EmitProgressParams);

      const totalKit = kitsToProcess.length;
      const totalFiles = kitsToProcess.map(k => k.files ?? []).flat().length;

      // Verifica se tutti i kit sono stati inviati, anche in momenti differenti
      const promoKit = await this.kitRuntimeService.getAllKitRuntimeByIdPromo(idPromo);
      const contrattoTipografiaConfig = await this.getContrattoTipografia();
      let kitFiltered = await Promise.all(promoKit.map(async (kit: any) => {
        const tipiExportKit = kit.tipi_di_export_in_kit;
        const tipiExportContratto = contrattoTipografiaConfig?.tipi_export;
        const tipiExportKitNonPresenti = tipiExportKit.filter((tipoExport: any) =>
          !tipiExportContratto?.includes(tipoExport.tipo_di_export_guid_id)
        );
        return tipiExportKitNonPresenti.length > 0 ? null : kit;
      }));
      kitFiltered = kitFiltered.filter(kit => kit !== null);
      const allKitSent = ((previouslySentKitIds?.length ?? 0) + kitsToProcess.length) === kitFiltered.length;

      // Aggiorna stato dell'ordine
      await OrdiniDiStampa.update(
        {
          stato_ordinistampa: allKitSent ? STATO_ORDINI_STAMPA.FINITO : STATO_ORDINI_STAMPA.IN_REVISIONE,
        },
        {
          where: {
            id_ordinistampa: idOrdineDiStampa
          }
        }
      );

      // Crea record invio
      // IMPORTANTE: Salva il buffer direttamente come Buffer, non come Uint8Array
      // per evitare problemi di conversione durante il recupero
      await OrdiniDiStampaInvii.create({
        idutente_ordinistampainvii: req.session.id_utente as string,
        idordinestampa_ordinistampainvii: idOrdineDiStampa,
        excel_ordinistampainvii: Buffer.from(buffer),
        report_ordinistampainvii: {
          total_files: totalFiles,
          total_kit: totalKit,
          file_problematici: fileProblematici(kitsToProcess),
          kit_guids: kitsToProcess.map(k => k.id)
        },
        segnalazione_ordinistampainvii: "",
        id_ordinistampainvii: uuidv4(),
        createdat: new Date(),
        updatedat: new Date()
      });

      // Crea attività
      await ServerUtils.CREA_ATTIVITA(
        req.session.id_utente as string,
        TIPO_ATTIVITA.INVIO_FILES_FTP,
        CATEGORIA_ATTIVITA.PUBBLICAZIONE,
        {
          id_promo: idPromo,
          file_totali: totalFiles,
          kit_totali: totalKit
        }
      );

      // Emetti successo
      emitToClients(`${socketId}_complete`, {
        esito: true,
        message: "Processo FTP completato con successo",
        totalFiles,
        totalKit
      } as EmitCompleteParams);

    } catch (error: any) {
      console.error('Errore in processFTPPopOlimpo:', error);
      emitToClients(`${socketId}_error`, {
        error: error.message || "Errore sconosciuto durante il processo FTP",
        esito: false
      } as EmitErrorParams);
    }
  }

  async getAllOrdiniDiStampaFiniti(): Promise<(OrdiniDiStampaResponseDTO & { nomePromo: string })[]> {
    try {
      // Query ottimizzata con JOIN per recuperare ordini finiti + promo
      const ordini = await OrdiniDiStampa.findAll({
        where: {
          stato_ordinistampa: STATO_ORDINI_STAMPA.FINITO
        },
        include: [{
          model: Promo,
          as: 'promo',
          attributes: ['nome_promo'], // Seleziona solo il campo necessario
          required: false // LEFT JOIN (include ordini anche senza promo)
        }],
        order: [['createdat', 'DESC']]
      });

      // Mappa ai DTO
      const mappedDTO: (OrdiniDiStampaResponseDTO & { nomePromo: string })[] = ordini.map(ordine => ({
        id: ordine.id_ordinistampa!,
        id_utente: ordine.idutente_ordinistampa!,
        id_promo: ordine.id_promo_ordinistampa!,
        stato: ordine.stato_ordinistampa!,
        data_di_conferma: ordine.data_di_conferma_ordinistampa!,
        createdat: ordine.createdat,
        updatedat: ordine.updatedat,
        nomePromo: (ordine as any).promo?.nome_promo || ''
      }));

      return mappedDTO;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero degli ordini finiti:'), error);
      throw wrapDatabaseError(new Error("Errore durante il recupero degli ordini finiti"), {
        message: "Errore durante il recupero degli ordini finiti",
        operation: 'findAll',
        entity: 'OrdiniDiStampa',
        details: { error }
      });
    }
  }

  async creaOrdineDiStampa(data: OrdiniDiStampaAttributes): Promise<any> {
    try {
      const result = await OrdiniDiStampa.create(data);
      return result;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante la creazione dell\'ordine di stampa:'), error);
      throw wrapDatabaseError(new Error("Errore durante la creazione dell'ordine di stampa"), {
        message: "Errore durante la creazione dell'ordine di stampa",
        operation: 'create',
        entity: 'OrdiniDiStampa',
        details: { data },
      });
    }
  }

  async getPromoDaIdStampa(id: string): Promise<PromoResponseDTO> {
    try {
      const ordine = await OrdiniDiStampa.findByPk(id);
      if (!ordine) {
        throw new NotFoundError({
          message: "Ordine non trovato",
          entityType: 'OrdiniDiStampa',
          entityId: id
        });
      }
      const promo = await Promo.findOne({
        where: {
          id_promo: ordine.id_promo_ordinistampa
        }
      });
      if (!promo) {
        throw new NotFoundError({
          message: "Promo non trovata",
          entityType: 'Promo',
          entityId: ordine.id_promo_ordinistampa
        });
      }
      const promoData: PromoResponseDTO = {
        id: promo.id_promo,
        nome: promo.nome_promo,
        data_registrazione: promo.data_registrazione,
        validita_dal: promo.validita_dal,
        validita_al: promo.validita_al,
        data_scadenza: promo.data_scadenza ? dayjs(promo.data_scadenza).toDate() : dayjs(promo.validita_al).toDate(),
        offset_visibilita: promo.offset_visibilita,
        stato: promo.stato,
        context: promo.context as any,
        gdo: promo.gdo,
      };
      return promoData;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero della promo:'), error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante il recupero della promo"), {
        message: "Errore durante il recupero della promo",
        operation: 'findByPk',
        entity: 'OrdiniDiStampa',
        details: { id },
      });
    }
  }

  async getContrattoTipografia(): Promise<ContrattoTipografiaResponseDTO> {
    try {
      // Prendo solo il primo record, dato che ce n'è sempre solo uno
      const contratto = await ContrattoTipografia.findAll();
      if (!contratto || contratto.length === 0) {
        throw new NotFoundError({
          message: "Contratto tipografia non trovato",
          entityType: 'ContrattoTipografia',
          entityId: "0"
        });
      }
      const objContratto = contratto[0] as ContrattoTipografiaAttributes
      const objContrattoDTO: ContrattoTipografiaResponseDTO & { contratto: RootFileTree } = {
        id: objContratto.id_contrattotipografia as string,
        nome: objContratto.nome_contrattotipografia,
        tipi_export: objContratto.tipiexport_contrattotipografia,
        id_gdo: objContratto.id_gdo_contrattotipografia as string,
        contratto: objContratto.json_contrattotipografia,
        host_ftp: decryptOrRaw(objContratto.host_ftp_contrattotipografia),
        user_ftp: decryptOrRaw(objContratto.user_ftp_contrattotipografia),
        pwd_ftp: decryptOrRaw(objContratto.pwd_ftp_contrattotipografia),
        port_ftp: objContratto.port_ftp_contrattotipografia ?? undefined,
        createdat: objContratto.createdat,
        updatedat: objContratto.updatedat
      }
      return objContrattoDTO;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero del contratto tipografia:'), error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante il recupero del contratto tipografia"), {
        message: "Errore durante il recupero del contratto tipografia",
        operation: 'findOne',
        entity: 'ContrattoTipografia',
      });
    }
  }

  async getFileFromOlimpo(id: string): Promise<Buffer> {
    try {
      const url = `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${id}`;
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data, "binary");
    } catch (error: any) {
      if (error instanceof Error) {
        console.error(Colorize.bgRed('Errore durante il recupero del file da Olimpo:'), error.message);
        throw wrapDatabaseError(new Error("Errore durante il recupero del file"), {
          message: "Errore durante il recupero del file",
          operation: 'get',
          entity: 'OlimpoAPI',
          details: { id },
        });
      } else {
        console.error(Colorize.bgRed('Errore sconosciuto durante il recupero del file da Olimpo:'), error);
        throw wrapDatabaseError(new Error("Errore sconosciuto durante il recupero del file"), {
          message: "Errore sconosciuto durante il recupero del file",
          operation: 'get',
          entity: 'OlimpoAPI',
          details: { id, error },
        });
      }
    }
  }

  async getOrdineDiStampaById(idOrdineDiStampa: string): Promise<any> {
    try {
      const ordine = await OrdiniDiStampa.findByPk(idOrdineDiStampa);
      if (!ordine) {
        throw new NotFoundError({
          message: "Ordine non trovato",
          entityType: 'OrdiniDiStampa',
          entityId: idOrdineDiStampa
        });
      }
      return ordine;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero dell\'ordine:'), error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante il recupero dell'ordine"), {
        message: "Errore durante il recupero dell'ordine",
        operation: 'findByPk',
        entity: 'OrdiniDiStampa',
        details: { idOrdineDiStampa },
      });
    }
  }

  async getOrdiniInviiByOrdineStampa(idOrdineDiStampa: string): Promise<any> {
    try {
      const ordine = await OrdiniDiStampaInvii.findAll({
        where: {
          idordinestampa_ordinistampainvii: idOrdineDiStampa
        }
      });
      if (!ordine) {
        throw new NotFoundError({
          message: "Ordine non trovato",
          entityType: 'OrdiniDiStampa',
          entityId: idOrdineDiStampa
        });
      }
      return ordine;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero degli invii:'), error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante il recupero degli invii"), {
        message: "Errore durante il recupero degli invii",
        operation: 'findByPk',
        entity: 'OrdiniDiStampa',
        details: { idOrdineDiStampa },
      });
    }
  }

  async getExcelReportBuffer(idInvio: string): Promise<Buffer | null> {
    try {
      const invio = await OrdiniDiStampaInvii.findByPk(idInvio, {
        attributes: ['excel_ordinistampainvii']
      });

      if (!invio || !invio.excel_ordinistampainvii) {
        return null;
      }

      // Se excel_ordinistampainvii è già un Buffer, restituiscilo direttamente
      if (Buffer.isBuffer(invio.excel_ordinistampainvii)) {
        return invio.excel_ordinistampainvii;
      }

      // Se è una stringa base64, convertila in Buffer
      if (typeof invio.excel_ordinistampainvii === 'string') {
        return Buffer.from(invio.excel_ordinistampainvii, 'base64');
      }

      return null;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero del report Excel:'), error);
      throw wrapDatabaseError(new Error("Errore durante il recupero del report Excel"), {
        message: "Errore durante il recupero del report Excel",
        operation: 'findByPk',
        entity: 'OrdiniDiStampaInvii',
        details: { idInvio },
      });
    }
  }

  async groupFilesByEquality(params: {
    req: Request;
    idOrdineDiStampa: string;
    socketId: string;
  }): Promise<void> {
    const { req, idOrdineDiStampa, socketId } = params;

    // Track job state
    this.groupingJobs.set(idOrdineDiStampa, {
      socketId,
      status: 'running',
      startedAt: Date.now()
    });

    try {
      const ordine = await this.getOrdineById(idOrdineDiStampa);
      const contratto = await this.getContrattoTipografia();

      const kitRuntimePromo = await this.kitRuntimeService.getAllKitRuntimeByIdPromo(ordine.id_promo_ordinistampa) as any[];
      const kitPubblicatiCompatibili = kitRuntimePromo
        .filter((kit) => kit.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO)
        .filter((kit) => {
          const tipiExportKit = kit.tipi_di_export_in_kit || [];
          const tipiExportContratto = contratto?.tipi_export || [];
          const tipiCompatibili = tipiExportKit.filter((tipoExport: any) =>
            tipiExportContratto.includes(tipoExport.tipo_di_export_guid_id)
          );
          return tipiCompatibili.length > 0;
        });

      const previousInvii = await OrdiniDiStampaInvii.findAll({
        where: { idordinestampa_ordinistampainvii: idOrdineDiStampa }
      });

      const previouslySentKitIds = previousInvii
        .map((invio) => invio.report_ordinistampainvii?.kit_guids || [])
        .flat();

      const kitDisponibili = kitPubblicatiCompatibili.filter((kit) => !previouslySentKitIds.includes(kit.id));

      if (kitDisponibili.length === 0) {
        const emptyResult = { totalFiles: 0, analyzedFiles: 0, groupCount: 0, groups: [] as any[], unmatchedIds: [] as string[] };
        const job = this.groupingJobs.get(idOrdineDiStampa);
        if (job) { job.status = 'completed'; job.result = emptyResult; }
        emitToClients(`${socketId}_result`, emptyResult);
        return;
      }

      const kitIds = kitDisponibili.map((kit) => kit.id);
      const allFiles = await FilesRuntime.findAll({
        where: { id_runtime: { [Op.in]: kitIds } },
        raw: true
      }) as unknown as FileItemKit[];

      const validFiles = (allFiles as any[]).filter((file) => !!file.id_olimpo_cloud);
      const idsForOlympus = validFiles
        .map((file) => file.id_olimpo_cloud)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      if (idsForOlympus.length === 0) {
        const emptyResult = { totalFiles: 0, analyzedFiles: 0, groupCount: 0, groups: [] as any[], unmatchedIds: [] as string[] };
        const job = this.groupingJobs.get(idOrdineDiStampa);
        if (job) { job.status = 'completed'; job.result = emptyResult; }
        emitToClients(`${socketId}_result`, emptyResult);
        return;
      }

      const olympusResponse = await ServerUtils.sendToFICOApi<{
        esito: boolean;
        groups?: Array<{ groupId?: string; ids: string[] }>;
        unmatchedIds?: string[];
        nonPdfIds?: string[];
        error?: string;
      }>(
        req as Request,
        config.OLYMPUS_IP_ADDRESS + "/materiali/groupPDFsByEquality",
        "POST",
        { ids: idsForOlympus, socketId }
      );

      if (!olympusResponse.data?.esito) {
        throw new ExternalApiError({
          message: olympusResponse.data?.error || 'Olimpo ha restituito un errore durante il raggruppamento',
          service: 'Olympus',
          endpoint: '/materiali/groupPDFsByEquality',
        });
      }

      // Map OLYMPUS IDs back to file names and kit names
      const kitMap = new Map<string, any>();
      kitDisponibili.forEach((kit) => kitMap.set(kit.id, kit));

      const fileMap = new Map<string, any>();
      (validFiles as any[]).forEach((file) => {
        if (file.id_olimpo_cloud) {
          fileMap.set(file.id_olimpo_cloud, file);
        }
      });

      const groups = (olympusResponse.data.groups || []).map((group, index) => {
        const mappedFiles = group.ids
          .map((idOlimpo) => {
            const file = fileMap.get(idOlimpo);
            if (!file) return null;
            const kit = file.id_runtime ? kitMap.get(file.id_runtime) : null;
            return {
              id_olimpo_cloud: idOlimpo,
              nome: file.nome,
              id_runtime: file.id_runtime || '',
              nome_kit: kit?.titolo || '',
              tipo_export: file.tipo_export_codice || file.tipo_export,
              pages: file.pages
            };
          })
          .filter((file): file is NonNullable<typeof file> => !!file);

        return {
          groupId: group.groupId || `group-${index + 1}`,
          size: mappedFiles.length,
          files: mappedFiles
        };
      });

      const resultData = {
        totalFiles: idsForOlympus.length,
        analyzedFiles: idsForOlympus.length,
        groupCount: groups.length,
        groups,
        unmatchedIds: olympusResponse.data.unmatchedIds || []
      };

      // Store completed state
      const job = this.groupingJobs.get(idOrdineDiStampa);
      if (job) {
        job.status = 'completed';
        job.result = resultData;
      }

      emitToClients(`${socketId}_result`, resultData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto durante il raggruppamento';
      console.error(Colorize.bgRed(`[groupFilesByEquality] ${message}`));

      // Store failed state
      const job = this.groupingJobs.get(idOrdineDiStampa);
      if (job) {
        job.status = 'failed';
        job.error = message;
      }

      emitToClients(`${socketId}_error`, {
        error: message,
        esito: false
      });
    }
  }

  async getVirtualDirectories(params: {
    req: Request;
    idOrdineDiStampa: string;
  }): Promise<VirtualDirectory[]> {
    const { req, idOrdineDiStampa } = params;
    if (this.virtualDir.get(idOrdineDiStampa) != undefined) {
      return this.virtualDir.get(idOrdineDiStampa);
    }
    // Recupero ordine
    const ordine = await this.getOrdineById(idOrdineDiStampa);
    if (!ordine) {
      throw new NotFoundError({
        message: "Ordine non trovato",
        entityType: 'OrdiniDiStampa',
        entityId: idOrdineDiStampa
      });
    }

    const idPromo = ordine.id_promo_ordinistampa;

    // Recupero GDO
    const gdo = (await GDO.findAll())[0];
    if (!gdo) {
      throw new NotFoundError({
        message: "GDO non trovata",
        entityType: 'GDO',
      });
    }

    // Recupero contratto tipografia (raw, come processFTPPopOlimpo)
    const contrattoData = await ContrattoTipografia.findAll({
      where: { id_gdo_contrattotipografia: gdo.id_gdo }
    });
    if (!contrattoData || contrattoData.length === 0) {
      throw new NotFoundError({
        message: "Contratto tipografia non trovato",
        entityType: 'ContrattoTipografia',
        entityId: '0'
      });
    }


    const contratto = contrattoData[0].dataValues.json_contrattotipografia as RootFileTree;

    // Recupero kit pubblicati compatibili con il contratto
    const contrattoDTO = await this.getContrattoTipografia();
    const kitRuntimePromo = await this.kitRuntimeService.getAllKitRuntimeByIdPromo(idPromo) as any[];
    const kitPubblicatiCompatibili = kitRuntimePromo
      .filter((kit) => kit.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO)
      .filter((kit) => {
        const tipiExportKit = kit.tipi_di_export_in_kit || [];
        const tipiExportContratto = contrattoDTO?.tipi_export || [];
        const tipiCompatibili = tipiExportKit.filter((tipoExport: any) =>
          tipiExportContratto.includes(tipoExport.tipo_di_export_guid_id)
        );
        return tipiCompatibili.length > 0;
      });

    // Recupero file per ogni kit (come processFTPPopOlimpo)
    await Promise.all(kitPubblicatiCompatibili.map(async (kit) => {
      kit.files = await FilesRuntime.findAll({
        where: { id_runtime: kit.id },
        raw: true
      }) as unknown as FileItemKit[];
    }));

    // Filtra kit già inviati
    const previousInvii = await OrdiniDiStampaInvii.findAll({
      where: { idordinestampa_ordinistampainvii: idOrdineDiStampa }
    });
    const previouslySentKitIds = previousInvii
      .map((invio) => invio.report_ordinistampainvii?.kit_guids || [])
      .flat();
    const kitDisponibili = kitPubblicatiCompatibili.filter((kit) => !previouslySentKitIds.includes(kit.id));

    // Recupero aree e canali, imposta codiceArea/codiceCanale (come processFTPPopOlimpo)
    const all_aree = await Area.findAll({ where: { id_gdo_aree: gdo.id_gdo } });
    const all_canali = await Canale.findAll({ where: { id_gdo_canali: gdo.id_gdo } });
    const canaliDTO: CanaleResponseDTO[] = all_canali.map(canale => ({
      id: canale.id_canali,
      codice: canale.codice_canali,
      nome: canale.nome_canali,
      id_gdo: canale.id_gdo_canali,
      updatedat: canale.updatedat
    }));

    const areeDTO: AreaResponseDTO[] = all_aree.map(area => ({
      id: area.id_aree,
      codice: area.codice_aree,
      nome: area.nome_aree,
      id_gdo: area.id_gdo_aree,
      updatedat: area.updatedat
    }));
    // Recupero promo
    const promo = await Promo.findOne({
      where: { id_promo: idPromo }
    });
    if (!promo) {
      throw new NotFoundError({
        message: "Promo non trovata",
        entityType: 'Promo',
        entityId: idPromo
      });
    }

    // Imposta codiceArea/codiceCanale e processa contratto per ogni kit (come processFTPPopOlimpo)
    for (const kit of kitDisponibili) {
      const foundArea = all_aree.find(a => a.id_aree === kit.id_area);
      const foundCanale = all_canali.find(c => c.id_canali === kit.id_canale);
      kit.codiceArea = foundArea?.codice_aree || "";
      kit.codiceCanale = foundCanale?.codice_canali || "";

      const contattoNonElaborato = structuredClone(contratto) as RootFileTree;
      const contrattoElaborato = await processaContrattoTipografiaGDO(
        contattoNonElaborato,
        { canali: canaliDTO, aree: areeDTO, promo: promo, kit }
      );
      (kit as any).contrattoElaborato = contrattoElaborato;
    }

    const resultAPI = await ServerUtils.sendToFICOApi<{
      esito: boolean;
      directories?: VirtualDirectory[];
      error?: string;
    }>(
      req as Request,
      config.OLYMPUS_IP_ADDRESS + "/ftp/getVirtualDirectories",
      "POST",
      {
        kits: kitDisponibili
      }
    );

    if (!resultAPI.data?.esito) {
      throw new ExternalApiError({
        message: resultAPI.data?.error || 'Errore durante il recupero delle directory virtuali da Olympus',
        service: 'Olympus',
        endpoint: '/ftp/getVirtualDirectories',
      });
    }

    this.virtualDir.set(idOrdineDiStampa, resultAPI.data.directories ?? [])
    return resultAPI.data.directories ?? [];

  }

  async mergeGroupFiles(params: {
    idOrdineDiStampa: string;
    groupId: string;
    nome: string;
    virtualDir: string;
    files: Array<{
      id_olimpo_cloud: string;
      nome: string;
      id_runtime: string;
      nome_kit: string;
      tipo_export: string;
      pages?: number;
      meta_olimpo_cloud?: any;
    }>;
  }): Promise<any> {
    const { idOrdineDiStampa, groupId, nome, virtualDir, files } = params;

    if (!files || files.length === 0) {
      throw new BadRequestError({
        message: 'Nessun file specificato per il merge',
        details: { field: 'files' },
      });
    }

    const ordine = await this.getOrdineById(idOrdineDiStampa);
    if (!ordine) {
      throw new NotFoundError({
        message: "Ordine non trovato",
        entityType: 'OrdiniDiStampa',
        entityId: idOrdineDiStampa
      });
    }

    // Idempotency check: return existing merged doc if already merged
    const existingByGroupId = await FilesRuntime.findOne({
      where: {
        id_ordine_stampa: idOrdineDiStampa,
        is_merged_group: true,
        merged_group_id: groupId
      },
      raw: true
    });
    if (existingByGroupId) return existingByGroupId;

    // Fallback: check by set of file IDs (handles groupId instability across runs)
    const sortedFileIds = files.map(f => f.id_olimpo_cloud).sort();
    const existingByFiles = await FilesRuntime.findOne({
      where: {
        id_ordine_stampa: idOrdineDiStampa,
        is_merged_group: true,
        merged_file_ids: { [Op.contains]: sortedFileIds } as any
      },
      raw: true
    });
    if (existingByFiles) return existingByFiles;

    const representativeFile = files[0];
    const mergedFileId = uuidv4();

    const mergedDoc = await FilesRuntime.create({
      id: mergedFileId,
      nome: nome.trim() || `merged-${groupId}`,
      nome_originale: representativeFile.nome,
      id_runtime: representativeFile.id_runtime,
      id_olimpo_cloud: representativeFile.id_olimpo_cloud,
      tipo_export: representativeFile.tipo_export,
      pages: representativeFile.pages,
      meta_olimpo_cloud: representativeFile.meta_olimpo_cloud,
      is_merged_group: true,
      merged_group_id: groupId,
      merged_file_ids: files.map(f => f.id_olimpo_cloud),
      virtual_dir: virtualDir,
      id_ordine_stampa: idOrdineDiStampa
    } as any);

    return mergedDoc;
  }

  async getMergedFilesByOrdine(idOrdineDiStampa: string): Promise<MergedGroupFile[]> {
    const mergedDocs = await FilesRuntime.findAll({
      where: {
        id_ordine_stampa: idOrdineDiStampa,
        is_merged_group: true
      },
      raw: true
    });

    return mergedDocs as unknown as MergedGroupFile[];
  }

  async deleteMergedGroup(params: {
    idOrdineDiStampa: string;
    mergedFileId: string;
  }): Promise<boolean> {
    const { idOrdineDiStampa, mergedFileId } = params;

    const result = await FilesRuntime.destroy({
      where: {
        id: mergedFileId,
        id_ordine_stampa: idOrdineDiStampa,
        is_merged_group: true
      }
    });

    if (result === 0) {
      throw new NotFoundError({
        message: 'Merge group non trovato',
        entityType: 'FilesRuntime',
        entityId: mergedFileId
      });
    }

    return true;
  }
}
/**
 * Trasforma il valore di condition.value in base a field.
 */
function convertConditionValue(
  condition: FileTreeCondition,
  data: {
    canali: CanaleResponseDTO[];
    aree: AreaResponseDTO[];
    promo: PromoAttributes;
    kit: RUNTIME_KIT_MONGO;
  }
): string {
  switch (condition.field) {
    case "canale": {
      const found = data.canali.find(canale => canale.id === condition.value);
      return found ? found.codice : condition.value;
    }
    case "area": {
      const found = data.aree.find(area => area.id === condition.value);
      return found ? found.codice : condition.value;
    }
    case "promo": {
      return data.promo.id_promo === condition.value ? data.promo.nome_promo : condition.value;
    }
    default:
      return condition.value;
  }
}

/**
 * Sostituisce i placeholder speciali in dirname.
 */
function replaceDirnamePlaceholders(
  dirname: string,
  data: {
    canali: CanaleResponseDTO[];
    aree: AreaResponseDTO[];
    promo: PromoAttributes;
    kit: RUNTIME_KIT_MONGO;
  }
): string {
  switch (dirname) {
    case "{{promo}}":
      return data.promo.nome_promo;
    case "{{canale}}":
      return data.canali.find(c => c.id === data.kit.guidCanale)?.codice || "";
    case "{{area}}":
      return data.aree.find(a => a.id === data.kit.guidArea)?.codice || "";
    default:
      return dirname;
  }
}

/**
 * Funzione ricorsiva per processare un nodo e tutti i suoi figli.
 */
async function processSingleNode(
  node: FileTreeNode,
  data: {
    canali: CanaleResponseDTO[];
    aree: AreaResponseDTO[];
    promo: PromoAttributes;
    kit: RUNTIME_KIT_MONGO;
  }
): Promise<FileTreeNode> {
  if (node.conditions && node.conditions.length > 0) {
    node.conditions = await Promise.all(
      node.conditions.map(async condition => {
        condition.value = convertConditionValue(condition, data);
        return condition;
      })
    );
  }

  if (node.on_respect_condition?.dirname) {
    node.on_respect_condition.dirname = await Promise.all(
      node.on_respect_condition.dirname.map(async dir => replaceDirnamePlaceholders(dir, data))
    );
  }

  if (node.on_error?.dirname) {
    node.on_error.dirname = await Promise.all(
      node.on_error.dirname.map(async dir => replaceDirnamePlaceholders(dir, data))
    );
  }

  if (node.fallback?.dirname) {
    node.fallback.dirname = replaceDirnamePlaceholders(node.fallback.dirname, data);
  }

  if (node.filetree && node.filetree.length > 0) {
    for (let i = 0; i < node.filetree.length; i++) {
      node.filetree[i] = await processSingleNode(node.filetree[i], data);
    }
  }

  return node;
}

/**
 * Processa l'intera struttura RootFileTree (DFS).
 */
export const processaContrattoTipografiaGDO = async (
  contratto: RootFileTree,
  data: {
    canali: CanaleResponseDTO[];
    aree: AreaResponseDTO[];
    promo: PromoAttributes;
    kit: RUNTIME_KIT_MONGO;
  }
): Promise<RootFileTree> => {
  try {
    const processedNodes = await Promise.all(
      contratto.root_file_tree.map(node => processSingleNode(node, data))
    );
    contratto.root_file_tree = processedNodes;
    return contratto;
  } catch (error) {
    throw error;
  }
};
