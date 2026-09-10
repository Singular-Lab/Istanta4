import { FICO_ORIGIN } from "@enums/enums";

/**
 * Modello per i messaggi inviati tramite SSE
 *
 */
export interface MessageEvent {
    data: string | object;
    id?: string;
    type?: string;
    retry?: number;
}

export interface JSONMetaFoto {
    Id?: string;
    IdRef?: number;
    FileName?: string;
    FileHash?: string;
}

export interface JSONMetaFileMateriale {
    Id?: string;
    FileName?: string;
    FileHash?: string;
    JsonMeta?: any;
}

export interface InfoFotoMassivo {
    Id: string;
    FileHash: string,
    Size: number,
    FileName: string,
    Width: number,
    Height: number,
}

export interface IAuth {
    public_key?: string;
    private_key?: string;
    meta_utente?: AuthPolicy;
    tipo_utente?: string;
    origine: FICO_ORIGIN;
    email?: string;
}

// export interface OlympusUserPolicyContexts {
//     fp_context: boolean;
//     correggo_context: boolean;
//     istanta_context: boolean;
// }

export interface OlympusUserPolicyRuolo {
    nodeType: string;
    nodeValue: string;
    children: OlympusUserPolicyRuolo[];
    codificaFP?: string;
}

export interface AuthPolicy {
    campi_essenziali: {
        nome: string;
        cognome: string,
        email: string
    }
    // permessi?: OlympusUserPolicyContexts;
    ruoli?: OlympusUserPolicyRuolo[];
    lockedEdit?: boolean;
}


export type FileTreeMeta = {
    description: string;
    timestamp: string;
    version: string;
};



export enum TIPO_COMANDO_CONTRATTO_TIPOGRAFIA {
    NOTIFY = "notify",
    ROLLBACK = "rollback",
    MKDIR = "mkdir",
    LOG = "log",
    DEPOSIT = "deposit",
    WARN = "warn",
}

export type FileTreeAction = {
    commands: TIPO_COMANDO_CONTRATTO_TIPOGRAFIA[];
    dirname?: string[];
    permissions?: string;
    meta?: FileTreeMeta;
    log?: string;
};

export type FileTreeNode = {

    priority: number;
    conditions: FileTreeCondition[];
    on_respect_condition: FileTreeAction;
    on_error: FileTreeAction;
    fallback: {
        action: string;
        dirname?: string;
    };
    filetree?: FileTreeNode[];
};

export type RootFileTree = {
    dictionary?: {
        [key: string]: string;
    };
    root: string;
    root_file_tree: FileTreeNode[];
};


export type FileTreeCondition = {
    field: string;
    operator: string;
    value: string;
};


export type FileItemKit = {
    url?: string;
    url_download?: string;
    id: string;
    id_runtime: string;
    direttive: string;
    nome: string;
    nome_originale: string;
    isOptional: boolean;
    id_olimpo_cloud?: string;
    meta_olimpo_cloud: any;
    tipo_export: string;
    blob?: string;
    mime?: string;
    error?: string;
    size?: number;
    pages?: number;
    is_merged_group?: boolean;
    merged_group_id?: string;
    merged_file_ids?: string[];
    virtual_dir?: any;
}
export type RUNTIME_KIT_MONGO = {
    _id?: string;
    guidId: string;
    guidArea: string;
    filtro?: any[];
    guidIdDesign: string;
    guidCanale: string;
    guidFormato: string;
    tipiDiExportInKit: any[];
    quantitaCopie: number;
    titolo: string;
    guidIdRaccoglitore: string;
    stato: string;
    idPromo: string;
    context: any[];
    tipo: string;
    codiceArea?: string;
    codiceCanale?: string;
    nomeArea?: string;
    nomeCanale?: string;
    promo?: any;
    declinazioni?: any[];
    stato_lavorazione: string;
    files?: FileItemKit[];
    contrattoElaborato?: RootFileTree;
}
