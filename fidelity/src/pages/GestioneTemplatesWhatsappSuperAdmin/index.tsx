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
import Badge from "../../components/Base/Badge";
import Pagina from "../../components/Base/Pagina";
import Sezione from "../../components/Base/Sezione";
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
            <Pagina
                titolo={
                    "Gestione Templates WhatsApp" +
                    (dettagliGDO?.nome ? ` · ${dettagliGDO.nome}` : "")
                }
                descrizione="Visualizza e gestisci i template Meta WhatsApp associati al cliente."
                indietro={{ to: "/whatsapp/gestione-whatsapp-superadmin", etichetta: "Torna alle GDO" }}
                azioni={
                    <>
                        <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_TEMPLATES} mode="disable">
                            <Button
                                variant="outline-secondary"
                                onClick={syncFromMeta}
                                loading={syncing}
                                disabled={syncing || !dettagliGDO || !!hasPendingTemplates}
                                className="whitespace-nowrap"
                                title={
                                    hasPendingTemplates
                                        ? "Il template non può essere sincronizzato perché c'è almeno un template che non è ancora stato validato"
                                        : undefined
                                }
                            >
                                {!syncing && <Lucide icon="RefreshCw" aria-hidden="true" className="mr-2 h-4 w-4" />}
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
                                className="whitespace-nowrap"
                            >
                                <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
                                Crea nuovo template
                            </Button>
                        </PermissionGate>
                    </>
                }
            >
                {/* CONTENUTO PRINCIPALE */}
                {errore ? (
                    <PageError motivo={errore} onRiprova={revalidate} />
                ) : dettagliGDO ? (
                    <Sezione
                        senzaPadding
                        titolo="Template"
                        descrizione={`${templatesCount} template del cliente`}
                    >
                        {templatesWhatsapp && templatesWhatsapp.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th className="w-3/12">Nome template</Table.Th>
                                            <Table.Th className="w-2/12 text-center">Categoria</Table.Th>
                                            <Table.Th className="w-1/12 text-center">Lingua</Table.Th>
                                            <Table.Th className="w-2/12 text-center">Stato</Table.Th>
                                            <Table.Th className="w-4/12 text-right"><span className="sr-only">Azioni</span></Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {templatesWhatsapp.map((template) => {
                                            const stato = template.stato_meta_gdowhatsapptemplate;
                                            const attivo =
                                                stato !== STATO_GDO_WHATSAPP_TEMPLATE.PENDING &&
                                                stato !== STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED &&
                                                stato !== STATO_GDO_WHATSAPP_TEMPLATE.REJECTED;
                                            return (
                                                <Table.Tr key={template.id_gdowhatsapptemplate} className="align-middle">
                                                    <Table.Td>
                                                        <div className="font-medium text-slate-800">
                                                            {template.nome_template_gdowhatsapptemplate}
                                                        </div>
                                                    </Table.Td>

                                                    <Table.Td className="text-center">
                                                        <Badge variant="secondary" size="sm">
                                                            {template.categoria_template_gdowhatsapptemplate}
                                                        </Badge>
                                                    </Table.Td>

                                                    <Table.Td className="text-center">
                                                        <Badge variant="secondary" size="sm">
                                                            {template.lingua_template_gdowhatsapptemplate?.toUpperCase()}
                                                        </Badge>
                                                    </Table.Td>

                                                    <Table.Td className="text-center">
                                                        <StatusBadge dominio="waTemplate" stato={stato} />
                                                    </Table.Td>

                                                    <Table.Td className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {stato === STATO_GDO_WHATSAPP_TEMPLATE.REJECTED && (
                                                                // ponytail: niente pagina di dettaglio; la nuova versione mostra il template da correggere
                                                                <Button size="sm" variant="outline-secondary" onClick={() => navigate("nuova-versione?id=" + template.id_gdowhatsapptemplate)}>
                                                                    Dettaglio
                                                                </Button>
                                                            )}
                                                            {stato === STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED && (
                                                                <Button size="sm" variant="outline-secondary" onClick={() => navigate("nuova-versione?id=" + template.id_gdowhatsapptemplate)}>
                                                                    Modifica
                                                                </Button>
                                                            )}
                                                            {attivo && (
                                                                <>
                                                                    <Button size="sm" variant="outline-secondary" onClick={() => navigate("nuova-versione?id=" + template.id_gdowhatsapptemplate)}>
                                                                        Nuova versione
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline-secondary"
                                                                        onClick={() => {
                                                                            navigate("presets?id=" + template.id_gdowhatsapptemplate);
                                                                        }}
                                                                    >
                                                                        Preset (<span className="tabular-nums">{template.preset_count || 0}</span>)
                                                                    </Button>
                                                                </>
                                                            )}
                                                            <PermissionGate permission={PERMISSIONS.WHATSAPP.GESTISCI_TEMPLATES} mode="disable">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline-danger"
                                                                    title="Elimina"
                                                                    aria-label={`Elimina template ${template.nome_template_gdowhatsapptemplate}`}
                                                                    onClick={() => setTemplateDaEliminare(template)}
                                                                >
                                                                    <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </PermissionGate>
                                                        </div>
                                                    </Table.Td>
                                                </Table.Tr>
                                            );
                                        })}
                                    </Table.Tbody>
                                </Table>
                            </div>
                        ) : (
                            <EmptyState
                                compatta
                                title="Nessun template"
                                description="Il cliente non ha ancora template WhatsApp: creane uno o sincronizzali da Meta."
                                icon="Notebook"
                            />
                        )}
                    </Sezione>
                ) : (
                    <Sezione>
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
                    </Sezione>
                )}
            </Pagina>
        </Fragment>
    );
};

export default withSessionCheck(GestioneTemplatesWhatsappSuperAdmin);
