import Button from "@/components/Base/Button";
import FiltroContext from "@/components/Base/FormFiltriContextDesign";
import FilterBaseForm from '@/components/Base/FormFiltriDesign';
import { Dialog, Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import FileManagement from "@/components/FilesKit";
import withSessionCheck from "@/components/SessionChecker";
import { useContextMenu } from "@/context/ContextMenuContext";
import { useNotification } from '@/context/NotificationContext';
import { useFetchAddestramenti, useFetchCombinazioneById, useFetchDatiPerCreazioneKitsDesign, useFetchDeclinazioniById, useFetchFiltroByIdRaccoglitore, useFetchFiltroContestoById } from "@/query/query";
import { useEffect, useState } from "react";
import { SubmitHandler, useFieldArray, useForm } from "react-hook-form";
import { useLocation } from "react-router-dom";
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



    return (
        <>
            <PageHeader
                title={dataCombinazione.data?.titolo || "N/A"}
                description={"Gestisci le impostazioni base per la lavorazione"}
            />
            <div className="grid grid-cols-12 gap-y-10 gap-x-6">
                <div className="col-span-12">
                    <Tab.Group
                        selectedIndex={selectedIndex}
                        onChange={setSelectedIndex}
                    >
                        <div className="flex sm:flex-row xs:flex-col xs:items-end 2xl:items-center gap-y-3">
                            <Tab.List
                                variant="boxed-tabs"
                                className="flex-col sm:flex-row sm:w-auto mr-auto bg-white box rounded-[0.6rem] border-slate-200"
                            >
                                <Tab>
                                    <Tab.Button
                                        className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-[0.6rem] flex items-center justify-center text-[0.94rem]"
                                        as="button"
                                    >
                                        Dati Base
                                    </Tab.Button>
                                </Tab>
                                {dataCombinazione?.data?.tipo == TIPO_KIT_DESIGN.MANUALE && (
                                    <Tab>
                                        <Tab.Button
                                            className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-[0.6rem] flex items-center justify-center text-[0.94rem]"
                                            as="button"
                                        >
                                            File definiti
                                        </Tab.Button>
                                    </Tab>
                                )}
                                {
                                    dataCombinazione?.data?.tipo == TIPO_KIT_DESIGN.AUTOMATICO &&
                                    <>
                                        <Tab>
                                            <Tab.Button
                                                className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-[0.6rem] flex items-center justify-center text-[0.94rem]"
                                                as="button"
                                            >
                                                Filtro contesto
                                            </Tab.Button>
                                        </Tab>
                                        <Tab className="bg-slate-50 first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current">
                                            <Tab.Button
                                                className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-[0.6rem] flex items-center justify-center text-[0.94rem]"
                                                as="button"
                                            >
                                                Filtri
                                            </Tab.Button>
                                        </Tab>
                                        <Tab className="bg-slate-50 first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current">
                                            <Tab.Button
                                                className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-[0.6rem] flex items-center justify-center text-[0.94rem]"
                                                as="button"
                                            >
                                                Declinazioni
                                            </Tab.Button>
                                        </Tab>
                                    </>
                                }
                            </Tab.List>
                        </div>
                        <Tab.Panels className="mt-5">
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
                                    <div className="flex justify-end mt-6">
                                        <Button type="submit" variant="soft-success">
                                            <Lucide icon="Save" className="w-5 h-5 mr-2" />
                                            Salva
                                        </Button>
                                    </div>
                                </form>
                            </Tab.Panel>
                            {
                                dataCombinazione?.data?.tipo == TIPO_KIT_DESIGN.AUTOMATICO &&
                                <>
                                    <Tab.Panel>

                                        <form onSubmit={handleSubmitFiltroContext(onSubmitFiltroContext as SubmitHandler<any>)} >
                                            <div className="box box--stacked">
                                                <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 bg-slate-50/50">
                                                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-500/10">
                                                        <Lucide icon="Filter" className="w-5 h-5 text-orange-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium text-slate-800">Filtri di Contesto</h3>
                                                        <p className="text-xs text-slate-500 mt-0.5">Definisci i filtri di contesto per il raccoglitore</p>
                                                    </div>
                                                </div>
                                                <div className="p-5">

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
                                                <div className="flex justify-end mt-6 border-t p-4">
                                                    <Button variant="soft-success" type="submit">
                                                        <Lucide icon="Save" className="w-5 h-5 mr-2" />
                                                        Salva Filtri Contesto
                                                    </Button>
                                                </div>
                                            </div>
                                        </form>
                                    </Tab.Panel>
                                    <Tab.Panel>
                                        <form onSubmit={handleSubmit(onSubmit as SubmitHandler<any>)} >
                                            <div className="box box--stacked">
                                                <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 bg-slate-50/50">
                                                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500/10">
                                                        <Lucide icon="Layers" className="w-5 h-5 text-cyan-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium text-slate-800">Filtri per Produzione</h3>
                                                        <p className="text-xs text-slate-500 mt-0.5">Configura i filtri di produzione</p>
                                                    </div>
                                                </div>
                                                <div className="p-5">
                                                    <FilterBaseForm
                                                        control={control}
                                                        register={register}
                                                        errors={errors}
                                                        dataFiltri={dataFiltri.data ?? []}
                                                        dataAddestramenti={dataAddestramenti?.data ?? []}
                                                        namePrefix="filtri"
                                                    />
                                                </div>
                                                <div className="flex justify-end mt-6 border-t p-4">
                                                    <Button variant="soft-success" type="submit">
                                                        <Lucide icon="Save" className="w-5 h-5 mr-2" />
                                                        Salva Filtri Produzione
                                                    </Button>
                                                </div>
                                            </div>
                                        </form>
                                    </Tab.Panel>
                                    <Tab.Panel>
                                        <form onSubmit={handleSubmitDeclinazioni(onSubmitDeclinazioni)}>
                                            <div className="box box--stacked">

                                                <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 bg-slate-50/50">
                                                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500/10">
                                                        <Lucide icon="GitBranch" className="w-5 h-5 text-indigo-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium text-slate-800">Gestione Declinazioni</h3>
                                                        <p className="text-xs text-slate-500 mt-0.5">Configura le declinazioni del raccoglitore</p>
                                                    </div>
                                                </div>
                                                <div className="p-5">
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
                                                <div className="flex justify-end mt-6 border-t p-4">
                                                    <Button type="submit" variant="soft-success">
                                                        <Lucide icon="Save" className="w-5 h-5 mr-1" />
                                                        Salva Declinazioni
                                                    </Button>
                                                </div>
                                            </div>
                                        </form>
                                    </Tab.Panel>
                                </>
                            }
                            {
                                dataCombinazione?.data?.tipo == TIPO_KIT_DESIGN.MANUALE &&
                                <>
                                    <Dialog open={showSalvataggioFilesAlert} onClose={() => setShowSalvataggioFilesAlert(false)}>
                                        <Dialog.Panel>
                                            <Dialog.Title>Salvataggio File</Dialog.Title>
                                            <Dialog.Description>
                                                Sei sicuro di voler salvare i file aggiunti?
                                                <div className="mt-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">
                                                    <div className="flex items-center">
                                                        <Lucide icon="TriangleAlert" className="w-5 h-5 mr-2" />
                                                        <span>Attenzione: se sovrascrivi questi file, <strong>TUTTI</strong> i kit presenti dentro questo contenitore verranno sovrascritti</span>
                                                    </div>
                                                </div>
                                            </Dialog.Description>
                                            <Dialog.Footer className="flex justify-end gap-x-4">
                                                <Button variant="soft-danger" onClick={() => setShowSalvataggioFilesAlert(false)}>
                                                    Annulla
                                                </Button>
                                                <Button
                                                    variant="soft-success"
                                                    onClick={() => {
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
                                                    }}
                                                >
                                                    Salva
                                                </Button>
                                            </Dialog.Footer>
                                        </Dialog.Panel>
                                    </Dialog>
                                    <Tab.Panel>
                                        <div className="p-5 bg-white dark:bg-darkmode-600 box rounded-lg shadow-md">
                                            <FileManagement
                                                files={files}
                                                setFiles={setFiles}
                                                setNameToPreview={setNameToPreview}
                                            />
                                            <div className="flex justify-end mt-6">
                                                <Button onClick={() => {
                                                    setShowSalvataggioFilesAlert(true);
                                                }} variant="soft-success">
                                                    <Lucide icon="Save" className="w-5 h-5 mr-2" />
                                                    Salva
                                                </Button>
                                            </div>
                                        </div>
                                    </Tab.Panel>
                                </>
                            }
                        </Tab.Panels>
                    </Tab.Group>
                </div>
            </div>
        </>
    );

}



export default withSessionCheck(Main);
