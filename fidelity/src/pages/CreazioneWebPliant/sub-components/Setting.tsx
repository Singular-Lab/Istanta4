import Button from "@/components/Base/Button";
import { ClassicEditor } from "@/components/Base/Ckeditor";
import Dropzone from "@/components/Base/Dropzone";
import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Litepicker from "@/components/Base/Litepicker";
import Lucide from "@/components/Base/Lucide";
import TomSelect from "@/components/Base/TomSelect";
import { useKeyframeEvents } from "@/context/KeyframeEventContext";
import { Editor } from "@monaco-editor/react";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { icons } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionType } from "../../../../lib/enums";
import { AttributiCaroselloWebpliant, DESIGN_KIT_MONGO, IPromo, PageLayoutItem, PaginaWebPliant, PolicyDiVisualizzazioneType, Ricette } from "../../../../lib/types";
import { PromoResponseDTO, TipiDiExportResponseDTO } from "../../../../server/core/dto";
import CarouselContent from "./Carousel";
import GrigliaReferenze from "./GrigliaReferenze";
import PolicyDiVisualizzazione from "./PolicyDiVisualizzazione";

type IconName = keyof typeof icons;

// --- Custom Hooks ---

/**
 * Utility per deep merge di oggetti
 */
const deepMerge = (...objs: any[]) =>
  objs.reduce((acc, obj) => {
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (Array.isArray(v)) acc[k] = v.slice();
      else if (v && typeof v === "object") acc[k] = deepMerge(acc[k] || {}, v);
      else acc[k] = v;
    });
    return acc;
  }, {} as any);

/**
 * Hook per gestire input con debounce intelligente
 * Lo stato locale si aggiorna immediatamente, il callback viene chiamato con debounce
 */
const useDebouncedInput = (
  initialValue: string,
  onValueChange: (value: string) => void,
  delay: number = 500
) => {
  const [localValue, setLocalValue] = useState(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  const handleChange = useCallback((value: string) => {
    setLocalValue(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onValueChange(value);
    }, delay);
  }, [onValueChange, delay]);

  const handleBlur = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    onValueChange(localValue);
  }, [localValue, onValueChange]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { value: localValue, onChange: handleChange, onBlur: handleBlur };
};

// --- Enhanced Helper Components ---

/**
 * Sezione di impostazioni con animazioni e design migliorato
 */
const SettingsSection: React.FC<{
  title: string;
  icon: IconName;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  promos?: PromoResponseDTO[];
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
            <div className="p-4 pt-0 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

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
  const dropzoneRef = useRef<any>(null);

  const getMaxFileSizeInMB = (sizeStr: string) => {
    const num = parseInt(sizeStr);
    return num;
  };

  const getAcceptedFiles = (types: string) => {
    if (types === "image/*") return "image/*";
    if (types === "video/*") return "video/*";
    return types;
  };

  const dropzoneOptions = {
    url: "#",
    maxFiles: 1,
    maxFilesize: getMaxFileSizeInMB(maxSize || "10MB"),
    acceptedFiles: getAcceptedFiles(allowedTypes || "image/*"),
    addRemoveLinks: false,
    dictDefaultMessage: "",
    autoProcessQueue: false,
    init(this: any) {
      this.on("addedfile", (file: File) => {
        onFileSelect(file);
        this.removeAllFiles();
      });
    },
  };

  return (
    <Dropzone
      options={dropzoneOptions}
      getRef={(el) => { dropzoneRef.current = el; }}
      className="rounded-xl p-8 text-center transition-all duration-300 hover:border-primary/60 hover:bg-primary/5 dark:hover:bg-primary/10"
    >
      <div className="relative z-10">
        <div className="w-16 h-16 bg-gradient-to-r from-primary/10 to-theme-2/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lucide icon="Upload" className="w-8 h-8 text-primary" />
        </div>
        <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">{title}</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
          {description || "Trascina qui il file o clicca per selezionare"}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Max: {maxSize}</p>
      </div>
    </Dropzone>
  );
};

/**
 * Preview migliorato con azioni e info
 */
const MediaPreview: React.FC<{
  src: string;
  alt: string;
  onRemove: () => void;
  type?: 'image' | 'video';
  fileSize?: string;
}> = ({ src, alt, onRemove, type = 'image', fileSize }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="relative group bg-white dark:bg-darkmode-600 border border-slate-200 dark:border-darkmode-500 rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200"
  >
    <div className="relative overflow-hidden rounded-lg">
      {type === 'image' ? (
        <img src={src} alt={alt} className="w-full h-auto rounded-lg" />
      ) : (
        <video controls className="w-full h-auto rounded-lg">
          <source src={src} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
        <Button
          onClick={onRemove}
          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-3 shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-200"
          variant="danger"
        >
          <Lucide icon="Trash2" className="w-5 h-5" />
        </Button>
      </div>
    </div>
    {fileSize && (
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{alt}</span>
        <span>{fileSize}</span>
      </div>
    )}
  </motion.div>
);

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
 * Input con debounce intelligente
 */
const DebouncedFormInput: React.FC<{
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  delay?: number;
  min?: number;
}> = ({
  value,
  onValueChange,
  placeholder,
  type = "text",
  className = "w-full",
  delay = 500,
  min
}) => {
    const { value: localValue, onChange, onBlur } = useDebouncedInput(
      value,
      onValueChange,
      delay
    );

    return (
      <FormInput
        type={type}
        value={localValue}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={className}
        min={min}
      />
    );
  };

export interface ElementSettingsProps {
  element: PageLayoutItem | null;
  updateElementContent: (id: string, content: any) => void;
  updateElement: (id: string, element: PageLayoutItem) => void;
  policy?: {
    locked: boolean,
  };
  pages: PaginaWebPliant[];
  dataPerSelezioneRicette: any;
  dataPerKitDesign: DESIGN_KIT_MONGO[];
  dataPerTipiExport: TipiDiExportResponseDTO[];
  promos: PromoResponseDTO[];
}

const ElementSettings: React.FC<ElementSettingsProps> = ({
  element,
  updateElementContent,
  updateElement,
  pages,
  dataPerSelezioneRicette,
  dataPerKitDesign,
  dataPerTipiExport,
  promos
}) => {
  const [selectedRicettaId, setSelectedRicettaId] = React.useState<string>("");

  const { id, type, content } = element || {};

  // Keyframe logic: scrittura keyframe-aware + lettura con merge silenzioso
  const { hasActiveKeyframeFor, recordModification, getComponentModifications, selectedDate } = useKeyframeEvents();

  // Contenuto effettivo = base + tutte le modifiche del keyframe attivo (deep merge)
  const effectiveContent = useMemo(() => {
    if (!id) return content || {};

    const base = content || {};
    const hasKeyframe = hasActiveKeyframeFor(id);

    console.log(`🎯 ElementSettings effectiveContent per ${id}:`, {
      hasKeyframe,
      selectedDate: selectedDate?.format('DD/MM/YYYY'),
      baseKeys: Object.keys(base),
    });

    // Se c'è un keyframe attivo, fai merge con le sue modifiche
    if (hasKeyframe) {
      const activeMods = getComponentModifications(id);
      const contentMods = activeMods
        .filter(m => m.modificationType === 'content' && m.content)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      console.log(`🎯 Keyframe attivo per ${id}:`, {
        activeModsCount: activeMods.length,
        contentModsCount: contentMods.length,
        overrides: contentMods.map(m => Object.keys(m.content || {}))
      });

      // Deep merge: base + tutte le modifiche del keyframe attivo
      const overrides = contentMods.map(m => m.content || {});
      const result = deepMerge(base, ...overrides);

      console.log(`🎯 Risultato merge per ${id}:`, {
        resultKeys: Object.keys(result),
        hasOverrides: overrides.length > 0
      });

      return result;
    }

    // Altrimenti usa solo il contenuto base
    console.log(`🎯 Nessun keyframe per ${id}, usando base:`, Object.keys(base));
    return base;
  }, [id, content, getComponentModifications, hasActiveKeyframeFor, selectedDate]);

  // Scrittura: se in range → keyframe (patch), altrimenti → base (patch)
  const handleContentChange = useCallback((patch: any) => {
    if (!id) return;

    if (hasActiveKeyframeFor(id)) {
      // Se siamo in keyframe, prendi il payload corrente del keyframe attivo
      const activeMods = getComponentModifications(id);
      const contentMods = activeMods
        .filter(m => m.modificationType === 'content' && m.content)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Payload corrente del keyframe (solo override, senza base)
      const currentKF = contentMods.reduce((acc, m) => deepMerge(acc, m.content || {}), {});

      // Merge la patch con il payload corrente del keyframe
      const nextKF = deepMerge(currentKF, patch);

      // Salva il nuovo payload completo nel keyframe attivo
      recordModification(id, 'content', nextKF);
    } else {
      // Fuori dai keyframe, aggiorna il base mergiando la patch
      updateElementContent(id, deepMerge(content || {}, patch));
    }
  }, [id, hasActiveKeyframeFor, recordModification, getComponentModifications, content, updateElementContent, selectedDate]);

  const handleFileRead = (file: File, fieldName: string) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      handleContentChange({ [fieldName]: e.target?.result });
    };
    reader.readAsDataURL(file);
  };

  const handlePolicyDiVisualizzazione = () => {
    if (updateElement && element?.policy) {
      updateElement(id || "", {
        ...element,
        policy: {
          ...element?.policy,
          locked: !element?.policy.locked
        }
      });
    } else {
      if (updateElement && element) {
        updateElement(id || "", {
          ...element,
          policy: {
            locked: true,
            visualizzazione: element.policy?.visualizzazione ?? [],
            filtri_contenuto: element.policy?.filtri_contenuto ?? []
          }
        });
      }
    }
  };

  const getElementConfig = (type: string) => {
    const configs: Record<string, { title: string; icon: IconName; gradient: string }> = {
      image: { title: "Immagine", icon: "Image" as IconName, gradient: "from-blue-500 to-blue-600" },
      text: { title: "Testo", icon: "Type" as IconName, gradient: "from-purple-500 to-purple-600" },
      video: { title: "Video", icon: "Video" as IconName, gradient: "from-red-500 to-red-600" },
      carousel: { title: "Carosello", icon: "GalleryHorizontal" as IconName, gradient: "from-green-500 to-green-600" },
      space: { title: "Spazio", icon: "SquareSplitVertical" as IconName, gradient: "from-indigo-500 to-indigo-600" },
      html: { title: "HTML", icon: "Code" as IconName, gradient: "from-orange-500 to-orange-600" },
      griglia_referenze: { title: "Griglia Referenze", icon: "LayoutGrid" as IconName, gradient: "from-teal-500 to-teal-600" },
      banner: { title: "Banner", icon: "PictureInPicture" as IconName, gradient: "from-pink-500 to-pink-600" },
      ricetta_ai: { title: "Ricetta AI", icon: "BrainCircuit" as IconName, gradient: "from-violet-500 to-violet-600" },
    };
    return configs[type as keyof typeof configs] || { title: "Elemento", icon: "Settings" as IconName, gradient: "from-gray-500 to-gray-600" };
  };

  const elementConfig = getElementConfig(type || "");

  const renderSettings = useMemo(() => {
    switch (type) {
      case "image":
        return (
          <div className="space-y-6">
            <SettingsSection title="Immagine Desktop" icon="Monitor">
              {!effectiveContent?.src ? (
                <FileUploadArea
                  onFileSelect={(file) => handleFileRead(file, 'src')}
                  title="Carica Immagine Desktop"
                  description="Formati supportati: JPG, PNG, SVG, WebP"
                  maxSize="5MB"
                />
              ) : (
                <MediaPreview
                  src={effectiveContent.src}
                  alt="Immagine Desktop"
                  onRemove={() => handleContentChange({ src: "" })}
                  type="image"
                />
              )}
            </SettingsSection>

            <SettingsSection title="Immagine Mobile" icon="Smartphone">
              {!effectiveContent?.srcMobile ? (
                <FileUploadArea
                  onFileSelect={(file) => handleFileRead(file, 'srcMobile')}
                  title="Carica Immagine Mobile"
                  description="Versione ottimizzata per dispositivi mobili"
                  maxSize="3MB"
                />
              ) : (
                <MediaPreview
                  src={effectiveContent.srcMobile}
                  alt="Immagine Mobile"
                  onRemove={() => handleContentChange({ srcMobile: "" })}
                  type="image"
                />
              )}
            </SettingsSection>

            <SettingsSection title="Link e Navigazione" icon="Link">
              <div className="grid grid-cols-1 gap-4">
                <FormField label="URL Esterno" helperText="Collegamento a sito web esterno">
                  <DebouncedFormInput
                    type="url"
                    value={effectiveContent?.link || ""}
                    onValueChange={(value) => handleContentChange({ link: value })}
                    placeholder="https://esempio.com"
                  />
                </FormField>

                <div className="flex items-center space-x-3 my-4">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-darkmode-500"></div>
                  <span className="text-sm text-slate-500 bg-white dark:bg-darkmode-600 px-3">oppure</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-darkmode-500"></div>
                </div>

                <FormField label="Pagina Interna" helperText="Seleziona una pagina esistente">
                  <FormSelect
                    value={effectiveContent?.page || ""}
                    onChange={(e) => handleContentChange({ page: e.target.value })}
                    className="w-full"
                  >
                    <option value="">Nessuna pagina selezionata</option>
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>{page.nome}</option>
                    ))}
                  </FormSelect>
                </FormField>
              </div>
            </SettingsSection>

            <SettingsSection title="Accessibilità e SEO" icon="Eye">
              <FormField
                label="Testo Alternativo"
                helperText="Descrizione dell'immagine per screen reader e SEO"
                required
              >
                <DebouncedFormInput
                  type="text"
                  value={effectiveContent?.alt || ""}
                  onValueChange={(value) => handleContentChange({ alt: value })}
                  placeholder="Descrizione dell'immagine"
                />
              </FormField>
            </SettingsSection>
          </div>
        );

      case "text":
        return (
          <div className="space-y-6">
            <SettingsSection title="Editor Testo" icon="FileText">
              <ClassicEditor
                value={effectiveContent?.text || ""}
                onChange={(data) => handleContentChange({ text: data })}
              />
            </SettingsSection>
          </div>
        );

      case "video":
        return (
          <div className="space-y-6">
            <SettingsSection title="Configurazione Video" icon="Settings">
              <FormField label="Breakpoint Video" helperText="Larghezza in pixel per il cambio video desktop/mobile">
                <DebouncedFormInput
                  type="number"
                  value={effectiveContent?.widthBreakPoint || ""}
                  min={0}
                  onValueChange={(value) => handleContentChange({ widthBreakPoint: value })}
                  placeholder="768"
                />
              </FormField>
            </SettingsSection>

            <SettingsSection title="Video Desktop" icon="Monitor">
              {!effectiveContent?.srcDesktop ? (
                <FileUploadArea
                  onFileSelect={(file) => handleFileRead(file, 'srcDesktop')}
                  title="Carica Video Desktop"
                  allowedTypes="video/*"
                  description="Formati supportati: MP4, WebM, AVI"
                  maxSize="50MB"
                />
              ) : (
                <MediaPreview
                  src={effectiveContent.srcDesktop}
                  alt="Video Desktop"
                  onRemove={() => handleContentChange({ srcDesktop: "" })}
                  type="video"
                />
              )}

              {!effectiveContent?.thumbnailSrcDesktop && effectiveContent?.srcDesktop && (
                <div className="mt-4">
                  <FormField label="Thumbnail Desktop" helperText="Immagine di anteprima del video">
                    <FileUploadArea
                      onFileSelect={(file) => handleFileRead(file, 'thumbnailSrcDesktop')}
                      title="Carica Thumbnail"
                      allowedTypes="image/*"
                      maxSize="2MB"
                    />
                  </FormField>
                </div>
              )}

              {effectiveContent?.thumbnailSrcDesktop && (
                <div className="mt-4">
                  <MediaPreview
                    src={effectiveContent.thumbnailSrcDesktop}
                    alt="Thumbnail Desktop"
                    onRemove={() => handleContentChange({ thumbnailSrcDesktop: "" })}
                    type="image"
                  />
                </div>
              )}
            </SettingsSection>

            <SettingsSection title="Video Mobile" icon="Smartphone">
              {!effectiveContent?.srcMobile ? (
                <FileUploadArea
                  onFileSelect={(file) => handleFileRead(file, 'srcMobile')}
                  title="Carica Video Mobile"
                  allowedTypes="video/*"
                  description="Versione ottimizzata per mobile"
                  maxSize="25MB"
                />
              ) : (
                <MediaPreview
                  src={effectiveContent.srcMobile}
                  alt="Video Mobile"
                  onRemove={() => handleContentChange({ srcMobile: "" })}
                  type="video"
                />
              )}

              {!effectiveContent?.thumbnailSrcMobile && effectiveContent?.srcMobile && (
                <div className="mt-4">
                  <FormField label="Thumbnail Mobile" helperText="Immagine di anteprima per mobile">
                    <FileUploadArea
                      onFileSelect={(file) => handleFileRead(file, 'thumbnailSrcMobile')}
                      title="Carica Thumbnail Mobile"
                      allowedTypes="image/*"
                      maxSize="1MB"
                    />
                  </FormField>
                </div>
              )}

              {effectiveContent?.thumbnailSrcMobile && (
                <div className="mt-4">
                  <MediaPreview
                    src={effectiveContent.thumbnailSrcMobile}
                    alt="Thumbnail Mobile"
                    onRemove={() => handleContentChange({ thumbnailSrcMobile: "" })}
                    type="image"
                  />
                </div>
              )}
            </SettingsSection>
          </div>
        );

      case "space":
        return (
          <div className="space-y-6">
            <SettingsSection title="Impostazioni Margini" icon="Move">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Margine Superiore">
                  <div className="flex gap-2">
                    <DebouncedFormInput
                      type="number"
                      value={effectiveContent?.marginTop || ""}
                      min={0}
                      placeholder="0"
                      onValueChange={(value) => handleContentChange({ marginTop: value })}
                      className="flex-1"
                    />
                    <FormSelect
                      value={effectiveContent?.marginTopUnit || "px"}
                      onChange={(e) => handleContentChange({ marginTopUnit: e.target.value })}
                      className="w-20"
                    >
                      <option value="px">px</option>
                      <option value="em">em</option>
                      <option value="rem">rem</option>
                      <option value="%">%</option>
                    </FormSelect>
                  </div>
                </FormField>

                <FormField label="Margine Inferiore">
                  <div className="flex gap-2">
                    <DebouncedFormInput
                      type="number"
                      value={effectiveContent?.marginBottom || ""}
                      min={0}
                      placeholder="0"
                      onValueChange={(value) => handleContentChange({ marginBottom: value })}
                      className="flex-1"
                    />
                    <FormSelect
                      value={effectiveContent?.marginBottomUnit || "px"}
                      onChange={(e) => handleContentChange({ marginBottomUnit: e.target.value })}
                      className="w-20"
                    >
                      <option value="px">px</option>
                      <option value="em">em</option>
                      <option value="rem">rem</option>
                      <option value="%">%</option>
                    </FormSelect>
                  </div>
                </FormField>
              </div>
            </SettingsSection>

            <SettingsSection title="Divisore Visuale" icon="Minus">
              <FormCheck className="flex items-start space-x-3">
                <FormCheck.Input
                  type="checkbox"
                  checked={effectiveContent?.abilitaHr || false}
                  onChange={(e) => handleContentChange({ abilitaHr: e.target.checked })}
                  className="mt-1"
                />
                <div>
                  <FormCheck.Label className="font-medium text-slate-700 dark:text-slate-300">
                    Mostra divisorio orizzontale
                  </FormCheck.Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Aggiunge una linea divisoria visibile tra gli elementi
                  </p>
                </div>
              </FormCheck>
            </SettingsSection>
          </div>
        );

      case "html":
        return (
          <div className="space-y-6">
            <SettingsSection title="Editor HTML" icon="Code">
              <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-300 dark:border-darkmode-500">
                <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-sm text-slate-400">index.html</span>
                </div>
                <Editor
                  height="400px"
                  language="html"
                  theme="vs-dark"
                  value={effectiveContent?.html || ""}
                  onChange={(value) => handleContentChange({ html: value || '' })}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineHeight: 1.5,
                    wordWrap: "on",
                    automaticLayout: true,
                  }}
                />
              </div>
            </SettingsSection>
          </div>
        );

      case "carousel":
        return (
          <div className="space-y-6">
            <CarouselContent pagine={pages} content={effectiveContent as AttributiCaroselloWebpliant} updateContent={handleContentChange} />
          </div>
        );

      case "griglia_referenze":
        return (
          <div className="space-y-6">
            <SettingsSection title="Configurazione Griglia" icon="LayoutGrid">
              <GrigliaReferenze
                id={id ?? ""}
                // Pass wrapper keyframe-aware e contenuto effettivo
                updateElementContent={(_, newContent) => handleContentChange(newContent)}
                locked={element?.user_locked?.locked ?? false}
                item={{ ...(element as PageLayoutItem), content: effectiveContent }}
              />
            </SettingsSection>
          </div>
        );

      case "banner":
        return (
          <div className="space-y-6">
            <SettingsSection title="Immagine di Sfondo" icon="Image">
              {!effectiveContent?.banner ? (
                <FileUploadArea
                  onFileSelect={(file) => handleFileRead(file, 'banner')}
                  title="Carica Immagine Banner"
                  description="Formato consigliato: 1920x600px"
                  maxSize="8MB"
                />
              ) : (
                <MediaPreview
                  src={effectiveContent.banner as string}
                  alt="Banner"
                  onRemove={() => handleContentChange({ banner: "" })}
                  type="image"
                />
              )}
            </SettingsSection>

            <SettingsSection title="Contenuto Banner" icon="Type">
              <div className="space-y-4">
                <FormField label="Titolo Banner" helperText="Testo principale del banner">
                  <DebouncedFormInput
                    type="text"
                    value={effectiveContent?.bannerTitle || ""}
                    onValueChange={(value) => handleContentChange({ bannerTitle: value })}
                    placeholder="Inserisci il titolo"
                  />
                </FormField>

                <FormField label="Testo Banner" helperText="Descrizione o call-to-action">
                  <DebouncedFormInput
                    type="text"
                    value={effectiveContent?.bannerText || ""}
                    onValueChange={(value) => handleContentChange({ bannerText: value })}
                    placeholder="Inserisci il testo"
                  />
                </FormField>
              </div>
            </SettingsSection>
          </div>
        );

      case "ricetta_ai":
        return (
          <div className="space-y-6">
            <SettingsSection title="Selezione Ricette" icon="Search">
              <div className="space-y-4">
                <FormField label="Aggiungi Ricetta" helperText="Seleziona dalle ricette disponibili">
                  <div className="flex gap-2">
                    <FormSelect
                      value={selectedRicettaId}
                      onChange={(e) => setSelectedRicettaId(e.target.value)}
                      className="flex-1"
                    >
                      <option value="">Seleziona una ricetta</option>
                      {dataPerSelezioneRicette.data?.filter((ricetta: Ricette) =>
                        !effectiveContent?.ricettaAI?.find((r: Ricette) => r.guid_id === ricetta.guid_id)
                      ).map((ricetta: Ricette) => (
                        <option key={ricetta.guid_id} value={ricetta.guid_id}>
                          {ricetta.titolo}
                        </option>
                      ))}
                    </FormSelect>
                    <Button
                      onClick={() => {
                        if (selectedRicettaId) {
                          const selectedRecipe = dataPerSelezioneRicette?.data?.find(
                            (r: any) => r.guid_id === selectedRicettaId
                          );
                          if (selectedRecipe) {
                            const newRicette = [
                              ...(effectiveContent?.ricettaAI || []),
                              {
                                guid_id: selectedRecipe.guid_id,
                                titolo: selectedRecipe.titolo,
                                foto_ricetta: selectedRecipe.foto_ricetta,
                                url: "",
                              },
                            ];
                            handleContentChange({ ricettaAI: newRicette });
                            setSelectedRicettaId("");
                          }
                        }
                      }}
                      variant="primary"
                      className="px-4"
                    >
                      <Lucide icon="Plus" className="w-4 h-4" />
                    </Button>
                  </div>
                </FormField>
              </div>
            </SettingsSection>

            <SettingsSection title="Ricette Selezionate" icon="List">
              {effectiveContent?.ricettaAI?.length > 0 ? (
                <div className="space-y-3">
                  {effectiveContent.ricettaAI.map((ricetta: Ricette, index: number) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-darkmode-600 rounded-lg border border-slate-200 dark:border-darkmode-500"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-300">{ricetta.titolo}</span>
                      <div className="flex items-center space-x-1">
                        <Button
                          onClick={() => {
                            const newRicettaAI = [...effectiveContent?.ricettaAI];
                            const [movedItem] = newRicettaAI.splice(index, 1);
                            newRicettaAI.splice(index - 1, 0, movedItem);
                            handleContentChange({ ricettaAI: newRicettaAI });
                          }}
                          variant="outline-secondary"
                          size="sm"
                          disabled={index === 0}
                          className="p-2"
                        >
                          <Lucide icon="ArrowUp" className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => {
                            const newRicettaAI = [...effectiveContent?.ricettaAI];
                            const [movedItem] = newRicettaAI.splice(index, 1);
                            newRicettaAI.splice(index + 1, 0, movedItem);
                            handleContentChange({ ricettaAI: newRicettaAI });
                          }}
                          variant="outline-secondary"
                          size="sm"
                          disabled={index === effectiveContent?.ricettaAI.length - 1}
                          className="p-2"
                        >
                          <Lucide icon="ArrowDown" className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => {
                            const newRicettaAI = [...effectiveContent?.ricettaAI];
                            newRicettaAI.splice(index, 1);
                            handleContentChange({ ricettaAI: newRicettaAI });
                          }}
                          variant="outline-danger"
                          size="sm"
                          className="p-2"
                        >
                          <Lucide icon="Trash2" className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Lucide icon="ChefHat" className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nessuna ricetta selezionata</p>
                </div>
              )}
            </SettingsSection>
          </div>
        );

      case "pdf_volantino":
        return (
          <div className="space-y-6">
            <SettingsSection title="PDF Volantino" icon="FileText" collapsible defaultExpanded={false}>
              <div className="space-y-4">
                <div>
                  <FormLabel htmlFor="kit-design-select">
                    Seleziona Kit Design
                  </FormLabel>
                  <TomSelect
                    id="kit-design-select"
                    value={effectiveContent?.selectedKitDesign || ""}
                    onChange={(e) => {
                      handleContentChange({
                        selectedKitDesign: e.target.value
                      });
                    }}
                    multiple={true}
                    options={{
                      placeholder: "Seleziona un kit design...",
                      searchField: ['text'],
                      valueField: 'value',
                      labelField: 'text',
                      sortField: 'text'
                    }}
                  >
                    <option value="">Seleziona un kit design...</option>
                    {Array.isArray(dataPerKitDesign) ? dataPerKitDesign.map((kit: any) => (
                      <option key={kit.guidId} value={kit.guidId}>
                        {kit.titolo}
                      </option>
                    )) : (dataPerKitDesign as any)?.map((kit: any) => (
                      <option key={kit.guidId} value={kit.guidId}>
                        {kit.titolo}
                      </option>
                    ))}
                  </TomSelect>
                </div>
                <div>
                  <FormLabel htmlFor="tipo-export-select">
                    Seleziona Tipo di Export
                  </FormLabel>
                  <TomSelect
                    id="tipo-export-select"
                    value={effectiveContent?.selectedTipoExport || ""}
                    multiple={true}
                    options={{
                      placeholder: "Seleziona un tipo di export...",
                      searchField: ['text'],
                      valueField: 'value',
                      labelField: 'text',
                      sortField: 'text'
                    }}
                    onChange={(e) => {
                      handleContentChange({
                        selectedTipoExport: e.target.value
                      });
                    }}
                  >
                    <option value="">Seleziona un tipo di export...</option>
                    {Array.isArray(dataPerTipiExport) ? dataPerTipiExport.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nome}
                      </option>
                    )) : (dataPerTipiExport as any)?.map((tipo: any) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nome}
                      </option>
                    ))}
                  </TomSelect>
                </div>
              </div>
            </SettingsSection>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-darkmode-600 dark:to-darkmode-700 rounded-full flex items-center justify-center mb-4">
              <Lucide icon="Settings" className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Elemento in sviluppo
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Le impostazioni per questo tipo di elemento saranno disponibili presto.
            </p>
          </div>
        );
    }
  }, [effectiveContent, type, id, dataPerSelezioneRicette, selectedRicettaId, pages, element]);

  if (!element) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full text-center p-8"
      >
        <div className="w-24 h-24 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-darkmode-600 dark:to-darkmode-700 rounded-full flex items-center justify-center mb-6">
          <Lucide icon="SquareMousePointer" className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
          Nessun elemento selezionato
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          Seleziona un elemento nella canvas per visualizzare e modificare le sue proprietà
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col dark:bg-darkmode-800"
    >
      {/* Contenuto scrollabile */}
      <div className="flex-1 overflow-y-auto space-y-6 mb-14">
        {/* Stile Settings - comune a molti elementi */}
        <FormField label="Alias">
          <FormInput
            type="text"
            value={element.alias || ""}
            onChange={(e) => updateElement(id || "", { ...element, alias: e.target.value })}
            placeholder="Alias"
          />
        </FormField>

        {['carousel', 'video', 'ricetta_ai', 'griglia_referenze', 'banner'].includes(type ?? '') && (
          <SettingsSection title="Stile e Aspetto" icon="Palette" collapsible defaultExpanded={false}>
            {/* Passo contenuto effettivo e wrapper keyframe-aware */}
            <StyleSettings
              element={{ ...element, content: effectiveContent }}
              updateElementContent={(_, newContent) => handleContentChange(newContent)}
            />
          </SettingsSection>
        )}

        {/* Rendering specifico per tipo */}
        {renderSettings}

        {/* Policy di visualizzazione - sempre presente */}
        <SettingsSection title="Policy di Visualizzazione" icon="Shield">
          <PolicyDiVisualizzazione
            tipo_interazione={InteractionType.SECTION}
            locked={element.policy?.locked || false}
            handlePolicyDiVisualizzazione={handlePolicyDiVisualizzazione}
            oggettoPolicyDiVisualizzazione={element.policy}
            updatePolicy={(newPolicy: PolicyDiVisualizzazioneType) => {
              if (updateElement && id) {
                updateElement(id, { ...element, policy: newPolicy });
              }
            }}
          />
        </SettingsSection>
      </div>
    </motion.div>
  );
};

interface DurationSettingsProps {
  element: PageLayoutItem;
  promos: IPromo[];
  updateElement: (id: string, element: PageLayoutItem) => void;
}

const DurationSettings: React.FC<DurationSettingsProps> = ({ element, updateElement, promos }) => {
  const { id, duration } = element;

  const selectedPromo = promos?.find(promo => promo.guid_id === duration?.id_promo);

  const handleDurationChange = useCallback((field: string, value: Date | string) => {
    const newDuration = {
      id_promo: duration?.id_promo || "",
      start_date: duration?.start_date || dayjs().toDate(),
      end_date: duration?.end_date || dayjs().add(30, 'day').toDate(),
      [field]: value
    };

    updateElement(id, { ...element, duration: newDuration });
  }, [id, element, duration, updateElement]);

  const handlePromoIdChange = useCallback((promoId: string) => {
    if (promoId) {
      const selectedPromo = promos?.find(promo => promo.guid_id === promoId);
      const newDuration = {
        id_promo: promoId,
        start_date: selectedPromo ? dayjs(selectedPromo.validitaDal, "DD/MM/YYYY").toDate() : dayjs().toDate(),
        end_date: selectedPromo ? dayjs(selectedPromo.validitaAl, "DD/MM/YYYY").toDate() : dayjs().add(30, 'day').toDate()
      };
      updateElement(id, { ...element, duration: newDuration });
    } else {
      const newDuration = {
        id_promo: "",
        start_date: duration?.start_date || dayjs().toDate(),
        end_date: duration?.end_date || dayjs().add(30, 'day').toDate()
      };
      updateElement(id, { ...element, duration: newDuration });
    }
  }, [id, element, duration, updateElement, promos]);

  const formatDateForInput = (date: Date | string | undefined): string => {
    if (!date) return "";
    try {
      const dayjsDate = dayjs(date);
      if (!dayjsDate.isValid()) return "";
      const currentYear = dayjs().year();
      const dateYear = dayjsDate.year();
      if (dateYear < 1900 || dateYear > currentYear + 10) return "";
      return dayjsDate.format('YYYY-MM-DD');
    } catch {
      return "";
    }
  };

  const formatDateForDisplay = (date: Date | string | undefined): string => {
    if (!date) return 'Non impostato';
    try {
      const dayjsDate = dayjs(date);
      return dayjsDate.isValid() ? dayjsDate.format('DD/MM/YYYY') : 'Data invalida';
    } catch {
      return 'Errore formato';
    }
  };

  const calculateDurationDays = (startDate: Date | string | undefined, endDate: Date | string | undefined): number => {
    if (!startDate || !endDate) return 0;
    try {
      const start = dayjs(startDate);
      const end = dayjs(endDate);
      if (!start.isValid() || !end.isValid()) return 0;
      return Math.abs(end.diff(start, 'day'));
    } catch {
      return 0;
    }
  };

  const isDurationActive = duration && (duration.start_date || duration.end_date);
  const isPromoSelected = duration?.id_promo && selectedPromo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Controllo Durata</h5>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isDurationActive
              ? isPromoSelected
                ? "Durata automatica dalla promozione selezionata"
                : "Durata manuale - l'elemento sarà visibile solo nel periodo specificato"
              : "Durata disattivata - l'elemento sarà sempre visibile"}
          </p>
        </div>
        <Button
          variant={isDurationActive ? "outline-danger" : "outline-primary"}
          size="sm"
          onClick={() => {
            if (isDurationActive) {
              const { duration: _, ...elementWithoutDuration } = element as any;
              updateElement(id, elementWithoutDuration);
            } else {
              const newDuration = {
                id_promo: "",
                start_date: dayjs().toDate(),
                end_date: dayjs().add(30, 'day').toDate()
              };
              updateElement(id, { ...element, duration: newDuration });
            }
          }}
        >
          <Lucide icon={isDurationActive ? "X" : "Calendar"} className="w-4 h-4 mr-2" />
          {isDurationActive ? "Disattiva" : "Attiva"}
        </Button>
      </div>

      {isDurationActive && (
        <>
          <FormField
            label="Promozione"
            helperText={isPromoSelected
              ? "Le date saranno automaticamente impostate dalla promozione selezionata"
              : "Seleziona una promozione per usare le sue date automaticamente, oppure lascia vuoto per date manuali"}
          >
            <FormSelect
              value={duration?.id_promo || ""}
              onChange={(e) => handlePromoIdChange(e.target.value)}
            >
              <option value="">Date manuali</option>
              {promos?.map((promo) => (
                <option value={promo.guid_id} key={promo.guid_id}>
                  {promo.nomePromo}
                </option>
              ))}
            </FormSelect>
          </FormField>

          {!isPromoSelected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Data Inizio" helperText="Data di inizio visibilità dell'elemento">
                <Litepicker
                  value={formatDateForInput(duration?.start_date)}
                  onChange={(e) => handleDurationChange("start_date", dayjs(e.target.value).toDate())}
                  options={{
                    format: 'DD/MM/YYYY',
                    maxDate: dayjs().add(10, 'year').toDate(),
                    minDate: dayjs().subtract(10, 'year').toDate(),
                  }}
                  className="w-full"
                />
              </FormField>

              <FormField label="Data Fine" helperText="Data di fine visibilità dell'elemento">
                <Litepicker
                  value={formatDateForInput(duration?.end_date)}
                  onChange={(e) => handleDurationChange("end_date", dayjs(e.target.value).toDate())}
                  options={{
                    format: 'DD/MM/YYYY',
                    maxDate: dayjs().add(10, 'year').toDate(),
                    minDate: dayjs().subtract(10, 'year').toDate(),
                  }}
                  className="w-full"
                />
              </FormField>
            </div>
          )}

          <div className={`mt-4 p-4 rounded-lg border ${isPromoSelected
            ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800"
            : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800"
            }`}>
            <h6 className={`text-sm font-semibold mb-3 flex items-center ${isPromoSelected
              ? "text-green-700 dark:text-green-300"
              : "text-blue-700 dark:text-blue-300"
              }`}>
              <Lucide icon={isPromoSelected ? "Check" : "Clock"} className="w-4 h-4 mr-2" />
              {isPromoSelected ? "Durata Promozione" : "Anteprima Durata"}
            </h6>

            {isPromoSelected && (
              <div className="mb-3 p-2 bg-green-100 dark:bg-green-900/30 rounded text-sm">
                <span className="font-medium text-green-800 dark:text-green-200">
                  {selectedPromo?.nomePromo}
                </span>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Inizio:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDateForDisplay(duration?.start_date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Fine:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDateForDisplay(duration?.end_date)}
                </span>
              </div>
              {duration?.start_date && duration?.end_date && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Durata totale:</span>
                    <span className={`font-medium ${isPromoSelected
                      ? "text-green-600 dark:text-green-400"
                      : "text-blue-600 dark:text-blue-400"
                      }`}>
                      {(() => {
                        const days = calculateDurationDays(duration.start_date, duration.end_date);
                        return `${days} giorn${days > 1 ? 'i' : 'o'}`;
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface StyleSettingsProps {
  element: PageLayoutItem;
  updateElementContent: (id: string, newContent: any) => void;
}

const StyleSettings: React.FC<StyleSettingsProps> = ({ element, updateElementContent }) => {
  const { id, content } = element;

  const handleStyleChange = useCallback((category: string, property: string, value: string) => {
    const newContent = {
      ...content,
      style: {
        ...(content?.style || {}),
        [category]: {
          ...(content?.style?.[category] || {}),
          [property]: value
        }
      }
    };
    updateElementContent(id, newContent);
  }, [id, content, updateElementContent]);

  const getStyleValue = (category: string, property: string, defaultValue: string = '') => {
    return (content?.style as any)?.[category]?.[property] ?? defaultValue;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Padding" helperText="Spazio interno (es. 16px, 1rem 2rem)">
          <DebouncedFormInput
            type="text"
            value={getStyleValue('spacing', 'padding')}
            onValueChange={(value) => handleStyleChange('spacing', 'padding', value)}
            placeholder="16px"
          />
        </FormField>

        <FormField label="Margin" helperText="Spazio esterno (es. 16px, 1rem 0)">
          <DebouncedFormInput
            type="text"
            value={getStyleValue('spacing', 'margin')}
            onValueChange={(value) => handleStyleChange('spacing', 'margin', value)}
            placeholder="0 auto"
          />
        </FormField>
      </div>

      <div className="space-y-4">
        <FormField label="Colore di Sfondo" helperText="Seleziona il colore di sfondo dell'elemento">
          <div className="flex items-center space-x-3">
            <FormInput
              type="color"
              value={getStyleValue('background', 'backgroundColor', '#ffffff')}
              onChange={(e) => handleStyleChange('background', 'backgroundColor', e.target.value)}
              className="w-16 h-10 rounded-lg border border-slate-300 dark:border-darkmode-500"
            />
            <DebouncedFormInput
              type="text"
              value={getStyleValue('background', 'backgroundColor', '#ffffff')}
              onValueChange={(value) => handleStyleChange('background', 'backgroundColor', value)}
              placeholder="#ffffff"
              className="flex-1"
              delay={150}
            />
          </div>
        </FormField>
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-darkmode-600 dark:to-darkmode-700 rounded-lg border border-slate-200 dark:border-darkmode-500">
        <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center">
          <Lucide icon="Eye" className="w-4 h-4 mr-2" />
          Anteprima Stile
        </h5>
        <div
          className="w-full h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-darkmode-500 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"
          style={{
            padding: getStyleValue('spacing', 'padding') || '8px',
            margin: getStyleValue('spacing', 'margin') || '0',
            backgroundColor: getStyleValue('background', 'backgroundColor') || 'transparent'
          }}
        >
          Elemento con stili applicati
        </div>
      </div>
    </div>
  );
};

export default React.memo(ElementSettings);

interface HtmlEditorDialogProps {
  id: string;
  initialContent: string;
  onSave: (htmlContent: string) => void;
  isOpen: boolean;
  onClose: (htmlContent: string) => void;
}

const HtmlEditorDialog: React.FC<HtmlEditorDialogProps> = ({
  id,
  initialContent,
  onSave,
  isOpen,
  onClose,
}) => {
  const [htmlContent, setHtmlContent] = useState(initialContent || "");

  useEffect(() => {
    setHtmlContent(initialContent || "");
  }, [initialContent, isOpen]);

  const handleSave = () => {
    onSave(htmlContent);
    onClose(htmlContent);
  };

  return (
    <Dialog size="xl" open={isOpen} onClose={() => { onClose(htmlContent); }} as="div" className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200">
            <Dialog.Title className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-medium">Editor HTML</h3>
              <Button variant="outline-secondary" onClick={() => onClose(htmlContent)}>
                <Lucide icon="X" className="w-4 h-4" />
              </Button>
            </Dialog.Title>
            <div className="p-6">
              <div className="h-[70vh]">
                <Editor
                  defaultLanguage="html"
                  value={htmlContent}
                  onChange={(value) => setHtmlContent(value || "")}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    wordWrap: "on",
                    autoIndent: "full",
                    contextmenu: true,
                    fontSize: 14,
                    lineHeight: 22,
                    tabSize: 2,
                    suggestOnTriggerCharacters: true,
                    inlineSuggest: { enabled: true },
                    quickSuggestions: { other: true, comments: true, strings: true },
                    suggest: {
                      showMethods: true,
                      showFunctions: true,
                      showConstructors: true,
                      showFields: true,
                      showVariables: true,
                      showClasses: true,
                      showStructs: true,
                      showInterfaces: true,
                      showModules: true,
                      showProperties: true,
                      showEvents: true,
                      showOperators: true,
                      showUnits: true,
                      showValues: true,
                      showConstants: true,
                      showEnums: true,
                      showEnumMembers: true,
                      showKeywords: true,
                      showWords: true,
                      showColors: true,
                      showFiles: true,
                      showReferences: true,
                      showFolders: true,
                      showTypeParameters: true,
                      showSnippets: true,
                      showUsers: true,
                      snippetsPreventQuickSuggestions: false,
                    },
                    hover: { enabled: true },
                    colorDecorators: true,
                  }}
                />
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
};
