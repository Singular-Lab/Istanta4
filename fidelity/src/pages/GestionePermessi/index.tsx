import Button from '@/components/Base/Button';
import { FormSelect } from '@/components/Base/Form';
import FormSwitch from '@/components/Base/Form/FormSwitch';
import { Dialog, Tab } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import PageHeader from '@/components/Base/PageHeader';
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from '@/context/NotificationContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { TIPO_UTENTI } from '../../../lib/enums';
import { ServerCall } from '../../../lib/server_call';
import MenuTab from './MenuTab';

type ActiveTab = 'permessi' | 'menu';

interface PermessoConStato {
  id_permesso: string;
  codice: string;
  nome: string;
  descrizione?: string;
  categoria: string;
  risorsa: string;
  abilitato: boolean;
  is_override?: boolean;
}

interface GdoOption {
  id: string;
  nome: string;
}

interface RuoloGdoOption {
  id: string;
  ruolo: string;
}

const RUOLI_GESTIBILI = [
  TIPO_UTENTI.AGENZIA,
  TIPO_UTENTI.CATEGORY,
  TIPO_UTENTI.GDO,
  TIPO_UTENTI.MARKETING,
  TIPO_UTENTI.PUNTOVENDITA,
  TIPO_UTENTI.GUEST,
  TIPO_UTENTI.IT
];

const RUOLO_LABELS: Record<string, string> = {
  [TIPO_UTENTI.AGENZIA]: 'Agenzia',
  [TIPO_UTENTI.CATEGORY]: 'Category',
  [TIPO_UTENTI.GDO]: 'GDO',
  [TIPO_UTENTI.MARKETING]: 'Marketing',
  [TIPO_UTENTI.PUNTOVENDITA]: 'Punto Vendita',
  [TIPO_UTENTI.IT]: "Reparto IT",
  [TIPO_UTENTI.GUEST]: 'Guest',
};

const RUOLO_ICONS: Record<string, string> = {
  [TIPO_UTENTI.AGENZIA]: 'Briefcase',
  [TIPO_UTENTI.CATEGORY]: 'Layers',
  [TIPO_UTENTI.GDO]: 'Building2',
  [TIPO_UTENTI.MARKETING]: 'TrendingUp',
  [TIPO_UTENTI.PUNTOVENDITA]: 'Store',
  [TIPO_UTENTI.IT]: "Computer",
  [TIPO_UTENTI.GUEST]: 'User',
};

const CATEGORIA_LABELS: Record<string, string> = {
  PAGINA: 'Accesso Pagine',
  AZIONE: 'Azioni',
};

const CATEGORIA_ICONS: Record<string, string> = {
  PAGINA: 'Layout',
  AZIONE: 'MousePointerClick',
};

const RISORSA_ICONS: Record<string, string> = {
  // Gruppi pagine
  pagine_generali: 'LayoutDashboard',
  pagine_promozioni: 'Tag',
  pagine_volantini: 'FileText',
  pagine_materiali: 'FileBox',
  pagine_ordini_stampa: 'Printer',
  pagine_webpliant: 'Globe',
  pagine_servizi: 'Plug',
  pagine_impostazioni: 'Settings',
  pagine_utenti: 'Users',
  pagine_whatsapp: 'MessageCircle',
  pagine_api: 'Code',
  // Gruppi azioni
  promozioni: 'Tag',
  kit_runtime: 'Package',
  design_kit: 'Palette',
  raccoglitore_kit: 'FolderOpen',
  file: 'Upload',
  ordini_stampa: 'Printer',
  webpliant: 'Globe',
  referenze: 'Database',
  utenti: 'Users',
  impostazioni: 'Settings',
  whatsapp: 'MessageCircle',
  api: 'Code',
  webhook: 'Webhook',
  gdo: 'Building',
  permessi: 'Shield',
  ai: 'Sparkles',
};

function GestionePermessi() {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<ActiveTab>('permessi');
  const [selectedRuolo, setSelectedRuolo] = useState<TIPO_UTENTI>(TIPO_UTENTI.AGENZIA);
  const [selectedGdo, setSelectedGdo] = useState<string>('');
  const [selectedRuoloGdo, setSelectedRuoloGdo] = useState<string>('');
  const [modifiche, setModifiche] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [showReseedDialog, setShowReseedDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Fetch GDO list
  const { data: gdoList } = useQuery<GdoOption[]>({
    queryKey: ['gdo-list-permessi'],
    queryFn: () => ServerCall.get<GdoOption[]>('/get_all_gdo'),
  });

  // Fetch ruoli disponibili per tutti i tipi non-SUPERADMIN
  const { data: ruoliGdo } = useQuery<RuoloGdoOption[]>({
    queryKey: ['ruoli-gdo-permessi'],
    queryFn: () => ServerCall.get<RuoloGdoOption[]>('/get_all_ruoli_gdo'),
    enabled: !!selectedRuolo,
  });

  // Fetch permessi per ruolo (con eventuale override GDO e sotto-ruolo)
  const ruoloGdoParam = selectedRuoloGdo ? `?ruoloGdo=${selectedRuoloGdo}` : '';
  const queryKey = ['permessi', 'ruolo', selectedRuolo, selectedGdo || 'global', selectedRuoloGdo || 'base'];

  const { data: permessi, isLoading } = useQuery<PermessoConStato[]>({
    queryKey,
    queryFn: () => {
      const base = selectedGdo
        ? `/permessi/ruolo/${selectedRuolo}/gdo/${selectedGdo}`
        : `/permessi/ruolo/${selectedRuolo}`;
      return ServerCall.get<PermessoConStato[]>(`${base}${ruoloGdoParam}`);
    },
  });

  // Salvataggio permessi
  const saveMutation = useMutation({
    mutationFn: async () => {
      const permessiDaSalvare = Object.entries(modifiche).map(([id_permesso, abilitato]) => ({
        id_permesso,
        abilitato,
      }));

      if (permessiDaSalvare.length === 0) return;

      const base = selectedGdo
        ? `/permessi/ruolo/${selectedRuolo}/gdo/${selectedGdo}`
        : `/permessi/ruolo/${selectedRuolo}`;

      await ServerCall.put(`${base}${ruoloGdoParam}`, { permessi: permessiDaSalvare });
    },
    onSuccess: () => {
      setModifiche({});
      queryClient.invalidateQueries({ queryKey: ['permessi'] });
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Permessi aggiornati</div>
            <div className="mt-1 text-slate-500">
              I permessi sono stati salvati con successo.
            </div>
          </div>
        </div>
      );
    },
    onError: () => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleX" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore nel salvataggio</div>
            <div className="mt-1 text-slate-500">
              Si è verificato un errore durante il salvataggio dei permessi.
            </div>
          </div>
        </div>
      );

    },
  });

  // Reset override GDO
  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGdo) return;
      await ServerCall.delete(`/permessi/ruolo/${selectedRuolo}/gdo/${selectedGdo}${ruoloGdoParam}`);
    },
    onSuccess: () => {
      setModifiche({});
      queryClient.invalidateQueries({ queryKey: ['permessi'] });
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Override rimossi</div>
            <div className="mt-1 text-slate-500">
              Gli override GDO sono stati rimossi con successo.
            </div>
          </div>
        </div>
      );
    },
  });

  // Reseed completo del catalogo permessi
  const reseedMutation = useMutation({
    mutationFn: () => ServerCall.post('/permessi/reseed', {}),
    onSuccess: () => {
      setModifiche({});
      queryClient.invalidateQueries({ queryKey: ['permessi'] });
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Catalogo rigenerato</div>
            <div className="mt-1 text-slate-500">
              Il catalogo permessi è stato rigenerato con successo.
            </div>
          </div>
        </div>
      );
    },
    onError: () => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleX" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore nella rigenerazione</div>
            <div className="mt-1 text-slate-500">
              Si è verificato un errore durante la rigenerazione del catalogo.
            </div>
          </div>
        </div>
      );
    },
  });

  const handleToggle = useCallback((id_permesso: string, currentState: boolean) => {
    setModifiche(prev => ({
      ...prev,
      [id_permesso]: !currentState,
    }));
  }, []);

  const getEffectiveState = useCallback((p: PermessoConStato) => {
    if (p.id_permesso in modifiche) return modifiche[p.id_permesso];
    return p.abilitato;
  }, [modifiche]);

  // Raggruppa per risorsa e poi per categoria
  const grouped = useMemo(() => {
    if (!permessi) return {};
    const groups: Record<string, Record<string, PermessoConStato[]>> = {};
    for (const p of permessi) {
      if (!groups[p.risorsa]) groups[p.risorsa] = {};
      if (!groups[p.risorsa][p.categoria]) groups[p.risorsa][p.categoria] = [];
      groups[p.risorsa][p.categoria].push(p);
    }
    return groups;
  }, [permessi]);

  // Statistiche
  const stats = useMemo(() => {
    if (!permessi) return { totali: 0, abilitati: 0, disabilitati: 0, overrides: 0 };
    let abilitati = 0;
    let overrides = 0;
    for (const p of permessi) {
      const eff = getEffectiveState(p);
      if (eff) abilitati++;
      if (p.is_override) overrides++;
    }
    return { totali: permessi.length, abilitati, disabilitati: permessi.length - abilitati, overrides };
  }, [permessi, getEffectiveState]);

  const hasModifiche = Object.keys(modifiche).length > 0;
  const hasOverrides = permessi?.some(p => p.is_override) ?? false;

  const handleSave = async () => {
    if (saving || saveMutation.isPending) return;
    setSaving(true);
    try {
      await saveMutation.mutateAsync();
    } finally {
      setSaving(false);
    }
  };

  // Toggle tutti in una categoria
  const handleToggleAll = useCallback((items: PermessoConStato[], enable: boolean) => {
    setModifiche(prev => {
      const next = { ...prev };
      for (const p of items) {
        const current = p.id_permesso in next ? next[p.id_permesso] : p.abilitato;
        if (current !== enable) {
          next[p.id_permesso] = enable;
        }
      }
      return next;
    });
  }, []);

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        <PageHeader
          title="Gestione Permessi e Menu"
          description="Configura i permessi per ogni ruolo utente e gestisci la struttura del menu laterale."
          actions={
            activeTab === 'permessi' ? (
              <div className="flex gap-2">
                <PermissionGate permission={PERMISSIONS.PERMESSI.GESTISCI} mode="disable">
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowReseedDialog(true)}
                    disabled={reseedMutation.isPending}
                  >
                    <Lucide icon="RefreshCw" className="w-4 h-4 mr-1.5" />
                    {reseedMutation.isPending ? 'Rigenerando...' : 'Rigenera Catalogo'}
                  </Button>
                </PermissionGate>
                {selectedGdo && hasOverrides && (
                  <PermissionGate permission={PERMISSIONS.PERMESSI.GESTISCI} mode="disable">
                    <Button
                      variant="outline-warning"
                      onClick={() => setShowResetDialog(true)}
                      disabled={resetMutation.isPending}
                    >
                      <Lucide icon="RotateCcw" className="w-4 h-4 mr-1.5" />
                      Reset Override
                    </Button>
                  </PermissionGate>
                )}
                <PermissionGate permission={PERMISSIONS.PERMESSI.GESTISCI} mode="disable">
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!hasModifiche || saving}
                  >
                    <Lucide icon="Save" className="w-4 h-4 mr-1.5" />
                    {saving ? 'Salvataggio...' : 'Salva Modifiche'}
                  </Button>
                </PermissionGate>
              </div>
            ) : undefined
          }
        />

        <Tab.Group
          className="mt-5"
          onChange={(index) => setActiveTab(index === 0 ? 'permessi' : 'menu')}
        >
          <div className="flex flex-col p-2 box box--stacked mb-5">
            <Tab.List
              variant="boxed-tabs"
              className="bg-transparent border-transparent"
            >
              <Tab className="first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-primary [&[aria-selected='true']_button]:font-medium">
                <Tab.Button className="w-full text-slate-500 whitespace-nowrap rounded-[0.6rem] py-3 flex items-center gap-2 justify-center" as="button">
                  <Lucide icon="Shield" className="w-4 h-4 stroke-[1.4]" />
                  Permessi
                </Tab.Button>
              </Tab>
              <Tab className="first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-primary [&[aria-selected='true']_button]:font-medium">
                <Tab.Button className="w-full text-slate-500 whitespace-nowrap rounded-[0.6rem] py-3 flex items-center gap-2 justify-center" as="button">
                  <Lucide icon="LayoutList" className="w-4 h-4 stroke-[1.4]" />
                  Menu
                </Tab.Button>
              </Tab>
            </Tab.List>
          </div>

          <Tab.Panels>
            <Tab.Panel className="outline-none">
              <div className="flex flex-col gap-5">
                {/* Filtri ruolo e GDO */}
                <div className="flex flex-col box box--stacked">
                  <div className="flex flex-col p-5 xl:items-center xl:flex-row gap-4">
                    {/* Selettore ruolo come tabs */}
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Ruolo</label>
                      <div className="flex flex-wrap gap-2">
                        {RUOLI_GESTIBILI.map(ruolo => (
                          <button
                            key={ruolo}
                            onClick={() => {
                              setSelectedRuolo(ruolo);
                              setSelectedRuoloGdo('');
                              setModifiche({});
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${selectedRuolo === ruolo
                              ? 'bg-primary text-white shadow-md shadow-primary/30'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-darkmode-600 dark:text-slate-300'
                              }`}
                          >
                            <Lucide icon={RUOLO_ICONS[ruolo] as any} className="w-4 h-4" />
                            {RUOLO_LABELS[ruolo]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selettore sotto-ruolo */}
                    {!!selectedRuolo && ruoliGdo && ruoliGdo.length > 0 && (
                      <div className="xl:w-56">
                        <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                          Ruolo
                        </label>
                        <FormSelect
                          value={selectedRuoloGdo}
                          onChange={(e) => {
                            setSelectedRuoloGdo(e.target.value);
                            setModifiche({});
                          }}
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

                    {/* Selettore GDO */}
                    <div className="xl:w-72">
                      <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                        Override GDO
                      </label>
                      <FormSelect
                        value={selectedGdo}
                        onChange={(e) => {
                          setSelectedGdo(e.target.value);
                          setModifiche({});
                        }}
                      >
                        <option value="">-- Permessi globali --</option>
                        {gdoList?.map(gdo => (
                          <option key={gdo.id} value={gdo.id}>
                            {gdo.nome}
                          </option>
                        ))}
                      </FormSelect>
                    </div>
                  </div>

                  {(selectedGdo || selectedRuoloGdo) && (
                    <div className="border-t border-slate-200/60 dark:border-darkmode-400 bg-amber-50/50 dark:bg-amber-900/10 px-5 py-3 flex flex-col gap-2">
                      {selectedRuoloGdo && (
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800/30 flex-shrink-0">
                            <Lucide icon="UserCog" className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-sm text-blue-800 dark:text-blue-300">
                            Stai configurando i permessi per il sotto-ruolo <strong>{ruoliGdo?.find(r => r.id === selectedRuoloGdo)?.ruolo.replace(/_/g, ' ')}</strong>. Questi sovrascrivono i permessi base del tipo utente selezionato.
                          </span>
                        </div>
                      )}
                      {selectedGdo && (
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800/30 flex-shrink-0">
                            <Lucide icon="TriangleAlert" className="w-4 h-4 text-amber-600" />
                          </div>
                          <span className="text-sm text-amber-800 dark:text-amber-300">
                            Stai configurando gli override per una GDO specifica. I permessi modificati sovrascriveranno i default globali.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats cards */}
                {!isLoading && permessi && permessi.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="box box--stacked p-4 flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-darkmode-600">
                        <Lucide icon="Shield" className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-slate-700 dark:text-slate-200">{stats.totali}</div>
                        <div className="text-xs text-slate-500">Totale permessi</div>
                      </div>
                    </div>
                    <div className="box box--stacked p-4 flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-success/10">
                        <Lucide icon="CircleCheck" className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-success">{stats.abilitati}</div>
                        <div className="text-xs text-slate-500">Abilitati</div>
                      </div>
                    </div>
                    <div className="box box--stacked p-4 flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-danger/10">
                        <Lucide icon="CircleX" className="w-5 h-5 text-danger" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-danger">{stats.disabilitati}</div>
                        <div className="text-xs text-slate-500">Disabilitati</div>
                      </div>
                    </div>
                    <div className="box box--stacked p-4 flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-800/20">
                        <Lucide icon="GitBranch" className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-600">{stats.overrides}</div>
                        <div className="text-xs text-slate-500">Override attivi</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabella Permessi */}
                {isLoading ? (
                  <div className="box box--stacked p-16 flex flex-col items-center justify-center gap-3">
                    <Lucide icon="Loader2" className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-sm text-slate-500">Caricamento permessi...</span>
                  </div>
                ) : permessi && permessi.length === 0 ? (
                  <div className="box box--stacked p-16 flex flex-col items-center justify-center gap-3">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-darkmode-600">
                      <Lucide icon="ShieldOff" className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200">Nessun permesso configurato</h3>
                      <p className="text-sm text-slate-500 mt-1">I permessi verranno creati automaticamente al prossimo caricamento.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(grouped).map(([risorsa, categorie]) => (
                      <div key={risorsa} className="box box--stacked overflow-hidden">
                        {/* Risorsa header */}
                        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200/60 dark:border-darkmode-400 bg-slate-50/80 dark:bg-darkmode-700/50">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                            <Lucide
                              icon={(RISORSA_ICONS[risorsa] || 'Folder') as any}
                              className="w-4 h-4 text-primary"
                            />
                          </div>
                          <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                            {risorsa.replace(/_/g, ' ')}
                          </h3>
                        </div>

                        {/* Categorie e permessi */}
                        <div className="divide-y divide-slate-100 dark:divide-darkmode-400">
                          {Object.entries(categorie).map(([categoria, items]) => {
                            const allEnabled = items.every(p => getEffectiveState(p));
                            const allDisabled = items.every(p => !getEffectiveState(p));
                            return (
                              <div key={categoria}>
                                {/* Categoria sub-header */}
                                <div className="flex items-center justify-between px-5 py-2 bg-slate-50/40 dark:bg-darkmode-700/30">
                                  <div className="flex items-center gap-2">
                                    <Lucide
                                      icon={(CATEGORIA_ICONS[categoria] || 'Circle') as any}
                                      className="w-3.5 h-3.5 text-slate-400"
                                    />
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                      {CATEGORIA_LABELS[categoria] || categoria}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      ({items.filter(p => getEffectiveState(p)).length}/{items.length})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleToggleAll(items, true)}
                                      disabled={allEnabled}
                                      className="text-xs text-primary hover:text-primary/80 disabled:text-slate-300 disabled:cursor-default transition-colors"
                                    >
                                      Abilita tutti
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                      onClick={() => handleToggleAll(items, false)}
                                      disabled={allDisabled}
                                      className="text-xs text-danger hover:text-danger/80 disabled:text-slate-300 disabled:cursor-default transition-colors"
                                    >
                                      Disabilita tutti
                                    </button>
                                  </div>
                                </div>

                                {/* Permessi items */}
                                {items.map(p => {
                                  const isAbilitato = getEffectiveState(p);
                                  const isModificato = p.id_permesso in modifiche;
                                  return (
                                    <div
                                      key={p.id_permesso}
                                      className={`flex items-center justify-between px-5 py-3 transition-colors ${isModificato
                                        ? 'bg-blue-50/50 dark:bg-blue-900/10'
                                        : 'hover:bg-slate-50/50 dark:hover:bg-darkmode-700/30'
                                        }`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-sm text-slate-700 dark:text-slate-200">
                                            {p.nome}
                                          </span>
                                          <code className="text-[11px] text-slate-400 bg-slate-100 dark:bg-darkmode-600 px-1.5 py-0.5 rounded font-mono">
                                            {p.codice}
                                          </code>
                                          {p.is_override && (
                                            <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-700 dark:bg-amber-800/30 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">
                                              <Lucide icon="GitBranch" className="w-3 h-3" />
                                              override
                                            </span>
                                          )}
                                          {isModificato && (
                                            <span className="inline-flex items-center gap-1 text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-800/30 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                                              <Lucide icon="Pencil" className="w-3 h-3" />
                                              modificato
                                            </span>
                                          )}
                                        </div>
                                        {p.descrizione && (
                                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{p.descrizione}</p>
                                        )}
                                      </div>
                                      <FormSwitch className="ml-4">
                                        <FormSwitch.Input
                                          type="checkbox"
                                          checked={isAbilitato}
                                          onChange={() => handleToggle(p.id_permesso, isAbilitato)}
                                        />
                                      </FormSwitch>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </Tab.Panel>
            <Tab.Panel className="outline-none">
              <MenuTab />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>

      {/* Dialog conferma Rigenera Catalogo */}
      <Dialog
        open={showReseedDialog}
        onClose={() => setShowReseedDialog(false)}
        staticBackdrop
      >
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">Rigenera Catalogo Permessi</h2>
          </Dialog.Title>
          <Dialog.Description className="space-y-4">
            <div className="p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/30 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium mb-2">
                <Lucide icon="AlertTriangle" className="w-5 h-5" />
                Attenzione
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Questa operazione svuotera e ricreera l'intero catalogo dei permessi.
              </p>
            </div>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>Tutti gli override GDO personalizzati verranno rimossi</li>
              <li>I permessi di default per ogni ruolo verranno ripristinati</li>
              <li>Eventuali nuovi permessi nel codice verranno aggiunti automaticamente</li>
            </ul>
          </Dialog.Description>
          <Dialog.Footer className="flex justify-end gap-2">
            <Button
              variant="outline-secondary"
              onClick={() => setShowReseedDialog(false)}
            >
              Annulla
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowReseedDialog(false);
                reseedMutation.mutate();
              }}
            >
              <Lucide icon="RefreshCw" className="w-4 h-4 mr-1.5" />
              Rigenera Catalogo
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* Dialog conferma Reset Override GDO */}
      <Dialog
        open={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        staticBackdrop
      >
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">Reset Override GDO</h2>
          </Dialog.Title>
          <Dialog.Description className="space-y-4">
            <div className="p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/30 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium mb-2">
                <Lucide icon="RotateCcw" className="w-5 h-5" />
                Conferma reset
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Verranno rimossi tutti gli override personalizzati per questa GDO e il ruolo <strong>{RUOLO_LABELS[selectedRuolo]}</strong>.
              </p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              I permessi torneranno ai valori di default globali del ruolo. Questa azione non e reversibile.
            </p>
          </Dialog.Description>
          <Dialog.Footer className="flex justify-end gap-2">
            <Button
              variant="outline-secondary"
              onClick={() => setShowResetDialog(false)}
            >
              Annulla
            </Button>
            <Button
              variant="warning"
              onClick={() => {
                setShowResetDialog(false);
                resetMutation.mutate();
              }}
            >
              <Lucide icon="RotateCcw" className="w-4 h-4 mr-1.5" />
              Conferma Reset
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
    </div>
  );
}

export default withSessionCheck(GestionePermessi);
