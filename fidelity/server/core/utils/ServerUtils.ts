import axios, { AxiosResponse } from 'axios';
import { Request } from 'express';
import fetchCookie from 'fetch-cookie';
import fetch, { Headers, RequestInit } from 'node-fetch';
import * as tough from 'tough-cookie';
import { Colorize } from '../../../lib/Colorize';
import { HttpStatusCode, TIPO_ATTIVITA, type CATEGORIA_ATTIVITA } from '../../../lib/enums';
import { SystemNotification, UtenteAttributes } from '../../../lib/types';
import { emitToClients } from '../../ws-server';
import config from '../config';
import { log } from '../logger';
import { Attivita } from '../models/attivita';
import { Utente } from '../models/utenti';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

interface ApiResponse<T> {
    data: T;
    status: number;
    statusText: string;
    headers: Headers;
}

interface ApiError {
    message: string;
    code?: number;
    errorType?: string;
}

// Estendi il tipo RequestInit per includere credentials
interface ExtendedRequestInit extends RequestInit {
    credentials?: 'include' | 'same-origin' | 'omit';
}

class ServerUtils {

    /**
     * Checks if a given value is valid based on its type.
     *
     * - `null` and `undefined` are considered invalid.
     * - Strings are valid if they are non-empty after trimming.
     * - Numbers are valid if they are finite.
     * - Booleans are always valid.
     * - Dates are valid if their timestamp is not NaN.
     * - Arrays are valid if they are non-empty. If `strict` is true, at least one element must be valid.
     * - Objects are valid if they have at least one property.
     *
     * @param value - The value to validate.
     * @param strict - If true and `value` is an array, checks if at least one element is valid.
     * @returns `true` if the value is valid, otherwise `false`.
     */
    static checkIfValueIsValid(value: unknown, strict: boolean = false): boolean {
        if (value == null) return false;
        if (value == undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value === 'boolean') return true;
        if (value instanceof Date) return !Number.isNaN(value.getTime());
        if (Array.isArray(value)) {
            if (strict) {
                return value.some(v => this.checkIfValueIsValid(v));
            } else {
                return value.length > 0
            }
        }
        if (typeof value === 'object') return Object.keys(value as object).length > 0;
        return false;
    }

    static minifyCSS(code: string): string {
        return code
            .replace(/\/\*[\s\S]*?\*\//gm, '') // Rimuove commenti
            .replace(/\s*([{};,:])\s*/g, '$1') // Rimuove spazi intorno a simboli
            .replace(/\s+/g, ' ') // Rimuove spazi multipli
            .replace(/^\s+|\s+$/g, ''); // Rimuove spazi all'inizio/fine
    }

    /**
     * Recupera il cookie jar dalla sessione o ne crea uno nuovo.
     * Questo lega la sessione con l'API esterna alla sessione dell'utente nella nostra app.
     */
    private static async getRequestCookieJar(req: Request): Promise<tough.CookieJar> {
        if (req.session.requestCookieJar) {
            try {
                // Deserializza il jar dalla sessione
                const jar = tough.CookieJar.fromJSON(req.session.requestCookieJar);
                return jar || new tough.CookieJar();
            } catch (e) {
                log.warn('Impossibile parsare il cookie jar dalla sessione, ne creo uno nuovo.', e as any);
                return new tough.CookieJar();
            }
        }
        return new tough.CookieJar();
    }

    /**
     * Salva il cookie jar aggiornato di nuovo nella sessione.
     */
    private static async saveRequestCookieJar(req: Request, jar: tough.CookieJar) {
        req.session.requestCookieJar = JSON.stringify(jar.toJSON());
        // Salva esplicitamente la sessione per assicurarsi che il jar sia disponibile per la prossima chiamata
        return new Promise<void>((resolve, reject) => {
            req.session.save(err => {
                if (err) {
                    log.error("Errore nel salvataggio del cookie jar nella sessione", err);
                    reject(err);
                }
                else resolve();
            });
        });
    }

    static async getPassportFromOlympo(req: Request): Promise<string> {
        const jar = await this.getRequestCookieJar(req);
        const fetchWithCookies = fetchCookie(fetch, jar);

        let id_utente_loggato = req.session.id_utente;
        if (id_utente_loggato == "" || id_utente_loggato == undefined) {
            throw this.createErrorObject("Id utente non fornito", 400, { id_utente_loggato });
        } else {
            const utente = await Utente.findByPk(id_utente_loggato);
            if (utente == null) {
                throw this.createErrorObject("Utente non trovato", 400, { id_utente_loggato });
            } else {
                const privateKey = utente.privatekey_utenti;
                const fico_secret = config.FICO_SECRET;
                const headers: Record<string, string> = {};
                if (privateKey == "" || privateKey == undefined) {
                    headers["fico-secret"] = fico_secret;
                } else {
                    headers["authorization"] = "Bearer " + privateKey;

                }
                const token = await fetchWithCookies(config.OLYMPUS_IP_ADDRESS + "/auth/getPassport", {
                    method: "PUT",
                    headers: headers,
                    body: JSON.stringify({
                        username: utente.email_utenti,
                        tipoUtente: utente.tipo_utenti,
                        origin: "FP",
                        campi_aggiuntivi: {
                            nome: utente.nome_utenti,
                            cognome: utente.cognome_utenti,
                            email: utente.email_utenti,
                            stato: utente.stato_utenti,
                            residenza: utente.residenza_utenti,
                            dataDiNascita: utente.datadinascita_utenti,
                            tipo: utente.tipo_utenti
                        },
                        policy: {
                            gruppi: Array.isArray(utente.meta_utenti?.gruppi_ad)
                                ? utente.meta_utenti.gruppi_ad
                                : [],
                            codice_posizione: utente.meta_utenti?.codice_posizione ?? null
                        }
                    })
                })
                if (token.status != 200) {
                    log.error(Colorize.bgRed(token.statusText));
                    throw new Error("Errore durante la richiesta del token");
                }
                const content = await token.json() as {
                    esito: boolean,
                    error: string,
                    statusCode: number,
                    publicKey: string,
                    privateKey: string
                }
                log.info(Colorize.bgGreen(content));
                if (content.esito) {
                    if (content.privateKey &&
                        content.privateKey !== utente.privatekey_utenti &&
                        content.privateKey !== undefined &&
                        content.privateKey !== null) {
                        utente.privatekey_utenti = content.privateKey;
                        await utente.save({});
                        log.info(Colorize.bgGreen(utente.privatekey_utenti));
                    }
                    // Salva il jar aggiornato dopo la chiamata, solo se è una sessione esterna
                    if (req.session.isExternalAuth) {
                        await this.saveRequestCookieJar(req, jar);
                    }
                    return content.publicKey;
                }
                return content.publicKey;
            }
        }
    }


    /**
     * Sends a request to another API.
     *
     * @template T - The expected response type.
     * @param {string} url - The URL of the API to send the request to.
     * @param {HttpMethod} method - The HTTP method to use for the request.
     * @param {any} data - The data to send in the body of the request.
     * @param {Record<string, string>} [customHeaders] - Optional additional headers to send with the request.
     * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the API response.
     * @throws Will throw an error if the request fails or the response is not ok.
     */
    static async sendToFICOApi<T>(req: Request, url: string, method: HttpMethod | string, data: any, customHeaders?: Record<string, string>): Promise<ApiResponse<T>> {
        const jar = await this.getRequestCookieJar(req);

        const fetchWithCookies = fetchCookie(fetch, jar);
        try {
            const headers: Record<string, string> = {
                ...customHeaders // Override or add custom headers
            };
            let publicKey = "";
            if (req.headers.authorization != undefined) {
                publicKey = req.headers.authorization;
            } else {
                const utente = await Utente.findByPk(req.session.id_utente);
                if (utente != null && utente.outsider_utenti == false) {
                    // Anche questa chiamata deve usare un jar isolato se vogliamo che funzioni in modo concorrente
                    publicKey = await this.getPassportFromOlympo(req);
                    if (this.checkIfValueIsValid(publicKey)) {
                        headers['Authorization'] = "Bearer " + publicKey;
                    }
                    else {
                        throw this.createErrorObject("Chiave privata non fornita", 400, { url, method, data, customHeaders });
                    }
                }
            }
            if (!(data instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
                headers['Accept'] = 'application/json';
            }
            const options: RequestInit = {
                method: method,
                headers: headers,
                body: method !== 'GET' && method !== 'HEAD' ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined
            };
            //console.log(Colorize.bgBlue(url));
            // Usa il fetch con il cookie jar isolato.
            const response = await fetchWithCookies(url, options as any);

            // Handle binary responses (images, PDFs, etc)
            if (response.headers.get('Content-Type')?.includes('image') ||
                response.headers.get('Content-Type')?.includes('application/pdf') ||
                response.headers.get('Content-Type')?.includes('application/octet-stream')) {
                const buffer = await response.arrayBuffer();
                return {
                    data: buffer,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers as any
                } as ApiResponse<T>;
            }

            // Handle text/JSON responses
            const responseText = await response.text();
            if (!response.ok) {
                throw new Error(responseText || 'Errore durante la comunicazione con l\'altra API');
            }

            // Try to parse as JSON, but handle PDF content gracefully
            let responseData: T;
            try {
                if (responseText.startsWith('%PDF-')) {
                    // If it's a PDF, return the raw text
                    responseData = responseText as unknown as T;
                } else {
                    responseData = JSON.parse(responseText) as T;
                }
            } catch (error) {
                // If parsing fails, return the raw text
                responseData = responseText as unknown as T;
            }

            // Salva il jar aggiornato dopo la chiamata se è una sessione esterna
            if (req.session.isExternalAuth) {
                await this.saveRequestCookieJar(req, jar);
            }

            return {
                data: responseData,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers as any
            };
            // Imposta il Content-Type solo se i dati non sono FormData
        } catch (error: any) {
            if (typeof error == "string") {
                error = JSON.parse(error);
            }
            return {
                data: null as any,
                status: error.code || 500,
                statusText: error.message,
            } as ApiResponse<T>;
        }
    }
    // Funzione per gestire la richiesta con fetch
    static async sendRequestWithFetch<T>(url: string, options: RequestInit): Promise<ApiResponse<T>> {
        log.info("Inizio richiesta con fetch normale: " + url);
        const response = await fetch(url, options);

        log.info("Stato risposta API: " + response.status);
        log.info("Testo risposta API: " + response.statusText);
        const responseText = await response.text();
        log.info("Contenuto testo risposta API: " + responseText);

        if (!response.ok) {
            log.error("Errore nella risposta dell'API, stato non OK");
            throw new Error(responseText || "Errore durante la comunicazione con l'altra API");
        }

        let responseData: T;
        try {
            responseData = JSON.parse(responseText) as T;
            log.info("Parsing JSON riuscito: " + responseData);
        } catch (error: any) {
            log.error("Errore nel parsing della risposta JSON:", error.message);
            throw new Error("Errore nel parsing della risposta JSON: " + responseText);
        }

        return {
            data: responseData,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers as any
        };
    }

    static async sendToFicoApiAxiosUploadTracciato<T>(req: Request, data: any | FormData): Promise<ApiResponse<T>> {
        try {
            // Ottieni il token usando la funzione esistente
            const publicKey = await this.getPassportFromOlympo(req);
            log.info(Colorize.bgGreen(publicKey));

            if (publicKey === "") {
                throw this.createErrorObject("Chiave pubblica non fornita", HttpStatusCode.BAD_REQUEST, { data });
            }

            // Prepara gli headers
            const headers: Record<string, string> = {
                "Authorization": "Bearer " + publicKey,
                'Content-Type': 'multipart/form-data'
            };

            log.info(Colorize.red('JSON DI DATA'));
            log.info(Colorize.red(data instanceof FormData ?
                'FormData with entries: ' + Array.from((data as any).entries() as Iterable<[any, any]>).map(([key, value]) => `${key}: ${value}`).join(', ') :
                JSON.stringify(data)
            ));

            const result = await axios.post(config.ISTANTA_IP_ADDRESS + "/FicoProcess/uploadTracciato", data, { headers });
            const response = result as AxiosResponse<T>;

            // Verifica lo status della risposta
            if (response.status < 200 || response.status >= 300) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers as any
            };

        } catch (error: any) {
            log.error(Colorize.bgRed(error.message));

            // Gestione errori Axios
            if (error.response) {
                return {
                    data: null as any,
                    status: error.response.status,
                    statusText: error.response.statusText || error.message,
                } as ApiResponse<T>;
            }

            // Gestione altri errori
            if (typeof error === "string") {
                try {
                    error = JSON.parse(error);
                } catch {
                    // Se non è JSON valido, usa l'errore come stringa
                }
            }

            return {
                data: null as any,
                status: error.code || error.status || 500,
                statusText: error.message || 'Errore durante la comunicazione con l\'API',
            } as ApiResponse<T>;
        }
    }

    // Funzione per gestire la richiesta con fetchWithCookies
    static async sendRequestWithFetchCookies<T>(url: string, options: RequestInit, req: Request): Promise<ApiResponse<T>> {
        log.info("Inizio richiesta con fetchWithCookies: " + url);

        // Crea un cookie jar isolato per questa specifica richiesta
        const requestCookieJar = new tough.CookieJar();
        if (req.headers.cookie) {
            const currentUrl = new URL(url);
            const cookies = req.headers.cookie.split(';');
            for (const cookie of cookies) {
                await requestCookieJar.setCookie(cookie.trim(), currentUrl.origin);
            }
        }
        const fetchWithSpecificCookies = fetchCookie(fetch, requestCookieJar);

        const response = await fetchWithSpecificCookies(url, options);

        log.info("Stato risposta API: " + response.status);
        log.info("Testo risposta API: " + response.statusText);
        const responseText = await response.text();
        log.info("Contenuto testo risposta API: " + responseText);

        if (!response.ok) {
            log.error("Errore nella risposta dell'API, stato non OK");
            throw new Error(responseText || "Errore durante la comunicazione con l'altra API");
        }

        let responseData: T;
        try {
            responseData = JSON.parse(responseText) as T;
            log.info("Parsing JSON riuscito: " + responseData);
        } catch (error: any) {
            log.error("Errore nel parsing della risposta JSON:", error.message);
            throw new Error("Errore nel parsing della risposta JSON: " + responseText);
        }

        return {
            data: responseData,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers as any
        };
    }

    static async sendToFicoApiAxiosUpload<T>(req: Request, url: string, data: any | FormData, customHeaders?: Record<string, string>): Promise<ApiResponse<T>> {
        try {
            // Ottieni il token usando la funzione esistente
            const publicKey = await this.getPassportFromOlympo(req);
            log.info(Colorize.bgGreen(publicKey));

            if (publicKey === "") {
                throw this.createErrorObject("Chiave privata non fornita", HttpStatusCode.BAD_REQUEST, { url, data, customHeaders });
            }

            // Prepara gli headers
            // Se esiste già Authorization nei customHeaders, non sovrascriverlo
            const headers: Record<string, string> = {
                ...(customHeaders?.['Authorization'] ? {} : { "Authorization": "Bearer " + publicKey }),
                ...customHeaders // Override o aggiungi headers personalizzati
            };

            // Imposta Content-Type solo se non è già specificato nei customHeaders
            if (!customHeaders?.['Content-Type']) {
                if (data instanceof FormData) {
                    headers['Content-Type'] = 'multipart/form-data';
                } else {
                    headers['Content-Type'] = 'application/json';
                }
            }

            log.info(Colorize.red('JSON DI DATA'));
            log.info(Colorize.red(data instanceof FormData ?
                'FormData with entries: ' + Array.from((data as any).entries() as Iterable<[any, any]>).map(([key, value]) => `${key}: ${value}`).join(', ') :
                JSON.stringify(data)
            ))

            const result = await axios.post(url, data, { headers });
            const response = result as AxiosResponse<T>;

            // Verifica lo status della risposta
            if (response.status < 200 || response.status >= 300) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            return {
                data: response.data,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers as any
            };

        } catch (error: any) {
            log.error(Colorize.bgRed(error.message));

            // Gestione errori Axios
            if (error.response) {
                return {
                    data: null as any,
                    status: error.response.status,
                    statusText: error.response.statusText || error.message,
                } as ApiResponse<T>;
            }

            // Gestione altri errori
            if (typeof error === "string") {
                try {
                    error = JSON.parse(error);
                } catch {
                    // Se non è JSON valido, usa l'errore come stringa
                }
            }

            return {
                data: null as any,
                status: error.code || error.status || 500,
                statusText: error.message || 'Errore durante la comunicazione con l\'API',
            } as ApiResponse<T>;
        }
    }


    static async sendToOlympusApi<T>(url: string, method: HttpMethod, data: any, customHeaders?: Record<string, string>): Promise<ApiResponse<T>> {
        try {
            const headers: Record<string, string> = {
                ...customHeaders // Override or add custom headers
            };

            if (!(data instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
                headers['Accept'] = 'application/json';
            }

            const options: ExtendedRequestInit = {
                method: method,
                headers: headers,
                body: method !== 'GET' && method !== 'HEAD' ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined
            };

            const response = await fetch(url, options);

            if (!response.ok) {
                throw new Error(await response.text() || 'Errore durante la comunicazione con l\'altra API');
            }

            let responseData: T;
            try {
                responseData = await response.json() as T;
            } catch (error) {
                throw new Error('Errore nel parsing della risposta JSON: ' + await response.text());
            }

            return {
                data: responseData,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers as any
            };
        } catch (error: any) {
            return {
                data: null as any,
                status: error.code || 500,
                statusText: error.message,
            } as ApiResponse<T>;
        }
    }

    static createErrorObject(message: string, code: number, additionalData?: any): any {
        const errorObj: any = {
            success: false,
            message,
            code,
        };

        if (additionalData) {
            Object.assign(errorObj, additionalData);
        }

        return errorObj;
    }


    static async CREA_ATTIVITA(idUtente: string | null, tipo: TIPO_ATTIVITA, categoria: CATEGORIA_ATTIVITA, meta: any) {
        try {
            const resultCreazioneAttivita = await Attivita.create({
                idutente_attivita: idUtente ? idUtente == "System" ? null : idUtente : null,
                tipo_attivita: tipo,
                meta_attivita: meta,
                createdat: new Date()
            });
            ServerUtils.inviaNotificaAttivita(tipo, meta, idUtente);

            return resultCreazioneAttivita;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Invia una notifica Socket.IO personalizzata in base al tipo di attività
     */
    private static async inviaNotificaAttivita(tipo: TIPO_ATTIVITA, meta: any, idUtente: string | null) {
        try {
            // Query ottimizzata: seleziona solo i campi necessari, concatenazione in JS
            let utente: UtenteAttributes | null = null;
            if (idUtente != null) {
                utente = await Utente.findByPk(idUtente, {
                    attributes: ['nome_utenti', 'cognome_utenti'],
                    raw: true
                });
            }
            if (!utente) {
                // Se utente non trovato, usa un fallback invece di fallire
                log.warn(`Utente ${idUtente} non trovato per notifica attività ${tipo}`);
                const notifica = ServerUtils.getMessaggioNotificaAttivita(tipo, meta, 'System');
                if (notifica) {
                    emitToClients('notifica', notifica);
                }
                return;
            }

            // Concatenazione in JavaScript (più veloce del DB)
            const nomeCompleto = idUtente != null ? `${utente.nome_utenti} ${utente.cognome_utenti}` : 'System';
            const notifica = ServerUtils.getMessaggioNotificaAttivita(tipo, meta, nomeCompleto);

            if (notifica) {
                emitToClients('notifica', notifica);
                log.info(`Notifica inviata per attività: ${tipo}`, { meta });
            }
        } catch (error) {
            log.error('Errore durante l\'invio della notifica attività:', error);
        }
    }

    /**
     * Genera il messaggio di notifica personalizzato per ogni tipo di attività
     */
    private static getMessaggioNotificaAttivita(tipo: TIPO_ATTIVITA, meta: any, nomeUtente: string): SystemNotification | null {

        switch (tipo) {
            case TIPO_ATTIVITA.CREAZIONE_UTENTE:
                return {
                    titolo: 'Nuovo Utente',
                    messaggio: `${nomeUtente} ha creato l'utente ${meta?.nome || 'sconosciuto'}`,
                    tipo: 'success'
                };

            case TIPO_ATTIVITA.ELIMINAZIONE_UTENTE:
                return {
                    titolo: 'Utente Eliminato',
                    messaggio: `${nomeUtente} ha eliminato l'utente ${meta?.nome || 'sconosciuto'}`,
                    tipo: 'warning'
                };

            case TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_AUTOMATICO:
                return {
                    titolo: 'Kit Automatico Creato',
                    messaggio: `${nomeUtente} ha creato il kit automatico "${meta?.titolo || meta?.nome || 'Nuovo Kit'}"`,
                    tipo: 'success'
                };

            case TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_MANUALE:
                return {
                    titolo: 'Kit Manuale Creato',
                    messaggio: `${nomeUtente} ha creato il kit manuale "${meta?.titolo || meta?.nome || 'Nuovo Kit'}"`,
                    tipo: 'success'
                };

            case TIPO_ATTIVITA.UPLOAD_FILE_MANUALE:
                return {
                    titolo: 'File Caricato',
                    messaggio: `${nomeUtente} ha caricato un file per "${meta?.titolo || 'Kit'}"`,
                    tipo: 'info'
                };

            case TIPO_ATTIVITA.MODIFICA_WORKSPACE_WEBPLIANT:
                return {
                    titolo: 'Workspace Modificato',
                    messaggio: `Workspace WebPliant "${meta?.nomeWorkspace || 'Workspace'}" aggiornato`,
                    tipo: 'info'
                };

            case TIPO_ATTIVITA.CREAZIONE_DESIGN_KIT:
                return {
                    titolo: 'Design Kit Creato',
                    messaggio: `Design Kit "${meta?.nome || 'Nuovo Design'}" creato con successo`,
                    tipo: 'success'
                };

            case TIPO_ATTIVITA.IMPORT_TRACCIATO:
                return {
                    titolo: 'Tracciato Importato',
                    messaggio: `Tracciato importato con successo per la promozione "${meta?.nome || 'Promo'}"`,
                    tipo: 'success'
                };

            case TIPO_ATTIVITA.CREAZIONE_LAVORAZIONE:
                return {
                    titolo: 'Nuova promozione',
                    messaggio: `Lavorazione "${meta?.nomePromo || 'Nuova promozione'}" creata con successo`,
                    tipo: 'success'
                };

            case TIPO_ATTIVITA.PUBBLICAZIONE_WEBPLIANT:
                return {
                    titolo: 'WebPliant Pubblicato',
                    messaggio: `WebPliant pubblicato con successo`,
                    tipo: 'success'
                };

            case TIPO_ATTIVITA.RICHIESTA_WEBPLIANT:
                return {
                    titolo: 'Richiesta WebPliant',
                    messaggio: `Nuova richiesta WebPliant ricevuta`,
                    tipo: 'info'
                };

            case TIPO_ATTIVITA.CREAZIONE_ORDINE_DI_STAMPA:
                return {
                    titolo: 'Ordine di Stampa',
                    messaggio: `Ordine di stampa "${meta?.nome || 'Nuovo Ordine'}" creato con successo`,
                    tipo: 'success'
                };

            case TIPO_ATTIVITA.INVIO_FILES_FTP:
                return {
                    titolo: 'Invio FTP',
                    messaggio: `File inviati via FTP con successo`,
                    tipo: 'success'
                };
            case TIPO_ATTIVITA.PUBBLICAZIONE_FILE_CORREGGO:
                return {
                    titolo: 'Pubblicazione File Correggo',
                    messaggio: `File pubblicato con successo su Correggo`,
                    tipo: 'success'
                };
            case TIPO_ATTIVITA.INVIO_FILE_CORREGGO:
                return {
                    titolo: 'Invio File Correggo',
                    messaggio: `${nomeUtente} ha inviato ${meta.nome_file} su Correggo`,
                    tipo: 'success'
                };
            default:
                // Per tipi di attività non mappati, non inviare notifica
                return null;
        }
    }
    static t(key: string, dictionary: any): string {
        if (!key) return '';
        const parts = key.split('.');
        let result = dictionary;

        for (const part of parts) {
            if (result && result.hasOwnProperty(part)) {
                result = result[part];
            } else {
                return key; // fallback: restituisce la chiave stessa se non trovata
            }
        }

        return typeof result === 'string' ? result : key;
    }
}

export { ServerUtils };
