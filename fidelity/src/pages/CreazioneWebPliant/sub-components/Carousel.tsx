import Button from "@/components/Base/Button";
import { ClassicEditor } from "@/components/Base/Ckeditor";
import Dropzone from "@/components/Base/Dropzone";
import {
  FormCheck,
  FormInline,
  FormInput,
  FormLabel,
  FormSelect,
  InputGroup
} from "@/components/Base/Form";
import { Disclosure } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useDebounce, useDebouncedState } from "@/hooks/useDebounce";
import { useFetchConfig, useFetchFieldOptions, useGetCampiDaRaggruppamento } from "@/query/query";
import { AnimatePresence, motion } from "framer-motion";
import { icons } from "lucide-react";
import React, { Fragment, useEffect, useState } from "react";
import { AttributiCaroselloWebpliant, FilterConditionContesto, ForcedStyles, Logo, operatorOptions, PaginaWebPliant } from "../../../../lib/types";

type IconName = keyof typeof icons;

// --- Helper Components ---

/**
 * Sezione di impostazioni con animazioni e design migliorato
 */
const SettingsSection: React.FC<{
  title: string;
  icon: IconName;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}> = ({ title, icon, children, collapsible = false, defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-darkmode-700 rounded-xl border border-slate-200 dark:border-darkmode-500 shadow-sm hover:shadow-md transition-all duration-200"
    >
      <div
        className={`flex items-center justify-between p-4 ${collapsible ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-darkmode-600' : ''} rounded-t-xl`}
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-primary/10 to-theme-2/10 rounded-lg flex items-center justify-center">
            <Lucide icon={icon} className="w-4 h-4 text-primary" />
          </div>
          <h4 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h4>
        </div>
        {collapsible && (
          <Lucide
            icon={isExpanded ? "ChevronUp" : "ChevronDown"}
            className="w-4 h-4 text-slate-500 transition-transform duration-200"
          />
        )}
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 pt-0 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * Form field con label e helper text migliorato
 */
const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
  helperText?: string;
  required?: boolean;
}> = ({ label, children, helperText, required = false }) => (
  <div className="space-y-2">
    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </FormLabel>
    {children}
    {helperText && (
      <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
    )}
  </div>
);

/**
 * Area di upload migliorata con Dropzone
 */
const FileUploadArea: React.FC<{
  onFileSelect: (file: File) => void;
  title: string;
  allowedTypes?: string;
  description?: string;
  maxSize?: string;
}> = ({ onFileSelect, title, allowedTypes = "image/*", description, maxSize = "10MB" }) => {
  const dropzoneRef = React.useRef<any>(null);

  const getMaxFileSizeInMB = (sizeStr: string) => {
    const num = parseInt(sizeStr);
    return num; // Dropzone expects MB
  };

  const getAcceptedFiles = (types: string) => {
    if (types === "image/*") return "image/*";
    if (types === "video/*") return "video/*";
    return types;
  };

  const dropzoneOptions = {
    url: "#", // Dummy URL since we handle files manually
    maxFiles: 1,
    maxFilesize: getMaxFileSizeInMB(maxSize || "10MB"),
    acceptedFiles: getAcceptedFiles(allowedTypes || "image/*"),
    addRemoveLinks: false,
    dictDefaultMessage: "",
    autoProcessQueue: false,
    init(this: any) {
      this.on("addedfile", (file: File) => {
        onFileSelect(file);
        this.removeAllFiles(); // Remove the file from dropzone UI after handling
      });
    },
  };

  return (
    <Dropzone
      options={dropzoneOptions}
      getRef={(el) => { dropzoneRef.current = el; }}
      className="rounded-xl p-6 text-center transition-all duration-300 hover:border-primary/60 hover:bg-primary/5 dark:hover:bg-primary/10"
    >
      <div className="relative z-10">
        <div className="w-12 h-12 bg-gradient-to-r from-primary/10 to-theme-2/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Lucide icon="Upload" className="w-6 h-6 text-primary" />
        </div>
        <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">{title}</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {description || "Trascina qui il file o clicca per selezionare"}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Max: {maxSize}</p>
      </div>
    </Dropzone>
  );
};

interface CarouselContentProps {
  content: AttributiCaroselloWebpliant
  updateContent: (content: CarouselContentProps["content"]) => void;
  pagine: PaginaWebPliant[]
}




const CarouselContent: React.FC<CarouselContentProps> = ({
  content,
  updateContent,
  pagine,
}) => {
  // Usa il nostro hook personalizzato per gestire lo stato con debouncing
  const [localContent, setLocalContent, forceSync] = useDebouncedState(
    content,
    updateContent,
    400 // 400ms di delay per il carousel
  );

  const [dateValidita, setDateValidita] = useState<"nessuna" | "valida_al" | "valido_da" | "valido_dal_al" | "auto">("nessuna");
  const [backgroundType, setBackgroundType] = useState<"color" | "image">("image");

  const params = new URLSearchParams(window.location.search);
  const idWorkspace = params.get("id");


  useEffect(() => {
    if (localContent?.backgroundColor) {
      setBackgroundType("color");
    } else if (localContent?.backgroundImage) {
      setBackgroundType("image");
    }
  }, [localContent?.backgroundColor, localContent?.backgroundImage]);

  const stiliDisponibili = useFetchConfig()

  const memoizedStiliDisponibili = React.useMemo(() => stiliDisponibili.data, [stiliDisponibili.data]);

  const fieldOptionsData = useFetchFieldOptions();

  const campiSceltiRaggruppamento = useGetCampiDaRaggruppamento(localContent?.options?.carouselTypeField || "", idWorkspace || "")

  const memoizedCampiSceltiRaggruppamento = React.useMemo(() => campiSceltiRaggruppamento, [campiSceltiRaggruppamento]);

  const memoizedFieldOptionsData = React.useMemo(() => fieldOptionsData, [fieldOptionsData]);

  const handleChange = (key: string, value: any) => {
    setLocalContent((prevContent: any) => ({
      ...prevContent,
      [key]: value,
    }));
  };

  // Funzione specifica per i colori con debouncing più veloce
  const debouncedColorUpdate = useDebounce(
    (key: string, value: any) => {
      setLocalContent((prevContent: any) => ({
        ...prevContent,
        [key]: value,
      }));
    },
    150 // 150ms per i colori
  );

  const handleColorChange = (key: string, value: any) => {
    debouncedColorUpdate(key, value);
  };

  const resetOptionForcedStyles = (index: number) => {
    const updatedForcedStyles = [...(localContent?.options?.forcedStyles || [])];
    updatedForcedStyles[index] = {
      campi: [],
      backgroundColor: "",
      margin: "",
      padding: "",
      border: "",
      borderRadius: "",
      width: "",
      height: "",
      textAlign: "",
      color: "",
    };
    handleChange("options", {
      ...localContent?.options,
      forcedStyles: updatedForcedStyles,
    });
  }

  const handleLogoChange = (key: keyof Logo, value: string) => {
    setLocalContent((prevContent) => ({
      ...prevContent,
      logo: { ...prevContent.logo, [key]: value } as Logo,
    }));
  };

  const addFilter = () => {
    const newFilters = [
      ...(localContent?.filters || []),
      { field: "", operator: "", value: "" },
    ];
    handleChange("filters", newFilters);
  };

  const addFilterNew = () => {
    const newFilters = [
      ...(localContent?.filtersNew || []),
      [{ field: "", operator: "", value: "" }],
    ];
    handleChange("filtersNew", newFilters);
  };

  const addFiltroContesto = () => {
    const newFilters = [
      ...(localContent?.filtriContesto || []),
      { nome_field: "", operator: "", user_value: "" },
    ];
    handleChange("filtriContesto", newFilters);
  };
  const removeFilter = (index: number) => {
    const newFilters = (localContent?.filters || []).filter(
      (_: any, i: number) => i !== index
    );
    handleChange("filters", newFilters);
  };
  const removeFiltroContesto = (index: number) => {
    const newFilters = (localContent?.filtriContesto || []).filter(
      (_: any, i: number) => i !== index
    );
    handleChange("filtriContesto", newFilters);
  }

  const updateFilter = (index: number, key: string, value: string) => {
    const filters = localContent?.filters || [];
    const updatedFilters = filters.map((filter: any, i: number) =>
      i === index ? { ...filter, [key]: value } : filter
    );
    handleChange("filters", updatedFilters);
  };

  const updateFiltriContesto = (index: number, key: string, value: string) => {
    const filtriContesto = localContent?.filtriContesto || [];
    const updatedFiltriContesto = filtriContesto.map((filter: any, i: number) =>
      i === index ? { ...filter, [key]: value } : filter
    );
    handleChange("filtriContesto", updatedFiltriContesto);
  }




  function updateForcedStyles(stile_scelto: string, value: string, index: number): void {
    const updatedForcedStyles = [...(localContent?.options?.forcedStyles || [])];
    updatedForcedStyles[index] = {
      ...updatedForcedStyles[index],
      [stile_scelto]: value,
    };

    // Usa debouncing specifico per i colori
    if (stile_scelto.toLowerCase().includes('color')) {
      handleColorChange("options", {
        ...localContent?.options,
        forcedStyles: updatedForcedStyles,
      });
    } else {
      handleChange("options", {
        ...localContent?.options,
        forcedStyles: updatedForcedStyles,
      });
    }
  }



  function addForcedStyles(index: number): void {
    console.log(localContent?.options?.forcedStyles ?? []);
    if (!localContent?.options?.forcedStyles) {
      handleChange("options", {
        ...localContent?.options,
        forcedStyles: [{
          campi: [],
          backgroundColor: "",
          margin: "",
          padding: "",
          border: "",
          borderRadius: "",
          width: "",
          height: "",
          textAlign: "",
          color: "",
        }]
      });
    }
    const updatedForcedStyles = [...localContent?.options?.forcedStyles ?? []];
    updatedForcedStyles[index] = {
      campi: [],
      backgroundColor: "",
      margin: "",
      padding: "",
      border: "",
      borderRadius: "",
      width: "",
      height: "",
      textAlign: "",
      color: "",
    };
    handleChange("options", {
      ...localContent?.options,
      forcedStyles: updatedForcedStyles,
    });

  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 rounded-xl"
    >
      {/* Header */}

      {/* Tipo Carosello */}
      <SettingsSection title="Tipo di Carosello" icon="Settings">
        <FormField
          label="Modalità di visualizzazione"
          helperText="Scegli come devono essere organizzati gli elementi"
          required
        >
          <FormSelect
            value={localContent?.options?.carouselType || ""}
            onChange={(e) => handleChange("options", {
              ...localContent?.options,
              carouselType: e.target.value,
            })}
            className="w-full"
          >
            <option value="">Seleziona Tipo</option>
            <option value="normal">Normale</option>
            <option value="groupedby">Raggruppato per proprietà</option>
          </FormSelect>
        </FormField>
      </SettingsSection>

      {/* Pulsante Mostra Tutto */}
      <SettingsSection title="Pulsante Mostra Tutto" icon="ExternalLink">
        <div className="space-y-4">
          <FormCheck className="flex items-start space-x-3">
            <FormCheck.Input
              type="checkbox"
              checked={localContent?.pulsante_mostra_tutto?.active || false}
              onChange={(e) => handleChange("pulsante_mostra_tutto", {
                ...localContent?.pulsante_mostra_tutto,
                active: e.target.checked,
              })}
              className="mt-1"
            />
            <div>
              <FormCheck.Label className="font-medium text-slate-700 dark:text-slate-300">
                Abilita "Mostra tutto" nel carosello
              </FormCheck.Label>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Aggiunge un pulsante per visualizzare tutti gli elementi in una pagina dedicata
              </p>
            </div>
          </FormCheck>

          <AnimatePresence>
            {localContent?.pulsante_mostra_tutto?.active && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 p-4 bg-slate-50 dark:bg-darkmode-600 rounded-lg border border-slate-200 dark:border-darkmode-500"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Testo del Pulsante" helperText="Es. Vedi tutti i prodotti">
                    <FormInput
                      type="text"
                      value={localContent?.pulsante_mostra_tutto?.label || ""}
                      onChange={(e) => handleChange("pulsante_mostra_tutto", {
                        ...localContent?.pulsante_mostra_tutto,
                        label: e.target.value,
                      })}
                      placeholder="Mostra tutto"
                      className="w-full"
                    />
                  </FormField>

                  <FormField label="Pagina di Destinazione" helperText="Dove reindirizzare l'utente">
                    <FormSelect
                      value={localContent?.pulsante_mostra_tutto?.idPaginaCollegata || ""}
                      onChange={(e) => handleChange("pulsante_mostra_tutto", {
                        ...localContent?.pulsante_mostra_tutto,
                        idPaginaCollegata: e.target.value,
                      })}
                      className="w-full"
                    >
                      <option value="">Seleziona Pagina</option>
                      {pagine?.map((option, i) => (
                        <option key={i} value={option.id}>
                          {option.nome}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SettingsSection>

      {/* Contenuto Testuale */}
      <SettingsSection title="Contenuto Testuale" icon="FileText">
        <div className="space-y-4 mx-4  ">
          <FormField
            label="Titolo del Carosello"
            helperText="Titolo principale visualizzato sopra il carosello"
          >
            <ClassicEditor
              key={`title-${localContent?.id}`}
              value={localContent?.title || ""}
              onChange={(value) => handleChange("title", value)}
            />
          </FormField>

          <FormField
            label="Sottotitolo"
            helperText="Testo descrittivo opzionale sotto il titolo"
          >
            <ClassicEditor
              key={`subtitle-${localContent?.id}`}
              value={localContent?.subtitle || ""}
              onChange={(value) => handleChange("subtitle", value)}
            />
          </FormField>

          <FormCheck className="flex items-start space-x-3">
            <FormCheck.Input
              type="checkbox"
              checked={localContent?.inVisibilita || false}
              onChange={(e) => handleChange("inVisibilita", e.target.checked)}
              className="mt-1"
            />
            <div>
              <FormCheck.Label className="font-medium text-slate-700 dark:text-slate-300">
                Mostra solo offerte valide al momento
              </FormCheck.Label>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Filtra automaticamente i contenuti in base alla data di validità
              </p>
            </div>
          </FormCheck>
        </div>
      </SettingsSection>
      {/* Date di Validità */}
      <SettingsSection title="Date di Validità" icon="Calendar">
        <div className="space-y-6">
          <FormField
            label="Modalità di Gestione Date"
            helperText="Definisci come devono essere gestite le date di validità degli elementi"
          >
            <div className="space-y-3">
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="p-3 border-2 border-slate-200 dark:border-darkmode-500 rounded-lg hover:border-primary/50 transition-colors">
                  <FormCheck className="flex items-start space-x-3">
                    <FormCheck.Input
                      type="radio"
                      name="validita_type"
                      checked={((localContent?.options?.validita?.validitaDal == false && localContent?.options?.validita?.validitaAl == false && localContent?.options?.validita?.auto == false) || false)}
                      onChange={() => {
                        setDateValidita("nessuna");
                        handleChange("options", {
                          ...localContent?.options,
                          validita: { auto: false, validitaDal: false, validitaAl: false }
                        });
                      }}
                      className="mt-1"
                    />
                    <div>
                      <FormCheck.Label className="font-medium text-slate-700 dark:text-slate-300">
                        Nessuna gestione
                      </FormCheck.Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Non applicare filtri di data</p>
                    </div>
                  </FormCheck>
                </div>

                <div className="p-3 border-2 border-slate-200 dark:border-darkmode-500 rounded-lg hover:border-primary/50 transition-colors">
                  <FormCheck className="flex items-start space-x-3">
                    <FormCheck.Input
                      type="radio"
                      name="validita_type"
                      checked={(localContent?.options?.validita?.validitaAl == true && localContent?.options?.validita?.validitaDal == false && localContent?.options?.validita?.auto == false) || false}
                      onChange={() => {
                        setDateValidita("valida_al");
                        handleChange("options", {
                          ...localContent?.options,
                          validita: { auto: false, validitaDal: false, validitaAl: true }
                        });
                      }}
                      className="mt-1"
                    />
                    <div>
                      <FormCheck.Label className="font-medium text-slate-700 dark:text-slate-300">
                        Validi fino al
                      </FormCheck.Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Mostra solo fino a una data</p>
                    </div>
                  </FormCheck>
                </div>

                <div className="p-3 border-2 border-slate-200 dark:border-darkmode-500 rounded-lg hover:border-primary/50 transition-colors">
                  <FormCheck className="flex items-start space-x-3">
                    <FormCheck.Input
                      type="radio"
                      name="validita_type"
                      checked={(localContent?.options?.validita?.validitaDal == true && localContent?.options?.validita?.validitaAl == false && localContent?.options?.validita?.auto == false) || false}
                      onChange={() => {
                        setDateValidita("valido_da");
                        handleChange("options", {
                          ...localContent?.options,
                          validita: { auto: false, validitaDal: true, validitaAl: false }
                        });
                      }}
                      className="mt-1"
                    />
                    <div>
                      <FormCheck.Label className="font-medium text-slate-700 dark:text-slate-300">
                        Validi a partire da
                      </FormCheck.Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Mostra solo da una data</p>
                    </div>
                  </FormCheck>
                </div>

                <div className="p-3 border-2 border-slate-200 dark:border-darkmode-500 rounded-lg hover:border-primary/50 transition-colors">
                  <FormCheck className="flex items-start space-x-3">
                    <FormCheck.Input
                      type="radio"
                      name="validita_type"
                      checked={(localContent?.options?.validita?.validitaDal == true && localContent?.options?.validita?.validitaAl == true && localContent?.options?.validita?.auto == false) || false}
                      onChange={() => {
                        setDateValidita("valido_dal_al");
                        handleChange("options", {
                          ...localContent?.options,
                          validita: { auto: false, validitaDal: true, validitaAl: true }
                        });
                      }}
                      className="mt-1"
                    />
                    <div>
                      <FormCheck.Label className="font-medium text-slate-700 dark:text-slate-300">
                        Valido dal/al
                      </FormCheck.Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Range di date specifico</p>
                    </div>
                  </FormCheck>
                </div>
              </motion.div>

              <div className="p-3 border-2 border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <FormCheck className="flex items-start space-x-3">
                  <FormCheck.Input
                    type="radio"
                    name="validita_type"
                    checked={(localContent?.options?.validita?.validitaDal == false && localContent?.options?.validita?.validitaAl == false && localContent?.options?.validita?.auto == true) || false}
                    onChange={() => {
                      setDateValidita("auto");
                      handleChange("options", {
                        ...localContent?.options,
                        validita: { auto: true, validitaDal: false, validitaAl: false }
                      });
                    }}
                    className="mt-1"
                  />
                  <div>
                    <FormCheck.Label className="font-medium text-slate-700 dark:text-slate-300 flex items-center">
                      <Lucide icon="Zap" className="w-4 h-4 mr-2 text-amber-500" />
                      Automatico
                    </FormCheck.Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Gestione automatica delle date basata sui dati</p>
                  </div>
                </FormCheck>
              </div>
            </div>
          </FormField>

          <div className="pt-4 border-t border-slate-200 dark:border-darkmode-500">
            <FormField
              label="Colore Testo Validità"
              helperText="Colore del testo delle date di validità"
            >
              <div className="flex items-center space-x-3">
                <FormInput
                  type="color"
                  value={localContent?.options?.validita?.color || "#ffffff"}
                  onChange={(e) => handleColorChange("options", {
                    ...localContent?.options,
                    validita: {
                      ...localContent?.options?.validita,
                      color: e.target.value,
                    }
                  })}
                  className="w-16 h-10 rounded-lg border border-slate-300 dark:border-darkmode-500"
                />
                <FormInput
                  type="text"
                  value={localContent?.options?.validita?.color || "#ffffff"}
                  onChange={(e) => handleColorChange("options", {
                    ...localContent?.options,
                    validita: {
                      ...localContent?.options?.validita,
                      color: e.target.value,
                    }
                  })}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </FormField>
          </div>
        </div>
      </SettingsSection>
      {/* Raggruppamento per Proprietà */}
      <AnimatePresence>
        {localContent?.options?.carouselType === "groupedby" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SettingsSection title="Raggruppamento per Proprietà" icon="LayoutGrid">
              <FormField
                label="Campo di Raggruppamento"
                helperText="Seleziona il campo da utilizzare per raggruppare gli elementi"
                required
              >
                <FormSelect
                  value={localContent?.options?.carouselTypeField || ""}
                  onChange={(e) => handleChange("options", {
                    ...localContent?.options,
                    carouselTypeField: e.target.value,
                  })}
                  className="w-full"
                >
                  <option value="">Seleziona Campo</option>
                  {memoizedFieldOptionsData?.data?.map((option, i) => (
                    <option key={i} value={option.expected_input}>
                      {option.expected_output != "" ? option.expected_output : option.expected_input}
                    </option>
                  ))}
                </FormSelect>
              </FormField>

              {localContent?.options?.carouselTypeField && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <Lucide icon="Info" className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Informazioni Raggruppamento</span>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Gli elementi saranno automaticamente raggruppati in base al valore del campo "{localContent.options.carouselTypeField}".
                  </p>
                </motion.div>
              )}
            </SettingsSection>
          </motion.div>
        )}
      </AnimatePresence>

      {/*<div className="m-4 flex flex-col justify-between cursor-pointer font-semibold">
                <FormLabel formLabelSize="sm" htmlFor="filters">Filtri</FormLabel>
                {(localContent?.filters || []).map((filter: FilterCondition, index: number) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                        <FormSelect
                            formSelectSize="sm"
                            value={filter.field}
                            onChange={(e) => updateFilter(index, "field", e.target.value)}
                            className="w-1/3"
                        >
                            <option value="">Seleziona Campo</option>
                            {memoizedFieldOptionsData?.data?.map((option, i) => (
                                <option key={i} value={option.expected_input}>
                                    {option.expected_output != "" ? option.expected_output : option.expected_input}
                                </option>
                            ))}
                        </FormSelect>
                        <FormSelect
                            formSelectSize="sm"
                            value={filter.operator}
                            onChange={(e) => updateFilter(index, "operator", e.target.value)}
                            className="w-1/4"
                        >
                            <option value="">Operatore</option>
                            {operatorOptions.map((option, i) => (
                                <option key={i} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </FormSelect>
                        <FormInput
                            formInputSize="sm"
                            type="text"
                            value={filter.value}
                            onChange={(e) => updateFilter(index, "value", e.target.value)}
                            placeholder="Valore"
                            className="w-1/3" />
                        <Button
                            onClick={() => removeFilter(index)}
                            className=""
                            variant="danger"
                            size="xs"
                        >
                            <Lucide icon="Trash2" className="w-5 h-5" />
                        </Button>
                    </div>
                ))}
                <Button variant="primary" size="xs" onClick={addFilter}>
                    Aggiungi Filtro
                </Button>
            </div>*/}

      <hr className="my-4 border-primary opacity-30" />
      <div className="m-4 cursor-pointer font-semibold flex flex-col">
        <FormLabel formLabelSize="sm" htmlFor="filters">Filtri</FormLabel>
        {(localContent?.filtersNew && localContent?.filtersNew.length > 0) && (
          <div className="space-y-6">
            {localContent?.filtersNew.map((filterGroup, groupIndex) => (
              <Fragment key={groupIndex}>
                <div className="p-4 border rounded-md shadow-sm">
                  <h4 className="font-bold mb-4">Gruppo Filtri {groupIndex + 1}</h4>
                  <div className="space-y-3">
                    {filterGroup?.map((filter, filterIndex) => (
                      <div key={filterIndex} className="flex flex-col items-center space-x-2">
                        <FormInline className="gap-2">

                          <FormSelect
                            formSelectSize="sm"
                            value={filter.field}
                            onChange={(e) => {
                              const updatedFiltersNew = [...(localContent?.filtersNew || [])];
                              updatedFiltersNew[groupIndex][filterIndex] = {
                                ...filter,
                                field: e.target.value,
                              };
                              handleChange("filtersNew", updatedFiltersNew);
                            }}
                            className="w-1/3"
                          >
                            <option value="">Seleziona Campo</option>
                            {memoizedFieldOptionsData?.data?.map((option, i) => (
                              <option key={i} value={option.expected_input}>
                                {option.expected_output != "" ? option.expected_output : option.expected_input}
                              </option>
                            ))}
                          </FormSelect>
                          <FormSelect
                            formSelectSize="sm"
                            value={filter.operator}
                            onChange={(e) => {
                              const updatedFiltersNew = [...(localContent?.filtersNew || [])];
                              updatedFiltersNew[groupIndex][filterIndex] = {
                                ...filter,
                                operator: e.target.value,
                              };
                              handleChange("filtersNew", updatedFiltersNew);
                            }}
                            className="w-1/4"
                          >
                            <option value="">Operatore</option>
                            {operatorOptions.map((option, i) => (
                              <option key={i} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </FormSelect>
                          <FormInput
                            formInputSize="sm"
                            type="text"
                            value={filter.value}
                            onChange={(e) => {
                              const updatedFiltersNew = [...(localContent?.filtersNew || [])];
                              updatedFiltersNew[groupIndex][filterIndex] = {
                                ...filter,
                                value: e.target.value,
                              };
                              handleChange("filtersNew", updatedFiltersNew);
                            }}
                            placeholder="Valore"
                            className="w-1/3"
                          />
                          <Button
                            onClick={() => {
                              const updatedFiltersNew = [...(localContent?.filtersNew || [])];
                              updatedFiltersNew[groupIndex] = updatedFiltersNew[groupIndex].filter(
                                (_, i) => i !== filterIndex
                              );
                              handleChange("filtersNew", updatedFiltersNew);
                            }}
                            variant="danger"
                            size="xs"
                          >
                            <Lucide icon="Trash2" className="w-5 h-5" />
                          </Button>
                        </FormInline>
                        {filterIndex < filterGroup.length - 1 && (
                          <span className="font-bold text-gray-500 mt-2">AND</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <Button
                      onClick={() => {
                        const updatedFiltersNew = [...(localContent?.filtersNew ?? [])];
                        updatedFiltersNew[groupIndex].push({
                          field: "",
                          operator: "",
                          value: "",
                        });
                        handleChange("filtersNew", updatedFiltersNew);
                      }}
                      variant="primary"
                      size="xs"
                    >
                      Aggiungi Filtro al Gruppo
                    </Button>
                    <Button
                      onClick={() => {
                        const updatedFiltersNew = (localContent?.filtersNew ?? []).filter(
                          (_, i) => i !== groupIndex
                        );
                        handleChange("filtersNew", updatedFiltersNew);
                      }}
                      variant="danger"
                      size="xs"
                    >
                      Rimuovi Gruppo
                    </Button>
                  </div>
                </div>
                {groupIndex < (localContent?.filtersNew ?? []).length - 1 && (
                  <div className="text-center font-bold text-gray-500 mt-4">OR</div>
                )}
              </Fragment>
            ))}
          </div>
        )}
        <Button
          className="mt-4"
          onClick={() => {
            const updatedFiltersNew = [
              ...(localContent?.filtersNew || []),
              [{ field: "", operator: "", value: "" }],
            ];
            handleChange("filtersNew", updatedFiltersNew);
          }}
          variant="primary"
          size="xs"
        >
          Aggiungi Gruppo Filtri
        </Button>
      </div>

      <hr className="my-4 border-primary opacity-30" />

      <div className="m-4 flex flex-col justify-between cursor-pointer font-semibold">
        <FormLabel className={localContent?.filtroContesto ? "" : "mr-2"} formLabelSize="sm" htmlFor="filters">Filtri contesto</FormLabel>
        {(localContent?.filtriContesto || []).map((filter: FilterConditionContesto, index: number) => (
          <div key={index} className="flex items-center space-x-2 mb-2">
            <FormInput
              formInputSize="sm"
              value={filter.nome_field}
              onChange={(e) => updateFiltriContesto(index, "nome_field", e.target.value)}
              className="w-1/3"
            />
            <FormSelect
              formSelectSize="sm"
              value={filter.operator}
              onChange={(e) => updateFiltriContesto(index, "operator", e.target.value)}
              className="w-1/4"
            >
              <option value="">Operatore</option>
              {operatorOptions.map((option, i) => (
                <option key={i} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FormSelect>
            <FormInput
              formInputSize="sm"
              type="text"
              value={filter.user_value}
              onChange={(e) => updateFiltriContesto(index, "user_value", e.target.value)}
              placeholder="Valore"
              className="w-1/3" />
            <Button
              onClick={() => removeFiltroContesto(index)}
              className=""
              variant="danger"
              size="xs"
            >
              <Lucide icon="Trash2" className="w-5 h-5" />
            </Button>
          </div>
        ))}
        <Button className={localContent?.filtroContesto ? "ml-2" : ""} variant="primary" size="xs" onClick={addFiltroContesto}>
          Aggiungi Filtro di contesto
        </Button>
      </div>
      <hr className="my-4 border-primary opacity-30" />
      <div className="m-4 cursor-pointer font-semibold">

        <FormLabel formLabelSize="sm" htmlFor="backgroundColor_div">Seleziona tipo di sfondo</FormLabel>
        <FormSelect
          formSelectSize="sm"
          value={backgroundType}
          onChange={(e) => setBackgroundType(e.target.value as "color" | "image")}
        >
          <option value="color">Colore</option>
          <option value="image">Immagine</option>
        </FormSelect>
        {backgroundType === "color" && (
          <FormInput
            formInputSize="sm"
            type="color"
            className="mt-4"
            value={localContent?.backgroundColor || "#ffffff"}
            onChange={(e) => {
              handleColorChange("backgroundColor", e.target.value);
              handleChange("backgroundImage", undefined);
            }} />
        )}

        {backgroundType === "image" && (
          <>
            {!localContent?.backgroundImage && (
              <div className="mt-4">
                <FileUploadArea
                  onFileSelect={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      handleChange("backgroundImage", e.target?.result as string);
                      handleChange("backgroundColor", undefined);
                    };
                    reader.readAsDataURL(file);
                  }}
                  title="Carica Immagine di Sfondo"
                  allowedTypes="image/*"
                  description="Trascina qui l'immagine di sfondo"
                  maxSize="5MB"
                />
              </div>
            )}
            {localContent?.backgroundImage && (
              <div className="relative mt-4">
                <img
                  src={localContent?.backgroundImage}
                  alt="Background"
                  className="max-w-full rounded-md shadow-md" />
                <Button
                  onClick={() => handleChange("backgroundImage", "")}
                  className="absolute top-2 right-2 rounded-md"
                  variant="danger"
                  size="xs"
                >
                  <Lucide icon="Trash2" className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <hr className="my-4 border-primary opacity-30" />

      <div className="m-4 cursor-pointer font-semibold">
        Logo
        {!localContent?.logo?.srcLogoCarosello && (
          <div className="mt-4">
            <FileUploadArea
              onFileSelect={(file) => {
                const reader = new FileReader();
                reader.onload = (e) => handleLogoChange("srcLogoCarosello", e.target?.result as string);
                reader.readAsDataURL(file);
              }}
              title="Carica Logo Carosello"
              allowedTypes="image/*"
              description="Trascina qui il logo del carosello"
              maxSize="3MB"
            />
          </div>
        )}
        {localContent?.logo?.srcLogoCarosello && (
          <div className="relative mt-4">
            <img
              src={localContent?.logo.srcLogoCarosello}
              alt="Logo Carosello"
              className="max-w-full rounded-md shadow-md" />
            <Button
              onClick={() => handleLogoChange("srcLogoCarosello", "")}
              className="absolute top-2 right-2 rounded-md"
              variant="danger"
              size="xs"
            >
              <Lucide icon="Trash2" className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="flex gap-4 w-full flex-row mt-4">
          <FormInput
            formInputSize="sm"
            type="number"
            value={localContent?.logo?.width || ""}
            onChange={(e) => handleLogoChange("width", e.target.value)}
            placeholder="Larghezza"
            className="w-1/2" />
          <FormInput
            formInputSize="sm"
            type="number"
            value={localContent?.logo?.height || ""}
            onChange={(e) => handleLogoChange("height", e.target.value)}
            placeholder="Altezza"
            className="w-1/2" />
        </div>
        <hr className="my-4 border-primary opacity-10" />
        <FormLabel formLabelSize="sm" htmlFor="posizioneLogoRispettoAlTitolo">Posizione Logo Rispetto al Titolo</FormLabel>
        <FormSelect
          formSelectSize="sm"
          value={localContent?.logo?.posizione || "bottom"}
          onChange={(e) => handleLogoChange("posizione", e.target.value)}
        >
          <option value="">Seleziona Posizione</option>
          <option value="top">In alto</option>
          <option value="bottom">In basso</option>
          <option value="left">A sinistra</option>
          <option value="right">A destra</option>
        </FormSelect>
      </div>

      <hr className="my-4 border-primary opacity-30" />

      <div className="m-4 cursor-pointer font-semibold flex flex-col">
        Forzatura degli stili
        <Button onClick={() => addForcedStyles(localContent?.options?.forcedStyles !== undefined ? localContent?.options?.forcedStyles.length : 0)} className="mt-4" variant="primary" size="sm">
          Aggiungi forzatura stile
        </Button>
        <Disclosure.Group as="div" variant="boxed" className="mt-4">
          {localContent?.options?.forcedStyles?.map((forcedStyle: ForcedStyles, index: number) => (
            <Disclosure defaultOpen={false} key={index}>
              <Disclosure.Button key={index} className="font-semibold">
                Stile {index + 1}
              </Disclosure.Button>
              <Disclosure.Panel className="grid grid-cols-2 gap-4 mt-4 p-5">
                <Button onClick={() => {
                  const campi = [...forcedStyle?.campi];
                  campi.push("");
                  const updatedForcedStyles = [...(localContent?.options?.forcedStyles || [])];
                  updatedForcedStyles[index].campi = campi;
                  handleChange("options", {
                    ...localContent?.options,
                    forcedStyles: updatedForcedStyles,
                  });
                }} className="col-span-2" variant="primary" size="sm">
                  Aggiungi campo
                </Button>
                {forcedStyle?.campi?.map((campo, i) => (
                  <div key={i}>
                    <FormLabel formLabelSize="sm" htmlFor="campo">Campo</FormLabel>
                    <InputGroup size="sm" className="gap-x-2">
                      <FormSelect
                        formSelectSize="sm"
                        value={campo}
                        onChange={(e) => {
                          const updatedForcedStyles = [...(localContent?.options?.forcedStyles || [])];
                          updatedForcedStyles[index].campi[i] = e.target.value;
                          handleChange("options", {
                            ...localContent?.options,
                            forcedStyles: updatedForcedStyles,
                          });
                        }}
                      >
                        <option value="">Seleziona Campo</option>
                        {memoizedFieldOptionsData?.data?.map((option, i) => (
                          <option key={i} value={option.expected_input}>
                            {option.expected_output != "" ? option.expected_output : option.expected_input}
                          </option>
                        ))}
                        <option value="container">Tutto il contenitore</option>
                      </FormSelect>
                      {/* <FormInput
                                                formInputSize="sm"
                                                id="campo"
                                                type="text"
                                                value={campo}
                                                onChange={(e) => {
                                                    const updatedForcedStyles = [...(localContent?.options?.forcedStyles || [])];
                                                    updatedForcedStyles[index].campi[i] = e.target.value;
                                                    handleChange("options", {
                                                        ...localContent?.options,
                                                        forcedStyles: updatedForcedStyles,
                                                    });
                                                }}
                                            /> */}
                      <Button

                        onClick={() => {
                          const campi = forcedStyle?.campi?.filter((_, j) => j !== i);
                          const updatedForcedStyles = [...localContent?.options?.forcedStyles ?? []];
                          updatedForcedStyles[index].campi = campi;
                          handleChange("options", {
                            ...localContent?.options,
                            forcedStyles: updatedForcedStyles,
                          });
                        }}
                        variant="danger"
                        size="xs"
                      >
                        <Lucide icon="Trash2" className="w-4 h-4" />
                      </Button>
                    </InputGroup>
                  </div>
                ))}
                <Button
                  onClick={() => resetOptionForcedStyles(index)}
                  className="col-span-2"
                  variant="soft-danger"
                  size="sm"
                >
                  Reset Stili
                </Button>
                <div className="flex flex-col">
                  <FormLabel formLabelSize="sm" htmlFor="backgroundColor">Colore di sfondo</FormLabel>
                  <FormInput
                    formInputSize="sm"
                    id="backgroundColor"
                    type="color"
                    value={localContent?.options?.forcedStyles?.[index]?.backgroundColor || "#ffffff"}
                    onChange={(e) => updateForcedStyles("backgroundColor", e.target.value, index)} />
                </div>

                <div>
                  <FormLabel formLabelSize="sm" htmlFor="margin">Margine (px)</FormLabel>
                  <FormInput
                    formInputSize="sm"
                    id="margin"
                    type="number"
                    value={localContent?.options?.forcedStyles?.[index]?.margin?.replace("px", "") || ""}
                    onChange={(e) => updateForcedStyles("margin", `${e.target.value}px`, index)} />
                </div>
                <div>
                  <FormLabel formLabelSize="sm" htmlFor="padding">Padding (px)</FormLabel>
                  <FormInput
                    formInputSize="sm"
                    id="padding"
                    type="number"
                    value={localContent?.options?.forcedStyles?.[index]?.padding?.replace("px", "") || ""}
                    onChange={(e) => updateForcedStyles("padding", `${e.target.value}px`, index)} />
                </div>

                <div>
                  <FormLabel formLabelSize="sm" htmlFor="border">Bordo (px)</FormLabel>
                  <FormInput
                    formInputSize="sm"
                    id="border"
                    type="number"
                    value={localContent?.options?.forcedStyles?.[index]?.border?.replace("px", "") || ""}
                    onChange={(e) => updateForcedStyles("border", `${e.target.value}px`, index)} />
                </div>

                <div>
                  <FormLabel formLabelSize="sm" htmlFor="borderRadius">Raggio bordo (px)</FormLabel>
                  <FormInput
                    formInputSize="sm"
                    id="borderRadius"
                    type="number"
                    value={localContent?.options?.forcedStyles?.[index]?.borderRadius?.replace("px", "") || ""}
                    onChange={(e) => updateForcedStyles("borderRadius", `${e.target.value}px`, index)} />
                </div>

                <div>
                  <FormLabel formLabelSize="sm" htmlFor="width">Larghezza (%)</FormLabel>
                  <FormInput
                    formInputSize="sm"
                    id="width"
                    type="number"
                    value={localContent?.options?.forcedStyles?.[index]?.width?.replace("%", "") || ""}
                    onChange={(e) => updateForcedStyles("width", `${e.target.value}%`, index)} />
                </div>
                <div>
                  <FormLabel formLabelSize="sm" htmlFor="height">Altezza (%)</FormLabel>
                  <FormInput
                    formInputSize="sm"
                    id="height"
                    type="number"
                    value={localContent?.options?.forcedStyles?.[index]?.height?.replace("%", "") || ""}
                    onChange={(e) => updateForcedStyles("height", `${e.target.value}%`, index)} />
                </div>
                <div>
                  <FormLabel formLabelSize="sm" htmlFor="textAlign">Allineamento testo</FormLabel>
                  <FormSelect
                    formSelectSize="sm"
                    id="textAlign"
                    value={localContent?.options?.forcedStyles?.[index]?.textAlign || ""}
                    onChange={(e) => updateForcedStyles("textAlign", e.target.value, index)}
                  >
                    <option value="">Seleziona allineamento</option>
                    <option value="left">Sinistra</option>
                    <option value="center">Centro</option>
                    <option value="right">Destra</option>
                  </FormSelect>
                </div>
                <div className="flex flex-col">
                  <FormLabel htmlFor="color">Colore testo</FormLabel>
                  <FormInput
                    id="color"
                    type="color"
                    value={localContent?.options?.forcedStyles?.[index]?.color || "#000000"}
                    onChange={(e) => updateForcedStyles("color", e.target.value, index)} />
                </div>
              </Disclosure.Panel>
            </Disclosure>
          ))}
        </Disclosure.Group>
      </div >
      <hr className="my-4 border-primary opacity-30" />
      <div className="m-4 cursor-pointer font-semibold">
        <FormLabel formLabelSize="sm" htmlFor="forzaturaBox">
          Forzatura dei box
        </FormLabel>
        <FormSelect
          formSelectSize="sm"
          id="forzaturaBox"
          value={localContent?.options?.forzaturaBox || ""}
          onChange={(e) => handleChange("options", {
            ...localContent?.options,
            forzaturaBox: e.target.value,
          })}
        >
          <option value="">Seleziona Stile</option>
          {memoizedStiliDisponibili?.webpliant.stili?.map((stile, i) => (
            <option key={i} value={stile.nome_stile}>
              {stile.nome_stile}
            </option>
          ))}
        </FormSelect>
      </div>
    </motion.div>
  );
};

export default CarouselContent;
