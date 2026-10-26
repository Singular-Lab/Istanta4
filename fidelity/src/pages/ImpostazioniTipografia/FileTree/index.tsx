import Button from '@/components/Base/Button';
import { FormInline, FormInput, FormLabel, FormSelect } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import TomSelect from '@/components/Base/TomSelect';
import EmptyState from '@/components/EmptyState';
import React, { useEffect, useState } from 'react';
import { TIPO_COMANDO_CONTRATTO_TIPOGRAFIA } from '../../../../lib/enums';
import { FileTreeNode, RootFileTree } from '../../../../lib/types';

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

    return (
        <div className="ml-4 border-l pl-4 py-4 my-2 border-slate-200 dark:border-slate-600">
            {/* Header con toggle collapse e pulsante di eliminazione */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-darkmode-400/20 p-2 rounded-md">
                <div className="flex items-center space-x-3">
                    <button onClick={() => setIsCollapsed(!isCollapsed)} className="focus:outline-none text-slate-600 dark:text-slate-300">
                        {isCollapsed ? <Lucide icon="ChevronRight" className="w-5 h-5" /> : <Lucide icon="ChevronDown" className="w-5 h-5" />}
                    </button>
                    <Lucide icon="Folder" className="text-amber-500 dark:text-amber-400 w-5 h-5" />
                    <strong className="text-slate-700 dark:text-slate-300">Nodo {localNode.priority || 0}</strong>
                </div>
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="text-danger hover:bg-danger/10 p-1 rounded-full transition-colors"
                    >
                        <Lucide icon="Trash2" className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Se il nodo non è collassato, mostra i dettagli */}
            {!isCollapsed && (
                <div className="mt-3 space-y-4 pl-2">
                    <div className="bg-white dark:bg-darkmode-600 p-3 rounded-md shadow-sm">
                        <FormInline className="flex items-center mb-2">
                            <FormLabel htmlFor={`priority-${localNode.priority}`} className="w-28 text-slate-700 dark:text-slate-300">Priorità:</FormLabel>
                            <FormInput
                                id={`priority-${localNode.priority}`}
                                type="number"
                                value={localNode.priority || ''}
                                onChange={handlePriorityChange}
                                className="w-24 rounded-md"
                            />
                        </FormInline>
                    </div>

                    <div className="bg-white dark:bg-darkmode-600 p-3 rounded-md shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <strong className="text-slate-700 dark:text-slate-300">Condizioni</strong>
                            <Button
                                onClick={addCondition}
                                variant="soft-success"
                                size="sm"
                                className="whitespace-nowrap"
                            >
                                <Lucide icon="Plus" className="w-4 h-4 mr-1" />
                                Aggiungi Condizione
                            </Button>
                        </div>

                        {(!localNode.conditions || localNode.conditions.length === 0) && (
                            <div className="text-slate-500 text-sm italic p-2 bg-slate-50 dark:bg-darkmode-400/20 rounded-md">
                                Nessuna condizione configurata. Aggiungi una condizione per definire quando questo nodo sarà attivo.
                            </div>
                        )}

                        {localNode.conditions && localNode.conditions.length > 0 && (
                            <div className="space-y-2">
                                {localNode.conditions.map((cond, idx) => (
                                    <div key={idx} className="flex items-center space-x-2 p-2 bg-slate-50 dark:bg-darkmode-400/20 rounded-md">
                                        <FormSelect
                                            value={cond.field}
                                            onChange={(e) => handleConditionChange(idx, 'field', e.target.value)}
                                            className="w-1/3 rounded-md"
                                        >
                                            <option value="">Seleziona campo</option>
                                            <option value="area">Area</option>
                                            <option value="canale">Canale</option>
                                        </FormSelect>
                                        <FormSelect
                                            value={cond.operator}
                                            onChange={(e) => handleConditionChange(idx, 'operator', e.target.value)}
                                            className="w-1/4 rounded-md"
                                        >
                                            <option value="">Operatore</option>
                                            <option value="==">Uguale a (==)</option>
                                            <option value="!=">Diverso da (!=)</option>
                                        </FormSelect>
                                        <FormSelect
                                            value={cond.value}
                                            onChange={(e) => handleConditionChange(idx, 'value', e.target.value)}
                                            className="w-1/3 rounded-md"
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
                                            onClick={() => removeCondition(idx)}
                                            variant="soft-danger"
                                            size="sm"
                                            className="rounded-full"
                                        >
                                            <Lucide icon="X" className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-darkmode-600 p-3 rounded-md shadow-sm">
                        <div className="mb-3">
                            <strong className="text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">Azioni se la condizione è rispettata</strong>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <FormLabel htmlFor="respect-commands" className="mb-1 text-slate-600 dark:text-slate-300">Comandi:</FormLabel>
                                <TomSelect
                                    multiple
                                    id="respect-commands"
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <FormLabel htmlFor="respect-dirname" className="mb-1 text-slate-600 dark:text-slate-300">Nome directory:</FormLabel>
                                    <FormInput
                                        id="respect-dirname"
                                        placeholder="Nome della directory"
                                        value={localNode.on_respect_condition?.dirname || ''}
                                        onChange={(e) => handleOnRespectChange('dirname', e.target.value)}
                                        className="w-full rounded-md"
                                    />
                                </div>
                                <div>
                                    <FormLabel htmlFor="respect-permissions" className="mb-1 text-slate-600 dark:text-slate-300">Permessi:</FormLabel>
                                    <FormInput
                                        id="respect-permissions"
                                        placeholder="Permessi (es. 755)"
                                        value={localNode.on_respect_condition?.permissions || ''}
                                        onChange={(e) => handleOnRespectChange('permissions', e.target.value)}
                                        className="w-full rounded-md"
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-darkmode-400/20 p-3 rounded-md">
                                <strong className="text-slate-700 dark:text-slate-300 text-sm">Metadati</strong>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                    <div>
                                        <FormLabel htmlFor="meta-description" className="mb-1 text-slate-600 dark:text-slate-300 text-xs">Descrizione:</FormLabel>
                                        <FormInput
                                            id="meta-description"
                                            placeholder="Descrizione"
                                            value={localNode.on_respect_condition?.meta?.description || ''}
                                            onChange={(e) => handleMetaChange('description', e.target.value)}
                                            className="w-full rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <FormLabel htmlFor="meta-version" className="mb-1 text-slate-600 dark:text-slate-300 text-xs">Versione:</FormLabel>
                                        <FormInput
                                            id="meta-version"
                                            placeholder="Versione"
                                            value={localNode.on_respect_condition?.meta?.version || ''}
                                            onChange={(e) => handleMetaChange('version', e.target.value)}
                                            className="w-full rounded-md"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-darkmode-600 p-3 rounded-md shadow-sm">
                        <div className="mb-3">
                            <strong className="text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">Azioni in caso di errore</strong>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <FormLabel htmlFor="error-commands" className="mb-1 text-slate-600 dark:text-slate-300">Comandi:</FormLabel>
                                <TomSelect
                                    multiple
                                    id="error-commands"
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
                            <div>
                                <FormLabel htmlFor="error-log" className="mb-1 text-slate-600 dark:text-slate-300">Log di errore:</FormLabel>
                                <FormInput
                                    id="error-log"
                                    placeholder="Messaggio di log per l'errore"
                                    value={localNode.on_error?.log || ''}
                                    onChange={(e) => handleOnErrorChange('log', e.target.value)}
                                    className="w-full rounded-md"
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-darkmode-600 p-3 rounded-md shadow-sm">
                            <div className="mb-3">
                                <strong className="text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">Fallback</strong>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <FormLabel htmlFor="fallback-action" className="mb-1 text-slate-600 dark:text-slate-300">Azione:</FormLabel>
                                    <FormInput
                                        id="fallback-action"
                                        placeholder="Azione di fallback"
                                        value={localNode.fallback?.action || ''}
                                        onChange={(e) => handleFallbackChange('action', e.target.value)}
                                        className="w-full rounded-md"
                                    />
                                </div>
                                <div>
                                    <FormLabel htmlFor="fallback-dirname" className="mb-1 text-slate-600 dark:text-slate-300">Nome directory:</FormLabel>
                                    <FormInput
                                        id="fallback-dirname"
                                        placeholder="Nome directory di fallback"
                                        value={localNode.fallback?.dirname || ''}
                                        onChange={(e) => handleFallbackChange('dirname', e.target.value)}
                                        className="w-full rounded-md"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-darkmode-600 p-3 rounded-md shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <strong className="text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">Nodi figli</strong>
                                <Button
                                    onClick={addChild}
                                    variant="soft-primary"
                                    size="sm"
                                    className="whitespace-nowrap"
                                >
                                    <Lucide icon="FolderPlus" className="w-4 h-4 mr-1" />
                                    Aggiungi nodo figlio
                                </Button>
                            </div>

                            {(!localNode.filetree || localNode.filetree.length === 0) && (
                                <div className="text-slate-500 text-sm italic p-2 bg-slate-50 dark:bg-darkmode-400/20 rounded-md">
                                    Nessun nodo figlio. Aggiungi un nodo figlio per creare una gerarchia.
                                </div>
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
        console.log("contratto FileTree", contratto);
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
            <div className="flex flex-col box box--stacked p-5 rounded-xl">
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-5 rounded-md">
                    <div className="flex items-center">
                        <Lucide icon="Info" className="w-6 h-6 mr-2" />
                        <span>Non è stato trovato un contratto tipografico valido per questa configurazione.</span>
                    </div>
                </div>

                <EmptyState
                    icon="FolderPlus"
                    title="Nessun contratto configurato"
                    description="Crea un nuovo contratto per definire la struttura delle cartelle per i file tipografici."
                    buttonText="Crea nuovo contratto"
                    onButtonClick={() => {
                        const defaultEmptyContratto: RootFileTree = {
                            root: "root",
                            root_file_tree: []
                        };

                        setLocalData(defaultEmptyContratto);
                        onCreateNew(defaultEmptyContratto);
                    }}
                    iconColor="text-primary"
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col box box--stacked p-5 rounded-xl">
            <div className="flex justify-between items-center mb-4">
                <div className='flex-1'>
                    <FormInput
                        type="text"
                        className="w-full text-xl font-bold dark:bg-darkmode-600 dark:border-darkmode-400 dark:text-slate-300"
                        placeholder="Nome del contratto (es. root)"
                        value={localData?.root || ''}
                        onChange={handleRootNameChange}
                    />
                    <p className="text-sm text-slate-500 mt-1">Configura la struttura delle cartelle per i file tipografici</p>
                </div>
                <Button
                    variant="soft-primary"
                    onClick={addRootNode}
                    className='ml-4'
                >
                    <Lucide icon="FolderPlus" className="w-4 h-4 mr-2" />
                    Aggiungi nodo radice
                </Button>
            </div>

            {localData?.root_file_tree.length === 0 ? (
                <div className="bg-slate-50 dark:bg-darkmode-400/20 p-4 rounded-lg text-center">
                    <Lucide icon="FolderCog" className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                    <p className="text-slate-600 dark:text-slate-400 mb-3">Nessun nodo configurato</p>
                    <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={addRootNode}
                    >
                        <Lucide icon="FolderPlus" className="w-4 h-4 mr-2" />
                        Inizia aggiungendo un nodo
                    </Button>
                </div>
            ) : (
                <div className="bg-slate-50 dark:bg-darkmode-400/20 p-4 rounded-lg">
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
