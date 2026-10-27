import React, { useState, useEffect } from 'react';
import { Disclosure } from '@headlessui/react';
import { ChevronDown, Trash2, Plus } from 'lucide-react';
import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { FormCheck, FormField, FormInput, FormLabel, FormSelect } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import Sezione from '@/components/Base/Sezione';
import StatusBadge from '@/components/Base/StatusBadge';
import { Config, ReferenzeIstanta, StileBoxReferenza, Struttura, ClassiCssCondizionali } from '../../../../lib/types';

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
        <div key={idx} className="rounded-card border border-slate-200 bg-slate-50 p-4">
          <div className="flex gap-2 mb-3">
            <FormInput
              value={cond.nome_campo}
              onChange={(e) => updateCondition(idx, 'nome_campo', e.target.value)}
              placeholder="Nome campo"
              className="flex-1"
            />
            <Button
              variant="outline-danger"
              aria-label={`Rimuovi condizione ${idx + 1}`}
              onClick={() => onChange(conditions.filter((_, i) => i !== idx))}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <FormLabel>Valori</FormLabel>
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
                  aria-label={`Rimuovi valore ${vi + 1}`}
                  onClick={() => 
                    updateCondition(idx, 'valori', cond.valori.filter((_, i) => i !== vi))
                  }
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => 
                updateCondition(idx, 'valori', [...cond.valori, ''])
              }
            >
              <Plus aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Aggiungi valore
            </Button>
          </div>
        </div>
      ))}

      <Button
        variant="outline-secondary"
        onClick={() => onChange([...conditions, { nome_campo: '', valori: [] }])}
        className="w-full"
      >
        <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
        Aggiungi condizione
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
        <div key={idx} className="rounded-card border border-slate-200 bg-slate-50 p-3">
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
            size="sm"
            aria-label={`Rimuovi classe condizionale ${idx + 1}`}
            onClick={() => onChange(conditionalClasses.filter((_, i) => i !== idx))}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline-secondary"
        onClick={() => onChange([...conditionalClasses, { nome_campo: '', operatore: 'contains', valore: '', classi_css: [] }])}
        className="w-full"
      >
        <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
        Aggiungi classe condizionale
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
    <div className={`mb-4 rounded-card border ${isCore ? 'border-info/20 bg-info/5' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center justify-between rounded-t-card border-b border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isCore ? 'text-info' : 'text-slate-700'}`}>
            {node.tag || 'nuovo elemento'}
          </span>
          {isCore && (
            <Badge variant="info" size="sm">
              CORE
            </Badge>
          )}
          {canDelete && (
            <Button
              variant="outline-danger"
              size="sm"
              aria-label={`Elimina elemento ${node.tag || 'nuovo elemento'}`}
              onClick={onDelete}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
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
            <FormCheck>
              <FormCheck.Input
                type="checkbox"
                checked={node.html_puro || false}
                onChange={(e) => updateField('html_puro', e.target.checked)}
              />
              <FormCheck.Label>HTML puro</FormCheck.Label>
            </FormCheck>
            {isCore && (
              <Badge variant="warning" size="sm">
                Elemento CORE, non eliminabile
              </Badge>
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
            <div className="rounded-card border border-slate-200">
              <Disclosure.Button className="flex w-full items-center justify-between rounded-card bg-slate-50 p-3 text-sm font-medium text-slate-700">
                <span>Classi CSS condizionali</span>
                <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
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
            <div className="rounded-card border border-slate-200">
              <Disclosure.Button className="flex w-full items-center justify-between rounded-card bg-slate-50 p-3 text-sm font-medium text-slate-700">
                <span>Figli</span>
                <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </Disclosure.Button>
              <Disclosure.Panel className="p-4 space-y-4">
                {node.figli?.map((child, idx) => 
                  typeof child === 'string' ? (
                    <div key={idx} className="rounded-control bg-slate-100 p-2">
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
                  variant="outline-secondary"
                  onClick={() => {
                    updateField('figli', [...(node.figli || []), { classi_css: [], tag: 'div' }]);
                  }}
                  className="w-full"
                >
                  <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                  Aggiungi figlio
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
  const [confermaElimina, setConfermaElimina] = useState(false);

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
    setStyles(styles.filter(s => s.id !== id));
    if (activeStyle?.id === id) setActiveStyle(null);
    setConfermaElimina(false);
  };

  const selezionaStile = (nome: string) => {
    setActiveStyle(styles.find((stile) => stile.nome_stile === nome) ?? null);
  };

  const classiCard = "rounded-card border border-slate-200 bg-white p-4";
  const classiDisclosure = "flex w-full items-center justify-between rounded-card bg-slate-50 p-3 text-sm font-medium text-slate-700";

  return (
    <Sezione
      icona="Paintbrush"
      titolo="Editor stili referenza"
      descrizione="Struttura HTML e condizioni dei box referenza del volantino"
    >
      <div className="grid grid-cols-12 gap-6">
        {/* Selezione dello stile */}
        <div className={`${classiCard} col-span-12 flex flex-col gap-4 self-start lg:col-span-4 xl:col-span-3`}>
          <h3 className="title-card flex items-center gap-2">
            <Lucide icon="List" aria-hidden="true" className="h-4 w-4" />
            Elenco stili
          </h3>

          <FormSelect
            aria-label="Stile da modificare"
            value={activeStyle?.nome_stile ?? ""}
            onChange={(e) => selezionaStile(e.target.value)}
          >
            <option value="" disabled>Seleziona stile…</option>
            {styles.map((style) => (
              <option key={style.nome_stile} value={style.nome_stile}>
                {style.nome_stile}
              </option>
            ))}
          </FormSelect>

          <div className="flex flex-col gap-2">
            <Button variant="outline-secondary" onClick={handleCreateStyle} className="w-full">
              <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
              Nuovo stile
            </Button>

            {activeStyle && (
              <Button
                variant="outline-danger"
                onClick={() => setConfermaElimina(true)}
                className="w-full"
              >
                <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
                Elimina stile
              </Button>
            )}
            <ConfirmDialog
              open={confermaElimina && !!activeStyle}
              title="Eliminare lo stile?"
              description={`Lo stile "${activeStyle?.nome_stile ?? ""}" e le sue condizioni verranno rimossi dalla configurazione del volantino.`}
              confirmLabel="Elimina stile"
              onClose={() => setConfermaElimina(false)}
              onConfirm={() => handleDeleteStyle(activeStyle?.id)}
            />
          </div>
        </div>

        {/* Editor principale */}
        <div className={`${classiCard} col-span-12 lg:col-span-8 xl:col-span-9`}>
          {activeStyle ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-slate-200 pb-4">
                <h3 className="title-card flex items-center gap-2">
                  <Lucide icon="SlidersHorizontal" aria-hidden="true" className="h-4 w-4" />
                  {activeStyle.nome_stile}
                </h3>
                <div className="flex items-center gap-2">
                  {activeStyle.id && (
                    <Badge variant="primary" size="sm">
                      ID: {activeStyle.id}
                    </Badge>
                  )}
                  {validateCoreStructure(activeStyle.struttura as StrutturaCore) ? (
                    <StatusBadge tono="success" etichetta="Struttura valida" icon="Check" />
                  ) : (
                    <StatusBadge tono="danger" etichetta="Struttura incompleta" icon="TriangleAlert" />
                  )}
                </div>
              </div>

              <FormField etichetta="Nome stile">
                <FormInput
                  value={activeStyle.nome_stile}
                  onChange={(e) => {
                    const updated = { ...activeStyle, nome_stile: e.target.value };
                    setActiveStyle(updated);
                    setStyles(styles.map(s => s === activeStyle ? updated : s));
                  }}
                />
              </FormField>

              <Disclosure defaultOpen>
                {({ open }) => (
                  <div className="rounded-card border border-slate-200">
                    <Disclosure.Button className={classiDisclosure}>
                      <span className="flex items-center gap-2">
                        <Lucide icon="ListFilter" aria-hidden="true" className="h-4 w-4" />
                        Condizioni
                      </span>
                      <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
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
                  <div className="rounded-card border border-slate-200">
                    <Disclosure.Button className={classiDisclosure}>
                      <span className="flex items-center gap-2">
                        <Lucide icon="Code" aria-hidden="true" className="h-4 w-4" />
                        Struttura HTML
                      </span>
                      <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
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
            </div>
          ) : (
            <EmptyState
              compatta
              icon="MousePointerClick"
              title="Seleziona uno stile"
              description="Crea un nuovo stile o selezionane uno esistente"
            />
          )}
        </div>
      </div>
    </Sezione>
  );
};

export default EditorStiliReferenza;