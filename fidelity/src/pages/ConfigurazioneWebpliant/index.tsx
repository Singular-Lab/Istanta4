import Alert from '@/components/Base/Alert';
import BarraFiltri from '@/components/Base/BarraFiltri';
import Button from '@/components/Base/Button';
import CampoRicerca from '@/components/Base/CampoRicerca';
import { FormField, FormInput, FormSelect } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import Pagina from '@/components/Base/Pagina';
import Sezione from '@/components/Base/Sezione';
import StatusBadge from '@/components/Base/StatusBadge';
import EmptyState from '@/components/EmptyState';
import withSessionCheck from "@/components/SessionChecker";
import { useNotification } from '@/context/NotificationContext';
import { useFetchAree, useFetchCanali } from '@/query/query';
import Editor from '@monaco-editor/react';
import { useMutation } from '@tanstack/react-query';
import beautify from 'js-beautify';
import { ChevronDown, ChevronUp, Edit, Plus, Trash, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router-dom';
import { ServerCall } from '../../../lib/server_call';
import { Config, LoghiInsegne } from '../../../lib/types';
import EditorStiliReferenza from './sub-components/EditorStiliReferenza';

const cssBeautify = beautify.css;

const ConfigurazioneWebpliant: React.FC = () => {
  // ------------------------------
  // 1) CARICAMENTO DATI
  // ------------------------------
  const { config } = useLoaderData() as { config: Config };
  const { showNotification } = useNotification();

  // ------------------------------
  // 2) STATE GENERALI
  // ------------------------------
  const [cssText, setCssText] = useState(config?.webpliant.css_text || '');
  const [iconaPagina, setIconaPagina] = useState<string | null>(config?.webpliant.icona_pagina || null);
  const [colorGDO, setColorGDO] = useState<string | null>(config?.webpliant.color_gdo || null);
  const [logos, setLogos] = useState<LoghiInsegne[]>(config?.webpliant.logo_header || []);
  const editorRef = useRef<any>(null);
  const stylesEditorRef = useRef<any>(null);
  const inputIconaRef = useRef<HTMLInputElement>(null);
  const inputLogoRef = useRef<HTMLInputElement>(null);
  const revalidator = useRevalidator();

  const canali = useFetchCanali();
  const aree = useFetchAree();

  // ------------------------------
  // 3) STATE PER GLI STILI
  // ------------------------------
  const [styles, setStyles] = useState(config?.webpliant.stili || []);
  const [stylesJSONText, setStylesJSONText] = useState('');

  // ------------------------------
  // 4) PRIMO CARICAMENTO
  // ------------------------------
  useEffect(() => {
    if (config.webpliant.css_text) {
      setCssText(cssBeautify(config.webpliant.css_text, { indent_size: 2 }));
    }
    setColorGDO(config.webpliant.color_gdo);
    setIconaPagina(config.webpliant.icona_pagina);
    setLogos(config.webpliant.logo_header || []);

    // Inizializza il testo JSON per gli stili
    if (config.webpliant.stili) {
      setStylesJSONText(JSON.stringify(config.webpliant.stili, null, 2));
    }
  }, [config]);

  // ------------------------------
  // CRUD functions per i loghi
  // ------------------------------
  const handleAddLogo = (base64: string) => {
    const newLogo: LoghiInsegne = {
      url: '',
      base64,
      idCanale: '',
      idArea: '',
      idPv: '',
    };
    setLogos(prev => [...prev, newLogo]);
  };

  const handleRemoveLogo = (index: number) => {
    setLogos(prev => prev?.filter((_, i) => i !== index));
  };

  const handleUpdateLogo = (index: number, newBase64: string) => {
    setLogos(prev =>
      prev.map((logo, i) => (i === index ? { ...logo, base64: newBase64 } : logo))
    );
  };

  // Gestione file input per aggiunta
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result;
        if (typeof base64 === 'string') {
          const cleanBase64 = base64.replace(/^data:.+;base64,/, '');
          handleAddLogo(cleanBase64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Gestione file input per aggiornamento
  const handleLogoUpdateFileChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result;
        if (typeof base64 === 'string') {
          const cleanBase64 = base64.replace(/^data:.+;base64,/, '');
          handleUpdateLogo(index, cleanBase64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // ------------------------------
  // 5) MUTATION PER IL SALVATAGGIO
  // ------------------------------
  const mutationCSSTEXT = useMutation({
    mutationFn: async (data: { css: string; stili: any[]; logos: LoghiInsegne[], dataFields?: { expected_input: string; expected_output: string }[] }) => {
      const result = await ServerCall.post('/saveWebpliantConfig', {
        ...config,
        webpliant: {
          ...config.webpliant,
          logo_header: logos,
          color_gdo: colorGDO,
          icona_pagina: iconaPagina,
          css_text: data.css,
          stili: data.stili,
          data_fields_refs: data.dataFields,
        }
      });
      return result;
    },
    onError: () => {
      showNotification("Errore durante il salvataggio: si è verificato un problema. Riprova più tardi.", { variant: "error" });
    },
    onSuccess: () => {
      showNotification("Salvataggio completato con successo", { variant: "success" });
      revalidator.revalidate();
    },
  });

  const handleSave = () => {
    if (editorRef.current) {
      const currentCSS = editorRef.current.getValue();

      let parsedStyles = styles; // fallback

      try {
        parsedStyles = JSON.parse(stylesJSONText);
      } catch (error) {
        console.error('Errore nel parsing JSON degli stili:', error);
        showNotification("Errore nel formato JSON: controlla il contenuto JSON prima di salvare.", { variant: "error" });
        return; // blocca il salvataggio
      }

      mutationCSSTEXT.mutate({
        css: currentCSS,
        stili: parsedStyles,
        logos,
      });
    }
  };

  const DataFieldsManager = () => {
    const [dataFields, setDataFields] = useState(config?.webpliant.data_fields_refs || []);
    const [newFieldInput, setNewFieldInput] = useState('');
    const [newFieldOutput, setNewFieldOutput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingFieldInput, setEditingFieldInput] = useState('');
    const [editingFieldOutput, setEditingFieldOutput] = useState('');

    // Aggiunge un nuovo campo
    const handleAddField = () => {
      if (!newFieldInput.trim() || !newFieldOutput.trim()) return;
      if (dataFields.some(field => field.expected_input === newFieldInput.trim() || field.expected_output === newFieldOutput.trim())) {
        showNotification("Campo già esistente: un campo con questo input o output è già presente nell'elenco.", { variant: "warning" });
        return;
      }

      setDataFields([...dataFields, { expected_input: newFieldInput.trim(), expected_output: newFieldOutput.trim(), core: false }]);
      setNewFieldInput('');
      setNewFieldOutput('');
    };

    // Rimuove un campo
    const handleRemoveField = (index: number) => {
      const field = dataFields[index];
      if (field.core) {
        showNotification("Campo core non eliminabile: i campi core sono essenziali e non possono essere rimossi.", { variant: "warning" });
        return;
      }
      setDataFields(dataFields?.filter((_, i) => i !== index));
    };

    // Muove un campo verso l'alto
    const handleMoveUp = (index: number) => {
      if (index === 0) return;
      const newFields = [...dataFields];
      [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
      setDataFields(newFields);
    };

    // Muove un campo verso il basso
    const handleMoveDown = (index: number) => {
      if (index === dataFields.length - 1) return;
      const newFields = [...dataFields];
      [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
      setDataFields(newFields);
    };

    // Inizia l'editing di un campo
    const handleStartEdit = (index: number) => {
      const field = dataFields[index];
      if (field.core) {
        showNotification("Campo core non modificabile: i campi core sono essenziali e non possono essere modificati.", { variant: "warning" });
        return;
      }
      setEditingIndex(index);
      setEditingFieldInput(dataFields[index].expected_input);
      setEditingFieldOutput(dataFields[index].expected_output);
    };

    // Salva le modifiche dell'editing
    const handleSaveEdit = () => {
      if (!editingFieldInput.trim() || !editingFieldOutput.trim()) return;

      // Controlla duplicati escludendo il campo in editing
      const isDuplicate = dataFields.some((field, index) =>
        index !== editingIndex &&
        (field.expected_input === editingFieldInput.trim() || field.expected_output === editingFieldOutput.trim())
      );

      if (isDuplicate) {
        showNotification("Campo già esistente: un campo con questo input o output è già presente nell'elenco.", { variant: "warning" });
        return;
      }

      const newFields = [...dataFields];
      newFields[editingIndex!] = {
        expected_input: editingFieldInput.trim(),
        expected_output: editingFieldOutput.trim(),
        core: newFields[editingIndex!].core // mantiene lo stato core
      };
      setDataFields(newFields);
      handleCancelEdit();
    };

    // Annulla l'editing
    const handleCancelEdit = () => {
      setEditingIndex(null);
      setEditingFieldInput('');
      setEditingFieldOutput('');
    };

    // Filtra i campi in base al termine di ricerca
    const filteredFields = dataFields?.filter(field =>
      field.expected_input?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.expected_output?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Salva i campi quando viene salvato il form principale
    useEffect(() => {
      // Aggiorna i dataFields nel config quando il form principale viene salvato
      const originalMutate = mutationCSSTEXT.mutate;
      mutationCSSTEXT.mutate = (data) => {
        return originalMutate({
          ...data,
          dataFields: dataFields || [],
        });
      };

      return () => {
        mutationCSSTEXT.mutate = originalMutate;
      };
    }, [dataFields]);

    return (
      <Sezione
        titolo="Mapping traduzione DataFields"
        descrizione={
          <>
            Gestisci le mappature di traduzione tra i campi originali delle referenze e i campi utilizzati nel webpliant.
            Ogni mapping specifica come tradurre un campo da input (nome originale) a output (nome tradotto).
            <span className="font-medium text-primary"> I campi core sono essenziali e non possono essere modificati.</span>
          </>
        }
      >
        {/* Form di aggiunta */}
        <div className="mb-5 flex flex-col gap-4 rounded-card border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField etichetta="Campo originale (input)">
              <FormInput
                type="text"
                placeholder="es. titolo, prezzo, descrizione..."
                value={newFieldInput}
                onChange={(e) => setNewFieldInput(e.target.value)}
              />
            </FormField>
            <FormField etichetta="Campo tradotto (output)">
              <FormInput
                type="text"
                placeholder="es. title, price, description..."
                value={newFieldOutput}
                onChange={(e) => setNewFieldOutput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddField();
                  }
                }}
              />
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline-secondary"
              onClick={handleAddField}
              disabled={!newFieldInput.trim() || !newFieldOutput.trim() || editingIndex !== null}
            >
              <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
              Aggiungi mapping di traduzione
            </Button>
          </div>
          {editingIndex !== null && (
            <Alert variant="soft-warning" icona="TriangleAlert">
              Completa la modifica del campo in corso prima di aggiungerne uno nuovo.
            </Alert>
          )}
        </div>

        {/* Ricerca ed elenco dei campi */}
        <div className="rounded-card border border-slate-200 bg-white">
          <BarraFiltri
            className="p-4"
            destra={
              <span className="text-sm text-slate-500">
                Totale: <span className="tabular-nums">{dataFields.length}</span> mapping, di cui core: <span className="tabular-nums">{dataFields.filter(f => f.core).length}</span>
              </span>
            }
          >
            <CampoRicerca
              etichetta="Cerca campi"
              placeholder="Cerca campi…"
              value={searchTerm}
              onChange={setSearchTerm}
              disabled={editingIndex !== null}
              title={editingIndex !== null ? "La ricerca è disabilitata durante la modifica" : undefined}
            />
          </BarraFiltri>
          <div className="max-h-96 overflow-y-auto">
            {filteredFields.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {filteredFields.map((field, index) => {
                  const originalIndex = dataFields.findIndex(f => f.expected_input === field.expected_input && f.expected_output === field.expected_output);
                  const isEditing = editingIndex === originalIndex;
                  const isCore = field.core === true;

                  return (
                    <li key={index} className={`p-4 transition-colors ${isEditing ? 'border-l-4 border-primary bg-primary/5' : isCore ? 'border-l-4 border-info bg-info/5' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-grow space-y-2">
                          {/* Badge per campo core */}
                          {isCore && (
                            <div className="mb-2 flex items-center gap-2">
                              <StatusBadge tono="info" etichetta="Campo core" icon="Shield" />
                              <span className="text-sm text-slate-500">
                                Questo campo è essenziale e non può essere modificato
                              </span>
                            </div>
                          )}

                          {isEditing ? (
                            // Modalità editing
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <FormField etichetta="Campo originale">
                                  <FormInput
                                    type="text"
                                    value={editingFieldInput}
                                    onChange={(e) => setEditingFieldInput(e.target.value)}
                                    placeholder="es. titolo, prezzo..."
                                    disabled={isCore}
                                  />
                                </FormField>
                                <FormField etichetta="Campo tradotto" aiuto="Premi Invio per salvare, Esc per annullare.">
                                  <FormInput
                                    type="text"
                                    value={editingFieldOutput}
                                    onChange={(e) => setEditingFieldOutput(e.target.value)}
                                    disabled={isCore}
                                    placeholder="es. title, price..."
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveEdit();
                                      } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        handleCancelEdit();
                                      }
                                    }}
                                  />
                                </FormField>
                              </div>
                              <div className="flex items-center gap-2">
                                {isCore && (
                                  <span className="text-sm font-medium text-info">
                                    Questo campo è core e non può essere modificato
                                  </span>
                                )}
                                <Button
                                  variant="outline-secondary"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  disabled={isCore}
                                >
                                  <X aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                  Annulla
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={handleSaveEdit}
                                  disabled={!editingFieldInput.trim() || !editingFieldOutput.trim() || isCore}
                                >
                                  <Lucide icon="Check" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                  Salva
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // Modalità visualizzazione
                            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <dt className="title-eyebrow mb-1">Campo originale</dt>
                                <dd className={`rounded-control px-3 py-2 font-mono text-sm ${isCore ? 'border border-info/20 bg-info/10 text-info' : 'bg-slate-100 text-slate-700'}`}>
                                  {field.expected_input}
                                </dd>
                              </div>
                              <div>
                                <dt className="title-eyebrow mb-1">Campo tradotto</dt>
                                <dd className={`rounded-control px-3 py-2 font-mono text-sm ${isCore ? 'border border-info/20 bg-info/10 text-info' : 'bg-slate-100 text-slate-700'}`}>
                                  {field.expected_output}
                                </dd>
                              </div>
                            </dl>
                          )}

                          {!isEditing && (
                            <div className="text-sm text-slate-400">
                              {field.expected_input} → {field.expected_output}
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="ml-4 flex items-center gap-1">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleStartEdit(originalIndex)}
                              title={isCore ? "Campo core non modificabile" : "Modifica"}
                              aria-label={`Modifica il mapping ${field.expected_input}`}
                              disabled={isCore}
                            >
                              <Edit aria-hidden="true" className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleMoveUp(originalIndex)}
                              disabled={originalIndex === 0 || editingIndex !== null}
                              title={editingIndex !== null ? "Disabilitato durante modifica" : "Sposta su"}
                              aria-label={`Sposta su ${field.expected_input}`}
                            >
                              <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleMoveDown(originalIndex)}
                              disabled={originalIndex === dataFields.length - 1 || editingIndex !== null}
                              title={editingIndex !== null ? "Disabilitato durante modifica" : "Sposta giù"}
                              aria-label={`Sposta giù ${field.expected_input}`}
                            >
                              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleRemoveField(originalIndex)}
                              disabled={editingIndex !== null || isCore}
                              title={isCore ? "Campo core non eliminabile" : editingIndex !== null ? "Disabilitato durante modifica" : "Elimina"}
                              aria-label={`Elimina il mapping ${field.expected_input}`}
                            >
                              <Trash aria-hidden="true" className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState
                compatta
                icon="SearchX"
                title="Nessun campo trovato"
                description="Aggiungi mapping di traduzione per i campi del webpliant"
              />
            )}
          </div>
        </div>
      </Sezione>
    );
  };



  // ------------------------------
  // RENDER: WRAPPER PRINCIPALE
  // ------------------------------
  return (
    <Pagina titolo="Configurazione Webpliant" descrizione="Parametri, loghi, stili e CSS del volantino digitale">
      {/* PARAMETRI GENERALI */}
      <Sezione titolo="Parametri generali">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {/* Icona pagina */}
          <div className="flex flex-col rounded-card border border-slate-200 bg-white p-4">
            <h3 className="title-card mb-3">Icona pagina</h3>
            <div className="relative w-fit rounded-control border border-slate-200 bg-white p-3">
              {!iconaPagina ? (
                <div className="flex h-44 w-44 flex-col items-center justify-center gap-3 rounded-control border-2 border-dashed border-slate-300">
                  <Lucide icon="Image" aria-hidden="true" className="h-10 w-10 text-slate-400" />
                  <input
                    ref={inputIconaRef}
                    type="file"
                    accept="image/*"
                    aria-label="File dell'icona pagina"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const base64 = ev.target?.result;
                          if (typeof base64 === 'string') {
                            setIconaPagina(
                              base64.replace(/^data:.+;base64,/, '')
                            );
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                    id="icona-pagina-input"
                  />
                  <Button size="sm" variant="outline-secondary" onClick={() => inputIconaRef.current?.click()}>
                    Seleziona file
                  </Button>
                </div>
              ) : (
                <img
                  src={`${iconaPagina}`}
                  alt="Icona pagina"
                  className="h-44 w-44 rounded-control object-contain"
                />
              )}
              {iconaPagina && (
                <Button
                  onClick={() => setIconaPagina(null)}
                  size="sm"
                  variant="outline-danger"
                  className="absolute right-2 top-2 rounded-full bg-white p-1.5"
                  aria-label="Rimuovi icona pagina"
                >
                  <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Icona usata come favicon o simbolo pagina.
            </p>
          </div>

          {/* Colore GDO */}
          <div className="flex flex-col rounded-card border border-slate-200 bg-white p-4">
            <h3 className="title-card mb-3">Colore GDO</h3>
            <div className="flex items-center gap-3">
              <FormInput
                type="color"
                aria-label="Colore GDO"
                value={colorGDO || '#000000'}
                onChange={(e) => setColorGDO(e.target.value)}
                className="h-8 w-16 p-1"
              />
              <span className="font-mono text-sm">{colorGDO || '#000000'}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Colore principale applicato al brand GDO.
            </p>
          </div>
        </div>
      </Sezione>

      {/* LOGHI */}
      <Sezione
        titolo="Loghi"
        descrizione="Aggiungi, rimuovi o modifica i loghi in formato Base64, caricando le immagini dal tuo dispositivo."
      >
        <div className="flex max-h-96 flex-wrap gap-4 overflow-y-auto">
          {logos &&
            logos.map((logo, index) => (
              <div
                key={index}
                className="group relative w-fit rounded-card border border-slate-200 bg-white p-3"
              >
                <img
                  src={
                    logo.url
                      ? `${logo.url}`
                      : logo.base64 ? `data:image/*;base64,${logo.base64}`
                        : ''
                  }
                  alt={`Logo ${index + 1}`}
                  className="h-60 w-60 rounded-control object-contain"
                />
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    className="bg-white"
                    aria-label={`Sostituisci logo ${index + 1}`}
                    onClick={() => document.getElementById(`update-logo-${index}`)?.click()}
                  >
                    <Edit aria-hidden="true" className="h-3.5 w-3.5" />
                  </Button>
                  <input
                    type="file"
                    id={`update-logo-${index}`}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpdateFileChange(index, e)}
                  />
                  <Button
                    size="sm"
                    variant="outline-danger"
                    className="bg-white"
                    onClick={() => handleRemoveLogo(index)}
                    aria-label={`Rimuovi logo ${index + 1}`}
                  >
                    <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-2 flex justify-between gap-2">
                  <FormSelect
                    formSelectSize="sm"
                    aria-label={`Canale del logo ${index + 1}`}
                    value={logo.idCanale}
                    onChange={(e) => {
                      const updatedLogos = [...logos];
                      updatedLogos[index].idCanale = e.target.value;
                      setLogos(updatedLogos);
                    }}
                  >
                    <option value="">Seleziona canale</option>
                    {canali?.data?.map((canale) => (
                      <option key={canale.id} value={canale.id}>
                        {canale.nome}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    formSelectSize="sm"
                    aria-label={`Area del logo ${index + 1}`}
                    value={logo.idArea}
                    onChange={(e) => {
                      const updatedLogos = [...logos];
                      updatedLogos[index].idArea = e.target.value;
                      setLogos(updatedLogos);
                    }}
                  >
                    <option value="">Seleziona area</option>
                    {aree?.data?.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.nome}
                      </option>
                    ))}
                  </FormSelect>
                </div>
                <div className="mt-2 w-60 truncate text-center text-xs text-slate-500">
                  Logo {index + 1}
                </div>
              </div>
            ))}
          <div className="flex h-44 w-44 flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-slate-300 p-4">
            <Lucide icon="ImagePlus" aria-hidden="true" className="h-8 w-8 text-slate-400" />
            <input
              ref={inputLogoRef}
              type="file"
              id="add-logo-input"
              accept="image/*"
              aria-label="File del nuovo logo"
              className="hidden"
              onChange={handleLogoFileChange}
            />
            <Button size="sm" variant="outline-secondary" onClick={() => inputLogoRef.current?.click()}>
              <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Aggiungi logo
            </Button>
          </div>
        </div>
      </Sezione>

      {/* STILI EDITOR */}
      <EditorStiliReferenza
        config={config}
        onChangeStili={(c) => {
          setStyles(c.webpliant.stili);
        }}
      />

      {/* CSS PERSONALIZZATO */}
      <Sezione
        titolo="CSS personalizzato"
        descrizione="Modifica il CSS per personalizzare lo stile della pagina. Usa Ctrl+S per salvare rapidamente."
      >
        <Editor
          theme="vs-dark"
          className="overflow-hidden rounded-control border border-slate-200"
          height="50vh"
          onChange={(val) => val && setCssText(val)}
          defaultLanguage="css"
          value={cssText}
          onMount={(editor) => {
            editorRef.current = editor;
          }}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </Sezione>

      <DataFieldsManager />

      <Sezione
        titolo="Stili JSON"
        descrizione="Modifica gli stili in formato JSON. Il parsing avviene solo al momento del salvataggio."
      >
        <Editor
          theme="vs-dark"
          className="overflow-hidden rounded-control border border-slate-200"
          height="50vh"
          defaultLanguage="json"
          value={stylesJSONText}
          onChange={(val) => val && setStylesJSONText(val)}
          options={{
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </Sezione>

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} loading={mutationCSSTEXT.isPending}>
          Salva
        </Button>
      </div>
    </Pagina>
  );
};

export default withSessionCheck(ConfigurazioneWebpliant);
