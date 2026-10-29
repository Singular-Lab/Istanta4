import { Request } from 'express';
import fetchCookie from 'fetch-cookie';
import * as tough from 'tough-cookie';
import { Colorize } from '../../../lib/Colorize';
import { TIPO_ATTIVITA, type CATEGORIA_ATTIVITA } from '../../../lib/enums';
import { SystemNotification, UtenteAttributes } from '../../../lib/types';
import { emitToClients } from '../../ws-server';
import config from '../config';
import { invalidaPassaporto, passaportoInCache, type Passaporto } from '../http/cachePassaporti';
import { chiamaHttp, destinazioneDi, ErroreHttp, type CategoriaChiamata, type MotivoErroreHttp, type OpzioniHttp } from '../http/clienteHttp';
import { log } from '../logger';
import { Attivita } from '../models/attivita';
import { Utente } from '../models/utenti';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

/** Perche' una chiamata non ha avuto risposta HTTP (status 0); "passaporto": non e' partita. */
export type MotivoNessunaRisposta = MotivoErroreHttp | 'passaporto';

interface ApiResponse<T> {
    data: T;
    status: number;
    statusText: string;
    headers: Headers;
    /** Solo con status 0. */
    motivo?: MotivoNessunaRisposta;
}

interface ApiError {
    message: string;
    code?: number;
    errorType?: string;
}

/**
 * Tipo di chiamata, dichiarato da chi chiama: decide il tempo massimo (se non e' passato
 * esplicitamente) e se la chiamata si puo' ripetere. Non si deduce dal metodo HTTP.
 */
export interface OpzioniChiamataServizio {
    /** Default "lunga", il tempo massimo di prima (FICO_API_TIMEOUT_MS o 10 minuti). */
    categoria?: CategoriaChiamata;
    /** Solo le letture: ritentate sugli errori temporanei e dopo un passaporto rifiutato. */
    idempotente?: boolean;
}

type EsitoChiamata<T> = { risposta: ApiResponse<T>; passaportoRifiutato: boolean };

const messaggioErrore = (error: unknown): string =>
    (error as { message?: string } | null)?.message || String(error);

/**
 * Istanta rifiuta il passaporto prima di eseguire l'azione: 401 con no_login, no_login_byolympus
 * o "no_login public token empty". "no_login:" seguito dallo stack e' invece un'eccezione,
 * anche a meta' operazione, e non dipende dal passaporto.
 */
function passaportoRifiutato(status: number, corpo: unknown): boolean {
    if (status !== 401) return false;
    const codice = (corpo as { error?: unknown } | null)?.error;
    return typeof codice === 'string' && codice.startsWith('no_login') && !codice.startsWith('no_login:');
}

/** Corpo come JSON se lo e', altrimenti il testo (come axios); null se vuoto. */
async function leggiCorpo(risposta: Response): Promise<any> {
    const testo = await risposta.text();
    if (!testo) return null;
    try {
        return JSON.parse(testo);
    } catch {
        return testo;
    }
}

/** Copia gli header saltando quelli senza valore, che altrimenti partirebbero come "undefined". */
function headerDefiniti(origine?: Record<string, string | undefined | null>): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const [nome, valore] of Object.entries(origine ?? {})) {
        if (valore !== undefined && valore !== null) headers[nome] = valore;
    }
    return headers;
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

    /** fetch con il cookie jar della sessione: ogni passaggio, redirect compresi, usa il client comune. */
    private static fetchConCookie(jar: tough.CookieJar, opzioni: OpzioniHttp) {
        return fetchCookie((url: string, init?: RequestInit) => chiamaHttp(url, { ...init, ...opzioni }), jar);
    }

    /**
     * Chiave pubblica del passaporto Olimpo dell'utente in sessione, dalla cache del worker
     * o chiesta a Olimpo. Lancia se l'utente non c'e' o Olimpo non la rilascia.
     */
    static async getPassportFromOlympo(req: Request): Promise<string> {
        const id_utente_loggato = req.session.id_utente;
        if (id_utente_loggato == "" || id_utente_loggato == undefined) {
            throw this.createErrorObject("Id utente non fornito", 400, { id_utente_loggato });
        }
        const passaporto = await this.passaportoUtente(req, true);
        if (!passaporto?.publicKey) {
            throw this.createErrorObject("Utente non trovato", 400, { id_utente_loggato });
        }
        return passaporto.publicKey;
    }

    /**
     * Passaporto dell'utente in sessione; null se la sessione non ha un utente esistente.
     * Con serveChiave la chiave pubblica si chiede anche per gli outsider (upload, contesto FICO).
     */
    private static passaportoUtente(req: Request, serveChiave: boolean): Promise<Passaporto | null> {
        const idUtente = req.session.id_utente;
        if (!idUtente) return Promise.resolve(null);
        return passaportoInCache(idUtente, req.session.private_key, async () => {
            const utente = await Utente.findByPk(idUtente);
            if (utente == null) return null;
            // Come prima: solo chi ha outsider_utenti false manda il passaporto a Istanta
            const outsider = utente.outsider_utenti !== false;
            if (outsider && !serveChiave) return { outsider, publicKey: null };
            return { outsider, publicKey: await this.richiediPassaporto(req, utente) };
        }, serveChiave);
    }

    /** PUT auth/getPassport: Olimpo rilascia (o aggiorna) il passaporto con i dati e la policy dell'utente. */
    private static async richiediPassaporto(req: Request, utente: Utente): Promise<string> {
        const jar = await this.getRequestCookieJar(req);
        const fetchWithCookies = this.fetchConCookie(jar, { categoria: 'passaporto' });

        const privateKey = utente.privatekey_utenti;
        const headers: Record<string, string> = {};
        if (privateKey == "" || privateKey == undefined) {
            headers["fico-secret"] = config.FICO_SECRET;
        } else {
            headers["authorization"] = `Bearer ${privateKey}`;
        }
        const token = await fetchWithCookies(`${config.OLYMPUS_IP_ADDRESS}/auth/getPassport`, {
            method: "PUT",
            headers,
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
        });
        if (token.status != 200) {
            log.error(Colorize.bgRed(token.statusText));
            await token.body?.cancel().catch(() => undefined);
            throw new Error("Errore durante la richiesta del token");
        }
        const content = await token.json() as {
            esito: boolean,
            error: string,
            statusCode: number,
            publicKey: string,
            privateKey: string
        };
        // Olimpo segnala gli errori con HTTP 200 ed esito false: nessun passaporto, niente in cache
        if (!content?.esito || !this.checkIfValueIsValid(content.publicKey)) {
            invalidaPassaporto(utente.id_utenti);
            log.warn('Olimpo non ha rilasciato il passaporto', { idUtente: utente.id_utenti, statusCode: content?.statusCode });
            throw new Error("Olimpo non ha rilasciato il passaporto");
        }
        if (content.privateKey &&
            content.privateKey !== utente.privatekey_utenti &&
            content.privateKey !== undefined &&
            content.privateKey !== null) {
            utente.privatekey_utenti = content.privateKey;
            await utente.save({});
        }
        // Salva il jar aggiornato dopo la chiamata, solo se è una sessione esterna
        if (req.session.isExternalAuth) {
            await this.saveRequestCookieJar(req, jar);
        }
        return content.publicKey;
    }

    /** Risposta senza HTTP (status 0) nella forma di sendToFICOApi. */
    private static nessunaRisposta<T>(motivo: MotivoNessunaRisposta | undefined, error: unknown): ApiResponse<T> {
        return {
            data: null as T,
            status: 0,
            statusText: messaggioErrore(error),
            ...(motivo && { motivo }),
        } as ApiResponse<T>;
    }

    /**
     * Sends a request to another API.
     *
     * Non lancia mai: risposta HTTP con lo stato reale e il corpo interpretato, oppure status 0
     * con `motivo` (rete, timeout, passaporto non ottenuto). Se Istanta rifiuta il passaporto
     * (401 no_login) la cache del passaporto si svuota e solo una chiamata idempotente viene
     * ripetuta una volta con un passaporto nuovo.
     *
     * @template T - The expected response type.
     * @param {string} url - The URL of the API to send the request to.
     * @param {HttpMethod} method - The HTTP method to use for the request.
     * @param {any} data - The data to send in the body of the request.
     * @param {Record<string, string>} [customHeaders] - Optional additional headers to send with the request.
     * @param {number} [timeoutMs] - Timeout di questa chiamata; prevale sulla categoria.
     * @param {OpzioniChiamataServizio} [opzioni] - Categoria (tempo massimo) e idempotenza.
     * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the API response.
     */
    static async sendToFICOApi<T>(req: Request, url: string, method: HttpMethod | string, data: any, customHeaders?: Record<string, string>, timeoutMs?: number, opzioni?: OpzioniChiamataServizio): Promise<ApiResponse<T>> {
        const prima = await this.eseguiChiamataServizio<T>(req, url, method, data, customHeaders, timeoutMs, opzioni);
        if (!prima.passaportoRifiutato) return prima.risposta;

        invalidaPassaporto(req.session.id_utente);
        // Per decisione una scrittura non si ripete: l'operatore vede "utente non riconosciuto" e riprova
        if (!opzioni?.idempotente) return prima.risposta;
        log.info('Passaporto rifiutato da Istanta: nuovo tentativo con un passaporto nuovo', { destinazione: destinazioneDi(url) });
        return (await this.eseguiChiamataServizio<T>(req, url, method, data, customHeaders, timeoutMs, opzioni)).risposta;
    }

    private static async eseguiChiamataServizio<T>(req: Request, url: string, method: HttpMethod | string, data: any, customHeaders: Record<string, string> | undefined, timeoutMs: number | undefined, opzioni: OpzioniChiamataServizio | undefined): Promise<EsitoChiamata<T>> {
        const headers = headerDefiniti(customHeaders);
        let conPassaporto = false;
        // Con un Authorization in ingresso (bearer di integrazione) non si chiede il passaporto e il bearer non si inoltra
        if (req.headers.authorization == undefined) {
            let passaporto: Passaporto | null;
            try {
                passaporto = await this.passaportoUtente(req, false);
            } catch (error) {
                log.warn('Passaporto Olimpo non ottenuto: chiamata non inviata', { destinazione: destinazioneDi(url), motivo: messaggioErrore(error) });
                return { risposta: this.nessunaRisposta<T>('passaporto', error), passaportoRifiutato: false };
            }
            if (passaporto && !passaporto.outsider) {
                // Il passaporto prevale sull'Authorization passato da chi chiama
                for (const nome of Object.keys(headers)) {
                    if (nome.toLowerCase() === 'authorization') delete headers[nome];
                }
                headers['Authorization'] = `Bearer ${passaporto.publicKey}`;
                conPassaporto = true;
            }
        }
        if (!(data instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            headers['Accept'] = 'application/json';
        }

        const jar = await this.getRequestCookieJar(req);
        const fetchWithCookies = this.fetchConCookie(jar, {
            // Il timeout esplicito prevale sulla categoria; senza categoria resta il default lungo di prima
            categoria: opzioni?.categoria ?? 'lunga',
            timeoutMs,
            idempotente: opzioni?.idempotente ?? false,
        });
        try {
            const response = await fetchWithCookies(url, {
                method,
                headers,
                body: method !== 'GET' && method !== 'HEAD' ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
            });

            // Handle binary responses (images, PDFs, etc)
            if (response.headers.get('Content-Type')?.includes('image') ||
                response.headers.get('Content-Type')?.includes('application/pdf') ||
                response.headers.get('Content-Type')?.includes('application/octet-stream')) {
                const buffer = await response.arrayBuffer();
                return {
                    risposta: {
                        data: buffer,
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    } as ApiResponse<T>,
                    passaportoRifiutato: false,
                };
            }

            // Handle text/JSON responses
            const responseText = await response.text();
            if (!response.ok) {
                // Stato reale e corpo interpretato: Istanta motiva gli errori nel JSON (es. 401 no_login)
                let corpoErrore: any = null;
                try { corpoErrore = responseText ? JSON.parse(responseText) : null; } catch { /* corpo non JSON */ }
                return {
                    risposta: {
                        data: corpoErrore,
                        status: response.status,
                        statusText: responseText || response.statusText,
                        headers: response.headers
                    },
                    passaportoRifiutato: conPassaporto && passaportoRifiutato(response.status, corpoErrore),
                };
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
                risposta: {
                    data: responseData,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                },
                passaportoRifiutato: false,
            };
        } catch (error) {
            // Nessuna risposta HTTP: status 0, il motivo in statusText e in motivo
            const motivo = error instanceof ErroreHttp ? error.motivo : undefined;
            log.warn('Nessuna risposta dal servizio', { destinazione: destinazioneDi(url), motivo: motivo ?? messaggioErrore(error) });
            return { risposta: this.nessunaRisposta<T>(motivo, error), passaportoRifiutato: false };
        }
    }

    /** Upload del tracciato su Istanta (FicoProcess/uploadTracciato), con il passaporto dell'utente. */
    static async sendToFicoApiAxiosUploadTracciato<T>(req: Request, data: any | FormData): Promise<ApiResponse<T>> {
        return this.caricaConPassaporto<T>(req, `${config.ISTANTA_IP_ADDRESS}/FicoProcess/uploadTracciato`, data);
    }

    /** Upload (POST) con il passaporto dell'utente; un Authorization in customHeaders prevale. */
    static async sendToFicoApiAxiosUpload<T>(req: Request, url: string, data: any | FormData, customHeaders?: Record<string, string>): Promise<ApiResponse<T>> {
        return this.caricaConPassaporto<T>(req, url, data, customHeaders);
    }

    /**
     * POST di un upload con il tempo massimo delle chiamate lunghe, senza ripetizioni. Come
     * sendToFICOApi non lancia: il corpo d'errore del servizio (es. { esito, error } di Istanta o
     * { error } di Olimpo) resta in data, status 0 con motivo se una risposta non arriva.
     */
    private static async caricaConPassaporto<T>(req: Request, url: string, data: any | FormData, customHeaders?: Record<string, string>): Promise<ApiResponse<T>> {
        let publicKey: string;
        try {
            publicKey = await this.getPassportFromOlympo(req);
        } catch (error) {
            log.warn('Passaporto Olimpo non ottenuto: upload non inviato', { destinazione: destinazioneDi(url), motivo: messaggioErrore(error) });
            return this.nessunaRisposta<T>('passaporto', error);
        }

        const headers: Record<string, string> = {
            ...(customHeaders?.['Authorization'] ? {} : { "Authorization": `Bearer ${publicKey}` }),
            ...headerDefiniti(customHeaders)
        };
        // Il Content-Type multipart, con il boundary, lo scrive fetch: impostato a mano romperebbe il corpo
        let corpo: FormData | string;
        if (data instanceof FormData) {
            corpo = data;
        } else {
            corpo = JSON.stringify(data);
            if (!customHeaders?.['Content-Type']) headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await chiamaHttp(url, { method: 'POST', headers, body: corpo, categoria: 'lunga' });
            const contenuto = await leggiCorpo(response);
            if (!response.ok) {
                if (passaportoRifiutato(response.status, contenuto)) invalidaPassaporto(req.session.id_utente);
                log.warn('Upload rifiutato dal servizio', { destinazione: destinazioneDi(url), status: response.status });
                return {
                    data: (contenuto ?? null) as any,
                    status: response.status,
                    statusText: response.statusText || `HTTP ${response.status}`,
                } as ApiResponse<T>;
            }
            return {
                data: contenuto as T,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            };
        } catch (error) {
            const motivo = error instanceof ErroreHttp ? error.motivo : undefined;
            log.warn('Upload senza risposta dal servizio', { destinazione: destinazioneDi(url), motivo: motivo ?? messaggioErrore(error) });
            return this.nessunaRisposta<T>(motivo, error);
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
        const resultCreazioneAttivita = await Attivita.create({
            idutente_attivita: idUtente ? idUtente == "System" ? null : idUtente : null,
            tipo_attivita: tipo,
            meta_attivita: meta,
            createdat: new Date()
        });
        // La notifica non blocca la registrazione e intercetta da se' i propri errori
        void ServerUtils.inviaNotificaAttivita(tipo, meta, idUtente);

        return resultCreazioneAttivita;
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
            if (result && Object.hasOwn(result, part)) {
                result = result[part];
            } else {
                return key; // fallback: restituisce la chiave stessa se non trovata
            }
        }

        return typeof result === 'string' ? result : key;
    }
}

export { ServerUtils };
