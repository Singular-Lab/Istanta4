import Alert from '@/components/Base/Alert';
import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import { FormInput, FormSelect } from '@/components/Base/Form';
import FormSwitch from '@/components/Base/Form/FormSwitch';
import Lucide from '@/components/Base/Lucide';
import PageError from '@/components/Base/PageError';
import Segmenti, { type OpzioneSegmento } from '@/components/Base/Segmenti';
import Sezione from '@/components/Base/Sezione';
import Spinner from '@/components/Base/Spinner';
import StatusBadge from '@/components/Base/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { useNotification } from '@/context/NotificationContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { voceDi } from '../../../lib/accessi/catalogo';
import { paginaPer } from '../../../lib/accessi/pagine';
import { TIPO_UTENTI } from '../../../lib/enums';
import { ServerCall } from '../../../lib/server_call';

interface MenuItemDTO {
  id_menu_item?: string;
  tipo_utente: string;
  ruolo_gdo?: string | null;
  titolo: string;
  tipo: 'separator' | 'item';
  icona?: string | null;
  pathname?: string | null;
  codice_permesso?: string | null;
  disabilitato?: boolean;
  start_page?: boolean;
  ordinamento: number;
  id_parent?: string | null;
  subMenu?: MenuItemDTO[];
}

interface RuoloGdoOption {
  id: string;
  ruolo: string;
}

/** Permesso che la pagina richiede, dal catalogo condiviso: si legge, non si sceglie. */
const PermessoDellaPagina = ({ pathname, piccolo }: { pathname?: string | null; piccolo?: boolean }) => {
  const pagina = pathname ? paginaPer(pathname) : undefined;
  const testo = !pathname
    ? '—'
    : !pagina
      ? 'Pagina non censita'
      : pagina.permesso === null
        ? 'Tutti gli autenticati'
        : voceDi(pagina.permesso)?.nome ?? pagina.permesso;
  // Il codice del permesso resta leggibile al passaggio del mouse sul contenitore
  return (
    <span title={pagina?.permesso ?? undefined} className={`inline-flex max-w-full ${piccolo ? '' : 'py-0.5'}`}>
      <StatusBadge
        tono={pathname && !pagina ? 'warning' : 'neutral'}
        icon={pagina?.permesso ? 'Lock' : 'LockOpen'}
        etichetta={testo}
      />
    </span>
  );
};

const TIPI_UTENTE_MENU = [
  TIPO_UTENTI.SUPERADMIN,
  TIPO_UTENTI.AGENZIA,
  TIPO_UTENTI.CATEGORY,
  TIPO_UTENTI.GDO,
  TIPO_UTENTI.MARKETING,
  TIPO_UTENTI.PUNTOVENDITA,
  TIPO_UTENTI.IT,
  TIPO_UTENTI.GUEST
];

const TIPO_LABELS: Record<string, string> = {
  [TIPO_UTENTI.SUPERADMIN]: 'Superadmin',
  [TIPO_UTENTI.AGENZIA]: 'Agenzia',
  [TIPO_UTENTI.CATEGORY]: 'Category',
  [TIPO_UTENTI.GDO]: 'GDO',
  [TIPO_UTENTI.MARKETING]: 'Marketing',
  [TIPO_UTENTI.PUNTOVENDITA]: 'Punto Vendita',
  [TIPO_UTENTI.IT]: "Reparto IT",
  [TIPO_UTENTI.GUEST]: 'Guest',
};

const TIPO_ICONS: Record<string, string> = {
  [TIPO_UTENTI.SUPERADMIN]: 'ShieldCheck',
  [TIPO_UTENTI.AGENZIA]: 'Briefcase',
  [TIPO_UTENTI.CATEGORY]: 'Layers',
  [TIPO_UTENTI.GDO]: 'Building2',
  [TIPO_UTENTI.MARKETING]: 'TrendingUp',
  [TIPO_UTENTI.PUNTOVENDITA]: 'Store',
  [TIPO_UTENTI.IT]: "Computer",
  [TIPO_UTENTI.GUEST]: 'User',
};

function createEmptyItem(ordinamento: number): MenuItemDTO {
  return {
    tipo_utente: '',
    titolo: '',
    tipo: 'item',
    icona: null,
    pathname: null,
    codice_permesso: null,
    disabilitato: false,
    start_page: false,
    ordinamento,
  };
}

function createEmptySeparator(ordinamento: number): MenuItemDTO {
  return {
    tipo_utente: '',
    titolo: '',
    tipo: 'separator',
    ordinamento,
  };
}

/** Rimuove id_menu_item e id_parent ricorsivamente, così gli item incollati
 *  vengono trattati come nuovi record dal backend (INSERT, non UPDATE). */
function stripIds(items: MenuItemDTO[]): MenuItemDTO[] {
  return items.map(({ id_menu_item: _id, id_parent: _p, subMenu, ...rest }) => ({
    ...rest,
    subMenu: subMenu ? stripIds(subMenu) : undefined,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Memoized row component — prevents sibling re-renders when one item changes
// ────────────────────────────────────────────────────────────────────────────

interface MenuItemRowProps {
  item: MenuItemDTO;
  index: number;
  isLast: boolean;
  isExpanded: boolean;
  selectedTipo: string;
  onUpdate: (index: number, updates: Partial<MenuItemDTO>) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onAddSubItem: (index: number) => void;
  onToggleExpand: (index: number) => void;
  onUpdateSubItem: (parentIndex: number, subIndex: number, updates: Partial<MenuItemDTO>) => void;
  onMoveSubItem: (parentIndex: number, subIndex: number, dir: -1 | 1) => void;
  onRemoveSubItem: (parentIndex: number, subIndex: number) => void;
}

const MenuItemRow = memo(function MenuItemRow({
  item,
  index,
  isLast,
  isExpanded,
  selectedTipo,
  onUpdate,
  onMove,
  onRemove,
  onAddSubItem,
  onToggleExpand,
  onUpdateSubItem,
  onMoveSubItem,
  onRemoveSubItem,
}: MenuItemRowProps) {
  return (
    <div className="overflow-hidden rounded-card border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600">
      {item.tipo === 'separator' ? (
        /* Separator row */
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-darkmode-700">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Sposta su"
              onClick={() => onMove(index, -1)}
              disabled={index === 0}
              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
            >
              <Lucide aria-hidden="true" icon="ChevronUp" className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Sposta giù"
              onClick={() => onMove(index, 1)}
              disabled={isLast}
              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
            >
              <Lucide aria-hidden="true" icon="ChevronDown" className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Lucide icon="Minus" className="w-4 h-4 text-slate-400" />
            <span className="title-eyebrow">Separatore</span>
            <span className="text-xs text-slate-400">-</span>
            <FormInput
              type="text"
              value={item.titolo}
              onChange={(e) => onUpdate(index, { titolo: e.target.value })}
              placeholder="Titolo sezione (es. Promozioni)"
              className="flex-1 !py-1 !text-xs"
            />
          </div>
          <button
            type="button"
            aria-label="Elimina separatore"
            onClick={() => onRemove(index)}
            className="p-1.5 text-slate-400 hover:text-danger transition-colors"
          >
            <Lucide aria-hidden="true" icon="Trash2" className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Menu item */
        <div>
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Move buttons */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                type="button"
                aria-label="Sposta su"
                onClick={() => onMove(index, -1)}
                disabled={index === 0}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
              >
                <Lucide aria-hidden="true" icon="ChevronUp" className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Sposta giù"
                onClick={() => onMove(index, 1)}
                disabled={isLast}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
              >
                <Lucide aria-hidden="true" icon="ChevronDown" className="w-4 h-4" />
              </button>
            </div>

            {/* Icon preview */}
            <div className="flex items-center justify-center w-9 h-9 rounded-control bg-primary/10 flex-shrink-0">
              <Lucide icon={item.icona || 'Circle'} aria-hidden="true" className="h-4 w-4 text-primary" />
            </div>

            {/* Fields */}
            <div className="flex-1 grid grid-cols-12 gap-2 items-center">
              {/* Sotto xl i campi stanno su due righe: titolo, icona e percorso; poi permesso e interruttori */}
              {/* Title */}
              <div className="col-span-6 xl:col-span-3">
                <FormInput
                  type="text"
                  value={item.titolo}
                  onChange={(e) => onUpdate(index, { titolo: e.target.value })}
                  placeholder="Titolo"
                  className="!py-1.5 !text-sm"
                />
              </div>

              {/* Icon — text input: the preview square updates live as you type */}
              <div className="col-span-3 xl:col-span-2">
                <FormInput
                  type="text"
                  value={item.icona || ''}
                  onChange={(e) => onUpdate(index, { icona: e.target.value || null })}
                  placeholder="es. Home"
                  className="!py-1.5 !text-sm"
                />
              </div>

              {/* Pathname */}
              <div className="col-span-3 xl:col-span-2">
                <FormInput
                  type="text"
                  value={item.pathname || ''}
                  onChange={(e) => onUpdate(index, { pathname: e.target.value || null })}
                  placeholder="/pathname"
                  className="!py-1.5 !text-sm font-mono"
                />
              </div>

              {/* Codice permesso */}
              <div className="col-span-7 min-w-0 xl:col-span-2">
                <PermessoDellaPagina pathname={item.pathname} />
              </div>

              {/* Toggles */}
              <div className="col-span-5 flex items-center justify-end gap-3 xl:col-span-3 xl:justify-start">
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FormSwitch className="!m-0">
                    <FormSwitch.Input
                      type="checkbox"
                      checked={item.disabilitato || false}
                      onChange={(e) => onUpdate(index, { disabilitato: e.target.checked })}
                    />
                  </FormSwitch>
                  Disab.
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FormSwitch className="!m-0">
                    <FormSwitch.Input
                      type="checkbox"
                      checked={item.start_page || false}
                      onChange={(e) => onUpdate(index, { start_page: e.target.checked })}
                    />
                  </FormSwitch>
                  Start
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Aggiungi sotto-voce"
                onClick={() => onAddSubItem(index)}
                className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                title="Aggiungi sotto-voce"
              >
                <Lucide aria-hidden="true" icon="ListPlus" className="w-4 h-4" />
              </button>
              {item.subMenu && item.subMenu.length > 0 && (
                <button
                  type="button"
                  aria-label={isExpanded ? "Chiudi sotto-menu" : "Apri sotto-menu"}
                  onClick={() => onToggleExpand(index)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                  title={isExpanded ? 'Chiudi sotto-menu' : 'Apri sotto-menu'}
                >
                  <Lucide
                    icon={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                    aria-hidden="true"
                    className="w-4 h-4"
                  />
                </button>
              )}
              <button
                type="button"
                aria-label="Elimina voce"
                onClick={() => onRemove(index)}
                className="p-1.5 text-slate-400 hover:text-danger transition-colors"
              >
                <Lucide aria-hidden="true" icon="Trash2" className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SubMenu count badge */}
          {item.subMenu && item.subMenu.length > 0 && !isExpanded && (
            <button
              type="button"
              className="block px-4 pb-2 text-left cursor-pointer"
              onClick={() => onToggleExpand(index)}
            >
              <StatusBadge
                tono="brand"
                icon="CornerDownRight"
                etichetta={`${item.subMenu.length} sotto-voc${item.subMenu.length === 1 ? 'e' : 'i'}`}
              />
            </button>
          )}

          {/* SubMenu items */}
          {item.subMenu && item.subMenu.length > 0 && isExpanded && (
            <div className="border-t border-slate-100 dark:border-darkmode-400 bg-slate-50/50 dark:bg-darkmode-700/30">
              {item.subMenu.map((sub, subIdx) => (
                <div
                  key={`sub-${subIdx}`}
                  className="flex items-center gap-3 px-4 py-2.5 pl-14 border-b border-slate-100/80 dark:border-darkmode-400/50 last:border-b-0"
                >
                  {/* Move sub-item */}
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      aria-label="Sposta sotto-voce su"
                      onClick={() => onMoveSubItem(index, subIdx, -1)}
                      disabled={subIdx === 0}
                      className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
                    >
                      <Lucide aria-hidden="true" icon="ChevronUp" className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Sposta sotto-voce giù"
                      onClick={() => onMoveSubItem(index, subIdx, 1)}
                      disabled={subIdx === (item.subMenu?.length ?? 0) - 1}
                      className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
                    >
                      <Lucide aria-hidden="true" icon="ChevronDown" className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Lucide icon="CornerDownRight" className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />

                  {/* Sub icon preview */}
                  <div className="flex items-center justify-center w-7 h-7 rounded-control bg-primary/5 flex-shrink-0">
                    <Lucide icon={sub.icona || 'Circle'} className="w-3.5 h-3.5 text-primary/70" />
                  </div>

                  {/* Sub fields */}
                  <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6 xl:col-span-3">
                      <FormInput
                        type="text"
                        value={sub.titolo}
                        onChange={(e) => onUpdateSubItem(index, subIdx, { titolo: e.target.value })}
                        placeholder="Titolo"
                        className="!py-1 !text-xs"
                      />
                    </div>
                    <div className="col-span-3 xl:col-span-2">
                      <FormInput
                        type="text"
                        value={sub.icona || ''}
                        onChange={(e) => onUpdateSubItem(index, subIdx, { icona: e.target.value || null })}
                        placeholder="es. Home"
                        className="!py-1 !text-xs"
                      />
                    </div>
                    <div className="col-span-3 xl:col-span-3">
                      <FormInput
                        type="text"
                        value={sub.pathname || ''}
                        onChange={(e) => onUpdateSubItem(index, subIdx, { pathname: e.target.value || null })}
                        placeholder="/pathname"
                        className="!py-1 !text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-8 min-w-0 xl:col-span-2">
                      <PermessoDellaPagina pathname={sub.pathname} piccolo />
                    </div>
                    <div className="col-span-4 flex items-center justify-end xl:col-span-2 xl:justify-start">
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <FormSwitch className="!m-0">
                          <FormSwitch.Input
                            type="checkbox"
                            checked={sub.disabilitato || false}
                            onChange={(e) => onUpdateSubItem(index, subIdx, { disabilitato: e.target.checked })}
                          />
                        </FormSwitch>
                        Disab.
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Elimina sotto-voce"
                    onClick={() => onRemoveSubItem(index, subIdx)}
                    className="p-1 text-slate-400 hover:text-danger transition-colors"
                  >
                    <Lucide aria-hidden="true" icon="Trash2" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ────────────────────────────────────────────────────────────────────────────

export default function MenuTab() {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [selectedTipo, setSelectedTipo] = useState<string>(TIPO_UTENTI.SUPERADMIN);
  const [selectedRuoloGdo, setSelectedRuoloGdo] = useState<string>('');
  const [items, setItems] = useState<MenuItemDTO[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [expandedSubMenus, setExpandedSubMenus] = useState<Record<number, boolean>>({});
  const [clipboard, setClipboard] = useState<{ items: MenuItemDTO[]; label: string } | null>(null);

  // Fetch ruoli disponibili per tutti i tipi non-SUPERADMIN
  const { data: ruoliGdo } = useQuery<RuoloGdoOption[]>({
    queryKey: ['ruoli-gdo-permessi'],
    queryFn: () => ServerCall.get<RuoloGdoOption[]>('/get_all_ruoli_gdo'),
    enabled: !!selectedTipo && selectedTipo !== TIPO_UTENTI.SUPERADMIN,
  });

  // Fetch menu items per tipo utente
  const ruoloGdoParam = selectedRuoloGdo ? `?ruoloGdo=${selectedRuoloGdo}` : '';
  const menuQueryKey = ['menu-items', selectedTipo, selectedRuoloGdo || 'base'];

  const { data: menuData, isLoading, isError, error: erroreMenu, refetch: refetchMenu } = useQuery<MenuItemDTO[]>({
    queryKey: menuQueryKey,
    queryFn: () => ServerCall.get<MenuItemDTO[]>(`/menu/${selectedTipo}${ruoloGdoParam}`),
  });

  // Sync fetched data to local state
  useEffect(() => {
    if (menuData) {
      setItems(menuData);
      setIsDirty(false);
      setExpandedSubMenus({});
    }
  }, [menuData]);

  // Reset when changing type/role
  useEffect(() => {
    setIsDirty(false);
    setExpandedSubMenus({});
  }, [selectedTipo, selectedRuoloGdo]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const reordered = items.map((item, i) => ({
        ...item,
        ordinamento: i,
        subMenu: item.subMenu?.map((sub, j) => ({ ...sub, ordinamento: j })),
      }));
      await ServerCall.put(`/menu/${selectedTipo}${ruoloGdoParam}`, { items: reordered });
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showNotification('Menu aggiornato con successo', { variant: 'success' });
    },
    onError: () => {
      showNotification('Errore durante il salvataggio del menu', { variant: 'error' });
    },
  });

  // Ripristino del menu predefinito del Superadmin (solo le sue voci; gli altri menu restano)
  const seedMutation = useMutation({
    mutationFn: () => ServerCall.post('/menu/ripristina-predefiniti', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showNotification('Menu predefinito del Superadmin ripristinato', { variant: 'success' });
    },
    onError: () => {
      showNotification('Errore durante il ripristino del menu: il menu è rimasto invariato', { variant: 'error' });
    },
  });

  // Item manipulation callbacks — all stable (no deps beyond setItems/setIsDirty)
  const updateItem = useCallback((index: number, updates: Partial<MenuItemDTO>) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
    setIsDirty(true);
  }, []);

  const updateSubItem = useCallback((parentIndex: number, subIndex: number, updates: Partial<MenuItemDTO>) => {
    setItems(prev => {
      const next = [...prev];
      const parent = { ...next[parentIndex] };
      const subs = [...(parent.subMenu || [])];
      subs[subIndex] = { ...subs[subIndex], ...updates };
      parent.subMenu = subs;
      next[parentIndex] = parent;
      return next;
    });
    setIsDirty(true);
  }, []);

  const moveItem = useCallback((index: number, direction: -1 | 1) => {
    setItems(prev => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setIsDirty(true);
  }, []);

  const moveSubItem = useCallback((parentIndex: number, subIndex: number, direction: -1 | 1) => {
    setItems(prev => {
      const next = [...prev];
      const parent = { ...next[parentIndex] };
      const subs = [...(parent.subMenu || [])];
      const targetIndex = subIndex + direction;
      if (targetIndex < 0 || targetIndex >= subs.length) return prev;
      [subs[subIndex], subs[targetIndex]] = [subs[targetIndex], subs[subIndex]];
      parent.subMenu = subs;
      next[parentIndex] = parent;
      return next;
    });
    setIsDirty(true);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, []);

  const removeSubItem = useCallback((parentIndex: number, subIndex: number) => {
    setItems(prev => {
      const next = [...prev];
      const parent = { ...next[parentIndex] };
      parent.subMenu = (parent.subMenu || []).filter((_, i) => i !== subIndex);
      next[parentIndex] = parent;
      return next;
    });
    setIsDirty(true);
  }, []);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, createEmptyItem(prev.length)]);
    setIsDirty(true);
  }, []);

  const addSeparator = useCallback(() => {
    setItems(prev => [...prev, createEmptySeparator(prev.length)]);
    setIsDirty(true);
  }, []);

  const addSubItem = useCallback((parentIndex: number) => {
    setItems(prev => {
      const next = [...prev];
      const parent = { ...next[parentIndex] };
      const subs = [...(parent.subMenu || [])];
      subs.push(createEmptyItem(subs.length));
      parent.subMenu = subs;
      next[parentIndex] = parent;
      return next;
    });
    setExpandedSubMenus(prev => ({ ...prev, [parentIndex]: true }));
    setIsDirty(true);
  }, []);

  const toggleSubMenuExpand = useCallback((index: number) => {
    setExpandedSubMenus(prev => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const handleCopy = useCallback(() => {
    const label = selectedRuoloGdo
      ? `${TIPO_LABELS[selectedTipo]} / ${(ruoliGdo?.find(r => r.id === selectedRuoloGdo)?.ruolo ?? '').replace(/_/g, ' ')}`
      : TIPO_LABELS[selectedTipo];
    setClipboard({ items: JSON.parse(JSON.stringify(items)), label });
    showNotification(`Menu copiato: ${label}`, { variant: 'success' });
  }, [items, selectedTipo, selectedRuoloGdo, ruoliGdo, showNotification]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    setItems(stripIds(clipboard.items));
    setIsDirty(true);
    setExpandedSubMenus({});
    setShowPasteDialog(false);
  }, [clipboard]);

  const opzioniTipo: OpzioneSegmento<string>[] = TIPI_UTENTE_MENU.map(tipo => ({ valore: tipo, etichetta: TIPO_LABELS[tipo] }));

  return (
    <div className="flex flex-col gap-6">
      {/* Selettore tipo utente + GDO role */}
      <Sezione titolo="Menu per tipo di utente" descrizione="Scegli il tipo di utente e, se serve, il sotto-ruolo di cui modificare il menu.">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <div className="title-eyebrow mb-2">Tipo Utente</div>
            <Segmenti
              etichetta="Tipo Utente"
              opzioni={opzioniTipo}
              valore={selectedTipo}
              onChange={(tipo) => {
                setSelectedTipo(tipo);
                setSelectedRuoloGdo('');
              }}
            />
          </div>

          {/* Sotto-ruolo */}
          {!!selectedTipo && selectedTipo !== TIPO_UTENTI.SUPERADMIN && ruoliGdo && ruoliGdo.length > 0 && (
            <div className="xl:w-56">
              <label htmlFor="menu-ruolo-gdo" className="title-eyebrow mb-2 block">
                Ruolo
              </label>
              <FormSelect
                id="menu-ruolo-gdo"
                value={selectedRuoloGdo}
                onChange={(e) => setSelectedRuoloGdo(e.target.value)}
              >
                <option value="">-- Base (tutti) --</option>
                {ruoliGdo.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.ruolo.replace(/_/g, ' ')}
                  </option>
                ))}
              </FormSelect>
            </div>
          )}
        </div>

        {/* Info: sotto-ruolo selezionato */}
        {selectedRuoloGdo && (
          <Alert variant="soft-info" icona="Info" className="mt-4">
            Stai modificando il menu specifico per il sotto-ruolo selezionato.
          </Alert>
        )}
      </Sezione>

      {/* Menu items editor */}
      {isLoading ? (
        <Sezione>
          <div className="flex justify-center py-12">
            <Spinner size="lg" etichetta="Caricamento menu..." />
          </div>
        </Sezione>
      ) : isError ? (
        <Sezione>
          <PageError
            compatta
            titolo="Menu non caricato"
            motivo={(erroreMenu as any)?.message || 'Impossibile caricare il menu'}
            onRiprova={() => refetchMenu()}
          />
        </Sezione>
      ) : (
        <Sezione
          titolo="Voci del menu"
          descrizione="Ordine, titoli, icone e percorsi delle voci"
          azioni={
            <>
              <Button variant="primary" size="sm" onClick={addItem}>
                <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Aggiungi Voce
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={addSeparator}>
                <Lucide icon="Minus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Aggiungi Separatore
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleCopy}
                disabled={items.length === 0}
                title="Copia questo menu negli appunti"
              >
                <Lucide icon="Copy" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Copia menu
              </Button>
              {clipboard && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setShowPasteDialog(true)}
                  title={`Incolla menu copiato da: ${clipboard.label}`}
                >
                  <Lucide icon="ClipboardPaste" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Incolla da: {clipboard.label}
                  <Badge variant="primary" size="sm" className="ml-1.5 tabular-nums">
                    {clipboard.items.length}
                  </Badge>
                </Button>
              )}
              {selectedTipo === TIPO_UTENTI.SUPERADMIN && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setShowSeedDialog(true)}
                  disabled={seedMutation.isPending}
                  loading={seedMutation.isPending}
                >
                  {!seedMutation.isPending && <Lucide icon="RotateCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                  Ripristina menu predefiniti
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!isDirty || saveMutation.isPending}
                loading={saveMutation.isPending}
              >
                {!saveMutation.isPending && <Lucide icon="Save" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                Salva Menu
              </Button>
            </>
          }
        >
          {/* Items list */}
          {items.length === 0 ? (
            <EmptyState
              compatta
              icon="LayoutList"
              title="Nessuna voce di menu"
              description="Aggiungi voci di menu o importa la configurazione da JSON."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item, index) => (
                <MenuItemRow
                  key={item.id_menu_item || index}
                  item={item}
                  index={index}
                  isLast={index === items.length - 1}
                  isExpanded={expandedSubMenus[index] ?? false}
                  selectedTipo={selectedTipo}
                  onUpdate={updateItem}
                  onMove={moveItem}
                  onRemove={removeItem}
                  onAddSubItem={addSubItem}
                  onToggleExpand={toggleSubMenuExpand}
                  onUpdateSubItem={updateSubItem}
                  onMoveSubItem={moveSubItem}
                  onRemoveSubItem={removeSubItem}
                />
              ))}
            </div>
          )}
        </Sezione>
      )}

      {/* Barra delle modifiche in sospeso: come quella dei permessi dei ruoli */}
      {isDirty && (
        <div className="sticky bottom-4 z-20">
          <div className="box box--stacked flex flex-col gap-3 border-warning/40 bg-white/95 p-4 shadow-overlay backdrop-blur-sm dark:bg-darkmode-600/95 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-warning" />
              <span>
                <span className="font-medium">Menu modificato</span>: salvare le modifiche?
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline-secondary"
                onClick={() => {
                  if (menuData) setItems(menuData);
                  setIsDirty(false);
                }}
                size="sm"
              >
                Annulla
              </Button>
              <Button
                variant="primary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                loading={saveMutation.isPending}
                size="sm"
              >
                {!saveMutation.isPending && <Lucide icon="Save" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                Salva menu
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conferma ripristino del menu predefinito */}
      <ConfirmDialog
        open={showSeedDialog}
        title="Ripristina menu predefiniti"
        confirmLabel="Ripristina"
        confirmVariant="primary"
        description={
          <div className="space-y-4">
            <Alert variant="soft-warning" icona="TriangleAlert" titolo="Attenzione">
              Il menu del Superadmin tornerà quello con cui nasce l'installazione.
            </Alert>
            <ul className="list-inside list-disc space-y-1">
              <li>Le voci aggiunte, tolte o spostate nel menu del Superadmin andranno perse</li>
              <li>I menu degli altri tipi di utente non cambiano</li>
              <li>Se il ripristino non riesce, il menu resta quello attuale</li>
            </ul>
          </div>
        }
        onClose={() => setShowSeedDialog(false)}
        onConfirm={() => {
          setShowSeedDialog(false);
          seedMutation.mutate();
        }}
      />

      {/* Conferma Incolla */}
      <ConfirmDialog
        open={showPasteDialog}
        title="Incolla menu"
        subtitle="Sostituisce il menu corrente"
        confirmLabel="Incolla menu"
        confirmVariant="primary"
        description={
          <div className="space-y-4">
            <Alert variant="soft-info" icona="ClipboardPaste" titolo="Conferma incolla">
              Stai per sostituire il menu corrente con le <strong>{clipboard?.items.length ?? 0} voci</strong> copiate da{' '}
              <strong>{clipboard?.label}</strong>.
            </Alert>
            <p>Il menu attuale verrà sovrascritto. Le modifiche saranno visibili al salvataggio.</p>
          </div>
        }
        onClose={() => setShowPasteDialog(false)}
        onConfirm={handlePaste}
      />
    </div>
  );
}
