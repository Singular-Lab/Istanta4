import type { Writable } from 'stream';
import type { PeriodoConsultazione } from '../../../lib/consultazione/periodi';
import type {
  DettaglioVolantinoConsultazione,
  ElencoPromozioniPopConsultazione,
  FiltriContenutiDigitali,
  FiltriFilePopConsultazione,
  FiltriPromozioniVolantiniConsultazione,
  FiltriVolantiniConsultazione,
  OpzioniContenutiDigitali,
  OpzioniFilePopConsultazione,
  PaginaContenutiDigitali,
  PaginaFilePopConsultazione,
  PaginaPromozioniVolantiniConsultazione,
  PaginaVolantiniConsultazione,
  RichiestaZipPopConsultazione,
  RiepilogoPopConsultazione,
  VerificaZipPopConsultazione,
} from '../../../lib/consultazione/tipi';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import type { EsitoZipOlimpo } from './IFileManagementService';
import type { ZipPop } from './IMaterialiService';

/** File pubblicato pronto da inviare al browser. */
export interface FileScaricato {
  nome: string;
  mime: string;
  contenuto: Buffer;
}

/**
 * Dati delle pagine di Visualizzazione (contratto in lib/consultazione/tipi.ts): solo kit
 * pubblicati della GDO dell'ambito, senza dati di lavorazione, senza chiamate a Istanta.
 * Un kit, una promo o un file fuori dall'ambito risponde come inesistente (404).
 */
export interface IConsultazioneService {
  getVolantini(filtri: FiltriVolantiniConsultazione, ambito: AmbitoGdo): Promise<PaginaVolantiniConsultazione>;
  getPromozioniVolantini(filtri: FiltriPromozioniVolantiniConsultazione, ambito: AmbitoGdo): Promise<PaginaPromozioniVolantiniConsultazione>;
  getVolantino(idKit: string, ambito: AmbitoGdo): Promise<DettaglioVolantinoConsultazione>;

  getPromozioniPop(periodo: PeriodoConsultazione, ambito: AmbitoGdo): Promise<ElencoPromozioniPopConsultazione>;
  getRiepilogoPop(idPromo: string, periodo: PeriodoConsultazione, ambito: AmbitoGdo): Promise<RiepilogoPopConsultazione>;
  getFilePop(idPromo: string, filtri: FiltriFilePopConsultazione, ambito: AmbitoGdo): Promise<PaginaFilePopConsultazione>;
  getOpzioniFilePop(
    idPromo: string,
    filtri: Pick<FiltriFilePopConsultazione, 'periodo' | 'idFormato'>,
    ambito: AmbitoGdo
  ): Promise<OpzioniFilePopConsultazione>;
  verificaZipPop(idPromo: string, richiesta: RichiestaZipPopConsultazione, ambito: AmbitoGdo): Promise<VerificaZipPopConsultazione>;
  preparaZipPop(idPromo: string, richiesta: RichiestaZipPopConsultazione, ambito: AmbitoGdo): Promise<ZipPop>;
  scriviZipPop(zip: ZipPop, destinazione: Writable): Promise<EsitoZipOlimpo>;

  getContenutiDigitali(filtri: FiltriContenutiDigitali, ambito: AmbitoGdo): Promise<PaginaContenutiDigitali>;
  getOpzioniContenutiDigitali(ambito: AmbitoGdo): Promise<OpzioniContenutiDigitali>;

  /** Il file, letto da Olimpo, se la consultazione lo puo' scaricare. */
  scaricaFile(idFile: string, ambito: AmbitoGdo): Promise<FileScaricato>;
}
