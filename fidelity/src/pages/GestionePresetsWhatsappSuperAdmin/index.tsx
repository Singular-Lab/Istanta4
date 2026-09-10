import clsx from 'clsx';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router-dom';
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { ServerCall } from '../../../lib/server_call';
import type { GDOWhatsappPresetAttributes } from '../../../lib/types';
import Button from '../../components/Base/Button';
import {
    FormInput,
    FormLabel,
    FormSelect,
    FormTextarea,
} from '../../components/Base/Form';
import Lucide from '../../components/Base/Lucide';
import PageHeader from '../../components/Base/PageHeader';
import Table from '../../components/Base/Table';
import EmptyState from '../../components/EmptyState';
import { useNotification } from '../../context/NotificationContext';

const Card: React.FC<{
    title?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}> = ({ title, right, children, className }) => (
    <div className={clsx('box box--stacked p-5 mb-5', className)}>
        {title && (
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[0.94rem] font-medium">{title}</h3>
                {right}
            </div>
        )}
        {children}
    </div>
);

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
    const { template, presets } = useLoaderData() as {
        template: any;
        presets: GDOWhatsappPresetAttributes[];
    };
    const { showNotification } = useNotification();
    const { revalidate } = useRevalidator();
    const [isLoadingNewDefault, setIsLoadingNewDefault] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
    const [isEditing, setIsEditing] = useState(false);
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
        console.log(template);
        if (isEditing) {
            const result = await ServerCall.put<{
                success: boolean; error?: string
            }>("/whatsapp/modifica_preset_template_whatsapp", {
                id_preset: selectedPreset!,
                nome_preset: (e.target as any).presetName.value,
                contenuto_preset: payload,
            });
            if (!result.success) {
                showNotification(
                    <div className="flex flex-row items-center">
                        <Lucide icon="CircleX" className="text-danger w-8 h-8" />
                        <div className="ml-4 mr-4">
                            <div className="font-bold">Errore nella creazione del preset</div>
                            <div className="mt-1 text-slate-500">
                                {result.error || 'Si è verificato un errore sconosciuto.'}
                            </div>
                        </div>
                    </div>
                );
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
                showNotification(
                    <div className="flex flex-row items-center">
                        <Lucide icon="CircleX" className="text-danger w-8 h-8" />
                        <div className="ml-4 mr-4">
                            <div className="font-bold">Errore nella creazione del preset</div>
                            <div className="mt-1 text-slate-500">
                                {result.error || 'Si è verificato un errore sconosciuto.'}
                            </div>
                        </div>
                    </div>
                );
                return;
            } else {
                revalidate();
            }
            console.log('PAYLOAD PRESET WHATSAPP →', payload);
        }
    };

    async function updateIsDefaultTemplate(id_preset: string) {
        console.log("ID PRESET E TEMPLATE →", id_preset);
        const result = await ServerCall.put<{ success: boolean; error?: string }>(
            "/whatsapp/set_default_preset_template_whatsapp",
            { id_preset }
        );
        if (!result.success) {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleX" className="text-danger w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold">Errore nell'impostare il preset come default</div>
                        <div className="mt-1 text-slate-500">
                            {result.error || 'Si è verificato un errore sconosciuto.'}
                        </div>
                    </div>
                </div>
            );
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
        <div>
            <PageHeader
                title="Gestione Presets WhatsApp Super Admin"
                description="In questa pagina puoi gestire i presets di WhatsApp per il Super Admin."
            />

            <div className="space-y-6">
                {/* Card 1: preset esistenti (sempre in alto, full width) */}
                <Card title="Preset esistenti">
                    {presets.length === 0 ? (
                        <EmptyState
                            title="Nessun Preset Disponibile"
                            description="Non ci sono preset di WhatsApp disponibili per il Super Admin."
                            icon="CircleOff"
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table sm bordered>
                                <Table.Thead variant="light">
                                    <Table.Tr>
                                        <Table.Th>Nome</Table.Th>
                                        <Table.Th>Stato</Table.Th>
                                        <Table.Th>Hash</Table.Th>
                                        <Table.Th>Ultimo update</Table.Th>
                                        <Table.Th>Azioni</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {presets.map((preset, i) => (
                                        <Table.Tr key={i}>
                                            <Table.Td className="font-semibold">
                                                <Lucide icon="MessageSquare" className="inline-block mr-2 text-primary w-4 h-4 align-middle" />
                                                {preset.nome_preset_gdowhatsappreset}
                                            </Table.Td>
                                            <Table.Td>
                                                {preset.is_default_gdowhatsappreset && (
                                                    <span className="badge badge-success mr-1">Default</span>
                                                )}
                                            </Table.Td>
                                            <Table.Td className="text-primary">
                                                <code className="bg-slate-100 rounded px-2 py-1 text-xs font-mono">
                                                    {preset.hash_gdowhatsappreset}
                                                </code>
                                            </Table.Td>
                                            <Table.Td>
                                                {preset.updatedat
                                                    ? dayjs(preset.updatedat).format('DD/MM/YYYY [alle] HH:mm:ss')
                                                    : '—'}
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex flex-wrap gap-1">
                                                    <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_PRESETS} mode="disable">
                                                        <Button
                                                            size="xs"
                                                            onClick={async () => {
                                                                setIsLoadingNewDefault(true);
                                                                await updateIsDefaultTemplate(preset.id_gdowhatsappreset!);
                                                                setIsLoadingNewDefault(false);
                                                            }}
                                                            variant={preset.is_default_gdowhatsappreset ? 'primary' : 'outline-primary'}
                                                            disabled={preset.is_default_gdowhatsappreset || isLoadingNewDefault}
                                                            title="Imposta come default"
                                                        >
                                                            {isLoadingNewDefault && !preset.is_default_gdowhatsappreset ? (
                                                                <Lucide icon="Loader" className="w-4 h-4 mr-1 animate-spin" />
                                                            ) : (
                                                                <Lucide icon="Star" className="w-4 h-4 mr-1" />
                                                            )}
                                                            Default
                                                        </Button>
                                                    </PermissionGate>
                                                    <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_PRESETS} mode="disable">
                                                        <Button
                                                            size="xs"
                                                            variant={
                                                                isEditing && selectedPreset === preset.id_gdowhatsappreset
                                                                    ? 'secondary'
                                                                    : 'outline-secondary'
                                                            }
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
                                                            <Lucide icon="Pen" className="w-4 h-4 mr-1" />
                                                            Modifica
                                                        </Button>
                                                    </PermissionGate>
                                                    <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_PRESETS}>
                                                        <Button
                                                            size="xs"
                                                            variant="outline-danger"
                                                            title="Elimina"
                                                        >
                                                            <Lucide icon="Trash2" className="w-4 h-4 mr-1" /> Elimina
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
                </Card>

                {/* Card 2: crea / aggiorna preset (sotto, full width) */}
                <Card title="Crea / aggiorna preset" className="h-full">
                    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                        {/* Nome preset */}
                        <div>
                            <FormLabel htmlFor="presetName">Nome preset</FormLabel>
                            <FormInput
                                id="presetName"
                                name="presetName"
                                placeholder="default"
                            />
                            <p className="text-[0.75rem] mt-1 text-slate-500">
                                Usa <strong>“default”</strong> se vuoi che sia quello di esercizio.
                            </p>
                        </div>

                        {/* TESTO (header / body / footer) */}
                        {textParamUsages.length > 0 && (
                            <div className="border-t border-slate-200 pt-4">
                                <div className="font-semibold mb-2">
                                    Testo (header / body / footer)
                                </div>

                                <div className="flex flex-col gap-4">
                                    {textParamUsages.map((usage) => {
                                        const key = `${usage.section}:${usage.param}`;
                                        const conf = textBindings[key] || {};

                                        return (
                                            <div
                                                key={key}
                                                className="p-3 rounded-md border border-slate-200 bg-slate-50"
                                            >
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 mb-2">
                                                    <div className="text-sm font-semibold">
                                                        {usage.label} · &#123;&#123;{usage.param}&#125;&#125;
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {/* Bind */}
                                                    <div>
                                                        <FormLabel
                                                            htmlFor={`${key}_bind`}
                                                            className="text-xs"
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
                                                                    className="text-xs"
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
                                                                    className="text-xs"
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

                                                <p className="text-[0.75rem] mt-2 text-slate-500">
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
                            <div className="border-t border-slate-200 pt-4">
                                <h3 className="font-semibold mb-1 text-danger">
                                    Pulsanti URL
                                </h3>
                                <p className="text-[0.75rem] mb-3 text-slate-500">
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
                                                className="p-3 rounded-md border border-slate-200 bg-slate-50"
                                            >
                                                <div className="text-sm mb-1">
                                                    <span className="font-semibold">
                                                        Bottone #{btn.buttonIndex} - «{btn.label}»
                                                    </span>
                                                </div>
                                                <div className="text-[0.75rem] text-slate-500 mb-3">
                                                    URL base:{' '}
                                                    <span className="text-pink-500 break-all">
                                                        {btn.url}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {/* Bind (select) */}
                                                    <div>
                                                        <FormLabel
                                                            htmlFor={`${key}_bind`}
                                                            className="text-xs"
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
                                                                    className="text-xs"
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
                                                                    className="text-xs"
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

                                                <p className="text-[0.75rem] mt-2 text-slate-500">
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
                        <div className="border-t border-slate-200 pt-4">
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

                        <div className="pt-2">
                            <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_PRESETS} mode="disable">
                                <Button type="submit" variant="submit" className="w-full md:w-auto">
                                    {isEditing ? 'Aggiorna Preset' : 'Crea Preset'}
                                </Button>
                            </PermissionGate>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default withSessionCheck(GestionePresetsWhatsappSuperAdmin);
