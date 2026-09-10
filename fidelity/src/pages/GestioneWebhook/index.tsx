import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormLabel, FormSelect, FormTextarea } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import { PermissionGate } from "@/components/PermissionGate";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { EVENTI_WEBHOOK, STATO_WEBHOOK } from "../../../lib/enums";
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


function GestioneWebhook() {
    const { showNotification } = useNotification();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<WebhookAttributes | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedWebhooks, setSelectedWebhooks] = useState<string[]>([]);
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
    // Monitora i cambiamenti nei campi del form
    const watchAllFields = watch();
    useEffect(() => {
        console.log('Valori del form aggiornati:', watchAllFields);
    }, [watchAllFields]);

    // Query per ottenere i webhook
    const { data: webhooks = [], isLoading, refetch } = useQuery<WebhookAttributes[]>({
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
    const { data: webhookStats, refetch: refetchStats } = useQuery({
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

    const handleDeleteWebhook = (id: string) => {
        if (confirm('Sei sicuro di voler eliminare questo webhook?')) {
            deleteWebhookMutation.mutate(id);
        }
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

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedWebhooks(filteredWebhooks.map((w: WebhookAttributes) => w.id_webhook));
        } else {
            setSelectedWebhooks([]);
        }
    };

    const handleSelectWebhook = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedWebhooks(prev => [...prev, id]);
        } else {
            setSelectedWebhooks(prev => prev.filter(wId => wId !== id));
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case STATO_WEBHOOK.ATTIVO:
                return <Badge variant="success" className="px-2 py-1">Attivo</Badge>;
            case STATO_WEBHOOK.DISATTIVO:
                return <Badge variant="warning" className="px-2 py-1">Inattivo</Badge>;
            case STATO_WEBHOOK.ELIMINATO:
                return <Badge variant="error" className="px-2 py-1">Eliminato</Badge>;
            default:
                return <Badge variant="secondary" className="px-2 py-1">Sconosciuto</Badge>;
        }
    };

    const selectedEventi = watch('eventi_webhook') || [];

    return (
        <>
            <div className="grid grid-cols-12 gap-y-6 gap-x-6">
                <div className="col-span-12">
                    <PageHeader
                        title="Gestione Webhook"
                        description="Gestisci i webhook per ricevere notifiche degli eventi del sistema"
                    />
                </div>

                <div className="col-span-12">
                    <div className="box box--stacked">
                        {/* Header con ricerca e azioni */}
                        <div className="bg-slate-50 border-b border-slate-200 p-5">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex-1">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                            <Lucide icon="Search" className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <FormInput
                                            type="text"
                                            placeholder="Cerca webhook per descrizione o URL..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <PermissionGate permission={PERMISSIONS.WEBHOOK.GESTISCI} mode="disable">
                                        <Button
                                            variant="primary"
                                            onClick={handleCreateWebhook}
                                            className="flex items-center"
                                        >
                                            <Lucide icon="Plus" className="w-4 h-4 mr-2" />
                                            Nuovo Webhook
                                        </Button>
                                    </PermissionGate>
                                </div>
                            </div>
                        </div>

                        {/* Conteggio risultati */}
                        <div className="flex justify-between items-center mb-5 p-5">
                            <div className="text-sm text-slate-500">
                                {filteredWebhooks.length} {filteredWebhooks.length === 1 ? 'webhook' : 'webhook'} trovati
                            </div>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="text-xs text-primary hover:text-primary/80 flex items-center"
                                >
                                    <Lucide icon="X" className="w-3.5 h-3.5 mr-1" />
                                    Cancella ricerca
                                </button>
                            )}
                        </div>

                        {/* Tabella webhook */}
                        <div className="overflow-x-auto">
                            <Table bordered className="border-b border-slate-200/60">
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Td className="w-5 py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                                            <FormCheck.Input
                                                type="checkbox"
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                                checked={selectedWebhooks.length === filteredWebhooks.length && filteredWebhooks.length > 0}
                                            />
                                        </Table.Td>
                                        <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                                            Webhook
                                        </Table.Td>
                                        <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                                            Eventi
                                        </Table.Td>
                                        <Table.Td className="py-4 font-medium text-center border-t bg-slate-50 border-slate-200/60 text-slate-500">
                                            Stato
                                        </Table.Td>
                                        <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                                            Configurazione
                                        </Table.Td>
                                        <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                                            Ultima Modifica
                                        </Table.Td>
                                        <Table.Td className="w-32 py-4 font-medium text-center border-t bg-slate-50 border-slate-200/60 text-slate-500">
                                            Azioni
                                        </Table.Td>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {isLoading ? (
                                        <Table.Tr>
                                            <Table.Td colSpan={7} className="py-8 text-center">
                                                <div className="flex items-center justify-center">
                                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
                                                    Caricamento webhook...
                                                </div>
                                            </Table.Td>
                                        </Table.Tr>
                                    ) : filteredWebhooks.length > 0 ? (
                                        filteredWebhooks.map((webhook: WebhookAttributes) => (
                                            <Table.Tr key={webhook.id_webhook} className="[&_td]:last:border-b-0">
                                                <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                                                    <FormCheck.Input
                                                        type="checkbox"
                                                        checked={selectedWebhooks.includes(webhook.id_webhook)}
                                                        onChange={(e) => handleSelectWebhook(webhook.id_webhook, e.target.checked)}
                                                    />
                                                </Table.Td>
                                                <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                                                    <div>
                                                        <div className="font-medium text-sm mb-1">{webhook.descrizione_webhook}</div>
                                                        <div className="text-slate-500 text-xs break-all">{webhook.url_webhook}</div>
                                                    </div>
                                                </Table.Td>
                                                <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                                                    <div className="flex flex-wrap gap-1">
                                                        {webhook.eventi_webhook.slice(0, 3).map((evento, idx) => (
                                                            <Badge key={idx} variant="secondary" className="text-xs px-2 py-1">
                                                                {evento.replace('_', ' ')}
                                                            </Badge>
                                                        ))}
                                                        {webhook.eventi_webhook.length > 3 && (
                                                            <Badge variant="secondary" className="text-xs px-2 py-1">
                                                                +{webhook.eventi_webhook.length - 3}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </Table.Td>
                                                <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
                                                    {getStatusBadge(webhook.stato_webhook)}
                                                </Table.Td>
                                                <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                                                    <div className="text-xs text-slate-500">
                                                        <div>Timeout: {webhook.timeout_webhook}s</div>
                                                        <div>Retry: {webhook.retry_count_webhook}</div>
                                                    </div>
                                                </Table.Td>
                                                <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                                                    <div className="text-xs text-slate-500">
                                                        {dayjs(webhook.updatedat_webhook).format("DD/MM/YYYY HH:mm")}
                                                    </div>
                                                </Table.Td>
                                                <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            variant="outline-secondary"
                                                            size="sm"
                                                            onClick={() => handleTestWebhook(webhook)}
                                                            className="px-2 py-1"
                                                            title="Test Webhook"
                                                        >
                                                            <Lucide icon="Play" className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            variant="outline-secondary"
                                                            size="sm"
                                                            onClick={() => handleShowStats(webhook)}
                                                            className="px-2 py-1"
                                                            title="Statistiche"
                                                        >
                                                            <Lucide icon="ChartBar" className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            variant="outline-secondary"
                                                            size="sm"
                                                            onClick={() => handleEditWebhook(webhook)}
                                                            className="px-2 py-1"
                                                            title="Modifica"
                                                        >
                                                            <Lucide icon="Pencil" className="w-3 h-3" />
                                                        </Button>
                                                        <PermissionGate permission={PERMISSIONS.WEBHOOK.GESTISCI}>
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                onClick={() => handleDeleteWebhook(webhook.id_webhook)}
                                                                className="px-2 py-1"
                                                                title="Elimina"
                                                            >
                                                                <Lucide icon="Trash2" className="w-3 h-3" />
                                                            </Button>
                                                        </PermissionGate>
                                                    </div>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))
                                    ) : (
                                        <Table.Tr>
                                            <Table.Td colSpan={7} className="py-8 border-dashed dark:bg-darkmode-600">
                                                <EmptyState
                                                    icon="Webhook"
                                                    title="Nessun webhook trovato"
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
                    </div>
                </div>
            </div>

            {/* Dialog per creare/modificare webhook */}
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} size="xl">
                <Dialog.Panel>
                    <Dialog.Title>
                        <h2 className="mr-auto text-base font-medium">
                            {editingWebhook ? 'Modifica Webhook' : 'Nuovo Webhook'}
                        </h2>
                    </Dialog.Title>
                    <Dialog.Description>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <FormLabel htmlFor="nome_webhook">Nome *</FormLabel>
                                    <FormInput
                                        id="nome_webhook"
                                        type="text"
                                        placeholder="Nome del webhook"
                                        {...register("nome_webhook", {
                                            required: "Nome richiesto"
                                        })}
                                        className={clsx(errors.nome_webhook && "border-danger")}
                                    />
                                    {errors.nome_webhook && (
                                        <div className="text-danger text-xs mt-1">{errors.nome_webhook.message}</div>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <FormLabel htmlFor="descrizione_webhook">Descrizione *</FormLabel>
                                    <FormTextarea
                                        id="descrizione_webhook"
                                        rows={3}
                                        placeholder="Descrizione del webhook"
                                        {...register("descrizione_webhook", {
                                            required: "Descrizione richiesta"
                                        })}
                                        className={clsx(errors.descrizione_webhook && "border-danger")}
                                    />
                                    {errors.descrizione_webhook && (
                                        <div className="text-danger text-xs mt-1">{errors.descrizione_webhook.message}</div>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <FormLabel htmlFor="url_webhook">URL Webhook *</FormLabel>
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
                                    {errors.url_webhook && (
                                        <div className="text-danger text-xs mt-1">{errors.url_webhook.message}</div>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <FormLabel>Eventi da Ascoltare *</FormLabel>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                        {Object.values(EVENTI_WEBHOOK).map((evento) => (
                                            <FormCheck key={evento}>
                                                <FormCheck.Input
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
                                                    <FormCheck.Label>{evento.replace(/_/g, ' ')}</FormCheck.Label>
                                            </FormCheck>
                                        ))}
                                    </div>
                                    {errors.eventi_webhook && (
                                        <div className="text-danger text-xs mt-1">{errors.eventi_webhook.message}</div>
                                    )}
                                </div>

                                <div>
                                    <FormLabel htmlFor="timeout_webhook">Timeout (secondi) *</FormLabel>
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
                                    {errors.timeout_webhook && (
                                        <div className="text-danger text-xs mt-1">{errors.timeout_webhook.message}</div>
                                    )}
                                </div>

                                <div>
                                    <FormLabel htmlFor="retry_webhook">Tentativi di Retry *</FormLabel>
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
                                    {errors.retry_webhook && (
                                        <div className="text-danger text-xs mt-1">{errors.retry_webhook.message}</div>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <FormLabel htmlFor="stato_webhook">Stato *</FormLabel>
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
                                    {errors.stato_webhook && (
                                        <div className="text-danger text-xs mt-1">{errors.stato_webhook.message}</div>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <FormLabel htmlFor="headers_webhook">Headers HTTP (JSON)</FormLabel>
                                    <FormTextarea
                                        id="headers_webhook"
                                        rows={3}
                                        placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                                        {...register("headers_webhook")}
                                        className={clsx(errors.headers_webhook && "border-danger")}
                                    />
                                    {errors.headers_webhook && (
                                        <div className="text-danger text-xs mt-1">{errors.headers_webhook.message}</div>
                                    )}
                                    <div className="text-xs text-slate-500 mt-1">
                                        Opzionale. Formato JSON per headers HTTP personalizzati.
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-2 pt-4 border-t">
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
                                    disabled={createWebhookMutation.isPending || updateWebhookMutation.isPending}
                                >
                                    {createWebhookMutation.isPending || updateWebhookMutation.isPending ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                            {editingWebhook ? 'Aggiornamento...' : 'Creazione...'}
                                        </>
                                    ) : (
                                        editingWebhook ? 'Aggiorna Webhook' : 'Crea Webhook'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Dialog.Description>
                </Dialog.Panel>
            </Dialog>

            {/* Dialog per testare webhook */}
            <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} size="md">
                <Dialog.Panel>
                    <Dialog.Title>
                        <h2 className="mr-auto text-base font-medium">
                            Test Webhook: {selectedWebhookForAction?.descrizione_webhook}
                        </h2>
                    </Dialog.Title>
                    <Dialog.Description>
                        <div className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <div className="text-sm text-slate-600 mb-2">URL Webhook:</div>
                                <div className="text-sm font-mono bg-white p-2 rounded border break-all">
                                    {selectedWebhookForAction?.url_webhook}
                                </div>
                            </div>

                            <div>
                                <FormLabel>Dati di Test (JSON)</FormLabel>
                                <FormTextarea
                                    rows={6}
                                    placeholder='{"test": true, "message": "Test webhook", "timestamp": "2024-01-01T00:00:00Z"}'
                                    defaultValue='{"test": true, "message": "Test webhook"}'
                                    id="test-data"
                                />
                            </div>

                            <div className="flex justify-end space-x-2 pt-4 border-t">
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
                                    disabled={testWebhookMutation.isPending}
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
                                    {testWebhookMutation.isPending ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                            Invio Test...
                                        </>
                                    ) : (
                                        'Invia Test'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </Dialog.Description>
                </Dialog.Panel>
            </Dialog>

            {/* Dialog per statistiche webhook */}
            <Dialog open={statsDialogOpen} onClose={() => setStatsDialogOpen(false)} size="xl">
                <Dialog.Panel>
                    <Dialog.Title>
                        <h2 className="mr-auto text-base font-medium">
                            Statistiche Webhook: {selectedWebhookForAction?.descrizione_webhook}
                        </h2>
                    </Dialog.Title>
                    <Dialog.Description>
                        <div className="space-y-6">
                            {webhookStats ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-lg text-center">
                                        <div className="text-2xl font-bold text-primary">
                                            {webhookStats.statistiche_base.chiamate_totali || 0}
                                        </div>
                                        <div className="text-sm text-slate-600">Totale Chiamate</div>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-lg text-center">
                                        <div className="text-2xl font-bold text-green-600">
                                            {webhookStats.statistiche_base.chiamate_successo || 0}
                                        </div>
                                        <div className="text-sm text-slate-600">Successi</div>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-lg text-center">
                                        <div className="text-2xl font-bold text-red-600">
                                            {webhookStats.statistiche_base.chiamate_fallite || 0}
                                        </div>
                                        <div className="text-sm text-slate-600">Fallimenti</div>
                                    </div>
                                    <div className="col-span-1 md:col-span-3 mt-4">
                                        <h3 className="text-lg font-medium mb-2">Tentativi Recenti</h3>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HTTP Status</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durata (ms)</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Errore</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {webhookStats.tentativi_recenti.map((tentativo : any, index : number) => (
                                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                                {new Date(tentativo.createdat_tentativo).toLocaleString()}
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-sm">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                                                    ${tentativo.stato_tentativo === 'SUCCESSO' ? 'bg-green-100 text-green-800' :
                                                                    tentativo.stato_tentativo === 'FALLITO' ? 'bg-red-100 text-red-800' :
                                                                    'bg-yellow-100 text-yellow-800'}`}>
                                                                    {tentativo.stato_tentativo}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                                {tentativo.http_status_tentativo || '-'}
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                                {tentativo.durata_ms_tentativo}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-500 max-w-xs truncate">
                                                                {tentativo.messaggio_errore_tentativo || '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {webhookStats.tentativi_recenti.length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500">
                                                                Nessun tentativo registrato
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    Caricamento statistiche...
                                </div>
                            )}

                            <div className="flex justify-end pt-4 border-t">
                                <Button
                                    type="button"
                                    variant="outline-secondary"
                                    onClick={() => setStatsDialogOpen(false)}
                                >
                                    Chiudi
                                </Button>
                            </div>
                        </div>
                    </Dialog.Description>
                </Dialog.Panel>
            </Dialog>
        </>
    );
}

export default withSessionCheck(GestioneWebhook);
