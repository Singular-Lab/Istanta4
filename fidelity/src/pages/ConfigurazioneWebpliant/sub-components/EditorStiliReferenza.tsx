import React, { useState, useEffect, Fragment } from 'react';
import { Listbox, Transition, Disclosure } from '@headlessui/react';
import { ChevronDown, Trash2, Plus, SlidersHorizontal, Tag, Filter, Code, Eye, Check, Paintbrush, List, TextSelect } from 'lucide-react';
import Button from '@/components/Base/Button';
import { FormInput, FormLabel } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import BoxRef from '@/pages/WebPliant/BoxRef';
import { Config, ConfigWebpliant, ReferenzeIstanta, StileBoxReferenza, Struttura, ClassiCssCondizionali } from '../../../../lib/types';
import Popover from '@/components/Base/Headless/Popover';

/* ──────────────────────────────────────────────────────────────── */
/*                             INTERFACES                           */
/* ──────────────────────────────────────────────────────────────── */
interface Condition {
  nome_campo: string;
  valori: string[];
  operatore?: string;
  valore?: any;
}

// Estendo l'interfaccia Struttura esistente per aggiungere il campo is_core
interface StrutturaCore extends Struttura {
  is_core?: boolean;
  figli?: (StrutturaCore | string)[];
}

// Template per nuove strutture CORE
const CORE_TEMPLATE: StrutturaCore = {
  tag: "div",
  classi_css: ["wp-product-card"],
  is_core: true,
  figli: [
    {
      tag: "div", 
      classi_css: ["wp-pc__img-wrapper"],
      is_core: true,
      figli: [
        {
          tag: "img",
          classi_css: ["p-[30px]", "wp-pc__img", "wp-object-contain"],
          attributi: {
            "loading": "lazy",
            "src": "{foto}",
            "width": "330", 
            "height": "400",
            "alt": "{descrizione}"
          },
          is_core: true
        }
      ]
    },
    {
      tag: "div",
      classi_css: ["wp-pc__info", "text-justify"],
      is_core: true,
      figli: [
        {
          tag: "div",
          classi_css: ["boxref_price", "mb-2", "flex", "text-justify", "wp-align-items-baseline"],
          is_core: true,
          figli: [
            {
              tag: "span",
              classi_css: ["ref_price_euro_size", "text-dark", "font_color"],
              contenuto: "€",
              is_core: true
            },
            {
              tag: "prezzo-euro", 
              classi_css: ["text-dark", "font_color_{descrizione_reparto}"],
              contenuto: "{prezzo_offerta}",
              html_puro: true,
              is_core: true,
              divisione_contenuto: {
                actions: [
                  { comportamento: "untilFind", charachter: ",", tag: "prezzo_intero" },
                  { comportamento: "getChar", charachter: ",", tag: "separatore_decimale" },
                  { comportamento: "rest", tag: "prezzo_centesimi" }
                ]
              }
            }
          ]
        },
        {
          tag: "descrizione-referenza",
          classi_css: ["text-dark", "wp-pc__desc", "font_color_{descrizione_reparto}", "boxref_descrizione", "text-justify"],
          contenuto: "{descrizione}",
          html_puro: true,
          is_core: true,
          filtri_html: ["dicitura-rep-31", "dicitura-rep-25", "dicitura-rep-33", "dicitura-rep-29", "dicitura-rep-21", "dicitura-rep-27"]
        }
      ]
    }
  ]
};

/* ──────────────────────────────────────────────────────────────── */
/*                     EDITOR COMPONENTI ATOMICI                    */
/* ──────────────────────────────────────────────────────────────── */
const ConditionsEditor: React.FC<{
  conditions: Condition[];
  onChange: (conds: Condition[]) => void;
}> = ({ conditions, onChange }) => {
  const updateCondition = (index: number, field: keyof Condition, value: any) => {
    const newConds = conditions.map((cond, i) => 
      i === index ? { ...cond, [field]: value } : cond
    );
    onChange(newConds);
  };

  return (
    <div className="space-y-4">
      {conditions.map((cond, idx) => (
        <div key={idx} className="border rounded p-4 bg-slate-50">
          <div className="flex gap-2 mb-3">
            <FormInput
              value={cond.nome_campo}
              onChange={(e) => updateCondition(idx, 'nome_campo', e.target.value)}
              placeholder="Nome campo"
              className="flex-1"
            />
            <Button
              variant="outline-danger"
              onClick={() => onChange(conditions.filter((_, i) => i !== idx))}
              icon={<Trash2 size={16} />}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Valori:</label>
            {cond.valori.map((val, vi) => (
              <div key={vi} className="flex gap-2">
                <FormInput
                  value={val}
                  onChange={(e) => {
                    const newVals = [...cond.valori];
                    newVals[vi] = e.target.value;
                    updateCondition(idx, 'valori', newVals);
                  }}
                />
                <Button
                  variant="outline-danger"
                  onClick={() => 
                    updateCondition(idx, 'valori', cond.valori.filter((_, i) => i !== vi))
                  }
                  icon={<Trash2 size={14} />}
                />
              </div>
            ))}
            <Button
              variant="invisible"
              onClick={() => 
                updateCondition(idx, 'valori', [...cond.valori, ''])
              }
              icon={<Plus size={14} />}
              className="text-primary"
            >
              Aggiungi Valore
            </Button>
          </div>
        </div>
      ))}

      <Button
        onClick={() => onChange([...conditions, { nome_campo: '', valori: [] }])}
        icon={<Plus size={16} />}
        className="w-full border-dashed"
      >
        Aggiungi Condizione
      </Button>
    </div>
  );
};

const ConditionalClassEditor: React.FC<{
  conditionalClasses: ClassiCssCondizionali[];
  onChange: (classes: ClassiCssCondizionali[]) => void;
}> = ({ conditionalClasses, onChange }) => {
  const updateConditionalClass = (index: number, field: keyof ClassiCssCondizionali, value: any) => {
    const newClasses = conditionalClasses.map((cls, i) => 
      i === index ? { ...cls, [field]: value } : cls
    );
    onChange(newClasses);
  };

  return (
    <div className="space-y-3">
      {conditionalClasses.map((cls, idx) => (
        <div key={idx} className="border rounded p-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <FormInput
              value={cls.nome_campo}
              onChange={(e) => updateConditionalClass(idx, 'nome_campo', e.target.value)}
              placeholder="Nome campo"
            />
            <FormInput
              value={cls.operatore}
              onChange={(e) => updateConditionalClass(idx, 'operatore', e.target.value)}
              placeholder="Operatore (contains, equal, etc.)"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <FormInput
              value={cls.valore}
              onChange={(e) => updateConditionalClass(idx, 'valore', e.target.value)}
              placeholder="Valore"
            />
            <FormInput
              value={cls.classi_css.join(' ')}
              onChange={(e) => updateConditionalClass(idx, 'classi_css', e.target.value.split(' ').filter(Boolean))}
              placeholder="Classi CSS"
            />
          </div>
          <Button
            variant="outline-danger"
            onClick={() => onChange(conditionalClasses.filter((_, i) => i !== idx))}
            icon={<Trash2 size={14} />}
          />
        </div>
      ))}
      <Button
        onClick={() => onChange([...conditionalClasses, { nome_campo: '', operatore: 'contains', valore: '', classi_css: [] }])}
        icon={<Plus size={14} />}
        className="w-full border-dashed"
      >
        Aggiungi Classe Condizionale
      </Button>
    </div>
  );
};

const HtmlNodeEditor: React.FC<{
  node: StrutturaCore;
  onChange: (node: StrutturaCore) => void;
  onDelete?: () => void;
  depth?: number;
}> = ({ node, onChange, onDelete, depth = 0 }) => {
  const updateField = <K extends keyof StrutturaCore>(field: K, value: StrutturaCore[K]) => {
    onChange({ ...node, [field]: value });
  };

  const isCore = node.is_core;
  const canDelete = !isCore && onDelete;

  return (
    <div className={`border rounded-lg mb-4 ${isCore ? 'bg-blue-50 border-blue-200' : 'bg-slate-50'}`}>
      <div className="p-3 bg-white border-b flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${isCore ? 'text-blue-700' : ''}`}>
            {node.tag || 'nuovo elemento'}
          </span>
          {isCore && (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
              CORE
            </span>
          )}
          {canDelete && (
            <Button
              variant="outline-danger"
              onClick={onDelete}
              icon={<Trash2 size={14} />}
            />
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FormLabel>Tag HTML</FormLabel>
            <FormInput
              value={typeof node === 'object' && node.tag ? node.tag : ''}
              onChange={(e) => updateField('tag', e.target.value)}
            />
          </div>
          
          <div>
            <FormLabel>Contenuto</FormLabel>
            <FormInput
              value={node.contenuto || ''}
              onChange={(e) => updateField('contenuto', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={node.html_puro || false}
                onChange={(e) => updateField('html_puro', e.target.checked)}
                className="rounded"
              />
              <span>HTML Puro</span>
            </label>
            {isCore && (
              <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                Elemento CORE - Non eliminabile
              </span>
            )}
          </div>

          <div>
            <FormLabel>Campi Eliminati (separati da virgola)</FormLabel>
            <FormInput
              value={node.deleted_field?.join(', ') || ''}
              onChange={(e) => updateField('deleted_field', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
          </div>

          <div>
            <FormLabel>Filtri HTML (separati da virgola)</FormLabel>
            <FormInput
              value={node.filtri_html?.join(', ') || ''}
              onChange={(e) => updateField('filtri_html', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
          </div>
        </div>

        <div>
          <FormLabel>Classi CSS Standard</FormLabel>
          <FormInput
            value={node.classi_css
              ? node.classi_css
                  .filter((c: any) => typeof c === 'string')
                  .join(' ')
              : ''}
            onChange={(e) => {
              const standardClasses = e.target.value.split(' ').filter(Boolean);
              const conditionalClasses = (node.classi_css || []).filter((c: any) => typeof c !== 'string');
              updateField('classi_css', [...standardClasses, ...conditionalClasses]);
            }}
          />
        </div>

        <Disclosure>
          {({ open }) => (
            <div className="border rounded-lg">
              <Disclosure.Button className="w-full p-3 bg-slate-50 flex justify-between items-center">
                <span>Classi CSS Condizionali</span>
                <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
              </Disclosure.Button>
              <Disclosure.Panel className="p-4">
                <ConditionalClassEditor
                  conditionalClasses={(node.classi_css || []).filter((c: any) => typeof c !== 'string') as ClassiCssCondizionali[]}
                  onChange={(conditionalClasses) => {
                    const standardClasses = (node.classi_css || []).filter((c: any) => typeof c === 'string');
                    updateField('classi_css', [...standardClasses, ...conditionalClasses]);
                  }}
                />
              </Disclosure.Panel>
            </div>
          )}
        </Disclosure>

        <div>
          <FormLabel>Attributi (chiave:valore, separati da virgola)</FormLabel>
          <FormInput
            value={node.attributi
              ? Object.entries(node.attributi).map(([k, v]) => `${k}:${v}`).join(', ')
              : ''}
            onChange={(e) => {
              const attributi = Object.fromEntries(
                e.target.value
                  .split(',')
                  .map(p => p.trim().split(':'))
                  .filter(p => p.length === 2)
              );
              updateField('attributi', attributi);
            }}
          />
        </div>

        <Disclosure defaultOpen>
          {({ open }) => (
            <div className="border rounded-lg">
              <Disclosure.Button className="w-full p-3 bg-slate-50 flex justify-between items-center">
                <span>Figli</span>
                <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
              </Disclosure.Button>
              <Disclosure.Panel className="p-4 space-y-4">
                {node.figli?.map((child, idx) => 
                  typeof child === 'string' ? (
                    <div key={idx} className="p-2 bg-gray-100 rounded">
                      <span>Testo: {child}</span>
                    </div>
                  ) : (
                    <HtmlNodeEditor
                      key={idx}
                      node={child}
                      onChange={(newChild) => {
                        const newFigli = [...(node.figli || [])];
                        newFigli[idx] = newChild;
                        updateField('figli', newFigli);
                      }}
                      onDelete={() => 
                        updateField('figli', node.figli?.filter((_, i) => i !== idx) || [])
                      }
                      depth={depth + 1}
                    />
                  )
                )}
                <Button
                  onClick={() => {
                    updateField('figli', [...(node.figli || []), { classi_css: [], tag: 'div' }]);
                  }}
                  icon={<Plus size={14} />}
                  className="w-full"
                >
                  Aggiungi Figlio
                </Button>
              </Disclosure.Panel>
            </div>
          )}
        </Disclosure>
      </div>
    </div>
  );
};

// Funzione di validazione per verificare la presenza degli elementi CORE
const validateCoreStructure = (struttura: StrutturaCore): boolean => {
  // Verifica che ci sia il container principale
  if (!struttura.classi_css?.includes('wp-product-card')) {
    return false;
  }

  // Verifica che ci sia almeno un wrapper immagine e un container info
  const hasImageWrapper = struttura.figli?.some(child => 
    typeof child !== 'string' && 
    (child.classi_css?.includes('wp-pc__img-wrapper') ?? false)
  );
  
  const hasInfoContainer = struttura.figli?.some(child =>
    typeof child !== 'string' && 
    (child.classi_css?.includes('wp-pc__info') ?? false)
  );

  return (hasImageWrapper ?? false) && (hasInfoContainer ?? false);
};

// Funzione per ripristinare gli elementi CORE mancanti
const ensureCoreElements = (struttura: StrutturaCore): StrutturaCore => {
  const result = { ...struttura };
  
  if (!result.classi_css?.includes('wp-product-card')) {
    result.classi_css = ['wp-product-card', ...(result.classi_css || [])];
  }

  // Assicura che ci siano i figli essenziali
  if (!result.figli) {
    result.figli = [];
  }

  const hasImageWrapper = result.figli.some(child => 
    typeof child !== 'string' && 
    (child.classi_css?.includes('wp-pc__img-wrapper') ?? false)
  );
  
  const hasInfoContainer = result.figli.some(child =>
    typeof child !== 'string' && 
    (child.classi_css?.includes('wp-pc__info') ?? false)
  );

  if (!hasImageWrapper) {
    result.figli.unshift(CORE_TEMPLATE.figli![0]);
  }

  if (!hasInfoContainer) {
    result.figli.push(CORE_TEMPLATE.figli![1]);
  }

  return result;
};

/* ──────────────────────────────────────────────────────────────── */
/*                          COMPONENTE PRINCIPALE                    */
/* ──────────────────────────────────────────────────────────────── */
const EditorStiliReferenza: React.FC<{
  config: Config;
  onChangeStili?: (config: Config) => void;
}> = ({ config, onChangeStili }) => {
  const [styles, setStyles] = useState<StileBoxReferenza[]>(config.webpliant.stili || []);
  const [activeStyle, setActiveStyle] = useState<StileBoxReferenza | null>(null);
  const [demoRef] = useState<ReferenzeIstanta>(/* Carica dati dimostrativi */);

  useEffect(() => {
    if (activeStyle) {
      onChangeStili?.({ ...config, webpliant: { ...config.webpliant, stili: styles } });
    }
  }, [styles, activeStyle]);

  const handleCreateStyle = () => {
    const newStyle: StileBoxReferenza = {
      nome_stile: `Stile ${styles.length + 1}`,
      condizioni: [],
      struttura: CORE_TEMPLATE
    };
    setStyles([...styles, newStyle]);
    setActiveStyle(newStyle);
  };

  const handleDeleteStyle = (id?: number) => {
    if (!confirm('Eliminare questo stile?')) return;
    setStyles(styles.filter(s => s.id !== id));
    if (activeStyle?.id === id) setActiveStyle(null);
  };

  return (
    <section className="container mx-auto p-6">
      <header className="mb-8 border-b pb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Lucide icon={"Paintbrush"} className="w-6 h-6" />
          Editor Stili Referenza
        </h1>
      </header>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Sidebar selezione stili */}
        <div className="lg:w-80 space-y-4">
          <div className="bg-white rounded-lg p-4 shadow border">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Lucide icon={"List"} className="w-5 h-5" />
              Elenco Stili
            </h2>

            {/* Utilizzo del componente Popover da @components/Base/Headless/Popover/index.tsx */}

            <Popover className="w-full">
              <Popover.Button className="w-full p-3 border rounded-md flex justify-between items-center bg-white">
                <span className="truncate">
                  {activeStyle?.nome_stile || "Seleziona stile..."}
                </span>
                <ChevronDown className="w-4 h-4" />
              </Popover.Button>
              <Popover.Panel className="w-full mt-1 max-h-60 overflow-auto bg-white border rounded-md shadow-lg p-0">
                <div>
                  {styles.map((style) => (
                    <div
                      key={style.nome_stile}
                      className={`p-3 cursor-pointer flex justify-between items-center hover:bg-primary/10 transition-colors ${
                        activeStyle?.nome_stile === style.nome_stile ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => setActiveStyle(style)}
                      role="option"
                      aria-selected={activeStyle?.nome_stile === style.nome_stile}
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') setActiveStyle(style);
                      }}
                    >
                      <span className={activeStyle?.nome_stile === style.nome_stile ? 'font-semibold' : ''}>
                        {style.nome_stile}
                      </span>
                      {activeStyle?.nome_stile === style.nome_stile && <Check className="w-4 h-4 text-primary" />}
                    </div>
                  ))}
                </div>
              </Popover.Panel>
            </Popover>

            <div className="space-y-2">
              <Button
                onClick={handleCreateStyle}
                icon={<Plus />}
                className="w-full"
              >
                Nuovo Stile
              </Button>
              
              {activeStyle && (
                <Button
                  variant="outline-danger"
                  onClick={() => handleDeleteStyle(activeStyle.id)}
                  icon={<Trash2 />}
                  className="w-full"
                >
                  Elimina Stile
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Editor principale */}
        <div className="flex-1 bg-white rounded-lg shadow border p-6">
          {activeStyle ? (
            <div className="space-y-6">
              <header className="pb-4 border-b mb-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Lucide icon={"SlidersHorizontal"} className="w-5 h-5" />
                    {activeStyle.nome_stile}
                  </h3>
                  <div className="flex items-center gap-2">
                    {activeStyle.id && (
                      <span className="badge bg-primary/10 text-primary">
                        ID: {activeStyle.id}
                      </span>
                    )}
                    {validateCoreStructure(activeStyle.struttura as StrutturaCore) ? (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded flex items-center gap-1">
                        <Check size={12} />
                        Struttura Valida
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                        ⚠ Struttura Incompleta
                      </span>
                    )}
                  </div>
                </div>
              </header>

              <div>
                <FormLabel>Nome Stile</FormLabel>
                <FormInput
                  value={activeStyle.nome_stile}
                  onChange={(e) => {
                    const updated = { ...activeStyle, nome_stile: e.target.value };
                    setActiveStyle(updated);
                    setStyles(styles.map(s => s === activeStyle ? updated : s));
                  }}
                />
              </div>

              <Disclosure defaultOpen>
                {({ open }) => (
                  <div className="border rounded-lg">
                    <Disclosure.Button className="w-full p-3 bg-slate-50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Lucide icon={"Filter"} className="w-4 h-4" />
                        <span>Condizioni</span>
                      </div>
                      <ChevronDown className={`transform ${open ? 'rotate-180' : ''}`} />
                    </Disclosure.Button>
                    <Disclosure.Panel className="p-4">
                      <ConditionsEditor
                        conditions={Array.isArray(activeStyle.condizioni) ? activeStyle.condizioni : []}
                        onChange={conds => {
                          const updated = { ...activeStyle, condizioni: conds };
                          setActiveStyle(updated);
                          setStyles(styles.map(s => s === activeStyle ? updated : s));
                        }}
                      />
                    </Disclosure.Panel>
                  </div>
                )}
              </Disclosure>

              <Disclosure defaultOpen>
                {({ open }) => (
                  <div className="border rounded-lg">
                    <Disclosure.Button className="w-full p-3 bg-slate-50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Lucide icon={"Code"} className="w-4 h-4" />
                        <span>Struttura HTML</span>
                      </div>
                      <ChevronDown className={`transform ${open ? 'rotate-180' : ''}`} />
                    </Disclosure.Button>
                    <Disclosure.Panel className="p-4">
                      <HtmlNodeEditor
                        node={activeStyle.struttura as StrutturaCore}
                        onChange={newStruct => {
                          // Assicura che gli elementi CORE rimangano intatti
                          const validatedStruct = ensureCoreElements(newStruct);
                          const updated = { ...activeStyle, struttura: validatedStruct };
                          setActiveStyle(updated);
                          setStyles(styles.map(s => s === activeStyle ? updated : s));
                        }}
                      />
                    </Disclosure.Panel>
                  </div>
                )}
              </Disclosure>

              <div className="border rounded-lg">
                <div className="p-3 bg-slate-50 border-b flex items-center gap-2">
                  <Lucide icon={"Eye"} className="w-4 h-4" />
                  <span>Anteprima</span>
                </div>
                <div className="p-4">
                  {/* <BoxRef referenza={demoRef as ReferenzeIstanta} config={config} /> */}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Lucide icon={"TextSelect"} className="w-12 h-12 mx-auto mb-4" />
              <h2 className="text-lg font-semibold">Seleziona uno stile</h2>
              <p className="text-sm">Crea un nuovo stile o selezionane uno esistente</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default EditorStiliReferenza;