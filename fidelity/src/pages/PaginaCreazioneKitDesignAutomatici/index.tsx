import Button from '@/components/Base/Button';
import FiltroContext from '@/components/Base/FormFiltriContextDesign';
import FilterBaseForm from '@/components/Base/FormFiltriDesign';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import { useNotification } from '@/context/NotificationContext';
import { useFetchAddestramenti, useFetchAllDeclinazioni, useFetchDatiPerCreazioneKitsDesign, useFetchFiltroContestoById } from '@/query/query';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { SubmitHandler, useFieldArray, useForm } from 'react-hook-form';
import * as yup from 'yup';
import { HttpStatusCode, TIPO_KIT_DESIGN } from '../../../lib/enums';
import { OggettoTipiDiExport } from '../../../lib/types';
import { ServerCall } from '../../../lib/server_call';
import DatiBaseForm from '../DettagliCombinazioniProduzione/components/DatiBaseForm';
import DeclinazioniSection from '../DettagliCombinazioniProduzione/components/DeclinazioniSection';
import WizardShell from '../shared/WizardShell';

type WizardForm = {
  titolo: string;
  quantita: number;
  guidCanali: string[];
  guidAree: string[];
  guidIdPv?: (string | null | undefined)[] | null;
  guidFormato: string;
  tipiDiExportInKit: OggettoTipiDiExport[];
  tipo: TIPO_KIT_DESIGN;
  filtri?: any[];
  filtroContesto?: {
    titoloFiltro: string;
    condizioni: {
      schemaScelto: string;
      nome_field: string;
      operatore: string;
      colonna: string;
    }[];
  }[];
  declinazioni?: {
    titolo: string;
    proprieta: { idChiave: number; valore: string }[];
    filtri: any[];
  }[];
};

const schema = yup.object().shape({
  titolo: yup.string().required('Il titolo è obbligatorio'),
  quantita: yup.number().required('La quantità è obbligatoria').min(1, 'Minimo 1'),
  guidCanali: yup.array().of(yup.string()),
  guidAree: yup.array().of(yup.string()),
  guidIdPv: yup.array().of(yup.string().nullable()),
  guidFormato: yup.string().required('Il formato è obbligatorio'),
  tipiDiExportInKit: yup
    .array()
    .of(yup.object())
    .min(1, 'Almeno un tipo di export è obbligatorio')
    .required('Il tipo di export è obbligatorio'),
  tipo: yup.mixed<TIPO_KIT_DESIGN>().required(),
}).test(
  'canale-o-area',
  "Deve essere compilato almeno il canale o l'area",
  (value) =>
    (value?.guidCanali && value.guidCanali.length > 0) ||
    (value?.guidAree && value.guidAree.length > 0)
);

const STEPS = [
  { title: 'Dati essenziali' },
  { title: 'Filtro contesto' },
  { title: 'Filtri' },
  { title: 'Declinazioni' },
];

export default function PaginaCreazioneKitDesignAutomatici() {
  const [currentStep, setCurrentStep] = useState(0);
  const [successModal, setSuccessModal] = useState(false);
  const [showDialogTemplateEsisteGia, setShowDialogTemplateEsisteGia] = useState(false);
  const { showNotification } = useNotification();

  const datiPerCreazioneFormati = useFetchDatiPerCreazioneKitsDesign();
  const dataAddestramenti = useFetchAddestramenti();
  const dataAllDeclinazioni = useFetchAllDeclinazioni();
  // "new" is a non-empty string that enables the query to fetch /getFiltroContestoDaIstanta schema
  const dataFiltroContestoSchema = useFetchFiltroContestoById('new');

  const {
    control,
    register,
    handleSubmit,
    trigger,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<WizardForm>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      tipo: TIPO_KIT_DESIGN.AUTOMATICO,
      quantita: 1,
      guidCanali: [],
      guidAree: [],
      guidIdPv: [],
      tipiDiExportInKit: [],
      filtri: [],
      filtroContesto: [],
      declinazioni: [],
    },
  });

  // Field array for declinazioni (step 2)
  const { fields, append, remove } = useFieldArray<any>({
    control,
    name: 'declinazioni',
  });

  const creazioneCombinazioni = useMutation({
    mutationFn: async (data: {
      titolo: string;
      guidCanale: string[];
      guidArea: string[];
      guidPv: string[];
      guidFormato: string;
      tipiDiExportInKit: OggettoTipiDiExport[];
      quantitaCopie: number;
      tipo: string;
    }) => ServerCall.put('/creaCombinazioniDesign', data),
    mutationKey: ['creaCombinazione'],
    onSuccess: (data: any) => {
      if (data?.code === HttpStatusCode.BAD_REQUEST && data?.additionalData?.template_exist) {
        setShowDialogTemplateEsisteGia(true);
        return;
      }
      setSuccessModal(true);
    },
    onError: (error: any) => {
      if (error?.code === HttpStatusCode.BAD_REQUEST && error?.additionalData?.template_exist) {
        setShowDialogTemplateEsisteGia(true);
      }
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4">
            <div className="font-bold text-sm">Errore durante la creazione del kit design</div>
            <div className="mt-1 text-slate-500 text-xs">{error?.message}</div>
          </div>
        </div>
      );
    },
  });

  const handleCreazione: SubmitHandler<WizardForm> = (data) => {
    creazioneCombinazioni.mutate({
      titolo: data.titolo,
      guidCanale: data.guidCanali?.filter(Boolean) as string[],
      guidArea: data.guidAree?.filter(Boolean) as string[],
      guidPv: (data.guidIdPv ?? []).filter((v): v is string => v != null),
      guidFormato: data.guidFormato,
      tipiDiExportInKit: data.tipiDiExportInKit.map((t) => ({
        ...t,
        filtro: t.filtro ?? null,
      })),
      quantitaCopie: data.quantita,
      tipo: TIPO_KIT_DESIGN.AUTOMATICO,
    });
  };

  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (currentStep === 0) {
      const valid = await trigger([
        'titolo',
        'guidCanali',
        'guidAree',
        'guidIdPv',
        'guidFormato',
        'tipiDiExportInKit',
        'quantita',
      ]);
      if (!valid) return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <DatiBaseForm
            controlDatiKit={control as any}
            errorsDatiKit={errors as any}
            registerDatiKit={register as any}
            getValuesDatiKit={getValues as any}
            setValueDatiKit={setValue as any}
            datiPerCreazioneFormati={datiPerCreazioneFormati as any}
            dataAddestramenti={dataAddestramenti?.data}
          />
        );
      case 1:
        return (
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
                control={control as any}
                register={register as any}
                setValue={setValue as any}
                errors={errors}
                retriviedDataFiltriContesto={[]}
                dataPerContesto={dataFiltroContestoSchema?.data ?? []}
                namePrefix="filtroContesto"
              />
            </div>
          </div>
        );
      case 2:
        return (
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
                control={control as any}
                register={register as any}
                errors={errors}
                dataFiltri={[]}
                dataAddestramenti={dataAddestramenti?.data ?? []}
                namePrefix="filtri"
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="box box--stacked">
            <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 bg-slate-50/50">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500/10">
                <Lucide icon="GitBranch" className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-medium text-slate-800">Declinazioni</h3>
                <p className="text-xs text-slate-500 mt-0.5">Configura le declinazioni del kit</p>
              </div>
            </div>
            <div className="p-5">
              <DeclinazioniSection
                fields={fields}
                append={append}
                remove={remove}
                control={control}
                register={register as any}
                errors={errors}
                dataDeclinazioni={dataAllDeclinazioni}
                dataAddestramenti={dataAddestramenti?.data ?? []}
                handleRemoveDeclinazione={(i) => remove(i)}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {/* Success dialog */}
      <Dialog open={successModal} onClose={() => setSuccessModal(false)}>
        <Dialog.Panel>
          <div className="p-5 text-center">
            <Lucide icon="CircleCheck" className="w-16 h-16 mx-auto mt-3 text-success" />
            <div className="mt-5 text-3xl">Kit combinazione creato!</div>
            <div className="mt-2 text-slate-500">Il tuo kit combinazione è stato creato con successo.</div>
          </div>
          <div className="px-5 pb-8 text-center">
            <Button
              variant="primary"
              className="w-24"
              onClick={() => {
                setSuccessModal(false);
                history.back();
              }}
            >
              Ok
            </Button>
          </div>
        </Dialog.Panel>
      </Dialog>

      {/* Template already exists dialog */}
      <Dialog open={showDialogTemplateEsisteGia} onClose={() => setShowDialogTemplateEsisteGia(false)}>
        <Dialog.Panel>
          <Dialog.Description>
            <div className="flex flex-col items-center gap-3">
              <Lucide icon="OctagonAlert" className="w-16 h-16 text-danger" />
              <span>
                Esiste già un template con questa combinazione!
                <br />
                Sovrascrivi il template esistente oppure cambia i dati.
              </span>
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDialogTemplateEsisteGia(false)}>
                Cambia valori
              </Button>
              <Button variant="danger" onClick={() => setShowDialogTemplateEsisteGia(false)}>
                Sovrascrivi
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <div className="flex flex-col items-center p-5">
        <form onSubmit={handleSubmit(handleCreazione)} className="w-full">
          <WizardShell
            steps={STEPS}
            currentStep={currentStep}
            onNext={handleNext}
            onPrevious={handlePrevious}
            isSubmitting={creazioneCombinazioni.isPending}
            submitLabel="Crea Combinazione"
          >
            {renderStepContent()}
          </WizardShell>
        </form>
      </div>
    </>
  );
}
