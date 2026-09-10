import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Badge from "../../components/Base/Badge";
import Button from "../../components/Base/Button";
import { FormInput, FormLabel, FormSelect, FormTextarea } from "../../components/Base/Form";
import PageHeader from "../../components/Base/PageHeader";
import withSessionCheck from "../../components/SessionChecker";

/**
 * Tipologia allineata alla definizione proposta per json_meta_gdowhatsapptemplate
 */
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION" | "TRANSACTIONAL" | "SERVICE";
export type HeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
export type ButtonKind = "NONE" | "QUICK_REPLY" | "CTA";
export type CtaType = "URL" | "PHONE_NUMBER";

export type QuickReply = { type: "QUICK_REPLY"; text: string };
export type Cta =
    | { type: "URL"; text: string; url?: string; phone_number?: never }
    | { type: "PHONE_NUMBER"; text: string; phone_number?: string; url?: never };

export type WhatsAppTemplateComponent =
    | {
        type: "HEADER";
        format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
        text?: string;
        example?: { header_text?: string[]; header_handle?: string[] };
    }
    | {
        type: "BODY";
        text: string;
        example?: { body_text: string[][] };
    }
    | {
        type: "FOOTER";
        text: string;
    }
    | {
        type: "BUTTONS";
        buttons: (
            | { type: "QUICK_REPLY"; text: string }
            | { type: "URL"; text: string; url: string }
            | { type: "PHONE_NUMBER"; text: string; phone_number: string }
            | { type: "COPY_CODE"; text: string; code: string }
        )[];
    };

export interface WhatsAppTemplateLanguage {
    code: string; // es. 'it', 'en_US'
    policy?: "deterministic" | "fallback";
}

export interface WhatsAppTemplate {
    name: string;
    language: WhatsAppTemplateLanguage;
    status?: "APPROVED" | "REJECTED" | "PENDING";
    category?: TemplateCategory;
    components: WhatsAppTemplateComponent[];
    namespace?: string;
    id?: string;
    created_at?: string | Date;
    updated_at?: string | Date;
    preview_url?: string;
    variables?: Record<string, any>;
}

export type json_meta_gdowhatsapptemplate = WhatsAppTemplate;

/** ------------------ Stato del form ------------------ */

type FormState = {
    name: string;
    language: string; // salviamo solo il codice; in payload convertiamo a { code }
    category: TemplateCategory;
    headerFormat: HeaderFormat;
    headerText: string;
    headerSampleMediaUrl?: string;
    bodyText: string;
    bodyExamples: string[]; // mapping 1:1 con placeholder
    footerText: string;
    buttonKind: ButtonKind;
    quickReplies: QuickReply[];
    ctas: Cta[];
};

const MAX_BODY = 1024;
const MAX_HEADER_TEXT = 60;
const MAX_FOOTER_TEXT = 60;

const langOptions = [
    { code: "it", label: "Italiano (it)" },
    { code: "it_IT", label: "Italiano (it_IT)" },
    { code: "en_US", label: "English (en_US)" },
];

const initial: FormState = {
    name: "",
    language: "it",
    category: "UTILITY",
    headerFormat: "NONE",
    headerText: "",
    bodyText: "",
    bodyExamples: [],
    footerText: "",
    buttonKind: "NONE",
    quickReplies: [],
    ctas: [],
};

/** ------------------ Utility di validazione ------------------ */

function validateName(name: string) {
    return /^[a-z0-9_]+$/.test(name);
}

function extractPlaceholders(text: string): number[] {
    const matches = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => parseInt(m[1], 10));
    return Array.from(new Set(matches)).sort((a, b) => a - b);
}

function hasSequentialPlaceholders(ph: number[]) {
    if (ph.length === 0) return true;
    return ph.every((n, i) => n === i + 1);
}

function isDynamicUrlValid(url?: string) {
    if (!url) return false;
    try {
        const test = url.replace(/\{\{\d+\}\}/g, "X");
        new URL(test);
        return true;
    } catch {
        return false;
    }
}

const HelperLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-xs text-slate-500 mt-1">{children}</div>
);

const Counter: React.FC<{ value: string; max: number }> = ({ value, max }) => (
    <Badge variant="secondary" size="sm">
        {value.length}/{max}
    </Badge>
);

const ErrorMsg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-danger text-xs mt-1">{children}</div>
);

const Card: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
    <div className="box box--stacked p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-slate-800">{title}</span>
            {right}
        </div>
        {children}
    </div>
);

/** ------------------ Pagina principale ------------------ */

const CreaTemplatesWhatsappSuperAdmin: React.FC<{ onSubmit?: (payload: json_meta_gdowhatsapptemplate) => Promise<void> | void }> = ({ onSubmit }) => {
    const [form, setForm] = useState<FormState>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const bodyPlaceholders = useMemo(() => extractPlaceholders(form.bodyText), [form.bodyText]);
    const needBodyExamples = bodyPlaceholders.length > 0;


    // Parser da json esistente (json_meta_gdowhatsapptemplate) verso lo stato del form


    const validation = useMemo(() => {
        const e: Record<string, string> = {};
        if (!validateName(form.name)) {
            e.name = "Usa solo minuscole/numeri/underscore (es. promozione_estiva_2025).";
        }
        if (!form.language) e.language = "Seleziona la lingua.";
        if (!form.category) e.category = "Seleziona la categoria.";

        if (form.headerFormat === "TEXT") {
            if (!form.headerText.trim()) e.headerText = "Inserisci il testo per l'header.";
            if (form.headerText.length > MAX_HEADER_TEXT) e.headerText = `Max ${MAX_HEADER_TEXT} caratteri.`;
        } else if (["IMAGE", "DOCUMENT", "VIDEO"].includes(form.headerFormat)) {
            if (!form.headerSampleMediaUrl?.trim()) {
                e.headerSampleMediaUrl = "Per i media header serve un esempio (URL/handle) per l'approvazione.";
            }
        }

        if (!form.bodyText.trim()) e.bodyText = "Il body è obbligatorio.";
        if (form.bodyText.length > MAX_BODY) e.bodyText = `Max ${MAX_BODY} caratteri.`;

        const placeholders = bodyPlaceholders;
        if (!hasSequentialPlaceholders(placeholders)) {
            e.bodyText = "I placeholder devono essere sequenziali: {{1}}, {{2}}, …";
        }

        if (needBodyExamples) {
            if (form.bodyExamples.length !== placeholders.length || form.bodyExamples.some((s) => !s.trim())) {
                e.bodyExamples = `Fornisci ${placeholders.length} esempio/i (uno per ciascun {{n}}).`;
            }
        }

        if (form.footerText.length > MAX_FOOTER_TEXT) e.footerText = `Footer max ${MAX_FOOTER_TEXT} caratteri.`;

        if (form.buttonKind === "QUICK_REPLY") {
            if (form.quickReplies.length === 0) e.quickReplies = "Aggiungi almeno 1 quick reply.";
            if (form.quickReplies.length > 3) e.quickReplies = "Massimo 3 quick reply.";
            if (form.quickReplies.some((q) => !q.text.trim() || q.text.length > 25)) {
                e.quickReplies = "Testo quick reply obbligatorio (consigliato ≤25 caratteri).";
            }
        }

        if (form.buttonKind === "CTA") {
            if (form.ctas.length === 0) e.ctas = "Aggiungi almeno 1 CTA.";
            if (form.ctas.length > 2) e.ctas = "Massimo 2 CTA.";
            for (const [i, c] of form.ctas.entries()) {
                if (!c.text?.trim()) {
                    e[`cta_${i}`] = "Label CTA obbligatoria.";
                }
                if (c.type === "URL") {
                    if (!isDynamicUrlValid(c.url)) {
                        e[`cta_${i}_url`] = "URL non valido. Puoi usare segnaposto {{n}} nel path/query.";
                    }
                } else if (c.type === "PHONE_NUMBER") {
                    if (!c.phone_number?.trim()) {
                        e[`cta_${i}_phone`] = "Numero di telefono obbligatorio (es. +39055...).";
                    }
                }
            }
        }

        return e;
    }, [form, bodyPlaceholders, needBodyExamples]);

    const previewButtons = useMemo(() => {
        if (form.buttonKind === "QUICK_REPLY") {
            return form.quickReplies.map((q) => ({ kind: "quick" as const, label: q.text }));
        }
        if (form.buttonKind === "CTA") {
            return form.ctas.map((c) => ({
                kind: c.type === "URL" ? ("url" as const) : ("phone" as const),
                label: c.text,
                target: c.type === "URL" ? c.url : c.phone_number,
            }));
        }
        return [] as const;
    }, [form]);

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    /** Costruisce un payload conforme a json_meta_gdowhatsapptemplate */
    function buildPayload(): json_meta_gdowhatsapptemplate {
        const components: WhatsAppTemplateComponent[] = [];

        if (form.headerFormat === "TEXT") {
            components.push({ type: "HEADER", format: "TEXT", text: form.headerText });
        } else if (["IMAGE", "DOCUMENT", "VIDEO"].includes(form.headerFormat)) {
            const format = form.headerFormat as "IMAGE" | "DOCUMENT" | "VIDEO";
            components.push({ type: "HEADER", format, example: { header_handle: form.headerSampleMediaUrl ? [form.headerSampleMediaUrl] : [] } });
        }

        const body: Extract<WhatsAppTemplateComponent, { type: "BODY" }> = { type: "BODY", text: form.bodyText };
        if (bodyPlaceholders.length) {
            body.example = { body_text: [form.bodyExamples] };
        }
        components.push(body);

        const footerTextFinal = form.footerText.trim();
        if (footerTextFinal) {
            components.push({ type: "FOOTER", text: `${footerTextFinal}` });
        }

        if (form.buttonKind === "QUICK_REPLY" && form.quickReplies.length) {
            components.push({
                type: "BUTTONS",
                buttons: form.quickReplies.map((q) => ({ type: "QUICK_REPLY", text: q.text })),
            });
        } else if (form.buttonKind === "CTA" && form.ctas.length) {
            components.push({
                type: "BUTTONS",
                buttons: form.ctas.map((c) =>
                    c.type === "URL"
                        ? ({ type: "URL", text: c.text, url: c.url! } as const)
                        : ({ type: "PHONE_NUMBER", text: c.text, phone_number: c.phone_number! } as const)
                ),
            });
        }

        const payload: json_meta_gdowhatsapptemplate = {
            name: form.name,
            language: { code: form.language, policy: "deterministic" },
            category: form.category,
            components,
        };

        return payload;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrors(validation);
        if (Object.keys(validation).length) return;
        const payload = buildPayload();
        try {
            await onSubmit?.(payload);
            alert("Template pronto per l'invio a Meta.");
        } catch (err: any) {
            alert("Errore durante il salvataggio/submit del template.");
            console.error(err);
        }
    }

    return (
        <div>
            <PageHeader title="Crea Template WhatsApp" description="Configura un template conforme alle linee guida Meta e pronto per l’approvazione." />

            <form onSubmit={handleSubmit}>
                <Card title="Informazioni generali">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <FormLabel>Nome template</FormLabel>
                            <FormInput placeholder="es. promo_fidelity_settembre" value={form.name} onChange={(e) => update("name", e.target.value.trim())} />
                            <HelperLabel>Minuscole/underscore, niente spazi.</HelperLabel>
                            {errors.name && <ErrorMsg>{errors.name}</ErrorMsg>}
                        </div>

                        <div>
                            <FormLabel>Categoria</FormLabel>
                            <FormSelect value={form.category} onChange={(e) => update("category", e.target.value as TemplateCategory)}>
                                <option value="MARKETING">Marketing</option>
                                <option value="UTILITY">Utility</option>
                                <option value="AUTHENTICATION">Authentication</option>
                                <option value="TRANSACTIONAL">Transactional</option>
                                <option value="SERVICE">Service</option>
                            </FormSelect>
                            {errors.category && <ErrorMsg>{errors.category}</ErrorMsg>}
                        </div>

                        <div>
                            <FormLabel>Lingua</FormLabel>
                            <FormSelect value={form.language} onChange={(e) => update("language", e.target.value)}>
                                {langOptions.map((l) => (
                                    <option key={l.code} value={l.code}>
                                        {l.label}
                                    </option>
                                ))}
                            </FormSelect>
                            {errors.language && <ErrorMsg>{errors.language}</ErrorMsg>}
                        </div>
                    </div>
                </Card>

                <Card title="Header">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <FormLabel>Formato</FormLabel>
                            <FormSelect value={form.headerFormat} onChange={(e) => update("headerFormat", e.target.value as HeaderFormat)}>
                                <option value="NONE">Nessuno</option>
                                <option value="TEXT">Testo</option>
                                <option value="IMAGE">Immagine</option>
                                <option value="DOCUMENT">Documento</option>
                                <option value="VIDEO">Video</option>
                            </FormSelect>
                        </div>

                        {form.headerFormat === "TEXT" && (
                            <div className="md:col-span-2">
                                <FormLabel className="flex items-center">
                                    Testo header <span className="ml-auto"><Counter value={form.headerText} max={MAX_HEADER_TEXT} /></span>
                                </FormLabel>
                                <FormInput placeholder="Es. Istanta 2 GDO Suite" value={form.headerText} onChange={(e) => update("headerText", e.target.value)} />
                                {errors.headerText && <ErrorMsg>{errors.headerText}</ErrorMsg>}
                            </div>
                        )}

                        {["IMAGE", "DOCUMENT", "VIDEO"].includes(form.headerFormat) && (
                            <div className="md:col-span-2">
                                <FormLabel>Esempio media (URL/handle)</FormLabel>
                                <FormInput placeholder="https://… (consigliato per approvazione)" value={form.headerSampleMediaUrl || ""} onChange={(e) => update("headerSampleMediaUrl", e.target.value)} />
                                <HelperLabel>Per i media header, Meta richiede un esempio per la review.</HelperLabel>
                                {errors.headerSampleMediaUrl && <ErrorMsg>{errors.headerSampleMediaUrl}</ErrorMsg>}
                            </div>
                        )}
                    </div>
                </Card>

                <Card title="Body" right={<Counter value={form.bodyText} max={MAX_BODY} />}>
                    <FormTextarea rows={6} placeholder={`Es. Ciao {{1}}, la tua fidelity è attiva! Sconto del {{2}}% su volantini web.\nValido fino al {{3}}.`} value={form.bodyText} onChange={(e) => update("bodyText", e.target.value)} />
                    <HelperLabel>
                        Usa segnaposto sequenziali: <code>{`{{1}}`}</code>, <code>{`{{2}}`}</code>…; niente salti.
                    </HelperLabel>
                    {errors.bodyText && <ErrorMsg>{errors.bodyText}</ErrorMsg>}

                    {needBodyExamples && (
                        <div className="mt-3">
                            <FormLabel>Esempi (uno per placeholder)</FormLabel>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {bodyPlaceholders.map((n, idx) => (
                                    <FormInput
                                        key={n}
                                        placeholder={`Esempio per {{${n}}}`}
                                        value={form.bodyExamples[idx] || ""}
                                        onChange={(e) => {
                                            const copy = [...form.bodyExamples];
                                            copy[idx] = e.target.value;
                                            update("bodyExamples", copy);
                                        }}
                                    />
                                ))}
                            </div>
                            {errors.bodyExamples && <ErrorMsg>{errors.bodyExamples}</ErrorMsg>}
                        </div>
                    )}

                </Card>

                <Card title="Footer" right={<Counter value={form.footerText} max={MAX_FOOTER_TEXT} />}>
                    <FormInput placeholder="Es. Servizio clienti 9-18" value={form.footerText} onChange={(e) => update("footerText", e.target.value)} />
                    {errors.footerText && <ErrorMsg>{errors.footerText}</ErrorMsg>}
                </Card>

                <Card title="Bottoni">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <FormLabel>Tipo bottoni</FormLabel>
                            <FormSelect value={form.buttonKind} onChange={(e) => update("buttonKind", e.target.value as ButtonKind)}>
                                <option value="NONE">Nessuno</option>
                                <option value="QUICK_REPLY">Quick Reply (max 3)</option>
                                <option value="CTA">Call-To-Action (max 2)</option>
                            </FormSelect>
                            <HelperLabel>
                                Quick Reply <b>oppure</b> CTA (non insieme).
                            </HelperLabel>
                        </div>

                        {form.buttonKind === "QUICK_REPLY" && (
                            <div className="md:col-span-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-slate-600">Quick Reply</span>
                                    <Button variant="primary" type="button" onClick={() => update("quickReplies", [...form.quickReplies, { type: "QUICK_REPLY", text: "" }])} disabled={form.quickReplies.length >= 3}>
                                        + Aggiungi
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {form.quickReplies.map((q, i) => (
                                        <FormInput
                                            key={i}
                                            placeholder="Es. Vedi offerte"
                                            value={q.text}
                                            onChange={(e) => {
                                                const copy = [...form.quickReplies];
                                                copy[i] = { ...copy[i], text: e.target.value };
                                                update("quickReplies", copy);
                                            }}
                                        />
                                    ))}
                                </div>
                                {errors.quickReplies && <ErrorMsg>{errors.quickReplies}</ErrorMsg>}
                            </div>
                        )}

                        {form.buttonKind === "CTA" && (
                            <div className="md:col-span-2 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Button variant="primary" type="button" onClick={() => update("ctas", form.ctas.length >= 2 ? form.ctas : [...form.ctas, { type: "URL", text: "", url: "" }])} disabled={form.ctas.length >= 2}>
                                        + CTA URL
                                    </Button>
                                    <Button variant="secondary" type="button" onClick={() => update("ctas", form.ctas.length >= 2 ? form.ctas : [...form.ctas, { type: "PHONE_NUMBER", text: "", phone_number: "" }])} disabled={form.ctas.length >= 2}>
                                        + CTA Telefono
                                    </Button>
                                </div>

                                {form.ctas.map((c, i) => (
                                    <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <FormInput
                                            placeholder="Label bottone"
                                            value={c.text}
                                            onChange={(e) => {
                                                const copy = [...form.ctas];
                                                copy[i] = { ...copy[i], text: e.target.value } as Cta;
                                                update("ctas", copy);
                                            }}
                                        />

                                        <FormSelect
                                            value={c.type}
                                            onChange={(e) => {
                                                const t = e.target.value as CtaType;
                                                const copy = [...form.ctas];
                                                copy[i] = t === "URL" ? ({ type: "URL", text: c.text, url: "" } as Cta) : ({ type: "PHONE_NUMBER", text: c.text, phone_number: "" } as Cta);
                                                update("ctas", copy);
                                            }}
                                        >
                                            <option value="URL">URL</option>
                                            <option value="PHONE_NUMBER">Phone</option>
                                        </FormSelect>

                                        {c.type === "URL" ? (
                                            <FormInput
                                                placeholder="https://example.com/{{1}}"
                                                value={(c as Extract<Cta, { type: "URL" }>).url || ""}
                                                onChange={(e) => {
                                                    const copy = [...form.ctas];
                                                    copy[i] = { ...(copy[i] as Extract<Cta, { type: "URL" }>), url: e.target.value } as Cta;
                                                    update("ctas", copy);
                                                }}
                                            />
                                        ) : (
                                            <FormInput
                                                placeholder="+39055…"
                                                value={(c as Extract<Cta, { type: "PHONE_NUMBER" }>).phone_number || ""}
                                                onChange={(e) => {
                                                    const copy = [...form.ctas];
                                                    copy[i] = { ...(copy[i] as Extract<Cta, { type: "PHONE_NUMBER" }>), phone_number: e.target.value } as Cta;
                                                    update("ctas", copy);
                                                }}
                                            />
                                        )}

                                        {errors[`cta_${i}`] && <ErrorMsg>{errors[`cta_${i}`]}</ErrorMsg>}
                                        {errors[`cta_${i}_url`] && <ErrorMsg>{errors[`cta_${i}_url`]}</ErrorMsg>}
                                        {errors[`cta_${i}_phone`] && <ErrorMsg>{errors[`cta_${i}_phone`]}</ErrorMsg>}
                                    </div>
                                ))}

                                {errors.ctas && <ErrorMsg>{errors.ctas}</ErrorMsg>}
                            </div>
                        )}
                    </div>
                </Card>

                <Card title="Anteprima (isolata, stile WhatsApp)">
                    <WhatsAppMessageShadowPreview
                        data={{
                            headerFormat: form.headerFormat,
                            headerText: form.headerText,
                            headerSampleMediaUrl: form.headerSampleMediaUrl,
                            bodyText: form.bodyText,
                            bodyExamples: form.bodyExamples,
                            footerText: form.footerText,
                            buttonKind: form.buttonKind,
                            quickReplies: form.quickReplies,
                            ctas: form.ctas,
                            language: form.language,
                            category: form.category,
                        }}
                        hostStyle={{ display: "block" }}
                    />
                </Card>

                {/* <div className="flex items-center gap-3">
                    <Button type="submit" variant="primary">
                        Genera payload
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            console.log("payload", buildPayload());
                        }}
                    >
                        Debug payload
                    </Button>
                </div> */}
            </form>
        </div>
    );
};

export default withSessionCheck(CreaTemplatesWhatsappSuperAdmin);

/** ------------------ Preview WhatsApp ------------------ */

export type WhatsAppPreviewData = {
    headerFormat: HeaderFormat;
    headerText?: string;
    headerSampleMediaUrl?: string;
    bodyText: string;
    bodyExamples?: string[];
    footerText?: string;
    buttonKind: ButtonKind;
    quickReplies?: QuickReply[];
    ctas?: Cta[];
    language?: string;
    category?: TemplateCategory;
};

/** Sostituisce {{1}}, {{2}} … con gli esempi forniti */
function renderWithExamples(text: string, examples: string[] = []) {
    return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, numStr) => {
        const idx = parseInt(numStr, 10) - 1;
        return examples[idx] ?? `{{${numStr}}}`;
    });
}

/** CSS isolato per simulare WhatsApp in modo fedele */
const WHATSAPP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;600;700&display=swap');
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.wa-container { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
.wa-message { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.wa-bubble { max-width: 85%; background: #005c4b; border-radius: 8px; box-shadow: 0 1px 0.5px rgba(0,0,0,.13); position: relative; overflow: hidden; }
.wa-bubble::before { content: ''; position: absolute; right: -8px; bottom: 0; width: 0; height: 0; border-left: 8px solid #005c4b; border-bottom: 13px solid transparent; }
.wa-media-container { position: relative; background: #000; }
.wa-media-container img, .wa-media-container video { display: block; width: 100%; height: auto; max-height: 300px; object-fit: cover; }
.wa-document-preview { padding: 12px; background: rgba(0,0,0,0.4); display: flex; align-items: center; gap: 12px; color: white; }
.wa-doc-icon { width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
.wa-doc-info { flex: 1; }
.wa-doc-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
.wa-doc-size { font-size: 12px; opacity: 0.7; }
.wa-content { padding: 6px 8px 8px 9px; }
.wa-header-text { color: #e9edef; font-weight: 700; font-size: 15px; line-height: 1.4; margin-bottom: 4px; }
.wa-body-text { color: #e9edef; font-size: 14.2px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }
.wa-footer-text { color: rgba(233, 237, 239, 0.6); font-size: 12px; line-height: 1.4; margin-top: 6px; }
.wa-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 4px; }
.wa-time { color: rgba(233, 237, 239, 0.5); font-size: 11px; }
.wa-checkmarks { color: #53bdeb; font-size: 16px; line-height: 1; }
.wa-buttons { border-top: 1px solid rgba(255,255,255,0.1); padding: 4px 8px 6px; }
.wa-quick-replies { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 0; }
.wa-quick-reply { background: rgba(11, 20, 26, 0.8); color: #e9edef; border: none; border-radius: 18px; padding: 6px 12px; font-size: 13.5px; font-family: inherit; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
.wa-quick-reply:hover { background: rgba(11, 20, 26, 0.95); }
.wa-cta-buttons { display: flex; flex-direction: column; gap: 4px; padding: 2px 0; }
.wa-cta-button { background: transparent; color: #53bdeb; border: none; padding: 10px 12px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; text-align: center; transition: background 0.2s; border-radius: 4px; }
.wa-cta-button:hover { background: rgba(83, 189, 235, 0.1); }
.wa-cta-url::before { content: '🔗 '; }
.wa-cta-phone::before { content: '📞 '; }
`;

const WhatsAppView: React.FC<{ data: WhatsAppPreviewData }> = ({ data }) => {
    const {
        headerFormat,
        headerText,
        headerSampleMediaUrl,
        bodyText,
        bodyExamples = [],
        footerText,
        buttonKind,
        quickReplies = [],
        ctas = [],
        language,
        category,
    } = data;

    const bodyRendered = useMemo(() => renderWithExamples(bodyText || "", bodyExamples), [bodyText, bodyExamples]);
    const qrButtons = buttonKind === "QUICK_REPLY" ? quickReplies.slice(0, 3) : [];
    const ctaButtons = buttonKind === "CTA" ? ctas.slice(0, 2) : [];

    return (
        <>
            <style>{WHATSAPP_CSS}</style>
            <div className="wa-container" style={{ background: "#0b141a", padding: 24, borderRadius: 16, maxWidth: 420, margin: "0 auto" }}>
                <div className="wa-message" style={{ justifyContent: "flex-end" }}>
                    <div className="wa-bubble">
                        {/* Header Media */}
                        {["IMAGE", "DOCUMENT", "VIDEO"].includes(headerFormat) && headerSampleMediaUrl && (
                            <div className="wa-media-container">
                                {headerFormat === "VIDEO" ? (
                                    <video src={headerSampleMediaUrl} controls playsInline />
                                ) : headerFormat === "DOCUMENT" ? (
                                    <div className="wa-document-preview">
                                        <div className="wa-doc-icon">📄</div>
                                        <div className="wa-doc-info">
                                            <div className="wa-doc-name">{headerSampleMediaUrl}</div>
                                            <div className="wa-doc-size">Documento</div>
                                        </div>
                                    </div>
                                ) : (
                                    <img src={headerSampleMediaUrl} alt="header media" />
                                )}
                            </div>
                        )}

                        {/* Header Text */}
                        {headerFormat === "TEXT" && headerText?.trim() && <div className="wa-header-text">{headerText}</div>}

                        {/* Body */}
                        <div className="wa-content">
                            <div className="wa-body-text">{bodyRendered}</div>
                            {(footerText) && (
                                <div className="wa-footer-text">
                                    {footerText}
                                </div>
                            )}
                        </div>

                        {/* Buttons */}
                        {(qrButtons.length > 0 || ctaButtons.length > 0) && (
                            <div className="wa-buttons">
                                {qrButtons.length > 0 && (
                                    <div className="wa-quick-replies">
                                        {qrButtons.map((q, idx) => (
                                            <button key={idx} type="button" className="wa-quick-reply">
                                                {q.text}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {ctaButtons.length > 0 && (
                                    <div className="wa-cta-buttons">
                                        {ctaButtons.map((c, idx) => (
                                            <button key={idx} type="button" className={`wa-cta-button wa-cta-${c.type === "URL" ? "url" : "phone"}`} title={c.type === "URL" ? c.url || "" : c.phone_number || ""}>
                                                {c.text}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Meta info */}
                        <div className="wa-meta">
                            <span className="wa-time">12:34</span>
                            <span className="wa-checkmarks">✓✓</span>
                        </div>
                    </div>
                </div>

                {(language || category) && (
                    <div className="wa-info-badge" style={{ position: "static", marginTop: 12 }}>
                        {language ? `Lang: ${language}` : ""}
                        {language && category ? " · " : ""}
                        {category ? `Cat: ${category}` : ""}
                    </div>
                )}
            </div>
        </>
    );
};

/** Componente principale: monta il contenuto in uno ShadowRoot isolato */
const WhatsAppMessageShadowPreview: React.FC<{ data: WhatsAppPreviewData; hostStyle?: React.CSSProperties }> = ({ data, hostStyle }) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [shadowContainer, setShadowContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (!wrapperRef.current) return;

        // crea un host (figlio del wrapper) e attacca lo shadow
        const host = document.createElement("div");
        if (hostStyle) Object.assign(host.style, hostStyle);
        wrapperRef.current.appendChild(host);
        hostRef.current = host;

        const sr = host.attachShadow({ mode: "open" });
        const container = document.createElement("div");
        container.className = "__wa_shadow_container__";
        sr.appendChild(container);
        setShadowContainer(container);

        return () => {
            setShadowContainer(null);
            if (hostRef.current && hostRef.current.parentNode) {
                hostRef.current.parentNode.removeChild(hostRef.current);
            }
            hostRef.current = null;
        };
    }, [hostStyle]);

    return <div ref={wrapperRef} style={{ display: "inline-block" }}>{shadowContainer && createPortal(<WhatsAppView data={data} />, shadowContainer)}</div>;
};
