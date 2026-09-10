import Skeleton from '@/components/Base/Skeleton';
import EmptyState from '@/components/EmptyState';
import withSessionCheck from '@/components/SessionChecker';
import { useUser } from '@/context/UserContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from 'react-grid-layout';
import { TIPO_UTENTI } from '../../../lib/enums';
import { ServerCall } from '../../../lib/server_call';
import Lucide from '../../components/Base/Lucide';
import { useNotification } from '../../context/NotificationContext';
import EnhancedGridDashboard from './EnhancedGridDashboard';
import { AddWidgetDialog } from './components/AddWidgetDialog';
import { DashboardToolbar } from './components/DashboardToolbar';
import { LazyPluginWrapper } from './components/LazyPluginWrapper';
import { RolePermissionsDialog } from './components/RolePermissionsDialog';
import { loadRegistryPlugins } from './loadRegistryPlugins';
import { pluginRegistry } from './pluginRegistry';
import { Dashboard, DashboardPlugin, DashboardPluginData, GridWidget, WidgetComponentProps, WidgetRoleConfig } from './types';

/**
 * Componente principale della dashboard con tutta la logica integrata
 * Gestisce caricamento, salvataggio e trasformazione dei plugin
 */
function DashboardMain() {
  // Controllo parametri URL per modalità skeleton demo
  const urlParams = new URLSearchParams(window.location.search);
  const forceSkeletonMode = urlParams.get('skeleton') === 'true';
  const { showNotification } = useNotification();
  // Stato utente
  const { user } = useUser();
  // Ruolo reale dell'utente loggato (determina i permessi di modifica)
  const actualUserRole = user?.tipo;
  const isSuperAdmin = actualUserRole === TIPO_UTENTI.SUPERADMIN;

  // Ruolo selezionato per la preview (quale dashboard si sta visualizzando/modificando)
  // Solo i superadmin possono cambiare questo valore
  const [selectedRole, setSelectedRole] = useState(actualUserRole);

  // Stato plugin
  const [plugins, setPlugins] = useState<DashboardPlugin[]>([]);
  // RIMUOVI pluginsLoaded
  const [registryLength, setRegistryLength] = useState(0);

  // Inizializzazione plugin registry
  useEffect(() => {
    const initializePlugins = async () => {
      try {
        if (pluginRegistry.length === 0) {
          console.log('Inizializzazione plugin registry...');
          await loadRegistryPlugins();
          setRegistryLength(pluginRegistry.length);
        } else {
          console.log('Plugin già presenti nel registry:', pluginRegistry.length);
          setRegistryLength(pluginRegistry.length);
        }
        // RIMUOVI setPluginsLoaded(true);
      } catch (error) {
        console.error('Errore inizializzazione plugin:', error);
        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon="CircleX" className="text-danger w-8 h-8" />
            <div className="ml-4 mr-4">
              <div className="font-bold">Errore nell'inizializzazione dei plugin</div>
            </div>
          </div>
        );
        //toast.error('Errore nel caricamento dei plugin');
        // RIMUOVI setPluginsLoaded(true);
      }
    };

    // RICARICA SEMPRE quando cambia registryLength
    initializePlugins();
    refetchDashboardConfig();
  }, [registryLength]);

  // Funzione per verificare i permessi
  const canSeePlugin = useCallback((plugin: DashboardPlugin, role: TIPO_UTENTI): boolean => {
    if (role === undefined) return false;
    if (role === TIPO_UTENTI.SUPERADMIN) return true;
    return plugin.allowedRoles.some(r => r.tipo === role);
  }, []);

  // Caricamento configurazione dashboard dal server
  const getDashboardConfig = useCallback(async (): Promise<Dashboard | null> => {
    try {
      console.log('getDashBoardConfig chiamata, selectedRole:', selectedRole, 'pluginRegistry.length:', pluginRegistry.length);

      // Passa il ruolo selezionato come query parameter
      const response = await ServerCall.get<Dashboard>(`/getDashBoardConfig?role=${selectedRole}`);
      if (response && response.plugins && response.plugins.length > 0) {
        // Merge dei plugin salvati con le definizioni dal registry
        // Il registry ha il component React, i dati salvati hanno layout e altre configurazioni
        const withDefs = response.plugins
          .map((sp: any) => {
            const def = pluginRegistry.find(p => p.id === sp.id);
            if (!def) {
              console.warn(`Plugin ${sp.id} not found in registry, skipping`);
              return null;
            }
            // Merge: le definizioni dal registry hanno priorità per component e metadati base
            // I dati salvati hanno priorità per layout e configurazioni utente
            const merged: DashboardPlugin = {
              ...def, // Definiti dal registry (include component)
              ...sp,  // Dati salvati (include layout, allowedRoles custom, etc.)
              component: def.component, // Assicurati che component venga dal registry
              allowedRoles: sp.allowedRoles || def.allowedRoles, // Usa allowedRoles salvati o default
            };

            // Se layout è salvato, assicurati che abbia tutte le proprietà necessarie
            if (merged.layout && !merged.layout.i) {
              merged.layout.i = merged.id;
            }

            return merged;
          })
          .filter(Boolean) as DashboardPlugin[];

        console.log('Plugin caricati dal server:', {
          count: withDefs.length,
          plugins: withDefs.map(p => ({
            id: p.id,
            name: p.name,
            layout: p.layout,
            hasComponent: !!p.component
          }))
        });
        setPlugins(withDefs);
      } else {
        // Nessuna configurazione salvata, dashboard vuota
        console.log('Nessuna configurazione dal server, dashboard vuota');
        setPlugins([]);
      }
      return response;
    } catch (error) {
      console.error('Errore caricamento configurazione dashboard:', error);
      // In caso di errore, lascia la dashboard vuota
      setPlugins([]);
      return null;
    }
  }, [selectedRole]);

  // Query per il caricamento della configurazione
  const {
    isLoading: isLoadingPlugins,
    error: pluginsError,
    refetch: refetchDashboardConfig
  } = useQuery({
    queryKey: ['dashboardConfig', selectedRole, registryLength],
    queryFn: getDashboardConfig,
    enabled: selectedRole !== undefined && registryLength > 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });


  // Trasformazione dei plugin in grid widgets
  const gridWidgets = useMemo(() => {
    if (!selectedRole) return [];

    return plugins
      .filter(plugin => {
        // Filtra solo i plugin visibili per questo ruolo
        const canSee = canSeePlugin(plugin, selectedRole);
        if (!canSee) {
          console.log(`Plugin ${plugin.id} filtered out: not visible for role ${selectedRole}`);
        }
        return canSee;
      })
      .map(plugin => {
        // Wrapper ottimizzato per gestire Suspense
        const WrappedComponent = (props: WidgetComponentProps) => (
          <LazyPluginWrapper
            plugin={plugin}
            {...plugin.props}
            {...props}
          />
        );

        // Trova la configurazione del ruolo per il ruolo selezionato
        const roleConfig = plugin.allowedRoles?.find(role => role.tipo === selectedRole);

        // Se non c'è roleConfig ma l'utente è SUPERADMIN, usa valori di default
        if (!roleConfig) {
          if (selectedRole === TIPO_UTENTI.SUPERADMIN) {
            console.warn(`No role configuration found for plugin ${plugin.id}, using defaults for SUPERADMIN`);
          } else {
            console.warn(`No role configuration found for selected role ${selectedRole} in plugin ${plugin.id}`);
            return null;
          }
        }

        // Usa layout se presente (salvato dal server o da react-grid-layout)
        // Altrimenti usa default dalla configurazione ruolo
        // Se layout è salvato, ha priorità (viene da react-grid-layout o server)
        let layout: Layout;

        if (plugin.layout) {
          // Usa layout salvato (ha priorità)
          layout = {
            ...plugin.layout,
            i: plugin.id, // Assicurati che l'id sia corretto
          };
        } else if (roleConfig?.options?.default) {
          // Usa default dalla configurazione ruolo
          layout = {
            ...roleConfig.options.default,
            i: plugin.id,
          };
        } else {
          // Fallback con valori di default
          layout = {
            i: plugin.id,
            x: 0,
            y: 0,
            w: 4,
            h: 4,
            minW: plugin.minW ?? 2,
            minH: plugin.minH ?? 2,
          };
        }

        const widget: GridWidget = {
          ...plugin,
          id: plugin.id,
          Component: WrappedComponent,
          data: {} as DashboardPluginData,
          allowedRoles: plugin.allowedRoles || [],
          title: plugin.name,
          layout, // Layout react-grid-layout (x, y, w, h)
          minW: plugin.minW,
          minH: plugin.minH,
        };
        return widget;
      })
      .filter((widget): widget is GridWidget => widget !== null);

  }, [plugins, selectedRole, canSeePlugin]);

  // Widget disponibili per l'aggiunta (non già presenti)
  const availableWidgets = useMemo(() => {
    // Non calcolare finché il registry non è caricato
    if (registryLength === 0 || pluginRegistry.length === 0) {
      console.log('Available widgets: not ready yet', { registryLength, pluginRegistryLength: pluginRegistry.length });
      return [];
    }

    // Crea un set degli ID dei plugin già presenti
    const currentIds = new Set(plugins.map(p => p.id));

    const filtered = pluginRegistry.filter(p => {
      const canSee = selectedRole && canSeePlugin(p, selectedRole);
      const notPresent = !currentIds.has(p.id);
      const isGrid = p.position === 'grid';
      return isGrid && canSee && notPresent;
    });

    // console.log('Available widgets calculated:', {
    //   pluginsLoaded,
    //   registryLength: pluginRegistry.length,
    //   currentPluginsCount: plugins.length,
    //   currentIds: Array.from(currentIds),
    //   availableCount: filtered.length,
    //   availableIds: filtered.map(p => p.id),
    //   selectedRole
    // });

    return filtered;
  }, [plugins, canSeePlugin, selectedRole, registryLength]);

  // Trova il primo spazio disponibile nella griglia (usa Layout di react-grid-layout)
  const findFirstAvailableSpace = useCallback((
    widgets: DashboardPlugin[],
    w: number,
    h: number,
    gridColumns: number = 12
  ): { x: number; y: number } => {
    const grid: boolean[][] = Array(gridColumns).fill(null).map(() => []);

    // Segna gli spazi occupati usando layout (x, y, w, h)
    widgets.forEach(widget => {
      if (!widget.layout) return;
      const { x, y, w: widgetW, h: widgetH } = widget.layout;
      for (let c = x; c < x + widgetW; c++) {
        for (let r = y; r < y + widgetH; r++) {
          if (!grid[c]) grid[c] = [];
          grid[c][r] = true;
        }
      }
    });

    // Trova il primo spazio disponibile
    let maxY = 0;
    widgets.forEach(w => {
      if (w.layout) {
        maxY = Math.max(maxY, (w.layout.y || 0) + (w.layout.h || 4));
      }
    });

    // Controlla ogni posizione possibile
    for (let y = 0; y <= maxY + 1; y++) {
      for (let x = 0; x <= gridColumns - w; x++) {
        let canFit = true;

        for (let c = x; c < x + w; c++) {
          for (let r = y; r < y + h; r++) {
            if (grid[c]?.[r]) {
              canFit = false;
              break;
            }
          }
          if (!canFit) break;
        }

        if (canFit) {
          return { x, y };
        }
      }
    }

    return { x: 0, y: maxY + 1 };
  }, []);

  // Handler per i cambiamenti della griglia (da react-grid-layout)
  // Solo il super admin può modificare il layout
  const onGridChange = useCallback((updatedWidgets: GridWidget[]) => {
    // Blocca le modifiche se non è super admin
    if (!isSuperAdmin) {
      console.warn('Tentativo di modifica layout da utente non autorizzato');
      return;
    }

    console.log('onGridChange called with:', updatedWidgets.map(w => ({ id: w.id, layout: w.layout })));
    setPlugins(currentPlugins => {
      const updatedPlugins = currentPlugins.map(plugin => {
        const changedWidget = updatedWidgets?.find(w => w.id === plugin.id);
        if (!changedWidget || !changedWidget.layout) {
          // Se il widget non è stato trovato o non ha layout, mantieni il plugin originale
          return plugin;
        }

        // Usa layout direttamente dal widget (gestito da react-grid-layout)
        const layout = changedWidget.layout;

        // Aggiorna allowedRoles solo se esiste già una configurazione per questo ruolo
        const newAllowedRoles = plugin.allowedRoles?.map(roleConfig => {
          if (roleConfig.tipo !== selectedRole) return roleConfig;

          return {
            ...roleConfig,
            options: {
              ...roleConfig.options,
              custom: {
                ...roleConfig.options.custom,
                [selectedRole as TIPO_UTENTI]: layout,
              },
            },
          };
        }) || plugin.allowedRoles || [];

        return {
          ...plugin,
          allowedRoles: newAllowedRoles,
          layout, // Aggiorna anche layout nel plugin
        };
      });

      console.log('Plugins updated after grid change:', updatedPlugins.map(p => ({ id: p.id, layout: p.layout })));
      return updatedPlugins;
    });
  }, [selectedRole, isSuperAdmin]);

  // Handler per eliminazione widget
  // Solo il super admin può eliminare widget
  const onDeleteWidget = useCallback((id: string) => {
    if (!isSuperAdmin) {
      console.warn('Tentativo di eliminazione widget da utente non autorizzato');
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Solo il super amministratore può eliminare widget</div>
          </div>
        </div>
      );
      //toast.error('Solo il super amministratore può eliminare widget');
      return;
    }
    setPlugins(prev => prev.filter(p => p.id !== id));
  }, [isSuperAdmin]);

  // Handler per aggiunta widget
  // Solo il super admin può aggiungere widget
  const onAddWidget = useCallback((widget: DashboardPlugin) => {
    if (!isSuperAdmin) {
      console.warn('Tentativo di aggiunta widget da utente non autorizzato');
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Solo il super amministratore può aggiungere widget</div>
          </div>
        </div>
      );
      //toast.error('Solo il super amministratore può aggiungere widget');
      return;
    }

    console.log('Adding widget:', widget.id, widget.name);
    setPlugins(prev => {
      // Verifica che il widget non sia già presente
      if (prev.some(p => p.id === widget.id)) {
        console.warn(`Widget ${widget.id} already exists, skipping`);
        return prev;
      }

      // Usa dimensioni di default dal widget o dal ruolo
      const defaultW = widget.layout?.w || 4;
      const defaultH = widget.layout?.h || 4;
      const position = findFirstAvailableSpace(prev, defaultW, defaultH);

      // Crea layout in formato react-grid-layout
      const layout: Layout = {
        i: widget.id,
        x: position.x,
        y: position.y,
        w: defaultW,
        h: defaultH,
        minW: widget.minW ?? widget.layout?.minW ?? 2,
        minH: widget.minH ?? widget.layout?.minH ?? 2,
      };

      // Assicurati che il widget abbia tutte le proprietà necessarie
      const newPlugin: DashboardPlugin = {
        ...widget,
        id: widget.id,
        name: widget.name,
        component: widget.component, // Componente React lazy
        position: widget.position || 'grid',
        order: prev.length,
        layout, // Layout react-grid-layout (x, y, w, h)
        allowedRoles: widget.allowedRoles || [], // Assicurati che allowedRoles sia presente
        isDraggable: widget.isDraggable ?? true,
        isResizable: widget.isResizable ?? true,
        isDeletable: widget.isDeletable ?? true,
        minW: widget.minW ?? 2,
        minH: widget.minH ?? 2,
      };

      console.log('New plugin created:', {
        id: newPlugin.id,
        name: newPlugin.name,
        layout: newPlugin.layout,
        allowedRoles: newPlugin.allowedRoles?.map(r => r.tipo),
        hasComponent: !!newPlugin.component
      });

      // Chiudi il dialog SOLO dopo aver aggiornato lo stato
      setTimeout(() => setShowAddDialog(false), 0);
      return [...prev, newPlugin];
    });
  }, [findFirstAvailableSpace, isSuperAdmin]);

  // Handler per aggiornamento permessi
  const onUpdatePluginRoles = useCallback((pluginId: string, roles: WidgetRoleConfig[]) => {
    setPlugins(prev =>
      prev.map(plugin =>
        plugin.id === pluginId ? { ...plugin, allowedRoles: roles } : plugin
      )
    );
  }, []);

  // Mutation per il salvataggio del layout
  // Solo il super admin può salvare
  const saveLayoutMutation = useMutation({
    mutationFn: async () => {
      // Verifica che solo il super admin possa salvare
      if (!isSuperAdmin) {
        throw new Error('Solo il super amministratore può salvare il layout');
      }

      // Serializza il layout nel formato che il server si aspetta
      // Il server si aspetta Dashboard con plugins: DashboardPlugin[]
      // NON salvare 'component' perché è una funzione React non serializzabile
      // Il server salverà solo i metadati, il component verrà ricaricato dal registry
      const pluginsToSave = plugins.map(p => {
        // Prepara i dati da salvare (senza component)
        // Usa layout direttamente (formato react-grid-layout: x, y, w, h)
        const pluginData: any = {
          id: p.id,
          name: p.name,
          position: p.position || 'grid',
          order: p.order ?? 0,
          layout: p.layout, // Layout react-grid-layout (x, y, w, h)
          allowedRoles: p.allowedRoles || [],
          isDraggable: p.isDraggable,
          isResizable: p.isResizable,
          isDeletable: p.isDeletable,
          showPagination: p.showPagination,
          showFilter: p.showFilter,
          baseFilter: p.baseFilter,
          minW: p.minW,
          minH: p.minH,
        };

        // Rimuovi undefined/null per pulizia
        Object.keys(pluginData).forEach(key => {
          if (pluginData[key] === undefined || pluginData[key] === null) {
            delete pluginData[key];
          }
        });

        return pluginData;
      });

      const dashboard: Dashboard = {
        version: 2,
        lastUpdated: new Date().toISOString(),
        plugins: pluginsToSave,
      };

      console.log('Saving dashboard config for role:', selectedRole, {
        version: dashboard.version,
        pluginsCount: dashboard.plugins.length,
        plugins: dashboard.plugins.map(p => ({
          id: p.id,
          name: p.name,
          layout: p.layout
        }))
      });

      // Invia dashboard e ruolo target al server
      await ServerCall.post('/saveDashBoardConfig', {
        dashboard,
        role: selectedRole
      });
      localStorage.setItem(`dashboardLayout_${selectedRole}`, JSON.stringify(dashboard));
    },
    onSuccess: () => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Layout salvato con successo per {selectedRole}</div>
          </div>
        </div>
      );
    },
    onError: (error: any) => {
      console.error('Errore salvataggio layout:', error);
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante il salvataggio del layout</div>
          </div>
        </div>
      );
    }
  });

  const saveLayout = useCallback(() => {
    if (!saveLayoutMutation.isPending) {
      saveLayoutMutation.mutate();
    }
  }, [saveLayoutMutation]);

  const resetLayout = useCallback(() => {
    // Solo il super admin può resettare il layout
    if (!isSuperAdmin) {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Solo il super amministratore può ripristinare la dashboard</div>
          </div>
        </div>
      );
      return;
    }

    if (!window.confirm('Ripristinare la dashboard predefinita?')) return;

    localStorage.removeItem('dashboardLayout');

    // Reset dei plugin allo stato di default
    const resetPlugins = plugins.map(plugin => ({
      ...plugin,
      layout: undefined, // resetta il layout react-grid-layout
      allowedRoles: plugin.allowedRoles.map(roleConfig => ({
        ...roleConfig,
        options: {
          ...roleConfig.options,
          custom: undefined
        }
      }))
    }));

    setPlugins(resetPlugins);
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Dashboard ripristinata con successo</div>
        </div>
      </div>
    );
    //toast.success('Dashboard ripristinata!');
  }, [plugins, isSuperAdmin]);

  // Stati locali per UI
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRolesDialog, setShowRolesDialog] = useState(false);

  // Handlers memoizzati
  const handleAddWidget = useCallback(() => setShowAddDialog(true), []);
  const handleShowRoles = useCallback(() => setShowRolesDialog(true), []);
  const handleCloseAddDialog = useCallback(() => setShowAddDialog(false), []);
  const handleCloseRolesDialog = useCallback(() => setShowRolesDialog(false), []);

  // Stati di caricamento (solo per plugin e configurazione)
  const isLoading = isLoadingPlugins || registryLength === 0 || forceSkeletonMode;

  // Debug: log dei widget caricati
  console.log('Dashboard Debug:', {
    pluginsLoaded: true,
    isLoadingPlugins,
    pluginsCount: plugins.length,
    gridWidgetsCount: gridWidgets.length,
    actualUserRole,
    selectedRole,
    isSuperAdmin,
    forceSkeletonMode
  });

  // Rendering condizionale per loading
  if (isLoading) {
    return (
      <div className="p-4 flex flex-col rounded-xl">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-span-full sm:col-span-6 bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <Skeleton width="150px" height="24px" />
                <Skeleton width="24px" height="24px" borderRadius="50%" />
              </div>
              <div className="space-y-3">
                <Skeleton height="60px" />
                <Skeleton height="60px" />
                <Skeleton height="60px" />
              </div>
            </div>
          ))}
        </div>
        {forceSkeletonMode && (
          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
            <div className="flex items-center">
              <span className="text-yellow-800 text-sm">
                🎭 Modalità Skeleton Demo attiva. Rimuovi <code>?skeleton=true</code> dall'URL per vedere i dati reali.
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col rounded-xl">
      {/* Toolbar - visibile solo per superadmin (basato sul ruolo reale) */}
      <DashboardToolbar
        userRole={selectedRole as TIPO_UTENTI}
        setUserRole={setSelectedRole}
        isSuperAdmin={isSuperAdmin}
        isSaving={saveLayoutMutation.isPending}
        onAddWidget={handleAddWidget}
        onResetDashboard={resetLayout}
        onSaveLayout={saveLayout}
        onShowRoles={handleShowRoles}
      />

      {/* Dashboard grid */}
      <div className="col-span-12">
        {gridWidgets.length === 0 ? (
          <EmptyState
            icon="LayoutDashboard"
            title="Dashboard vuota"
            description="Aggiungi un widget per iniziare."
            className="py-16"
          />
        ) : (
          <EnhancedGridDashboard
            widgets={gridWidgets}
            isSuperAdmin={isSuperAdmin}
            userRole={selectedRole as TIPO_UTENTI}
            onChange={onGridChange}
            onDelete={onDeleteWidget}
          />
        )}
      </div>

      {/* Dialogs */}
      <AddWidgetDialog
        isOpen={showAddDialog}
        onClose={handleCloseAddDialog}
        availableWidgets={availableWidgets}
        onAddWidget={onAddWidget}
      />

      <RolePermissionsDialog
        isOpen={showRolesDialog}
        onClose={handleCloseRolesDialog}
        plugins={plugins}
        onUpdatePluginRoles={onUpdatePluginRoles}
      />
    </div>
  );
}

export default withSessionCheck(DashboardMain);
