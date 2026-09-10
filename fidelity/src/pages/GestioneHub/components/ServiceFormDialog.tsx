import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormLabel, FormSelect, FormSwitch, FormTextarea } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useEffect, useMemo, useState } from "react";
import type { HubServiceDTO } from "../../../../lib/types";
import type { HubServiceGroup, ServiceDialogMode, ServiceFormValues, ServiceMutationPayload, ServiceTargetOption } from "../types";
import {
  buildServiceTargetOptions,
  createServiceTargetKey,
  getInitialServiceFormValues,
  getServiceTargetLabel,
  SERVICE_COLOR_OPTIONS,
  SERVICE_TIPO_URL_OPTIONS,
} from "../utils";
import IconInput from "./IconInput";
import ServiceSharedAssetsEditor from "./ServiceSharedAssetsEditor";

interface ServiceFormDialogProps {
  open: boolean;
  mode: ServiceDialogMode;
  group?: HubServiceGroup;
  variant?: HubServiceDTO;
  existingTargetKeys?: string[];
  gdoRoleOptions: Array<{ ruolo: string }>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: ServiceMutationPayload) => Promise<void> | void;
}

const DIALOG_TITLES: Record<ServiceDialogMode, string> = {
  create: "Nuovo servizio",
  "add-variant": "Aggiungi variante",
  "edit-group": "Modifica gruppo",
};

const ServiceFormDialog = ({
  open,
  mode,
  group,
  variant,
  existingTargetKeys = [],
  gdoRoleOptions,
  submitting = false,
  onClose,
  onSubmit,
}: ServiceFormDialogProps) => {
  const sourceVariant = variant ?? group?.variants[0];
  const [values, setValues] = useState<ServiceFormValues>(getInitialServiceFormValues(sourceVariant));
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const targetOptions = useMemo(() => buildServiceTargetOptions(gdoRoleOptions), [gdoRoleOptions]);
  const disabledTargetKeys = useMemo(
    () => mode === "edit-group" ? new Set<string>() : new Set(existingTargetKeys),
    [existingTargetKeys, mode]
  );

  useEffect(() => {
    if (!open) return;

    const initialValues = getInitialServiceFormValues(sourceVariant);
    if (mode !== "create" && group?.codice) {
      initialValues.codice = group.codice;
    }

    setValues(initialValues);
    setErrorMessage(null);

    if (mode === "edit-group" && group) {
      setSelectedTargetKeys(group.variants.map((v) => createServiceTargetKey(v.tipo_utente, v.ruolo_gdo)));
    } else {
      setSelectedTargetKeys([]);
    }
  }, [open, mode, sourceVariant, group, variant]);

  const selectedTargets = useMemo(
    () => targetOptions.filter((target) => selectedTargetKeys.includes(target.key)),
    [selectedTargetKeys, targetOptions]
  );

  const existingVariantKeyMap = useMemo(() => {
    if (mode !== "edit-group") return new Map<string, HubServiceDTO>();
    return new Map(
      (group?.variants ?? []).map((v) => [createServiceTargetKey(v.tipo_utente, v.ruolo_gdo), v])
    );
  }, [mode, group]);

  const variantsToDelete = useMemo(() => {
    if (mode !== "edit-group") return [];
    return Array.from(existingVariantKeyMap.entries())
      .filter(([key]) => !selectedTargetKeys.includes(key))
      .map(([, v]) => v);
  }, [mode, existingVariantKeyMap, selectedTargetKeys]);

  const updateField = <K extends keyof ServiceFormValues>(field: K, value: ServiceFormValues[K]) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleTarget = (target: ServiceTargetOption) => {
    setSelectedTargetKeys((current) => {
      if (current.includes(target.key)) {
        return current.filter((key) => key !== target.key);
      }

      return [...current, target.key];
    });
  };

  const validate = () => {
    if (!values.codice.trim()) return "Il codice del servizio è obbligatorio.";
    if (!values.nome.trim()) return "Il nome del servizio è obbligatorio.";
    if (values.tipo_url !== "internal" && !values.url.trim()) return "L'URL del servizio è obbligatorio.";

    if (selectedTargets.length === 0) {
      return "Seleziona almeno un target per la variante.";
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);

    await onSubmit({
      values: {
        ...values,
        codice: values.codice.trim(),
        nome: values.nome.trim(),
        descrizione: values.descrizione.trim(),
        icona: values.icona.trim() || "Box",
        url: values.tipo_url === "internal" ? "/hub" : values.url.trim(),
        redirect_page: values.redirect_page.trim(),
        documents: values.documents.map((document) => ({
          ...document,
          title: document.title.trim() || document.original_name,
        })),
        videos: values.videos.map((video) => ({
          ...video,
          title: video.title.trim() || video.original_name,
        })),
      },
      targets: selectedTargets,
      variantsToDelete: mode === "edit-group" ? variantsToDelete : undefined,
    });
  };

  const renderTargetSection = (title: string, options: ServiceTargetOption[]) => {
    if (options.length === 0) return null;

    const selectableKeys = options.filter((o) => !disabledTargetKeys.has(o.key)).map((o) => o.key);
    const allSectionSelected = selectableKeys.length > 0 && selectableKeys.every((k) => selectedTargetKeys.includes(k));

    const toggleSectionAll = () => {
      if (allSectionSelected) {
        setSelectedTargetKeys((cur) => cur.filter((k) => !selectableKeys.includes(k)));
      } else {
        setSelectedTargetKeys((cur) => [
          ...cur.filter((k) => !selectableKeys.includes(k)),
          ...selectableKeys,
        ]);
      }
    };

    return (
      <section className="rounded-md border border-slate-200/80 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {options.filter((o) => selectedTargetKeys.includes(o.key)).length} / {options.length} sel.
            </span>
            {selectableKeys.length > 0 && (
              <button type="button" onClick={toggleSectionAll} className="text-xs font-medium text-primary hover:underline">
                {allSectionSelected ? "Deseleziona" : "Tutti"}
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {options.map((target) => {
            const checked = selectedTargetKeys.includes(target.key);
            const disabled = disabledTargetKeys.has(target.key);

            return (
              <FormCheck
                key={target.key}
                className={`items-start gap-3 rounded-xl border px-3 py-3 transition ${checked ? "border-primary/40 bg-primary/5" : "border-slate-200"} ${disabled ? "opacity-60" : ""}`}
              >
                <FormCheck.Input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  className="mt-0.5 shrink-0"
                  onChange={() => toggleTarget(target)}
                />
                <FormCheck.Label className="ml-0 flex-1">
                  <div className="text-sm font-medium text-slate-700">{target.label}</div>
                  {disabled && <div className="text-xs text-slate-500">Variante già presente</div>}
                </FormCheck.Label>
              </FormCheck>
            );
          })}
        </div>
      </section>
    );
  };

  const targetsByType = useMemo(() => {
    const grouped = new Map<string, ServiceTargetOption[]>();
    for (const opt of targetOptions) {
      const existing = grouped.get(opt.tipo_utente) ?? [];
      grouped.set(opt.tipo_utente, [...existing, opt]);
    }
    return Array.from(grouped.entries());
  }, [targetOptions]);
  const isInternalUrl = values.tipo_url === "internal";

  return (
    <Dialog open={open} onClose={onClose} size="2xl">
      <Dialog.Panel className="overflow-hidden lg:w-[980px] xl:w-[1080px]">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-8rem)] flex-col">
          <Dialog.Title className="gap-3 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <Lucide icon={mode === "edit-group" ? "PencilLine" : "Blocks"} className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-slate-800">{DIALOG_TITLES[mode]}</div>
                <div className="text-sm font-normal text-slate-500">Gestione variante servizio Hub</div>
              </div>
            </div>
          </Dialog.Title>

          <Dialog.Description className="min-h-0 flex-1 overflow-y-auto p-0">
            <div className="space-y-5 bg-slate-50/50 px-5 py-5">
              {errorMessage && (
                <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {errorMessage}
                </div>
              )}

              {mode === "edit-group" && variantsToDelete.length > 0 && (
                <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex items-start gap-2">
                  <Lucide icon="AlertTriangle" className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>
                      {variantsToDelete.length === 1
                        ? "1 variante verrà eliminata"
                        : `${variantsToDelete.length} varianti verranno eliminate`}
                      :
                    </strong>{" "}
                    {variantsToDelete.map((v) => getServiceTargetLabel(v)).join(", ")}
                  </span>
                </div>
              )}

              <div className="grid gap-5 xl:grid-cols-2">
                <section className="rounded-md border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5">
                    <div className="text-sm font-semibold text-slate-800">Dati servizio</div>
                    <div className="mt-1 text-xs text-slate-500">Informazioni condivise dal gruppo e contenuti visibili nella card Hub.</div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <FormLabel htmlFor="service-codice">Codice</FormLabel>
                      <FormInput
                        id="service-codice"
                        value={values.codice}
                        readOnly={mode !== "create"}
                        onChange={(event) => updateField("codice", event.target.value)}
                        className="mt-2"
                        placeholder="ad esempio fidelity_promotion"
                      />
                    </div>

                    <div>
                      <FormLabel htmlFor="service-nome">Nome</FormLabel>
                      <FormInput
                        id="service-nome"
                        value={values.nome}
                        onChange={(event) => updateField("nome", event.target.value)}
                        className="mt-2"
                        placeholder="Nome visualizzato del servizio"
                      />
                    </div>

                    <div>
                      <FormLabel htmlFor="service-descrizione">Descrizione</FormLabel>
                      <FormTextarea
                        id="service-descrizione"
                        value={values.descrizione}
                        onChange={(event) => updateField("descrizione", event.target.value)}
                        className="mt-2 min-h-[120px]"
                        placeholder="Descrizione breve per la card del servizio"
                      />
                    </div>

                    <IconInput
                      label="Icona"
                      name="service-icona"
                      value={values.icona}
                      onChange={(nextValue) => updateField("icona", nextValue)}
                      helperText="Puoi usare un nome Lucide oppure caricare un'immagine che verrà salvata come data URI."
                    />
                  </div>
                </section>

                <section className="rounded-md border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5">
                    <div className="text-sm font-semibold text-slate-800">Configurazione variante</div>
                    <div className="mt-1 text-xs text-slate-500">Impostazioni di navigazione, priorità e stato operativo della variante.</div>
                  </div>

                  <div className="space-y-4">
                    {isInternalUrl ? (
                      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                        Per i servizi con tipo URL <strong>Interno</strong>, l'apertura è automatica sulla start page dell'utente.
                      </div>
                    ) : (
                      <div>
                        <FormLabel htmlFor="service-url">URL</FormLabel>
                        <FormInput
                          id="service-url"
                          value={values.url}
                          onChange={(event) => updateField("url", event.target.value)}
                          className="mt-2"
                          placeholder={values.tipo_url === "external_fico" ? "https://..." : "/gdo/dashboard oppure https://..."}
                        />
                      </div>
                    )}

                    <div>
                      <FormLabel htmlFor="service-redirect-page">Redirect page</FormLabel>
                      <FormInput
                        id="service-redirect-page"
                        value={values.redirect_page}
                        onChange={(event) => updateField("redirect_page", event.target.value)}
                        className="mt-2"
                        placeholder="/LoginController/oauth/landed"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Per Esterno FICO: pagina interna passata nel `context` dopo l’apertura dell’endpoint esterno.
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FormLabel htmlFor="service-tipo-url">Tipo URL</FormLabel>
                        <FormSelect
                          id="service-tipo-url"
                          value={values.tipo_url}
                          onChange={(event) => updateField("tipo_url", event.target.value as HubServiceDTO["tipo_url"])}
                          className="mt-2"
                        >
                          {SERVICE_TIPO_URL_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </FormSelect>
                      </div>

                      <div>
                        <FormLabel htmlFor="service-colore">Colore</FormLabel>
                        <FormSelect
                          id="service-colore"
                          value={values.colore}
                          onChange={(event) => updateField("colore", event.target.value as ServiceFormValues["colore"])}
                          className="mt-2"
                        >
                          {SERVICE_COLOR_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </FormSelect>
                      </div>
                    </div>

                    <div>
                      <FormLabel htmlFor="service-ordine">Ordine</FormLabel>
                      <FormInput
                        id="service-ordine"
                        type="number"
                        value={values.ordine}
                        min={0}
                        onChange={(event) => updateField("ordine", Number(event.target.value))}
                        className="mt-2"
                      />
                    </div>

                    <div className="grid gap-3 rounded-md border border-slate-200/80 bg-slate-50/80 p-4 md:grid-cols-2">
                      <FormSwitch>
                        <FormSwitch.Input
                          id="service-attivo"
                          type="checkbox"
                          checked={values.attivo}
                          onChange={(event) => updateField("attivo", event.target.checked)}
                        />
                        <FormSwitch.Label htmlFor="service-attivo">Attivo</FormSwitch.Label>
                      </FormSwitch>

                      <FormSwitch>
                        <FormSwitch.Input
                          id="service-manutenzione"
                          type="checkbox"
                          checked={values.in_manutenzione}
                          onChange={(event) => updateField("in_manutenzione", event.target.checked)}
                        />
                        <FormSwitch.Label htmlFor="service-manutenzione">In manutenzione</FormSwitch.Label>
                      </FormSwitch>

                      <FormSwitch>
                        <FormSwitch.Input
                          id="service-evidenza"
                          type="checkbox"
                          checked={values.in_evidenza}
                          onChange={(event) => updateField("in_evidenza", event.target.checked)}
                        />
                        <FormSwitch.Label htmlFor="service-evidenza">In evidenza</FormSwitch.Label>
                      </FormSwitch>
                    </div>

                  </div>
                </section>
              </div>

              <ServiceSharedAssetsEditor
                mode={mode}
                documents={values.documents}
                videos={values.videos}
                onDocumentsChange={(documents) => updateField("documents", documents)}
                onVideosChange={(videos) => updateField("videos", videos)}
              />

              <section className="space-y-4 rounded-md border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Target della variante</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Ogni tipo utente può essere abbinato a un ruolo specifico oppure lasciato senza ruolo.
                    Con un solo target viene usata la creazione singola; con più target viene usato il bulk.
                  </div>
                </div>
                {(() => {
                  const allSelectableKeys = targetOptions
                    .filter((o) => !disabledTargetKeys.has(o.key))
                    .map((o) => o.key);
                  const allSelected =
                    allSelectableKeys.length > 0 &&
                    allSelectableKeys.every((k) => selectedTargetKeys.includes(k));
                  return (
                    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-4 py-3">
                      <div className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{selectedTargetKeys.length}</span>
                        {" "}target selezionati su {allSelectableKeys.length} disponibili
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          allSelected
                            ? setSelectedTargetKeys([])
                            : setSelectedTargetKeys(allSelectableKeys)
                        }
                        disabled={allSelectableKeys.length === 0}
                        className="text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {allSelected ? "Deseleziona tutti" : "Seleziona tutti"}
                      </button>
                    </div>
                  );
                })()}
                {targetsByType.map(([tipoUtente, options]) =>
                  renderTargetSection(tipoUtente, options)
                )}
              </section>
            </div>
          </Dialog.Description>

          <Dialog.Footer className="flex flex-col-reverse gap-3 bg-white sm:flex-row sm:justify-end">
            <Button
              variant="outline-secondary"
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Annulla
            </Button>
            <Button variant="primary" type="submit" loading={submitting} className="w-full sm:w-auto">
              {mode === "edit-group" ? "Salva gruppo" : "Salva servizio"}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
};

export default ServiceFormDialog;
