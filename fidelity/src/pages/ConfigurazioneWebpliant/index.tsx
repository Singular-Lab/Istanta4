import Button from '@/components/Base/Button';
import { FormInput, FormSelect } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import PageHeader from '@/components/Base/PageHeader';
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
      console.log({
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
      })
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
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleAlert" className="text-danger w-14 h-14" />
          <div className="ml-4">
            <div className="font-bold">Errore durante il salvataggio</div>
            <div className="mt-1 text-slate-500">
              Si è verificato un problema. Riprova più tardi.
            </div>
          </div>
        </div>
      );
    },
    onSuccess: () => {
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4">
            <div className="font-bold">Salvataggio completato con successo</div>
          </div>
        </div>
      );
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
        showNotification(
          <div className="flex items-center">
            <Lucide icon="CircleAlert" className="text-danger w-14 h-14" />
            <div className="ml-4">
              <div className="font-bold">Errore nel formato JSON</div>
              <div className="mt-1 text-slate-500">
                Controlla il contenuto JSON prima di salvare.
              </div>
            </div>
          </div>
        );
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
        showNotification(
          <div className="flex items-center">
            <Lucide icon="CircleAlert" className="text-warning w-6 h-6" />
            <div className="ml-4">
              <div className="font-medium">Campo già esistente</div>
              <div className="mt-1 text-slate-500">
                Un campo con questo input o output è già presente nell'elenco.
              </div>
            </div>
          </div>
        );
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
        showNotification(
          <div className="flex items-center">
            <Lucide icon="CircleAlert" className="text-warning w-6 h-6" />
            <div className="ml-4">
              <div className="font-medium">Campo core non eliminabile</div>
              <div className="mt-1 text-slate-500">
                I campi core sono essenziali e non possono essere rimossi.
              </div>
            </div>
          </div>
        );
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
        showNotification(
          <div className="flex items-center">
            <Lucide icon="CircleAlert" className="text-warning w-6 h-6" />
            <div className="ml-4">
              <div className="font-medium">Campo core non modificabile</div>
              <div className="mt-1 text-slate-500">
                I campi core sono essenziali e non possono essere modificati.
              </div>
            </div>
          </div>
        );
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
        showNotification(
          <div className="flex items-center">
            <Lucide icon="CircleAlert" className="text-warning w-6 h-6" />
            <div className="ml-4">
              <div className="font-medium">Campo già esistente</div>
              <div className="mt-1 text-slate-500">
                Un campo con questo input o output è già presente nell'elenco.
              </div>
            </div>
          </div>
        );
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
        console.log('Dati salvati con mapping di traduzione:', dataFields);
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
      <section className="mt-10">
        <h2 className="text-xl font-medium text-dark">Mapping Traduzione DataFields</h2>
        <p className="text-sm text-slate-500 mb-4">
          Gestisci le mappature di traduzione tra i campi originali delle referenze e i campi utilizzati nel webpliant.
          Ogni mapping specifica come tradurre un campo da input (nome originale) a output (nome tradotto).
          <span className="font-medium text-primary"> I campi core sono essenziali e non possono essere modificati.</span>
        </p>

        {/* Form di aggiunta */}
        <div className="space-y-4 mb-4 p-4 bg-light rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1">
                Campo Originale (Input)
              </label>
              <FormInput
                type="text"
                placeholder="es. titolo, prezzo, descrizione..."
                value={newFieldInput}
                onChange={(e) => setNewFieldInput(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1">
                Campo Tradotto (Output)
              </label>
              <FormInput
                type="text"
                placeholder="es. title, price, description..."
                value={newFieldOutput}
                onChange={(e) => setNewFieldOutput(e.target.value)}
                className="w-full"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddField();
                  }
                }}
              />
            </div>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={handleAddField}
            disabled={!newFieldInput.trim() || !newFieldOutput.trim() || editingIndex !== null}
          >
            <Plus className="w-5 h-5" />
            <span className="ml-1">
              {editingIndex !== null ? 'Completare modifica in corso...' : 'Aggiungi Mapping di Traduzione'}
            </span>
          </Button>
          {editingIndex !== null && (
            <div className="text-sm text-pending font-medium text-center">
              ⚠️ Completa la modifica del campo in corso prima di aggiungerne uno nuovo
            </div>
          )}
        </div>

        {/* Barra di ricerca */}
        <div className="mb-4">
          <FormInput
            type="text"
            placeholder="Cerca campi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            disabled={editingIndex !== null}
          />
          {editingIndex !== null && (
            <div className="text-sm text-slate-500 mt-1">
              La ricerca è disabilitata durante la modifica
            </div>
          )}
        </div>

        {/* Lista dei campi */}
        <div className="bg-white border border-light rounded-md">
          <div className="max-h-96 overflow-y-auto">
            {filteredFields.length > 0 ? (
              <ul className="divide-y divide-light">
                {filteredFields.map((field, index) => {
                  const originalIndex = dataFields.findIndex(f => f.expected_input === field.expected_input && f.expected_output === field.expected_output);
                  const isEditing = editingIndex === originalIndex;
                  const isCore = field.core === true;

                  return (
                    <li key={index} className={`p-4 transition-colors ${isEditing ? 'bg-primary/5 border-l-4 border-primary' : isCore ? 'bg-info/5 border-l-4 border-info' : 'hover:bg-light'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-grow space-y-2">
                          {/* Badge per campo core */}
                          {isCore && (
                            <div className="flex items-center gap-2 mb-2">
                              <div className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-info/10 text-info border border-info/20">
                                <Lucide icon="Shield" className="w-4 h-4 mr-1" />
                                Campo Core
                              </div>
                              <span className="text-sm text-info">
                                Questo campo è essenziale e non può essere modificato
                              </span>
                            </div>
                          )}

                          {isEditing ? (
                            // Modalità editing
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-semibold text-dark uppercase tracking-wide mb-1 block">
                                    Campo Originale
                                  </label>
                                  <FormInput
                                    type="text"
                                    value={editingFieldInput}
                                    onChange={(e) => setEditingFieldInput(e.target.value)}
                                    className="w-full"
                                    placeholder="es. titolo, prezzo..."
                                    disabled={isCore}
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-semibold text-dark uppercase tracking-wide mb-1 block">
                                    Campo Tradotto
                                  </label>
                                  <FormInput
                                    type="text"
                                    value={editingFieldOutput}
                                    onChange={(e) => setEditingFieldOutput(e.target.value)}
                                    className="w-full"
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
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {isCore && (
                                  <div className="text-sm text-info font-medium">
                                    ⚠️ Questo campo è core e non può essere modificato
                                  </div>
                                )}
                                <Button
                                  variant="primary"
                                  size="xs"
                                  onClick={handleSaveEdit}
                                  disabled={!editingFieldInput.trim() || !editingFieldOutput.trim() || isCore}
                                >
                                  <Lucide icon="Check" className="w-4 h-4" />
                                  <span className="ml-1">Salva</span>
                                </Button>
                                <Button
                                  variant="outline-secondary"
                                  size="xs"
                                  onClick={handleCancelEdit}
                                  disabled={isCore}
                                >
                                  <X className="w-4 h-4" />
                                  <span className="ml-1">Annulla</span>
                                </Button>
                              </div>
                              <div className="text-sm text-primary font-medium">
                                💡 Premi Enter per salvare, Esc per annullare
                              </div>
                            </div>
                          ) : (
                            // Modalità visualizzazione
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-semibold text-dark uppercase tracking-wide">
                                  Campo Originale
                                </label>
                                <div className={`font-mono text-sm px-3 py-2 rounded ${isCore ? 'bg-info/10 text-info border border-info/20' : 'bg-light text-dark'}`}>
                                  {field.expected_input}
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-semibold text-dark uppercase tracking-wide">
                                  Campo Tradotto
                                </label>
                                <div className={`font-mono text-sm px-3 py-2 rounded ${isCore ? 'bg-info/10 text-info border border-info/20' : 'bg-secondary text-dark'}`}>
                                  {field.expected_output}
                                </div>
                              </div>
                            </div>
                          )}

                          {!isEditing && (
                            <div className="text-sm text-slate-400">
                              {field.expected_input} → {field.expected_output}
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center space-x-1 ml-4">
                            <Button
                              variant="outline-primary"
                              size="xs"
                              onClick={() => handleStartEdit(originalIndex)}
                              title={isCore ? "Campo core non modificabile" : "Modifica"}
                              className={`hover:bg-primary/5 ${isCore ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={isCore}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="xs"
                              onClick={() => handleMoveUp(originalIndex)}
                              disabled={originalIndex === 0 || editingIndex !== null}
                              className={(originalIndex === 0 || editingIndex !== null) ? "opacity-50 cursor-not-allowed" : ""}
                              title={editingIndex !== null ? "Disabilitato durante modifica" : "Sposta su"}
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="xs"
                              onClick={() => handleMoveDown(originalIndex)}
                              disabled={originalIndex === dataFields.length - 1 || editingIndex !== null}
                              className={(originalIndex === dataFields.length - 1 || editingIndex !== null) ? "opacity-50 cursor-not-allowed" : ""}
                              title={editingIndex !== null ? "Disabilitato durante modifica" : "Sposta giù"}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="xs"
                              onClick={() => handleRemoveField(originalIndex)}
                              disabled={editingIndex !== null || isCore}
                              className={editingIndex !== null || isCore ? "opacity-50 cursor-not-allowed" : ""}
                              title={isCore ? "Campo core non eliminabile" : editingIndex !== null ? "Disabilitato durante modifica" : "Elimina"}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Lucide icon="SearchX" className="w-12 h-12 text-slate-400 mb-3" />
                <p className="text-slate-500">Nessun campo trovato.</p>
                <p className="text-sm text-slate-400 mt-1">
                  Aggiungi mapping di traduzione per i campi del webpliant
                </p>
              </div>
            )}
          </div>
          <div className="bg-light p-3 border-t border-light text-sm text-slate-500">
            <div className="flex justify-between items-center">
              <span>Totale: {dataFields.length} mapping di traduzione</span>
              <span className="text-info">
                Campi core: {dataFields.filter(f => f.core).length}
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  };



  // ------------------------------
  // RENDER: WRAPPER PRINCIPALE
  // ------------------------------
  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6 p-6">
      <div className="col-span-12">
        {/* HEADER GENERALE */}
        <PageHeader title="Configurazione Webpliant" />
        {/* WRAPPER CONTAINER */}
        <div className="box box--stacked p-10 bg-white rounded-lg shadow-sm">
          {/* PARAMETRI GENERALI */}
          <section className="mb-10 bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-2xl font-semibold mb-6 text-dark border-b pb-2">Parametri Generali</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {/* Colore GDO */}
              <div className="flex flex-col bg-gray-50 p-4 rounded-md border border-gray-100">
                <label className="block text-sm font-medium text-dark mb-2">
                  Icona pagina
                </label>
                <div className="relative w-fit bg-white border border-gray-200 rounded-md p-3 hover:shadow-md transition-shadow">
                  {!iconaPagina ? (
                    <div className="flex flex-col items-center justify-center w-44 h-44 border-2 border-dashed border-gray-300 rounded-md">
                      <Lucide icon="Image" className="w-10 h-10 text-gray-400 mb-2" />
                      <FormInput
                        formInputSize="sm"
                        type="file"
                        accept="image/*"
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
                      <label
                        htmlFor="icona-pagina-input"
                        className="bg-blue-600 text-white text-xs px-3 py-2 rounded cursor-pointer hover:bg-blue-700"
                      >
                        Seleziona file
                      </label>
                    </div>
                  ) : (
                    <img
                      src={`${iconaPagina}`}
                      alt="Icona pagina"
                      className="w-44 h-44 rounded-sm object-contain"
                    />
                  )}
                  {iconaPagina && (
                    <Button
                      onClick={() => setIconaPagina(null)}
                      size="xs"
                      variant="danger"
                      className="absolute top-2 right-2 p-1.5 text-xs rounded-full shadow-sm"
                    >
                      <Lucide icon="X" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-3 italic">
                  Icona usata come favicon o simbolo pagina.
                </p>
              </div>

              <div className="flex flex-col bg-gray-50 p-4 rounded-md border border-gray-100">
                <label className="block text-sm font-medium text-dark mb-2">
                  Colore GDO
                </label>
                <div className="flex items-center gap-3">
                  <FormInput
                    type="color"
                    value={colorGDO || '#000000'}
                    onChange={(e) => setColorGDO(e.target.value)}
                    className="w-16 h-8 border border-light rounded-md bg-light/80"
                  />
                  <span className="text-sm font-mono">{colorGDO || '#000000'}</span>
                </div>
                <p className="text-xs text-slate-500 mt-3 italic">
                  Colore principale applicato al brand GDO.
                </p>
              </div>

              {/* Loghi Base64 */}

            </div>
            <div className='mt-6'>
              <h2 className="text-xl font-medium text-dark mb-2">Loghi</h2>
              <p className="text-sm text-slate-500 mb-2">
                Aggiungi loghi in formato Base64. Puoi caricare immagini direttamente dal tuo dispositivo.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col box p-4">
                  <label className="block text-sm font-medium text-dark mb-2">
                    Loghi base64
                  </label>
                  <div className="flex flex-wrap gap-4 max-h-96 overflow-y-auto p-2">
                    {logos &&
                      logos.map((logo, index) => (
                        <div
                          key={index}
                          className="relative w-fit bg-white border border-gray-200 rounded-md p-3 hover:shadow-md transition-shadow group"
                        >
                          <img
                            src={
                              logo.url
                                ? `${logo.url}`
                                : logo.base64 ? `data:image/*;base64,${logo.base64}`
                                  : ''
                            }
                            alt={`Logo ${index + 1}`}
                            className="w-60 h-60 rounded-sm object-contain"
                          />
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <label
                              htmlFor={`update-logo-${index}`}
                              className="cursor-pointer"
                            >
                              <Button size="xs" variant="secondary" className="p-1.5 text-xs bg-white shadow-sm">
                                <Edit className="w-3 h-3" />
                              </Button>
                            </label>
                            <input
                              type="file"
                              id={`update-logo-${index}`}
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleLogoUpdateFileChange(index, e)}
                            />
                            <Button
                              size="xs"
                              variant="danger"
                              className="p-1.5 text-xs shadow-sm"
                              onClick={() => handleRemoveLogo(index)}
                            >
                              <Lucide icon="X" className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className='absolute bottom-0 left-0 right-0 flex gap-2 justify-between p-2'>
                            <FormSelect
                              value={logo.idCanale}
                              onChange={(e) => {
                                const updatedLogos = [...logos];
                                updatedLogos[index].idCanale = e.target.value;
                                setLogos(updatedLogos);
                              }}
                            >
                              <option value="">Seleziona Canale</option>
                              {canali?.data?.map((canale) => (
                                <option key={canale.id} value={canale.id}>
                                  {canale.nome}
                                </option>
                              ))}
                            </FormSelect>
                            <FormSelect
                              value={logo.idArea}
                              onChange={(e) => {
                                const updatedLogos = [...logos];
                                updatedLogos[index].idArea = e.target.value;
                                setLogos(updatedLogos);
                              }}
                            >
                              <option value="">Seleziona Area</option>
                              {aree?.data?.map((area) => (
                                <option key={area.id} value={area.id}>
                                  {area.nome}
                                </option>
                              ))}
                            </FormSelect>
                          </div>
                          <div className="text-xs text-center mt-2 text-gray-500 truncate w-44">
                            Logo {index + 1}
                          </div>

                        </div>
                      ))}
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-md p-4 w-44 h-44 hover:bg-gray-50 transition-colors">
                      <Lucide icon="Plus" className="w-8 h-8 text-gray-400 mb-2" />
                      <input
                        type="file"
                        id="add-logo-input"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoFileChange}
                      />
                      <label
                        htmlFor="add-logo-input"
                        className="bg-blue-600 text-white text-xs px-3 py-2 rounded cursor-pointer hover:bg-blue-700"
                      >
                        Aggiungi logo
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 italic">
                    Aggiungi, rimuovi o modifica i loghi in formato Base64.
                  </p>
                </div>
              </div>
            </div>
          </section>
          {/* STILI EDITOR */}
          <EditorStiliReferenza
            config={config}
            onChangeStili={(c) => {
              setStyles(c.webpliant.stili);
            }}
          />

          {/* CSS PERSONALIZZATO */}
          <section>
            <h2 className="text-xl font-medium text-dark">CSS Personalizzato</h2>
            <p className="text-sm text-slate-500 mb-2">
              Modifica il CSS per personalizzare lo stile della pagina. Usa Ctrl+S per salvare rapidamente.
            </p>
            <Editor
              theme="vs-dark"
              className="border border-light rounded-md"
              height="50vh"
              onChange={(val) => val && setCssText(val)}
              defaultLanguage="css"
              value={cssText}
              onMount={(editor, monaco) => {
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
            <div className="mt-2 flex justify-end">

            </div>
          </section>

          <section className="mt-10">
            <DataFieldsManager />
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-medium text-dark">Stili JSON</h2>
            <p className="text-sm text-slate-500 mb-2">
              Modifica gli stili in formato JSON. Il parsing avviene solo al momento del salvataggio.
            </p>
            <Editor
              theme="vs-dark"
              className="border border-light rounded-md"
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
          </section>


          <div className='flex justify-end mt-10'>
            <Button variant="success" onClick={handleSave}>
              Salva
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withSessionCheck(ConfigurazioneWebpliant);
