import React, { Fragment, useEffect, useMemo, useState } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router-dom";
import { STATO_GDO_WHATSAPP_TEMPLATE } from "../../../lib/enums";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { ServerCall } from "../../../lib/server_call";
import type { GDOWhatsappTemplateAttributes } from "../../../lib/types";
import Badge from "../../components/Base/Badge";
import Button from "../../components/Base/Button";
import PageHeader from "../../components/Base/PageHeader";
import Table from "../../components/Base/Table";
import EmptyState from "../../components/EmptyState";

// Utils
function toTitle(str: string): string {
    return str
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Badge per lo stato
const StatoBadge: React.FC<{ stato: STATO_GDO_WHATSAPP_TEMPLATE }> = ({ stato }) => {
    const colors: Record<
        STATO_GDO_WHATSAPP_TEMPLATE,
        "success" | "warning" | "secondary" | "primary" | "error" | "info" | undefined
    > = {
        APPROVED: "success",
        PENDING: "warning",
        REJECTED: "error",
        PAUSED: "warning",
        DISABLED: "secondary",
        DELETED: "error",
        ARCHIVED: "secondary",
        PENDING_DELETION: "warning",
        IN_APPEAL: "info",
        LIMIT_EXCEEDED: "error",
        CREATED_BUT_NOT_SYNCED: "warning",
    };

    const getStatoLabel = (stato: STATO_GDO_WHATSAPP_TEMPLATE) => {
        switch (stato) {
            case "APPROVED":
                return "Approvato";
            case "PENDING":
                return "In attesa";
            case "REJECTED":
                return "Rifiutato";
            case "PAUSED":
                return "In pausa";
            case "DISABLED":
                return "Disabilitato";
            case "DELETED":
                return "Eliminato";
            case "ARCHIVED":
                return "Archiviato";
            case "PENDING_DELETION":
                return "In attesa eliminazione";
            case "IN_APPEAL":
                return "In ricorso";
            case "LIMIT_EXCEEDED":
                return "Limite superato";
            case "CREATED_BUT_NOT_SYNCED":
                return "Creato (non sincronizzato)";
            default:
                return "Bozza";
        }
    };

    return (
        <Badge size="sm" border variant={colors[stato] || "secondary"}>
            {getStatoLabel(stato)}
        </Badge>
    );
};

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
    const [filters, setFilters] = useState<Filters>(() => readFiltersFromURL());
    const debouncedFilters = useDebounced(filters, 300);

    const { templatesWhatsapp, dettagliGDO } = useLoaderData<{
        templatesWhatsapp: (GDOWhatsappTemplateAttributes & { preset_count: number })[];
        dettagliGDO: any;
    }>();

    const navigate = useNavigate();
    const { revalidate } = useRevalidator();

    const [syncing, setSyncing] = useState(false);

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
                label: toTitle(value),
            })),
        []
    );

    const syncFromMeta = async () => {
        if (!dettagliGDO?.id && !dettagliGDO?.id_gdo) {
            alert("ID GDO non disponibile: impossibile sincronizzare.");
            return;
        }

        try {
            setSyncing(true);
            const gdoId = dettagliGDO.id_gdo;
            await ServerCall.put("/whatsapp/sync_templates_from_meta", { gdoId });
            revalidate();
        } catch (err: any) {
            console.error("Sync da Meta fallito", err);
            alert(`Errore durante la sincronizzazione: ${err?.message || err}`);
        } finally {
            setSyncing(false);
        }
    };

    const hasPendingTemplates = templatesWhatsapp.find(
        (t) => t.stato_meta_gdowhatsapptemplate === STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED
    );

    return (
        <Fragment>
            <div className="space-y-6">
                {/* HEADER */}
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-1">
                        <PageHeader
                            title={
                                "Gestione Templates WhatsApp" +
                                (dettagliGDO?.nome ? ` · ${dettagliGDO.nome}` : "")
                            }
                            description="Visualizza, filtra e gestisci i template Meta WhatsApp associati al cliente."
                        />
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-3">
                        <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_TEMPLATES} mode="disable">
                            <Button
                                variant="secondary"
                                onClick={syncFromMeta}
                                disabled={syncing || !!hasPendingTemplates}
                                className="whitespace-nowrap shadow-sm"
                                title={
                                    hasPendingTemplates
                                        ? "Il template non può essere sincronizzato perché c'è almeno un template che non è ancora stato validato"
                                        : undefined
                                }
                            >
                                {syncing ? (
                                    <>
                                        <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sincronizzazione...
                                    </>
                                ) : (
                                    <>
                                        <svg className="-ml-0.5 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Sincronizza da Meta
                                    </>
                                )}
                            </Button>
                        </PermissionGate>

                        <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_TEMPLATES} mode="disable">
                            <Button
                                variant="primary"
                                onClick={() => {
                                    navigate("crea");
                                }}
                                className="whitespace-nowrap shadow-sm"
                            >
                                <svg className="-ml-0.5 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Crea nuovo template
                            </Button>
                        </PermissionGate>
                    </div>
                </div>

                {/* CONTENUTO PRINCIPALE */}
                {dettagliGDO ? (
                    <div className="space-y-5">
                        {/* TABELLA TEMPLATE */}
                        <div className="box box--stacked p-4">
                            {templatesWhatsapp && templatesWhatsapp.length > 0 ? (
                                <Table className="w-full rounded-md border" bordered>
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
                                                    <span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                                                        {template.categoria_template_gdowhatsapptemplate}
                                                    </span>
                                                </Table.Td>

                                                <Table.Td className="text-center ">
                                                    <span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                                                        {template.lingua_template_gdowhatsapptemplate?.toUpperCase()}
                                                    </span>
                                                </Table.Td>

                                                <Table.Td className="text-center ">
                                                    <div className="flex justify-center">
                                                        <StatoBadge
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
                                                                    navigate(
                                                                        "dettaglio?id=" +
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
                                                        <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_TEMPLATES}>
                                                            <Button
                                                                size="sm"
                                                                variant="soft-danger"
                                                                onClick={() =>
                                                                    template.id_gdowhatsapptemplate &&
                                                                    alert(
                                                                        `Elimina template con ID: ${template.id_gdowhatsapptemplate}`
                                                                    )
                                                                }
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
                                title="Dettagli GDO non trovati"
                                description="Non è stato possibile caricare i dettagli del cliente GDO."
                                icon="CircleAlert"
                                iconColor="text-danger"
                                buttonText="Torna indietro"
                                onButtonClick={() => {
                                    navigate("/whatsapp/gestione-whatsapp-superadmin", { replace: true });
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
