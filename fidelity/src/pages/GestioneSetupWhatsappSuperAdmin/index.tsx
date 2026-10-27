import React, { Fragment, useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router-dom';
import { STATO_GDO_WHATSAPP_NUMBER } from '../../../lib/enums';
import withSessionCheck from "@/components/SessionChecker";
import { ServerCall } from '../../../lib/server_call';
import Button from '../../components/Base/Button';
import { FormField, FormInput, FormLabel, FormSelect, InputGroup } from '../../components/Base/Form';
import PageError from '../../components/Base/PageError';
import PageHeader from '../../components/Base/PageHeader';
import StatusBadge from '../../components/Base/StatusBadge';
import { descriviStato } from '../../constants/stati';
import { useNotification } from '../../context/NotificationContext';
import type { DettagliGDOWhatsapp } from '../../router/loaderFunctions';

const messaggioErrore = (errore: unknown, predefinito: string) =>
    errore instanceof Error && errore.message ? errore.message : predefinito;

// I token sono in sola scrittura: il server dice solo se sono configurati
const aiutoToken = (configurato: boolean | undefined) =>
    configurato ? 'Configurato. Lascia vuoto per mantenere quello salvato.' : 'Non configurato: obbligatorio per attivare il canale.';

const GestioneSetupWhatsappSuperAdmin: React.FC = () => {
    const { showNotification } = useNotification();
    const { idGDO, dettagliGDO, errore } = useLoaderData() as {
        idGDO: string;
        dettagliGDO: DettagliGDOWhatsapp | null;
        errore: string | null;
    };

    const { revalidate } = useRevalidator();
    const idGdo = dettagliGDO?.id_gdo || idGDO;
    const [displayName, setDisplayName] = useState(dettagliGDO?.display_name || '');
    const [wabaId, setWabaId] = useState(dettagliGDO?.whatsapp_business_account_id || '');
    const [phoneNumberId, setPhoneNumberId] = useState(dettagliGDO?.id_numero_whatsapp || '');
    const [stato, setStato] = useState(dettagliGDO?.stato || STATO_GDO_WHATSAPP_NUMBER.PENDING);
    const [accessToken, setAccessToken] = useState('');
    const [verifyToken, setVerifyToken] = useState('');
    const [hasCopiedWebhookUrl, setHasCopiedWebhookUrl] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [salvataggio, setSalvataggio] = useState(false);

    const webhookUrl = ServerCall.getUrl() + `/webhook/whatsapp/${dettagliGDO?.id || ''}`;

    const handleSyncTemplates = async () => {
        if (!dettagliGDO?.id_gdo) {
            showNotification("Configura e salva il canale prima di sincronizzare i template.", { variant: 'warning' });
            return;
        }
        setSyncing(true);
        try {
            const result = await ServerCall.put<{ success: boolean; error?: string }>("/whatsapp/sync_templates_from_meta", { gdoId: dettagliGDO.id_gdo });
            if (!result?.success) {
                throw new Error(result?.error || 'Sincronizzazione non riuscita');
            }
            showNotification("Template sincronizzati da Meta", { variant: 'success' });
            revalidate();
        } catch (err) {
            showNotification(`Errore durante la sincronizzazione: ${messaggioErrore(err, 'errore sconosciuto')}`, { variant: 'error' });
        } finally {
            setSyncing(false);
        }
    };

    const salva = async (e: React.FormEvent) => {
        e.preventDefault();
        setSalvataggio(true);
        try {
            const corpo: Record<string, string> = {
                id_gdo: idGdo,
                display_name: displayName,
                id_numero_whatsapp: phoneNumberId,
                whatsapp_business_account_id: wabaId,
                stato,
            };
            // Un token si invia solo se riscritto: vuoto, il server mantiene quello salvato
            if (accessToken.trim()) corpo.access_token = accessToken.trim();
            if (verifyToken.trim()) corpo.verify_token = verifyToken.trim();
            await ServerCall.put("/whatsapp/setup_gdo_whatsapp", corpo);
            setAccessToken('');
            setVerifyToken('');
            showNotification("Configurazione WhatsApp salvata", { variant: 'success' });
            revalidate();
        } catch (err) {
            showNotification(messaggioErrore(err, "Salvataggio della configurazione non riuscito"), { variant: 'error' });
        } finally {
            setSalvataggio(false);
        }
    };

    const intestazione = (
        <PageHeader
            title={"Gestione Whatsapp" + (dettagliGDO?.nome ? ` per ${dettagliGDO.nome}` : "")}
            description="Gestisci il setup per il cliente"
            indietro={{ to: "/whatsapp/gestione-whatsapp-superadmin", etichetta: "Torna alle GDO" }}
            badges={
                dettagliGDO
                    ? <StatusBadge dominio="waNumero" stato={dettagliGDO.stato} />
                    : !errore && <StatusBadge tono="neutral" etichetta="Non configurato" />
            }
        />
    );

    if (errore) {
        return (
            <Fragment>
                {intestazione}
                <PageError motivo={errore} onRiprova={revalidate} />
            </Fragment>
        );
    }

    return (
        <Fragment>
            {intestazione}

            <div className="col-span-12">
                {/* Contenitore principale con altezza indipendente tra i box */}
                <div className="flex flex-col lg:flex-row w-full gap-2 items-start">

                    {/* Colonna principale */}
                    <form noValidate onSubmit={salva} className="box box--stacked p-4 sm:p-5 mb-2 w-full lg:basis-2/3 lg:flex-none">
                        <h2 className="title-section">
                            Dati canale WhatsApp del cliente
                        </h2>

                        <div className='flex flex-col sm:flex-row mt-4 gap-4'>
                            <FormField className='w-full sm:w-1/2' etichetta="Display Name (WhatsApp)" obbligatorio>
                                <FormInput
                                    id="display_name"
                                    type="text"
                                    value={displayName}
                                    spellCheck={false}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </FormField>
                            <FormField className='w-full sm:w-1/2' etichetta="Stato">
                                <FormSelect
                                    id="stato"
                                    value={stato}
                                    onChange={(e) => setStato(e.target.value)}
                                >
                                    {Object.values(STATO_GDO_WHATSAPP_NUMBER).map((valore) => (
                                        <option key={valore} value={valore}>
                                            {descriviStato('waNumero', valore).etichetta}
                                        </option>
                                    ))}
                                </FormSelect>
                            </FormField>
                        </div>

                        <div className='flex flex-col sm:flex-row mt-4 gap-4'>
                            <FormField className='w-full sm:w-1/2' etichetta="WABA ID (WhatsApp Business Account)" obbligatorio>
                                <FormInput
                                    id="waba_id"
                                    type="text"
                                    spellCheck={false}
                                    value={wabaId}
                                    onChange={(e) => setWabaId(e.target.value)}
                                />
                            </FormField>
                            <FormField className='w-full sm:w-1/2' etichetta="Phone Number ID" obbligatorio>
                                <FormInput
                                    id="phone_number_id"
                                    type="text"
                                    spellCheck={false}
                                    value={phoneNumberId}
                                    onChange={(e) => setPhoneNumberId(e.target.value)}
                                />
                            </FormField>
                        </div>

                        <hr className="my-6 border-t border-gray-200" />

                        <FormField
                            etichetta="Access Token"
                            obbligatorio={!dettagliGDO?.access_token_configurato}
                            aiuto={aiutoToken(dettagliGDO?.access_token_configurato)}
                        >
                            <FormInput
                                id="access_token"
                                type="password"
                                autoComplete="new-password"
                                spellCheck={false}
                                placeholder={dettagliGDO?.access_token_configurato ? '••••••••' : ''}
                                value={accessToken}
                                onChange={(e) => setAccessToken(e.target.value)}
                            />
                        </FormField>

                        <div className="mt-6 flex justify-end">
                            <Button type="submit" variant="primary" loading={salvataggio}>
                                Salva
                            </Button>
                        </div>
                    </form>

                    {/* Colonna laterale */}

                    <div className='flex flex-col w-full '>
                        <div className="box box--stacked p-4 sm:p-5 mb-2 w-full lg:flex-none">
                            <h2 className="title-section">
                                Webhook • Impostazioni
                            </h2>

                            <div className='w-full mt-4'>
                                <FormLabel htmlFor="webhook_url">Webhook URL</FormLabel>
                                <InputGroup>
                                    <FormInput
                                        id="webhook_url"
                                        type="text"
                                        readOnly
                                        spellCheck={false}
                                        value={webhookUrl}
                                    />
                                    <InputGroup.Button
                                        onClick={() => {
                                            navigator.clipboard.writeText(webhookUrl);
                                            setHasCopiedWebhookUrl(true);
                                            setTimeout(() => setHasCopiedWebhookUrl(false), 4000);
                                        }}
                                    >
                                        {hasCopiedWebhookUrl ? 'Copiato!' : 'Copia'}
                                    </InputGroup.Button>
                                </InputGroup>
                            </div>

                            <FormField
                                className='w-full mt-4'
                                etichetta="Verify Token"
                                obbligatorio={!dettagliGDO?.verify_token_configurato}
                                aiuto={aiutoToken(dettagliGDO?.verify_token_configurato)}
                            >
                                <FormInput
                                    id="verify_token"
                                    type="password"
                                    autoComplete="new-password"
                                    spellCheck={false}
                                    placeholder={dettagliGDO?.verify_token_configurato ? '••••••••' : ''}
                                    value={verifyToken}
                                    onChange={(e) => setVerifyToken(e.target.value)}
                                />
                            </FormField>
                            <p className="mt-2 text-xs text-slate-500">Il verify token si salva con il pulsante Salva dei dati del canale.</p>
                        </div>
                        <div className="box box--stacked p-4 sm:p-5 mb-2 w-full lg:flex-none">
                            <h2 className="title-section">
                                Template • Sincronizza
                            </h2>
                            <p className="mb-3 text-xs text-slate-500">
                                Recupera i template approvati dal WABA del cliente.
                            </p>

                            <Button
                                variant="outline-primary"
                                className="w-full"
                                loading={syncing}
                                disabled={!dettagliGDO}
                                onClick={handleSyncTemplates}
                            >
                                Sincronizza
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Fragment>
    );
};

export default withSessionCheck(GestioneSetupWhatsappSuperAdmin);
