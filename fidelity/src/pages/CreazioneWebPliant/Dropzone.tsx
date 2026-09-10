import Button from "@/components/Base/Button";
import { ClassicEditor } from "@/components/Base/Ckeditor";
import { FormInline, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { Dialog, Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import EmptyState from "@/components/EmptyState";
import { useKeyframeEvents } from "@/context/KeyframeEventContext";
import useAutoScroll from "@/hooks/useAutoScroll";
import { useFetchConfig } from "@/query/query";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useDrop, XYCoord } from "react-dnd";
import { useLoaderData, useRevalidator } from "react-router-dom";
import { InteractionType, TIPO_PAGINA } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { Config, ContenutoAggiuntivoReferenza, LoghiReferenza, PageLayoutItem, PaginaWebPliant, PolicyDiVisualizzazioneType } from "../../../lib/types";
import GridItem from "./GridItem";
import PolicyDiVisualizzazione from "./sub-components/PolicyDiVisualizzazione";
import { ItemTypes } from "./types";

interface DropzoneProps {
  type: "row" | "column" | "default";
  parentId?: string;
  pages?: PaginaWebPliant[];
  updatePageSettings: (id: string, settings: any) => void;
  idWorkspace: string;
  idArea: string;
  idCanale: string;
  selectedPageIndex?: number;
  setSelectedPageIndex?: (index: number) => void;
  elements: PageLayoutItem[];
  onRemove: (id: string) => void;
  onPolicy: (id: string) => void;
  onLock: (id: string) => void;
  updateElementContent: (id: string, content: any) => void;
  onDropItem: (item: any, parentId: string, index?: number) => void;
  moveElement: (dragId: string, hoverId: string, parentId?: string) => void;
  selectedElementId: string | null;
  setSelectedElementId: (id: string) => void;
  user_list: Array<{ id: string; name: string }>;
  activeTool?: string;
  config?: Config;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

const Dropzone: React.FC<DropzoneProps> = ({
  type,
  parentId = "",
  elements,
  idWorkspace,
  idArea,
  idCanale,
  pages,
  selectedPageIndex,
  setSelectedPageIndex,
  onRemove,
  onPolicy,
  onLock,
  updateElementContent,
  onDropItem,
  moveElement,
  selectedElementId,
  setSelectedElementId,
  updatePageSettings,
  user_list,
  activeTool,
  scrollContainerRef,
}) => {
  const { recordModification, hasActiveKeyframeFor, isComponentVisible, selectedDate, setSelectedDate } = useKeyframeEvents();

  // Controllo immediato dei componenti ibridi al caricamento della pagina
  useEffect(() => {
    // Solo se non c'è ancora una data selezionata e ci sono elementi
    if (!selectedDate && elements.length > 0) {
      console.log('🎯 Dropzone: Controllo iniziale componenti ibridi al caricamento');

      // Controlla se ci sono componenti ibridi
      const hybridElements = elements.filter(element => element.is_hybrid);

      if (hybridElements.length > 0) {
        console.log(`🎯 Trovati ${hybridElements.length} componenti ibridi:`, hybridElements.map(el => el.id));

        // Imposta la data corrente come data selezionata per attivare il controllo
        const currentDate = dayjs().startOf('day');
        console.log('🎯 Impostando data corrente come data selezionata:', currentDate.format('DD/MM/YYYY'));
        setSelectedDate(currentDate);
      } else {
        console.log('🎯 Nessun componente ibrido trovato, tutti gli elementi saranno visibili');
      }
    }
  }, [elements, selectedDate, setSelectedDate]);

  // Filtra gli elementi in base alla visibilità per componenti ibridi
  const visibleElements = useMemo(() => {
    return elements.filter(element => {
      const isVisible = isComponentVisible(element.id);
      console.log(`🎯 Dropzone visibilità elemento ${element.id}:`, {
        isVisible,
        isHybrid: element.is_hybrid,
        hasKeyframe: hasActiveKeyframeFor(element.id),
        selectedDate: selectedDate?.format('DD/MM/YYYY')
      });
      return isVisible;
    });
  }, [elements, isComponentVisible, hasActiveKeyframeFor, selectedDate]);

  const { dataWorkspace, contenutiAggiuntivi } = useLoaderData() as {
    dataWorkspace: {
      webpliant: Array<{
        id: string;
        nome: string;
        tipo: TIPO_PAGINA;
        struttura: Element[];
        settings?: {
          mostra_menu_laterale: boolean;
          policy?: PolicyDiVisualizzazioneType;
        };
      }>;
      idGDO: string;
    };
    contenutiAggiuntivi: ContenutoAggiuntivoReferenza[],
  };

  // Wrapper per moveElement che gestisce override vs posizione base
  const handleMoveElement = (dragId: string, hoverId: string, parentId?: string) => {
    // Trova gli indici degli elementi (usa elements per gli indici reali, non visibleElements)
    const dragIndex = elements.findIndex(el => el.id === dragId);
    const hoverIndex = elements.findIndex(el => el.id === hoverId);

    if (hasActiveKeyframeFor(dragId)) {
      // Durante il range del keyframe: registra SOLO nel keyframe (override)
      console.log(`🎯 Override posizione keyframe per componente ${dragId}:`, { oldIndex: dragIndex, newIndex: hoverIndex });
      if (dragIndex !== -1 && hoverIndex !== -1) {
        recordModification(dragId, 'position', { oldIndex: dragIndex, newIndex: hoverIndex });
      }
    } else {
      // Fuori dal range: modifica posizione base
      console.log(`📝 Modifica posizione base per componente ${dragId}:`, { oldIndex: dragIndex, newIndex: hoverIndex });
      moveElement(dragId, hoverId, parentId);
    }
  };

  const { data: allLoghi = [], isLoading: isLoadingLoghi } = useQuery({
    queryKey: ["allLoghi"],
    queryFn: () => ServerCall.get<LoghiReferenza[]>("/getAllLoghiDaReferenze"),

  });

  const r = useRevalidator();
  /**
   * Esempio di array di settings pagine,
   * dove potresti memorizzare/aggiornare la policy di visualizzazione
   */

  const [pagesSettings, setPagesSettings] = useState(
    dataWorkspace.webpliant.map(p => ({
      id: p.id,
      settings: p.settings || {
        // Impostazioni di default se mancanti
        policy: {
          locked: false,
          visualizzazione: [],
          filtri_contenuto: [],
        },
      }
    }))
  );


  const ref = useRef<HTMLDivElement | null>(null);
  const dropzoneRef = useRef<HTMLDivElement | null>(null);
  const [openModaleContenutiAggiuntivi, setOpenModaleContenutiAggiuntivi] = useState<boolean>(false);
  const [selectedContenutoAggiuntivo, setSelectedContenutoAggiuntivo] = useState<ContenutoAggiuntivoReferenza | null>(null);
  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.ELEMENT,
    hover(item: any, monitor) {
      console.log('[Dropzone] hover event triggered!', {
        item,
        parentId,
        isOverCurrent: monitor.isOver({ shallow: true }),
        clientOffset: monitor.getClientOffset()
      });

      if (!ref.current) return;
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset() as XYCoord;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      const hoverHeight = hoverBoundingRect.bottom - hoverBoundingRect.top;

      const hoverIndex = Math.floor(
        (hoverClientY / hoverHeight) * (visibleElements.length + 1)
      );

      // Gestisci hover sia per elementi nuovi che esistenti
      if (item.isNew) {
        // Solo aggiorna se non c'è un GridItem più specifico che gestisce l'hover
        if (!item.hoverParentId || item.hoverParentId === parentId) {
          item.hoverIndex = hoverIndex;
          item.hoverParentId = parentId;
          console.log('[Dropzone] hover - updating new item position', { hoverIndex, parentId });
        }
      } else {
        // Per elementi esistenti, aggiorna sempre la posizione di hover
        item.hoverIndex = hoverIndex;
        item.hoverParentId = parentId;
        console.log('[Dropzone] hover - updating existing item position', { hoverIndex, parentId });
      }
    },
    drop(item, monitor) {
      console.log('[Dropzone] drop attempt', {
        item,
        parentId,
        hoverIndex: item.hoverIndex,
        didDrop: monitor.didDrop(),
        isOverCurrent: monitor.isOver({ shallow: true })
      });

      // Solo gestisce il drop se nessun altro componente l'ha già gestito
      if (!monitor.didDrop()) {
        if (item.isNew) {
          console.log('[Dropzone] executing drop for new item');
          onDropItem(item, parentId, item.hoverIndex);
        } else {
          // Per elementi esistenti, li spostiamo nel nuovo contenitore
          console.log('[Dropzone] executing move for existing item');
          onDropItem(item, parentId, item.hoverIndex);
        }
        return { dropped: true };
      }
    },
    collect: (monitor) => {
      const isOverValue = monitor.isOver({ shallow: true });
      if (isOverValue || monitor.isOver()) {
        console.log('[Dropzone] collect - isOver state changed', {
          parentId,
          isOverShallow: isOverValue,
          isOverDeep: monitor.isOver(),
          item: monitor.getItem()
        });
      }
      return {
        isOver: isOverValue,
      };
    },
    canDrop: (item: any) => {
      console.log('[Dropzone] canDrop check', {
        itemIsNew: item.isNew,
        parentId,
        type
      });

      // Permettiamo drop sia per elementi nuovi che esistenti
      if (item.isNew) {
        console.log('[Dropzone] allowing drop for new item');
        return true;
      }

      // Permettiamo anche spostamento di elementi esistenti
      if (!item.isNew) {
        console.log('[Dropzone] allowing drop for existing item');
        return true;
      }

      console.log('[Dropzone] blocking drop - unknown item type');
      return false;
    },
  });
  const saveMutationContenutoAggiuntivo = useMutation({
    mutationFn: (data: ContenutoAggiuntivoReferenza[]) => {
      if (!data || data.length === 0) {
        console.error('Nessun contenuto da salvare');
        return Promise.reject('Nessun contenuto da salvare');
      }
      console.log('Salvataggio contenuti aggiuntivi:', data);
      return ServerCall.post(`/creaContenutiAggiuntiviReferenza`, data);
    },
    onSuccess: () => {
      // Optionally handle success (e.g., show a toast notification)
      r.revalidate();
    },
    onError: (error) => {
      console.error('Errore nel salvataggio:', error);
      // Optionally handle error (e.g., show error message)
    }
  });

  drop(ref);
  useAutoScroll(scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>);
  const config = useFetchConfig();
  // Funzione che aggiorna i settings di una pagina (es: la policy)
  const handleUpdatePageSettings = (pageId: string, newSettings: any) => {
    // 1) Aggiorniamo lo stato locale (pagesSettings)
    setPagesSettings((prevSettings) =>
      prevSettings.map((p) =>
        p.id === pageId ? { ...p, settings: newSettings } : p
      )
    );

    // 2) Aggiorniamo anche dataWorkspace.webpliant (in memoria), così
    //    quando andrai a salvare col mutation, troverai già i dati aggiornati.
    dataWorkspace.webpliant = dataWorkspace.webpliant.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          settings: newSettings,
        };
      }
      return page;
    });

    // 3) E infine chiamiamo updatePageSettings se vuoi fare altre azioni dal parent
    //    (tipo logging, dispatch a Redux, ecc.)
    if (updatePageSettings) {
      updatePageSettings(pageId, newSettings);
    }
  };


  /**
   * Rende una sezione di impostazioni per la pagina selezionata,
   * incluse le policy di visualizzazione
   */
  const renderImpostazioniPagina = (pagina: PaginaWebPliant) => {
    const pageInState = pagesSettings.find(p => p.id === pagina.id);
    if (!pageInState) return null;

    /**
     * Funzione per aggiornare la policy nel local state
     */
    const updatePagePolicy = (newPolicy: PolicyDiVisualizzazioneType) => {
      // unisci le impostazioni esistenti con la nuova policy
      handleUpdatePageSettings(pagina.id, {
        ...pageInState.settings,
        policy: newPolicy
      });
    };

    /**
     * Toggle del "locked" di policy (abilitazione/disabilitazione)
     */
    const handleTogglePolicyLocked = () => {
      const wasLocked = pageInState.settings.policy?.locked || false;
      const newPolicy: PolicyDiVisualizzazioneType = {
        ...pageInState.settings.policy,
        locked: !wasLocked,
        visualizzazione: pageInState.settings.policy?.visualizzazione || [],
        filtri_contenuto: pageInState.settings.policy?.filtri_contenuto || [],
      };
      updatePagePolicy(newPolicy);
    };

    const renderBaseSettings = () => (
      <div className="flex flex-col gap-2 mt-4 w-full">
        <PolicyDiVisualizzazione
          tipo_interazione={InteractionType.PAGES}
          locked={pageInState.settings.policy?.locked || false}
          oggettoPolicyDiVisualizzazione={pageInState.settings.policy as PolicyDiVisualizzazioneType}
          updatePolicy={updatePagePolicy}
          handlePolicyDiVisualizzazione={handleTogglePolicyLocked}
        />
      </div>
    );

    switch (pagina.tipo) {
      case TIPO_PAGINA.HOMEPAGE:
        return (
          <div className="flex flex-col gap-2 mt-4 w-full">
            <p>Impostazioni per la pagina <b>HOMEPAGE</b>.</p>
          </div>
        );
      case TIPO_PAGINA.CATEGORIA:
        return (
          <div className="flex flex-col gap-2 mt-4 w-full">
            <p>Impostazioni per la pagina <b>CATEGORIA</b>.</p>
            {renderBaseSettings()}
          </div>
        );
      case TIPO_PAGINA.PRODOTTO:
        return (
          <div className="flex flex-col gap-2 mt-4 w-full">
            <p>Impostazioni per la pagina <b>PRODOTTO</b>.</p>
            {renderBaseSettings()}
          </div>
        );
      case TIPO_PAGINA.RICETTA:
        return (
          <div className="flex flex-col gap-2 mt-4 w-full">
            <p>Impostazioni per la pagina <b>RICETTA</b>.</p>
            {renderBaseSettings()}
          </div>
        );
      case TIPO_PAGINA.RICETTA_AI:
        return (
          <div className="flex flex-col gap-2 mt-4 w-full">
            <p>Impostazioni per la pagina <b>RICETTA AI</b>.</p>
            {renderBaseSettings()}
          </div>
        );
      case TIPO_PAGINA.PROMOZIONE:
        return (
          <div className="flex flex-col gap-2 mt-4 w-full">
            <p>Impostazioni per la pagina <b>PROMOZIONE</b>.</p>
            {renderBaseSettings()}
          </div>
        );
      default:
        return (
          <div className="flex flex-col gap-2 mt-4 w-full">
            <p>Impostazioni per la pagina selezionata:</p>
            {renderBaseSettings()}
          </div>
        );
    }
  };
  const treatLogoUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const guidId = urlObj.searchParams.get("guidId");
      if (!guidId) return "";
      return guidId;
    } catch (error) {
      console.error("Invalid URL:", url);
      return url;
    }
  }
  // Se parentId == "" => root => mostriamo tab Editor / Anteprima / Impostazioni
  if (parentId === "") {
    function handleUpdateRegola(guidId: string, ruleIndex: number, field: string, value: string): void {
      setSelectedContenutoAggiuntivo((prev) => {
        if (!prev || prev.guidId !== guidId) return prev;

        const updatedRegole = [...prev.regole];
        updatedRegole[ruleIndex] = {
          ...updatedRegole[ruleIndex],
          [field]: field === "operator" ? (value as "equal" | "not-equal" | "greater-than" | "less-than" | "contains" | "startsWith" | "endsWith") : value,
        } as typeof updatedRegole[number];

        return {
          ...prev,
          regole: updatedRegole,
        };
      });
    }
    function handleAddRegola(guidId: string): void {
      setSelectedContenutoAggiuntivo((prev) => {
        if (!prev || prev.guidId !== guidId) return prev;

        const updatedRegole = [
          ...prev.regole,
          {
            field: "",
            operator: "equal" as const, // Default to a valid operator
            value: "",
          },
        ];

        return {
          ...prev,
          regole: updatedRegole,
        };
      });
    }
    function handleRemoveRegola(guidId: string, ruleIndex: number): void {
      setSelectedContenutoAggiuntivo((prev) => {
        if (!prev || prev.guidId !== guidId) return prev;

        const updatedRegole = prev.regole.filter((_, index) => index !== ruleIndex) as typeof prev.regole;

        return {
          ...prev,
          regole: updatedRegole,
        };
      });
    }
    return (
      <>
        <Dialog
          open={openModaleContenutiAggiuntivi}
          onClose={() => { setOpenModaleContenutiAggiuntivi(false); setSelectedContenutoAggiuntivo(null); }}
          size="xl"
        >
          <Dialog.Panel>
            <Dialog.Title>
              Modifica Contenuto Aggiuntivo
            </Dialog.Title>
            <Dialog.Description>
              <div className="flex flex-col">
                <div>
                  <FormLabel htmlFor={`titolo_${selectedContenutoAggiuntivo?.guidId}`}>Titolo</FormLabel>
                  <FormInput id={`titolo_${selectedContenutoAggiuntivo?.guidId}`} value={selectedContenutoAggiuntivo?.titolo} onChange={(e) => {
                    if (selectedContenutoAggiuntivo) {
                      console.log('selectedContenutoAggiuntivo:', e.target.value);
                      setSelectedContenutoAggiuntivo({
                        ...selectedContenutoAggiuntivo,
                        titolo: e.target.value,
                      });
                    }
                  }} />
                </div>
                <div className="mt-4">
                  <FormLabel>Scegli logo</FormLabel>
                  <div className="flex flex-col gap-2">
                    <FormSelect
                      value={selectedContenutoAggiuntivo?.contenuto.logo}
                      onChange={(e) => {
                        if (selectedContenutoAggiuntivo) {
                          console.log('selectedContenutoAggiuntivo:', e.target.value);
                          setSelectedContenutoAggiuntivo({
                            ...selectedContenutoAggiuntivo,
                            contenuto: {
                              ...selectedContenutoAggiuntivo.contenuto,
                              logo: e.target.value,
                            },
                          });
                        }
                      }}
                    >
                      <option value=''>Seleziona logo</option>
                      <option value={"custom"}>Custom</option>
                      {allLoghi?.map((logo, i) => (
                        <option key={logo.guidId + i} value={logo.guidId}>
                          {logo.sigla}
                        </option>
                      ))}

                    </FormSelect>
                    {(selectedContenutoAggiuntivo?.contenuto.logo && selectedContenutoAggiuntivo.contenuto.logo != "custom") && (
                      <img
                        src={`${selectedContenutoAggiuntivo.contenuto.logo}`}
                        alt="Logo selezionato"
                        className="mt-2 w-32 h-32 object-contain border rounded"
                      />
                    )}
                    {selectedContenutoAggiuntivo?.contenuto.logo === "custom" && (
                      <Fragment>
                        <FormInput
                          placeholder='URL del logo'
                          value={selectedContenutoAggiuntivo?.contenuto.logoUrl}
                          onChange={(e) => {
                            if (selectedContenutoAggiuntivo) {
                              setSelectedContenutoAggiuntivo({
                                ...selectedContenutoAggiuntivo,
                                contenuto: {
                                  ...selectedContenutoAggiuntivo.contenuto,
                                  logoUrl: e.target.value,
                                },
                              });
                            }
                          }}
                        />
                        {selectedContenutoAggiuntivo?.contenuto.logoUrl && (
                          <img
                            src={selectedContenutoAggiuntivo.contenuto.logoUrl}
                            alt="Logo custom"
                            className="mt-2 w-32 h-32 object-contain border rounded"
                          />
                        )}
                        <FormLabel>Sfondo del logo</FormLabel>
                        <FormInput
                          type="color"
                          value={selectedContenutoAggiuntivo?.contenuto.sfondoLogo}
                          onChange={(e) => {
                            if (selectedContenutoAggiuntivo) {
                              setSelectedContenutoAggiuntivo({
                                ...selectedContenutoAggiuntivo,
                                contenuto: {
                                  ...selectedContenutoAggiuntivo.contenuto,
                                  sfondoLogo: e.target.value,
                                },
                              });
                            }
                          }}
                        />
                      </Fragment>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <FormLabel>Descrizione</FormLabel>
                  <ClassicEditor
                    value={selectedContenutoAggiuntivo?.contenuto.descrizione}
                    onChange={(data) => {
                      if (selectedContenutoAggiuntivo) {
                        selectedContenutoAggiuntivo.contenuto.descrizione = data;
                        setSelectedContenutoAggiuntivo(selectedContenutoAggiuntivo);
                      }
                    }}
                  />
                </div>
                <div className="mt-4">
                  <FormLabel>Regole</FormLabel>
                  {selectedContenutoAggiuntivo && selectedContenutoAggiuntivo.regole.length === 0 ? (
                    <EmptyState
                      title="Nessuna regola"
                      description="Non sono presenti regole per questo contenuto aggiuntivo"
                      icon="X"
                      buttonText='Aggiungi regola'
                      onButtonClick={() => handleAddRegola(selectedContenutoAggiuntivo?.guidId)}
                    />
                  ) : (
                    <div className="border overflow-hidden sm:rounded-md mt-4">
                      <div className='p-4'>
                        <Button
                          onClick={() => {
                            if (selectedContenutoAggiuntivo?.guidId) {
                              handleAddRegola(selectedContenutoAggiuntivo.guidId);
                            }
                          }}
                          variant="soft-primary"
                          size='sm'
                        >
                          Aggiungi regola
                        </Button>
                      </div>
                      <ul className="w-full divide-y divide-gray-200">
                        {selectedContenutoAggiuntivo?.regole.map((regola, ruleIndex) => (
                          <li key={ruleIndex} className="px-4 py-4 sm:px-6">
                            <FormLabel>Regola {ruleIndex + 1}</FormLabel>
                            <FormInline className='gap-2'>
                              <FormSelect

                                value={regola.field}
                                onChange={(e) =>
                                  handleUpdateRegola(
                                    selectedContenutoAggiuntivo.guidId,
                                    ruleIndex,
                                    'field',
                                    e.target.value
                                  )
                                }
                              >
                                <option value=''>Seleziona campo</option>
                                {config?.data?.webpliant.data_fields_refs.map((field) => (
                                  <option key={field.expected_output} value={field.expected_output}>{field.expected_output}</option>
                                ))}
                                <option key={"loghi"} value={"loghi"}>Loghi</option>
                              </FormSelect>
                              <FormSelect
                                value={regola.operator}
                                onChange={(e) =>
                                  handleUpdateRegola(
                                    selectedContenutoAggiuntivo.guidId,
                                    ruleIndex,
                                    'operator',
                                    e.target.value
                                  )
                                }
                              >
                                <option value='equal'>Uguale</option>
                                <option value='not-equal'>Diverso</option>
                                <option value='greater-than'>Maggiore di</option>
                                <option value='less-than'>Minore di</option>
                                <option value='contains'>Contiene</option>
                                <option value='startsWith'>Inizia con</option>
                                <option value='endsWith'>Termina con</option>
                              </FormSelect>
                              {regola.field === "loghi" && (
                                <FormSelect
                                  value={regola.value}
                                  onChange={(e) => {
                                    try {
                                      handleUpdateRegola(
                                        selectedContenutoAggiuntivo?.guidId || "",
                                        ruleIndex,
                                        'value',
                                        e.target.value || ""
                                      );
                                    } catch (error) {
                                      console.error("Invalid URL:", e.target.value);
                                    }
                                  }}
                                >
                                  <option value=''>Seleziona logo</option>
                                  {allLoghi?.map((logo, i) => (
                                    <option key={i} value={treatLogoUrl(logo.guidId)}>
                                      {logo.sigla}
                                    </option>
                                  ))}
                                </FormSelect>
                              )}
                              {regola.field !== "loghi" && (
                                <FormInput
                                  placeholder='Value'
                                  value={regola.value}
                                  onChange={(e) =>
                                    handleUpdateRegola(
                                      selectedContenutoAggiuntivo.guidId,
                                      ruleIndex,
                                      'value',
                                      e.target.value
                                    )
                                  }
                                />
                              )}
                              <Button
                                onClick={() =>
                                  handleRemoveRegola(
                                    selectedContenutoAggiuntivo.guidId,
                                    ruleIndex
                                  )
                                }
                                variant="soft-danger"
                                size='sm'
                              >
                                <Lucide icon='X' />
                              </Button>
                            </FormInline>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </Dialog.Description>
            <Dialog.Footer className="flex gap-2 justify-end">
              <Button onClick={() => { setOpenModaleContenutiAggiuntivi(false); }}>Chiudi</Button>
              <Button variant="primary" onClick={() => {
                saveMutationContenutoAggiuntivo.mutate([selectedContenutoAggiuntivo as ContenutoAggiuntivoReferenza]);
                setOpenModaleContenutiAggiuntivi(false);
              }}>Salva</Button>
            </Dialog.Footer>
          </Dialog.Panel>
        </Dialog>
        <Tab.Group>
          <div className="flex flex-col md:h-10 gap-y-3 md:items-center md:flex-row mb-4 mx-4">
            <Tab.List
              variant="boxed-tabs"
              className="text-center md:ml-auto bg-white box rounded-[0.6rem] border-slate-200 w-full"
            >
              <Tab>
                <Tab.Button className="w-full  text-slate-500 whitespace-nowrap rounded-[0.6rem]">
                  Editor
                </Tab.Button>
              </Tab>
              <Tab>
                <Tab.Button className="w-full  text-slate-500 whitespace-nowrap rounded-[0.6rem]">
                  Impostazioni
                </Tab.Button>
              </Tab>
              <Tab>
                <Tab.Button className="w-full  text-slate-500 whitespace-nowrap rounded-[0.6rem]">
                  Contenuti Aggiuntivi
                </Tab.Button>
              </Tab>
            </Tab.List>
          </div>
          <Tab.Panels>
            {/* ---------------------- EDITOR ---------------------- */}
            <Tab.Panel className="leading-relaxed">
              <div
                ref={(node) => {
                  drop(node);
                  dropzoneRef.current = node;
                }}
                className={clsx(
                  "flex-1 min-h-[150px] p-2 transition-all duration-300 relative rounded-lg border-2 border-dashed",
                  {
                    "border-primary bg-primary/5 ring-2 ring-primary/20 ring-offset-2": isOver,
                    "border-slate-200 bg-slate-50/50": !isOver,
                    "cursor-grab": activeTool === "move",
                  }
                )}
              >
                {visibleElements.length > 0 ? (
                  visibleElements.map((element, index) => (
                    <motion.div
                      key={element.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <GridItem
                        activeTool={activeTool || ""}
                        element={element}
                        onRemove={onRemove}
                        onPolicy={onPolicy}
                        onLock={onLock}
                        idArea={idArea}
                        idCanale={idCanale}
                        idWorkspace={idWorkspace}
                        policyAttiva={element.policy?.locked || false}
                        user_locked={element.user_locked || {
                          locked: false,
                          user_id: "",
                        }}
                        updateElementContent={updateElementContent}
                        onDropItem={onDropItem}
                        moveElement={handleMoveElement}
                        index={index}
                        parentId={parentId}
                        selectedElementId={selectedElementId}
                        setSelectedElementId={setSelectedElementId}
                        user_list={user_list}
                        config={config?.data || undefined}
                        scrollContainerRef={scrollContainerRef}
                      />
                    </motion.div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center mt-2 flex items-center justify-center h-full">
                    <Lucide icon="Move" className="w-5 h-5 mr-2" />
                    <span>Trascina qui i componenti</span>
                  </div>
                )}
              </div>
            </Tab.Panel>

            {/* ---------------------- IMPOSTAZIONI ---------------------- */}
            <Tab.Panel className="flex flex-col xl:flex-row gap-2 p-1.5 leading-relaxed w-full">
              {pages && typeof selectedPageIndex !== "undefined"
                ? renderImpostazioniPagina(pages[selectedPageIndex])
                : null}
            </Tab.Panel>

            {/* ---------------------- CONTENUTI AGGIUNTIVI ---------------------- */}
            <Tab.Panel className="p-6">
              <div className="flex justify-end mb-4">
                <Button onClick={() => {
                  setSelectedContenutoAggiuntivo({
                    guidId: "",
                    titolo: "",
                    regole: [],
                    contenuto: {
                      descrizione: "",
                    },
                  });
                  setOpenModaleContenutiAggiuntivi(true);
                }}>Aggiungi contenuto aggiuntivo</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contenutiAggiuntivi?.map((ca) => (
                  <div
                    key={ca.guidId}
                    onClick={() => {
                      setSelectedContenutoAggiuntivo(ca);
                      setOpenModaleContenutiAggiuntivi(true);
                    }}
                    className="p-6 hover:cursor-pointer bg-white dark:bg-darkmode-700 flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-300"
                  >
                    {/* Header */}
                    <header className="mb-4">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 break-words">
                        {ca.titolo ?? "Titolo"}
                      </h3>
                    </header>

                    {/* Body */}
                    <section className="flex-grow">
                      <h5 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
                        Regole
                      </h5>
                      <ul className="space-y-2">
                        {ca.regole.length > 0 ? (
                          ca.regole.map((r, i) => (
                            <li
                              key={i}
                              className="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 text-sm text-gray-700 dark:text-gray-200 break-words"
                            >
                              <span className="font-medium md:w-2/4">{r.field}</span>
                              <span className="md:w-1/4">{r.operator}</span>
                              <span className="italic md:w-1/4">{r.value}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-gray-500 dark:text-gray-400 italic">
                            Nessuna regola presente
                          </li>
                        )}
                      </ul>
                    </section>
                    {/* Footer (opzionale) */}
                    <footer className="mt-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        Visualizza dettagli
                      </button>
                    </footer>
                  </div>
                ))}
              </div>

            </Tab.Panel>

          </Tab.Panels>
        </Tab.Group>
      </>
    );
  } else {
    // Dropzone annidata (row o column)
    return (
      <div
        ref={drop as any}
        className={clsx(
          "flex-1 overflow-auto",
          "relative p-4 border-[1px] border-primary border-opacity-50 border-dashed rounded-lg bg-white min-h-[150px] transition-colors duration-200",
          {
            "border-blue-400 bg-blue-50": isOver,
            "border-gray-300": !isOver,
            "flex flex-row gap-4": type === "row",
            "flex flex-col gap-4": type === "column",
            "cursor-grab": activeTool === "move",
          }
        )}
      >
        {visibleElements.length > 0 ? (
          visibleElements.map((element, index) => (
            <motion.div
              key={element.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <GridItem
                activeTool={activeTool || ""}
                element={element}
                onRemove={onRemove}
                onPolicy={onPolicy}
                onLock={onLock}
                idArea={idArea}
                idCanale={idCanale}
                idWorkspace={idWorkspace}
                policyAttiva={element.policy?.locked || false}
                user_locked={element.user_locked || {
                  locked: false,
                  user_id: "",
                }}
                updateElementContent={updateElementContent}
                onDropItem={onDropItem}
                moveElement={handleMoveElement}
                index={index}
                parentId={parentId}
                selectedElementId={selectedElementId}
                setSelectedElementId={setSelectedElementId}
                user_list={user_list}
                config={config.data || undefined}
                scrollContainerRef={scrollContainerRef}
              />
            </motion.div>
          ))
        ) : (
          <div className="text-gray-500 text-center flex items-center justify-center h-full">
            <Lucide icon="Move" className="w-5 h-5 mr-2" />
            <span>Trascina qui i componenti</span>
          </div>
        )}
      </div>
    );
  }
};

export default Dropzone;
