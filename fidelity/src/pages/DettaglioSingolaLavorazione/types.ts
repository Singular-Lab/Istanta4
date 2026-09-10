import { DESIGN_KIT_MONGO, RUNTIME_KIT_MONGO, TipiDiExportAttributes, FileItemKit } from "../../../lib/types";

export type LavorazioneType = ((
    DESIGN_KIT_MONGO & { nomeCanale: string, nomeArea: string, lavorazioneStarted: boolean, isDesignKit: boolean, tipiExport: TipiDiExportAttributes[], numero_referenze_trovate: number }) |
    RUNTIME_KIT_MONGO & { nomeCanale: string, nomeArea: string, lavorazioneStarted: boolean, isDesignKit: boolean, tipiExport: TipiDiExportAttributes[], numero_referenze_trovate: number });

export interface FileUpload {
    id: string;
    expectedFileName: string;
    file: File;
    direttive: string;
    tipoExport: string;
}

export interface StagedFile {
    originalFile: FileItemKit;
    newFile: File;
    id: string;
} 