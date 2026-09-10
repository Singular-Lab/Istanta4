import Button from "@/components/Base/Button";
import { ClassicEditor } from "@/components/Base/Ckeditor";
import { FormCheck, FormInput, FormLabel, FormSelect, FormSwitch } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useEffect, useMemo, useState } from "react";
import type { HubNewsAdminDTO } from "../../../../lib/types";
import type { NewsDialogMode, NewsFormValues } from "../types";
import { getInitialNewsFormValues, NEWS_TYPE_OPTIONS } from "../utils";
import IconInput from "./IconInput";

interface NewsFormDialogProps {
  open: boolean;
  mode: NewsDialogMode;
  news?: HubNewsAdminDTO;
  recipientOptions: Array<{ value: string; label: string }>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: NewsFormValues) => Promise<void> | void;
}

const DIALOG_TITLES: Record<NewsDialogMode, string> = {
  create: "Nuova news",
  edit: "Modifica news",
};

const stripMarkup = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const NewsFormDialog = ({
  open,
  mode,
  news,
  recipientOptions,
  submitting = false,
  onClose,
  onSubmit,
}: NewsFormDialogProps) => {
  const [values, setValues] = useState<NewsFormValues>(getInitialNewsFormValues(news));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(getInitialNewsFormValues(news));
    setErrorMessage(null);
  }, [open, news]);

  const roleGroups = useMemo(() => {
    return {
      base: recipientOptions.filter((option) => !option.value.startsWith("GDO_")),
      gdoSpecific: recipientOptions.filter((option) => option.value.startsWith("GDO_")),
    };
  }, [recipientOptions]);

  const updateField = <K extends keyof NewsFormValues>(field: K, value: NewsFormValues[K]) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleRecipient = (value: string) => {
    setValues((current) => ({
      ...current,
      ruoli_destinatari: current.ruoli_destinatari.includes(value)
        ? current.ruoli_destinatari.filter((item) => item !== value)
        : [...current.ruoli_destinatari, value],
    }));
  };

  const validate = () => {
    if (!values.titolo.trim()) return "Il titolo è obbligatorio.";
    if (!stripMarkup(values.contenuto)) return "Il contenuto della news è obbligatorio.";
    if (!values.data_pubblicazione) return "La data di pubblicazione è obbligatoria.";

    if (values.data_scadenza) {
      const publication = new Date(values.data_pubblicazione);
      const expiration = new Date(values.data_scadenza);
      if (expiration.getTime() <= publication.getTime()) {
        return "La data di scadenza deve essere successiva alla pubblicazione.";
      }
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
      ...values,
      titolo: values.titolo.trim(),
      contenuto: values.contenuto,
      icona: values.icona.trim() || "Info",
      url: values.url.trim(),
      autore_nome: values.autore_nome.trim(),
    });
  };

  const renderRecipients = (title: string, options: Array<{ value: string; label: string }>) => {
    if (options.length === 0) return null;

    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-800">{title}</div>
            <div className="mt-1 text-xs text-slate-500">La news sarà visibile solo ai destinatari selezionati.</div>
          </div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{options.length} ruoli</div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {options.map((option) => {
            const checked = values.ruoli_destinatari.includes(option.value);

            return (
              <FormCheck
                key={option.value}
                className={`items-start gap-3 rounded-xl border px-3 py-3 transition ${checked ? "border-primary/40 bg-primary/5" : "border-slate-200"}`}
              >
                <FormCheck.Input
                  type="checkbox"
                  checked={checked}
                  className="mt-0.5 shrink-0"
                  onChange={() => toggleRecipient(option.value)}
                />
                <FormCheck.Label className="ml-0 flex-1 text-sm font-medium text-slate-700">
                  {option.label}
                </FormCheck.Label>
              </FormCheck>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} size="xl">
      <Dialog.Panel className="overflow-hidden lg:w-[980px] xl:w-[1080px]">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-8rem)] flex-col">
          <Dialog.Title className="gap-3 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Lucide icon={mode === "edit" ? "PencilLine" : "Newspaper"} className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-slate-800">{DIALOG_TITLES[mode]}</div>
                <div className="text-sm font-normal text-slate-500">Archivio news e aggiornamenti Hub</div>
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

              <div className="grid gap-5 xl:grid-cols-2">
                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5">
                    <div className="text-sm font-semibold text-slate-800">Informazioni principali</div>
                    <div className="mt-1 text-xs text-slate-500">Titolo, categorizzazione e identità visiva della news.</div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <FormLabel htmlFor="news-titolo">Titolo</FormLabel>
                      <FormInput
                        id="news-titolo"
                        value={values.titolo}
                        onChange={(event) => updateField("titolo", event.target.value)}
                        className="mt-2"
                        placeholder="Titolo della news"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FormLabel htmlFor="news-tipo">Tipo</FormLabel>
                        <FormSelect
                          id="news-tipo"
                          value={values.tipo}
                          onChange={(event) => updateField("tipo", event.target.value as HubNewsAdminDTO["tipo"])}
                          className="mt-2"
                        >
                          {NEWS_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </FormSelect>
                      </div>

                      <div>
                        <FormLabel htmlFor="news-autore">Autore</FormLabel>
                        <FormInput
                          id="news-autore"
                          value={values.autore_nome}
                          onChange={(event) => updateField("autore_nome", event.target.value)}
                          className="mt-2"
                          placeholder="Nome autore"
                        />
                      </div>
                    </div>

                    <IconInput
                      label="Icona"
                      name="news-icona"
                      value={values.icona}
                      onChange={(nextValue) => updateField("icona", nextValue)}
                      helperText="Puoi usare un nome Lucide oppure un'immagine caricata."
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5">
                    <div className="text-sm font-semibold text-slate-800">Pubblicazione</div>
                    <div className="mt-1 text-xs text-slate-500">Stato, visibilità temporale e link di approfondimento.</div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <FormLabel htmlFor="news-url">URL di approfondimento</FormLabel>
                      <FormInput
                        id="news-url"
                        value={values.url}
                        onChange={(event) => updateField("url", event.target.value)}
                        className="mt-2"
                        placeholder="https://..."
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FormLabel htmlFor="news-data-pubblicazione">Pubblicazione</FormLabel>
                        <FormInput
                          id="news-data-pubblicazione"
                          type="datetime-local"
                          value={values.data_pubblicazione}
                          onChange={(event) => updateField("data_pubblicazione", event.target.value)}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <FormLabel htmlFor="news-data-scadenza">Scadenza</FormLabel>
                        <FormInput
                          id="news-data-scadenza"
                          type="datetime-local"
                          value={values.data_scadenza}
                          onChange={(event) => updateField("data_scadenza", event.target.value)}
                          className="mt-2"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 md:grid-cols-2">
                      <FormSwitch>
                        <FormSwitch.Input
                          id="news-attiva"
                          type="checkbox"
                          checked={values.attivo}
                          onChange={(event) => updateField("attivo", event.target.checked)}
                        />
                        <FormSwitch.Label htmlFor="news-attiva">Attiva</FormSwitch.Label>
                      </FormSwitch>

                      <FormSwitch>
                        <FormSwitch.Input
                          id="news-evidenza"
                          type="checkbox"
                          checked={values.in_evidenza}
                          onChange={(event) => updateField("in_evidenza", event.target.checked)}
                        />
                        <FormSwitch.Label htmlFor="news-evidenza">In evidenza</FormSwitch.Label>
                      </FormSwitch>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Se non selezioni destinatari, la news sarà visibile a tutti gli utenti Hub compatibili con la pubblicazione.
                    </div>
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-5">
                  <FormLabel htmlFor="news-contenuto" className="text-sm font-semibold text-slate-800">
                    Contenuto
                  </FormLabel>
                  <div className="mt-1 text-xs text-slate-500">Usa l’editor rich text per il testo mostrato nelle card pubbliche del Hub.</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-3 [&_.ck-editor__editable_inline]:min-h-[260px]">
                  <ClassicEditor
                    value={values.contenuto}
                    onChange={(nextValue) => updateField("contenuto", nextValue)}
                    placeholder="Scrivi il contenuto della news..."
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Destinatari</div>
                  <div className="mt-1 text-xs text-slate-500">Seleziona i ruoli che devono vedere la news nell’Hub pubblico.</div>
                </div>
                {renderRecipients("Tipi utente base", roleGroups.base)}
                {renderRecipients("Ruoli GDO specifici", roleGroups.gdoSpecific)}
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
              {mode === "edit" ? "Salva news" : "Crea news"}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
};

export default NewsFormDialog;
