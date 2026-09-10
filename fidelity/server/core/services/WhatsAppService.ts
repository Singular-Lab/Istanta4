import fetch from 'node-fetch';
import crypto from 'node:crypto';
import { Op, QueryTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../logger';
import {
    CATEGORIA_TEMPLATE_WHATSAPP,
    STATO_GDO_WHATSAPP_TEMPLATE,
    STATO_UTENTI,
    TIPO_UTENTI
} from '../../../lib/enums';
import {
    BadRequestError,
    BusinessError,
    DatabaseError,
    ExternalApiError,
    NotFoundError,
    ValidationError,
    wrapDatabaseError
} from '../../../lib/errors';
import { Colorize } from '../../../lib/Colorize';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import {
    UtentiCanaliInterazioneAttributes,
    type GDOWhatsappTemplateAttributes,
    type WhatsAppTemplate
} from '../../../lib/types';
import { sequelize } from '../db';
import type { GDOResponseDTO } from '../dto';
import type { IUserService } from '../interfaces/IUserService';
import { IWhatsAppService } from '../interfaces/IWhatsAppService';
import { GDO, Utente, UtentiGDO } from '../models';
import { GDOWhatsappNumbers } from '../models/whatsapp/gdo_whatsapp_numbers';
import { GDOWhatsappPreset } from '../models/whatsapp/gdo_whatsapp_preset';
import { GDOWhatsappTemplate } from '../models/whatsapp/gdo_whatsapp_template';
import { WhatsappQueueService } from './WhatsappQueueService';

type PresetBinding = {
    bind?: string;   // "user.cognome" | "user.meta.city" | "literal" ecc.
    value?: any;
    sample?: any;
};

type PresetMeta = Record<string, PresetBinding>;
type UserData = Record<string, any>;

type ParamDetail = {
    positionType: 'BODY' | 'BUTTON';
    key: string;           // es: "body:1", "btn:0:1"
    source: 'user' | 'literal' | 'example' | 'empty';
    path?: string;         // es: "cognome", "meta.city"
    value: any;
    note?: string;
};

type MapResult = {
    params: any[];
    details: ParamDetail[];
};

export class WhatsAppService implements IWhatsAppService {
    private userService: IUserService;

    constructor(userService: IUserService) {
        this.userService = userService;
    }

    // ---------- HELPERS PRIVATI PER LA MAPPATURA TEMPLATE/PRESET/UTENTE ----------

    /**
     * Estrae e ordina i placeholder {{n}} da una stringa di template.
     */
    private extractPlaceholders(text: string): number[] {
        const regex = /{{\s*(\d+)\s*}}/g;
        const found = new Set<number>();
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            found.add(Number(match[1]));
        }

        return Array.from(found).sort((a, b) => a - b);
    }

    /**
     * Lookup annidato tipo "meta.city" su un oggetto arbitrario.
     */
    private getNested(obj: any, path: string): any {
        if (!obj || !path) return undefined;
        return path
            .split('.')
            .reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
    }

    /**
     * Fallback chain: value -> sample -> example -> ''.
     * Gestisce anche bind "user.xxx" / "user.meta.city".
     */
    private resolveBinding(
        binding: PresetBinding | undefined,
        user: UserData,
        exampleValue: any
    ): { value: any; source: ParamDetail['source']; path?: string } {
        if (!binding) {
            if (exampleValue !== undefined) {
                return { value: exampleValue, source: 'example' };
            }
            return { value: '', source: 'empty' };
        }

        const { bind, value, sample } = binding;

        // Bind tipo "user.xxx" o "user.meta.city"
        if (bind && bind.startsWith('user.')) {
            const path = bind.slice('user.'.length);
            const userValue = this.getNested(user, path);

            if (userValue !== undefined && userValue !== null) {
                return { value: userValue, source: 'user', path };
            }

            // Se il bind user non risolve, cado su literal/example
            if (value !== undefined) {
                return { value, source: 'literal', path };
            }
            if (sample !== undefined) {
                return { value: sample, source: 'literal', path };
            }
            if (exampleValue !== undefined) {
                return { value: exampleValue, source: 'example', path };
            }
            return { value: '', source: 'empty', path };
        }

        // Bind dichiarato come "literal"
        if (bind === 'literal') {
            if (value !== undefined) {
                return { value, source: 'literal' };
            }
            if (sample !== undefined) {
                return { value: sample, source: 'literal' };
            }
            if (exampleValue !== undefined) {
                return { value: exampleValue, source: 'example' };
            }
            return { value: '', source: 'empty' };
        }

        // Fallback generico (bind non riconosciuto, ma magari c'è value/sample)
        if (value !== undefined) {
            return { value, source: 'literal' };
        }
        if (sample !== undefined) {
            return { value: sample, source: 'literal' };
        }
        if (exampleValue !== undefined) {
            return { value: exampleValue, source: 'example' };
        }

        return { value: '', source: 'empty' };
    }

    /**
     * Core di mappatura: ritorna sia i params POSITIONAL sia i dettagli della mappatura.
     */
    private buildTemplateParams(
        template: WhatsAppTemplate,
        presetMeta: PresetMeta,
        user: UserData = {}
    ): MapResult {
        if (!template || template.parameter_format !== 'POSITIONAL') {
            return { params: [], details: [] };
        }

        const params: any[] = [];
        const details: ParamDetail[] = [];

        const bodyComponent = template.components?.find(
            c => c.type === 'BODY'
        ) as any;
        const buttonsComponent = template.components?.find(
            c => c.type === 'BUTTONS'
        ) as any;

        // ---------- BODY ----------
        if (bodyComponent?.text) {
            const placeholders = this.extractPlaceholders(bodyComponent.text); // es: [1, 2, 3]

            placeholders.forEach(position => {
                const key = `body:${position}`;
                const binding = presetMeta[key];

                // Example dal template: body_text[0] è il primo set di esempi
                const exampleValue =
                    bodyComponent.example?.body_text?.[0]?.[position - 1];

                const resolved = this.resolveBinding(binding, user, exampleValue);

                params.push(resolved.value);
                details.push({
                    positionType: 'BODY',
                    key,
                    source: resolved.source,
                    path: resolved.path,
                    value: resolved.value,
                    note: !binding
                        ? 'Nessun binding nel preset, usato example/empty'
                        : undefined
                });
            });
        }

        // ---------- BUTTONS ----------
        if (buttonsComponent?.buttons && Array.isArray(buttonsComponent.buttons)) {
            buttonsComponent.buttons.forEach((btn: any, btnIndex: number) => {
                const urlText = btn.url ?? '';
                const placeholders = this.extractPlaceholders(urlText); // es: [1, 2]

                placeholders.forEach(position => {
                    const key = `btn:${btnIndex}:${position}`;
                    const binding = presetMeta[key];

                    // example dei buttons è array: [ex1, ex2, ...] per {{1}}, {{2}}, ...
                    const exampleValue = Array.isArray(btn.example)
                        ? btn.example[position - 1]
                        : undefined;

                    const resolved = this.resolveBinding(binding, user, exampleValue);

                    params.push(resolved.value);
                    details.push({
                        positionType: 'BUTTON',
                        key,
                        source: resolved.source,
                        path: resolved.path,
                        value: resolved.value,
                        note: !binding
                            ? 'Nessun binding nel preset per questo btn, usato example/empty'
                            : undefined
                    });
                });
            });
        }

        return { params, details };
    }

    /**
     * Mappa i valori dal preset al template WhatsApp, restituendo i parametri corretti per la chiamata.
     * ATTENZIONE: qui ci aspettiamo il JSON del template Meta (non il record DB grezzo).
     * @param template Oggetto template WhatsApp (json_meta_gdowhatsapptemplate)
     * @param preset Oggetto preset (json_meta_gdowhatsappreset)
     * @param user Dati utente (opzionale, per bind user)
     * @returns Array di parametri ordinati per posizione (BODY, BUTTONS, ecc)
     */
    mapPresetToTemplateParams(
        template: WhatsAppTemplate,
        preset: PresetMeta,
        user: UserData = {}
    ): any[] {
        const { params, details } = this.buildTemplateParams(template, preset, user);

        // Log di debug leggibile
        console.debug(
            Colorize.green('[WhatsAppService] Mappatura template/preset utente:'),
            JSON.stringify(details, null, 2)
        );

        return params;
    }


    /**
 * Ritorna una copia del template con i placeholder {{n}} sostituiti usando l'array params
 * L'ordine è lo stesso di mapPresetToTemplateParams:
 *  - prima tutti i BODY (in ordine di indice placeholder)
 *  - poi tutti i BUTTONS (in ordine di index bottone e indice placeholder)
 *
 * @param template Template WhatsApp (json_meta_gdowhatsapptemplate)
 * @param params   Array di parametri POSITIONAL già mappati
 */
    applyParamsToTemplate(
        template: any,
        params: any[]
    ): WhatsAppTemplate {
        // Clone profondo per non mutare l'originale
        const result = JSON.parse(JSON.stringify(template));
        let cursor = 0;
        // Helper locale: estrae placeholder {{n}} da una stringa
        const extractPlaceholders = (text: string): number[] => {
            const regex = /{{\s*(\d+)\s*}}/g;
            const found = new Set<number>();
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
                found.add(Number(match[1]));
            }
            return Array.from(found).sort((a, b) => a - b);
        };

        // Helper locale: sostituisce tutte le occorrenze di {{n}} con i values
        const replacePlaceholders = (
            text: string,
            placeholders: number[],
            values: any[]
        ): string => {
            let out = text;
            placeholders.forEach((position, idx) => {
                const value = values[idx] ?? '';
                const re = new RegExp(`{{\\s*${position}\\s*}}`, 'g');
                out = out.replace(re, String(value));
            });
            return out;
        };

        // BODY
        const bodyComponent = result.components?.find((c: any) => c.type === 'BODY');
        if (bodyComponent?.text) {
            const placeholders = extractPlaceholders(bodyComponent.text); // es: [1]
            const values = placeholders.map(() => params[cursor++] ?? '');
            bodyComponent.text = replacePlaceholders(
                bodyComponent.text,
                placeholders,
                values
            );
        }

        // BUTTONS
        const buttonsComponent = result.components?.find(
            (c: any) => c.type === 'BUTTONS'
        );
        if (buttonsComponent && Array.isArray(buttonsComponent.buttons)) {
            buttonsComponent.buttons.forEach((btn: any) => {
                if (typeof btn.url === 'string') {
                    const placeholders = extractPlaceholders(btn.url); // es: [1]
                    const values = placeholders.map(() => params[cursor++] ?? '');
                    btn.url = replacePlaceholders(btn.url, placeholders, values);
                }

                // Se un domani avrai placeholder anche nel text del bottone:
                // if (typeof btn.text === 'string') {
                //   const placeholdersText = extractPlaceholders(btn.text);
                //   const valuesText = placeholdersText.map(() => params[cursor++] ?? '');
                //   btn.text = replacePlaceholders(btn.text, placeholdersText, valuesText);
                // }
            });
        }

        return result;
    }
    /**
 * Costruisce il payload compatibile con Meta Cloud API per inviare un template.
 * VERSIONE CORRETTA secondo documentazione Meta
 *
 * @param recipient     numero destinatario in E.164 (es. "393341570547")
 * @param templateMeta  Oggetto template WhatsApp (json_meta_gdowhatsapptemplate)
 * @param params        Array di valori POSITIONAL già calcolati
 * @returns             Oggetto payload pronto da inviare a /{PHONE_NUMBER_ID}/messages
 */
    buildMetaTemplatePayload(
        recipient: string,
        templateMeta: any,
        params: any[],
    ): any {
        const tpl = JSON.parse(JSON.stringify(templateMeta));

        const getLanguageCode = (lang: any): string =>
            typeof lang === 'string' ? lang : (lang?.code ?? 'en');

        const payload: any = {
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'template',
            template: {
                name: tpl.name,
                language: { code: getLanguageCode(tpl.language) },
                components: [] as any[],
            },
        };

        // Helper: trova placeholder {{n}} in una stringa
        const extractPlaceholders = (text?: string): number[] => {
            if (!text || typeof text !== 'string') return [];
            const regex = /{{\s*(\d+)\s*}}/g;
            const found = new Set<number>();
            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                found.add(Number(match[1]));
            }
            return Array.from(found).sort((a, b) => a - b);
        };

        let cursor = 0;
        const totalParams = params.length;

        const isPositional = tpl.parameter_format === 'POSITIONAL';

        // 1) HEADER
        const headerComponent = tpl.components?.find((c: any) => c.type === 'HEADER');
        if (headerComponent) {
            const headerParams: any[] = [];

            // Header con testo e placeholder
            if (headerComponent.format === 'TEXT' && headerComponent.text) {
                const placeholders = extractPlaceholders(headerComponent.text);
                placeholders.forEach(() => {
                    const value = cursor < totalParams ? params[cursor++] : '';
                    headerParams.push({ type: 'text', text: String(value) });
                });
            }
            // Header con media (IMAGE, VIDEO, DOCUMENT)
            else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format)) {
                // Per media header, il parametro deve essere passato se presente
                if (cursor < totalParams && params[cursor]) {
                    const mediaType = headerComponent.format.toLowerCase();
                    headerParams.push({
                        type: mediaType,
                        [mediaType]: params[cursor++]
                    });
                }
            }

            if (headerParams.length > 0) {
                payload.template.components.push({
                    type: 'header',
                    parameters: headerParams,
                });
            }
        }

        // 2) BODY
        const bodyComponent = tpl.components?.find((c: any) => c.type === 'BODY');
        if (bodyComponent?.text) {
            const placeholders = extractPlaceholders(bodyComponent.text);

            if (placeholders.length > 0) {
                const parameters = placeholders.map((position) => {
                    const value = cursor < totalParams ? params[cursor++] : '';
                    const param: any = {
                        type: 'text',
                        text: String(value)
                    };

                    // Se il template usa NAMED parameters, aggiungi parameter_name
                    if (!isPositional && bodyComponent.example?.body_text?.[0]?.[position - 1]) {
                        param.parameter_name = `body_param_${position}`;
                    }

                    return param;
                });

                payload.template.components.push({
                    type: 'body',
                    parameters,
                });
            }
        }

        // 3) BUTTONS
        const buttonsComponent = tpl.components?.find((c: any) => c.type === 'BUTTONS');
        if (buttonsComponent?.buttons && Array.isArray(buttonsComponent.buttons)) {
            buttonsComponent.buttons.forEach((btn: any, btnIndex: number) => {
                // Determina il sub_type del bottone
                let subType: string;
                let hasParameters = false;

                // URL button con placeholder
                if (btn.type === 'URL' && btn.url) {
                    const urlPlaceholders = extractPlaceholders(btn.url);
                    if (urlPlaceholders.length > 0) {
                        hasParameters = true;
                        subType = 'url';

                        const parameters = urlPlaceholders.map(() => {
                            const value = cursor < totalParams ? params[cursor++] : '';
                            return { type: 'text', text: String(value) };
                        });

                        payload.template.components.push({
                            type: 'button',
                            sub_type: subType,
                            index: String(btnIndex),
                            parameters,
                        });
                    }
                }
                // QUICK_REPLY button - potrebbero avere payload dinamici
                else if (btn.type === 'QUICK_REPLY') {
                    // I quick reply generalmente non hanno parameters a meno che non abbiano payload dinamici
                    // Se il tuo template li richiede, gestiscili qui
                    if (btn.example && Array.isArray(btn.example) && btn.example.length > 0) {
                        hasParameters = true;
                        const value = cursor < totalParams ? params[cursor++] : btn.example[0];

                        payload.template.components.push({
                            type: 'button',
                            sub_type: 'quick_reply',
                            index: String(btnIndex),
                            parameters: [{ type: 'payload', payload: String(value) }],
                        });
                    }
                }
                // PHONE_NUMBER button
                else if (btn.type === 'PHONE_NUMBER') {
                    // I phone number button generalmente non hanno parameters
                }
            });
        }

        // 4) FOOTER - generalmente non ha parametri
        // I footer sono statici, quindi non serve aggiungere nulla

        // Log di debug
        if (cursor !== totalParams) {
            console.warn(
                `[WhatsAppService] buildMetaTemplatePayload: params non allineati ` +
                `(usati: ${cursor}/${totalParams}). Verifica la mappatura del preset.`
            );
        }

        console.debug(
            '[WhatsAppService] Payload finale per Meta:',
            JSON.stringify(payload, null, 2)
        );

        return payload;
    }
    // ---------------------------------------------------------------------------
    //                              METODI PUBBLICI
    // ---------------------------------------------------------------------------

    async invioDiTestAdUtente(
        id_utente: string,
        id_template: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            if (!id_utente || !id_template) {
                throw new ValidationError({
                    message: 'ID utente o ID template non forniti',
                    field: !id_utente ? 'id_utente' : 'id_template',
                    constraint: 'required'
                });
            }

            const utente = await this.userService.getUserById(id_utente);
            if (!utente) {
                throw new NotFoundError({
                    message: 'Utente non trovato',
                    entityType: 'Utente',
                    entityId: id_utente
                });
            }

            const templateRecord = await this.getWhatsappTemplateById(id_template);
            if (!templateRecord) {
                throw new NotFoundError({
                    message: 'Template non trovato',
                    entityType: 'WhatsAppTemplate',
                    entityId: id_template
                });
            }

            // Template Meta grezzo
            const templateMeta = templateRecord
                .json_meta_gdowhatsapptemplate as WhatsAppTemplate | undefined;
            if (!templateMeta) {
                throw new BadRequestError({
                    message: 'json_meta_gdowhatsapptemplate non presente sul template',
                    details: { templateId: id_template }
                });
            }

            const defaultPresetRecord = await GDOWhatsappPreset.findOne({
                where: {
                    id_template_gdowhatsappreset: id_template,
                    is_default_gdowhatsappreset: true
                }
            });

            console.log(
                `Invio messaggio di test all'utente ${utente.nome} (${utente.telefono}) con il template ${templateRecord.nome_template_gdowhatsapptemplate}`
            );
            if (defaultPresetRecord) {
                console.log(
                    `Utilizzo del preset di default: ${defaultPresetRecord.nome_preset_gdowhatsappreset}`
                );
            }

            // Se esiste un preset di default usiamo il suo JSON, altrimenti un preset vuoto
            const presetMeta: PresetMeta =
                (defaultPresetRecord?.json_meta_gdowhatsappreset as PresetMeta) ?? {};

            // Adesso con le regole date dal preset riempiamo il template con i dati corretti
            const params = this.mapPresetToTemplateParams(templateMeta, presetMeta, utente);

            const gdoId = templateRecord.id_gdo_gdowhatsapptemplate;
            const credenziali = await GDOWhatsappNumbers.findOne({
                where: { id_gdo_gdowhatsappnumbers: gdoId }
            });
            if (!credenziali) {
                throw new NotFoundError({
                    message: 'Credenziali WhatsApp non trovate per il GDO',
                    entityType: 'GDOWhatsappNumbers',
                    entityId: gdoId,
                    details: { code: ErrorCodes.WA_CREDENTIALS_MISSING }
                });
            }

            const phoneNumberId =
                credenziali.id_numero_whatsapp_gdowhatsappnumbers; // <-- assicurati che questo sia il phone_number_id Meta
            const accessToken = credenziali.access_token_gdowhatsappnumbers;

            if (!phoneNumberId || !accessToken) {
                throw new ValidationError({
                    message: 'phone_number_id o access_token mancanti',
                    field: !phoneNumberId ? 'phone_number_id' : 'access_token',
                    constraint: 'required',
                    details: { code: ErrorCodes.WA_CREDENTIALS_MISSING }
                });
            }
            /*
            "template": {
    "name": "{TEMPLATE_NAME}",
    "language": {
      "code": "{LANGUAGE_CODE}"         // es. "it", "en_US"
    },
    "components": [
       uno o più componenti: header (opzionale), body (obbligatorio), footer (opzionale), buttons (opzionale)
    ]
            */
            const payload = this.buildMetaTemplatePayload(
                utente.telefono as string,
                templateMeta,
                params
            );
            const response = await fetch(
                `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        authorization: `Bearer ${accessToken}`
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const error = await response.json() as any;
                console.error('Errore API Meta (send message):', error);
                return {
                    success: false,
                    error: `Errore API Meta: ${error.error?.message}`
                };
            }

            const data = await response.json();
            console.log('Risposta invio test Meta:', data);
            // TODO: qui effettueresti la vera chiamata a Meta con il template e i params

            return { success: true, error: undefined };
        } catch (error) {
            console.error(
                Colorize.bgRed("Errore durante l'invio del test all'utente:"),
                error
            );
            return {
                success: false,
                error:
                    "Errore durante l'invio del test all'utente: " +
                    (error instanceof Error ? error.message : 'Errore sconosciuto')
            };
        }
    }

    async getCurrentGDOWhatsappForCampaign(
        id_utente: string
    ): Promise<GDOResponseDTO | null> {
        try {
            const gdoUtente = await UtentiGDO.findOne({
                where: { id_utente_utentegdo: id_utente }
            });

            if (!gdoUtente) {
                return null;
            }

            const gdo = await GDO.findOne({
                where: { id_gdo: gdoUtente.id_gdo_utentegdo }
            });

            if (!gdo) {
                return null;
            }

            const check_is_parent = await GDO.findAll({
                where: { idparent_gdo: gdo.id_gdo }
            });

            const returnGDO: GDOResponseDTO = {
                id: gdo.id_gdo,
                nome: gdo.nome_gdo,
                id_parent: gdo.idparent_gdo ?? '',
                ragione_sociale: gdo.ragione_sociale_gdo,
                createdat: gdo.createdat,
                updatedat: gdo.updatedat,
                is_parent: check_is_parent.length > 0,
                has_children: check_is_parent.length > 0
            };

            return returnGDO;
        } catch (error) {
            console.error(
                Colorize.bgRed(
                    'Errore durante il recupero del GDO WhatsApp per la campagna:'
                ),
                error
            );
            throw new DatabaseError({
                message:
                    'Errore durante il recupero del GDO WhatsApp per la campagna',
                operation: 'getCurrentGDOWhatsappForCampaign',
                entity: 'GDOWhatsappTemplate'
            });
        }
    }

    async sendModifiedTemplateToMeta(id_template: string): Promise<any> {
        const template = await GDOWhatsappTemplate.findOne({
            where: { id_gdowhatsapptemplate: id_template }
        });

        if (!template) {
            return { success: false, error: 'Template non trovato' };
        }

        // Credenziali GDO
        const gdoId = template.id_gdo_gdowhatsapptemplate;
        const credenziali = await GDOWhatsappNumbers.findOne({
            where: { id_gdo_gdowhatsappnumbers: gdoId }
        });

        if (!credenziali) {
            return {
                success: false,
                error: 'Credenziali WhatsApp non trovate per il GDO'
            };
        }

        // Oggetto JSON che arriva dal client / è salvato in DB
        const raw = template.json_meta_gdowhatsapptemplate as any;

        // CREARE PAYLOAD COMPATIBILE CON META
        const payload = {
            name: raw.name,
            category: raw.category,
            language: raw.language?.code ?? raw.language, // supporta sia string che {code:"it"}
            components: raw.components
        };

        const response = await fetch(
            `https://graph.facebook.com/v24.0/${credenziali.whatsapp_business_account_id_gdowhatsappnumbers}/message_templates`,
            {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    authorization: `Bearer ${credenziali.access_token_gdowhatsappnumbers}`
                },
                body: JSON.stringify(payload)
            }
        );

        if (!response.ok) {
            const error = (await response.json()) as any;
            throw new ExternalApiError({
                service: 'Meta WhatsApp API',
                statusCode: response.status,
                message: `Errore API Meta: ${error.error?.message}`,
                details: error
            });
        }

        const data = (await response.json()) as any;
        const newJSONWithId = {
            ...raw,
            id: data.id
        };

        await template.update({
            stato_meta_gdowhatsapptemplate:
                data.status as STATO_GDO_WHATSAPP_TEMPLATE,
            json_meta_gdowhatsapptemplate: newJSONWithId
        });

        return { success: true };
    }

    async inviaBroadcastMessaggi(
        msg: string
    ): Promise<{ successo: boolean; errore?: string }> {
        try {
            const arrRub = await this.userService.getUtentiWhatsappAttivi();
            let error = '';

            for (const item of arrRub) {
                try {
                    const response = await fetch(
                        'https://waapi.app/api/v1/instances/30974/client/action/send-message',
                        {
                            method: 'POST',
                            headers: {
                                accept: 'application/json',
                                'content-type': 'application/json',
                                authorization: 'Bearer ' + process.env['WHATSAPP_API_KEY']
                            },
                            body: JSON.stringify({
                                chatId: `39${item.telefono_utenti}@c.us`,
                                message: msg
                            })
                        }
                    );

                    if (!response.ok) {
                        error += `Errore nell'invio del messaggio a 39${item.telefono_utenti}: HTTP ${response.status}\n`;
                    }
                } catch (err: any) {
                    error += `Errore nell'invio del messaggio a 39${item.telefono_utenti}: ${err.message}\n`;
                }
            }

            if (error) {
                return { successo: false, errore: error };
            }
            return { successo: true };
        } catch (error) {
            console.error(
                Colorize.bgRed(
                    "Errore durante l'invio dei messaggi broadcast:"
                ),
                error
            );
            throw new ExternalApiError({
                message: "Errore durante l'invio dei messaggi broadcast",
                service: 'WhatsApp',
                endpoint: 'send-message',
                details: { code: ErrorCodes.WA_BROADCAST_FAILED },
                cause: error instanceof Error ? error : undefined
            });
        }
    }

    async registraUtenteWhatsapp(data: {
        email: string;
        nome: string;
        cognome: string;
        password: string;
        tipo: string;
        residenza: string;
        dataDiNascita: Date;
        gdoScelta: string;
        telefono: string;
    }): Promise<{ successo: boolean; errore?: string }> {
        try {
            const utente = await this.userService.checkUserByPhone(data.telefono);
            if (utente) {
                return { successo: false, errore: 'Utente già registrato' };
            }

            const userId = uuidv4();
            const utenteData = {
                id_utenti: userId,
                email_utenti: data.email,
                nome_utenti: data.nome,
                cognome_utenti: data.cognome,
                password_utenti: data.password,
                tipo_utenti: TIPO_UTENTI.GUEST,
                stato_utenti: STATO_UTENTI.DISATTIVO,
                residenza_utenti: data.residenza,
                datadinascita_utenti: data.dataDiNascita,
                telefono_utenti: data.telefono,
                outsider_utenti: false
            };

            const utenteGDO = {
                id_utente_utentegdo: userId,
                id_gdo_utentegdo: data.gdoScelta
            };

            const utenteCanaliInterazioni: UtentiCanaliInterazioneAttributes = {
                id_UtentiCanaliInterazione: userId,
                idUtente_UtentiCanaliInterazione: userId,
                idCanaleInterazione_UtentiCanaliInterazione: data.gdoScelta
            };

            await this.userService.registerUserWithChannels(
                utenteData,
                utenteGDO,
                utenteCanaliInterazioni
            );

            return { successo: true };
        } catch (error) {
            console.error(
                Colorize.bgRed(
                    "Errore durante la registrazione dell'utente WhatsApp:"
                ),
                error
            );
            throw new DatabaseError({
                message: "Errore durante la registrazione dell'utente WhatsApp",
                operation: 'registerUserWithChannels',
                entity: 'Utente',
                cause: error instanceof Error ? error : undefined
            });
        }
    }

    async getAllGDOWhatsapp(): Promise<
        {
            id: string;
            nome: string;
            id_parent: string;
            is_parent: boolean;
            has_children: boolean;
            wa_number?: string;
            id_whatsapp_number?: string;
            ragione_sociale?: string;
            email?: string;
            stato?: string;
        }[]
    > {
        try {
            const gdoList = await GDO.findAll();

            const gdoResponseList = await Promise.all(
                gdoList.map(async gdo => {
                    const numbers = await GDOWhatsappNumbers.findOne({
                        where: { id_gdo_gdowhatsappnumbers: gdo.id_gdo }
                    });

                    if (gdo.idparent_gdo === null || gdo.idparent_gdo === undefined) {
                        gdo.idparent_gdo = '';
                    }

                    const check_is_parent = await GDO.findAll({
                        where: { idparent_gdo: gdo.id_gdo }
                    });

                    return {
                        id: gdo.id_gdo,
                        nome: gdo.nome_gdo,
                        id_parent: gdo.idparent_gdo,
                        is_parent: check_is_parent.length > 0,
                        has_children: check_is_parent.length > 0,
                        ragione_sociale: gdo.ragione_sociale_gdo,
                        wa_number: numbers?.id_numero_whatsapp_gdowhatsappnumbers,
                        id_whatsapp_number: numbers?.id_gdowhatsappnumbers,
                        email: '',
                        stato: numbers?.stato_gdowhatsappnumbers
                    };
                })
            );

            return gdoResponseList;
        } catch (error) {
            throw wrapDatabaseError(error, {
                operation: 'findAll',
                entity: 'GDO',
                message: `Errore nella ricerca di tutti i GDO`
            });
        }
    }

    async getGDOWhatsappById(
        gdoId: string
    ): Promise<{
        id: string;
        id_gdo: string;
        id_numero_whatsapp: string;
        display_name: string;
        stato: string;
        provider: string;
        whatsapp_business_account_id: string;
        access_token?: string;
        verify_token?: string;
        nome: string;
        createdat?: Date;
        updatedat?: Date;
    } | null> {
        try {
            const gdoWhatsappNumber = await GDOWhatsappNumbers.findOne({
                where: { id_gdo_gdowhatsappnumbers: gdoId }
            });
            const gdo = await GDO.findOne({
                where: { id_gdo: gdoId }
            });

            if (!gdoWhatsappNumber) {
                return null;
            }

            return {
                id: gdoWhatsappNumber.id_gdowhatsappnumbers ?? '',
                id_gdo: gdoWhatsappNumber.id_gdo_gdowhatsappnumbers ?? '',
                id_numero_whatsapp:
                    gdoWhatsappNumber.id_numero_whatsapp_gdowhatsappnumbers ?? '',
                display_name: gdoWhatsappNumber.display_name_gdowhatsappnumbers ?? '',
                stato: gdoWhatsappNumber.stato_gdowhatsappnumbers ?? '',
                provider: gdoWhatsappNumber.provider_gdowhatsappnumbers ?? '',
                whatsapp_business_account_id:
                    gdoWhatsappNumber.whatsapp_business_account_id_gdowhatsappnumbers ??
                    '',
                access_token: gdoWhatsappNumber.access_token_gdowhatsappnumbers,
                verify_token: gdoWhatsappNumber.verify_token_gdowhatsappnumbers,
                createdat: gdoWhatsappNumber.createdat,
                nome: gdo ? gdo.nome_gdo : '',
                updatedat: gdoWhatsappNumber.updatedat
            };
        } catch (error) {
            throw wrapDatabaseError(error, {
                operation: 'findOne',
                entity: 'GDOWhatsappNumbers',
                message: `Errore nella ricerca del numero WhatsApp per GDO con id ${gdoId}`
            });
        }
    }

    async getAllTemplatesWhatsappByGdo(
        idGdo: string
    ): Promise<
        (GDOWhatsappTemplateAttributes & { preset_count: number; has_preset: boolean })[]
    > {
        try {
            const templates = await GDOWhatsappTemplate.findAll({
                where: { id_gdo_gdowhatsapptemplate: idGdo }
            });

            const templatesWithPresetCount = await Promise.all(
                templates.map(async template => {
                    const presets = await GDOWhatsappPreset.findAll({
                        where: {
                            id_template_gdowhatsappreset: template.id_gdowhatsapptemplate
                        }
                    });
                    return {
                        ...template.toJSON(),
                        preset_count: presets.length,
                        has_preset: presets.length > 0
                    };
                })
            );

            return templatesWithPresetCount;
        } catch (error) {
            throw wrapDatabaseError(error, {
                operation: 'findOne',
                entity: 'GDOTemplatesWhatsapp',
                message: `Errore nella ricerca del numero WhatsApp per GDO con id ${idGdo}`
            });
        }
    }

    async getWhatsappTemplateById(
        id: string
    ): Promise<GDOWhatsappTemplateAttributes | null> {
        try {
            const template = await GDOWhatsappTemplate.findOne({
                where: { id_gdowhatsapptemplate: id }
            });

            return template as unknown as GDOWhatsappTemplateAttributes | null;
        } catch (error) {
            throw wrapDatabaseError(error, {
                operation: 'findOne',
                entity: 'GDOTemplatesWhatsapp',
                message: `Errore nella ricerca del template WhatsApp con id ${id}`
            });
        }
    }

    async syncTemplatesFromMeta(
        gdoId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(
                `Sincronizzazione dei template WhatsApp per GDO con id ${gdoId} da Meta...`
            );

            const credenziali = await GDOWhatsappNumbers.findOne({
                where: { id_gdo_gdowhatsappnumbers: gdoId }
            });

            if (!credenziali) {
                console.error(
                    Colorize.bgRed(`Nessuna credenziale trovata per GDO con id ${gdoId}`)
                );
                return {
                    success: false,
                    error: `Nessuna credenziale trovata per GDO con id ${gdoId}`
                };
            }

            const response = await fetch(
                `https://graph.facebook.com/v24.0/${credenziali.whatsapp_business_account_id_gdowhatsappnumbers}/message_templates`,
                {
                    method: 'GET',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        authorization: `Bearer ${credenziali.access_token_gdowhatsappnumbers}`
                    }
                }
            );

            if (!response.ok) {
                const error = (await response.json()) as any;
                console.error('Errore API Meta:', error);
                return {
                    success: false,
                    error: `Errore API Meta: ${error.error?.message}`
                };
            }

            const data = (await response.json()) as any;
            const templates = data.data as WhatsAppTemplate[];
            console.log(`Template ricevuti da Meta:`, templates);

            const existingTemplates = await GDOWhatsappTemplate.findAll({
                where: { id_gdo_gdowhatsapptemplate: gdoId }
            });

            const existingTemplatesMap = new Map(
                existingTemplates.map(et => [
                    (et.json_meta_gdowhatsapptemplate as any)?.id,
                    et
                ])
            );

            let newCount = 0;
            let updatedCount = 0;

            for (const template of templates) {
                const existingTemplate = existingTemplatesMap.get(template.id);

                if (!existingTemplate) {
                    await GDOWhatsappTemplate.create({
                        id_gdo_gdowhatsapptemplate: gdoId,
                        nome_template_gdowhatsapptemplate: template.name,
                        lingua_template_gdowhatsapptemplate: String(template.language),
                        stato_meta_gdowhatsapptemplate:
                            template.status as STATO_GDO_WHATSAPP_TEMPLATE,
                        categoria_template_gdowhatsapptemplate:
                            template.category as CATEGORIA_TEMPLATE_WHATSAPP,
                        json_meta_gdowhatsapptemplate: template
                    });
                    console.log(`✓ Template ${template.name} salvato nel DB.`);
                    newCount++;
                } else {
                    const existingJson = JSON.stringify(
                        existingTemplate.json_meta_gdowhatsapptemplate
                    );
                    const newJson = JSON.stringify(template);

                    if (existingJson !== newJson) {
                        await existingTemplate.update({
                            nome_template_gdowhatsapptemplate: template.name,
                            lingua_template_gdowhatsapptemplate: String(template.language),
                            stato_meta_gdowhatsapptemplate:
                                template.status as STATO_GDO_WHATSAPP_TEMPLATE,
                            categoria_template_gdowhatsapptemplate:
                                template.category as CATEGORIA_TEMPLATE_WHATSAPP,
                            json_meta_gdowhatsapptemplate: template
                        });
                        console.log(`↻ Template ${template.name} aggiornato nel DB.`);
                        updatedCount++;
                    }
                }
            }

            console.log(
                Colorize.green(
                    `Sincronizzazione completata: ${newCount} nuovi, ${updatedCount} aggiornati`
                )
            );
            return { success: true };
        } catch (error) {
            console.error(
                Colorize.bgRed(
                    'Errore durante la sincronizzazione dei template WhatsApp da Meta:'
                ),
                error
            );
            return {
                success: false,
                error:
                    'Errore durante la sincronizzazione dei template WhatsApp da Meta'
            };
        }
    }

    async salvaInLocaleTemplateWhatsappSuperAdminPayload(
        id_template: string,
        payload: any
    ): Promise<{ success: boolean; newTemplateId: string; error?: string }> {
        try {
            const existingTemplate = await GDOWhatsappTemplate.findOne({
                where: { id_gdowhatsapptemplate: id_template }
            });

            if (!existingTemplate) {
                return {
                    newTemplateId: '',
                    success: false,
                    error: `Template con id ${id_template} non trovato`
                };
            }

            if (
                existingTemplate.stato_meta_gdowhatsapptemplate ===
                STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED
            ) {
                await existingTemplate.update({
                    nome_template_gdowhatsapptemplate:
                        payload.name || existingTemplate.nome_template_gdowhatsapptemplate,
                    lingua_template_gdowhatsapptemplate: String(payload.language.code),
                    categoria_template_gdowhatsapptemplate:
                        payload.category as CATEGORIA_TEMPLATE_WHATSAPP,
                    stato_meta_gdowhatsapptemplate:
                        STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED,
                    json_meta_gdowhatsapptemplate: {
                        ...existingTemplate.json_meta_gdowhatsapptemplate,
                        ...payload
                    }
                });

                return {
                    success: true,
                    newTemplateId: existingTemplate.id_gdowhatsapptemplate || ''
                };
            } else {
                let baseName =
                    payload.name || existingTemplate.nome_template_gdowhatsapptemplate;
                let version = 2;
                const versionRegex = /_v(\d+)$/;
                const match = baseName.match(versionRegex);

                if (match) {
                    version = parseInt(match[1], 10) + 1;
                    baseName = baseName.replace(versionRegex, '');
                }

                const nuovoNome = `${baseName}_v${version}`;

                const nuovaVersione = await GDOWhatsappTemplate.create({
                    id_gdo_gdowhatsapptemplate:
                        existingTemplate.id_gdo_gdowhatsapptemplate,
                    nome_template_gdowhatsapptemplate: nuovoNome,
                    lingua_template_gdowhatsapptemplate: String(payload.language.code),
                    categoria_template_gdowhatsapptemplate:
                        payload.category as CATEGORIA_TEMPLATE_WHATSAPP,
                    stato_meta_gdowhatsapptemplate:
                        STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED,
                    json_meta_gdowhatsapptemplate: {
                        ...existingTemplate.json_meta_gdowhatsapptemplate,
                        ...payload
                    }
                });

                console.log(
                    `➕ Creata nuova versione locale del template ${nuovoNome} (id originale: ${id_template}, nuovo id: ${nuovaVersione.id_gdowhatsapptemplate}).`
                );

                return {
                    success: true,
                    newTemplateId: nuovaVersione.id_gdowhatsapptemplate || ''
                };
            }
        } catch (error) {
            console.error(
                Colorize.bgRed(
                    'Errore durante il salvataggio del template WhatsApp in locale:'
                ),
                error
            );
            throw wrapDatabaseError(error, {
                operation: 'create',
                entity: 'GDOWhatsappTemplate',
                message: `Errore nella creazione di una nuova versione locale per il template WhatsApp con id ${id_template}`
            });
        }
    }

    async getAllPresetsTemplateWhatsapp(
        id_template: string
    ): Promise<any[]> {
        try {
            const presets = await GDOWhatsappPreset.findAll({
                where: { id_template_gdowhatsappreset: id_template }
            });
            return presets;
        } catch (error) {
            console.error(
                Colorize.bgRed(
                    'Errore durante il recupero dei presets WhatsApp:'
                ),
                error
            );
            throw wrapDatabaseError(error, {
                operation: 'retrieve',
                entity: 'GDOWhatsappPreset',
                message: `Errore nel recupero dei presets per il template WhatsApp con id ${id_template}`
            });
        }
    }

    async creaPresetTemplateWhatsapp(
        id_template: string,
        nome_preset: string,
        valori: any
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const hash = crypto.createHash('sha256');
            hash.update(JSON.stringify(valori));
            const hashValue = hash.digest('hex');

            const existEqualPreset = await GDOWhatsappPreset.findOne({
                where: {
                    id_template_gdowhatsappreset: id_template,
                    hash_gdowhatsappreset: hashValue
                }
            });

            if (existEqualPreset) {
                return {
                    success: false,
                    error: `Esiste già un preset identico per questo template.`
                };
            }

            const isDefaultAnotherPreset = await GDOWhatsappPreset.findOne({
                where: {
                    id_template_gdowhatsappreset: id_template,
                    is_default_gdowhatsappreset: true
                }
            });

            await GDOWhatsappPreset.create({
                id_template_gdowhatsappreset: id_template,
                nome_preset_gdowhatsappreset: nome_preset,
                is_default_gdowhatsappreset: isDefaultAnotherPreset == null,
                json_meta_gdowhatsappreset: valori,
                hash_gdowhatsappreset: hashValue
            });

            return { success: true };
        } catch (error) {
            console.error(
                Colorize.bgRed('Errore durante la creazione del preset WhatsApp:'),
                error
            );
            return {
                success: false,
                error: wrapDatabaseError(error, {
                    operation: 'create',
                    entity: 'GDOWhatsappPreset',
                    message: `Errore nella creazione del preset per il template WhatsApp con id ${id_template}`
                }).message
            };
        }
    }

    async modificaPresetTemplateWhatsapp(
        id_preset: string,
        nome_preset: string,
        valori: any
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const presetToModify = await GDOWhatsappPreset.findOne({
                where: { id_gdowhatsappreset: id_preset }
            });

            if (!presetToModify) {
                return {
                    success: false,
                    error: `Preset con id ${id_preset} non trovato`
                };
            }

            await presetToModify.update({
                nome_preset_gdowhatsappreset: nome_preset,
                json_meta_gdowhatsappreset: valori
            });

            return { success: true };
        } catch (error) {
            console.error(
                Colorize.bgRed('Errore durante la modifica del preset WhatsApp:'),
                error
            );
            return {
                success: false,
                error: wrapDatabaseError(error, {
                    operation: 'update',
                    entity: 'GDOWhatsappPreset',
                    message: `Errore nella modifica del preset WhatsApp con id ${id_preset}`
                }).message
            };
        }
    }

    async setDefaultPresetTemplateWhatsapp(
        id_preset: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const presetToSetDefault = await GDOWhatsappPreset.findOne({
                where: { id_gdowhatsappreset: id_preset }
            });

            if (!presetToSetDefault) {
                return {
                    success: false,
                    error: `Preset con id ${id_preset} non trovato`
                };
            }

            const allPresets = await GDOWhatsappPreset.findAll({
                where: {
                    id_template_gdowhatsappreset:
                        presetToSetDefault.id_template_gdowhatsappreset
                }
            });

            await Promise.all(
                allPresets.map(async preset => {
                    if (preset.id_gdowhatsappreset === id_preset) {
                        await preset.update({ is_default_gdowhatsappreset: true });
                    } else {
                        await preset.update({ is_default_gdowhatsappreset: false });
                    }
                })
            );

            return { success: true };
        } catch (error) {
            console.error(
                Colorize.bgRed(
                    "Errore durante l'impostazione del preset WhatsApp come default:"
                ),
                error
            );
            return {
                success: false,
                error: wrapDatabaseError(error, {
                    operation: 'update',
                    entity: 'GDOWhatsappPreset',
                    message: `Errore nell'impostazione del preset WhatsApp con id ${id_preset} come default`
                }).message
            };
        }
    }

    async getAllUtentiGuestWhatsappCount(
        idGdo: string,
        filtri: {
            sesso?: string;
            callFilter?: {
                type: 'circle' | 'comuni' | 'regioni';
                // Per circle
                center?: [number, number];
                radiusKm?: number;
                // Per comuni/regioni
                areaId?: string | null;
                areaName?: string | null;
                polygon?: [number, number][][];
                // Comuni a entrambi
                minCalls?: number;
                lastDays?: number;
            };
            dateRange?: string | null; // "YYYY-MM-DD - YYYY-MM-DD"
        }
    ): Promise<{
        count: number;
        missing: number;
        total: number;
        positions: { lat: number; lng: number }[];
    }> {
        try {
            // Trova tutti gli utenti GDO per l'idGdo
            const utentiGdo = await UtentiGDO.findAll({
                attributes: ['id_utente_utentegdo'],
                where: { id_gdo_utentegdo: idGdo }
            });
            const utentiGdoIds = utentiGdo.map(ug => ug.id_utente_utentegdo);

            if (utentiGdoIds.length === 0) {
                return { count: 0, missing: 0, total: 0, positions: [] };
            }

            // Parsa il dateRange se presente ("YYYY-MM-DD - YYYY-MM-DD")
            let dataInizio: Date | null = null;
            let dataFine: Date | null = null;
            if (filtri.dateRange && typeof filtri.dateRange === 'string') {
                const parts = filtri.dateRange.split(' - ');
                if (parts.length === 2) {
                    dataInizio = new Date(parts[0]);
                    dataFine = new Date(parts[1]);
                }
            }

            // Conta tutti i guest attivi (total) - senza filtri
            const total = await Utente.count({
                where: {
                    id_utenti: utentiGdoIds,
                    tipo_utenti: TIPO_UTENTI.GUEST,
                    stato_utenti: STATO_UTENTI.ATTIVO
                }
            });

            // Verifica se c'è un filtro geografico valido
            const { callFilter } = filtri;
            const hasGeoFilter = callFilter && (
                (callFilter.type === 'circle' && callFilter.center && callFilter.radiusKm) ||
                ((callFilter.type === 'comuni' || callFilter.type === 'regioni') &&
                    callFilter.polygon && callFilter.polygon.length > 0)
            );

            let count: number;
            let positions: { lat: number; lng: number }[];

            if (hasGeoFilter) {
                // Query con PostGIS
                const result = await this.getUtentiCountWithGeoFilter(utentiGdoIds, {
                    sesso: filtri.sesso,
                    callFilter,
                    dataInizio,
                    dataFine
                });
                count = result.count;
                positions = result.positions;
            } else {
                // Query senza filtro geografico
                const whereGuest: any = {
                    id_utenti: utentiGdoIds,
                    tipo_utenti: TIPO_UTENTI.GUEST,
                    stato_utenti: STATO_UTENTI.ATTIVO
                };

                if (filtri.sesso && filtri.sesso != "null") {
                    whereGuest.sesso_utenti = filtri.sesso;
                }

                if (dataInizio && dataFine) {
                    whereGuest.datadinascita_utenti = {
                        [Op.between]: [dataInizio, dataFine]
                    };
                }

                count = await Utente.count({ where: whereGuest });

                const positionsRaw = await Utente.findAll({
                    attributes: ['lat_utenti', 'lon_utenti'],
                    where: {
                        ...whereGuest,
                        lat_utenti: { [Op.ne]: null },
                        lon_utenti: { [Op.ne]: null }
                    }
                });

                positions = positionsRaw.map(pos => ({
                    lat: pos.lat_utenti!,
                    lng: pos.lon_utenti!
                }));
            }

            return {
                count,
                missing: total - count,
                total,
                positions
            };
        } catch (error) {
            console.error(
                Colorize.bgRed('Errore durante il recupero degli utenti guest WhatsApp:'),
                error
            );
            throw new DatabaseError({
                message: 'Errore durante il recupero degli utenti guest WhatsApp',
                operation: 'getAllUtentiGuestWhatsappCount',
                entity: 'Utente',
                cause: error instanceof Error ? error : undefined
            });
        }
    }


    async iniziaInvioCampagnaWhatsApp(
        idGdo: string,
        templateId: string,
        titoloCampagna: string,
        callFilter: {
            type: 'circle' | 'comuni' | 'regioni';
            center?: [number, number];
            radiusKm?: number;
            areaId?: string | null;
            areaName?: string | null;
            polygon?: [number, number][][];
            minCalls?: number;
            lastDays?: number;
        } | null,
        userFilters: {
            sesso?: string | null;
            dateRange?: string | null;
        }
    ): Promise<{ bulkId: string; campagnaId: string; totalJobs: number; }> {
        try {
            // 1. Trova tutti gli utenti GDO per l'idGdo
            const utentiGdo = await UtentiGDO.findAll({
                attributes: ['id_utente_utentegdo'],
                where: { id_gdo_utentegdo: idGdo }
            });
            const utentiGdoIds = utentiGdo.map(ug => ug.id_utente_utentegdo);

            if (utentiGdoIds.length === 0) {
                throw new BusinessError({
                    message: 'Nessun utente trovato per questo GDO',
                    rule: 'WA_NO_USERS_FOUND',
                    details: { code: ErrorCodes.WA_NO_USERS_FOUND, idGdo: idGdo }
                });
            }

            // 2. Ottieni template e preset default
            const template = await GDOWhatsappTemplate.findByPk(templateId);
            if (!template) {
                throw new NotFoundError({
                    message: `Template ${templateId} non trovato`,
                    entityType: 'WhatsAppTemplate',
                    entityId: templateId,
                    details: { code: ErrorCodes.WA_TEMPLATE_NOT_FOUND }
                });
            }

            const templateMeta = template.json_meta_gdowhatsapptemplate;
            if (!templateMeta) {
                throw new BadRequestError({
                    message: 'Template senza json_meta_gdowhatsapptemplate',
                    details: { templateId: templateId }
                });
            }

            // Cerca il preset default
            const defaultPreset = await GDOWhatsappPreset.findOne({
                where: {
                    id_template_gdowhatsappreset: templateId,
                    is_default_gdowhatsappreset: true
                }
            });

            if (!defaultPreset) {
                throw new NotFoundError({
                    message: `Nessun preset default trovato per il template ${templateId}`,
                    entityType: 'GDOWhatsappPreset',
                    entityId: templateId,
                    details: { code: ErrorCodes.WA_PRESET_NOT_FOUND }
                });
            }

            const presetMeta = defaultPreset.json_meta_gdowhatsappreset;

            // 3. Parsa il dateRange se presente ("YYYY-MM-DD - YYYY-MM-DD")
            let dataInizio: Date | null = null;
            let dataFine: Date | null = null;
            if (userFilters.dateRange && typeof userFilters.dateRange === 'string') {
                const parts = userFilters.dateRange.split(' - ');
                if (parts.length === 2) {
                    dataInizio = new Date(parts[0]);
                    dataFine = new Date(parts[1]);
                }
            }

            // 4. Filtra utenti con i criteri forniti - FETCH FULL USER DATA
            const hasGeoFilter = callFilter && (
                (callFilter.type === 'circle' && callFilter.center && callFilter.radiusKm) ||
                ((callFilter.type === 'comuni' || callFilter.type === 'regioni') &&
                    callFilter.polygon && callFilter.polygon.length > 0)
            );

            let utenti: any[];

            if (hasGeoFilter) {
                // Usa la query PostGIS ma recupera tutti i dati dell'utente
                utenti = await this.getUtentiWithGeoFilter(utentiGdoIds, {
                    sesso: userFilters.sesso || undefined,
                    callFilter,
                    dataInizio,
                    dataFine
                });
            } else {
                const whereGuest: any = {
                    id_utenti: utentiGdoIds,
                    tipo_utenti: TIPO_UTENTI.GUEST,
                    stato_utenti: STATO_UTENTI.ATTIVO,
                    telefono_utenti: { [Op.ne]: null }
                };

                if (userFilters.sesso) {
                    whereGuest.sesso_utenti = userFilters.sesso;
                }

                if (dataInizio && dataFine) {
                    whereGuest.datadinascita_utenti = {
                        [Op.between]: [dataInizio, dataFine]
                    };
                }

                utenti = await Utente.findAll({
                    where: whereGuest,
                    raw: true
                });
            }

            if (utenti.length === 0) {
                throw new BusinessError({
                    message: 'Nessun utente trovato con i filtri specificati',
                    rule: 'WA_NO_USERS_FOUND',
                    details: { code: ErrorCodes.WA_NO_USERS_FOUND, idGdo: idGdo }
                });
            }

            console.log(Colorize.bgBlue(`📦 Creazione campagna: ${utenti.length} destinatari`));

            // 5. Prepara i messaggi personalizzati per ogni utente
            const jobs: Array<{ telefono: string; body: any }> = [];

            for (const utente of utenti) {
                const telefono = utente.telefono_utenti;
                if (!telefono) continue;

                // Mappa i dati dell'utente al formato richiesto
                const userData: UserData = {
                    id: utente.id_utenti,
                    nome: utente.nome_utenti,
                    cognome: utente.cognome_utenti,
                    email: utente.email_utenti,
                    telefono: utente.telefono_utenti,
                    sesso: utente.sesso_utenti,
                    dataDiNascita: utente.datadinascita_utenti,
                    residenza: utente.residenza_utenti,
                    // Aggiungi altri campi se necessari dal tuo modello
                };

                // Genera i parametri usando il preset e i dati utente
                const params = this.mapPresetToTemplateParams(
                    templateMeta,
                    presetMeta,
                    userData
                );

                // Costruisci il payload Meta API (SENZA credenziali!)
                const metaPayload = this.buildMetaTemplatePayload(
                    telefono,
                    templateMeta,
                    params
                );

                // Salva solo il payload Meta, NON le credenziali
                // Le credenziali verranno recuperate dal worker tramite idGdo
                jobs.push({
                    telefono,
                    body: metaPayload
                });
            }

            console.log(Colorize.green(`✅ Generati ${jobs.length} messaggi personalizzati`));

            // 6. Crea i job nella queue
            const queueService = new WhatsappQueueService();
            const result = await queueService.createBulkJobs({
                titoloCampagna,
                templateId,
                telefoni: jobs.map(j => j.telefono),
                body: jobs.map(j => j.body),
                maxAttempts: 3
            });

            console.log(Colorize.green(`✅ Campagna "${titoloCampagna}" ${result.bulkId} creata con ${result.totalJobs} job`));

            return {
                bulkId: result.bulkId,
                campagnaId: result.campagnaId,
                totalJobs: result.totalJobs
            };
        } catch (error) {
            console.error(
                Colorize.bgRed('Errore durante la creazione della campagna WhatsApp:'),
                error
            );
            // Re-throw structured errors as-is
            if (error instanceof BusinessError || error instanceof NotFoundError || error instanceof BadRequestError) {
                throw error;
            }
            throw new BusinessError({
                message: `Errore durante la creazione della campagna WhatsApp: ${error instanceof Error ? error.message : String(error)}`,
                rule: 'WA_CAMPAIGN_FAILED',
                details: { code: ErrorCodes.WA_CAMPAIGN_FAILED },
                cause: error instanceof Error ? error : undefined
            });
        }
    }




    /**
     * Query con filtri geografici PostGIS - restituisce i dati completi degli utenti
     */
    private async getUtentiWithGeoFilter(
        utentiGdoIds: string[],
        filtri: {
            sesso?: string;
            callFilter?: {
                type: 'circle' | 'comuni' | 'regioni';
                center?: [number, number];
                radiusKm?: number;
                polygon?: [number, number][][];
            };
            dataInizio: Date | null;
            dataFine: Date | null;
        }
    ): Promise<any[]> {

        const { callFilter, sesso, dataInizio, dataFine } = filtri;

        let geoClause = '';
        const replacements: Record<string, any> = {
            utentiIds: utentiGdoIds,
            tipoUtenti: TIPO_UTENTI.GUEST,
            statoUtenti: STATO_UTENTI.ATTIVO,
            sesso: sesso || null,
            dataInizio: dataInizio,
            dataFine: dataFine
        };

        if (callFilter?.type === 'circle' && callFilter.center && callFilter.radiusKm) {
            // Filtro cerchio
            const [lat, lon] = callFilter.center;
            geoClause = `
            AND ST_DWithin(
                u.geom_utenti::geography,
                ST_SetSRID(ST_MakePoint(:centerLon, :centerLat), 4326)::geography,
                :radiusMeters
            )
        `;
            replacements.centerLat = lat;
            replacements.centerLon = lon;
            replacements.radiusMeters = callFilter.radiusKm * 1000;

        } else if (
            (callFilter?.type === 'comuni' || callFilter?.type === 'regioni') &&
            callFilter.polygon &&
            callFilter.polygon.length > 0
        ) {
            // Filtro poligono
            const polygonWkt = this.polygonToWKT(callFilter.polygon);
            geoClause = `
            AND ST_Contains(
                ST_GeomFromText(:polygonWkt, 4326),
                u.geom_utenti
            )
        `;
            replacements.polygonWkt = polygonWkt;
        }

        const query = `
        SELECT u.*
        FROM utenti u
        WHERE
            u.id_utenti IN (:utentiIds)
            AND u.tipo_utenti = :tipoUtenti
            AND u.stato_utenti = :statoUtenti
            AND u.geom_utenti IS NOT NULL
            AND u.telefono_utenti IS NOT NULL
            AND (:sesso IS NULL OR u.sesso_utenti = :sesso)
            AND (:dataInizio IS NULL OR u.datadinascita_utenti >= :dataInizio)
            AND (:dataFine IS NULL OR u.datadinascita_utenti <= :dataFine)
            ${geoClause}
    `;

        const result = await sequelize.query(query, {
            replacements,
            type: QueryTypes.SELECT
        }) as any[];

        return result || [];
    }

    /**
     * Query con filtri geografici PostGIS - restituisce count e positions
     * (usata per getAllUtentiGuestWhatsappCount)
     */
    private async getUtentiCountWithGeoFilter(
        utentiGdoIds: string[],
        filtri: {
            sesso?: string;
            callFilter?: {
                type: 'circle' | 'comuni' | 'regioni';
                center?: [number, number];
                radiusKm?: number;
                polygon?: [number, number][][];
            };
            dataInizio: Date | null;
            dataFine: Date | null;
        }
    ): Promise<{ count: number; positions: { lat: number; lng: number }[] }> {

        const { callFilter, sesso, dataInizio, dataFine } = filtri;

        let geoClause = '';
        const replacements: Record<string, any> = {
            utentiIds: utentiGdoIds,
            tipoUtenti: TIPO_UTENTI.GUEST,
            statoUtenti: STATO_UTENTI.ATTIVO,
            sesso: sesso || null,
            dataInizio: dataInizio,
            dataFine: dataFine
        };

        if (callFilter?.type === 'circle' && callFilter.center && callFilter.radiusKm) {
            // Filtro cerchio
            const [lat, lon] = callFilter.center;
            geoClause = `
            AND ST_DWithin(
                u.geom_utenti::geography,
                ST_SetSRID(ST_MakePoint(:centerLon, :centerLat), 4326)::geography,
                :radiusMeters
            )
        `;
            replacements.centerLat = lat;
            replacements.centerLon = lon;
            replacements.radiusMeters = callFilter.radiusKm * 1000;

        } else if (
            (callFilter?.type === 'comuni' || callFilter?.type === 'regioni') &&
            callFilter.polygon &&
            callFilter.polygon.length > 0
        ) {
            // Filtro poligono
            const polygonWkt = this.polygonToWKT(callFilter.polygon);
            geoClause = `
            AND ST_Contains(
                ST_GeomFromText(:polygonWkt, 4326),
                u.geom_utenti
            )
        `;
            replacements.polygonWkt = polygonWkt;
        }

        const query = `
        SELECT
            COUNT(*)::int as count
        FROM utenti u
        WHERE
            u.id_utenti IN (:utentiIds)
            AND u.tipo_utenti = :tipoUtenti
            AND u.stato_utenti = :statoUtenti
            AND u.geom_utenti IS NOT NULL
            AND (:sesso IS NULL OR u.sesso_utenti = :sesso)
            AND (:dataInizio IS NULL OR u.datadinascita_utenti >= :dataInizio)
            AND (:dataFine IS NULL OR u.datadinascita_utenti <= :dataFine)
            ${geoClause}
    `;

        const positionsQuery = `
        SELECT u.lat_utenti as lat, u.lon_utenti as lng
        FROM utenti u
        WHERE
            u.id_utenti IN (:utentiIds)
            AND u.tipo_utenti = :tipoUtenti
            AND u.stato_utenti = :statoUtenti
            AND u.geom_utenti IS NOT NULL
            AND u.lat_utenti IS NOT NULL
            AND u.lon_utenti IS NOT NULL
            AND (:sesso IS NULL OR u.sesso_utenti = :sesso)
            AND (:dataInizio IS NULL OR u.datadinascita_utenti >= :dataInizio)
            AND (:dataFine IS NULL OR u.datadinascita_utenti <= :dataFine)
            ${geoClause}
        LIMIT 1000
    `;

        const [countResult] = await sequelize.query(query, {
            replacements,
            type: QueryTypes.SELECT
        }) as any[];

        const positionsResult = await sequelize.query(positionsQuery, {
            replacements,
            type: QueryTypes.SELECT
        }) as { lat: number; lng: number }[];

        return {
            count: countResult?.count || 0,
            positions: positionsResult || []
        };
    }

    /**
     * Variante di getUtentiWithGeoFilter che restituisce i telefoni degli utenti
     */
    private async getUtentiTelefoniWithGeoFilter(
        utentiGdoIds: string[],
        filtri: {
            sesso?: string;
            callFilter?: {
                type: 'circle' | 'comuni' | 'regioni';
                center?: [number, number];
                radiusKm?: number;
                polygon?: [number, number][][];
            };
            dataInizio: Date | null;
            dataFine: Date | null;
        }
    ): Promise<string[]> {
        const { callFilter, sesso, dataInizio, dataFine } = filtri;

        let geoClause = '';
        const replacements: Record<string, any> = {
            utentiIds: utentiGdoIds,
            tipoUtenti: TIPO_UTENTI.GUEST,
            statoUtenti: STATO_UTENTI.ATTIVO,
            sesso: sesso || null,
            dataInizio: dataInizio,
            dataFine: dataFine
        };

        if (callFilter?.type === 'circle' && callFilter.center && callFilter.radiusKm) {
            // Filtro cerchio
            const [lat, lon] = callFilter.center;
            geoClause = `
            AND ST_DWithin(
                u.geom_utenti::geography,
                ST_SetSRID(ST_MakePoint(:centerLon, :centerLat), 4326)::geography,
                :radiusMeters
            )
        `;
            replacements.centerLat = lat;
            replacements.centerLon = lon;
            replacements.radiusMeters = callFilter.radiusKm * 1000;

        } else if (
            (callFilter?.type === 'comuni' || callFilter?.type === 'regioni') &&
            callFilter.polygon &&
            callFilter.polygon.length > 0
        ) {
            // Filtro poligono
            const polygonWkt = this.polygonToWKT(callFilter.polygon);
            geoClause = `
            AND ST_Contains(
                ST_GeomFromText(:polygonWkt, 4326),
                u.geom_utenti
            )
        `;
            replacements.polygonWkt = polygonWkt;
        }

        const telefoniQuery = `
        SELECT u.telefono_utenti as telefono
        FROM utenti u
        WHERE
            u.id_utenti IN (:utentiIds)
            AND u.tipo_utenti = :tipoUtenti
            AND u.stato_utenti = :statoUtenti
            AND u.geom_utenti IS NOT NULL
            AND u.telefono_utenti IS NOT NULL
            AND u.telefono_utenti != ''
            AND (:sesso IS NULL OR u.sesso_utenti = :sesso)
            AND (:dataInizio IS NULL OR u.datadinascita_utenti >= :dataInizio)
            AND (:dataFine IS NULL OR u.datadinascita_utenti <= :dataFine)
            ${geoClause}
    `;

        const telefoniResult = await sequelize.query(telefoniQuery, {
            replacements,
            type: QueryTypes.SELECT
        }) as { telefono: string }[];

        return telefoniResult.map(r => r.telefono);
    }

    /**
     * Converte coordinate [[lat, lon], ...] in WKT per PostGIS
     */
    private polygonToWKT(rings: [number, number][][]): string {
        if (!rings || rings.length === 0) {
            throw new ValidationError({
                message: 'Poligono vuoto',
                field: 'polygon',
                constraint: 'non-empty'
            });
        }

        const wktRings = rings.map(ring => {
            if (ring.length < 3) {
                throw new ValidationError({
                    message: 'Un ring richiede almeno 3 punti',
                    field: 'polygon.ring',
                    constraint: 'minPoints:3'
                });
            }

            // Converti [lat, lon] → "lon lat" (WKT vuole lon prima)
            const points = ring.map(([lat, lon]) => `${lon} ${lat}`);

            // Chiudi il ring se non è già chiuso
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                points.push(`${first[1]} ${first[0]}`);
            }

            return `(${points.join(', ')})`;
        });

        return `POLYGON(${wktRings.join(', ')})`;
    }
}
