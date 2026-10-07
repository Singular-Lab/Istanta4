import dayjs from "dayjs";
import type { Request } from "express";
import { ExternalApiError } from "../../../../lib/errors/index.js";
import type { DataFields } from "../../../../lib/types.js";
import config from "../../config/index.js";
import { ServerUtils } from "../../utils/ServerUtils";
import type { EsitoConfrontoStorico, PayloadConfrontoStorico, PluginPayloadRef, StoricoVolantinoAgenzia, SyncJsonPluginRef } from "../types.js";

/**
 * Referenza di lista restituita da DB1 (classe C# DB1XmlRecord).
 * Stesso identico record per orfanelli e fantasmi: cambia solo il motivo per cui
 * viene segnalato. `codice_scatto` è la chiave del gruppo, cioè dice quali
 * referenze dovrebbero stare nello stesso gruppo del volantino.
 * I campi restano opzionali perché arrivano da un confine JSON esterno.
 */
export type DB1XmlRecord = {
  codice?: string;
  ean?: string;
  codice_scatto?: string;
  codice_referenza_gruppo?: string;

  descrizione1?: string;
  descrizione2?: string;
  descrizione3?: string;
  descrizione4?: string;
  um?: string;
  peso?: number;

  /** DateTime serializzata da .NET. */
  data_da?: string;
  data_a?: string;

  meccanica?: string;
  sez_data?: string;
  nome_foto?: string;
  settore?: number;
  reparto?: number;
  gruppo_settori?: string;
  sigla_reparto?: string;
  segmento?: string;
  sezione?: string;
  tipo_tema?: string;
  tema?: string;
  distintivita?: string;
  ruolo?: string;
  descr_regionale?: string;

  anziche?: number;
  anziche_kgl?: number;
  prezzo_base?: number;
  prezzo_base_KgL?: number;
  prezzo_offerta?: number;
  prezzo_offerta_kgl?: number;
  sconto_norm?: number;
  tipoS_norm?: string;
  sconto_fid?: number;
  tipoS_fid?: string;
  sconto_effettivo?: number;
  prezzo_offerta_etto?: number;
  prezzo?: number;
  paghi_2pezzi?: number;
  paghiSecondo?: number;
  N_MM?: number;
  M_MM?: number;
  N_fid?: number;
  M_fid?: number;

  range1?: string;
  punti1?: string;
  tipo_punti1?: string;
  range2?: string;
  punti2?: string;
  tipo_punti2?: string;

  nota_category?: string;
  quota?: number;
  note?: string;
  boll_ruolo?: string;
  boll_distintivita?: string;

  /** DB1 lo manda a true sui record che segnala. */
  orfanello?: boolean;
};

interface RisultatoUploadVolStorico {
  esito: boolean;
  error: string;
  lista: SyncJsonPluginRef[];
  /** Referenze in lista che non compaiono nell'export del plugin: record di lista. */
  orfanelli: DB1XmlRecord[];
  /** Box del volantino assenti dalla lista: DB1 rimanda indietro il ref inviato dal plugin. */
  fantasmi: SyncJsonPluginRef[];
}

const refKey = (ref: { groupId?: number | string; dna?: string }) =>
  `${ref.dna ?? ""}|${ref.groupId ?? ""}`;

/** Mantiene il guidId Olimpo anche se DB1 risponde con il vecchio formato foto[string]. */
export function mergePluginPhotoRefs(resultRefs: SyncJsonPluginRef[], sourceRefs: PluginPayloadRef[]): SyncJsonPluginRef[] {
  const sourcePhotos = new Map(sourceRefs.map((ref) => [refKey(ref), ref.foto ?? []]));
  return resultRefs.map((ref, index) => {
    const sourceRef = sourceRefs.find((candidate) =>
      refKey(candidate) === refKey(ref) ||
      (candidate.dna && ref.dna && candidate.dna === ref.dna)
    ) ?? sourceRefs[index];
    const source = sourceRef ? (sourcePhotos.get(refKey(sourceRef)) ?? sourceRef.foto ?? []) : undefined;
    const returned = Array.isArray(ref.foto) ? ref.foto : [];
    if (!source?.length) return { ...ref, foto: returned };
    if (!returned.length) {
      return {
        ...ref,
        foto: source.map((photo) => typeof photo === "string" ? { nome: photo } : photo),
      };
    }

    const byName = new Map(source.map((photo) => [
      typeof photo === "string" ? photo : photo.nome,
      typeof photo === "string" ? { nome: photo } : photo,
    ]));
    const foto = returned.map((photo) => {
      const normalized = typeof photo === "string" ? { nome: photo } : photo;
      return byName.get(normalized.nome)?.guidId
        ? { ...normalized, guidId: byName.get(normalized.nome)!.guidId }
        : normalized;
    });
    return { ...ref, foto };
  });
}

/**
 * Nomi FP dei campi del record DB1, quelli letti da flyerInsightsConfig.json.
 * `reparto`, `prezzo` e `meccanica` hanno gia lo stesso nome nei due mondi.
 */
const ALIAS_FP: Array<[keyof DB1XmlRecord, string]> = [
  ['codice', 'codice_referenza'],
  ['ean', 'ean_referenza'],
  ['codice_scatto', 'scatto_codice'],
  ['descrizione1', 'descrizione_uno'],
  ['descrizione2', 'descrizione_due'],
  ['descrizione3', 'descrizione_tre'],
  ['descrizione4', 'descrizione_quattro'],
  ['um', 'descrizione_unita_misura'],
  ['peso', 'descrizione_peso'],
  ['prezzo_offerta', 'prezzo'],
  ['anziche', 'prezzo_anziche'],
];

const euro = (valore: unknown) =>
  valore == null || valore === '' || !Number.isFinite(Number(valore)) ? undefined : `€ ${Number(valore).toFixed(2)}`;

const giorno = (valore?: string) => (valore && dayjs(valore).isValid() ? dayjs(valore).format('DD/MM/YYYY') : undefined);

/** Lo storico dei volantini di CONAD CNO passa da DB1. */
export const storicoVolantinoDB1: StoricoVolantinoAgenzia = {
  async confronta(req: Request, payload: PayloadConfrontoStorico): Promise<EsitoConfrontoStorico> {
    const risultato = await ServerUtils.sendToFICOApi<RisultatoUploadVolStorico>(
      req,
      config.DBUNO_URL + "/UploadVolStorico.ashx",
      "POST",
      payload
    );
    // sendToFICOApi non lancia sugli status non-ok: li incapsula in { data: null, status, statusText }.
    // Senza questo controllo un 500 di DB1 veniva letto come "nessun orfanello/fantasma" e il flusso
    // proseguiva a salvare referenze vuote sopra dati che in realta non sono mai arrivati.
    if (!risultato.data?.esito) {
      throw new ExternalApiError({
        message: risultato.data?.error || risultato.statusText || "Errore durante la comunicazione con DB1",
        service: 'DB1',
        endpoint: '/UploadVolStorico.ashx',
        statusCode: risultato.status
      });
    }
    return {
      lista: Array.isArray(risultato.data.lista) ? mergePluginPhotoRefs(risultato.data.lista, payload.refs) : [],
      nonImpaginate: Array.isArray(risultato.data.orfanelli) ? risultato.data.orfanelli : [],
      fuoriListino: Array.isArray(risultato.data.fantasmi) ? risultato.data.fantasmi : [],
    };
  },

  /** Senza questi una referenza non identifica niente e non si puo salvare. */
  campiObbligatoriFuoriListino: [
    { campo: 'codice', etichetta: 'Codice referenza' },
    { campo: 'descrizione1', etichetta: 'Descrizione 1' },
  ],

  /**
   * Il plugin compila il fuori listino coi nomi DB1: senza i nomi FP le schede del
   * kit non lo leggono (resta "N/D", senza codice ne prezzo). Si aggiungono gli
   * alias senza togliere i campi DB1 e senza sovrascrivere niente.
   */
  referenzaFuoriListino(record) {
    const dataFields: Record<string, unknown> = { ...record };
    for (const [campoDB1, campoFP] of ALIAS_FP) {
      const valore = record[campoDB1];
      if (dataFields[campoFP] === undefined && valore !== undefined && valore !== null && valore !== '') {
        dataFields[campoFP] = valore;
      }
    }
    return { dataFields: dataFields as DataFields, meccanica: String(record.meccanica ?? '') };
  },

  referenzaPerReport(record) {
    const db1 = record as DB1XmlRecord;
    const dal = giorno(db1.data_da);
    const al = giorno(db1.data_a);
    const campi: Array<[string, unknown]> = [
      ['EAN', db1.ean],
      ['Scatto', db1.codice_scatto],
      ['Reparto', db1.sigla_reparto ?? db1.reparto],
      ['Meccanica', db1.meccanica],
      // Stessa precedenza dell'alias FP `prezzo` in referenzaFuoriListino.
      ['Prezzo', euro(db1.prezzo ?? db1.prezzo_offerta)],
      ['Anziché', euro(db1.anziche)],
      ['Tema', db1.tema],
      ['Validità', dal && al ? `${dal} - ${al}` : dal ? `dal ${dal}` : al ? `fino al ${al}` : undefined],
    ];
    return {
      codice: String(db1.codice ?? ''),
      descrizione: [db1.descrizione1, db1.descrizione2, db1.descrizione3, db1.descrizione4]
        .map((parte) => String(parte ?? '').trim()).filter(Boolean).join(' '),
      campi: campi
        .filter(([, valore]) => valore != null && String(valore).trim() !== '')
        .map(([label, valore]) => ({ label, valore: String(valore) })),
    };
  },
};
