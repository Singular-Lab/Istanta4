import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import FiltroContext from "@/components/Base/FormFiltriContextDesign";
import FilterBaseForm from '@/components/Base/FormFiltriDesign';
import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import ConfirmDialog from "@/components/ConfirmDialog";
import FileManagement from "@/components/FilesKit";
import withSessionCheck from "@/components/SessionChecker";
import { useContextMenu } from "@/context/ContextMenuContext";
import { useNotification } from '@/context/NotificationContext';
import { useFetchAddestramenti, useFetchCombinazioneById, useFetchDatiPerCreazioneKitsDesign, useFetchDeclinazioniById, useFetchFiltroByIdRaccoglitore, useFetchFiltroContestoById } from "@/query/query";
import { useEffect, useState } from "react";
import { SubmitHandler, useFieldArray, useForm } from "react-hook-form";
import { useLocation } from "react-router-dom";
import { VALORE_ASSENTE } from "@/utils/format";
import { TIPO_KIT_DESIGN } from "../../../lib/enums";
import { FileItemKit, OggettoTipiDiExport } from "../../../lib/types";
import DatiBaseForm from "./components/DatiBaseForm";
import DeclinazioniSection from "./components/DeclinazioniSection";
import { useCombinazioneMutations } from "./hooks/useCombinazioneMutations.tsx";

type FormFiltri = {
    filtri: {
        titoloFiltro: string;
        condizioni: {
            nome_field: string;
            operatore: string;
            valore: string;
            idAddestramento: string;
        }[];
    }[];
}

type FormFiltroContext = {
    filtroContesto: {
        titoloFiltro: string;
        condizioni: {
            schemaScelto: string;
            nome_field: string;
            operatore: string;
            colonna: string;
        }[];
    }[];
}

// Definizione dello schema di validazione con yup

type FormDataKit = {
    titolo: string;
    quantita: number;
    guidAree: string[];
    guidCanali: string[];
    guidIdPv?: (string | null | undefined)[] | null;
    guidFormato: string;
    tags?: string[];
    tipiDiExportInKit: OggettoTipiDiExport[];
    tipo: TIPO_KIT_DESIGN;
    files?: FileItemKit[];
};


// Schede con l'aspetto standard di boxed-tabs: solo larghezza e spaziatura
const CLASSE_SCHEDA = "w-full whitespace-nowrap py-2 text-sm xl:w-40";

function Main() {
    const { setMenuItems } = useContextMenu();

    const { search } = useLocation();
    const queryParams = new URLSearchParams(search);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [idCombinazione, setIdCombinazione] = useState("");
    const [files, setFiles] = useState<FileItemKit[]>([]);
    const [nameToPreview, setNameToPreview] = useState<string[]>([]);
    const [showSalvataggioFilesAlert, setShowSalvataggioFilesAlert] = useState(false);
    const { showNotification } = useNotification();


    const dataAddestramenti = useFetchAddestramenti();
    const datiPerCreazioneFormati = useFetchDatiPerCreazioneKitsDesign();
    const dataCombinazione = useFetchCombinazioneById(idCombinazione);

    const {
        mutationCreazioneDeclinazioni,
        mutateCreazioneFiltroContext,
        mutateCreazioneFiltro,
        mutateUpdateRaccoglitoreKit,
    } = useCombinazioneMutations(idCombinazione, dataCombinazione?.refetch);

    useEffect(() => {
        if (dataCombinazione?.data) {
            setValueDatiKit("titolo", dataCombinazione?.data.titolo ?? "");
            setValueDatiKit("quantita", dataCombinazione?.data.quantita ?? 0);
            setValueDatiKit("guidAree", dataCombinazione?.data.guidAree ?? []);
            setValueDatiKit("guidCanali", dataCombinazione?.data.guidCanali ?? []);
            setValueDatiKit("guidIdPv", dataCombinazione?.data.guidIdPv ?? []);
            setValueDatiKit("tipiDiExportInKit", dataCombinazione?.data.tipiDiExportInKit ?? []);
            setValueDatiKit("tipo", dataCombinazione?.data.tipo as TIPO_KIT_DESIGN);
            setValueDatiKit("guidFormato", dataCombinazione?.data.guidFormato ?? "");
            setValueDatiKit("tags", dataCombinazione?.data.tags ?? []);
            setValueDatiKit("files", dataCombinazione?.data.files ?? []);
            setFiles(dataCombinazione?.data.files ?? []);
        }
    }, [dataCombinazione?.data])

    const dataDeclinazioni = useFetchDeclinazioniById(idCombinazione);
    const dataFiltroContesto = useFetchFiltroContestoById(idCombinazione);




    const {
        control: controlDeclinazioni,
        register: registerDeclinazioni,
        handleSubmit: handleSubmitDeclinazioni,
        formState: { errors: errorsDeclinazioni },
        reset,
    } = useForm<{
        declinazioni: {
            titolo: string;
            proprieta: { idChiave: number; valore: string }[];
            filtri: any[];
        }[];
    }>();

    const { fields, append, remove } = useFieldArray({
        control: controlDeclinazioni,
        name: 'declinazioni',
    });

    useEffect(() => {
        if (dataCombinazione?.data) {
            reset({
                declinazioni: dataCombinazione?.data.declinazioni?.map(declinazione => ({
                    titolo: declinazione.titolo || '',
                    proprieta: declinazione.proprieta?.map(proprieta => ({
                        idChiave: Number(proprieta.idChiave) || 0,
                        valore: proprieta.valore || ''
                    })) || [{ idChiave: 0, valore: '' }],
                    filtri: declinazione.filtri ?? [],
                }))
            });
        } else {
            reset({
                declinazioni: [
                    {
                        titolo: '',
                        proprieta: [{ idChiave: 0, valore: '' }],
                        filtri: [],
                    },
                ],
            });
        }
    }, [dataCombinazione?.data, reset]);

    const onSubmitDeclinazioni = (data: any) => {
        mutationCreazioneDeclinazioni.mutate({ idCombinazione, data });
    };

    const handleRemoveDeclinazione = (index: number) => {
        remove(index);
    };
    const dataFiltri = useFetchFiltroByIdRaccoglitore(idCombinazione);
    const { register, control, handleSubmit, formState: { errors } } = useForm<FormFiltri>();

    const {
        register: registerFiltroContext,
        control: controlFiltroContext,
        handleSubmit: handleSubmitFiltroContext,
        formState: { errors: errorsFiltroContext },
        watch: watchFiltroContext,
        setValue: setValueFiltroContext,
    } = useForm<FormFiltroContext>();

    const onSubmitFiltroContext: SubmitHandler<FormFiltroContext> = (data) => {
        mutateCreazioneFiltroContext.mutate({
            idCombinazione,
            filtroContesto: data.filtroContesto
        });
    }

    const {
        register: registerDatiKit,
        control: controlDatiKit,
        handleSubmit: handleSubmitDatiKit,
        formState: { errors: errorsDatiKit },
        setValue: setValueDatiKit,
        getValues: getValuesDatiKit,
        watch: watchDatiKit
    } = useForm<FormDataKit>({
    });

    const datiKit = watchDatiKit();

    useEffect(() => {
        const id = queryParams.get("id") as string;
        setIdCombinazione(id);
    }, [search]);

    useEffect(() => {
        const page = queryParams.get("page");
        const tabMap: Record<string, number> = {
            "events": 1,
            "formati": 2,
            "tipiDiExportInKit": 3,
            "combinazioni": 4,
        };
        setSelectedIndex(tabMap[page || ""] || 0);
    }, [search]);

    const onSubmit: SubmitHandler<FormFiltri> = (data) => {
        mutateCreazioneFiltro.mutate(data);
    };

    const handleFileNameChange = (index: number, name: string) => {
        const files = getValuesDatiKit("files");
        if (files) {
            files[index].nome = name;
        }
        setValueDatiKit("files", files);
    };

    const onSubmitDatiKit: SubmitHandler<FormDataKit> = (data) => {
        mutateUpdateRaccoglitoreKit.mutate({
            id: idCombinazione,
            titolo: data.titolo,
            quantita: data.quantita,
            guidAree: data.guidAree ?? [],
            guidCanali: data.guidCanali ?? [],
            guidIdPv: data.guidIdPv?.filter((id): id is string => id != null),
            guidFormato: data.guidFormato,
            tags: (data.tags ?? []).map(tag => tag?.trim()).filter((tag): tag is string => Boolean(tag)),
            tipiDiExportInKit: data.tipiDiExportInKit.map(exportItem => ({
                ...exportItem,
                filtro: exportItem.filtro?.map(filtroItem => ({
                    ...filtroItem,
                    condizioni: filtroItem.condizioni ?? []
                })) ?? null
            })),
            tipo: data.tipo,
            files: data.files ?? []
        });
    }



    const salvaFileManuali = () => {
        setShowSalvataggioFilesAlert(false);
        mutateUpdateRaccoglitoreKit.mutate({
            id: idCombinazione,
            titolo: getValuesDatiKit('titolo'),
            quantita: getValuesDatiKit('quantita'),
            guidAree: getValuesDatiKit('guidAree') ?? [],
            guidCanali: getValuesDatiKit('guidCanali') ?? [],
            guidIdPv: getValuesDatiKit('guidIdPv')?.filter((id): id is string => id != null) ?? [],
            guidFormato: getValuesDatiKit('guidFormato') ?? "",
            tags: (getValuesDatiKit('tags') ?? [])
                .map((tag) => tag?.trim())
                .filter((tag): tag is string => Boolean(tag)),
            tipiDiExportInKit: getValuesDatiKit('tipiDiExportInKit').map((exportItem: any) => ({
                ...exportItem,
                filtro: exportItem.filtro?.map((filtroItem: any) => ({
                    ...filtroItem,
                    condizioni: filtroItem.condizioni ?? []
                })) ?? null
            })),
            tipo: getValuesDatiKit('tipo'),
            files
        });
    };

    const tipo = dataCombinazione?.data?.tipo;

    return (
        <Pagina
            titolo={dataCombinazione.data?.titolo || VALORE_ASSENTE}
            descrizione="Gestisci le impostazioni base per la lavorazione"
            indietro={{ to: "/impostazioni-di-produzione", etichetta: "Torna alle impostazioni di produzione" }}
        >
            {dataCombinazione.isError ? (
                <PageError
                    compatta
                    titolo="Impossibile caricare il raccoglitore"
                    motivo={(dataCombinazione.error as Error)?.message || "Il servizio non ha restituito il raccoglitore."}
                    onRiprova={() => dataCombinazione.refetch()}
                />
            ) : (
                <Tab.Group
                    selectedIndex={selectedIndex}
                    onChange={setSelectedIndex}
                >
                    <Tab.List variant="boxed-tabs" className="sm:w-auto sm:self-start">
                        <Tab>
                            <Tab.Button className={CLASSE_SCHEDA} as="button">
                                Dati base
                            </Tab.Button>
                        </Tab>
                        {tipo == TIPO_KIT_DESIGN.MANUALE && (
                            <Tab>
                                <Tab.Button className={CLASSE_SCHEDA} as="button">
                                    File definiti
                                </Tab.Button>
                            </Tab>
                        )}
                        {tipo == TIPO_KIT_DESIGN.AUTOMATICO && (
                            <>
                                <Tab>
                                    <Tab.Button className={CLASSE_SCHEDA} as="button">
                                        Filtro contesto
                                    </Tab.Button>
                                </Tab>
                                <Tab>
                                    <Tab.Button className={CLASSE_SCHEDA} as="button">
                                        Filtri
                                    </Tab.Button>
                                </Tab>
                                <Tab>
                                    <Tab.Button className={CLASSE_SCHEDA} as="button">
                                        Declinazioni
                                    </Tab.Button>
                                </Tab>
                            </>
                        )}
                    </Tab.List>
                    <Tab.Panels className="mt-6">
                        <Tab.Panel>
                            <form onSubmit={handleSubmitDatiKit(onSubmitDatiKit as SubmitHandler<any>)}>
                                <DatiBaseForm
                                    controlDatiKit={controlDatiKit}
                                    errorsDatiKit={errorsDatiKit}
                                    getValuesDatiKit={getValuesDatiKit}
                                    setValueDatiKit={setValueDatiKit}
                                    registerDatiKit={registerDatiKit}
                                    datiPerCreazioneFormati={datiPerCreazioneFormati as any}
                                    dataAddestramenti={dataAddestramenti?.data}
                                    dataCombinazione={dataCombinazione}
                                />
                                <div className="mt-6 flex justify-end">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        loading={mutateUpdateRaccoglitoreKit.isPending}
                                    >
                                        {!mutateUpdateRaccoglitoreKit.isPending && <Lucide icon="Save" aria-hidden="true" className="mr-2 h-4 w-4" />}
                                        Salva
                                    </Button>
                                </div>
                            </form>
                        </Tab.Panel>
                        {tipo == TIPO_KIT_DESIGN.AUTOMATICO && (
                            <>
                                <Tab.Panel>
                                    <form onSubmit={handleSubmitFiltroContext(onSubmitFiltroContext as SubmitHandler<any>)}>
                                        <Sezione
                                            senzaPadding
                                            icona="Filter"
                                            titolo="Filtri di contesto"
                                            descrizione="Definisci i filtri di contesto per il raccoglitore"
                                        >
                                            <div className="px-5 pb-5">
                                                <FiltroContext
                                                    control={controlFiltroContext}
                                                    register={registerFiltroContext}
                                                    setValue={setValueFiltroContext}
                                                    errors={errorsFiltroContext}
                                                    retriviedDataFiltriContesto={dataCombinazione?.data?.filtroContesto ?? []}
                                                    dataPerContesto={dataFiltroContesto?.data ?? []}
                                                    namePrefix="filtroContesto"
                                                />
                                            </div>
                                            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
                                                <Button variant="primary" type="submit" loading={mutateCreazioneFiltroContext.isPending}>
                                                    {!mutateCreazioneFiltroContext.isPending && <Lucide icon="Save" aria-hidden="true" className="mr-2 h-4 w-4" />}
                                                    Salva filtri di contesto
                                                </Button>
                                            </div>
                                        </Sezione>
                                    </form>
                                </Tab.Panel>
                                <Tab.Panel>
                                    <form onSubmit={handleSubmit(onSubmit as SubmitHandler<any>)}>
                                        <Sezione
                                            senzaPadding
                                            icona="Layers"
                                            titolo="Filtri per produzione"
                                            descrizione="Configura i filtri di produzione"
                                        >
                                            <div className="px-5 pb-5">
                                                <FilterBaseForm
                                                    control={control}
                                                    register={register}
                                                    errors={errors}
                                                    dataFiltri={dataFiltri.data ?? []}
                                                    dataAddestramenti={dataAddestramenti?.data ?? []}
                                                    namePrefix="filtri"
                                                />
                                            </div>
                                            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
                                                <Button variant="primary" type="submit" loading={mutateCreazioneFiltro.isPending}>
                                                    {!mutateCreazioneFiltro.isPending && <Lucide icon="Save" aria-hidden="true" className="mr-2 h-4 w-4" />}
                                                    Salva filtri di produzione
                                                </Button>
                                            </div>
                                        </Sezione>
                                    </form>
                                </Tab.Panel>
                                <Tab.Panel>
                                    <form onSubmit={handleSubmitDeclinazioni(onSubmitDeclinazioni)}>
                                        <Sezione
                                            senzaPadding
                                            icona="GitBranch"
                                            titolo="Gestione declinazioni"
                                            descrizione="Configura le declinazioni del raccoglitore"
                                        >
                                            <div className="px-5 pb-5">
                                                <DeclinazioniSection
                                                    fields={fields}
                                                    append={append}
                                                    remove={remove}
                                                    control={controlDeclinazioni}
                                                    register={registerDeclinazioni}
                                                    errors={errorsDeclinazioni}
                                                    dataDeclinazioni={dataDeclinazioni}
                                                    dataAddestramenti={dataAddestramenti?.data ?? []}
                                                    handleRemoveDeclinazione={handleRemoveDeclinazione}
                                                />
                                            </div>
                                            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
                                                <Button type="submit" variant="primary" loading={mutationCreazioneDeclinazioni.isPending}>
                                                    {!mutationCreazioneDeclinazioni.isPending && <Lucide icon="Save" aria-hidden="true" className="mr-2 h-4 w-4" />}
                                                    Salva declinazioni
                                                </Button>
                                            </div>
                                        </Sezione>
                                    </form>
                                </Tab.Panel>
                            </>
                        )}
                        {tipo == TIPO_KIT_DESIGN.MANUALE && (
                            <Tab.Panel>
                                <Sezione
                                    senzaPadding
                                    icona="Files"
                                    titolo="File definiti"
                                    descrizione="I file comuni a tutti i kit del raccoglitore"
                                >
                                    <div className="px-5 pb-5">
                                        <FileManagement
                                            files={files}
                                            setFiles={setFiles}
                                            setNameToPreview={setNameToPreview}
                                        />
                                    </div>
                                    <div className="flex justify-end border-t border-slate-200 px-5 py-4">
                                        <Button
                                            type="button"
                                            variant="primary"
                                            loading={mutateUpdateRaccoglitoreKit.isPending}
                                            onClick={() => setShowSalvataggioFilesAlert(true)}
                                        >
                                            {!mutateUpdateRaccoglitoreKit.isPending && <Lucide icon="Save" aria-hidden="true" className="mr-2 h-4 w-4" />}
                                            Salva
                                        </Button>
                                    </div>
                                </Sezione>
                            </Tab.Panel>
                        )}
                    </Tab.Panels>
                </Tab.Group>
            )}

            {/* Fuori dalle schede: sovrascrive i file di tutti i kit del contenitore */}
            {tipo == TIPO_KIT_DESIGN.MANUALE && (
                <ConfirmDialog
                    open={showSalvataggioFilesAlert}
                    onClose={() => setShowSalvataggioFilesAlert(false)}
                    onConfirm={salvaFileManuali}
                    title="Salvataggio file"
                    subtitle="Sovrascrive i file di tutti i kit"
                    confirmLabel="Salva"
                    confirmVariant="danger"
                    description={
                        <div className="space-y-3">
                            <p>Sei sicuro di voler salvare i file aggiunti?</p>
                            <Alert variant="soft-warning" icona="TriangleAlert">
                                Attenzione: se sovrascrivi questi file, <strong>TUTTI</strong> i kit presenti dentro questo contenitore verranno sovrascritti.
                            </Alert>
                        </div>
                    }
                />
            )}
        </Pagina>
    );

}



export default withSessionCheck(Main);
