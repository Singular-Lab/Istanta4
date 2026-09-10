import Button from "@/components/Base/Button";
import { FormInput, FormLabel } from "@/components/Base/Form";
import Litepicker from "@/components/Base/Litepicker";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Skeleton from "@/components/Base/Skeleton";
import withSessionCheck from "@/components/SessionChecker";
import ContestoLavorazioneFields from "@/components/ContestoLavorazioneFields";
import { useNotification } from "@/context/NotificationContext";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation } from "@tanstack/react-query";
import Tippy from '@tippyjs/react';
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import { Colorize } from "../../../lib/Colorize";
import { ServerCall } from "../../../lib/server_call";
import { PromoResponseDTO } from "../../../server/core/dto";
import { useContestoPerNuovaLavorazione } from "../../query/query";

dayjs.extend(customParseFormat);

const schema = yup.object().shape({
  nome_promo: yup.string().required("Il nome della lavorazioneè obbligatorio"),
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
  const MAX_CHAR_CUSTOM_LABEL = 40;
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  // Hook per recuperare il contesto per la nuova lavorazione tramite useQuery
  const { data: dataContestoPerNuovaLavorazione, isLoading: isLoadingContestoPerNuovaLavorazione } = useContestoPerNuovaLavorazione();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
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
      console.log(error);
    },
  });

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


  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-12 gap-y-10 gap-x-6">
        <div className="col-span-12">
          <PageHeader
            title="Nuova promozione"
            description="Crea una nuova lavorazione per inserire i tracciati"
          />
          <div className="mt-3.5">
            <div className="flex flex-col box box--stacked p-5">
              <div className="overflow-hidden">
                <div className="grid p-1 grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-y-2">
                    <FormLabel htmlFor="nome_promo" className="flex items-center gap-2">
                      <Lucide icon="Tag" className="w-4 h-4 text-primary" />
                      Titolo Promo
                    </FormLabel>
                    <div className="relative">
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
                    </div>
                    {errors.nome_promo && (
                      <span className="text-danger">
                        {errors.nome_promo.message}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <FormLabel htmlFor="data_scandenza_promo" className="flex items-center gap-2">
                      <Lucide icon="Calendar" className="w-4 h-4 text-primary" />
                      Data di scadenza
                    </FormLabel>
                    <div className="relative">
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
                          handleInputChange(
                            "data_scandenza_promo",
                            e.target.value
                          );
                        }}
                      />

                    </div>
                    {errors.data_scandenza_promo && (
                      <span className="text-danger">
                        {errors.data_scandenza_promo.message}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <FormLabel htmlFor="range_di_date" className="flex items-center gap-2">
                      <Lucide icon="CalendarDays" className="w-4 h-4 text-primary" />
                      Data di inizio e data di fine
                    </FormLabel>
                    <div className="relative">
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
                          const [dataInizio, dataFine] =
                            e.target.value.split(" - ");
                          handleInputChange("data_inizio_promo", dataInizio);
                          handleInputChange("data_fine_promo", dataFine);
                        }}
                      />
                    </div>
                    {errors.range_di_date && (
                      <span className="text-danger">
                        {errors.range_di_date.message}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <div className="flex align-middle items-start justify-between">
                      <FormLabel htmlFor="offset_visibilita" className="flex items-center gap-2">
                        <Lucide icon="Eye" className="w-4 h-4 text-primary" />
                        Offset visibilità
                      </FormLabel>
                      <Tippy
                        className="text-center"
                        content={<p>Questi sono i giorni in cui i contenuti del WebPliant appaiono</p>}
                        theme="light"
                      >
                        <Lucide icon="Info" className="w-3 h-3" />
                      </Tippy>
                    </div>
                    <div className="relative">
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
                    </div>
                    {errors.offset_visibilita && (
                      <span className="text-danger">
                        {errors.offset_visibilita.message}
                      </span>
                    )}
                  </div>
                </div>
                {isLoadingContestoPerNuovaLavorazione ? (
                  <div className="border rounded-[0.6rem] dark:border-darkmode-400 relative mt-10 mb-4 border-slate-200/80">
                    <div className="absolute left-0 px-3 ml-4 -mt-2 text-xs uppercase bg-white text-slate-500">
                      <div className="-mt-px">Specifiche di lavorazione</div>
                    </div>
                    <div className="px-5 py-2 mt-4 flex flex-col gap-3.5">
                      <Skeleton height="40px" className="rounded-md" />
                      <Skeleton height="40px" className="rounded-md" />
                      <Skeleton height="40px" className="rounded-md" />
                    </div>
                  </div>
                ) : (
                  fields.length > 0 && (
                    <div className="border rounded-[0.6rem] dark:border-darkmode-400 relative mt-10 mb-4 border-slate-200/80">
                      <div className="absolute left-0 px-3 ml-4 -mt-2 text-xs uppercase bg-white text-slate-500">
                        <div className="-mt-px">Specifiche di lavorazione</div>
                      </div>
                      <div className="px-5 py-2 mt-4">
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
                      </div>
                    </div>
                  )
                )}
              </div>
              <div className="flex flex-col-reverse sm:flex-row flex-wrap items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-200/80 dark:border-darkmode-400">
                <Button
                  disabled={isLoadingContestoPerNuovaLavorazione || faiPartitireLavorazione.isPending}
                  variant={
                    isLoadingContestoPerNuovaLavorazione || faiPartitireLavorazione.isPending
                      ? "pending"
                      : "primary"
                  }
                  type="submit"
                  aria-busy={isLoadingContestoPerNuovaLavorazione || faiPartitireLavorazione.isPending}
                >
                  {isLoadingContestoPerNuovaLavorazione ? (
                    <>
                      <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                      <span>Caricamento dati...</span>
                    </>
                  ) : faiPartitireLavorazione.isPending ? (
                    <>
                      <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                      <span>Creazione in corso...</span>
                    </>
                  ) : (
                    <>
                      <Lucide icon="Plus" className="w-4 h-4 mr-2" />
                      <span>Crea Promozione</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export default withSessionCheck(Main);
