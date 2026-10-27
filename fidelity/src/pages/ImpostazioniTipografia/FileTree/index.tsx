import Alert from '@/components/Base/Alert';
import Button from '@/components/Base/Button';
import { FormField, FormInput, FormLabel, FormSelect } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import TomSelect from '@/components/Base/TomSelect';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import React, { useEffect, useId, useState } from 'react';
import { TIPO_COMANDO_CONTRATTO_TIPOGRAFIA } from '../../../../lib/enums';
import { FileTreeNode, RootFileTree } from '../../../../lib/types';

// Testo della conferma: dice se con il nodo spariscono anche i suoi figli
const descriviEliminazione = (figli: number) => {
    if (figli === 0) return "Il nodo verrà rimosso dalla struttura, con le sue condizioni e azioni.";
    if (figli === 1) return "Il nodo verrà rimosso dalla struttura insieme al suo nodo figlio, con condizioni e azioni.";
    return `Il nodo verrà rimosso dalla struttura insieme ai suoi ${figli} nodi figli, con condizioni e azioni.`;
};

interface TreeNodeProps {
    node: FileTreeNode;
    onChange: (node: FileTreeNode) => void;
    onDelete?: () => void;
    canali: { id: string; nome: string }[];
    aree: { id: string; nome: string }[];
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, onChange, onDelete, canali, aree }) => {
    const [localNode, setLocalNode] = useState<FileTreeNode>(node);
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    const [confermaElimina, setConfermaElimina] = useState(false);
    // Id univoci per nodo: le etichette dei comandi puntano al campo del proprio nodo
    const idNodo = useId();

    // Update local node when props change
    useEffect(() => {
        setLocalNode(node);
    }, [node]);

    // Aggiorna il nodo locale e propaga le modifiche al livello superiore
    const updateNode = (updated: Partial<FileTreeNode>) => {
        const newNode = { ...localNode, ...updated };
        setLocalNode(newNode);
        onChange(newNode);
    };

    // Modifica della priority
    const handlePriorityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPriority = e.target.value ? parseInt(e.target.value) : 0;
        updateNode({ priority: newPriority });
    };

    // Gestione delle condizioni
    const handleConditionChange = (
        index: number,
        key: keyof FileTreeNode['conditions'][0],
        value: string
    ) => {
        if (!localNode.conditions) return;
        const updatedConditions = [...localNode.conditions];
        updatedConditions[index] = { ...updatedConditions[index], [key]: value };
        updateNode({ conditions: updatedConditions });
    };

    const addCondition = () => {
        const newCondition = { field: '', operator: '', value: '' };
        const updatedConditions = localNode.conditions ? [...localNode.conditions, newCondition] : [newCondition];
        updateNode({ conditions: updatedConditions });
    };

    const removeCondition = (index: number) => {
        if (!localNode.conditions) return;
        const updatedConditions = localNode.conditions.filter((_, i) => i !== index);
        updateNode({ conditions: updatedConditions });
    };

    // Gestione di on_respect_condition
    const handleOnRespectChange = (key: keyof NonNullable<FileTreeNode['on_respect_condition']>, value: any) => {
        const current = localNode.on_respect_condition || {
            commands: [],
            dirname: undefined,
            permissions: undefined,
            meta: undefined,
            log: undefined
        };
        const newObj = { ...current, [key]: value };
        updateNode({ on_respect_condition: newObj });
    };

    // Gestione di on_respect_condition.meta
    const handleMetaChange = (
        key: keyof NonNullable<NonNullable<FileTreeNode['on_respect_condition']>['meta']>,
        value: string
    ) => {
        const currentMeta = localNode.on_respect_condition?.meta || {};
        const newMeta = { ...currentMeta, [key]: value };
        handleOnRespectChange('meta', newMeta);
    };

    // Gestione di on_error
    const handleOnErrorChange = (key: keyof NonNullable<FileTreeNode['on_error']>, value: any) => {
        const current = localNode.on_error || {
            commands: [],
            dirname: undefined,
            permissions: undefined,
            meta: undefined,
            log: undefined
        };
        const newObj = { ...current, [key]: value };
        updateNode({ on_error: newObj });
    };

    // Gestione di fallback
    const handleFallbackChange = (key: keyof NonNullable<FileTreeNode['fallback']>, value: string) => {
        const current = localNode.fallback || { action: '', dirname: undefined };
        const newObj = { ...current, [key]: value };
        updateNode({ fallback: newObj });
    };

    // Gestione dei nodi figli
    const handleChildChange = (index: number, child: FileTreeNode) => {
        const children = localNode.filetree ? [...localNode.filetree] : [];
        children[index] = child;
        updateNode({ filetree: children });
    };

    const addChild = () => {
        const newChild: FileTreeNode = {
            priority: (localNode.filetree?.length || 0) + 1,
            conditions: [],
            on_respect_condition: {
                commands: [],
                dirname: undefined,
                permissions: undefined,
                meta: undefined,
                log: undefined
            },
            on_error: {
                commands: [],
                dirname: undefined,
                permissions: undefined,
                meta: undefined,
                log: undefined
            },
            fallback: {
                action: '',
                dirname: undefined
            }
        };
        const children = localNode.filetree ? [...localNode.filetree, newChild] : [newChild];
        updateNode({ filetree: children });
    };

    const removeChild = (index: number) => {
        if (!localNode.filetree) return;
        const children = localNode.filetree.filter((_, i) => i !== index);
        updateNode({ filetree: children });
    };

    const etichettaNodo = `Nodo ${localNode.priority || 0}`;
    const classiGruppo = "rounded-card border border-slate-200 bg-white p-4";

    return (
        <div className="my-2 ml-4 border-l border-slate-200 py-2 pl-4">
            {/* Intestazione con apertura/chiusura ed eliminazione del nodo */}
            <div className="flex items-center justify-between gap-3 rounded-control bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="rounded-control text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
                        aria-expanded={!isCollapsed}
                        aria-label={`${isCollapsed ? "Espandi" : "Comprimi"} nodo ${localNode.priority || 0}`}
                    >
                        <Lucide icon={isCollapsed ? "ChevronRight" : "ChevronDown"} aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <Lucide icon="Folder" aria-hidden="true" className="h-5 w-5 text-warning" />
                    <h3 className="title-card">{etichettaNodo}</h3>
                </div>
                {onDelete && (
                    <Button
                        type="button"
                        variant="outline-danger"
                        size="sm"
                        onClick={() => setConfermaElimina(true)}
                        aria-label={`Elimina nodo ${localNode.priority || 0}`}
                        title="Elimina nodo"
                    >
                        <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>

            {onDelete && (
                <ConfirmDialog
                    open={confermaElimina}
                    title={`Eliminare il ${etichettaNodo.toLowerCase()}?`}
                    description={descriviEliminazione(localNode.filetree?.length ?? 0)}
                    confirmLabel="Elimina"
                    onClose={() => setConfermaElimina(false)}
                    onConfirm={() => {
                        setConfermaElimina(false);
                        onDelete();
                    }}
                />
            )}

            {/* Se il nodo non è collassato, mostra i dettagli */}
            {!isCollapsed && (
                <div className="mt-3 space-y-4 pl-2">
                    <div className={classiGruppo}>
                        <FormField etichetta="Priorità" className="max-w-40">
                            <FormInput
                                type="number"
                                value={localNode.priority || ''}
                                onChange={handlePriorityChange}
                            />
                        </FormField>
                    </div>

                    <div className={classiGruppo}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h4 className="title-eyebrow">Condizioni</h4>
                            <Button
                                type="button"
                                onClick={addCondition}
                                variant="outline-secondary"
                                size="sm"
                                className="whitespace-nowrap"
                            >
                                <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Aggiungi condizione
                            </Button>
                        </div>

                        {(!localNode.conditions || localNode.conditions.length === 0) && (
                            <EmptyState
                                compatta
                                icon="ListFilter"
                                title="Nessuna condizione"
                                description="Aggiungi una condizione per definire quando questo nodo sarà attivo."
                            />
                        )}

                        {localNode.conditions && localNode.conditions.length > 0 && (
                            <div className="space-y-2">
                                {localNode.conditions.map((cond, idx) => (
                                    <div key={idx} className="flex items-center gap-2 rounded-control bg-slate-50 p-2">
                                        <FormSelect
                                            aria-label={`Campo della condizione ${idx + 1}`}
                                            value={cond.field}
                                            onChange={(e) => handleConditionChange(idx, 'field', e.target.value)}
                                            className="w-1/3"
                                        >
                                            <option value="">Seleziona campo</option>
                                            <option value="area">Area</option>
                                            <option value="canale">Canale</option>
                                        </FormSelect>
                                        <FormSelect
                                            aria-label={`Operatore della condizione ${idx + 1}`}
                                            value={cond.operator}
                                            onChange={(e) => handleConditionChange(idx, 'operator', e.target.value)}
                                            className="w-1/4"
                                        >
                                            <option value="">Operatore</option>
                                            <option value="==">Uguale a (==)</option>
                                            <option value="!=">Diverso da (!=)</option>
                                        </FormSelect>
                                        <FormSelect
                                            aria-label={`Valore della condizione ${idx + 1}`}
                                            value={cond.value}
                                            onChange={(e) => handleConditionChange(idx, 'value', e.target.value)}
                                            className="w-1/3"
                                        >
                                            {(() => {
                                                if (cond.field === "area") {
                                                    return (
                                                        <>
                                                            <option value="">Scegli un'area</option>
                                                            {aree.map((area) => (
                                                                <option key={area.id} value={area.id}>
                                                                    {area.nome}
                                                                </option>
                                                            ))}
                                                        </>
                                                    );
                                                }
                                                if (cond.field === "canale") {
                                                    return (
                                                        <>
                                                            <option value="">Scegli un canale</option>
                                                            {canali.map((canale) => (
                                                                <option key={canale.id} value={canale.id}>
                                                                    {canale.nome}
                                                                </option>
                                                            ))}
                                                        </>
                                                    );
                                                }
                                                return <option value="">Seleziona prima un campo</option>;
                                            })()}
                                        </FormSelect>
                                        <Button
                                            type="button"
                                            onClick={() => removeCondition(idx)}
                                            variant="outline-danger"
                                            size="sm"
                                            aria-label={`Rimuovi condizione ${idx + 1}`}
                                        >
                                            <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={classiGruppo}>
                        <h4 className="title-eyebrow mb-3">Azioni se la condizione è rispettata</h4>
                        <div className="space-y-3">
                            <div>
                                <FormLabel htmlFor={`${idNodo}-respect-commands`}>Comandi</FormLabel>
                                <TomSelect
                                    multiple
                                    id={`${idNodo}-respect-commands`}
                                    value={localNode.on_respect_condition?.commands || []}
                                    onChange={(e) => handleOnRespectChange('commands', e.target.value)}
                                    options={{
                                        placeholder: 'Seleziona comandi'
                                    }}
                                    className="w-full"
                                >
                                    {Object.entries(TIPO_COMANDO_CONTRATTO_TIPOGRAFIA).map(([key, value]) => (
                                        <option key={key} value={key}>
                                            {value}
                                        </option>
                                    ))}
                                </TomSelect>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <FormField etichetta="Nome directory">
                                    <FormInput
                                        placeholder="Nome della directory"
                                        value={localNode.on_respect_condition?.dirname || ''}
                                        onChange={(e) => handleOnRespectChange('dirname', e.target.value)}
                                    />
                                </FormField>
                                <FormField etichetta="Permessi">
                                    <FormInput
                                        placeholder="Permessi (es. 755)"
                                        value={localNode.on_respect_condition?.permissions || ''}
                                        onChange={(e) => handleOnRespectChange('permissions', e.target.value)}
                                    />
                                </FormField>
                            </div>

                            <div className="rounded-control bg-slate-50 p-3">
                                <h4 className="title-eyebrow">Metadati</h4>
                                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <FormField etichetta="Descrizione">
                                        <FormInput
                                            placeholder="Descrizione"
                                            value={localNode.on_respect_condition?.meta?.description || ''}
                                            onChange={(e) => handleMetaChange('description', e.target.value)}
                                        />
                                    </FormField>
                                    <FormField etichetta="Versione">
                                        <FormInput
                                            placeholder="Versione"
                                            value={localNode.on_respect_condition?.meta?.version || ''}
                                            onChange={(e) => handleMetaChange('version', e.target.value)}
                                        />
                                    </FormField>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={classiGruppo}>
                        <h4 className="title-eyebrow mb-3">Azioni in caso di errore</h4>
                        <div className="space-y-3">
                            <div>
                                <FormLabel htmlFor={`${idNodo}-error-commands`}>Comandi</FormLabel>
                                <TomSelect
                                    multiple
                                    id={`${idNodo}-error-commands`}
                                    value={localNode.on_error?.commands || []}
                                    onChange={(e) => handleOnErrorChange('commands', e.target.value)}
                                    options={{
                                        placeholder: 'Seleziona comandi'
                                    }}
                                    className="w-full"
                                >
                                    {Object.entries(TIPO_COMANDO_CONTRATTO_TIPOGRAFIA).map(([key, value]) => (
                                        <option key={key} value={key}>
                                            {value}
                                        </option>
                                    ))}
                                </TomSelect>
                            </div>
                            <FormField etichetta="Log di errore">
                                <FormInput
                                    placeholder="Messaggio di log per l'errore"
                                    value={localNode.on_error?.log || ''}
                                    onChange={(e) => handleOnErrorChange('log', e.target.value)}
                                />
                            </FormField>
                        </div>
                    </div>

                    <div className={classiGruppo}>
                        <h4 className="title-eyebrow mb-3">Fallback</h4>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <FormField etichetta="Azione">
                                <FormInput
                                    placeholder="Azione di fallback"
                                    value={localNode.fallback?.action || ''}
                                    onChange={(e) => handleFallbackChange('action', e.target.value)}
                                />
                            </FormField>
                            <FormField etichetta="Nome directory">
                                <FormInput
                                    placeholder="Nome directory di fallback"
                                    value={localNode.fallback?.dirname || ''}
                                    onChange={(e) => handleFallbackChange('dirname', e.target.value)}
                                />
                            </FormField>
                        </div>
                    </div>

                    <div className={classiGruppo}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h4 className="title-eyebrow">Nodi figli</h4>
                            <Button
                                type="button"
                                onClick={addChild}
                                variant="outline-secondary"
                                size="sm"
                                className="whitespace-nowrap"
                            >
                                <Lucide icon="FolderPlus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Aggiungi nodo figlio
                            </Button>
                        </div>

                        {(!localNode.filetree || localNode.filetree.length === 0) && (
                            <EmptyState
                                compatta
                                icon="FolderTree"
                                title="Nessun nodo figlio"
                                description="Aggiungi un nodo figlio per creare una gerarchia."
                            />
                        )}

                        {localNode.filetree && localNode.filetree.length > 0 && (
                            <div className="space-y-2">
                                {localNode.filetree.map((child, idx) => (
                                    <TreeNode
                                        key={`${localNode.priority}-${idx}`}
                                        node={child}
                                        canali={canali}
                                        aree={aree}
                                        onChange={(updatedChild) => handleChildChange(idx, updatedChild)}
                                        onDelete={() => removeChild(idx)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

interface FileTreeProps {
    contratto: RootFileTree | null;
    canali: { id: string; nome: string }[];
    aree: { id: string; nome: string }[];
    onChange: (data: RootFileTree) => void;
    onCreateNew: (data: RootFileTree) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ contratto, onChange, canali, aree, onCreateNew }) => {
    const [localData, setLocalData] = useState<RootFileTree | null>(contratto);

    // Aggiorno localData quando cambia contratto dall'esterno
    useEffect(() => {
        setLocalData(contratto);
    }, [contratto]);

    const handleRootNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!localData) return;
        const newData = { ...localData, root: e.target.value };
        setLocalData(newData);
        onChange(newData);
    };

    const handleRootChange = (updatedNode: FileTreeNode, index: number) => {
        if (!localData) return;

        const updatedRootTree = [...localData.root_file_tree];
        updatedRootTree[index] = updatedNode;
        const newData = { ...localData, root_file_tree: updatedRootTree };
        setLocalData(newData);
        onChange(newData);
    };

    const addRootNode = () => {
        if (!localData) {
            // Create new contract if none exists
            const newData: RootFileTree = {
                root: "root",
                root_file_tree: [{
                    priority: 1,
                    conditions: [],
                    on_respect_condition: {
                        commands: [],
                        dirname: undefined,
                        permissions: undefined,
                        meta: undefined,
                        log: undefined
                    },
                    on_error: {
                        commands: [],
                        dirname: undefined,
                        permissions: undefined,
                        meta: undefined,
                        log: undefined
                    },
                    fallback: {
                        action: '',
                        dirname: undefined
                    }
                }]
            };
            setLocalData(newData);
            onCreateNew(newData);
            return;
        }

        const newNode: FileTreeNode = {
            priority: localData.root_file_tree.length + 1,
            conditions: [],
            on_respect_condition: {
                commands: [],
                dirname: undefined,
                permissions: undefined,
                meta: undefined,
                log: undefined
            },
            on_error: {
                commands: [],
                dirname: undefined,
                permissions: undefined,
                meta: undefined,
                log: undefined
            },
            fallback: {
                action: '',
                dirname: undefined
            }
        };

        const updatedRootTree = [...localData.root_file_tree, newNode];
        const newData = { ...localData, root_file_tree: updatedRootTree };
        setLocalData(newData);
        onChange(newData);
    };

    const removeRootNode = (index: number) => {
        if (!localData) return;
        const updatedRootTree = localData.root_file_tree.filter((_, i) => i !== index);
        const newData = { ...localData, root_file_tree: updatedRootTree };
        setLocalData(newData);
        onChange(newData);
    };

    if (!localData) {
        return (
            <div className="flex flex-col gap-4">
                <Alert variant="soft-warning" icona="Info">
                    Non è stato trovato un contratto tipografico valido per questa configurazione.
                </Alert>

                <EmptyState
                    compatta
                    icon="FolderPlus"
                    title="Nessun contratto configurato"
                    description="Crea un nuovo contratto per definire la struttura delle cartelle per i file tipografici."
                    buttonText="Crea nuovo contratto"
                    buttonIcon="FolderPlus"
                    onButtonClick={() => {
                        const defaultEmptyContratto: RootFileTree = {
                            root: "root",
                            root_file_tree: []
                        };

                        setLocalData(defaultEmptyContratto);
                        onCreateNew(defaultEmptyContratto);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <FormField etichetta="Cartella radice" className="flex-1">
                    <FormInput
                        type="text"
                        placeholder="Nome della cartella radice (es. root)"
                        value={localData?.root || ''}
                        onChange={handleRootNameChange}
                    />
                </FormField>
                <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={addRootNode}
                >
                    <Lucide icon="FolderPlus" aria-hidden="true" className="mr-2 h-4 w-4" />
                    Aggiungi nodo radice
                </Button>
            </div>

            {localData?.root_file_tree.length === 0 ? (
                <EmptyState
                    compatta
                    icon="FolderCog"
                    title="Nessun nodo configurato"
                    description="Inizia aggiungendo un nodo radice alla struttura delle cartelle."
                    buttonText="Aggiungi un nodo"
                    buttonIcon="FolderPlus"
                    onButtonClick={addRootNode}
                />
            ) : (
                <div className="rounded-card bg-slate-50 p-4">
                    {localData?.root_file_tree.map((node, idx) => (
                        <TreeNode
                            key={`root-${idx}`}
                            node={node}
                            canali={canali}
                            aree={aree}
                            onChange={(updatedNode) => handleRootChange(updatedNode, idx)}
                            onDelete={() => removeRootNode(idx)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FileTree;
