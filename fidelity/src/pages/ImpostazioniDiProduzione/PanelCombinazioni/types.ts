import { TIPO_KIT_DESIGN } from '../../../../lib/enums';

export interface TemplateData {
  guidId: string;
  titolo: string;
  filtro: any[];
  declinazioni: any[];
  tipiDiExportInKit: any[];
  quantita: number;
  quantitaKit: number;
  codiceFormato: string;
  tipo: TIPO_KIT_DESIGN | string;
}

export interface CombinazioneData {
  guidId: string;
  titolo: string;
  nomeArea?: string;
  nomeCanale?: string;
  tipo: TIPO_KIT_DESIGN | string;
  stato: string;
  guidIdRaccoglitore?: string;
}
