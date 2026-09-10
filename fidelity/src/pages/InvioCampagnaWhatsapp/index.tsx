import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';

import L from 'leaflet';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { icons } from 'lucide-react';
import {
    Fragment,
    Suspense,
    useEffect,
    useState,
    type FC,
} from 'react';
import {
    Circle,
    MapContainer,
    Marker,
    Polygon,
    TileLayer,
    useMap,
    useMapEvents
} from 'react-leaflet';
import {
    Await,
    useLoaderData,
    useNavigate,
    useSearchParams
} from 'react-router-dom';

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { UTENTE_GENERE } from '../../../lib/enums';
import { ServerCall } from '../../../lib/server_call';
import type { GDOWhatsappTemplateAttributes } from '../../../lib/types';
import Button from '../../components/Base/Button';
import { FormCheck, FormInput, FormLabel, FormSelect } from '../../components/Base/Form';
import { Dialog } from '../../components/Base/Headless';
import Litepicker from '../../components/Base/Litepicker';
import Lucide from '../../components/Base/Lucide';
import PageHeader from '../../components/Base/PageHeader';
import Table from '../../components/Base/Table';
import EmptyState from '../../components/EmptyState';
import { PermissionGate } from '@/components/PermissionGate';
import withSessionCheck from '../../components/SessionChecker';
import { PERMISSIONS } from '@/constants/permissions';

dayjs.extend(customParseFormat);

type ViewStep = 1 | 2;
type CallFilterMode = 'circle' | 'comuni' | 'regioni';

type ComuneOption = {
    id: number;
    name: string;
    province?: string;
    center?: [number, number];
};

interface HeatmapProps {
    points: [number, number, number][];  // [lat, lon, intensity]
    options?: any;
}

/**
 * Alternativa a leaflet.heat usando CircleMarker nativi
 * Visualizza punti con densità variabile basata sull'intensità
 */
const HeatmapLayer = ({ points, options }: HeatmapProps) => {
    const map = useMap();

    useEffect(() => {
        if (!map || !points || points.length === 0) return;

        const layers: L.CircleMarker[] = [];

        // Crea un CircleMarker per ogni punto
        points.forEach((point) => {
            const [lat, lng, intensity = 1] = point;

            // Calcola opacità e dimensione basate sull'intensità
            const opacity = Math.min(0.3 + (intensity * 0.5), 0.8);
            const radius = 8 + (intensity * 5);

            const circle = L.circleMarker([lat, lng], {
                radius: radius,
                fillColor: '#3b82f6', // blu
                color: '#1d4ed8',     // bordo blu scuro
                weight: 1,
                opacity: 0.6,
                fillOpacity: opacity,
            });

            circle.addTo(map);
            layers.push(circle);
        });

        // Cleanup: rimuovi tutti i layer quando il componente si smonta
        return () => {
            layers.forEach(layer => map.removeLayer(layer));
        };
    }, [map, points, options]);

    return null;
};

// Gestore dei click sulla mappa per spostare il centro (solo per modalità cerchio)
const CallZoneClickHandler: FC<{
    onChangeCenter: (latlng: LatLngExpression) => void;
}> = ({ onChangeCenter }) => {
    useMapEvents({
        click(e) {
            onChangeCenter([e.latlng.lat, e.latlng.lng]);
        },
    });
    return null;
};

// Normalizza qualunque cosa torni il Litepicker in una stringa "YYYY-MM-DD - YYYY-MM-DD"
const normalizeDateRangeValue = (value: any): string => {
    if (!value) return '';

    // caso più semplice: stringa già pronta
    if (typeof value === 'string') {
        return value;
    }

    // array [start, end]
    if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
        const start = dayjs(value[0]);
        const end = dayjs(value[1]);
        if (!start.isValid() || !end.isValid()) return '';
        return `${start.format('YYYY-MM-DD')} - ${end.format('YYYY-MM-DD')}`;
    }

    // singola Date
    if (value instanceof Date) {
        const d = dayjs(value);
        if (!d.isValid()) return '';
        const s = d.format('YYYY-MM-DD');
        return `${s} - ${s}`;
    }

    // oggetto {from,to} / {start,end}
    if (typeof value === 'object') {
        const startRaw: Date | undefined = (value.from || value.start) as Date | undefined;
        const endRaw: Date | undefined = (value.to || value.end) as Date | undefined;
        if (!startRaw || !endRaw) return '';
        const start = dayjs(startRaw);
        const end = dayjs(endRaw);
        if (!start.isValid() || !end.isValid()) return '';
        return `${start.format('YYYY-MM-DD')} - ${end.format('YYYY-MM-DD')}`;
    }

    return '';
};

// Helpers UI puri (fuori dal componente per poterli riusare ovunque)
const getStatusConfig = (
    status?: string,
): {
    label: string;
    className: string;
    icon: keyof typeof icons;
} => {
    switch (status) {
        case 'APPROVED':
            return { label: 'Approvato', className: 'bg-success/10 text-success', icon: 'CircleCheck' };
        case 'PENDING':
            return { label: 'In revisione', className: 'bg-pending/10 text-pending', icon: 'Clock' };
        case 'REJECTED':
            return { label: 'Rifiutato', className: 'bg-danger/10 text-danger', icon: 'CircleX' };
        case 'PAUSED':
            return { label: 'In pausa', className: 'bg-warning/10 text-warning', icon: 'Pause' };
        case 'DISABLED':
            return {
                label: 'Disabilitato',
                className: 'bg-slate-100 text-slate-500 dark:bg-darkmode-400/40 dark:text-slate-300',
                icon: 'Ban',
            };
        case 'ARCHIVED':
            return {
                label: 'Archiviato',
                className: 'bg-slate-100 text-slate-500 dark:bg-darkmode-400/40 dark:text-slate-300',
                icon: 'Archive',
            };
        default:
            return {
                label: status ?? 'Sconosciuto',
                className: 'bg-slate-100 text-slate-500 dark:bg-darkmode-400/40 dark:text-slate-300',
                icon: 'CircleHelp',
            };
    }
};

const getCategoryConfig = (category?: string) => {
    switch (category) {
        case 'MARKETING':
            return {
                label: 'Marketing',
                className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
                icon: 'TrendingUp' as const,
            };
        case 'UTILITY':
            return {
                label: 'Utility',
                className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
                icon: 'Wrench' as const,
            };
        case 'AUTHENTICATION':
            return {
                label: 'Autenticazione',
                className: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
                icon: 'Shield' as const,
            };
        case 'TRANSACTIONAL':
            return {
                label: 'Transazionale',
                className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
                icon: 'ShoppingCart' as const,
            };
        case 'SERVICE':
            return {
                label: 'Servizio',
                className: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
                icon: 'Headphones' as const,
            };
        default:
            return {
                label: category ?? 'N/A',
                className: 'bg-slate-50 text-slate-700 dark:bg-darkmode-400/40 dark:text-slate-300',
                icon: 'Tag' as const,
            };
    }
};

const getHeaderInfo = (template: GDOWhatsappTemplateAttributes) => {
    const headerComponent = template.json_meta_gdowhatsapptemplate.components.find(
        (c) => c.type === 'HEADER',
    ) as Extract<
        GDOWhatsappTemplateAttributes['json_meta_gdowhatsapptemplate']['components'][number],
        { type: 'HEADER' }
    > | undefined;

    if (!headerComponent) {
        return {
            format: null as 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null,
            text: null as string | null,
            icon: 'Minus' as const,
            label: 'Nessuna intestazione',
        };
    }

    const format = headerComponent.format ?? 'TEXT';

    return {
        format,
        text: headerComponent.format === 'TEXT' ? headerComponent.text ?? null : null,
        icon:
            format === 'IMAGE'
                ? ('Image' as const)
                : format === 'VIDEO'
                    ? ('Video' as const)
                    : format === 'DOCUMENT'
                        ? ('FileText' as const)
                        : ('Type' as const),
        label:
            format === 'IMAGE'
                ? 'Immagine'
                : format === 'VIDEO'
                    ? 'Video'
                    : format === 'DOCUMENT'
                        ? 'Documento'
                        : 'Testo',
    };
};

const getBodyInfo = (template: GDOWhatsappTemplateAttributes) => {
    const bodyComponent = template.json_meta_gdowhatsapptemplate.components.find(
        (c) => c.type === 'BODY',
    ) as Extract<
        GDOWhatsappTemplateAttributes['json_meta_gdowhatsapptemplate']['components'][number],
        { type: 'BODY' }
    > | undefined;

    return bodyComponent?.text || 'Nessun contenuto';
};

const getFooterInfo = (template: GDOWhatsappTemplateAttributes) => {
    const footerComponent = template.json_meta_gdowhatsapptemplate.components.find(
        (c) => c.type === 'FOOTER',
    ) as Extract<
        GDOWhatsappTemplateAttributes['json_meta_gdowhatsapptemplate']['components'][number],
        { type: 'FOOTER' }
    > | undefined;

    return footerComponent?.text || null;
};

const getButtonsInfo = (template: GDOWhatsappTemplateAttributes) => {
    const buttonsComponent = template.json_meta_gdowhatsapptemplate.components.find(
        (c) => c.type === 'BUTTONS',
    ) as Extract<
        GDOWhatsappTemplateAttributes['json_meta_gdowhatsapptemplate']['components'][number],
        { type: 'BUTTONS' }
    > | undefined;

    return buttonsComponent?.buttons || [];
};

// Skeleton / loader specifici per ogni contenuto

const TemplatesListSkeleton: FC = () => (
    <div className="flex flex-col box box--stacked">
        <div className="p-5 border-b border-dashed">
            <div className="h-9 bg-slate-100 dark:bg-darkmode-700 rounded animate-pulse" />
        </div>
        <div className="px-5 py-3 bg-slate-50 dark:bg-darkmode-800/50 border-b border-dashed">
            <div className="h-4 w-40 bg-slate-100 dark:bg-darkmode-700 rounded animate-pulse" />
        </div>
        <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
                <div
                    key={i}
                    className="h-16 bg-slate-50 dark:bg-darkmode-700 rounded-md animate-pulse"
                />
            ))}
        </div>
    </div>
);

const TemplatePreviewSkeleton: FC = () => (
    <div className="box box--stacked p-5 space-y-4">
        <div className="h-5 w-40 bg-slate-100 dark:bg-darkmode-700 rounded animate-pulse" />
        <div className="h-64 bg-slate-50 dark:bg-darkmode-700 rounded-lg animate-pulse" />
        <div className="h-10 bg-slate-100 dark:bg-darkmode-700 rounded animate-pulse" />
    </div>
);

const DestinatariSkeleton: FC = () => (
    <div className="border border-dashed rounded-lg p-4 animate-pulse">
        <div className="h-4 w-24 bg-slate-100 dark:bg-darkmode-700 rounded mb-3" />
        <div className="h-6 w-32 bg-slate-100 dark:bg-darkmode-700 rounded mb-2" />
        <div className="h-5 w-24 bg-slate-100 dark:bg-darkmode-700 rounded mb-2" />
        <div className="h-4 w-40 bg-slate-100 dark:bg-darkmode-700 rounded" />
    </div>
);

const MapSkeleton: FC = () => (
    <div className="h-96 rounded-lg overflow-hidden border border-slate-200 dark:border-darkmode-500">
        <div className="w-full h-full bg-slate-100 dark:bg-darkmode-700 animate-pulse" />
    </div>
);

const SummarySkeleton: FC = () => (
    <div className="p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
            <div className="border border-dashed rounded-lg p-4 animate-pulse">
                <div className="h-4 w-32 bg-slate-100 dark:bg-darkmode-700 rounded mb-2" />
                <div className="h-5 w-40 bg-slate-100 dark:bg-darkmode-700 rounded mb-2" />
                <div className="h-4 w-32 bg-slate-100 dark:bg-darkmode-700 rounded mb-2" />
                <div className="h-5 w-24 bg-slate-100 dark:bg-darkmode-700 rounded" />
            </div>
            <DestinatariSkeleton />
        </div>
        <div className="border border-dashed rounded-lg p-4 animate-pulse h-32" />
        <div className="border border-dashed rounded-lg p-4 animate-pulse h-40" />
        <div className="border border-dashed rounded-lg p-4 animate-pulse h-72" />
    </div>
);

const MessagePreviewSkeleton: FC = () => (
    <div className="p-5 bg-slate-50 dark:bg-darkmode-800/50">
        <div className="bg-white dark:bg-darkmode-600 rounded-lg shadow-md overflow-hidden max-w-sm mx-auto animate-pulse h-72" />
    </div>
);

const InvioCampagnaWhatsapp: FC = () => {
    const { templatesWhatsappPromise, getPuntiLatLonPVPromise } =
        useLoaderData() as {
            templatesWhatsappPromise: Promise<(GDOWhatsappTemplateAttributes & { has_preset: boolean })[]>;
            getPuntiLatLonPVPromise: Promise<{ lat: number; lon: number }[]>;
        };

    const navigate = useNavigate();
    // Step gestito da query param ?step=1 / ?step=2
    const [searchParams, setSearchParams] = useSearchParams();
    const [dialogPartenzaCampagna, setDialogPartenzaCampagna] = useState(false);
    const stepParam = searchParams.get('step');
    const templateParam = searchParams.get('tpl');
    const step: ViewStep = stepParam === '2' ? 2 : 1;

    // --- FILTRI UTENTE (sincronizzati su query string) ---
    const [sessoUtenteGuest, setSessoUtenteGuest] = useState<string>(() => {
        return decodeURIComponent(searchParams.get('f_sesso') as string) ?? '';
    });

    // Intervallo di date (es: "2025-01-01 - 2025-01-31")
    const [dateRange, setDateRange] = useState<string>(() => {
        const raw = searchParams.get('f_date_range') ?? '';
        // se troviamo "[object Object]" lo ignoriamo
        if (raw && raw.includes('[object Object]')) return '';
        return raw;
    });

    const updateStepInSearch = (nextStep: ViewStep) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('step', String(nextStep));
        setSearchParams(newParams);
    };

    const updateFiltersInSearch = (filters: { sesso?: string; dateRange?: string }) => {
        const newParams = new URLSearchParams(searchParams);

        if (filters.sesso !== undefined) {
            if (!filters.sesso) {
                newParams.delete('f_sesso');
            } else {
                newParams.set('f_sesso', filters.sesso);
            }
        }

        if (filters.dateRange !== undefined) {
            if (!filters.dateRange) {
                newParams.delete('f_date_range');
            } else {
                newParams.set('f_date_range', filters.dateRange);
            }
        }

        setSearchParams(newParams);
    };

    const handleChangeSessoUtente = (value: string) => {
        setSessoUtenteGuest(value);
        updateFiltersInSearch({ sesso: value });
    };

    // sync da URL -> stato (sesso)
    useEffect(() => {
        const qp = searchParams.get('f_sesso') ?? '';
        console.log(decodeURIComponent(qp));
        setSessoUtenteGuest(decodeURIComponent(qp));
    }, [searchParams]);

    // sync da URL -> stato (date_range)
    useEffect(() => {
        const raw = searchParams.get('f_date_range') ?? '';
        if (raw && raw.includes('[object Object]')) {
            setDateRange('');
        } else {
            setDateRange(raw);
        }
    }, [searchParams]);

    const handleChangeDateRange = (value: any) => {
        const normalized = normalizeDateRangeValue(value);
        setDateRange(normalized);
        updateFiltersInSearch({ dateRange: normalized });
    };

    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(() => templateParam);
    const [searchQuery, setSearchQuery] = useState('');
    const [idUtente, setIdUtente] = useState('');
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [titoloCampagna, setTitoloCampagna] = useState('');
    const [isStartingCampaign, setIsStartingCampaign] = useState(false);

    // Filtro chiamate
    const [callFilterEnabled, setCallFilterEnabled] = useState(false);
    const [callFilterMode, setCallFilterMode] = useState<CallFilterMode>('circle');

    // Modalità cerchio
    const [callAreaCenter, setCallAreaCenter] = useState<LatLngExpression>([
        45.4612932,
        9.1594985, // centro Milano di default
    ]);
    const [callAreaRadiusKm, setCallAreaRadiusKm] = useState(5);
    const [callMinCalls, setCallMinCalls] = useState(0);
    const [callLastDays, setCallLastDays] = useState(30);

    // Modalità aree amministrative (Comuni / Regioni via Overpass)
    const [comuneSearch, setComuneSearch] = useState('');
    const [comuneOptions, setComuneOptions] = useState<ComuneOption[]>([]);
    const [selectedComuneId, setSelectedComuneId] = useState<number | null>(null);
    const [selectedComuneGeometry, setSelectedComuneGeometry] = useState<[number, number][][]>([]);

    const [isSearchingComuni, setIsSearchingComuni] = useState(false);
    const [isLoadingComuneGeometry, setIsLoadingComuneGeometry] = useState(false);
    const [comuniError, setComuniError] = useState<string | null>(null);

    // Istanza della mappa per eseguire fitBounds sui comuni/regioni
    const [leafletMap, setLeafletMap] = useState<LeafletMap | null>(null);

    // Dati utenti guest caricati dinamicamente
    const [utentiGuestData, setUtentiGuestData] = useState<{
        count: number;
        missing: number;
        total: number;
        positions: { lat: number; lng: number }[];
    } | null>(null);
    const [isLoadingUtentiGuest, setIsLoadingUtentiGuest] = useState(false);

    // Fetch utenti guest data con filtri via POST
    useEffect(() => {
        const fetchUtentiGuest = async () => {
            setIsLoadingUtentiGuest(true);
            try {
                const payload: any = {
                    sesso: sessoUtenteGuest || null,
                    dateRange: dateRange || null,
                };

                // Aggiungi filtri geografici se abilitati
                if (callFilterEnabled) {
                    if (callFilterMode === 'circle') {
                        payload.callFilter = {
                            type: 'circle',
                            center: callAreaCenter,
                            radiusKm: callAreaRadiusKm,
                            minCalls: callMinCalls,
                            lastDays: callLastDays,
                        };
                    } else {
                        payload.callFilter = {
                            type: callFilterMode,
                            areaId: selectedComuneId ? String(selectedComuneId) : null,
                            areaName: comuneOptions.find(c => c.id === selectedComuneId)?.name ?? null,
                            polygon: selectedComuneGeometry,
                            minCalls: callMinCalls,
                            lastDays: callLastDays,
                        };
                    }
                }

                const response = await ServerCall.post<{
                    count: number;
                    missing: number;
                    total: number;
                    positions: { lat: number; lng: number }[];
                }>('/whatsapp/get_all_utenti_guest_whatsapp_count', payload);

                setUtentiGuestData(response);
            } catch (error) {
                console.error('Errore nel caricamento utenti guest:', error);
                setUtentiGuestData(null);
            } finally {
                setIsLoadingUtentiGuest(false);
            }
        };

        fetchUtentiGuest();
    }, [
        sessoUtenteGuest,
        dateRange,
        callFilterEnabled,
        callFilterMode,
        callAreaCenter,
        callAreaRadiusKm,
        callMinCalls,
        callLastDays,
        selectedComuneId,
        selectedComuneGeometry,
        comuneOptions,
    ]);

    const handleSelect = (id: string, hasPreset: boolean) => {
        if (!hasPreset) return;

        setSelectedTemplate(id);

        const newParams = new URLSearchParams(searchParams);
        newParams.set('tpl', id);
        setSearchParams(newParams);
    };

    const handleGoToSummary = () => {
        updateStepInSearch(2);
    };

    const handleBackToSelection = () => {
        updateStepInSearch(1);
    };

    const handleSendTest = async (selectedTemplateData?: GDOWhatsappTemplateAttributes & { has_preset: boolean }) => {
        if (!selectedTemplateData || !idUtente) return;
        try {
            setIsSendingTest(true);
            await ServerCall.post<{ success: boolean; error?: string }>(
                '/whatsapp/invio_di_test_ad_utente',
                {
                    id_utente: idUtente,
                    id_template: selectedTemplateData.id_gdowhatsapptemplate,
                },
            );
            console.log('Invio test a:', idUtente, 'template:', selectedTemplateData.id_gdowhatsapptemplate);
        } finally {
            setIsSendingTest(false);
        }
    };

    const dist = (a: any, b: any) =>
        Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lon - b.lon, 2));

    // Ricostruisce poligoni multipli corretti da una relation OSM
    const buildRingsFromRelation = (rel: any): [number, number][][] => {
        if (!rel.members) return [];

        const outers = rel.members.filter((m: any) => m.role === 'outer' && m.geometry);
        const inners = rel.members.filter((m: any) => m.role === 'inner' && m.geometry);

        const buildRings = (ways: any[]): [number, number][][] => {
            const rings: [number, number][][] = [];
            const waysLeft = [...ways];

            while (waysLeft.length > 0) {
                let ring: any[] = [...waysLeft[0].geometry];
                waysLeft.splice(0, 1);

                let expanded = true;
                while (expanded) {
                    expanded = false;
                    for (let i = 0; i < waysLeft.length; i++) {
                        const w = waysLeft[i];

                        const start = ring[0];
                        const end = ring[ring.length - 1];
                        const wStart = w.geometry[0];
                        const wEnd = w.geometry[w.geometry.length - 1];

                        if (dist(end, wStart) < 0.0005) {
                            ring = [...ring, ...w.geometry];
                            waysLeft.splice(i, 1);
                            expanded = true;
                            break;
                        }
                        if (dist(end, wEnd) < 0.0005) {
                            ring = [...ring, ...w.geometry.slice().reverse()];
                            waysLeft.splice(i, 1);
                            expanded = true;
                            break;
                        }
                        if (dist(start, wEnd) < 0.0005) {
                            ring = [...w.geometry, ...ring];
                            waysLeft.splice(i, 1);
                            expanded = true;
                            break;
                        }
                        if (dist(start, wStart) < 0.0005) {
                            ring = [...w.geometry.slice().reverse(), ...ring];
                            waysLeft.splice(i, 1);
                            expanded = true;
                            break;
                        }
                    }
                }

                rings.push(ring.map((p) => [p.lat, p.lon]));
            }

            return rings;
        };

        const outerRings = buildRings(outers);
        const innerRings = buildRings(inners);

        return [...outerRings, ...innerRings];
    };

    const handleSearchComune = async () => {
        if (!comuneSearch.trim()) return;

        setIsSearchingComuni(true);
        setComuniError(null);
        setComuneOptions([]);
        setSelectedComuneId(null);
        setSelectedComuneGeometry([]);

        try {
            // admin_level 8 = comune, 4 = regione
            const adminLevel = callFilterMode === 'regioni' ? '4' : '8';

            const query = `
        [out:json][timeout:25];
        area["ISO3166-1"="IT"]->.it;
        (
          relation["boundary"="administrative"]["admin_level"="${adminLevel}"]["name"~"${comuneSearch}",i](area.it);
        );
        out tags center;
      `;
            const res = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: query,
            });
            if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);

            const data = await res.json();
            const elements: any[] = data.elements || [];

            const opts: ComuneOption[] = elements
                .filter((el) => el.type === 'relation' && el.tags?.name)
                .map((el) => ({
                    id: el.id,
                    name: el.tags['name:it'] || el.tags.name,
                    province: el.tags['addr:province'] || el.tags['is_in:province'] || undefined,
                    center: el.center ? ([el.center.lat, el.center.lon] as [number, number]) : undefined,
                }));

            setComuneOptions(opts);
            if (opts[0]?.center) {
                setCallAreaCenter(opts[0].center);
            }
            if (opts.length === 0) {
                setComuniError(
                    callFilterMode === 'regioni'
                        ? 'Nessuna regione trovata con questo nome.'
                        : 'Nessun comune trovato con questo nome.',
                );
            }
        } catch (err: any) {
            console.error(err);
            setComuniError(err?.message ?? 'Errore durante la ricerca area amministrativa.');
        } finally {
            setIsSearchingComuni(false);
        }
    };

    const handleSelectComune = async (value: string) => {
        if (!value) {
            setSelectedComuneId(null);
            setSelectedComuneGeometry([]);
            return;
        }
        const id = Number(value);
        if (!id || Number.isNaN(id)) return;

        setSelectedComuneId(id);
        setSelectedComuneGeometry([]);

        const option = comuneOptions.find((c) => c.id === id);
        if (option?.center) {
            setCallAreaCenter(option.center);
        }

        setIsLoadingComuneGeometry(true);
        setComuniError(null);

        try {
            const query = `
        [out:json][timeout:25];
        relation(${id});
        out geom;
      `;
            const res = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: query,
            });
            if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);

            const data = await res.json();
            const rel = (data.elements || []).find((el: any) => el.type === 'relation');
            if (!rel) throw new Error('Relation non trovata nella risposta.');

            const positions = buildRingsFromRelation(rel);
            if (positions.length > 0) {
                setSelectedComuneGeometry(positions);
                if (positions[0] && positions[0][0]) {
                    setCallAreaCenter(positions[0][0]);
                }

                if (leafletMap) {
                    const flatPositions = positions.flat();
                    const bounds = L.latLngBounds(flatPositions.map(([lat, lon]) => [lat, lon]));
                    leafletMap.fitBounds(bounds, { padding: [20, 20] });
                }
            } else {
                throw new Error('Non è stato possibile ottenere il contorno dell’area selezionata.');
            }
        } catch (err: any) {
            console.error(err);
            setComuniError(err?.message ?? 'Errore nel caricamento della geometria dell’area.');
        } finally {
            setIsLoadingComuneGeometry(false);
        }
    };

    const handleConfirmCampaign = async (selectedTemplateData?: GDOWhatsappTemplateAttributes & { has_preset: boolean }) => {
        if (!selectedTemplateData) return;
        if (selectedTemplateData.has_preset === false) return;
        const payload = {
            templateId: selectedTemplateData.id_gdowhatsapptemplate,
            titoloCampagna: titoloCampagna.trim(),
            callFilter: callFilterEnabled
                ? callFilterMode === 'circle'
                    ? {
                        type: 'circle' as const,
                        center: callAreaCenter,
                        radiusKm: callAreaRadiusKm,
                        minCalls: callMinCalls,
                        lastDays: callLastDays,
                    }
                    : {
                        type: callFilterMode, // 'comuni' | 'regioni'
                        areaId: selectedComuneId ? String(selectedComuneId) : null,
                        areaName: comuneOptions.find(c => c.id === selectedComuneId)?.name ?? null,
                        polygon: selectedComuneGeometry, // <-- POLIGONO COMPLETO
                        minCalls: callMinCalls,
                        lastDays: callLastDays,
                    }
                : null,
            userFilters: {
                sesso: sessoUtenteGuest || null,
                dateRange: dateRange || null,
            },
        };

        console.log('Conferma campagna payload:', payload);
        // Qui poi farai la chiamata API:
        const result = await ServerCall.post('/whatsapp/inizia_invio_campagna_whatsapp', payload);
        console.log('Risultato avvio campagna:', result);
        navigate('/whatsapp/campagne-whatsapp');
    };

    return (
        <Fragment>
            <Dialog open={dialogPartenzaCampagna} onClose={() => setDialogPartenzaCampagna(false)} size="md">
                <Dialog.Panel className="w-full max-w-2xl mx-auto">
                    <Dialog.Title className="font-semibold text-lg">
                        Conferma Avvio Campagna WhatsApp
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        Verifica i dettagli della campagna prima di procedere con l'invio. <strong className="text-danger">Questa azione non potrà essere annullata.</strong>

                        {/* Campo titolo campagna */}
                        <div className="mt-4">
                            <FormLabel htmlFor="titolo-campagna" className="font-medium text-slate-700 dark:text-slate-300">
                                Titolo Campagna *
                            </FormLabel>
                            <FormInput
                                id="titolo-campagna"
                                type="text"
                                placeholder="Es: Campagna Natale 2024"
                                value={titoloCampagna}
                                onChange={(e) => setTitoloCampagna(e.target.value)}
                                className="mt-1"
                                disabled={isStartingCampaign}
                            />
                        </div>

                        {utentiGuestData && (
                            <div className="mt-4 border border-slate-200 dark:border-darkmode-500 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                        Destinatari che riceveranno il messaggio
                                    </span>
                                    <span className="text-2xl font-bold text-primary">
                                        {utentiGuestData.count.toLocaleString('it-IT')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Totale: {utentiGuestData.total.toLocaleString('it-IT')}</span>
                                    <span>•</span>
                                    <span>Esclusi: {utentiGuestData.missing.toLocaleString('it-IT')}</span>
                                </div>
                            </div>
                        )}
                        {(sessoUtenteGuest || dateRange || callFilterEnabled) && (
                            <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                                <span className="font-medium">Filtri attivi:</span>
                                {' '}
                                {[
                                    sessoUtenteGuest && `Genere ${sessoUtenteGuest}`,
                                    dateRange && `Periodo ${dateRange}`,
                                    callFilterEnabled && (callFilterMode === 'circle'
                                        ? `Area ${callAreaRadiusKm} km`
                                        : comuneOptions.find(c => c.id === selectedComuneId)?.name)
                                ].filter(Boolean).join(', ')}
                            </div>
                        )}
                    </Dialog.Description>

                    {/* Statistiche destinatari */}

                    {/* Filtri applicati */}

                    <Dialog.Footer className="mt-5 flex justify-end gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => setDialogPartenzaCampagna(false)}
                            disabled={isStartingCampaign}
                        >
                            Annulla
                        </Button>
                        <PermissionGate permission={PERMISSIONS.WHATSAPP.INVIA_CAMPAGNA} mode="disable">
                        <Button
                            variant="primary"
                            disabled={!titoloCampagna.trim() || isStartingCampaign}
                            onClick={async () => {
                                if (!titoloCampagna.trim()) {
                                    alert('Il titolo della campagna è obbligatorio');
                                    return;
                                }

                                setIsStartingCampaign(true);
                                try {
                                    const selectedTemplateData = await templatesWhatsappPromise.then(templates =>
                                        templates.find((t: any) => t.id_gdowhatsapptemplate === selectedTemplate)
                                    );
                                    await handleConfirmCampaign(selectedTemplateData);
                                    setDialogPartenzaCampagna(false);
                                    setTitoloCampagna(''); // Reset del campo
                                } catch (error) {
                                    console.error('Errore avvio campagna:', error);
                                } finally {
                                    setIsStartingCampaign(false);
                                }
                            }}
                        >
                            {isStartingCampaign ? (
                                <>
                                    <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                                    Avvio in corso...
                                </>
                            ) : (
                                'Conferma e avvia'
                            )}
                        </Button>
                        </PermissionGate>
                    </Dialog.Footer>
                </Dialog.Panel>
            </Dialog>
            <PageHeader
                title="Invio Campagna WhatsApp"
                description="Seleziona un template e conferma i destinatari prima di avviare la campagna."
            />

            <AnimatePresence mode="wait">
                {step === 1 ? (
                    <motion.div
                        key="selection-view"
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="mt-3.5 grid grid-cols-12 gap-5"
                    >
                        {/* LISTA TEMPLATE (STEP 1) */}
                        <div className="col-span-12 lg:col-span-7 xl:col-span-8">
                            <Suspense fallback={<TemplatesListSkeleton />}>
                                <Await resolve={templatesWhatsappPromise}>
                                    {(templates: (GDOWhatsappTemplateAttributes & { has_preset: boolean })[]) => {
                                        const filteredTemplates = templates.filter((template) =>
                                            template.nome_template_gdowhatsapptemplate
                                                .toLowerCase()
                                                .includes(searchQuery.toLowerCase()),
                                        );

                                        const templatesWithPreset = filteredTemplates.filter((t) => t.has_preset);
                                        const templatesWithoutPreset = filteredTemplates.filter((t) => !t.has_preset);

                                        return (
                                            <div className="flex flex-col box box--stacked">
                                                {/* Ricerca */}
                                                <div className="p-5 border-b border-dashed">
                                                    <FormInput
                                                        type="text"
                                                        placeholder="Cerca template per nome..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="w-full"
                                                    />
                                                </div>

                                                {/* Contatore risultati */}
                                                <div className="px-5 py-3 bg-slate-50 dark:bg-darkmode-800/50 border-b border-dashed">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-slate-600 dark:text-slate-400">
                                                            {templatesWithPreset.length} template disponibili
                                                            {templatesWithoutPreset.length > 0 &&
                                                                ` • ${templatesWithoutPreset.length} non configurati`}
                                                        </span>
                                                        {selectedTemplate && (
                                                            <span className="text-primary font-medium">Template selezionato</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Lista */}
                                                <div className="overflow-x-auto">
                                                    {filteredTemplates.length === 0 ? (
                                                        <div className="p-10 text-center">
                                                            <Lucide
                                                                icon="Search"
                                                                className="w-12 h-12 mx-auto mb-3 text-slate-300"
                                                            />
                                                            <p className="text-slate-500">Nessun template trovato</p>
                                                        </div>
                                                    ) : (
                                                        <Table className="w-full">
                                                            <Table.Tbody>
                                                                {/* Template con preset */}
                                                                {templatesWithPreset.map((template) => {
                                                                    const statusMeta = getStatusConfig(
                                                                        template.stato_meta_gdowhatsapptemplate,
                                                                    );
                                                                    const categoryMeta = getCategoryConfig(
                                                                        template.categoria_template_gdowhatsapptemplate,
                                                                    );
                                                                    const langCode =
                                                                        template.json_meta_gdowhatsapptemplate.language?.code ??
                                                                        template.lingua_template_gdowhatsapptemplate;

                                                                    const isSelected =
                                                                        selectedTemplate === template.id_gdowhatsapptemplate;

                                                                    return (
                                                                        <Table.Tr
                                                                            key={template.id_gdowhatsapptemplate}
                                                                            className={clsx(
                                                                                'cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-darkmode-700',
                                                                                isSelected &&
                                                                                'bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary shadow-sm',
                                                                            )}
                                                                            onClick={() =>
                                                                                handleSelect(
                                                                                    template.id_gdowhatsapptemplate as string,
                                                                                    template.has_preset,
                                                                                )
                                                                            }
                                                                        >
                                                                            <Table.Td className="py-4 w-full">
                                                                                <div className="flex items-start gap-3">
                                                                                    <FormCheck className="mt-1">
                                                                                        <FormCheck.Input
                                                                                            type="radio"
                                                                                            name="templateRadio"
                                                                                            checked={isSelected}
                                                                                            onChange={() =>
                                                                                                handleSelect(
                                                                                                    template.id_gdowhatsapptemplate as string,
                                                                                                    template.has_preset,
                                                                                                )
                                                                                            }
                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                        />
                                                                                    </FormCheck>

                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="flex items-start justify-between gap-3 mb-2">
                                                                                            <div className="flex-1">
                                                                                                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1.5">
                                                                                                    {
                                                                                                        template.nome_template_gdowhatsapptemplate
                                                                                                    }
                                                                                                </h3>
                                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                                    {langCode && (
                                                                                                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wider dark:bg-darkmode-400/40">
                                                                                                            <Lucide
                                                                                                                icon="Globe"
                                                                                                                className="w-3 h-3"
                                                                                                            />
                                                                                                            {langCode}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    <span
                                                                                                        className={clsx(
                                                                                                            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium',
                                                                                                            categoryMeta.className,
                                                                                                        )}
                                                                                                    >
                                                                                                        <Lucide
                                                                                                            icon={categoryMeta.icon}
                                                                                                            className="w-3 h-3"
                                                                                                        />
                                                                                                        {categoryMeta.label}
                                                                                                    </span>
                                                                                                    <span
                                                                                                        className={clsx(
                                                                                                            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold',
                                                                                                            statusMeta.className,
                                                                                                        )}
                                                                                                    >
                                                                                                        <Lucide
                                                                                                            icon={statusMeta.icon}
                                                                                                            className="w-3 h-3"
                                                                                                        />
                                                                                                        {statusMeta.label}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>

                                                                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                                                                            {getBodyInfo(template).substring(0, 100)}
                                                                                            {getBodyInfo(template).length > 100 && '...'}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                            </Table.Td>
                                                                        </Table.Tr>
                                                                    );
                                                                })}

                                                                {/* Template senza preset - disabilitati */}
                                                                {templatesWithoutPreset.map((template) => {
                                                                    const statusMeta = getStatusConfig(
                                                                        template.stato_meta_gdowhatsapptemplate,
                                                                    );
                                                                    const categoryMeta = getCategoryConfig(
                                                                        template.categoria_template_gdowhatsapptemplate,
                                                                    );
                                                                    const langCode =
                                                                        template.json_meta_gdowhatsapptemplate.language?.code ??
                                                                        template.lingua_template_gdowhatsapptemplate;

                                                                    return (
                                                                        <Table.Tr
                                                                            key={template.id_gdowhatsapptemplate}
                                                                            className="opacity-50 cursor-not-allowed bg-slate-50/50 dark:bg-darkmode-800/30"
                                                                        >
                                                                            <Table.Td className="py-4 w-full">
                                                                                <div className="flex items-start gap-3">
                                                                                    <FormCheck className="mt-1">
                                                                                        <FormCheck.Input
                                                                                            type="radio"
                                                                                            name="templateRadio"
                                                                                            disabled
                                                                                            checked={false}
                                                                                        />
                                                                                    </FormCheck>

                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="flex items-start justify-between gap-3 mb-2">
                                                                                            <div className="flex-1">
                                                                                                <div className="flex items-center gap-2 mb-1.5">
                                                                                                    <h3 className="font-semibold text-slate-600 dark:text-slate-400">
                                                                                                        {
                                                                                                            template.nome_template_gdowhatsapptemplate
                                                                                                        }
                                                                                                    </h3>
                                                                                                    <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 text-warning px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                                                                                                        <Lucide
                                                                                                            icon="CircleAlert"
                                                                                                            className="w-3 h-3"
                                                                                                        />
                                                                                                        Non configurato
                                                                                                    </span>
                                                                                                </div>
                                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                                    {langCode && (
                                                                                                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wider dark:bg-darkmode-400/40">
                                                                                                            <Lucide
                                                                                                                icon="Globe"
                                                                                                                className="w-3 h-3"
                                                                                                            />
                                                                                                            {langCode}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    <span
                                                                                                        className={clsx(
                                                                                                            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium',
                                                                                                            categoryMeta.className,
                                                                                                        )}
                                                                                                    >
                                                                                                        <Lucide
                                                                                                            icon={categoryMeta.icon}
                                                                                                            className="w-3 h-3"
                                                                                                        />
                                                                                                        {categoryMeta.label}
                                                                                                    </span>
                                                                                                    <span
                                                                                                        className={clsx(
                                                                                                            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold',
                                                                                                            statusMeta.className,
                                                                                                        )}
                                                                                                    >
                                                                                                        <Lucide
                                                                                                            icon={statusMeta.icon}
                                                                                                            className="w-3 h-3"
                                                                                                        />
                                                                                                        {statusMeta.label}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                        <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2">
                                                                                            Questo template non ha un preset configurato e non può
                                                                                            essere utilizzato per l'invio.
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                            </Table.Td>
                                                                        </Table.Tr>
                                                                    );
                                                                })}
                                                            </Table.Tbody>
                                                        </Table>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }}
                                </Await>
                            </Suspense>
                        </div>

                        {/* Anteprima + CTA per passare allo step 2 */}
                        <div className="col-span-12 lg:col-span-5 xl:col-span-4">
                            <div className="sticky top-5">
                                <Suspense fallback={<TemplatePreviewSkeleton />}>
                                    <Await resolve={templatesWhatsappPromise}>
                                        {(templates: (GDOWhatsappTemplateAttributes & { has_preset: boolean })[]) => {
                                            const selectedTemplateData = templates.find(
                                                (t) => t.id_gdowhatsapptemplate === selectedTemplate,
                                            );

                                            if (!selectedTemplateData) {
                                                return (
                                                    <div className="box box--stacked p-10 text-center">
                                                        <Lucide
                                                            icon="MessageSquare"
                                                            className="w-16 h-16 mx-auto mb-4 text-slate-300"
                                                        />
                                                        <h3 className="font-semibold text-lg mb-2">
                                                            Seleziona un Template
                                                        </h3>
                                                        <p className="text-sm text-slate-500">
                                                            Scegli un template dalla lista per visualizzare l'anteprima e poi
                                                            passare al riepilogo.
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="flex flex-col box box--stacked">
                                                    <div className="p-5 border-b border-dashed">
                                                        <h3 className="font-semibold text-lg mb-1">Anteprima Template</h3>
                                                        <p className="text-xs text-slate-500">
                                                            Verifica rapidamente il contenuto del messaggio.
                                                        </p>
                                                    </div>

                                                    {/* Mockup WhatsApp */}
                                                    <div className="p-5 bg-slate-50 dark:bg-darkmode-800/50">
                                                        <div className="bg-white dark:bg-darkmode-600 rounded-lg shadow-md overflow-hidden max-w-sm mx-auto">
                                                            {/* Header */}
                                                            {(() => {
                                                                const headerInfo = getHeaderInfo(selectedTemplateData);
                                                                if (headerInfo.format === 'TEXT' && headerInfo.text) {
                                                                    return (
                                                                        <div className="p-4 bg-slate-100 dark:bg-darkmode-700 font-semibold text-sm border-b">
                                                                            {headerInfo.text}
                                                                        </div>
                                                                    );
                                                                } else if (headerInfo.format === 'IMAGE') {
                                                                    return (
                                                                        <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-darkmode-700 dark:to-darkmode-800 flex items-center justify-center border-b">
                                                                            <Lucide
                                                                                icon="Image"
                                                                                className="w-12 h-12 text-slate-400"
                                                                            />
                                                                        </div>
                                                                    );
                                                                } else if (headerInfo.format === 'VIDEO') {
                                                                    return (
                                                                        <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-darkmode-700 dark:to-darkmode-800 flex items-center justify-center border-b">
                                                                            <Lucide
                                                                                icon="Video"
                                                                                className="w-12 h-12 text-slate-400"
                                                                            />
                                                                        </div>
                                                                    );
                                                                } else if (headerInfo.format === 'DOCUMENT') {
                                                                    return (
                                                                        <div className="p-4 bg-slate-100 dark:bg-darkmode-700 border-b flex items-center gap-3">
                                                                            <Lucide
                                                                                icon="FileText"
                                                                                className="w-8 h-8 text-slate-400"
                                                                            />
                                                                            <span className="text-xs text-slate-600 dark:text-slate-300">
                                                                                Documento allegato
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}

                                                            {/* Body */}
                                                            <div className="p-4">
                                                                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap line-clamp-5">
                                                                    {getBodyInfo(selectedTemplateData)}
                                                                </p>
                                                            </div>

                                                            {/* Footer */}
                                                            {(() => {
                                                                const footer = getFooterInfo(selectedTemplateData);
                                                                if (footer) {
                                                                    return (
                                                                        <div className="px-4 pb-3">
                                                                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                                                                {footer}
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}

                                                            {/* Buttons */}
                                                            {(() => {
                                                                const buttons = getButtonsInfo(selectedTemplateData);
                                                                if (buttons.length > 0) {
                                                                    return (
                                                                        <div className="border-t border-slate-200 dark:border-darkmode-500">
                                                                            {buttons.map((button, idx) => (
                                                                                <button
                                                                                    key={idx}
                                                                                    className="w-full p-3 text-center text-sm font-medium text-primary hover:bg-slate-50 dark:hover:bg-darkmode-700 transition-colors border-b last:border-b-0 border-slate-200 dark:border-darkmode-500 flex items-center justify-center gap-2"
                                                                                >
                                                                                    {button.type === 'URL' && (
                                                                                        <Lucide
                                                                                            icon="ExternalLink"
                                                                                            className="w-4 h-4"
                                                                                        />
                                                                                    )}
                                                                                    {button.type === 'PHONE_NUMBER' && (
                                                                                        <Lucide icon="Phone" className="w-4 h-4" />
                                                                                    )}
                                                                                    {button.type === 'COPY_CODE' && (
                                                                                        <Lucide icon="Copy" className="w-4 h-4" />
                                                                                    )}
                                                                                    {button.text}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* CTA per andare al riepilogo */}
                                                    <div className="p-5 border-t bg-slate-50 dark:bg-darkmode-800/50 w-full">
                                                        <Button
                                                            className="w-full"
                                                            variant="primary"
                                                            disabled={
                                                                !selectedTemplateData ||
                                                                selectedTemplateData.stato_meta_gdowhatsapptemplate !== 'APPROVED'
                                                            }
                                                            onClick={handleGoToSummary}
                                                        >
                                                            <Lucide icon="ArrowRight" className="w-4 h-4 mr-2" />
                                                            Vai al riepilogo e conferma
                                                        </Button>
                                                        {selectedTemplateData.stato_meta_gdowhatsapptemplate !== 'APPROVED' && (
                                                            <p className="mt-2 text-xs text-center text-slate-500">
                                                                Solo i template approvati possono essere inviati
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </Await>
                                </Suspense>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="summary-view"
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="mt-3.5 grid grid-cols-12 gap-5"
                    >
                        {/* RIEPILOGO (STEP 2) */}


                        <div className="col-span-12 xl:col-span-7">
                            <div className="flex flex-col box box--stacked">
                                <div className="p-5 border-b border-dashed flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">Riepilogo campagna</h3>
                                        <p className="text-xs text-slate-500">
                                            Controlla i destinatari prima di avviare l'invio.
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                                        <Lucide icon="ListChecks" className="w-4 h-4" />
                                        Step 2 di 2
                                    </span>
                                </div>

                                <Suspense fallback={<SummarySkeleton />}>
                                    <Await resolve={templatesWhatsappPromise}>
                                        {(templates: (GDOWhatsappTemplateAttributes & { has_preset: boolean })[]) => {
                                            const selectedTemplateData = templates.find(
                                                (t) => t.id_gdowhatsapptemplate === selectedTemplate,
                                            );

                                            if (!selectedTemplateData) {
                                                return (
                                                    <div className="p-5">
                                                        <EmptyState
                                                            title="Nessun template selezionato"
                                                            description="Seleziona un template per visualizzarne l'anteprima."
                                                            icon="MonitorX"
                                                            buttonText="Torna Indietro"
                                                            iconColor="w-10 h-10 text-danger"
                                                            onButtonClick={handleBackToSelection}
                                                        />
                                                    </div>
                                                );
                                            }
                                            if (selectedTemplateData.has_preset == false) {
                                                return (
                                                    <div className="col-span-12">
                                                        <div className="box box--stacked p-10 text-center">
                                                            <Lucide
                                                                icon="TriangleAlert"
                                                                className="w-16 h-16 mx-auto mb-4 text-warning"
                                                            />
                                                            <h3 className="font-semibold text-lg mb-2">
                                                                Template senza preset configurato
                                                            </h3>
                                                            <p className="text-sm text-slate-500">
                                                                Il template selezionato non ha un preset configurato e non può essere
                                                                utilizzato per l'invio della campagna. Torna indietro e seleziona un altro
                                                                template.
                                                            </p>
                                                            <Button
                                                                className="mt-4"
                                                                variant="secondary"
                                                                onClick={handleBackToSelection}
                                                            >
                                                                <Lucide icon="ArrowLeft" className="w-4 h-4 mr-2" />
                                                                Torna Indietro
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            }


                                            const categoryMeta = getCategoryConfig(
                                                selectedTemplateData.categoria_template_gdowhatsapptemplate,
                                            );
                                            const statusMeta = getStatusConfig(
                                                selectedTemplateData.stato_meta_gdowhatsapptemplate,
                                            );
                                            const langCode =
                                                selectedTemplateData.json_meta_gdowhatsapptemplate.language?.code ??
                                                selectedTemplateData.lingua_template_gdowhatsapptemplate;

                                            return (
                                                <div className="p-5 space-y-5">
                                                    {/* Info preset + destinatari */}
                                                    <div className="grid md:grid-cols-2 gap-4">
                                                        <div className="border border-dashed rounded-lg p-4">
                                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                                                Template selezionato
                                                            </h4>
                                                            <p className="font-semibold text-sm mb-1">
                                                                {selectedTemplateData.nome_template_gdowhatsapptemplate}
                                                            </p>
                                                            <p className="text-xs text-slate-500 mb-3">
                                                                {categoryMeta.label} • {langCode}
                                                            </p>
                                                            <span
                                                                className={clsx(
                                                                    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold',
                                                                    statusMeta.className,
                                                                )}
                                                            >
                                                                <Lucide
                                                                    icon={statusMeta.icon}
                                                                    className="w-3.5 h-3.5"
                                                                />
                                                                {statusMeta.label}
                                                            </span>
                                                        </div>

                                                        {/* Box numeri destinatari */}
                                                        {isLoadingUtentiGuest ? (
                                                            <DestinatariSkeleton />
                                                        ) : utentiGuestData ? (
                                                            <div className="border border-dashed rounded-lg p-4">
                                                                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                                                    Destinatari
                                                                </h4>
                                                                <div className="flex items-end gap-3 mb-3">
                                                                    <div>
                                                                        <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
                                                                            {utentiGuestData.count.toLocaleString('it-IT')}
                                                                        </p>
                                                                        <p className="text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-semibold">
                                                                            verranno raggiunti
                                                                        </p>
                                                                    </div>
                                                                    <div className="h-10 w-px bg-slate-200 dark:bg-darkmode-500" />
                                                                    <div>
                                                                        <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                                                                            {utentiGuestData.missing}
                                                                        </p>
                                                                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                                                            esclusi dal target
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <p className="text-[11px] text-slate-500">
                                                                    Totale contatti nel segmento:{' '}
                                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                                        {utentiGuestData.total.toLocaleString('it-IT')}
                                                                    </span>
                                                                </p>
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    {/* Motivi di esclusione (mock) */}
                                                    <div className="border border-dashed rounded-lg p-4">
                                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                                                            Motivi di esclusione
                                                        </h4>
                                                        <div className="grid sm:grid-cols-3 gap-3 text-xs">
                                                            <div className="flex items-start gap-2">
                                                                <Lucide
                                                                    icon="BellOff"
                                                                    className="w-4 h-4 mt-0.5 text-slate-400"
                                                                />
                                                                <div>
                                                                    <p className="font-medium text-slate-700 dark:text-slate-100">
                                                                        Opt-out marketing
                                                                    </p>
                                                                    <p className="text-slate-500">
                                                                        Utenti che hanno disattivato le comunicazioni promozionali.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-start gap-2">
                                                                <Lucide
                                                                    icon="PhoneOff"
                                                                    className="w-4 h-4 mt-0.5 text-slate-400"
                                                                />
                                                                <div>
                                                                    <p className="font-medium text-slate-700 dark:text-slate-100">
                                                                        Numero non valido
                                                                    </p>
                                                                    <p className="text-slate-500">
                                                                        Numeri mancanti o non compatibili con WhatsApp.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-start gap-2">
                                                                <Lucide
                                                                    icon="UserX"
                                                                    className="w-4 h-4 mt-0.5 text-slate-400"
                                                                />
                                                                <div>
                                                                    <p className="font-medium text-slate-700 dark:text-slate-100">
                                                                        Regole campagna
                                                                    </p>
                                                                    <p className="text-slate-500">
                                                                        Esclusioni basate su filtri o limiti di frequenza.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* FILTRO CAMPI UTENTE (con range date) */}
                                                    <div className="border border-dashed rounded-lg p-4 space-y-4">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div>
                                                                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                                    Filtro per campi utente
                                                                </h4>
                                                                <p className="text-[11px] text-slate-500">
                                                                    Escludi contatti in base a dei filtri specifici.
                                                                </p>
                                                            </div>

                                                            {(sessoUtenteGuest || dateRange) && (
                                                                <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-slate-50 px-2 py-[2px] border border-slate-200">
                                                                    <span className="text-[10px] font-medium text-slate-600">
                                                                        Filtri attivi:
                                                                    </span>
                                                                    {sessoUtenteGuest && (
                                                                        <span className="text-[10px] font-semibold text-sky-600">
                                                                            sesso:{' '}
                                                                            {Object.entries(UTENTE_GENERE).find(([_, v]) => v === sessoUtenteGuest)?.[1]?.toLocaleLowerCase('it-IT') ?? sessoUtenteGuest}
                                                                        </span>
                                                                    )}
                                                                    {dateRange && (
                                                                        <span className="text-[10px] font-semibold text-emerald-600">
                                                                            date: {dateRange}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="space-y-3">
                                                            <div>
                                                                <FormLabel
                                                                    htmlFor="sessoUtenteGuest"
                                                                    className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1"
                                                                >
                                                                    Sesso utente
                                                                </FormLabel>
                                                                <FormSelect
                                                                    id="sessoUtenteGuest"
                                                                    value={sessoUtenteGuest}
                                                                    onChange={(e) => handleChangeSessoUtente(e.target.value)}
                                                                >
                                                                    <option value="">Nessun filtro</option>
                                                                    {Object.keys(UTENTE_GENERE).map((key) => (
                                                                        <option key={key} value={encodeURIComponent(UTENTE_GENERE[key as keyof typeof UTENTE_GENERE])}>
                                                                            {UTENTE_GENERE[
                                                                                key as keyof typeof UTENTE_GENERE
                                                                            ].toLocaleLowerCase('it-IT').replace(/^./, (str) => str.toUpperCase())}
                                                                        </option>
                                                                    ))}
                                                                </FormSelect>
                                                                <p className="mt-1 text-[11px] text-slate-500">
                                                                    Se selezioni un valore, verranno considerati solo gli utenti che
                                                                    corrispondono al sesso indicato. Gli altri saranno esclusi dalla
                                                                    campagna.
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <FormLabel
                                                                    htmlFor="rangeDateUtenteGuest"
                                                                    className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1"
                                                                >
                                                                    Intervallo date
                                                                </FormLabel>
                                                                <div className="flex items-center gap-2">
                                                                    <Litepicker
                                                                        id="rangeDateUtenteGuest"
                                                                        value={dateRange}
                                                                        onChange={(value) => handleChangeDateRange(value)}
                                                                        options={{
                                                                            singleMode: false,
                                                                            numberOfMonths: 2,
                                                                            format: 'YYYY-MM-DD',
                                                                        }}
                                                                    />
                                                                </div>
                                                                <p className="mt-1 text-[11px] text-slate-500">
                                                                    Seleziona un intervallo di date: verranno considerati solo gli
                                                                    utenti la cui data di riferimento ricade all’interno del range
                                                                    selezionato.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Filtro zona chiamate */}
                                                    <div className="border border-dashed rounded-lg p-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div>
                                                                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                                    Filtro zona chiamate
                                                                </h4>
                                                                <p className="text-[11px] text-slate-500">
                                                                    Escludi contatti in base alla zona e allo storico delle chiamate.
                                                                </p>
                                                            </div>
                                                            <FormCheck>
                                                                <FormCheck.Input
                                                                    type="checkbox"
                                                                    checked={callFilterEnabled}
                                                                    onChange={(e) => setCallFilterEnabled(e.target.checked)}
                                                                />
                                                            </FormCheck>
                                                        </div>

                                                        {/* Toggle modalità */}
                                                        <div className="mb-3 flex items-center gap-2 text-[11px]">
                                                            <span className="text-slate-500">Modalità:</span>
                                                            <div className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-darkmode-700">
                                                                <button
                                                                    type="button"
                                                                    className={clsx(
                                                                        'px-3 py-1 rounded-full transition text-xs',
                                                                        callFilterMode === 'circle'
                                                                            ? 'bg-white shadow text-slate-800 dark:bg-darkmode-600 dark:text-slate-100'
                                                                            : 'text-slate-500 dark:text-slate-300',
                                                                    )}
                                                                    onClick={() => setCallFilterMode('circle')}
                                                                >
                                                                    Cerchio
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className={clsx(
                                                                        'px-3 py-1 rounded-full transition text-xs',
                                                                        callFilterMode === 'comuni'
                                                                            ? 'bg-white shadow text-slate-800 dark:bg-darkmode-600 dark:text-slate-100'
                                                                            : 'text-slate-500 dark:text-slate-300',
                                                                    )}
                                                                    onClick={() => setCallFilterMode('comuni')}
                                                                >
                                                                    Comuni (Overpass)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className={clsx(
                                                                        'px-3 py-1 rounded-full transition text-xs',
                                                                        callFilterMode === 'regioni'
                                                                            ? 'bg-white shadow text-slate-800 dark:bg-darkmode-600 dark:text-slate-100'
                                                                            : 'text-slate-500 dark:text-slate-300',
                                                                    )}
                                                                    onClick={() => setCallFilterMode('regioni')}
                                                                >
                                                                    Regioni (Overpass)
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {comuniError && callFilterMode !== 'circle' && (
                                                            <p className="mb-2 text-[11px] text-danger">{comuniError}</p>
                                                        )}

                                                        <div
                                                            className={clsx(
                                                                'space-y-3',
                                                                !callFilterEnabled && 'opacity-40 pointer-events-none',
                                                            )}
                                                        >
                                                            {/* Mappa con loader dedicato per i punti PV */}
                                                            {callFilterEnabled && (
                                                                <Suspense fallback={<MapSkeleton />}>
                                                                    <Await resolve={getPuntiLatLonPVPromise}>
                                                                        {(puntiLatLonPV) => (
                                                                            <div className="h-96 rounded-lg overflow-hidden border border-slate-200 dark:border-darkmode-500 relative">
                                                                                {(isLoadingComuneGeometry || isSearchingComuni) &&
                                                                                    callFilterMode !== 'circle' && (
                                                                                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-darkmode-800/60 z-[500]">
                                                                                            <div className="text-xs text-slate-600 dark:text-slate-300">
                                                                                                Caricamento dati area...
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                <MapContainer
                                                                                    center={callAreaCenter}
                                                                                    preferCanvas
                                                                                    zoom={callFilterMode === 'circle' ? 6 : 8}
                                                                                    scrollWheelZoom={false}
                                                                                    ref={(mapInstance) => setLeafletMap(mapInstance)}
                                                                                    className="h-full w-full"
                                                                                >
                                                                                    <HeatmapLayer
                                                                                        points={
                                                                                            utentiGuestData
                                                                                                ? utentiGuestData.positions.map((position: { lat: number; lng: number }) => [position.lat, position.lng, 1])
                                                                                                : []
                                                                                        }
                                                                                        options={{ radius: 15, blur: 10, minOpacity: 0.3 }}
                                                                                    />
                                                                                    <TileLayer
                                                                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                                                    />


                                                                                    {callFilterMode === 'circle' ? (
                                                                                        <>
                                                                                            <Circle
                                                                                                center={callAreaCenter}
                                                                                                radius={callAreaRadiusKm * 1000}
                                                                                                pathOptions={{
                                                                                                    color: '#3b82f6',
                                                                                                    weight: 2,
                                                                                                    fillColor: '#3b82f6',
                                                                                                    fillOpacity: 0.15,
                                                                                                }}
                                                                                            />
                                                                                            <CallZoneClickHandler onChangeCenter={setCallAreaCenter} />
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            {selectedComuneGeometry.length > 0 &&
                                                                                                selectedComuneGeometry.map((polygon, idx) => (
                                                                                                    <Polygon
                                                                                                        key={idx}
                                                                                                        positions={polygon}
                                                                                                        pathOptions={{
                                                                                                            color:
                                                                                                                callFilterMode === 'regioni'
                                                                                                                    ? '#6366f1'
                                                                                                                    : '#22c55e',
                                                                                                            weight: 1,
                                                                                                            fillColor:
                                                                                                                callFilterMode === 'regioni'
                                                                                                                    ? '#818cf8'
                                                                                                                    : '#4ade80',
                                                                                                            fillOpacity: 0.25,
                                                                                                        }}
                                                                                                        eventHandlers={{
                                                                                                            mouseover: (e) => {
                                                                                                                const layer = e.target as any;
                                                                                                                layer.setStyle({
                                                                                                                    weight: 2,
                                                                                                                    fillOpacity: 0.35,
                                                                                                                });
                                                                                                            },
                                                                                                            mouseout: (e) => {
                                                                                                                const layer = e.target as any;
                                                                                                                layer.setStyle({
                                                                                                                    weight: 1,
                                                                                                                    fillOpacity: 0.25,
                                                                                                                });
                                                                                                            },
                                                                                                        }}
                                                                                                    />
                                                                                                ))}
                                                                                        </>
                                                                                    )}

                                                                                    {puntiLatLonPV &&
                                                                                        puntiLatLonPV.map((pv: { lat: number; lon: number }, idx: number) => (
                                                                                            <Marker
                                                                                                key={idx}
                                                                                                position={[pv.lat, pv.lon]}
                                                                                                icon={L.icon({
                                                                                                    iconUrl: '/images/map-marker.png',
                                                                                                    iconSize: [24, 24],
                                                                                                    iconAnchor: [12, 24],
                                                                                                })}
                                                                                            />
                                                                                        ))}
                                                                                </MapContainer>
                                                                            </div>
                                                                        )}
                                                                    </Await>
                                                                </Suspense>
                                                            )}

                                                            {/* Parametri filtro + select comuni */}
                                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                                <div>
                                                                    {callFilterMode === 'circle' ? (
                                                                        <>
                                                                            <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">
                                                                                Raggio zona (km)
                                                                            </label>
                                                                            <FormInput
                                                                                type="number"
                                                                                min={1}
                                                                                max={100}
                                                                                value={callAreaRadiusKm}
                                                                                onChange={(e) =>
                                                                                    setCallAreaRadiusKm(Number(e.target.value) || 1)
                                                                                }
                                                                            />
                                                                            <p className="mt-1 text-[11px] text-slate-500">
                                                                                Clicca sulla mappa per spostare il centro della zona.
                                                                            </p>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">
                                                                                Comune (admin_level=8)
                                                                            </label>
                                                                            <div className="flex gap-2 mb-2">
                                                                                <FormInput
                                                                                    type="text"
                                                                                    value={comuneSearch}
                                                                                    onChange={(e) => setComuneSearch(e.target.value)}
                                                                                    placeholder="Es. Milano, Torino..."
                                                                                    className="flex-1"
                                                                                />
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="outline-secondary"
                                                                                    onClick={handleSearchComune}
                                                                                    disabled={isSearchingComuni || !comuneSearch.trim()}
                                                                                >
                                                                                    <Lucide icon="Search" className="w-4 h-4" />
                                                                                </Button>
                                                                            </div>
                                                                            <select
                                                                                className="w-full border-slate-200 rounded-md text-xs px-2 py-1.5 bg-white dark:bg-darkmode-700 dark:border-darkmode-500"
                                                                                value={selectedComuneId ?? ''}
                                                                                onChange={(e) => handleSelectComune(e.target.value)}
                                                                            >
                                                                                <option value="">Seleziona un comune...</option>
                                                                                {comuneOptions.map((opt) => (
                                                                                    <option key={opt.id} value={opt.id}>
                                                                                        {opt.name}
                                                                                        {opt.province ? ` (${opt.province})` : ''}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                            <p className="mt-1 text-[11px] text-slate-500">
                                                                                Il comune selezionato verrà escluso dalla campagna.
                                                                            </p>
                                                                        </>
                                                                    )}
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <div>
                                                                        <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">
                                                                            Negli ultimi (giorni)
                                                                        </label>
                                                                        <FormInput
                                                                            type="number"
                                                                            min={1}
                                                                            value={callLastDays}
                                                                            onChange={(e) =>
                                                                                setCallLastDays(Number(e.target.value) || 1)
                                                                            }
                                                                        />
                                                                    </div>

                                                                    {callFilterMode === 'circle' ? (
                                                                        <div>
                                                                            <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">
                                                                                Min. chiamate nel periodo
                                                                            </label>
                                                                            <FormInput
                                                                                type="number"
                                                                                min={0}
                                                                                value={callMinCalls}
                                                                                onChange={(e) =>
                                                                                    setCallMinCalls(Number(e.target.value) || 0)
                                                                                }
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-[11px] text-slate-500 mt-4">
                                                                            Comune selezionato:{' '}
                                                                            <span className="font-semibold">
                                                                                {selectedComuneId
                                                                                    ? comuneOptions.find(
                                                                                        (c) => c.id === selectedComuneId,
                                                                                    )?.name ?? selectedComuneId
                                                                                    : 'nessuno'}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <p className="text-[11px] text-slate-500">
                                                                Quando il filtro è attivo, i contatti{' '}
                                                                {callFilterMode === 'circle'
                                                                    ? 'all’interno del cerchio'
                                                                    : 'nel comune selezionato'}{' '}
                                                                che rispettano questi criteri verranno{' '}
                                                                <span className="font-semibold">esclusi</span> dalla campagna
                                                                WhatsApp.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </Await>
                                </Suspense>
                            </div>
                        </div>
                        {/* Mockup + invio test + conferma */}
                        <Suspense fallback={<span>Loading...</span>}>
                            <Await resolve={templatesWhatsappPromise}>
                                {(templates: (GDOWhatsappTemplateAttributes & { has_preset: boolean })[]) => {
                                    const selectedTemplateData = templates.find(
                                        (t) => t.id_gdowhatsapptemplate === selectedTemplate,
                                    );
                                    if (selectedTemplateData == null) {
                                        return null;
                                    }

                                    return (
                                        <div className="col-span-12 xl:col-span-5">
                                            <div className="flex flex-col box box--stacked">
                                                {/* Mockup WhatsApp riepilogo */}
                                                <div className="p-5 border-b border-dashed">
                                                    <h3 className="font-semibold text-lg mb-1">Anteprima messaggio</h3>
                                                    <p className="text-xs text-slate-500">
                                                        Così apparirà al cliente su WhatsApp.
                                                    </p>
                                                </div>

                                                <Suspense fallback={<MessagePreviewSkeleton />}>
                                                    <Await resolve={templatesWhatsappPromise}>
                                                        {(templates: (GDOWhatsappTemplateAttributes & { has_preset: boolean })[]) => {
                                                            const selectedTemplateData = templates.find(
                                                                (t) => t.id_gdowhatsapptemplate === selectedTemplate,
                                                            );

                                                            if (!selectedTemplateData) {
                                                                return null;
                                                            }

                                                            return (
                                                                <div className="p-5 bg-slate-50 dark:bg-darkmode-800/50">
                                                                    <div className="bg-white dark:bg-darkmode-600 rounded-lg shadow-md overflow-hidden max-w-sm mx-auto">
                                                                        {/* Header */}
                                                                        {(() => {
                                                                            const headerInfo = getHeaderInfo(selectedTemplateData);
                                                                            if (headerInfo.format === 'TEXT' && headerInfo.text) {
                                                                                return (
                                                                                    <div className="p-4 bg-slate-100 dark:bg-darkmode-700 font-semibold text-sm border-b">
                                                                                        {headerInfo.text}
                                                                                    </div>
                                                                                );
                                                                            } else if (headerInfo.format === 'IMAGE') {
                                                                                return (
                                                                                    <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-darkmode-700 dark:to-darkmode-800 flex items-center justify-center border-b">
                                                                                        <Lucide
                                                                                            icon="Image"
                                                                                            className="w-12 h-12 text-slate-400"
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            } else if (headerInfo.format === 'VIDEO') {
                                                                                return (
                                                                                    <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-darkmode-700 dark:to-darkmode-800 flex items-center justify-center border-b">
                                                                                        <Lucide
                                                                                            icon="Video"
                                                                                            className="w-12 h-12 text-slate-400"
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            } else if (headerInfo.format === 'DOCUMENT') {
                                                                                return (
                                                                                    <div className="p-4 bg-slate-100 dark:bg-darkmode-700 border-b flex items-center gap-3">
                                                                                        <Lucide
                                                                                            icon="FileText"
                                                                                            className="w-8 h-8 text-slate-400"
                                                                                        />
                                                                                        <span className="text-xs text-slate-600 dark:text-slate-300">
                                                                                            Documento allegato
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}

                                                                        {/* Body */}
                                                                        <div className="p-4">
                                                                            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                                                                                {getBodyInfo(selectedTemplateData)}
                                                                            </p>
                                                                        </div>

                                                                        {/* Footer */}
                                                                        {(() => {
                                                                            const footer = getFooterInfo(selectedTemplateData);
                                                                            if (footer) {
                                                                                return (
                                                                                    <div className="px-4 pb-3">
                                                                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                                                                            {footer}
                                                                                        </p>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}

                                                                        {/* Buttons */}
                                                                        {(() => {
                                                                            const buttons = getButtonsInfo(selectedTemplateData);
                                                                            if (buttons.length > 0) {
                                                                                return (
                                                                                    <div className="border-t border-slate-200 dark:border-darkmode-500">
                                                                                        {buttons.map((button, idx) => (
                                                                                            <button
                                                                                                key={idx}
                                                                                                className="w-full p-3 text-center text-sm font-medium text-primary hover:bg-slate-50 dark:hover:bg-darkmode-700 transition-colors border-b last:border-b-0 border-slate-200 dark:border-darkmode-500 flex items-center justify-center gap-2"
                                                                                            >
                                                                                                {button.type === 'URL' && (
                                                                                                    <Lucide
                                                                                                        icon="ExternalLink"
                                                                                                        className="w-4 h-4"
                                                                                                    />
                                                                                                )}
                                                                                                {button.type === 'PHONE_NUMBER' && (
                                                                                                    <Lucide icon="Phone" className="w-4 h-4" />
                                                                                                )}
                                                                                                {button.type === 'COPY_CODE' && (
                                                                                                    <Lucide icon="Copy" className="w-4 h-4" />
                                                                                                )}
                                                                                                {button.text}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }}
                                                    </Await>
                                                </Suspense>

                                                {/* Invio test + azioni finali */}
                                                <Suspense fallback={<div className="p-5 border-t bg-slate-50 dark:bg-darkmode-800/50 h-32 animate-pulse" />}>
                                                    <Await resolve={templatesWhatsappPromise}>
                                                        {(templates: (GDOWhatsappTemplateAttributes & { has_preset: boolean })[]) => {
                                                            const selectedTemplateData = templates.find(
                                                                (t) => t.id_gdowhatsapptemplate === selectedTemplate,
                                                            );

                                                            return (
                                                                <div className="p-5 border-t bg-slate-50 dark:bg-darkmode-800/50 space-y-5 w-full">
                                                                    <div className={clsx(selectedTemplateData?.has_preset == false && "opacity-20")}>
                                                                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                                            Invio messaggio di test
                                                                        </label>
                                                                        <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                                                            <FormSelect
                                                                                formSelectSize="sm"
                                                                                value={idUtente}
                                                                                onChange={(e) => setIdUtente(e.target.value)}
                                                                            >
                                                                                <option value="">Seleziona un numero...</option>
                                                                                {/* opzioni utenti guest qui se necessario */}
                                                                            </FormSelect>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline-primary"
                                                                                disabled={!idUtente || isSendingTest || !selectedTemplateData || selectedTemplateData.has_preset == false}
                                                                                onClick={() => handleSendTest(selectedTemplateData)}
                                                                            >
                                                                                <Lucide icon="Send" className="w-4 h-4 mr-2" />
                                                                                {isSendingTest ? 'Invio in corso...' : 'Invia'}
                                                                            </Button>
                                                                        </div>
                                                                        <p className="mt-1 text-[11px] text-slate-500">
                                                                            Il test verrà inviato solo a questo numero e non sarà conteggiato
                                                                            nella campagna principale.
                                                                        </p>
                                                                    </div>

                                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                                        <Button
                                                                            type="button"
                                                                            variant="secondary"
                                                                            className="flex-1"
                                                                            onClick={handleBackToSelection}
                                                                        >
                                                                            <Lucide icon="ChevronLeft" className="w-4 h-4 mr-2" />
                                                                            Torna alla selezione
                                                                        </Button>
                                                                        <Button
                                                                            className="flex-1"
                                                                            variant="primary"
                                                                            disabled={
                                                                                !selectedTemplateData ||
                                                                                selectedTemplateData.stato_meta_gdowhatsapptemplate !== 'APPROVED' ||
                                                                                selectedTemplateData.has_preset == false
                                                                            }
                                                                            onClick={() => setDialogPartenzaCampagna(true)}
                                                                        >
                                                                            <Lucide icon="CircleCheck" className="w-4 h-4 mr-2" />
                                                                            Conferma e avvia campagna
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }}
                                                    </Await>
                                                </Suspense>
                                            </div>
                                        </div>
                                    );
                                }}
                            </Await>
                        </Suspense>
                    </motion.div>
                )}
            </AnimatePresence>
        </Fragment>
    );
};

export default withSessionCheck(InvioCampagnaWhatsapp);
