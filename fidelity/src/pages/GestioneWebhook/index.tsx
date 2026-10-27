import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import { FormCheck, FormField, FormInput, FormSelect, FormTextarea } from "@/components/Base/Form";
import BarraFiltri from "@/components/Base/BarraFiltri";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { Dialog, Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PermissionGate } from "@/components/PermissionGate";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { formatDataOra, formatNumero } from "@/utils/format";
import type { TonoStato } from "@/constants/stati";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { EVENTI_WEBHOOK, STATO_TENTATIVO_WEBHOOK, STATO_WEBHOOK } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { WebhookAttributes } from "../../../lib/types";

interface WebhookFormData {
    nome_webhook: string;
    url_webhook: string;
    descrizione_webhook: string;
    eventi_webhook: string[];
    headers_webhook?: string;
    timeout_webhook: number;
    retry_webhook: number;
    stato_webhook: string;
}


/** Esito di una singola chiamata al webhook, come mostrato nelle statistiche. */
const STATI_TENTATIVO: Record<string, { tono: TonoStato; etichetta: string }> = {
    [STATO_TENTATIVO_WEBHOOK.SUCCESSO]: { tono: "success", etichetta: "Successo" },
    [STATO_TENTATIVO_WEBHOOK.FALLITO]: { tono: "danger", etichetta: "Fallito" },
    [STATO_TENTATIVO_WEBHOOK.TIMEOUT]: { tono: "warning", etichetta: "Timeout" },
    [STATO_TENTATIVO_WEBHOOK.RETRY]: { tono: "warning", etichetta: "Nuovo tentativo" },
    [STATO_TENTATIVO_WEBHOOK.IN_ATTESA]: { tono: "neutral", etichetta: "In attesa" },
};

const descriviTentativo = (stato: string) => STATI_TENTATIVO[stato] ?? { tono: "warning" as const, etichetta: stato };

function GestioneWebhook() {
    const { showNotification } = useNotification();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<WebhookAttributes | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [testDialogOpen, setTestDialogOpen] = useState(false);
    const [statsDialogOpen, setStatsDialogOpen] = useState(false);
    const [selectedWebhookForAction, setSelectedWebhookForAction] = useState<WebhookAttributes | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        setValue,
        watch,
        trigger,
        getValues
    } = useForm<WebhookFormData>({
        defaultValues: {
            timeout_webhook: 30,
            retry_webhook: 3,
            stato_webhook: STATO_WEBHOOK.ATTIVO,
            eventi_webhook: []
        }
    });

    // Query per ottenere i webhook
    const { data: webhooks = [], isLoading, isError, error: erroreWebhook, refetch } = useQuery<WebhookAttributes[]>({
        queryKey: ['webhooks'],
        queryFn: async () => {
            const response = await ServerCall.get<{ success: boolean, data: WebhookAttributes[], count: number }>('/webhooks');
            return response.data || [];
        }
    });

    // Mutation per creare webhook
    const createWebhookMutation = useMutation({
        mutationFn: async (data: WebhookFormData) => {
            const response = await ServerCall.post<{ success: boolean, data: WebhookAttributes, message: string }>('/webhooks', data);
            return response.data;
        },
        onSuccess: () => {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold">Webhook creato con successo</div>
                    </div>
                </div>
            );
            setIsDialogOpen(false);
            reset();
            refetch();
        },
        onError: (error: any) => {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold">Errore durante la creazione</div>
                        <div className="mt-1 text-slate-500">{error.message}</div>
                    </div>
                </div>
            );
        }
    });

    // Mutation per aggiornare webhook
    const updateWebhookMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: WebhookFormData }) => {
            const response = await ServerCall.put<{ success: boolean, data: WebhookAttributes, message: string }>(`/webhooks/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold">Webhook aggiornato con successo</div>
                    </div>
                </div>
            );
            setIsDialogOpen(false);
            setEditingWebhook(null);
            reset();
            refetch();
        },
        onError: (error: any) => {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold">Errore durante l'aggiornamento</div>
                        <div className="mt-1 text-slate-500">{error.message}</div>
                    </div>
                </div>
            );
        }
    });

    // Mutation per eliminare webhook
    const deleteWebhookMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await ServerCall.delete<{ success: boolean, message: string }>(`/webhooks/${id}`);
            return response;
        },
        onSuccess: () => {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold">Webhook eliminato con successo</div>
                    </div>
                </div>
            );
            refetch();
        },
        onError: (error: any) => {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold">Errore durante l'eliminazione</div>
                        <div className="mt-1 text-slate-500">{error.message}</div>
                    </div>
                </div>
            );
        }
    });

    // Mutation per testare webhook
    const testWebhookMutation = useMutation({
        mutationFn: async ({ id, testData }: { id: string; testData: any }) => {
            const response = await ServerCall.post<{ success: boolean, message: string }>(`/webhooks/${id}/test`, testData);
            return response;
        },
        onSuccess: () => {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold">Test webhook inviato con successo</div>
                    </div>
                </div>
            );
            setTestDialogOpen(false);
        },
        onError: (error: any) => {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold">Errore durante il test</div>
                        <div className="mt-1 text-slate-500">{error.message}</div>
                    </div>
                </div>
            );
        }
    });

    // Query per ottenere statistiche webhook
    const {
        data: webhookStats,
        refetch: refetchStats,
        isError: erroreStatistiche,
        error: dettaglioErroreStatistiche,
    } = useQuery({
        queryKey: ['webhook-stats', selectedWebhookForAction?.id_webhook],
        queryFn: async () => {
            if (!selectedWebhookForAction?.id_webhook) return null;
            const response = await ServerCall.get<{ success: boolean, data: any }>(`/webhooks/${selectedWebhookForAction.id_webhook}/statistiche`);
            return response.data;
        },
        enabled: !!selectedWebhookForAction?.id_webhook && statsDialogOpen
    });

    // Filtro webhook basato sulla ricerca
    const filteredWebhooks = webhooks.filter((webhook : WebhookAttributes) =>
        webhook.descrizione_webhook?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        webhook.url_webhook.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateWebhook = () => {
        setEditingWebhook(null);
        reset({
            timeout_webhook: 30,
            retry_webhook: 3,
            stato_webhook: STATO_WEBHOOK.ATTIVO,
            eventi_webhook: []
        });
        setIsDialogOpen(true);
    };

    const handleEditWebhook = (webhook: WebhookAttributes) => {
        setEditingWebhook(webhook);
        setValue('nome_webhook', webhook.nome_webhook);
        setValue('url_webhook', webhook.url_webhook);
        setValue('descrizione_webhook', webhook.descrizione_webhook || '');
        setValue('eventi_webhook', webhook.eventi_webhook);
        setValue('headers_webhook', JSON.stringify(webhook.headers_personalizzati_webhook || {}));
        setValue('timeout_webhook', webhook.timeout_webhook);
        setValue('retry_webhook', webhook.retry_count_webhook);
        setValue('stato_webhook', webhook.stato_webhook);
        setIsDialogOpen(true);
    };

    const [webhookDaEliminare, setWebhookDaEliminare] = useState<WebhookAttributes | null>(null);

    const handleDeleteWebhook = () => {
        if (!webhookDaEliminare) return;
        deleteWebhookMutation.mutate(webhookDaEliminare.id_webhook, {
            onSettled: () => setWebhookDaEliminare(null),
        });
    };

    const handleTestWebhook = (webhook: WebhookAttributes) => {
        setSelectedWebhookForAction(webhook);
        setTestDialogOpen(true);
    };

    const handleShowStats = (webhook: WebhookAttributes) => {
        setSelectedWebhookForAction(webhook);
        setStatsDialogOpen(true);
        refetchStats();
    };

    const onSubmit: SubmitHandler<WebhookFormData> = (data) => {
        // Validazione manuale per gli eventi (checkbox array)
        if (!data.eventi_webhook || data.eventi_webhook.length === 0) {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold">Errore di validazione</div>
                        <div className="mt-1 text-slate-500">Seleziona almeno un evento</div>
                    </div>
                </div>
            );
            return;
        }

        // Validazione JSON headers se forniti
        if (data.headers_webhook && data.headers_webhook.trim()) {
            try {
                JSON.parse(data.headers_webhook);
            } catch (e) {
                showNotification(
                    <div className="flex flex-row items-center">
                        <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
                        <div className="ml-4 mr-4">
                            <div className="font-bold">Errore di validazione</div>
                            <div className="mt-1 text-slate-500">Headers deve essere un JSON valido</div>
                        </div>
                    </div>
                );
                return;
            }
        }

        if (editingWebhook) {
            updateWebhookMutation.mutate({ id: editingWebhook.id_webhook, data });
        } else {
            createWebhookMutation.mutate(data);
        }
    };

    const selectedEventi = watch('eventi_webhook') || [];

    return (
        <>
            <Pagina
                titolo="Gestione Webhook"
                descrizione="Gestisci i webhook per ricevere notifiche degli eventi del sistema"
                azioni={
                    <PermissionGate permission={PERMISSIONS.WEBHOOK.GESTISCI} mode="disable">
                        <Button variant="primary" onClick={handleCreateWebhook}>
                            <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
                            Nuovo Webhook
                        </Button>
                    </PermissionGate>
                }
            >
                <Sezione
                    senzaPadding
                    titolo="Webhook"
                    descrizione={
                        isLoading || isError
                            ? undefined
                            : `${filteredWebhooks.length} ${filteredWebhooks.length === 1 ? "webhook trovato" : "webhook trovati"}`
                    }
                >
                    <BarraFiltri
                        destra={
                            searchQuery ? (
                                <Button type="button" size="sm" variant="outline-secondary" onClick={() => setSearchQuery("")}>
                                    <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                    Cancella ricerca
                                </Button>
                            ) : undefined
                        }
                    >
                        <CampoRicerca
                            etichetta="Cerca webhook"
                            placeholder="Cerca per descrizione o URL"
                            value={searchQuery}
                            onChange={setSearchQuery}
                        />
                    </BarraFiltri>

                    {/* Tabella webhook */}
                    <div className="overflow-x-auto">
                        <Table>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Webhook</Table.Th>
                                    <Table.Th>Eventi</Table.Th>
                                    <Table.Th className="text-center">Stato</Table.Th>
                                    <Table.Th>Configurazione</Table.Th>
                                    <Table.Th>Ultima Modifica</Table.Th>
                                    <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {isLoading ? (
                                    <Table.Tr>
                                        <Table.Td colSpan={6} className="py-8 text-center">
                                            <div className="flex items-center justify-center">
                                                <Spinner etichetta="Caricamento webhook…" />
                                            </div>
                                        </Table.Td>
                                    </Table.Tr>
                                ) : isError ? (
                                    <Table.Tr>
                                        <Table.Td colSpan={6}>
                                            <PageError
                                                compatta
                                                titolo="Webhook non caricati"
                                                motivo={(erroreWebhook as Error)?.message || "Errore durante il recupero dei webhook"}
                                                onRiprova={() => refetch()}
                                            />
                                        </Table.Td>
                                    </Table.Tr>
                                ) : filteredWebhooks.length > 0 ? (
                                    filteredWebhooks.map((webhook: WebhookAttributes) => (
                                        <Table.Tr key={webhook.id_webhook}>
                                            <Table.Td>
                                                <div className="font-medium text-slate-800">{webhook.descrizione_webhook}</div>
                                                <div className="break-all text-xs text-slate-500">{webhook.url_webhook}</div>
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex flex-wrap gap-1">
                                                    {webhook.eventi_webhook.slice(0, 3).map((evento, idx) => (
                                                        <Badge key={idx} variant="secondary" size="sm">
                                                            {evento.replace('_', ' ')}
                                                        </Badge>
                                                    ))}
                                                    {webhook.eventi_webhook.length > 3 && (
                                                        <Badge variant="secondary" size="sm">
                                                            +{webhook.eventi_webhook.length - 3}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </Table.Td>
                                            <Table.Td className="text-center">
                                                <StatusBadge dominio="webhook" stato={webhook.stato_webhook} />
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="text-xs text-slate-500">
                                                    <div>Timeout: {webhook.timeout_webhook}s</div>
                                                    <div>Retry: {webhook.retry_count_webhook}</div>
                                                </div>
                                            </Table.Td>
                                            <Table.Td className="whitespace-nowrap text-xs tabular-nums text-slate-500">
                                                {formatDataOra(webhook.updatedat_webhook)}
                                            </Table.Td>
                                            <Table.Td className="text-right">
                                                <Menu className="inline-block text-left">
                                                    <Menu.Button
                                                        as={Button}
                                                        size="sm"
                                                        variant="outline-secondary"
                                                        aria-label={`Azioni webhook ${webhook.nome_webhook}`}
                                                    >
                                                        <Lucide icon="EllipsisVertical" aria-hidden="true" className="h-4 w-4" />
                                                    </Menu.Button>
                                                    <Menu.Items className="w-48">
                                                        <Menu.Item onClick={() => handleTestWebhook(webhook)}>
                                                            <Lucide icon="Play" aria-hidden="true" className="mr-2 h-4 w-4" />
                                                            Test webhook
                                                        </Menu.Item>
                                                        <Menu.Item onClick={() => handleShowStats(webhook)}>
                                                            <Lucide icon="ChartBar" aria-hidden="true" className="mr-2 h-4 w-4" />
                                                            Statistiche
                                                        </Menu.Item>
                                                        <Menu.Item onClick={() => handleEditWebhook(webhook)}>
                                                            <Lucide icon="Pencil" aria-hidden="true" className="mr-2 h-4 w-4" />
                                                            Modifica
                                                        </Menu.Item>
                                                        <PermissionGate permission={PERMISSIONS.WEBHOOK.GESTISCI}>
                                                            <Menu.Item className="text-danger" onClick={() => setWebhookDaEliminare(webhook)}>
                                                                <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
                                                                Elimina
                                                            </Menu.Item>
                                                        </PermissionGate>
                                                    </Menu.Items>
                                                </Menu>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))
                                ) : (
                                    <Table.Tr>
                                        <Table.Td colSpan={6} className="p-0">
                                            <EmptyState
                                                compatta
                                                icon={searchQuery ? "SearchX" : "Webhook"}
                                                title={searchQuery ? "Nessun risultato" : "Nessun webhook configurato"}
                                                description={searchQuery
                                                    ? `Nessun webhook corrisponde a "${searchQuery}"`
                                                    : "Non sono stati configurati webhook. Crea il primo webhook per iniziare."
                                                }
                                            />
                                        </Table.Td>
                                    </Table.Tr>
                                )}
                            </Table.Tbody>
                        </Table>
                    </div>
                </Sezione>
            </Pagina>

            {/* Dialog per creare/modificare webhook */}
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} size="xl">
                <Dialog.Panel>
                    <Dialog.Title>{editingWebhook ? 'Modifica Webhook' : 'Nuovo Webhook'}</Dialog.Title>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <Dialog.Description>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField className="md:col-span-2" etichetta="Nome" obbligatorio errore={errors.nome_webhook?.message}>
                                    <FormInput
                                        id="nome_webhook"
                                        type="text"
                                        placeholder="Nome del webhook"
                                        {...register("nome_webhook", {
                                            required: "Nome richiesto"
                                        })}
                                        className={clsx(errors.nome_webhook && "border-danger")}
                                    />
                                </FormField>
                                <FormField className="md:col-span-2" etichetta="Descrizione" obbligatorio errore={errors.descrizione_webhook?.message}>
                                    <FormTextarea
                                        id="descrizione_webhook"
                                        rows={3}
                                        placeholder="Descrizione del webhook"
                                        {...register("descrizione_webhook", {
                                            required: "Descrizione richiesta"
                                        })}
                                        className={clsx(errors.descrizione_webhook && "border-danger")}
                                    />
                                </FormField>

                                <FormField className="md:col-span-2" etichetta="URL Webhook" obbligatorio errore={errors.url_webhook?.message}>
                                    <FormInput
                                        id="url_webhook"
                                        type="url"
                                        placeholder="https://example.com/webhook"
                                        {...register("url_webhook", {
                                            required: "URL richiesto",
                                            pattern: {
                                                value: /^https?:\/\/.+/,
                                                message: "URL non valido"
                                            }
                                        })}
                                        className={clsx(errors.url_webhook && "border-danger")}
                                    />
                                </FormField>

                                <fieldset className="md:col-span-2">
                                    <legend className="mb-2">
                                        Eventi da ascoltare
                                        <span aria-hidden="true" className="ml-0.5 text-danger">*</span>{" "}
                                        <span className="sr-only">(obbligatorio)</span>
                                    </legend>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {Object.values(EVENTI_WEBHOOK).map((evento) => (
                                            <FormCheck key={evento}>
                                                <FormCheck.Input
                                                    id={`evento-${evento}`}
                                                    type="checkbox"
                                                    value={evento}
                                                    onChange={(e) => {
                                                        const value = e.target.checked;
                                                        if (value) {
                                                            setValue("eventi_webhook", [...selectedEventi, evento]);
                                                        } else {
                                                            setValue("eventi_webhook", selectedEventi.filter((e) => e !== evento));
                                                        }
                                                    }}
                                                    checked={selectedEventi.includes(evento)}
                                                />
                                                <FormCheck.Label htmlFor={`evento-${evento}`}>{evento.replace(/_/g, ' ')}</FormCheck.Label>
                                            </FormCheck>
                                        ))}
                                    </div>
                                    {errors.eventi_webhook && (
                                        <p className="mt-1.5 text-xs text-danger">{errors.eventi_webhook.message}</p>
                                    )}
                                </fieldset>

                                <FormField etichetta="Timeout (secondi)" obbligatorio errore={errors.timeout_webhook?.message}>
                                    <FormInput
                                        id="timeout_webhook"
                                        type="number"
                                        min="1"
                                        max="300"
                                        {...register("timeout_webhook", {
                                            valueAsNumber: true,
                                            required: "Timeout richiesto",
                                            min: {
                                                value: 1,
                                                message: "Timeout minimo 1 secondo"
                                            },
                                            max: {
                                                value: 300,
                                                message: "Timeout massimo 300 secondi"
                                            }
                                        })}
                                        className={clsx(errors.timeout_webhook && "border-danger")}
                                    />
                                </FormField>

                                <FormField etichetta="Tentativi di Retry" obbligatorio errore={errors.retry_webhook?.message}>
                                    <FormInput
                                        id="retry_webhook"
                                        type="number"
                                        min="0"
                                        max="10"
                                        {...register("retry_webhook", {
                                            valueAsNumber: true,
                                            required: "Retry richiesto",
                                            min: {
                                                value: 0,
                                                message: "Retry minimo 0"
                                            },
                                            max: {
                                                value: 10,
                                                message: "Retry massimo 10"
                                            }
                                        })}
                                        className={clsx(errors.retry_webhook && "border-danger")}
                                    />
                                </FormField>

                                <FormField className="md:col-span-2" etichetta="Stato" obbligatorio errore={errors.stato_webhook?.message}>
                                    <FormSelect
                                        id="stato_webhook"
                                        {...register("stato_webhook", {
                                            required: "Stato richiesto"
                                        })}
                                        className={clsx(errors.stato_webhook && "border-danger")}
                                    >
                                        <option value={STATO_WEBHOOK.ATTIVO}>Attivo</option>
                                        <option value={STATO_WEBHOOK.DISATTIVO}>Disattivo</option>
                                    </FormSelect>
                                </FormField>

                                <FormField
                                    className="md:col-span-2"
                                    etichetta="Headers HTTP (JSON)"
                                    aiuto="Opzionale. Formato JSON per headers HTTP personalizzati."
                                    errore={errors.headers_webhook?.message}
                                >
                                    <FormTextarea
                                        id="headers_webhook"
                                        rows={3}
                                        placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                                        {...register("headers_webhook")}
                                        className={clsx(errors.headers_webhook && "border-danger")}
                                    />
                                </FormField>
                            </div>
                        </Dialog.Description>
                        <Dialog.Footer>
                            <Button
                                type="button"
                                variant="outline-secondary"
                                onClick={() => setIsDialogOpen(false)}
                            >
                                Annulla
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={createWebhookMutation.isPending || updateWebhookMutation.isPending}
                            >
                                {editingWebhook ? 'Aggiorna Webhook' : 'Crea Webhook'}
                            </Button>
                        </Dialog.Footer>
                    </form>
                </Dialog.Panel>
            </Dialog>

            {/* Dialog per testare webhook */}
            <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} size="md">
                <Dialog.Panel>
                    <Dialog.Title>Test Webhook: {selectedWebhookForAction?.nome_webhook}</Dialog.Title>
                    <Dialog.Description>
                        <div className="space-y-4">
                            <div className="rounded-card bg-slate-50 p-4">
                                <div className="mb-2 text-sm text-slate-600">URL Webhook:</div>
                                <div className="break-all rounded-control border border-slate-200 bg-white p-2 font-mono text-sm">
                                    {selectedWebhookForAction?.url_webhook}
                                </div>
                            </div>

                            <FormField etichetta="Dati di Test (JSON)">
                                <FormTextarea
                                    rows={6}
                                    placeholder='{"test": true, "message": "Test webhook", "timestamp": "2024-01-01T00:00:00Z"}'
                                    defaultValue='{"test": true, "message": "Test webhook"}'
                                    id="test-data"
                                />
                            </FormField>
                        </div>
                    </Dialog.Description>
                    <Dialog.Footer>
                        <Button
                            type="button"
                            variant="outline-secondary"
                            onClick={() => setTestDialogOpen(false)}
                        >
                            Annulla
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            loading={testWebhookMutation.isPending}
                            onClick={() => {
                                const testDataElement = document.getElementById('test-data') as HTMLTextAreaElement;
                                let testData = {};
                                try {
                                    testData = JSON.parse(testDataElement.value);
                                } catch (e) {
                                    testData = { message: testDataElement.value };
                                }
                                testWebhookMutation.mutate({
                                    id: selectedWebhookForAction!.id_webhook,
                                    testData
                                });
                            }}
                        >
                            Invia Test
                        </Button>
                    </Dialog.Footer>
                </Dialog.Panel>
            </Dialog>

            {/* Dialog per statistiche webhook */}
            <Dialog open={statsDialogOpen} onClose={() => setStatsDialogOpen(false)} size="xl">
                <Dialog.Panel>
                    <Dialog.Title>Statistiche Webhook: {selectedWebhookForAction?.nome_webhook}</Dialog.Title>
                    <Dialog.Description>
                        {webhookStats ? (
                            <div className="flex flex-col gap-5">
                                <StatCardGrid className="lg:grid-cols-3">
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Totale chiamate"
                                        valore={formatNumero(webhookStats.statistiche_base.chiamate_totali || 0)}
                                        icona="Send"
                                        tono="brand"
                                    />
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Successi"
                                        valore={formatNumero(webhookStats.statistiche_base.chiamate_successo || 0)}
                                        icona="CircleCheck"
                                        tono="success"
                                    />
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Fallimenti"
                                        valore={formatNumero(webhookStats.statistiche_base.chiamate_fallite || 0)}
                                        icona="CircleX"
                                        tono="danger"
                                        evidenzia={(webhookStats.statistiche_base.chiamate_fallite || 0) > 0}
                                    />
                                </StatCardGrid>
                                <div>
                                    <h3 className="title-card mb-2">Tentativi Recenti</h3>
                                    <div className="overflow-x-auto rounded-card border border-slate-200">
                                        <Table>
                                            <Table.Thead>
                                                <Table.Tr>
                                                    <Table.Th>Data</Table.Th>
                                                    <Table.Th>Stato</Table.Th>
                                                    <Table.Th>HTTP Status</Table.Th>
                                                    <Table.Th className="text-right">Durata (ms)</Table.Th>
                                                    <Table.Th>Errore</Table.Th>
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {webhookStats.tentativi_recenti.map((tentativo : any, index : number) => (
                                                    <Table.Tr key={index}>
                                                        <Table.Td className="whitespace-nowrap tabular-nums text-slate-500">
                                                            {formatDataOra(tentativo.createdat_tentativo)}
                                                        </Table.Td>
                                                        <Table.Td className="whitespace-nowrap">
                                                            <StatusBadge {...descriviTentativo(tentativo.stato_tentativo)} />
                                                        </Table.Td>
                                                        <Table.Td className="whitespace-nowrap tabular-nums text-slate-500">
                                                            {tentativo.http_status_tentativo || '-'}
                                                        </Table.Td>
                                                        <Table.Td className="whitespace-nowrap text-right tabular-nums text-slate-500">
                                                            {tentativo.durata_ms_tentativo}
                                                        </Table.Td>
                                                        <Table.Td className="max-w-xs truncate text-slate-500">
                                                            {tentativo.messaggio_errore_tentativo || '-'}
                                                        </Table.Td>
                                                    </Table.Tr>
                                                ))}
                                                {webhookStats.tentativi_recenti.length === 0 && (
                                                    <Table.Tr>
                                                        <Table.Td colSpan={5} className="p-0">
                                                            <EmptyState
                                                                compatta
                                                                icon="FileClock"
                                                                title="Nessun tentativo registrato"
                                                                description="Le chiamate al webhook compariranno qui."
                                                            />
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )}
                                            </Table.Tbody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        ) : erroreStatistiche ? (
                            <PageError
                                compatta
                                titolo="Statistiche non caricate"
                                motivo={(dettaglioErroreStatistiche as Error)?.message || "Errore durante il recupero delle statistiche"}
                                onRiprova={() => refetchStats()}
                            />
                        ) : (
                            <div className="flex justify-center py-8">
                                <Spinner etichetta="Caricamento statistiche…" />
                            </div>
                        )}
                    </Dialog.Description>
                    <Dialog.Footer>
                        <Button
                            type="button"
                            variant="outline-secondary"
                            onClick={() => setStatsDialogOpen(false)}
                        >
                            Chiudi
                        </Button>
                    </Dialog.Footer>
                </Dialog.Panel>
            </Dialog>

            <ConfirmDialog
                open={!!webhookDaEliminare}
                title="Eliminare il webhook?"
                description={`Il webhook "${webhookDaEliminare?.nome_webhook ?? ""}" verrà eliminato e l'URL ${webhookDaEliminare?.url_webhook ?? ""} non riceverà più eventi.`}
                confirmLabel="Elimina webhook"
                loading={deleteWebhookMutation.isPending}
                onClose={() => !deleteWebhookMutation.isPending && setWebhookDaEliminare(null)}
                onConfirm={handleDeleteWebhook}
            />
        </>
    );
}

export default withSessionCheck(GestioneWebhook);
