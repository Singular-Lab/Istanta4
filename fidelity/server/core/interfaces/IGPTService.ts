import { Request } from "express";
import { ApprofondimentoVino, ReferenzeIstanta, Ricette, STATO_RICETTA, TIPO_RICETTA } from "../../../lib/types";

export interface IGPTService {
    generaRicetta(params: {
        apiKey: string;
        indicazioni: string;
        prodottiInOfferta: Array<{
            titolo: string;
            brand: string;
            tipologia: string;
            grammatura: string;
            reparto: string;
            descrizione_reparto: string;
            descrizione_settore: string;
            peso: number;
            unita_misura_peso: string;
            prezzo: number;
            prezzo_standard: number;
            //TODO da sistemare dovrà diventare il campo codice
            ean: string;
            compiled_field_descrizione: string;
        }>;
    }): Promise<any>;
    generaRicetteCorteMultiple(params: {
        apiKey: string;
        indicazioni: string;
        numero_ricette: number;
        prodottiInOfferta: Array<{
            titolo: string;
            brand: string;
            tipologia: string;
            grammatura: string;
            reparto: string;
            descrizione_reparto: string;
            descrizione_settore: string;
            peso: number;
            unita_misura_peso: string;
            prezzo: number;
            prezzo_standard: number;
            //TODO da sistemare dovrà diventare il campo codice
            ean: string;
            compiled_field_descrizione: string;
        }>;
    }): Promise<any>;
    getRicettaById(id: string): Promise<any>;
    getAllRicette(): Promise<any>;
    generaRicettaApprofondita(params: {
        apiKey: string;
        id: string;
    }): Promise<any>;
    generaAbbinamentoVino(params: {
        apiKey: string;
        id: string;
    }): Promise<any>;
    generaFotoRicetta(params: {
        apiKey: string;
        id: string;
    }, request: Request): Promise<string>;
    rigeneraFotoRicetta(params: {
        apiKey: string;
        id: string;
        idFoto: string;
    }, request: Request): Promise<string>;
    getReferenzePerRicetta(id: string): Promise<ReferenzeIstanta[]>;
    getAllRicetteByFiltriEPromozioniInCorso(filtri: {
        titolo: string;
        stato: STATO_RICETTA;
        tipo: TIPO_RICETTA;
        data_corrente: string;
        pagina: number;
        pagina_size: number;
    }): Promise<any>;
    aggiornaProcedimentoRicetta(params: {
        id: string;
        procedimento: string;
    }): Promise<any>;
    aggiornaFotoRicettaAMain(params: {
        id: string;
        idFoto: string;
    }): Promise<any>;
    deleteRicetta(id: string): Promise<any>;
    cambiaStatoRicetta(guidId: string, stato: STATO_RICETTA): Promise<any>;
    getAllRicetteByPromozioniInCorsoAndPubblicate(size?: number): Promise<Ricette[]>;
    getViniClienteByFiltriEPromoInCorso(
        filtri: {
            titolo: string,
            tipo: string,
            data_corrente: string
        }
    ): Promise<(ReferenzeIstanta & { approfondimento: ApprofondimentoVino })[]>;
    getApprofondimentoVino(codice: string): Promise<ApprofondimentoVino | null>;
    createApprofondimentoVino(params: {
        cantina: string;
        nome: string;
        codice: string;
        anno: number;
    }): Promise<ApprofondimentoVino>;
    deleteApprofondimentoVino(codice: string): Promise<any>;
}
