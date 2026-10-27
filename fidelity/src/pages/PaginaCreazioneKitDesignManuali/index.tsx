import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import Pagina from '@/components/Base/Pagina';
import Sezione from '@/components/Base/Sezione';
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
          <Sezione
            icona="Files"
            titolo="Lista file"
            descrizione={files.length === 0 ? 'Nessun file aggiunto' : `${files.length} file`}
            azioni={files.length === 0 ? <Badge variant="info" size="sm">Opzionale</Badge> : undefined}
          >
            <FileManagement files={files} setFiles={setFiles} setNameToPreview={setNameToPreview} />
          </Sezione>
        );
    }
  };

  return (
    <>
      {/* Success dialog */}
      <Dialog open={successModal} onClose={() => setSuccessModal(false)}>
        <Dialog.Panel>
          <Dialog.Title>
            <Lucide icon="CircleCheck" aria-hidden="true" className="h-5 w-5 text-success" />
            Kit design manuale creato
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600">
            Il kit design manuale è stato creato con successo.
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              variant="primary"
              onClick={() => {
                setSuccessModal(false);
                history.back();
              }}
            >
              Ok
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* Template already exists dialog */}
      <Dialog open={showDialogTemplateEsisteGia} onClose={() => setShowDialogTemplateEsisteGia(false)}>
        <Dialog.Panel>
          <Dialog.Title>
            <Lucide icon="OctagonAlert" aria-hidden="true" className="h-5 w-5 text-danger" />
            Combinazione già esistente
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600">
            Esiste già un template con questa combinazione. Cambia i dati per creare una nuova combinazione.
          </Dialog.Description>
          <Dialog.Footer>
            <Button variant="outline-secondary" onClick={() => setShowDialogTemplateEsisteGia(false)}>
              Cambia valori
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <Pagina
        titolo="Nuovo kit design manuale"
        descrizione="Configura i dati e i file attesi del nuovo kit design manuale"
        indietro={{ to: "/impostazioni-di-produzione", etichetta: "Torna alle impostazioni di produzione" }}
      >
        <form onSubmit={handleSubmit(handleCreazione)}>
          <WizardShell
            steps={STEPS}
            currentStep={currentStep}
            onNext={handleNext}
            onPrevious={handlePrevious}
            isSubmitting={creazioneCombinazioni.isPending}
            submitLabel="Crea kit design"
          >
            {renderStepContent()}
          </WizardShell>
        </form>
      </Pagina>
    </>
  );
}
