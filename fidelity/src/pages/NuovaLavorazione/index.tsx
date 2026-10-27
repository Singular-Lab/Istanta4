import Button from "@/components/Base/Button";
import { FormField, FormInput } from "@/components/Base/Form";
import Litepicker from "@/components/Base/Litepicker";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import withSessionCheck from "@/components/SessionChecker";
import ContestoLavorazioneFields from "@/components/ContestoLavorazioneFields";
import VisibilitaPromoFields from "@/components/VisibilitaPromoFields";
import { useNotification } from "@/context/NotificationContext";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import { Colorize } from "../../../lib/Colorize";
import { ServerCall } from "../../../lib/server_call";
import type { VisibilitaPromo } from "../../../lib/types";
import { PromoResponseDTO } from "../../../server/core/dto";
import { useContestoPerNuovaLavorazione } from "../../query/query";
import SpecificheLavorazione from "../shared/SpecificheLavorazione";

dayjs.extend(customParseFormat);

const schema = yup.object().shape({
  nome_promo: yup.string().required("Il nome della lavorazione è obbligatorio"),
  data_scandenza_promo: yup.string().required("La data di scadenza è obbligatoria"),
  range_di_date: yup.string()
    .required("La data di inizio e fine sono obbligatorie")
    .test(
      'scadenza-prima-di-validita',
      'La data di scadenza deve essere precedente alla data di inizio validità',
      function (value) {
        const { data_scandenza_promo } = this.parent;
        if (!data_scandenza_promo || !value) return true;
        const dataInizio = value.split(" - ")[0];
        const scadenza = dayjs(data_scandenza_promo, "DD/MM/YYYY", true);
        const inizio = dayjs(dataInizio, "DD/MM/YYYY", true);
        if (!scadenza.isValid() || !inizio.isValid()) return true;
        return scadenza.isBefore(inizio);
      }
    ),
  offset_visibilita: yup.string().required("L'offset di visibilità è obbligatorio").min(1, "L'offset di visibilità deve essere maggiore di 0"),
  context_lavorazione: yup.array().of(
    yup.object().shape({
      nome_field: yup.string().required(),
      user_value: yup.mixed().test('validate-field', 'Campo obbligatorio', function (value) {
        const { dipendenze, nullable } = this.parent;
        const allFields = this.options.context?.allFieldValues || {};

        // Check if field dependencies are met
        let dependenciesMet = true;
        if (dipendenze && dipendenze.length > 0) {
          dependenciesMet = dipendenze.every((dependency: any) => {
            const dependentValue = allFields[dependency.nome_field];

            // If the dependent field is not found, or its value doesn't match the expected value
            if (dependentValue !== dependency.valore) {
              return false;
            }

            return true;
          });
        }

        if (!dependenciesMet) {
          return true; // Skip validation if dependencies are not met
        }

        // Proceed with validation
        if (nullable === false && (value === undefined || value === '')) {
          return this.createError({ message: 'Campo obbligatorio' });
        }

        return true;
      }),
    })
  ),
});

function Main() {
  const [titoloPromo, setTitoloPromo] = useState("");
  const [dataScadenzaPromo, setDataScadenzaPromo] = useState("");
  const [rangeDiDate, setRangeDiDate] = useState("");
  const [fieldValues, setFieldValues] = useState<any>({});
  const [customLabelValue, setCustomLabelValue] = useState("");
  const [visibilita, setVisibilita] = useState<VisibilitaPromo | null>(null);
  const MAX_CHAR_CUSTOM_LABEL = 40;
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  // Hook per recuperare il contesto per la nuova lavorazione tramite useQuery
  const { data: dataContestoPerNuovaLavorazione, isLoading: isLoadingContestoPerNuovaLavorazione } = useContestoPerNuovaLavorazione();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    trigger,
    control,
  } = useForm({
    resolver: yupResolver(schema),
    context: { allFieldValues: fieldValues },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "context_lavorazione",
  });


  useEffect(() => {
    if (dataContestoPerNuovaLavorazione) {
      // Clear existing fields
      remove();

      // Initialize all field values (including empty strings) to enable immediate dependency checks
      const initialFieldValues: any = {};
      dataContestoPerNuovaLavorazione.forEach((field: any) => {
        const resolvedInitialValue =
          field.user_value !== undefined && field.user_value !== null
            ? field.user_value
            : "";
        initialFieldValues[field.nome_field] = resolvedInitialValue;
      });
      setFieldValues(initialFieldValues);

      // Populate the fields using append
      dataContestoPerNuovaLavorazione.forEach((field: any) => {
        append({
          ...field,
          user_value: field.user_value || "",
        });
      });
    }
  }, [JSON.stringify(dataContestoPerNuovaLavorazione)]);


  const handleInputChange = (fieldName: string, value: any) => {
    setFieldValues((prevValues: any) => ({
      ...prevValues,
      [fieldName]: value,
    }));

    const index = fields.findIndex(
      (field: any) => field.nome_field === fieldName
    );

    if (index !== -1) {
      setValue(`context_lavorazione.${index}.user_value`, value, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const faiPartitireLavorazione = useMutation({
    mutationKey: ["faiPartitireLavorazione"],
    mutationFn: async (formData: any) => {
      console.log(Colorize.bgBlack("Context Lavorazione:"));
      const filteredContext = formData.context_lavorazione.filter((field: any) => {
        // Escludi i campi con user_value uguale a -1 o vuoto
        if (field.user_value === "" || field.user_value === -1) {
          return false;
        }

        // Controlla se il campo ha dipendenze
        if (field.dipendenze && field.dipendenze.length > 0) {
          // Verifica se tutte le dipendenze sono rispettate
          for (const dipendenza of field.dipendenze) {
            const dipendenzaField = formData.context_lavorazione.find(
              (f: any) => f.nome_field === dipendenza.nome_field
            );
            if (dipendenzaField && dipendenzaField.user_value !== dipendenza.valore) {
              return false;
            }
          }
        }

        return true;
      });
      console.log(filteredContext);

      // Make the API call with the form data
      const response = await ServerCall.post<PromoResponseDTO>("/promo", {
        titolo: formData.nome_promo,
        dataDiScadenza: formData.data_scandenza_promo,
        dataDiInizio: formData.range_di_date.split(" - ")[0],
        dataDiFine: formData.range_di_date.split(" - ")[1],
        offsetVisibilita: formData.offset_visibilita,
        context: filteredContext,
        meta: { visibilita },
      });
      return response;
    },
    onSuccess: (data: PromoResponseDTO) => {
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <span className="ml-2">Lavorazione partita con successo</span>
        </div>,
        { variant: "success" }
      );
      navigate(`/promozioni/in-corso/dettagli/${data.id}`);
      console.log("Lavorazione partita con successo");
    },
    onError: (error: any) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Promozione non creata</div>
            <div className="mt-1 text-slate-500">{error?.message}</div>
          </div>
        </div>
      );
    },
  });

  // Bloccato dal primo click: la validazione e asincrona e prima che la chiamata
  // parta un secondo click creerebbe un'altra promo
  const inCreazione = isSubmitting || faiPartitireLavorazione.isPending;

  const onSubmit = async (data: any) => {
    const isValid = await trigger();

    if (!isValid) {
      console.log("Form non valido");
      return;
    }

    // Proceed with form submission
    console.log("Dati inviati:");
    console.log(data);
    faiPartitireLavorazione.mutate(data);
  };


  const occupato = isLoadingContestoPerNuovaLavorazione || inCreazione;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Pagina titolo="Nuova promozione" descrizione="Crea una nuova lavorazione per inserire i tracciati">
        <Sezione titolo="Dati della promozione" descrizione="Titolo, scadenza e periodo di validità">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField etichetta="Titolo promo" errore={errors.nome_promo?.message}>
              <FormInput
                disabled={isLoadingContestoPerNuovaLavorazione}
                autoComplete="off"
                id="nome_promo"
                {...register("nome_promo")}
                onChange={(e) => {
                  setTitoloPromo(e.target.value);
                  handleInputChange("nome_promo", e.target.value);
                }}
              />
            </FormField>
            <FormField etichetta="Data di scadenza" errore={errors.data_scandenza_promo?.message}>
              <Litepicker
                value={dataScadenzaPromo}
                disabled={isLoadingContestoPerNuovaLavorazione}
                id="data_scandenza_promo"
                options={{
                  format: "DD/MM/YYYY",
                  lang: "it-IT",
                  singleMode: true,
                  dropdowns: {
                    minYear: new Date().getFullYear() - 5,
                    maxYear: new Date().getFullYear() + 5,
                    months: true,
                    years: true,
                  },
                }}
                onChange={(e) => {
                  setDataScadenzaPromo(e.target.value);
                  setValue("data_scandenza_promo", e.target.value);
                  handleInputChange("data_scandenza_promo", e.target.value);
                }}
              />
            </FormField>
            <FormField etichetta="Data di inizio e data di fine" errore={errors.range_di_date?.message}>
              <Litepicker
                disabled={isLoadingContestoPerNuovaLavorazione}
                id="range_di_date"
                value={rangeDiDate}
                options={{
                  buttonText: {
                    apply: "Applica",
                    cancel: "Annulla",
                    reset: "Reset",
                    previousMonth: "Previous",
                    nextMonth: "Next",
                  },
                  mobileFriendly: true,
                  autoApply: false,
                  singleMode: false,
                  numberOfColumns: 2,
                  numberOfMonths: 2,
                  showWeekNumbers: true,
                  format: "DD/MM/YYYY",
                  lang: "it-IT",
                  dropdowns: {
                    minYear: new Date().getFullYear() - 5,
                    maxYear: new Date().getFullYear() + 5,
                    months: true,
                    years: true,
                  },
                }}
                onChange={(e) => {
                  setRangeDiDate(e.target.value);
                  setValue("range_di_date", e.target.value);
                  const [dataInizio, dataFine] = e.target.value.split(" - ");
                  handleInputChange("data_inizio_promo", dataInizio);
                  handleInputChange("data_fine_promo", dataFine);
                }}
              />
            </FormField>
            <FormField
              etichetta="Offset visibilità"
              aiuto="Giorni in cui i contenuti del WebPliant appaiono"
              errore={errors.offset_visibilita?.message}
            >
              <FormInput
                autoComplete="off"
                disabled={isLoadingContestoPerNuovaLavorazione}
                type="number"
                min={1}
                id="offset_visibilita"
                {...register("offset_visibilita")}
                onChange={(e) => {
                  setTitoloPromo(e.target.value);
                  handleInputChange("offset_visibilita", e.target.value);
                }}
              />
            </FormField>
          </div>

          {(isLoadingContestoPerNuovaLavorazione || fields.length > 0) && (
            <SpecificheLavorazione caricamento={isLoadingContestoPerNuovaLavorazione} className="mt-8">
              <ContestoLavorazioneFields
                context={fields as any}
                fieldValues={fieldValues}
                customLabelValue={customLabelValue}
                errors={(() => {
                  const map: { [k: string]: string } = {};
                  if (errors.context_lavorazione) {
                    fields.forEach((field: any, index: number) => {
                      const msg = (errors.context_lavorazione as any)?.[index]?.user_value?.message;
                      if (msg) map[field.nome_field] = msg;
                    });
                  }
                  return map;
                })()}
                maxCharCustomLabel={MAX_CHAR_CUSTOM_LABEL}
                onChange={handleInputChange}
                onCustomLabelChange={setCustomLabelValue}
              />
            </SpecificheLavorazione>
          )}
          <VisibilitaPromoFields value={visibilita} onChange={setVisibilita} className="mt-8" />

          <div className="mt-8 flex justify-end border-t border-slate-200 pt-5 dark:border-darkmode-400">
            <Button
              variant="primary"
              type="submit"
              disabled={occupato}
              loading={occupato}
            >
              {isLoadingContestoPerNuovaLavorazione ? (
                "Caricamento dati…"
              ) : inCreazione ? (
                "Creazione in corso…"
              ) : (
                <>
                  <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
                  Crea promozione
                </>
              )}
            </Button>
          </div>
        </Sezione>
      </Pagina>
    </form>
  );
}

export default withSessionCheck(Main);
