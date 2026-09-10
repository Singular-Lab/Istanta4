import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import FilterBaseForm from '@/components/Base/FormFiltriDesign';
import Lucide from "@/components/Base/Lucide";
import Skeleton from "@/components/Base/Skeleton";
import TomSelect from "@/components/Base/TomSelect";
import React from 'react';
import { Control, Controller, FieldErrors, UseFormGetValues, UseFormRegister, UseFormSetValue, useWatch } from 'react-hook-form';
import { EVENTI_WEBHOOK, TIPO_KIT_DESIGN } from '../../../../lib/enums';
import { FileItemKit, OggettoTipiDiExport } from '../../../../lib/types';
import {
    AreaResponseDTO,
    CanaleResponseDTO,
    FormatiResponseDTO,
    PuntoVenditaResponseDTO,
    TipiDiExportResponseDTO
} from '../../../../server/core/dto';


interface FormDataKit {
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
}

interface DatiBaseFormProps {
    controlDatiKit: Control<FormDataKit>;
    errorsDatiKit: FieldErrors<FormDataKit>;
    registerDatiKit: UseFormRegister<FormDataKit>;
    getValuesDatiKit: UseFormGetValues<FormDataKit>;
    setValueDatiKit: UseFormSetValue<FormDataKit>;
    datiPerCreazioneFormati: {
        data: {
            formati: FormatiResponseDTO[],
            canali: CanaleResponseDTO[],
            aree: AreaResponseDTO[],
            puntiVendita: PuntoVenditaResponseDTO[],
            tipiExport: TipiDiExportResponseDTO[]
        }
    } | undefined;
    dataAddestramenti: any[] | undefined;
    dataCombinazione?: any;
}

const DatiBaseForm: React.FC<DatiBaseFormProps> = ({
    controlDatiKit,
    errorsDatiKit,
    registerDatiKit,
    getValuesDatiKit,
    setValueDatiKit,
    datiPerCreazioneFormati,
    dataAddestramenti,
    dataCombinazione
}) => {
    // useWatch for reactive rendering — getValues() is a snapshot and doesn't trigger re-renders
    const tipiDiExportInKitWatch = useWatch({ control: controlDatiKit, name: 'tipiDiExportInKit' }) ?? [];
    const tipoKitWatch = useWatch({ control: controlDatiKit, name: 'tipo' });
    const tagsWatch = useWatch({ control: controlDatiKit, name: 'tags' }) ?? [];
    const webhookStates = useWatch({ control: controlDatiKit, name: 'tipiDiExportInKit' }) ?? [];

    return (
        <div className="flex flex-col gap-y-5">
            {/* Informazioni di Base */}
            <div className="box box--stacked">
                <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 bg-slate-50/50">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10">
                        <Lucide icon="Info" className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-medium text-slate-800">Informazioni di Base</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Configura i dati principali del raccoglitore</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 p-5">
                    <div className="col-span-2">
                        <FormLabel htmlFor="titolo">Titolo</FormLabel>
                        {datiPerCreazioneFormati ? (
                            <Controller
                                name="titolo"
                                control={controlDatiKit}
                                rules={{ required: 'Il titolo è obbligatorio' }}
                                render={({ field }) => (
                                    <FormInput
                                        placeholder="Titolo del kit"
                                        id="titolo"
                                        {...field}
                                        className="w-full"
                                    />
                                )}
                            />
                        ) : <Skeleton height="40px" />}
                        {errorsDatiKit.titolo && <p className="text-danger mt-2">{errorsDatiKit.titolo.message as string}</p>}
                    </div>
                    <div>
                        <FormLabel htmlFor="formato">Formato</FormLabel>
                        {datiPerCreazioneFormati ? (
                            <Controller
                                name="guidFormato"
                                control={controlDatiKit}
                                rules={{ required: 'Il formato è obbligatorio' }}
                                render={({ field }) => (
                                    <FormSelect id="formato" {...field} >
                                        <option value="">Seleziona un formato</option>
                                        {datiPerCreazioneFormati?.data?.formati?.map((formato: any, index: number) => (
                                            <option key={index} value={formato.id}>{formato.nome}</option>
                                        ))}
                                    </FormSelect>
                                )}
                            />
                        ) : <Skeleton height="40px" />}
                        {errorsDatiKit.guidFormato && <p className="text-danger mt-2">{errorsDatiKit.guidFormato.message as string}</p>}
                    </div>
                    <div>
                        <FormLabel htmlFor="quantita">Quantità</FormLabel>
                        {datiPerCreazioneFormati ? (
                            <Controller
                                name="quantita"
                                control={controlDatiKit}
                                rules={{
                                    required: 'La quantità è obbligatoria',
                                    min: { value: 1, message: 'La quantità deve essere almeno 1' }
                                }}
                                render={({ field }) => (
                                    <FormInput
                                        type="number"
                                        min={1}
                                        placeholder="Quantità"
                                        id="quantita"
                                        {...field}
                                        className="w-full"
                                    />
                                )}
                            />
                        ) : <Skeleton height="40px" />}
                        {errorsDatiKit.quantita && <p className="text-danger mt-2">{errorsDatiKit.quantita.message as string}</p>}
                    </div>
                    <div>
                        <FormLabel htmlFor="tags">Tags</FormLabel>
                        {datiPerCreazioneFormati ? (
                            <Controller
                                name="tags"
                                control={controlDatiKit}
                                render={({ field }) => (
                                    <TomSelect
                                        id="tags"
                                        value={(field.value || []).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)}
                                        options={{
                                            placeholder: "Scrivi o seleziona tag...",
                                            create: true,
                                            persist: false,
                                        }}
                                        multiple={true}
                                        onChange={field.onChange}
                                        className="w-full"
                                    >
                                        {[...new Set([...(dataCombinazione?.data?.tags ?? []), ...tagsWatch])]
                                            .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
                                            .map((tag, index: number) => (
                                                <option key={`${tag}-${index}`} value={tag}>{tag}</option>
                                            ))}
                                    </TomSelect>
                                )}
                            />
                        ) : <Skeleton height="40px" />}
                        {errorsDatiKit.tags && <p className="text-danger mt-2">{errorsDatiKit.tags.message as string}</p>}
                    </div>
                    <div className="col-span-2">
                        <p className="text-xs text-slate-500 -mt-2">
                            Premi invio per creare un nuovo tag.
                        </p>
                    </div>

                </div>
            </div>

            {/* Targeting */}
            <div className="box box--stacked">
                <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 bg-slate-50/50">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/10">
                        <Lucide icon="Target" className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="font-medium text-slate-800">Targeting</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Seleziona canali, aree e punti vendita</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 p-5">
                    <div>
                        <FormLabel htmlFor="idCanali">Canali</FormLabel>
                        {datiPerCreazioneFormati ? (
                            <Controller
                                name="guidCanali"
                                control={controlDatiKit}
                                rules={{ required: 'Seleziona almeno un canale' }}
                                render={({ field }) => (
                                    <TomSelect
                                        id="idCanali"
                                        value={(field.value || []).filter((v): v is string => v !== null && v !== undefined)}
                                        options={{ placeholder: "Seleziona canali..." }}
                                        multiple={true}
                                        onChange={field.onChange}
                                        className="w-full"
                                    >
                                        {datiPerCreazioneFormati?.data?.canali?.map((canale, index: number) => (
                                            <option key={index} value={canale.id}>{canale.nome}</option>
                                        ))}
                                    </TomSelect>
                                )}
                            />
                        ) : <Skeleton height="40px" />}
                        {errorsDatiKit.guidCanali && <p className="text-danger mt-2">{errorsDatiKit.guidCanali.message as string}</p>}
                    </div>
                    <div>
                        <FormLabel htmlFor="guidAree">Aree</FormLabel>
                        {datiPerCreazioneFormati ? (
                            <Controller
                                name="guidAree"
                                control={controlDatiKit}
                                rules={{ required: 'Seleziona almeno un\'area' }}
                                render={({ field }) => (
                                    <TomSelect
                                        id="guidAree"
                                        value={(field.value || []).filter((v): v is string => v !== null && v !== undefined)}
                                        options={{ placeholder: "Seleziona aree..." }}
                                        multiple={true}
                                        onChange={field.onChange}
                                        className="w-full"
                                    >
                                        {datiPerCreazioneFormati?.data?.aree?.map((area, index: number) => (
                                            <option key={index} value={area.id}>{area.nome}</option>
                                        ))}
                                    </TomSelect>
                                )}
                            />
                        ) : <Skeleton height="40px" />}
                        {errorsDatiKit.guidAree && <p className="text-danger mt-2">{errorsDatiKit.guidAree.message as string}</p>}
                    </div>
                    <div className="col-span-2">
                        <FormLabel htmlFor="id_pv">Punti Vendita (opzionale)</FormLabel>
                        {datiPerCreazioneFormati ? (
                            <Controller
                                name="guidIdPv"
                                control={controlDatiKit}
                                render={({ field }) => (
                                    <TomSelect
                                        id="idPv"
                                        value={(field.value || []).filter((v): v is string => v !== null && v !== undefined)}
                                        options={{ placeholder: "Seleziona punti vendita..." }}
                                        multiple={true}
                                        onChange={field.onChange}
                                        className="w-full"
                                    >
                                        {datiPerCreazioneFormati?.data?.puntiVendita?.map((pv, index: number) => (
                                            <option key={index} value={pv.id}>{pv.nome}</option>
                                        ))}
                                    </TomSelect>
                                )}
                            />
                        ) : <Skeleton height="40px" />}
                    </div>
                </div>
            </div>

            {/* Configurazione Export */}
            <div className="box box--stacked">
                <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 bg-slate-50/50">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-500/10">
                        <Lucide icon="Download" className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                        <h3 className="font-medium text-slate-800">Configurazione Export</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Configura i tipi di export e i relativi filtri</p>
                    </div>
                </div>
                <div className="p-5">
                    <div className="col-span-4 md:col-span-4">
                        <FormLabel htmlFor="tipiDiExportInKit">Tipi di Export</FormLabel>
                        {datiPerCreazioneFormati ? (
                            <Controller
                                name="tipiDiExportInKit"
                                control={controlDatiKit}
                                rules={{ required: 'Seleziona almeno un tipo di export' }}
                                render={({ field }) => (
                                    <TomSelect
                                        id="tipiDiExportInKit"
                                        value={(field.value || []).map((v: any) => v.tipoDiExportGuidID)}
                                        options={{ placeholder: "Seleziona tipi di export..." }}
                                        multiple={true}
                                        onChange={(e) => {
                                            const selectedIds = e.target.value as string[];
                                            const currentExports = getValuesDatiKit('tipiDiExportInKit') || [];

                                            // Mantieni gli export esistenti che sono ancora selezionati
                                            const keptExports = currentExports.filter((exp: any) =>
                                                selectedIds.includes(exp.tipoDiExportGuidID)
                                            );

                                            // Aggiungi solo i nuovi export selezionati
                                            const newExports = selectedIds
                                                .filter((id: string) =>
                                                    !currentExports.find((exp: any) => exp.tipoDiExportGuidID === id)
                                                )
                                                .map((id: string) => ({
                                                    tipoDiExportGuidID: id,
                                                    ...(getValuesDatiKit('tipo') === TIPO_KIT_DESIGN.AUTOMATICO && { filtro: null }),
                                                    useWebhook: false,
                                                    webhookEvents: null,
                                                }));

                                            const newSelectedExports = [...keptExports, ...newExports];
                                            field.onChange(newSelectedExports);
                                        }}
                                        className="w-full"
                                    >
                                        {datiPerCreazioneFormati?.data?.tipiExport?.map((tipo, index: number) => (
                                            <option key={index} value={tipo.id}>{tipo.nome}</option>
                                        ))}
                                    </TomSelect>
                                )}
                            />
                        ) : <Skeleton height="40px" />}
                        {errorsDatiKit.tipiDiExportInKit && <p className="text-danger mt-2">{errorsDatiKit.tipiDiExportInKit.message as string}</p>}
                    </div>
                    {tipoKitWatch == TIPO_KIT_DESIGN.AUTOMATICO && (
                        <div className="col-span-4 md:col-span-4 mt-5">
                            {tipiDiExportInKitWatch?.map((tipo: any, index: number) => (
                                <div key={index} className="flex flex-col gap-y-3 mt-4 border rounded-lg p-4 bg-slate-50 dark:bg-darkmode-600">
                                    <div className="flex items-center justify-between">
                                        <div className="text-lg font-medium text-primary">
                                            Filtro per: {(datiPerCreazioneFormati?.data?.tipiExport ?? []).find(
                                                (tp: any) => tp.id === tipo.tipoDiExportGuidID
                                            )?.nome}
                                        </div>
                                        <Button
                                            type="button" size='sm' variant="outline-danger"
                                            onClick={() => {
                                                setValueDatiKit("tipiDiExportInKit", getValuesDatiKit('tipiDiExportInKit').filter((_: any, i: number) => i !== index));
                                            }}
                                        >
                                            <Lucide icon="X" className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <FilterBaseForm
                                        control={controlDatiKit}
                                        dataFiltri={tipo.filtro ?? []}
                                        dataAddestramenti={dataAddestramenti || []}
                                        register={registerDatiKit}
                                        errors={errorsDatiKit}
                                        namePrefix={`tipiDiExportInKit[${index}].filtro`}
                                    />
                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex items-center gap-2">
                                            <FormCheck>
                                                <FormCheck.Input
                                                    id={`useWebhook-${index}`}
                                                    type="checkbox"
                                                    checked={webhookStates[index]?.useWebhook ?? false}
                                                    onChange={(e) => {
                                                        const value = e.target.checked;
                                                        setValueDatiKit(`tipiDiExportInKit.${index}.useWebhook`, value);
                                                    }}
                                                />
                                                <FormCheck.Label htmlFor={`useWebhook-${index}`}>Abilita webhook</FormCheck.Label>
                                            </FormCheck>
                                            {webhookStates[index]?.useWebhook && (
                                                <FormSelect
                                                    className="ml-2"
                                                    {...registerDatiKit(`tipiDiExportInKit.${index}.webhookEvents`)}
                                                >
                                                    <option value="">Seleziona evento</option>
                                                    <option value="all">Tutti gli eventi</option>
                                                    {Object.values(EVENTI_WEBHOOK).map(evento => (
                                                        <option key={evento} value={evento}>
                                                            {evento.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                                        </option>
                                                    ))}
                                                </FormSelect>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DatiBaseForm;
