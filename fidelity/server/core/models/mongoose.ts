import { Document, Schema, Types } from 'mongoose';
import { EVENTI_WEBHOOK, STATO_LOG_FILE } from '../../../lib/enums';
import { ApprofondimentoVino, Config, DESIGN_KIT_MONGO, DataWebPliant, FileItemKit, FileItemKitLog, NOMI_MONGODB, RUNTIME_KIT_MONGO, RaccoglitoreKitMongo, ReferenzeIstanta, Ricette, STATO_RICETTA, TIPO_RICETTA } from '../../../lib/types';
import { MongoDBConnection } from '../db/MongoDBConnector';

// KitDesign Model
export interface IKitDesign extends Omit<DESIGN_KIT_MONGO, '_id'> {
  _id: DESIGN_KIT_MONGO['_id'];
}

const TipoDiExportInKitSchema: Schema = new Schema({
  tipoDiExportGuidID: { type: String, required: true },
  filtro: {
    type: [
      {
        titoloFiltro: { type: String, required: true },
        condizioni: [
          {
            nome_field: { type: String, required: true },
            operatore: { type: String, required: true },
            valore: { type: String, required: true },
            idAddestramento: { type: String, required: true },
          }
        ]
      }
    ],
    default: []
  },
  useWebhook: { type: Boolean, required: false },
  webhookEvents: { type: String, required: false, enum: Object.values(EVENTI_WEBHOOK) }
});

const FiltroSchema: Schema = new Schema({
  titoloFiltro: { type: String, required: true },
  condizioni: [
    {
      nome_field: { type: String, required: true },
      operatore: { type: String, required: true },
      valore: { type: String, required: true },
      idAddestramento: { type: String, required: true },
    }
  ]
});


const KitDesignSchema: Schema = new Schema(
  {
    guidId: { type: String, required: true },
    guidArea: { type: String, required: true },
    filtro: { type: Array, default: [] },
    guidCanale: { type: String, required: true },
    guidFormato: { type: String, required: true },
    tipiDiExportInKit: { type: [TipoDiExportInKitSchema], default: [] },
    quantitaCopie: { type: Number, required: true },
    titolo: { type: String, required: true },
    guidIdRaccoglitore: { type: String, required: true },
    stato: { type: String, required: true },
    declinazioni: { type: Array, default: [] },
    context: { type: Array, default: [] },
    tipo: { type: String, required: true },
    filtroContesto: {
      type: [
        {
          titoloFiltro: { type: String, required: true },
          condizioni: [
            {
              valore: { type: String, required: false, default: "" },
              schemaScelto: { type: String, required: false, default: "" },
              nome_field: { type: String, required: false, default: "" },
              operatore: { type: String, required: false, default: "" },
              colonna: { type: String, required: false, default: "" }
            }
          ]
        }
      ],
      required: true
    },
  }, { timestamps: true, strict: false }
);
KitDesignSchema.index({ guidId: 1 }, { unique: true });

export const KitDesignModel = await MongoDBConnection.model<IKitDesign>('KitDesign', KitDesignSchema, NOMI_MONGODB.combinazioni_design);

// RaccoglitoreKit Model
const RaccoglitoreKitSchema = new Schema<RaccoglitoreKitMongo>({
  guidId: { type: String, required: true },
  guidAree: { type: [String], required: true },
  guidCanali: { type: [String], required: true },
  guidFormato: { type: String, required: true },
  guidIdPv: { type: [String], required: false },
  titolo: { type: String, required: true },
  filtro: { type: [Schema.Types.Mixed as any], required: true },
  declinazioni: { type: [Schema.Types.Mixed as any], required: true },
  tipiDiExportInKit: { type: [Schema.Types.Mixed as any], required: true },
  quantita: { type: Number, required: true },
  tipo: { type: String, required: true },
  filtroContesto: {
    type: [
      {
        titoloFiltro: { type: String, required: true },
        condizioni: [
          {
            valore: { type: String, required: false, default: "" },
            schemaScelto: { type: String, required: false, default: "" },
            nome_field: { type: String, required: false, default: "" },
            operatore: { type: String, required: false, default: "" },
            colonna: { type: String, required: false, default: "" }
          }
        ]
      }
    ],
    required: true
  },
  files: {
    type: [{
      id: { type: String, required: true },
      nome: { type: String, required: true },
      direttive: { type: String, required: true },
      isOptional: { type: Boolean, required: true },
      nome_originale: { type: String, required: false },
      tipo_export: { type: String, required: false },
      id_runtime: { type: String, required: false }
    }],
    required: false,
    default: []
  }
}, { timestamps: true, strict: false });
RaccoglitoreKitSchema.index({ guidId: 1 }, { unique: true });
export const RaccoglitoreKitModel = await MongoDBConnection.model<RaccoglitoreKitMongo>("RaccoglitoreKit", RaccoglitoreKitSchema, NOMI_MONGODB.raccoglitori_kit);

// KitRunTime Model
export interface IKitRunTime extends Omit<RUNTIME_KIT_MONGO, "_id"> {
  _id: RUNTIME_KIT_MONGO['_id'];
}

const KitRunTimeSchema: Schema = new Schema(
  {
    guidId: { type: String, required: true },
    guidArea: { type: String, required: true },
    filtro: { type: [Schema.Types.Mixed as any], required: true },
    filtroContesto: {
      type: [
        {
          titoloFiltro: { type: String, required: true },
          condizioni: [
            {
              valore: { type: String, required: false, default: "" },
              schemaScelto: { type: String, required: false, default: "" },
              nome_field: { type: String, required: false, default: "" },
              operatore: { type: String, required: false, default: "" },
              colonna: { type: String, required: false, default: "" }
            }
          ]
        }
      ],
      required: true
    },
    guidIdDesign: { type: String, required: true },
    guidCanale: { type: String, required: true },
    guidFormato: { type: String, required: true },
    tipiDiExportInKit: { type: [TipoDiExportInKitSchema], default: [] },
    quantitaCopie: { type: Number, required: true },
    titolo: { type: String, required: true },
    guidIdRaccoglitore: { type: String, required: true },
    stato: { type: String, required: true },
    idPromo: { type: String, required: true },
    tipo: { type: String, required: true },
    nomeArea: { type: String, required: false },
    nomeCanale: { type: String, required: false },
    codiceArea: { type: String, required: false },
    codiceCanale: { type: String, required: false },
    promo: { type: Schema.Types.Mixed, required: false },
    webpliant: { type: [Schema.Types.Mixed], required: false },
    declinazioni: { type: [Schema.Types.Mixed], required: false },
    stato_lavorazione: { type: String, required: true },
    files: {
      type: [{
        id: { type: String, required: true },
        nome: { type: String, required: true },
        direttive: { type: String, required: true },
        isOptional: { type: Boolean, required: true },
        nome_originale: { type: String, required: false },
        tipo_export: { type: String, required: false },
        id_runtime: { type: String, required: false }
      }],
      required: false
    },
    inizioLavorazione: { type: Date, required: false },
    fineLavorazione: { type: Date, required: false },
    updatedAt: { type: Date, required: true },
    createdAt: { type: Date, required: true }
  },
  { timestamps: true, strict: false }
);
KitRunTimeSchema.index({ guidId: 1 }, { unique: true });
export const KitRunTimeModel = await MongoDBConnection.model<IKitRunTime>('KitRunTime', KitRunTimeSchema, NOMI_MONGODB.combinazioni_runtime);



// ReferenzeIstanta Model
export interface IReferenzeIstanta extends Omit<ReferenzeIstanta, '_id' | 'id'> {
  _id: ReferenzeIstanta['_id'];
}
const ReferenzeIstantaSchema: Schema = new Schema({
  compiledFields: [{
    paragraphName: { type: String, required: true },
    labelName: { type: String, required: true },
    content: { type: String, required: true }
  }],
  deletedFields: [{ type: String }],
  foto: [{ type: String }],
  meccanica: { type: String, required: true },
  codiceBox: { type: String, required: true },
  fotoExtra: [{
    guidId: { type: String, required: true },
    sigla: { type: String, required: true },
    tipo: { type: Number, required: true }
  }],
  dataFields: { type: Schema.Types.Mixed, required: true },
  groupElements: [{ type: Schema.Types.Mixed }],
  guidIdKitRuntime: { type: String, required: true },
  idPromo: { type: String, required: true },
  id: { type: String, required: true },
  // Campi posizione InDesign (nella root, non in un oggetto posizione)
  pag: { type: Number, required: false },
  x: { type: Number, required: false },
  y: { type: Number, required: false },
  w: { type: Number, required: false },
  h: { type: Number, required: false },
  wPage: { type: Number, required: false },
  hPage: { type: Number, required: false },
  percIngombro: { type: Number, required: false },
  aspectRatio: { type: Number, required: false }
}, { timestamps: true, strict: false });
ReferenzeIstantaSchema.index({ id: 1 }, { unique: true });
ReferenzeIstantaSchema.index({ "dataFields.codice_referenza": 1 });

export const ReferenzeIstantaModel = await MongoDBConnection.model<IReferenzeIstanta>('ReferenzeIstanta', ReferenzeIstantaSchema, NOMI_MONGODB.referenze_webpliant);

// DataWebPliant Model
export interface IDataWebPliant extends Document, Omit<DataWebPliant, '_id'> {
  _id: Types.ObjectId;
  isGlobal?: boolean;
  nomeArea?: string;
  nomeCanale?: string;
}

const SitemapTypeSchema: Schema = new Schema({
  id: { type: String, required: true },
  titolo: { type: String, required: true },
  pagine_collegate: [{
    id: { type: String, required: true },
    titolo: { type: String, required: true }
  }],
  link_esterno: { type: String, required: false },
  impostazioni_avanzate: {
    show: { type: Boolean, required: false },
    mostra_menu_laterale: { type: Boolean, required: false }
  }
}, { _id: false });
SitemapTypeSchema.index({ id: 1 }, { unique: true });
const PageLayoutItemSchema: Schema = new Schema({
  id: { type: String, required: true },
  parentId: { type: String, required: true },
  user_locked: {
    locked: { type: Boolean, required: true },
    user_id: { type: String, required: true }
  },
  type: { type: String, required: true },
  children: { type: [Schema.Types.Mixed], default: [] },
  content: { type: Schema.Types.Mixed, required: true },
  policy: { type: Schema.Types.Mixed, required: true },
  is_hybrid: { type: Boolean, required: false },
  keyframes: { type: [Schema.Types.Mixed], default: [] },
  alias: { type: String, required: false },
}, { _id: false });
PageLayoutItemSchema.index({ id: 1 }, { unique: true });
const PaginaWebPliantSchema: Schema = new Schema({
  id: { type: String, required: true },
  nome: { type: String, required: true },
  tipo: { type: String, required: true },
  struttura: { type: [PageLayoutItemSchema], default: [] },
  settings: {
    mostra_menu_laterale: { type: Boolean, required: false },
    policy: { type: Schema.Types.Mixed, required: false }
  }
}, { _id: false });
PaginaWebPliantSchema.index({ id: 1 }, { unique: true });
const DataWebPliantSchema: Schema = new Schema({
  webpliant: { type: [PaginaWebPliantSchema], default: [] },
  sitemap: { type: [SitemapTypeSchema], default: [] },
  idWorkspace: { type: String, required: true },
  idArea: { type: String, required: false },
  idCanale: { type: String, required: false },
  idGDO: { type: String, required: true },
  idPV: { type: String, required: false },
  nomeWorkspace: { type: String, required: false }
}, { timestamps: true, strict: false });
DataWebPliantSchema.index({ idWorkspace: 1 }, { unique: true });
export const WorkspaceDataWebPliantModel = await MongoDBConnection.model<IDataWebPliant>('WorkspaceDataWebPliantModel', DataWebPliantSchema, NOMI_MONGODB.workspaces_webpliant);


export interface IFilesRuntime extends Document, Omit<FileItemKit, 'id'> {
  _id: Types.ObjectId;
}

const FilesRuntimeSchema: Schema = new Schema({
  url: { type: String, required: false },
  id: { type: String, required: false },
  id_runtime: { type: String, required: false },
  direttive: { type: String, required: false },
  nome: { type: String, required: false },
  nome_originale: { type: String, required: false },
  isOptional: { type: Boolean, required: false },
  id_olimpo_cloud: { type: String, required: false },
  meta_olimpo_cloud: { type: Schema.Types.Mixed, required: false },
  tipo_export: { type: String, required: false },
  blob: { type: String, required: false },
  mime: { type: String, required: false },
  error: { type: String, required: false },
  pages: { type: Number, required: false },
  is_merged_group: { type: Boolean, required: false, default: false },
  merged_group_id: { type: String, required: false },
  merged_file_ids: { type: [String], required: false, default: [] },
  virtual_dir: { type: Schema.Types.Mixed, required: false },
  id_ordine_stampa: { type: String, required: false }
})
FilesRuntimeSchema.index({ id: 1 }, { unique: true });
FilesRuntimeSchema.index({ id_ordine_stampa: 1, is_merged_group: 1 });
export const FilesRuntimeModel = await MongoDBConnection.model<IFilesRuntime>('FilesRuntimeModel', FilesRuntimeSchema, NOMI_MONGODB.files_runtime);



// FotoGruppoReferenze Model
export interface IFotoGruppoReferenze extends Document {
  id: string;
  guidIdOlympo: string;
  codiceReferenza: string;
  idArea?: string;
  idCanale?: string;
}

const FotoGruppoReferenzeSchema: Schema = new Schema({
  id: { type: String, required: true },
  guidIdOlympo: { type: String, required: true },
  codiceReferenza: { type: String, required: true },
  idArea: { type: String, required: false },
  idCanale: { type: String, required: false }
}, { timestamps: true, strict: false });
FotoGruppoReferenzeSchema.index({ id: 1 }, { unique: true });
export const FotoGruppoReferenzeModel = await MongoDBConnection.model<IFotoGruppoReferenze>('FotoGruppoReferenze', FotoGruppoReferenzeSchema, NOMI_MONGODB.referenze_gruppo);




const ConfigWebpliantSchema: Schema = new Schema({
  css_text: { type: String, required: false },
  color_gdo: { type: String, required: false },
  guidId: { type: String, required: false },
  icona_pagina: { type: String, required: false },
  logo_header: [{
    url: { type: String, required: false },
    base64: { type: String, required: false },
    idCanale: { type: String, required: false },
    idArea: { type: String, required: false },
    idPv: { type: String, required: false }
  }],
  stili: [{
    id: { type: Number, required: false },
    nome_stile: { type: String, required: false },
    condizioni: { type: Schema.Types.Mixed, required: false },
    struttura: { type: Schema.Types.Mixed, required: false },
    azioni: [{
      nome: { type: String, required: false },
      campi: { type: Schema.Types.Mixed, required: false }
    }]
  }],
  stili_minimal: [{
    id: { type: Number, required: false },
    nome_stile: { type: String, required: false },
    condizioni: { type: Schema.Types.Mixed, required: false },
    struttura: { type: Schema.Types.Mixed, required: false },
    azioni: [{
      nome: { type: String, required: false },
      campi: { type: Schema.Types.Mixed, required: false }
    }]
  }],
  data_fields_refs: [{
    expected_input: { type: String, required: false },
    expected_output: { type: String, required: false }
  }],
  data_fields_files: [{ type: String, required: false }],
  meta_volantino: {
    title: { type: String, required: false },
    description: { type: String, required: false }
  },
}, { timestamps: true, strict: false })
ConfigWebpliantSchema.index({ guidId: 1 }, { unique: true });
export interface IConfig extends Config {
  _id: string;
}


// Schema riutilizzabile per i plugin della dashboard
const DashboardPluginSchema = {
  id: { type: String, required: false },
  name: { type: String, required: false },
  component: { type: String, required: false },
  props: { type: Schema.Types.Mixed, required: false },
  position: { type: String, required: false, enum: ['grid'] },
  order: { type: Number, required: false },
  layout: {
    i: { type: String, required: false },
    x: { type: Number, required: false },
    y: { type: Number, required: false },
    w: { type: Number, required: false },
    h: { type: Number, required: false },
    minW: { type: Number, required: false },
    minH: { type: Number, required: false },
    maxW: { type: Number, required: false },
    maxH: { type: Number, required: false },
    static: { type: Boolean, required: false },
    isDraggable: { type: Boolean, required: false },
    isResizable: { type: Boolean, required: false }
  },
  allowedRoles: [{ type: Schema.Types.Mixed, required: false }],
  isDraggable: { type: Boolean, required: false },
  isResizable: { type: Boolean, required: false },
  minW: { type: Number, required: false },
  minH: { type: Number, required: false },
  isDeletable: { type: Boolean, required: false },
  showPagination: { type: Boolean, required: false },
  showFilter: { type: Boolean, required: false },
  baseFilter: [{
    field: { type: String, required: true },
    operator: {
      type: String,
      required: true,
      enum: ['in', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'notContains', 'startsWith', 'endsWith']
    },
    value: { type: Schema.Types.Mixed, required: true }
  }]
};

// Schema riutilizzabile per una singola dashboard
const DashboardSchema = {
  version: { type: Number, required: false },
  lastUpdated: { type: Date, required: false },
  plugins: [DashboardPluginSchema]
};

const ConfigSchema: Schema = new Schema({
  webpliant: { type: ConfigWebpliantSchema, required: true },
  color: { type: String, required: false },
  // Dashboard legacy (backward compatibility)
  dashboard: DashboardSchema,
  // Nuova struttura: dashboard separate per ogni ruolo
  dashboardsByRole: {
    Superadmin: DashboardSchema,
    Agenzia: DashboardSchema,
    GDO: DashboardSchema,
    PuntoVendita: DashboardSchema,
    Guest: DashboardSchema
  }
}, { timestamps: true })


export interface IApprofondimentoVino extends Document, Omit<ApprofondimentoVino, 'id'> {
  id: string;
}

const ApprofondimentoVinoSchema: Schema = new Schema({
  id: { type: String, required: true },
  cantina: { type: String, required: true },
  nome: { type: String, required: true },
  codice: { type: String, required: true },
  anno: { type: Number, required: false },
  vino: { type: String, required: false },
  dataCreazione: { type: String, required: false },
  dataPubblicazione: { type: String, required: false },
  provenienza: { type: String, required: false },
  colore: { type: String, required: false },
  profumo: { type: String, required: false },
  gusto: { type: String, required: false },
  tasso_alcolico: { type: String, required: false },
  temperatura_di_servizio: { type: String, required: false },
  abbinamenti: { type: String, required: false },
  dettagli_cantina: { type: String, required: false }
}, { timestamps: true });
ApprofondimentoVinoSchema.index({ id: 1 }, { unique: true });
export const ApprofondimentoVinoModel = await MongoDBConnection.model<IApprofondimentoVino>('ApprofondimentoVino', ApprofondimentoVinoSchema, NOMI_MONGODB.approfondimento_vino);

export const ConfigModel = await MongoDBConnection.model<IConfig>('Config', ConfigSchema, NOMI_MONGODB.config);

// Ricette Model
export interface IRicette extends Document, Omit<Ricette, '_id'> {
  _id: Types.ObjectId;
}

const RicetteSchema: Schema = new Schema({
  guid_id: { type: String, required: true },
  titolo: { type: String, required: true },
  ingredienti: [{
    nome_prodotto: { type: String, required: true },
    ean: { type: String, required: false },
    quantita_necessaria: { type: Number, required: false },
    peso: { type: Number, required: false },
    unita_misura_peso: { type: String, required: true },
    costo_ingrediente_euro: { type: Number, required: false },
    costo_per_unita_misura: { type: Number, required: false },
    inclusoNelVolantino: { type: Schema.Types.Mixed, required: false }
  }],
  procedimento: { type: String, required: false },
  tempo_in_secondi: { type: String, required: false },
  costo_in_euro: { type: String, required: false },
  tipo: { type: String, required: true, enum: Object.values(TIPO_RICETTA) },
  stato: { type: String, required: true, enum: Object.values(STATO_RICETTA) },
  abbinamento_vino: {
    type: {
      vini_abbinati: { type: [String], required: false },
      motivazione: { type: String, required: false }
    },
    required: false
  },
  foto_ricetta: [{
    id: { type: String, required: true },
    main: { type: Boolean, required: true },
    id_olimpo_cloud: { type: String, required: true },
    url: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, required: false },
    prompt: { type: String, required: false },
  }]
}, { timestamps: true });
RicetteSchema.index({ guid_id: 1 }, { unique: true });
export const RicetteModel = await MongoDBConnection.model<IRicette>('Ricette', RicetteSchema, NOMI_MONGODB.ricette_ai_prima_versione);


export interface IFilesRuntimeLog extends Document, Omit<FileItemKitLog, 'id'> {
  id: string;
}

const FilesRuntimeLogSchema: Schema = new Schema({
  id: { type: String, required: true },
  guid_kit_runtime: { type: String, required: true },
  nome_file: { type: String, required: true },
  data_registrazione: { type: Date, required: true },
  versione: { type: Number, required: true },
  stato: { type: String, required: true, enum: Object.values(STATO_LOG_FILE) },
  logs: [{
    messaggio: { type: String, required: false },
    data_notifica: { type: Date, required: false },
    azione: { type: String, required: true, enum: ['Upload', 'Download', 'Rifiutato', 'Accettato'] },
    utente_notifica: { type: String, required: false },
    dettagli_aggiuntivi: { type: Schema.Types.Mixed, required: false }
  }]
}, { timestamps: true });
FilesRuntimeLogSchema.index({ id: 1 }, { unique: true });
export const FilesRuntimeLogModel = await MongoDBConnection.model<IFilesRuntimeLog>('FilesRuntimeLog', FilesRuntimeLogSchema, NOMI_MONGODB.files_runtime_log);
