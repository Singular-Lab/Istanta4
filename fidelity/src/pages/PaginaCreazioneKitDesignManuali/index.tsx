import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import FileManagement from '@/components/FilesKit';
import { useNotification } from '@/context/NotificationContext';
import { useFetchAddestramenti, useFetchDatiPerCreazioneKitsDesign } from '@/query/query';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Resolver, SubmitHandler, useForm } from 'react-hook-form';
import * as yup from 'yup';
import { HttpStatusCode, TIPO_KIT_DESIGN } from '../../../lib/enums';
import { FileItemKit, OggettoTipiDiExport } from '../../../lib/types';
import { ServerCall } from '../../../lib/server_call';
import DatiBaseForm from '../DettagliCombinazioniProduzione/components/DatiBaseForm';
import WizardShell from '../shared/WizardShell';

type WizardForm = {
  titolo: string;
  quantita: number;
  guidCanali: string[];
  guidAree: string[];
  guidIdPv?: (string | null | undefined)[] | null;
  guidFormato: string;
  tipiDiExportInKit?: OggettoTipiDiExport[];
  tipo: TIPO_KIT_DESIGN;
};

const schema = yup.object().shape({
  titolo: yup.string().required('Il titolo è obbligatorio'),
  quantita: yup.number().required('La quantità è obbligatoria').min(1, 'Minimo 1'),
  guidCanali: yup.array().of(yup.string()),
  guidAree: yup.array().of(yup.string()),
  guidIdPv: yup.array().of(yup.string().nullable()),
  guidFormato: yup.string().required('Il formato è obbligatorio'),
  tipiDiExportInKit: yup.array().of(yup.object()),
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
  { title: 'Lista file' },
];

export default function PaginaCreazioneKitDesignManuali() {
  const [currentStep, setCurrentStep] = useState(0);
  const [successModal, setSuccessModal] = useState(false);
  const [showDialogTemplateEsisteGia, setShowDialogTemplateEsisteGia] = useState(false);
  const [files, setFiles] = useState<FileItemKit[]>([]);
  const [nameToPreview, setNameToPreview] = useState<string[]>([]);
  const { showNotification } = useNotification();

  const datiPerCreazioneFormati = useFetchDatiPerCreazioneKitsDesign();
  const dataAddestramenti = useFetchAddestramenti();

  const {
    control,
    register,
    handleSubmit,
    trigger,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<WizardForm>({
    resolver: yupResolver(schema) as Resolver<WizardForm>,
    defaultValues: {
      tipo: TIPO_KIT_DESIGN.MANUALE,
      quantita: 1,
      guidCanali: [],
      guidAree: [],
      guidIdPv: [],
      tipiDiExportInKit: [],
    },
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
      tipo: TIPO_KIT_DESIGN;
      files: FileItemKit[];
    }) => ServerCall.put('/creaCombinazioniDesign', data),
    mutationKey: ['creaCombinazione'],
    onSuccess: (data: any) => {
      if (data?.code === HttpStatusCode.BAD_REQUEST && data?.additionalData?.template_exist) {
        setShowDialogTemplateEsisteGia(true);
        return;
      }
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4">
            <div className="font-bold text-sm">Kit design manuale creato con successo</div>
          </div>
        </div>
      );
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
      tipiDiExportInKit: data.tipiDiExportInKit ?? [],
      quantitaCopie: data.quantita,
      tipo: TIPO_KIT_DESIGN.MANUALE,
      files,
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
          <div className="flex flex-col gap-5">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <Lucide icon="Info" className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                Aggiungi i file che faranno parte di questo kit manuale. Potrai modificarne il nome
                e inserire eventuali direttive.
              </p>
            </div>

            <div className="box box--stacked">
              <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 bg-slate-50/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-500/10">
                  <Lucide icon="Files" className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-800">Lista file</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {files.length === 0 ? 'Nessun file aggiunto' : `${files.length} file`}
                  </p>
                </div>
                {files.length === 0 && (
                  <Badge variant="info" size="sm">Opzionale</Badge>
                )}
              </div>
              <div className="p-5">
                {files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-lg text-slate-400">
                    <Lucide icon="FileX" className="w-10 h-10 mb-2" />
                    <p className="text-sm">Nessun file aggiunto</p>
                  </div>
                ) : (
                  <FileManagement
                    files={files}
                    setFiles={setFiles}
                    setNameToPreview={setNameToPreview}
                  />
                )}
              </div>
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
