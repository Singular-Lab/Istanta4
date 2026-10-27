import React, { Fragment, useEffect, useMemo, useState } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router-dom";
import { STATO_GDO_WHATSAPP_TEMPLATE } from "../../../lib/enums";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { ServerCall } from "../../../lib/server_call";
import type { GDOWhatsappTemplateAttributes } from "../../../lib/types";
import Button from "../../components/Base/Button";
import Lucide from "../../components/Base/Lucide";
import PageError from "../../components/Base/PageError";
import PageHeader from "../../components/Base/PageHeader";
import StatusBadge from "../../components/Base/StatusBadge";
import Table from "../../components/Base/Table";
import EmptyState from "../../components/EmptyState";
import { descriviStato } from "../../constants/stati";
import { useNotification } from "../../context/NotificationContext";
import type { DettagliGDOWhatsapp } from "../../router/loaderFunctions";

// Utils
function toTitle(str: string): string {
    return str
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Simple debounce hook
function useDebounced<T>(value: T, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

// Types
type Filters = {
    nome: string;
    stato: string;
    lingua: string;
};

const defaultFilters: Filters = { nome: "", stato: "", lingua: "" };

// Helpers to sync with URL
const readFiltersFromURL = (): Filters => {
    const p = new URLSearchParams(window.location.search);
    return {
        nome: p.get("nome") ?? "",
        stato: p.get("stato") ?? "",
        lingua: p.get("lingua") ?? "",
    };
};

const writeFiltersToURL = (f: Filters) => {
    const p = new URLSearchParams(window.location.search);
    Object.entries(f).forEach(([k, v]) => {
        if (v) p.set(k, v);
        else p.delete(k);
    });
    const qs = p.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState({}, "", url);
};

const GestioneTemplatesWhatsappSuperAdmin: React.FC = () => {
    const { showNotification } = useNotification();
    const [filters, setFilters] = useState<Filters>(() => readFiltersFromURL());
    const debouncedFilters = useDebounced(filters, 300);

    const { idGDO, templatesWhatsapp, dettagliGDO, errore } = useLoaderData() as {
        idGDO: string;
        templatesWhatsapp: (GDOWhatsappTemplateAttributes & { preset_count: number })[];
        dettagliGDO: DettagliGDOWhatsapp | null;
        errore: string | null;
    };

    const navigate = useNavigate();
    const { revalidate } = useRevalidator();

    const [syncing, setSyncing] = useState(false);
    const [templateDaEliminare, setTemplateDaEliminare] = useState<GDOWhatsappTemplateAttributes | null>(null);
    const [eliminazioneInCorso, setEliminazioneInCorso] = useState(false);

    const eliminaTemplate = async () => {
        if (!templateDaEliminare) return;
        setEliminazioneInCorso(true);
        try {
            await ServerCall.delete(`/whatsapp/template/${templateDaEliminare.id_gdowhatsapptemplate}`);
            showNotification("Template eliminato", { variant: "success" });
            setTemplateDaEliminare(null);
            revalidate();
        } catch (error: unknown) {
            showNotification(error instanceof Error ? error.message : "Errore durante l'eliminazione del template", { variant: "error" });
        } finally {
            setEliminazioneInCorso(false);
        }
    };

    const templatesCount = templatesWhatsapp?.length ?? 0;

    // Derived: active tags
    const activeTags = useMemo(() => {
        const tags: { key: keyof Filters; label: string; value: string }[] = [];
        if (filters.nome) tags.push({ key: "nome", label: "Nome", value: filters.nome });
        if (filters.stato) tags.push({ key: "stato", label: "Stato", value: toTitle(filters.stato) });
        if (filters.lingua) tags.push({ key: "lingua", label: "Lingua", value: filters.lingua.toUpperCase() });
        return tags;
    }, [filters]);

    // Keep URL in sync
    useEffect(() => {
        writeFiltersToURL(debouncedFilters);
    }, [debouncedFilters]);

    // Handlers
    const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
    const resetAll = () => setFilters(defaultFilters);

    const applyFilters = () => {
        writeFiltersToURL(filters);
    };

    const onEnterApply: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter") applyFilters();
    };

    const statoOptions = useMemo(
        () =>
            Object.entries(STATO_GDO_WHATSAPP_TEMPLATE).map(([key, value]: [string, string]) => ({
                key,
                value: key,
                label: descriviStato("waTemplate", value).etichetta,
            })),
        []
    );

    const syncFromMeta = async () => {
        if (!dettagliGDO?.id_gdo) {
            showNotification("ID GDO non disponibile: impossibile sincronizzare.", { variant: "warning" });
            return;
        }

        try {
            setSyncing(true);
            const gdoId = dettagliGDO.id_gdo;
            const result = await ServerCall.put<{ success: boolean; error?: string }>("/whatsapp/sync_templates_from_meta", { gdoId });
            // Meta che rifiuta arriva come success: false, non come errore HTTP
            if (!result?.success) {
                throw new Error(result?.error || "Sincronizzazione non riuscita");
            }
            revalidate();
        } catch (err: any) {
            console.error("Sync da Meta fallito", err);
            showNotification(`Errore durante la sincronizzazione: ${err?.message || err}`, { variant: "error" });
        } finally {
            setSyncing(false);
        }
    };

    const hasPendingTemplates = (templatesWhatsapp ?? []).find(
        (t) => t.stato_meta_gdowhatsapptemplate === STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED
    );

    // Un template già inviato a Meta viene eliminato anche lì, e Meta non permette di riusare il nome per un po'
    const giaSuMeta = !!(templateDaEliminare?.json_meta_gdowhatsapptemplate as { id?: string } | undefined)?.id;

    return (
        <Fragment>
            <ConfirmDialog
                open={!!templateDaEliminare}
                title="Eliminare il template?"
                description={
                    <>
                        Il template <strong>{templateDaEliminare?.nome_template_gdowhatsapptemplate}</strong> verrà eliminato
                        {giaSuMeta
                            ? " anche su Meta, per questa lingua. Le campagne già inviate restano consultabili; Meta non permette di riusare subito lo stesso nome."
                            : " insieme ai suoi preset."}
                    </>
                }
                confirmLabel="Elimina"
                loading={eliminazioneInCorso}
                onClose={() => !eliminazioneInCorso && setTemplateDaEliminare(null)}
                onConfirm={eliminaTemplate}
            />
            <div className="space-y-6">
                <PageHeader
                    title={
                        "Gestione Templates WhatsApp" +
                        (dettagliGDO?.nome ? ` · ${dettagliGDO.nome}` : "")
                    }
                    description="Visualizza, filtra e gestisci i template Meta WhatsApp associati al cliente."
                    indietro={{ to: "/whatsapp/gestione-whatsapp-superadmin", etichetta: "Torna alle GDO" }}
                    actions={
                        <>
                            <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_TEMPLATES} mode="disable">
                                <Button
                                    variant="secondary"
                                    onClick={syncFromMeta}
                                    loading={syncing}
                                    disabled={syncing || !dettagliGDO || !!hasPendingTemplates}
                                    className="whitespace-nowrap shadow-sm"
                                    title={
                                        hasPendingTemplates
                                            ? "Il template non può essere sincronizzato perché c'è almeno un template che non è ancora stato validato"
                                            : undefined
                                    }
                                >
                                    {!syncing && <Lucide icon="RefreshCw" aria-hidden="true" className="-ml-0.5 mr-2 h-4 w-4" />}
                                    Sincronizza da Meta
                                </Button>
                            </PermissionGate>

                            <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_TEMPLATES} mode="disable">
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        navigate(`crea?id=${encodeURIComponent(idGDO)}`);
                                    }}
                                    disabled={!idGDO}
                                    className="whitespace-nowrap shadow-sm"
                                >
                                    <Lucide icon="Plus" aria-hidden="true" className="-ml-0.5 mr-2 h-4 w-4" />
                                    Crea nuovo template
                                </Button>
                            </PermissionGate>
                        </>
                    }
                />

                {/* CONTENUTO PRINCIPALE */}
                {errore ? (
                    <PageError motivo={errore} onRiprova={revalidate} />
                ) : dettagliGDO ? (
                    <div className="space-y-5">
                        {/* TABELLA TEMPLATE */}
                        <div className="box box--stacked p-4">
                            {templatesWhatsapp && templatesWhatsapp.length > 0 ? (
                                <Table className="w-full rounded-card border" bordered>
                                    <Table.Thead variant="light">
                                        <Table.Tr className="border-b border-slate-200">
                                            <Table.Th className="w-2/12 text-left font-semibold text-slate-700">
                                                Nome Template
                                            </Table.Th>
                                            <Table.Th className="w-2/12 text-center font-semibold text-slate-700">
                                                Categoria
                                            </Table.Th>
                                            <Table.Th className="w-2/12 text-center font-semibold text-slate-700">
                                                Lingua
                                            </Table.Th>
                                            <Table.Th className="w-2/12 text-center font-semibold text-slate-700">
                                                Stato
                                            </Table.Th>
                                            <Table.Th className="w-3/12 text-right font-semibold text-slate-700">
                                                Azioni
                                            </Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {templatesWhatsapp.map((template, idx) => (
                                            <Table.Tr
                                                key={template.id_gdowhatsapptemplate}
                                                className={`align-middle transition-colors hover:bg-slate-50/50 ${idx !== templatesWhatsapp.length - 1 ? 'border-b border-slate-100' : ''
                                                    }`}
                                            >
                                                <Table.Td className="">
                                                    <div className="font-medium text-slate-900">
                                                        {template.nome_template_gdowhatsapptemplate}
                                                    </div>
                                                </Table.Td>

                                                <Table.Td className="text-center ">
                                                    <span className="inline-flex items-center justify-center rounded-control bg-slate-100 px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-700">
                                                        {template.categoria_template_gdowhatsapptemplate}
                                                    </span>
                                                </Table.Td>

                                                <Table.Td className="text-center ">
                                                    <span className="inline-flex items-center justify-center rounded-control bg-slate-100 px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-700">
                                                        {template.lingua_template_gdowhatsapptemplate?.toUpperCase()}
                                                    </span>
                                                </Table.Td>

                                                <Table.Td className="text-center ">
                                                    <div className="flex justify-center">
                                                        <StatusBadge
                                                            dominio="waTemplate"
                                                            stato={template.stato_meta_gdowhatsapptemplate}
                                                        />
                                                    </div>
                                                </Table.Td>

                                                <Table.Td className="">
                                                    <div className="flex justify-end gap-2">
                                                        {template.stato_meta_gdowhatsapptemplate === STATO_GDO_WHATSAPP_TEMPLATE.REJECTED && (
                                                            <Button
                                                                size="sm"
                                                                variant="soft-danger"
                                                                onClick={() => {
                                                                    // ponytail: niente pagina di dettaglio; la nuova versione mostra il template da correggere
                                                                    navigate(
                                                                        "nuova-versione?id=" +
                                                                        template.id_gdowhatsapptemplate
                                                                    );
                                                                }}
                                                                className="text-xs py-1.5 px-3 shadow-sm"
                                                            >
                                                                Dettaglio
                                                            </Button>
                                                        )}
                                                        {template.stato_meta_gdowhatsapptemplate === STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED && (
                                                            <Button
                                                                size="sm"
                                                                variant="soft-primary"
                                                                onClick={() => {
                                                                    navigate(
                                                                        "nuova-versione?id=" +
                                                                        template.id_gdowhatsapptemplate
                                                                    );
                                                                }}
                                                                className="text-xs py-1.5 px-3 shadow-sm"
                                                            >
                                                                Modifica
                                                            </Button>
                                                        )}
                                                        {(template.stato_meta_gdowhatsapptemplate !== STATO_GDO_WHATSAPP_TEMPLATE.PENDING &&
                                                            template.stato_meta_gdowhatsapptemplate !== STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED &&
                                                            template.stato_meta_gdowhatsapptemplate !== STATO_GDO_WHATSAPP_TEMPLATE.REJECTED
                                                        ) && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="soft-primary"
                                                                        onClick={() => {
                                                                            navigate(
                                                                                "nuova-versione?id=" +
                                                                                template.id_gdowhatsapptemplate
                                                                            );
                                                                        }}
                                                                        className="text-xs py-1.5 px-3 shadow-sm"
                                                                    >
                                                                        Inc. versione
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="soft-pending"
                                                                        onClick={() => {
                                                                            navigate(
                                                                                "presets?id=" +
                                                                                template.id_gdowhatsapptemplate
                                                                            );
                                                                        }}
                                                                        className="text-xs py-1.5 px-3 shadow-sm"
                                                                    >
                                                                        Preset ({template.preset_count || 0})
                                                                    </Button>
                                                                </>
                                                            )}
                                                        <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_TEMPLATES} mode="disable">
                                                            <Button
                                                                size="sm"
                                                                variant="outline-danger"
                                                                title="Elimina"
                                                                onClick={() => setTemplateDaEliminare(template)}
                                                                className="text-xs py-1.5 px-3 shadow-sm"
                                                            >
                                                                Elimina
                                                            </Button>
                                                        </PermissionGate>
                                                    </div>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            ) : (
                                <div className="px-6 py-12">
                                    <EmptyState
                                        title="Nessun template trovato"
                                        description="Non ci sono template che corrispondono ai filtri selezionati o al cliente corrente."
                                        icon="Notebook"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="box box--stacked">
                        <div className="px-6 py-12">
                            <EmptyState
                                title="Canale WhatsApp non configurato"
                                description="Configura il numero WhatsApp della GDO per gestirne i template."
                                icon="Settings"
                                buttonText="Configura il canale"
                                buttonIcon="Settings"
                                onButtonClick={() => {
                                    navigate(`/whatsapp/gestione-whatsapp-superadmin/setup?id=${encodeURIComponent(idGDO)}`);
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </Fragment>
    );
};

export default withSessionCheck(GestioneTemplatesWhatsappSuperAdmin);
