import React, { useEffect, useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router-dom';
import ConfirmDialog from "@/components/ConfirmDialog";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { ServerCall } from '../../../lib/server_call';
import type { GDOWhatsappPresetAttributes } from '../../../lib/types';
import Button from '../../components/Base/Button';
import {
    FormField,
    FormInput,
    FormLabel,
    FormSelect,
    FormTextarea,
} from '../../components/Base/Form';
import Lucide from '../../components/Base/Lucide';
import PageError from '../../components/Base/PageError';
import Pagina from '../../components/Base/Pagina';
import Sezione from '../../components/Base/Sezione';
import StatusBadge from '../../components/Base/StatusBadge';
import Table from '../../components/Base/Table';
import EmptyState from '../../components/EmptyState';
import { useNotification } from '../../context/NotificationContext';
import { formatDataOraEstesa, VALORE_ASSENTE } from '../../utils/format';

const extractParamsFromText = (text: string): number[] => {
    const regex = /\{\{(\d+)\}\}/g;
    const params: number[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        params.push(Number(match[1]));
    }
    return params;
};

type BindConfig = {
    bind?: string;
    sample?: string;
    value?: string;
};

type TextParamUsage = {
    section: string;   // header / body / footer / etc (lowercase)
    label: string;     // "Header", "Body", ...
    param: number;     // 1, 2, 3 ...
};

type ButtonParamUsage = {
    buttonIndex: number;  // 0, 1, 2...
    label: string;        // testo bottone
    url: string;          // URL base
    param: number;        // parametro {{n}}
};

const GestionePresetsWhatsappSuperAdmin: React.FC = () => {
    const { template, presets, errore } = useLoaderData() as {
        template: any;
        presets: GDOWhatsappPresetAttributes[];
        errore?: string | null;
    };
    const { showNotification } = useNotification();
    const { revalidate } = useRevalidator();
    // Preset che si sta impostando come predefinito
    const [presetDefaultInCorso, setPresetDefaultInCorso] = useState<string | null>(null);
    const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
    const [isEditing, setIsEditing] = useState(false);
    const [presetDaEliminare, setPresetDaEliminare] = useState<GDOWhatsappPresetAttributes | null>(null);
    const [eliminazioneInCorso, setEliminazioneInCorso] = useState(false);

    const eliminaPreset = async () => {
        if (!presetDaEliminare) return;
        setEliminazioneInCorso(true);
        try {
            await ServerCall.delete(`/whatsapp/preset/${presetDaEliminare.id_gdowhatsappreset}`);
            showNotification('Preset eliminato', { variant: 'success' });
            if (selectedPreset === presetDaEliminare.id_gdowhatsappreset) {
                setSelectedPreset(undefined);
                setIsEditing(false);
            }
            setPresetDaEliminare(null);
            revalidate();
        } catch (error: unknown) {
            showNotification(error instanceof Error ? error.message : "Errore durante l'eliminazione del preset", { variant: 'error' });
        } finally {
            setEliminazioneInCorso(false);
        }
    };
    const components = template?.json_meta_gdowhatsapptemplate?.components || [];

    // ---------------- PARAMETRI TESTO (header/body/footer) -------------------

    const textParamMap = new Map<string, TextParamUsage>();

    components.forEach((comp: any) => {
        if (!comp?.text) return;

        const rawType = (comp.type || 'BODY').toString();
        const section = rawType.toLowerCase(); // header / body / footer ...
        const label = section.charAt(0).toUpperCase() + section.slice(1); // Header, Body...

        const params = extractParamsFromText(comp.text);
        params.forEach((p) => {
            const key = `${section}:${p}`;
            if (!textParamMap.has(key)) {
                textParamMap.set(key, { section, label, param: p });
            }
        });
    });

    const textParamUsages: TextParamUsage[] = Array.from(textParamMap.values()).sort(
        (a, b) => {
            if (a.section === b.section) return a.param - b.param;
            return a.section.localeCompare(b.section);
        }
    );

    const [textBindings, setTextBindings] = useState<Record<string, BindConfig>>({});

    const updateTextBinding = (key: string, patch: Partial<BindConfig>) => {
        setTextBindings((prev) => ({
            ...prev,
            [key]: { ...prev[key], ...patch },
        }));
    };

    // ---------------- PARAMETRI PULSANTI URL ---------------------------------

    const buttonParamUsages: ButtonParamUsage[] = [];
    let buttonIndex = 0;

    components.forEach((comp: any) => {
        if (!Array.isArray(comp?.buttons)) return;

        comp.buttons.forEach((btn: any) => {
            const url: string = btn?.url || '';
            const params = url ? extractParamsFromText(url) : [];
            params.forEach((p) => {
                buttonParamUsages.push({
                    buttonIndex,
                    label: btn?.text || `Bottone #${buttonIndex}`,
                    url,
                    param: p,
                });
            });

            buttonIndex++;
        });
    });

    const [buttonBindings, setButtonBindings] = useState<Record<string, BindConfig>>(
        {}
    );

    const updateButtonBinding = (key: string, patch: Partial<BindConfig>) => {
        setButtonBindings((prev) => ({
            ...prev,
            [key]: { ...prev[key], ...patch },
        }));
    };

    // Opzioni per il bind dei pulsanti (select)
    const dynamicOptions: { label: string; value: string }[] = [
        { label: 'literal', value: 'literal' },
        { label: 'Nome Cliente', value: 'user.nome' },
        { label: 'Cognome Cliente', value: 'user.cognome' },
        { label: 'Codice Promozione', value: 'promo.codice' },
    ];

    // -------------------- SUBMIT ---------------------------------------------

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload: Record<string, { bind: string; sample?: string; value?: string }> =
            {};

        // testo: chiave = `${section}:${param}` → es. "body:1"
        Object.entries(textBindings).forEach(([key, conf]) => {
            if (!conf.bind) return;

            payload[key] = {
                bind: conf.bind,
                ...(conf.sample ? { sample: conf.sample } : {}),
                ...(conf.bind === 'literal' && conf.value
                    ? { value: conf.value }
                    : {}),
            };
        });

        // bottoni: chiave = `btn:${index}:${param}` → es. "btn:0:1"
        Object.entries(buttonBindings).forEach(([key, conf]) => {
            if (!conf.bind) return;

            payload[key] = {
                bind: conf.bind,
                ...(conf.sample ? { sample: conf.sample } : {}),
                ...(conf.bind === 'literal' && conf.value
                    ? { value: conf.value }
                    : {}),
            };
        });

        setSalvataggioInCorso(true);
        try {
            if (isEditing) {
                const result = await ServerCall.put<{
                    success: boolean; error?: string
                }>("/whatsapp/modifica_preset_template_whatsapp", {
                    id_preset: selectedPreset!,
                    nome_preset: (e.target as any).presetName.value,
                    contenuto_preset: payload,
                });
                if (!result.success) {
                    showNotification(`Errore nella modifica del preset: ${result.error || 'Si è verificato un errore sconosciuto.'}`, { variant: 'error' });
                    return;
                } else {
                    revalidate();
                }
            } else {
                const result = await ServerCall.post<{
                    success: boolean;
                    newPresetId?: string;
                    error?: string;
                }>("/whatsapp/crea_preset_template_whatsapp", {
                    id_template: template.id_gdowhatsapptemplate,
                    nome_preset: (e.target as any).presetName.value,
                    contenuto_preset: payload,
                });

                if (!result.success) {
                    showNotification(`Errore nella creazione del preset: ${result.error || 'Si è verificato un errore sconosciuto.'}`, { variant: 'error' });
                    return;
                } else {
                    revalidate();
                }
            }
        } catch (error: unknown) {
            showNotification(error instanceof Error ? error.message : 'Errore durante il salvataggio del preset', { variant: 'error' });
        } finally {
            setSalvataggioInCorso(false);
        }
    };

    async function updateIsDefaultTemplate(id_preset: string) {
        const result = await ServerCall.put<{ success: boolean; error?: string }>(
            "/whatsapp/set_default_preset_template_whatsapp",
            { id_preset }
        );
        if (!result.success) {
            showNotification(`Errore nell'impostare il preset come default: ${result.error || 'Si è verificato un errore sconosciuto.'}`, { variant: 'error' });
            return;
        }
        revalidate();
    }

    useEffect(() => {
        if (!selectedPreset) return;
        const preset = presets.find(p => p.id_gdowhatsappreset === selectedPreset);
        if (!preset) return;

        // Popola i campi del form
        // nome preset
        if (preset.nome_preset_gdowhatsappreset) {
            const input = document.getElementById('presetName') as HTMLInputElement;
            if (input) input.value = preset.nome_preset_gdowhatsappreset;
        }

        if (preset.json_meta_gdowhatsappreset) {
            const textBindingsPatch: Record<string, BindConfig> = {};
            Object.entries(preset.json_meta_gdowhatsappreset).forEach(([key, conf]: [string, any]) => {
                if (!key.startsWith('btn:')) {
                    textBindingsPatch[key] = {
                        bind: conf.bind,
                        sample: conf.sample,
                        value: conf.value,
                    };
                }
            });
            setTextBindings(textBindingsPatch);

            // Bindings bottoni
            const buttonBindingsPatch: Record<string, BindConfig> = {};
            Object.entries(preset.json_meta_gdowhatsappreset).forEach(([key, conf]: [string, any]) => {
                if (key.startsWith('btn:')) {
                    buttonBindingsPatch[key] = {
                        bind: conf.bind,
                        sample: conf.sample,
                        value: conf.value,
                    };
                }
            });
            setButtonBindings(buttonBindingsPatch);
        }

        setIsEditing(true);
    }, [selectedPreset]);
    // -------------------- RENDER ---------------------------------------------

    return (
        <>
            <ConfirmDialog
                open={!!presetDaEliminare}
                title="Eliminare il preset?"
                description={<>Il preset <strong>{presetDaEliminare?.nome_preset_gdowhatsappreset}</strong> verrà eliminato. Le campagne già inviate non cambiano.</>}
                confirmLabel="Elimina"
                loading={eliminazioneInCorso}
                onClose={() => !eliminazioneInCorso && setPresetDaEliminare(null)}
                onConfirm={eliminaPreset}
            />
            <Pagina
                titolo="Preset WhatsApp"
                descrizione={
                    template?.nome_template_gdowhatsapptemplate
                        ? `Preset del template ${template.nome_template_gdowhatsapptemplate}: come si compilano i suoi segnaposto.`
                        : 'Preset del template: come si compilano i suoi segnaposto.'
                }
                indietro={{
                    to: `/whatsapp/gestione-whatsapp-superadmin/templates?id=${template?.id_gdo_gdowhatsapptemplate ?? ''}`,
                    etichetta: 'Torna ai template',
                }}
            >

            {errore || !template ? (
                <PageError
                    titolo="Template non caricato"
                    motivo={errore || 'Il template indicato non esiste o non è più disponibile.'}
                    onRiprova={revalidate}
                />
            ) : (
            <>
                {/* Preset esistenti (sempre in alto, full width) */}
                <Sezione senzaPadding titolo="Preset esistenti">
                    {presets.length === 0 ? (
                        <EmptyState
                            compatta
                            title="Nessun preset"
                            description="Questo template non ha ancora preset: creane uno con il modulo qui sotto."
                            icon="CircleOff"
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Nome</Table.Th>
                                        <Table.Th>Stato</Table.Th>
                                        <Table.Th>Hash</Table.Th>
                                        <Table.Th>Ultimo aggiornamento</Table.Th>
                                        <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {presets.map((preset, i) => (
                                        <Table.Tr key={i}>
                                            <Table.Td className="font-medium text-slate-800">
                                                <Lucide icon="MessageSquare" aria-hidden="true" className="mr-2 inline-block h-4 w-4 align-middle text-slate-400" />
                                                {preset.nome_preset_gdowhatsappreset}
                                            </Table.Td>
                                            <Table.Td>
                                                {preset.is_default_gdowhatsappreset && (
                                                    <StatusBadge tono="success" etichetta="Predefinito" />
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <code className="rounded-control bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                                                    {preset.hash_gdowhatsappreset}
                                                </code>
                                            </Table.Td>
                                            <Table.Td>
                                                {preset.updatedat ? formatDataOraEstesa(preset.updatedat) : VALORE_ASSENTE}
                                            </Table.Td>
                                            <Table.Td className="text-right">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_PRESETS} mode="disable">
                                                        <Button
                                                            size="sm"
                                                            onClick={async () => {
                                                                setPresetDefaultInCorso(preset.id_gdowhatsappreset ?? null);
                                                                try {
                                                                    await updateIsDefaultTemplate(preset.id_gdowhatsappreset!);
                                                                } catch (error: unknown) {
                                                                    showNotification(error instanceof Error ? error.message : 'Errore nell\'impostare il preset come default', { variant: 'error' });
                                                                } finally {
                                                                    setPresetDefaultInCorso(null);
                                                                }
                                                            }}
                                                            variant="outline-secondary"
                                                            loading={presetDefaultInCorso === preset.id_gdowhatsappreset}
                                                            disabled={preset.is_default_gdowhatsappreset || presetDefaultInCorso !== null}
                                                            title="Imposta come default"
                                                        >
                                                            {presetDefaultInCorso !== preset.id_gdowhatsappreset && (
                                                                <Lucide icon="Star" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                                            )}
                                                            Default
                                                        </Button>
                                                    </PermissionGate>
                                                    <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_PRESETS} mode="disable">
                                                        <Button
                                                            size="sm"
                                                            variant="outline-secondary"
                                                            aria-pressed={isEditing && selectedPreset === preset.id_gdowhatsappreset}
                                                            className={isEditing && selectedPreset === preset.id_gdowhatsappreset ? 'bg-slate-100' : undefined}
                                                            onClick={() => {
                                                                if (isEditing && selectedPreset === preset.id_gdowhatsappreset) {
                                                                    // Deseleziona e resetta form
                                                                    setIsEditing(false);
                                                                    setSelectedPreset(undefined);
                                                                    // Reset campi form
                                                                    const input = document.getElementById('presetName') as HTMLInputElement;
                                                                    if (input) input.value = '';
                                                                    const textarea = document.getElementById('presetMessage') as HTMLTextAreaElement;
                                                                    if (textarea) textarea.value = '';
                                                                    setTextBindings({});
                                                                    setButtonBindings({});
                                                                } else {
                                                                    // Seleziona
                                                                    setSelectedPreset(preset.id_gdowhatsappreset);
                                                                    setIsEditing(true);
                                                                }
                                                            }}

                                                        >
                                                            <Lucide icon="Pen" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                                            Modifica
                                                        </Button>
                                                    </PermissionGate>
                                                    <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_PRESETS} mode="disable">
                                                        <Button
                                                            size="sm"
                                                            variant="outline-danger"
                                                            title="Elimina"
                                                            aria-label={`Elimina preset ${preset.nome_preset_gdowhatsappreset}`}
                                                            onClick={() => setPresetDaEliminare(preset)}
                                                        >
                                                            <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </PermissionGate>
                                                </div>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </div>
                    )}
                </Sezione>

                {/* Crea / aggiorna preset (sotto, full width) */}
                <Sezione titolo={isEditing ? "Aggiorna preset" : "Crea preset"}>
                    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                        {/* Nome preset */}
                        <FormField
                            etichetta="Nome preset"
                            aiuto={<>Usa <strong>“default”</strong> se vuoi che sia quello di esercizio.</>}
                        >
                            <FormInput
                                id="presetName"
                                name="presetName"
                                placeholder="default"
                            />
                        </FormField>

                        {/* TESTO (header / body / footer) */}
                        {textParamUsages.length > 0 && (
                            <div className="border-t border-dashed border-slate-200 pt-5">
                                <h3 className="title-card mb-2">
                                    Testo (header / body / footer)
                                </h3>

                                <div className="flex flex-col gap-4">
                                    {textParamUsages.map((usage) => {
                                        const key = `${usage.section}:${usage.param}`;
                                        const conf = textBindings[key] || {};

                                        return (
                                            <div
                                                key={key}
                                                className="p-3 rounded-control border border-slate-200 bg-slate-50"
                                            >
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 mb-2">
                                                    <div className="text-sm font-medium text-slate-700">
                                                        {usage.label} · &#123;&#123;{usage.param}&#125;&#125;
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {/* Bind */}
                                                    <div>
                                                        <FormLabel
                                                            htmlFor={`${key}_bind`}
                                                            >
                                                            Bind
                                                        </FormLabel>
                                                        <FormSelect
                                                            id={`${key}_bind`}
                                                            name={`${key}_bind`}
                                                            value={conf.bind ?? ''}
                                                            onChange={(e) =>
                                                                updateTextBinding(key, {
                                                                    bind: e.target.value,
                                                                })
                                                            }
                                                        >
                                                            <option value="">Seleziona bind</option>
                                                            {dynamicOptions.map((opt) => (
                                                                <option
                                                                    key={opt.value}
                                                                    value={opt.value}
                                                                >
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </FormSelect>
                                                    </div>

                                                    {/* Sample (solo se literal, ma la colonna rimane allineata) */}
                                                    {conf.bind === 'literal' && (
                                                        <>
                                                            <div>
                                                                <FormLabel
                                                                    htmlFor={`${key}_sample`}
                                                                >
                                                                    Sample
                                                                </FormLabel>
                                                                <FormInput
                                                                    id={`${key}_sample`}
                                                                    name={`${key}_sample`}
                                                                    placeholder="Sample (es. Mario)"
                                                                    value={conf.sample ?? ''}
                                                                    onChange={(e) =>
                                                                        updateTextBinding(key, {
                                                                            sample: e.target.value,
                                                                        })
                                                                    }
                                                                />
                                                            </div>
                                                            <div>
                                                                <FormLabel
                                                                    htmlFor={`${key}_value`}
                                                                >
                                                                    Value
                                                                </FormLabel>
                                                                <FormInput
                                                                    id={`${key}_value`}
                                                                    name={`${key}_value`}
                                                                    placeholder="Value (solo se bind=literal)"
                                                                    value={conf.value ?? ''}
                                                                    onChange={(e) =>
                                                                        updateTextBinding(key, {
                                                                            value: e.target.value,
                                                                        })
                                                                    }
                                                                />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                <p className="text-xs mt-2 text-slate-500">
                                                    Se scegli <strong>literal</strong>, compila
                                                    anche “Value”.
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* PULSANTI URL */}
                        {buttonParamUsages.length > 0 && (
                            <div className="border-t border-dashed border-slate-200 pt-5">
                                <h3 className="title-card mb-1">
                                    Pulsanti URL
                                </h3>
                                <p className="text-xs mb-3 text-slate-500">
                                    Inserisci solo la parte dinamica che sostituisce {' '}
                                    &#123;&#123;1&#125;&#125; (es.
                                    <span className="italic"> catalogo01.html</span>).
                                </p>

                                <div className="flex flex-col gap-4">
                                    {buttonParamUsages.map((btn) => {
                                        const key = `btn:${btn.buttonIndex}:${btn.param}`;
                                        const conf = buttonBindings[key] || {};

                                        return (
                                            <div
                                                key={key}
                                                className="p-3 rounded-control border border-slate-200 bg-slate-50"
                                            >
                                                <div className="text-sm mb-1">
                                                    <span className="font-medium text-slate-700">
                                                        Bottone #{btn.buttonIndex} - «{btn.label}»
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 mb-3">
                                                    URL base:{' '}
                                                    <span className="break-all text-primary">
                                                        {btn.url}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {/* Bind (select) */}
                                                    <div>
                                                        <FormLabel
                                                            htmlFor={`${key}_bind`}
                                                            >
                                                            Bind
                                                        </FormLabel>
                                                        <FormSelect
                                                            id={`${key}_bind`}
                                                            name={`${key}_bind`}
                                                            value={conf.bind ?? ''}
                                                            onChange={(e) =>
                                                                updateButtonBinding(key, {
                                                                    bind: e.target.value,
                                                                })
                                                            }
                                                        >
                                                            <option value="">Seleziona bind</option>
                                                            {dynamicOptions.map((opt) => (
                                                                <option
                                                                    key={opt.value}
                                                                    value={opt.value}
                                                                >
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </FormSelect>
                                                    </div>

                                                    {conf.bind === 'literal' && (
                                                        <>
                                                            <div>
                                                                <FormLabel
                                                                    htmlFor={`${key}_sample`}
                                                                >
                                                                    Sample
                                                                </FormLabel>
                                                                <FormInput
                                                                    id={`${key}_sample`}
                                                                    name={`${key}_sample`}
                                                                    className="mt-0"
                                                                    placeholder="Sample (es. catalogo01.html)"
                                                                    value={conf.sample ?? ''}
                                                                    onChange={(e) =>
                                                                        updateButtonBinding(key, {
                                                                            sample: e.target.value,
                                                                        })
                                                                    }
                                                                />
                                                            </div>

                                                            <div>
                                                                <FormLabel
                                                                    htmlFor={`${key}_value`}
                                                                >
                                                                    Value
                                                                </FormLabel>
                                                                <FormInput
                                                                    id={`${key}_value`}
                                                                    name={`${key}_value`}
                                                                    className="mt-0"
                                                                    placeholder="Value (se literal)"
                                                                    value={conf.value ?? ''}
                                                                    onChange={(e) =>
                                                                        updateButtonBinding(key, {
                                                                            value: e.target.value,
                                                                        })
                                                                    }
                                                                />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                <p className="text-xs mt-2 text-slate-500">
                                                    Se bind ≠ <strong>literal</strong>, “Value”
                                                    non serve. “Sample” serve sempre per la
                                                    preview.
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Messaggio (se ti serve tenerlo) */}
                        <div className="border-t border-dashed border-slate-200 pt-5">
                            <FormLabel htmlFor="presetMessage">
                                Messaggio WhatsApp
                            </FormLabel>
                            <FormTextarea
                                id="presetMessage"
                                name="presetMessage"
                                rows={3}
                                placeholder="Inserisci il messaggio"
                            />
                        </div>

                        <div className="flex justify-end">
                            <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_PRESETS} mode="disable">
                                <Button type="submit" variant="primary" className="w-full md:w-auto" loading={salvataggioInCorso}>
                                    {isEditing ? 'Aggiorna preset' : 'Crea preset'}
                                </Button>
                            </PermissionGate>
                        </div>
                    </form>
                </Sezione>
            </>
            )}
            </Pagina>
        </>
    );
};

export default withSessionCheck(GestionePresetsWhatsappSuperAdmin);
