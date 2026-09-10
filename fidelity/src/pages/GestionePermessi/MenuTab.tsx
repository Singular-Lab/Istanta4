import Button from '@/components/Base/Button';
import { FormInput, FormSelect } from '@/components/Base/Form';
import FormSwitch from '@/components/Base/Form/FormSwitch';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import { useNotification } from '@/context/NotificationContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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

interface PermessoCatalogo {
  id_permesso: string;
  codice: string;
  nome: string;
  categoria: string;
}

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
  permessiOptions: PermessoCatalogo[];
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
  permessiOptions,
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
    <div className="box box--stacked overflow-hidden">
      {item.tipo === 'separator' ? (
        /* Separator row */
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-darkmode-700">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMove(index, -1)}
              disabled={index === 0}
              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
            >
              <Lucide icon="ChevronUp" className="w-4 h-4" />
            </button>
            <button
              onClick={() => onMove(index, 1)}
              disabled={isLast}
              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
            >
              <Lucide icon="ChevronDown" className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Lucide icon="Minus" className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Separatore</span>
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
            onClick={() => onRemove(index)}
            className="p-1.5 text-slate-400 hover:text-danger transition-colors"
          >
            <Lucide icon="Trash2" className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Menu item */
        <div>
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Move buttons */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => onMove(index, -1)}
                disabled={index === 0}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
              >
                <Lucide icon="ChevronUp" className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMove(index, 1)}
                disabled={isLast}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
              >
                <Lucide icon="ChevronDown" className="w-4 h-4" />
              </button>
            </div>

            {/* Icon preview */}
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 flex-shrink-0">
              <Lucide icon={item.icona || 'Circle'} className="w-4.5 h-4.5 text-primary" />
            </div>

            {/* Fields */}
            <div className="flex-1 grid grid-cols-12 gap-2 items-center">
              {/* Title */}
              <div className="col-span-3">
                <FormInput
                  type="text"
                  value={item.titolo}
                  onChange={(e) => onUpdate(index, { titolo: e.target.value })}
                  placeholder="Titolo"
                  className="!py-1.5 !text-sm"
                />
              </div>

              {/* Icon — text input: the preview square updates live as you type */}
              <div className="col-span-2">
                <FormInput
                  type="text"
                  value={item.icona || ''}
                  onChange={(e) => onUpdate(index, { icona: e.target.value || null })}
                  placeholder="es. Home"
                  className="!py-1.5 !text-sm"
                />
              </div>

              {/* Pathname */}
              <div className="col-span-2">
                <FormInput
                  type="text"
                  value={item.pathname || ''}
                  onChange={(e) => onUpdate(index, { pathname: e.target.value || null })}
                  placeholder="/pathname"
                  className="!py-1.5 !text-sm font-mono"
                />
              </div>

              {/* Codice permesso */}
              <div className="col-span-2">
                <FormSelect
                  value={item.codice_permesso || ''}
                  onChange={(e) => onUpdate(index, { codice_permesso: e.target.value || null })}
                  className="!py-1.5 !text-sm"
                >
                  <option value="">-- Permesso --</option>
                  {permessiOptions.map(p => (
                    <option key={p.codice} value={p.codice}>{p.codice}</option>
                  ))}
                </FormSelect>
              </div>

              {/* Toggles */}
              <div className="col-span-3 flex items-center gap-3">
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
                onClick={() => onAddSubItem(index)}
                className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                title="Aggiungi sotto-voce"
              >
                <Lucide icon="ListPlus" className="w-4 h-4" />
              </button>
              {item.subMenu && item.subMenu.length > 0 && (
                <button
                  onClick={() => onToggleExpand(index)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                  title={isExpanded ? 'Chiudi sotto-menu' : 'Apri sotto-menu'}
                >
                  <Lucide
                    icon={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                    className="w-4 h-4"
                  />
                  <span className="sr-only">{item.subMenu.length}</span>
                </button>
              )}
              <button
                onClick={() => onRemove(index)}
                className="p-1.5 text-slate-400 hover:text-danger transition-colors"
              >
                <Lucide icon="Trash2" className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SubMenu count badge */}
          {item.subMenu && item.subMenu.length > 0 && !isExpanded && (
            <div
              className="px-4 pb-2 cursor-pointer"
              onClick={() => onToggleExpand(index)}
            >
              <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                <Lucide icon="CornerDownRight" className="w-3 h-3" />
                {item.subMenu.length} sotto-voc{item.subMenu.length === 1 ? 'e' : 'i'}
              </span>
            </div>
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
                      onClick={() => onMoveSubItem(index, subIdx, -1)}
                      disabled={subIdx === 0}
                      className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
                    >
                      <Lucide icon="ChevronUp" className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onMoveSubItem(index, subIdx, 1)}
                      disabled={subIdx === (item.subMenu?.length ?? 0) - 1}
                      className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
                    >
                      <Lucide icon="ChevronDown" className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Lucide icon="CornerDownRight" className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />

                  {/* Sub icon preview */}
                  <div className="flex items-center justify-center w-7 h-7 rounded bg-primary/5 flex-shrink-0">
                    <Lucide icon={sub.icona || 'Circle'} className="w-3.5 h-3.5 text-primary/70" />
                  </div>

                  {/* Sub fields */}
                  <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <FormInput
                        type="text"
                        value={sub.titolo}
                        onChange={(e) => onUpdateSubItem(index, subIdx, { titolo: e.target.value })}
                        placeholder="Titolo"
                        className="!py-1 !text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <FormInput
                        type="text"
                        value={sub.icona || ''}
                        onChange={(e) => onUpdateSubItem(index, subIdx, { icona: e.target.value || null })}
                        placeholder="es. Home"
                        className="!py-1 !text-xs"
                      />
                    </div>
                    <div className="col-span-3">
                      <FormInput
                        type="text"
                        value={sub.pathname || ''}
                        onChange={(e) => onUpdateSubItem(index, subIdx, { pathname: e.target.value || null })}
                        placeholder="/pathname"
                        className="!py-1 !text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <FormSelect
                        value={sub.codice_permesso || ''}
                        onChange={(e) => onUpdateSubItem(index, subIdx, { codice_permesso: e.target.value || null })}
                        className="!py-1 !text-xs"
                      >
                        <option value="">-- Permesso --</option>
                        {permessiOptions.map(p => (
                          <option key={p.codice} value={p.codice}>{p.codice}</option>
                        ))}
                      </FormSelect>
                    </div>
                    <div className="col-span-2 flex items-center">
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
                    onClick={() => onRemoveSubItem(index, subIdx)}
                    className="p-1 text-slate-400 hover:text-danger transition-colors"
                  >
                    <Lucide icon="Trash2" className="w-3.5 h-3.5" />
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
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
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

  const { data: menuData, isLoading } = useQuery<MenuItemDTO[]>({
    queryKey: menuQueryKey,
    queryFn: () => ServerCall.get<MenuItemDTO[]>(`/menu/${selectedTipo}${ruoloGdoParam}`),
  });

  // Fetch permessi catalog for codice_permesso dropdown
  const { data: permessiCatalogo } = useQuery<PermessoCatalogo[]>({
    queryKey: ['permessi-catalogo'],
    queryFn: () => ServerCall.get<PermessoCatalogo[]>('/permessi'),
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

  // Permission options (only PAGINA category, memoized)
  const permessiOptions = useMemo(() => {
    if (!permessiCatalogo) return [];
    return permessiCatalogo
      .filter(p => p.categoria === 'PAGINA')
      .sort((a, b) => a.codice.localeCompare(b.codice));
  }, [permessiCatalogo]);

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

  // Seed mutation
  const seedMutation = useMutation({
    mutationFn: () => ServerCall.post('/menu/seed', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showNotification('Menu importato da JSON con successo', { variant: 'success' });
    },
    onError: () => {
      showNotification("Errore durante l'importazione del menu", { variant: 'error' });
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
      ? `${TIPO_LABELS[selectedTipo]} / ${selectedRuoloGdo.replace('GDO_', '').replace(/_/g, ' ')}`
      : TIPO_LABELS[selectedTipo];
    setClipboard({ items: JSON.parse(JSON.stringify(items)), label });
    showNotification(`Menu copiato: ${label}`, { variant: 'success' });
  }, [items, selectedTipo, selectedRuoloGdo, showNotification]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    setItems(stripIds(clipboard.items));
    setIsDirty(true);
    setExpandedSubMenus({});
    setShowPasteDialog(false);
  }, [clipboard]);

  return (
    <div className="flex flex-col gap-5">
      {/* Selettore tipo utente + GDO role */}
      <div className="flex flex-col box box--stacked">
        <div className="flex flex-col p-5 xl:items-center xl:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Tipo Utente</label>
            <div className="flex flex-wrap gap-2">
              {TIPI_UTENTE_MENU.map(tipo => (
                <button
                  key={tipo}
                  onClick={() => {
                    setSelectedTipo(tipo);
                    setSelectedRuoloGdo('');
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${selectedTipo === tipo
                    ? 'bg-primary text-white shadow-md shadow-primary/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-darkmode-600 dark:text-slate-300'
                    }`}
                >
                  <Lucide icon={TIPO_ICONS[tipo]} className="w-4 h-4" />
                  {TIPO_LABELS[tipo]}
                </button>
              ))}
            </div>
          </div>

          {/* Sotto-ruolo */}
          {!!selectedTipo && selectedTipo !== TIPO_UTENTI.SUPERADMIN && ruoliGdo && ruoliGdo.length > 0 && (
            <div className="xl:w-56">
              <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                Ruolo
              </label>
              <FormSelect
                value={selectedRuoloGdo}
                onChange={(e) => setSelectedRuoloGdo(e.target.value)}
              >
                <option value="">-- Base (tutti) --</option>
                {ruoliGdo.map(r => (
                  <option key={r.id} value={`GDO_${r.ruolo}`}>
                    {r.ruolo.replace(/_/g, ' ')}
                  </option>
                ))}
              </FormSelect>
            </div>
          )}
        </div>

        {/* Info: sotto-ruolo selezionato */}
        {selectedRuoloGdo && (
          <div className="border-t border-slate-200/60 dark:border-darkmode-400 bg-blue-50/50 dark:bg-blue-900/10 px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Lucide icon="Info" className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Stai modificando il menu specifico per il sotto-ruolo selezionato.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Menu items editor */}
      {isLoading ? (
        <div className="box box--stacked p-16 flex flex-col items-center justify-center gap-3">
          <Lucide icon="Loader2" className="w-8 h-8 text-primary animate-spin" />
          <span className="text-sm text-slate-500">Caricamento menu...</span>
        </div>
      ) : (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={addItem}>
                <Lucide icon="Plus" className="w-4 h-4 mr-1.5" />
                Aggiungi Voce
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={addSeparator}>
                <Lucide icon="Minus" className="w-4 h-4 mr-1.5" />
                Aggiungi Separatore
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleCopy}
                disabled={items.length === 0}
                title="Copia questo menu negli appunti"
              >
                <Lucide icon="Copy" className="w-4 h-4 mr-1.5" />
                Copia menu
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {clipboard && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setShowPasteDialog(true)}
                  title={`Incolla menu copiato da: ${clipboard.label}`}
                  className="border-violet-300 text-violet-600 hover:bg-violet-50 dark:border-violet-600 dark:text-violet-400"
                >
                  <Lucide icon="ClipboardPaste" className="w-4 h-4 mr-1.5" />
                  Incolla da: {clipboard.label}
                  <span className="ml-1.5 text-[10px] bg-violet-100 dark:bg-violet-800/40 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-medium">
                    {clipboard.items.length}
                  </span>
                </Button>
              )}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowSeedDialog(true)}
                disabled={seedMutation.isPending}
              >
                <Lucide icon="Download" className="w-4 h-4 mr-1.5" />
                {seedMutation.isPending ? 'Importando...' : 'Importa da JSON'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!isDirty || saveMutation.isPending}
              >
                <Lucide icon="Save" className="w-4 h-4 mr-1.5" />
                {saveMutation.isPending ? 'Salvataggio...' : 'Salva Menu'}
              </Button>
            </div>
          </div>

          {/* Items list */}
          {items.length === 0 ? (
            <div className="box box--stacked p-12 flex flex-col items-center justify-center gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 dark:bg-darkmode-600">
                <Lucide icon="LayoutList" className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-medium text-slate-700 dark:text-slate-200">Nessuna voce di menu</h3>
                <p className="text-sm text-slate-500 mt-1">Aggiungi voci di menu o importa la configurazione da JSON.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 box box--stacked p-4">
              {items.map((item, index) => (
                <MenuItemRow
                  key={item.id_menu_item || index}
                  item={item}
                  index={index}
                  isLast={index === items.length - 1}
                  isExpanded={expandedSubMenus[index] ?? false}
                  selectedTipo={selectedTipo}
                  permessiOptions={permessiOptions}
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
        </>
      )}

      {/* Sticky save bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-darkmode-600 border-t border-slate-200 dark:border-darkmode-400 shadow-lg px-6 py-3.5 flex items-center justify-between z-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800/30">
              <Lucide icon="Pencil" className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Menu modificato - salvare le modifiche?
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
              <Lucide icon="X" className="w-3.5 h-3.5 mr-1.5" />
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              size="sm"
            >
              <Lucide icon="Save" className="w-3.5 h-3.5 mr-1.5" />
              {saveMutation.isPending ? 'Salvataggio...' : 'Salva menu'}
            </Button>
          </div>
        </div>
      )}

      {/* Dialog conferma Seed */}
      <Dialog
        open={showSeedDialog}
        onClose={() => setShowSeedDialog(false)}
        staticBackdrop
      >
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">Importa Menu da JSON</h2>
          </Dialog.Title>
          <Dialog.Description className="space-y-4">
            <div className="p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/30 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium mb-2">
                <Lucide icon="AlertTriangle" className="w-5 h-5" />
                Attenzione
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Questa operazione importera la configurazione dal file <code className="bg-amber-100 px-1 rounded">menu.json</code> nel database.
              </p>
            </div>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>Tutti i menu esistenti nel database verranno sovrascritti</li>
              <li>I menu verranno caricati per tutti i tipi utente</li>
              <li>I codici permesso verranno mappati automaticamente</li>
            </ul>
          </Dialog.Description>
          <Dialog.Footer className="flex justify-end gap-2">
            <Button
              variant="outline-secondary"
              onClick={() => setShowSeedDialog(false)}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowSeedDialog(false);
                seedMutation.mutate();
              }}
            >
              <Lucide icon="Download" className="w-4 h-4 mr-1.5" />
              Importa Menu
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* Dialog conferma Incolla */}
      <Dialog
        open={showPasteDialog}
        onClose={() => setShowPasteDialog(false)}
        staticBackdrop
      >
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">Incolla menu</h2>
          </Dialog.Title>
          <Dialog.Description className="space-y-4">
            <div className="p-4 border border-violet-200 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-800/30 rounded-lg">
              <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-medium mb-2">
                <Lucide icon="ClipboardPaste" className="w-5 h-5" />
                Conferma incolla
              </div>
              <p className="text-sm text-violet-800 dark:text-violet-200">
                Stai per sostituire il menu corrente con le <strong>{clipboard?.items.length ?? 0} voci</strong> copiate da{' '}
                <strong>{clipboard?.label}</strong>.
              </p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Il menu attuale verrà sovritto. Le modifiche saranno visibili al salvataggio.
            </p>
          </Dialog.Description>
          <Dialog.Footer className="flex justify-end gap-2">
            <Button
              variant="outline-secondary"
              onClick={() => setShowPasteDialog(false)}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={handlePaste}
            >
              <Lucide icon="ClipboardPaste" className="w-4 h-4 mr-1.5" />
              Incolla menu
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
    </div>
  );
}
