import React, { Fragment, useState } from 'react';
import { useLoaderData, useNavigate, useRevalidator } from 'react-router-dom';
import { STATO_GDO_WHATSAPP_NUMBER } from '../../../lib/enums';
import withSessionCheck from "@/components/SessionChecker";
import { ServerCall } from '../../../lib/server_call';
import Button from '../../components/Base/Button';
import { FormInput, FormLabel, FormSelect, FormTextarea, InputGroup } from '../../components/Base/Form';
import LoadingIcon from '../../components/Base/LoadingIcon';
import Lucide from '../../components/Base/Lucide';
import PageHeader from '../../components/Base/PageHeader';

const GestioneSetupWhatsappSuperAdmin: React.FC = () => {
    const { dettagliGDO, templateOptions: loaderTemplateOptions } = useLoaderData<{
        dettagliGDO: {
            id: string;
            nome: string;
            id_gdo: string;
            id_numero_whatsapp: string;
            display_name: string;
            stato: string;
            provider: string;
            whatsapp_business_account_id: string;
            access_token?: string;
            verify_token?: string;
            createdat?: Date;
            updatedat?: Date;
        } | null;
        templateOptions?: Array<{
            id: string;
            name: string;
        }>;
    }>();

    const templateOptions = loaderTemplateOptions || [];

    const navigate = useNavigate();
    const { revalidate } = useRevalidator();
    const [displayName, setDisplayName] = useState(dettagliGDO?.display_name || '');
    const [wabaId, setWabaId] = useState(dettagliGDO?.whatsapp_business_account_id || '');
    const [phoneNumberId, setPhoneNumberId] = useState(dettagliGDO?.id_numero_whatsapp || '');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [verifyToken, setVerifyToken] = useState(dettagliGDO?.verify_token || '');
    const [stato, setStato] = useState(dettagliGDO?.stato || '');
    const [accessToken, setAccessToken] = useState(dettagliGDO?.access_token || '');
    const [hasCopiedWebhookUrl, setHasCopiedWebhookUrl] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const [testNumberE164, setTestNumberE164] = useState('');
    const [chooseTemplate, setChooseTemplate] = useState({
        id: '',
        name: ''
    });
    const [linguaTest, setLinguaTest] = useState('it');
    const [parametriBodies, setParametriBodies] = useState<string[]>([]);


    const handleSyncTemplates = async () => {
        if (!dettagliGDO?.id && !dettagliGDO?.id_gdo) {
            alert("ID GDO non disponibile: impossibile sincronizzare.");
            return;
        }
        try {
            setSyncing(true);
            const gdoId = dettagliGDO.id_gdo;
            const result = await ServerCall.put("/whatsapp/sync_templates_from_meta", { gdoId });
            // Ricarica la route per rifrescare i dati del loader
            revalidate();
            setSyncing(false);
        } catch (err: any) {
            console.error("Sync da Meta fallito", err);
        } finally {
            setSyncing(false);
        }
    };


    return (
        <Fragment>
            <PageHeader
                title={`Gestione Whatsapp per ${dettagliGDO?.nome}`}
                description="Gestisci il setup per il cliente"
            />

            <div className="col-span-12">
                {/* Contenitore principale con altezza indipendente tra i box */}
                <div className="flex flex-col lg:flex-row w-full gap-2 items-start">

                    {/* Colonna principale */}
                    <div className="box box--stacked p-4 sm:p-5 mb-2 w-full lg:w-[70%] lg:flex-none">
                        <span className="font-semibold text-lg sm:text-xl">
                            Dati canale WhatsApp del cliente
                        </span>

                        <div className='flex flex-col sm:flex-row mt-4 gap-4'>
                            <div className='w-full sm:w-1/2'>
                                <FormLabel htmlFor="display_name">Display Name (WhatsApp)</FormLabel>
                                <FormInput
                                    id="display_name"
                                    type="text"
                                    value={displayName}
                                    spellCheck={false}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </div>
                            <div className='w-full sm:w-1/2'>
                                <FormLabel htmlFor="business_number">Numero Business (E.164)</FormLabel>
                                <FormInput
                                    id="business_number"
                                    type="text"
                                    spellCheck={false}
                                    disabled
                                />
                            </div>
                        </div>

                        <div className='flex flex-col sm:flex-row mt-4 gap-4'>
                            <div className='w-full sm:w-1/2'>
                                <FormLabel htmlFor="waba_id">WABA ID (WhatsApp Business Account)</FormLabel>
                                <FormInput
                                    id="waba_id"
                                    type="text"
                                    spellCheck={false}
                                    value={wabaId}
                                    onChange={(e) => setWabaId(e.target.value)}
                                />
                            </div>
                            <div className='w-full sm:w-1/2'>
                                <FormLabel htmlFor="phone_number_id">Phone Number ID</FormLabel>
                                <FormInput
                                    id="phone_number_id"
                                    type="text"
                                    spellCheck={false}
                                    value={phoneNumberId}
                                    onChange={(e) => setPhoneNumberId(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className='flex flex-col sm:flex-row mt-4 gap-4'>
                            <div className='w-full sm:w-1/2'>
                                <FormLabel htmlFor="stato">Stato</FormLabel>
                                <FormSelect
                                    id="stato"
                                    spellCheck={false}
                                    value={stato}
                                    onChange={(e) => setStato(e.target.value)}
                                >
                                    {Object.entries(STATO_GDO_WHATSAPP_NUMBER).map(([key, value]) => (
                                        <option key={key} value={value}>
                                            {value}
                                        </option>
                                    ))}
                                </FormSelect>
                            </div>
                        </div>

                        <hr className="my-6 border-t border-gray-200" />

                        <div className='w-full'>
                            <FormLabel htmlFor="access_token">Access Token</FormLabel>
                            <FormTextarea
                                id="access_token"
                                value={accessToken}
                                onChange={(e) => setAccessToken(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>

                    {/* Colonna laterale */}

                    <div className='flex flex-col w-full '>
                        <div className="box box--stacked p-4 sm:p-5 mb-2 w-full lg:flex-none">
                            <span className="font-semibold text-lg sm:text-xl">
                                Webhook • Impostazioni
                            </span>

                            <div className='w-full'>
                                <FormLabel htmlFor="webhook_url">Webhook URL</FormLabel>
                                <InputGroup>
                                    <FormInput
                                        id="webhook_url"
                                        type="text"
                                        spellCheck={false}
                                        placeholder={ServerCall.getUrl() + `/webhook/whatsapp/${dettagliGDO?.id || ''}`}
                                        value={webhookUrl}
                                        onChange={(e) => setWebhookUrl(e.target.value)}
                                    />
                                    <InputGroup.Button
                                        onClick={() => {
                                            const textToCopy = webhookUrl || (ServerCall.getUrl() + `/webhook/whatsapp/${dettagliGDO?.id || ''}`);
                                            navigator.clipboard.writeText(textToCopy);
                                            setHasCopiedWebhookUrl(true);
                                            setTimeout(() => setHasCopiedWebhookUrl(false), 4000);
                                        }}
                                    >
                                        {hasCopiedWebhookUrl ? 'Copiato!' : 'Copia'}
                                    </InputGroup.Button>
                                </InputGroup>
                            </div>

                            <div className='w-full mt-4'>
                                <FormLabel htmlFor="verify_token">Verify Token</FormLabel>
                                <FormInput
                                    id="verify_token"
                                    type="text"
                                    spellCheck={false}
                                    value={verifyToken}
                                    onChange={(e) => setVerifyToken(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="box box--stacked p-4 sm:p-5 mb-2 w-full lg:flex-none">
                            <span className="font-semibold text-lg sm:text-xl">
                                Template • Sincronizza
                                <span className="text-xxs text-gray-500 block font-normal">
                                    Recupera i template approvati dal WABA del cliente.
                                </span>
                            </span>

                            <div className='w-full'>
                                <Button
                                    variant="outline-primary"
                                    className="w-full"
                                    onClick={handleSyncTemplates}
                                >
                                    {syncing ? (
                                        <LoadingIcon icon="rings" />
                                    ) : "Sincronizza"}
                                </Button>
                            </div>
                        </div>
                        <div className="box box--stacked p-4 sm:p-5 mb-2 w-full lg:flex-none">
                            <span className="font-semibold text-lg sm:text-xl">
                                Invio di Test (Template)
                            </span>

                            <div className='w-full mt-4'>
                                <FormLabel htmlFor="test_number_e164">Destinatario (E.164)</FormLabel>
                                <FormInput
                                    id="test_number_e164"
                                    type="text"
                                    spellCheck={false}
                                    placeholder='+39...'
                                    value={testNumberE164}
                                    onChange={(e) => setTestNumberE164(e.target.value)}
                                />
                            </div>
                            <div className='w-full mt-4'>
                                <FormLabel htmlFor="choose_template">Scegli template</FormLabel>
                                <FormSelect
                                    id="choose_template"
                                    spellCheck={false}
                                    value={chooseTemplate.id}
                                    onChange={(e) => setChooseTemplate({
                                        id: e.target.value,
                                        name: templateOptions.find(template => template.id === e.target.value)?.name || ''
                                    })}
                                >
                                    <option value="">Seleziona un template</option>
                                    {templateOptions.map((template) => (
                                        <option key={template.id} value={template.id}>
                                            {template.name}
                                        </option>
                                    ))}
                                </FormSelect>
                            </div>
                            <div className='w-full mt-4'>
                                <FormLabel htmlFor="lingua_test">Lingua</FormLabel>
                                <FormInput
                                    id="lingua_test"
                                    type="text"
                                    spellCheck={false}
                                    placeholder='it'
                                    value={linguaTest}
                                    onChange={(e) => setLinguaTest(e.target.value)}
                                />
                            </div>
                            <div className="w-full mt-4">
                                <FormLabel htmlFor="parametri_body">Parametri BODY (opzionale)</FormLabel>
                                <div className="flex flex-col gap-2">
                                    {parametriBodies.map((parametro, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <InputGroup className="w-full">
                                                <FormInput
                                                    id={`parametro_body_${index}`}
                                                    type="text"
                                                    spellCheck={false}
                                                    placeholder={`{{${index + 1}}}`}
                                                    value={parametro}
                                                    onChange={(e) => {
                                                        const newParametri = [...parametriBodies];
                                                        newParametri[index] = e.target.value;
                                                        setParametriBodies(newParametri);
                                                    }}
                                                />
                                                <InputGroup.Button
                                                    className='text-danger bg-danger/10 hover:bg-danger/20'
                                                    title="Rimuovi parametro"
                                                    aria-label="Rimuovi parametro"
                                                    onClick={() => {
                                                        const newParametri = parametriBodies.filter((_, i) => i !== index);
                                                        setParametriBodies(newParametri);
                                                    }}
                                                >
                                                    <Lucide icon="Trash2" className="w-4 h-4" />
                                                </InputGroup.Button>
                                            </InputGroup>
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline-primary"
                                        className="mt-2 self-start"
                                        onClick={() => setParametriBodies([...parametriBodies, ''])}
                                    >
                                        Aggiungi parametro
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Fragment>
    );
};

export default withSessionCheck(GestioneSetupWhatsappSuperAdmin);
