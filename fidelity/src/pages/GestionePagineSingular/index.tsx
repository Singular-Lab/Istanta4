import Button from '@/components/Base/Button';
import { FormInline, FormInput, FormLabel, FormSelect } from '@/components/Base/Form';
import { Disclosure, Menu } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import PageHeader from '@/components/Base/PageHeader';
import withSessionCheck from '@/components/SessionChecker';
import { useNotification } from '@/context/NotificationContext';
import { useMutation } from '@tanstack/react-query';
import { icons } from 'lucide-react';
import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef
} from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
    FormProvider,
    useFieldArray,
    useForm,
    useFormContext
} from 'react-hook-form';
import { useLoaderData } from 'react-router-dom';
import { ServerCall } from '../../../lib/server_call';

/**
 * OBIETTIVI PERFORMANCE (implementati):
 * 1) Smontare contenuti pesanti quando i Disclosure sono chiusi (open && ...)
 * 2) react-hook-form: shouldUnregister=true per liberare campi smontati
 * 3) Data model normalizzato (niente union string|object “grezza” nei fieldArray)
 * 4) Drag hover “throttled” via requestAnimationFrame per ridurre move() spam
 * 5) Evitare prop drilling usando FormProvider + useFormContext
 */

interface NavItem {
    icon: keyof typeof icons;
    pathname?: string;
    title: string;
    disabled?: boolean;
    subMenu?: NavItem[];
}

// INPUT DAL BACKEND (invariato)
type PagineSingularInput = NavItem | string;

interface LoaderData {
    TIPO_UTENTI: {
        [key: string]: PagineSingularInput[];
    };
}

/**
 * MODEL NORMALIZZATO NEL FORM
 * - title: un item “titolo” esplicito
 * - menu: un item menu con campi completi
 */
type PageItem =
    | { type: 'title'; value: string }
    | { type: 'menu'; data: NavItem };

interface FormValues {
    TIPO_UTENTI: Record<string, PageItem[]>;
}

/** Trasforma loader -> form model */
function normalizePages(
    input: Record<string, unknown>
): Record<string, PageItem[]> {
    const out: Record<string, PageItem[]> = {};

    for (const k of Object.keys(input)) {
        const value = input[k];

        // 🔒 DIFESA CRITICA
        if (!Array.isArray(value)) {
            out[k] = [];
            continue;
        }

        out[k] = value.map((it) => {
            if (typeof it === 'string') {
                return { type: 'title', value: it };
            }

            if (typeof it === 'object' && it !== null) {
                return { type: 'menu', data: it as NavItem };
            }

            // fallback di sicurezza
            return { type: 'title', value: String(it) };
        });
    }

    return out;
}

/** Trasforma form model -> backend model (retrocompatibile) */
function denormalizePages(input: Record<string, PageItem[]>): Record<string, PagineSingularInput[]> {
    const out: Record<string, PagineSingularInput[]> = {};
    for (const k of Object.keys(input)) {
        out[k] = (input[k] ?? []).map((it) => {
            if (it.type === 'title') return it.value;
            return it.data;
        });
    }
    return out;
}

/* =========================
 * DraggableItem (ottimizzato)
 * ========================= */

interface DraggableItemProps {
    index: number;
    moveItem: (dragIndex: number, hoverIndex: number) => void;
    children: React.ReactNode;
}

const DraggableItem = memo<DraggableItemProps>(({ index, moveItem, children }) => {
    const ref = useRef<HTMLDivElement>(null);

    const rafRef = useRef<number | null>(null);
    const pendingMoveRef = useRef<{ dragIndex: number; hoverIndex: number } | null>(null);

    const flushMove = useCallback(() => {
        const pending = pendingMoveRef.current;
        if (!pending) return;
        moveItem(pending.dragIndex, pending.hoverIndex);
        pendingMoveRef.current = null;
        rafRef.current = null;
    }, [moveItem]);

    const [{ isDragging }, drag] = useDrag({
        type: 'CATEGORY_ITEM',
        item: { index },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [, drop] = useDrop({
        accept: 'CATEGORY_ITEM',
        hover: (item: { index: number }) => {
            if (!ref.current) return;

            const dragIndex = item.index;
            const hoverIndex = index;
            if (dragIndex === hoverIndex) return;

            // Throttle via RAF: evita spam di move() ad ogni hover tick
            pendingMoveRef.current = { dragIndex, hoverIndex };
            if (rafRef.current == null) {
                rafRef.current = requestAnimationFrame(() => {
                    flushMove();
                    // aggiornamento indice dopo il move effettivo
                    item.index = hoverIndex;
                });
            }
        },
    });

    useEffect(() => {
        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    drag(drop(ref));

    return (
        <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }}>
            {children}
        </div>
    );
});

DraggableItem.displayName = 'DraggableItem';

/* =========================
 * SubMenuSection (smonta quando non visibile)
 * ========================= */

interface SubMenuSectionProps {
    utenteKey: string;
    menuIndex: number;
    iconOptions: (keyof typeof icons)[];
}

const SubMenuSection = memo<SubMenuSectionProps>(({ utenteKey, menuIndex, iconOptions }) => {
    const { control, register } = useFormContext<FormValues>();

    const { fields, append, remove } = useFieldArray({
        control,
        name: `TIPO_UTENTI.${utenteKey}.${menuIndex}.data.subMenu` as const,
    });

    const handleAddSubMenu = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            append({ icon: iconOptions[0], title: '', pathname: '' });
        },
        [append, iconOptions]
    );

    const handleRemoveSubMenu = useCallback(
        (subIndex: number) => (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            remove(subIndex);
        },
        [remove]
    );

    return (
        <div className="mt-2 ml-3 border-l pl-3">
            <h3 className="text-sm font-semibold text-gray-600 mb-1">SubMenu</h3>

            <div className="space-y-2">
                {fields.map((field, subIndex) => (
                    <div key={field.id} className="bg-white border rounded p-2">
                        <FormInline className="flex flex-row items-center space-x-2">
                            <FormLabel htmlFor={`icon_${utenteKey}_${menuIndex}_${subIndex}`} className="text-xs">
                                Icona
                            </FormLabel>

                            <FormSelect
                                id={`icon_${utenteKey}_${menuIndex}_${subIndex}`}
                                {...register(
                                    `TIPO_UTENTI.${utenteKey}.${menuIndex}.data.subMenu.${subIndex}.icon` as const
                                )}
                                className="text-xs"
                            >
                                {iconOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </FormSelect>

                            <FormLabel htmlFor={`title_${utenteKey}_${menuIndex}_${subIndex}`} className="text-xs">
                                Titolo
                            </FormLabel>

                            <FormInput
                                id={`title_${utenteKey}_${menuIndex}_${subIndex}`}
                                {...register(
                                    `TIPO_UTENTI.${utenteKey}.${menuIndex}.data.subMenu.${subIndex}.title` as const
                                )}
                                className="text-xs"
                            />

                            <FormLabel
                                htmlFor={`pathname_${utenteKey}_${menuIndex}_${subIndex}`}
                                className="text-xs"
                            >
                                Pathname
                            </FormLabel>

                            <FormInput
                                id={`pathname_${utenteKey}_${menuIndex}_${subIndex}`}
                                {...register(
                                    `TIPO_UTENTI.${utenteKey}.${menuIndex}.data.subMenu.${subIndex}.pathname` as const
                                )}
                                className="text-xs"
                            />
                        </FormInline>

                        <div className="text-right mt-1">
                            <Button variant="secondary" size="sm" onClick={handleRemoveSubMenu(subIndex)}>
                                Rimuovi SubMenu
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-right mt-1">
                <Button variant="primary" size="sm" onClick={handleAddSubMenu}>
                    Aggiungi SubMenu
                </Button>
            </div>
        </div>
    );
});

SubMenuSection.displayName = 'SubMenuSection';

/* =========================
 * CategorySection (solo panel aperti montano contenuto)
 * ========================= */

interface CategorySectionProps {
    utenteKey: string;
    iconOptions: (keyof typeof icons)[];
}

const CategorySection = memo<CategorySectionProps>(({ utenteKey, iconOptions }) => {
    const { control, register, watch } = useFormContext<FormValues>();

    const { fields, append, remove, move } = useFieldArray({
        control,
        name: `TIPO_UTENTI.${utenteKey}` as const,
    });

    const moveItem = useCallback(
        (dragIndex: number, hoverIndex: number) => {
            move(dragIndex, hoverIndex);
        },
        [move]
    );

    const handleAddMenu = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            append({
                type: 'menu',
                data: { icon: iconOptions[0], title: '', pathname: '' },
            });
        },
        [append, iconOptions]
    );

    const handleAddTitle = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            append({ type: 'title', value: 'Nuovo Titolo' });
        },
        [append]
    );

    const handleRemoveItem = useCallback(
        (index: number) => {
            remove(index);
        },
        [remove]
    );

    return (
        <>
            <Disclosure.Group variant="boxed" selectedIndex={0} as="div" className="space-y-2">
                {fields.map((field, index) => (
                    <DraggableItem key={field.id} index={index} moveItem={moveItem}>
                        <Disclosure defaultOpen={false}>
                            {({ open }) => {
                                // NB: watch usato solo per label/condizione minima; il contenuto pesante sta sotto open&&
                                const itemType = watch(`TIPO_UTENTI.${utenteKey}.${index}.type` as const);

                                return (
                                    <>
                                        <Disclosure.Button className="flex items-center p-2 rounded w-full text-left">
                                            <span className="cursor-move mr-2">☰</span>

                                            {itemType === 'title' ? (
                                                <span className="text-secondary">
                                                    {(watch(`TIPO_UTENTI.${utenteKey}.${index}.value` as const) as string) ||
                                                        `Titolo ${index + 1}`}
                                                </span>
                                            ) : (
                                                <span>
                                                    {(watch(
                                                        `TIPO_UTENTI.${utenteKey}.${index}.data.title` as const
                                                    ) as string) || 'Senza titolo'}
                                                </span>
                                            )}
                                        </Disclosure.Button>

                                        {/* PERFORMANCE: contenuto montato SOLO se open */}
                                        {open && (
                                            <Disclosure.Panel static className="p-4 bg-white rounded mt-2">
                                                {itemType === 'title' ? (
                                                    <div className="flex flex-row items-center space-x-2">
                                                        <FormLabel
                                                            htmlFor={`TIPO_UTENTI.${utenteKey}.${index}.value`}
                                                            className="text-sm"
                                                        >
                                                            Titolo
                                                        </FormLabel>
                                                        <FormInput
                                                            id={`TIPO_UTENTI.${utenteKey}.${index}.value`}
                                                            {...register(`TIPO_UTENTI.${utenteKey}.${index}.value` as const)}
                                                            className="text-sm"
                                                        />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex flex-row items-center space-x-2">
                                                            <FormLabel htmlFor={`title_${utenteKey}_${index}`} className="text-sm">
                                                                Titolo
                                                            </FormLabel>

                                                            <FormInput
                                                                id={`title_${utenteKey}_${index}`}
                                                                {...register(
                                                                    `TIPO_UTENTI.${utenteKey}.${index}.data.title` as const
                                                                )}
                                                                className="text-sm"
                                                            />

                                                            <FormSelect
                                                                id={`icon_${utenteKey}_${index}`}
                                                                {...register(`TIPO_UTENTI.${utenteKey}.${index}.data.icon` as const)}
                                                                className="text-sm"
                                                            >
                                                                {iconOptions.map((option) => (
                                                                    <option key={option} value={option}>
                                                                        {option}
                                                                    </option>
                                                                ))}
                                                            </FormSelect>

                                                            <FormInput
                                                                id={`pathname_${utenteKey}_${index}`}
                                                                {...register(
                                                                    `TIPO_UTENTI.${utenteKey}.${index}.data.pathname` as const
                                                                )}
                                                                className="text-sm"
                                                            />

                                                            <input
                                                                type="checkbox"
                                                                {...register(
                                                                    `TIPO_UTENTI.${utenteKey}.${index}.data.disabled` as const
                                                                )}
                                                                className="shadow-sm border-slate-300/80 cursor-pointer rounded focus:ring-4 focus:ring-offset-0 focus:ring-primary focus:ring-opacity-20 dark:bg-darkmode-800 dark:border-transparent dark:focus:ring-slate-700 dark:focus:ring-opacity-50"
                                                            />
                                                        </div>

                                                        {/* PERFORMANCE: SubMenu montato solo quando open */}
                                                        <SubMenuSection
                                                            utenteKey={utenteKey}
                                                            menuIndex={index}
                                                            iconOptions={iconOptions}
                                                        />
                                                    </>
                                                )}

                                                <div className="text-right mt-2">
                                                    <Button variant="secondary" size="sm" onClick={() => handleRemoveItem(index)}>
                                                        Rimuovi
                                                    </Button>
                                                </div>
                                            </Disclosure.Panel>
                                        )}
                                    </>
                                );
                            }}
                        </Disclosure>
                    </DraggableItem>
                ))}
            </Disclosure.Group>

            <div className="text-right mt-2">
                <Menu as="div">
                    <Menu.Button as={Button} variant="primary" size="sm">
                        Aggiungi
                    </Menu.Button>
                    <Menu.Items className="w-40">
                        <Menu.Item onClick={handleAddMenu}>Aggiungi Menu</Menu.Item>
                        <Menu.Item onClick={handleAddTitle}>Aggiungi Titolo</Menu.Item>
                    </Menu.Items>
                </Menu>
            </div>
        </>
    );
});

CategorySection.displayName = 'CategorySection';

/* =========================
 * Pagina
 * ========================= */

const GestionePagineSingular: React.FC = () => {
    const { TIPO_UTENTI: TIPO_UTENTI_RAW } = useLoaderData() as LoaderData;
    const { showNotification } = useNotification();

    const iconOptions = useMemo(() => Object.keys(icons) as (keyof typeof icons)[], []);

    // Normalizza una sola volta
    const defaultValues = useMemo<FormValues>(() => {
        return { TIPO_UTENTI: normalizePages(TIPO_UTENTI_RAW) };
    }, [TIPO_UTENTI_RAW]);

    const methods = useForm<FormValues>({
        defaultValues,
        /**
         * PERFORMANCE: campi smontati (Disclosure chiusi) vengono deregistrati,
         * riducendo watchers e memoria
         */
        shouldUnregister: true,
        mode: 'onSubmit',
    });

    const mutateRegoleGDO = useMutation({
        mutationFn: async (data: FormValues) => {
            // Torniamo al formato atteso dal backend
            const payload = { TIPO_UTENTI: denormalizePages(data.TIPO_UTENTI) };
            return await ServerCall.put('/salvaGestionePagineSingular', payload);
        },
        onError: () => {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold text-sm">Errore durante il salvataggio delle regole GDO</div>
                    </div>
                </div>,
                { variant: 'error' }
            );
        },
        onSuccess: () => {
            showNotification(
                <div className="flex flex-row items-center">
                    <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
                    <div className="ml-4 mr-4">
                        <div className="font-bold text-sm">Regole GDO salvate con successo</div>
                    </div>
                </div>,
                { variant: 'success' }
            );
        },
    });

    const onSubmit = useCallback(
        (data: FormValues) => {
            mutateRegoleGDO.mutate(data);
        },
        [mutateRegoleGDO]
    );

    return (
        <div className="grid grid-cols-12 gap-y-10 gap-x-6">
            <div className="col-span-12">
                <PageHeader title="Gestione delle pagine" description="Gestione delle pagine" />

                <div className="mt-3.5">
                    <div className="flex flex-col box box--stacked">
                        <div className="p-5 sm:items-center sm:flex-row gap-y-2">
                            <FormProvider {...methods}>
                                <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
                                    <DndProvider backend={HTML5Backend}>
                                        <Disclosure.Group variant="boxed" selectedIndex={0}>
                                            {Object.keys(defaultValues.TIPO_UTENTI).map((utenteKey) => (
                                                <React.Fragment key={utenteKey}>
                                                    <Disclosure id={utenteKey}>
                                                        {({ open }) => (
                                                            <>
                                                                <Disclosure.Button className="p-4 rounded w-full text-left">
                                                                    {utenteKey}
                                                                </Disclosure.Button>

                                                                {open && (
                                                                    <Disclosure.Panel static className="p-4 bg-white rounded mt-2">
                                                                        <CategorySection utenteKey={utenteKey} iconOptions={iconOptions} />
                                                                    </Disclosure.Panel>
                                                                )}
                                                            </>
                                                        )}
                                                    </Disclosure>
                                                </React.Fragment>
                                            ))}

                                        </Disclosure.Group>
                                    </DndProvider>

                                    <div className="text-end">
                                        <Button variant="primary" type="submit" disabled={mutateRegoleGDO.isPending}>
                                            {mutateRegoleGDO.isPending ? 'Salvataggio...' : 'Salva'}
                                        </Button>
                                    </div>
                                </form>
                            </FormProvider>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default withSessionCheck(GestionePagineSingular);
