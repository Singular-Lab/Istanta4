import Button from '@/components/Base/Button';
import Dropzone, { DropzoneElement } from '@/components/Base/Dropzone';
import Lucide from '@/components/Base/Lucide';
import { useFetchPromoPerTimeline } from '@/query/query';
import { Errore, GRAVITA_PROBLEMA } from '@/stores/errorSlice';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { shallowEqual, useSelector } from 'react-redux';
import { ServerCall } from '../../../../lib/server_call';
import GestioneReferenze from '../GestioneReferenze';
import Timeline from '../TimeLinePromo';
import styles from './DeveloperConsole.module.css';

export type ConsoleMode = 'superadmin' | 'admin' | 'final_user';

interface DeveloperConsoleProps {
  mode: ConsoleMode;
}

const DeveloperConsole = forwardRef<
  {
    toggleVisibilityErrori: () => void;
    toggleVisibilityTimeLine: () => void;
    toggleVisibilityGestioneReferenze: () => void;
  },
  DeveloperConsoleProps
>(({ mode }, ref) => {

  // Visibility state
  const [visibleErrors, setVisibleErrors] = useState(false);
  const [visibleTimeline, setVisibleTimeline] = useState(false);
  const [visibleRefs, setVisibleRefs] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'medium' | 'low'>('all');

  // Select errors using shallowEqual to avoid unnecessary renders
  const errorGroups = useSelector(
    (state: any) => state.developerConsoleReducer.errori,
    shallowEqual
  );

  // Group and count errors
  const groupedErrors = useMemo(() => {
    const grouped: Record<string, Errore[]> = {
      all: [],
      critical: [],
      medium: [],
      low: []
    };

    (Object.values(errorGroups).flat() as Errore[]).forEach((err: Errore) => {
      grouped.all.push(err);
      switch (err.gravita) {
        case GRAVITA_PROBLEMA.CRITICA:
          grouped.critical.push(err);
          break;
        case GRAVITA_PROBLEMA.MEDIA:
          grouped.medium.push(err);
          break;
        case GRAVITA_PROBLEMA.BASSA:
          grouped.low.push(err);
          break;
      }
    });

    return grouped;
  }, [errorGroups]);

  const errorCounts = useMemo(
    () => ({
      all: groupedErrors.all.length,
      critical: groupedErrors.critical.length,
      medium: groupedErrors.medium.length,
      low: groupedErrors.low.length
    }),
    [groupedErrors]
  );

  // Timeline tasks
  const params = new URLSearchParams(window.location.search);
  const idArea = params.get('idArea') || '';
  const idCanale = params.get('idCanale') || '';
  const promoData = useFetchPromoPerTimeline(idArea, idCanale);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    if (promoData.data) setTasks(promoData.data);
  }, [promoData.data]);

  // Handlers
  const toggleErrorConsole = useCallback(() => setVisibleErrors(v => !v), []);
  const toggleTimelineConsole = useCallback(() => setVisibleTimeline(v => !v), []);
  const toggleRefsConsole = useCallback(() => setVisibleRefs(v => !v), []);

  // Imperative handle for parent toggles
  useImperativeHandle(
    ref,
    () => ({
      toggleVisibilityErrori: toggleErrorConsole,
      toggleVisibilityTimeLine: toggleTimelineConsole,
      toggleVisibilityGestioneReferenze: toggleRefsConsole
    }),
    [toggleErrorConsole, toggleTimelineConsole, toggleRefsConsole]
  );

  // Hotkeys
  useHotkeys('ctrl+shift+h', toggleErrorConsole, [toggleErrorConsole]);
  useHotkeys(
    'esc',
    useCallback(() => {
      setVisibleErrors(false);
      setVisibleTimeline(false);
      setVisibleRefs(false);
    }, []),
    []
  );

  // Upload handler
  const handleUploadLoghi = useCallback(
    async (file: File, logo: any) => {
      try {
        const formData = new FormData();
        const url = new URL(logo.guidId);
        const guidParam = url.searchParams.get('guidId');
        if (!guidParam) return;
        formData.append('guidId', guidParam);
        formData.append('file', file);
        formData.append('sigla', logo.sigla);
        formData.append('tipo', logo.tipo.toString());
        const apiUrl = `${ServerCall.getUrl()}/uploadForzatoImmaginiOlimpo`;
        await axios.post(apiUrl, formData, { withCredentials: true });
      } catch (error) {
        console.error('Error uploading logo:', error);
      }
    },
    []
  );

  // Dropzone options


  // Render individual error
  const renderError = useCallback(
    (err: Errore) => {
      const common = (
        <div className={styles.message}>
          {err.message}
          {err.ref && (
            <button className={styles.actionButton} onClick={err.ref}>
              <Lucide icon="ArrowRight" width={16} height={16} /> Mostra
            </button>
          )}
        </div>
      );

      switch (err.gravita) {
        case GRAVITA_PROBLEMA.CRITICA:
          return (
            <motion.div
              key={`${err.type}-${err.gravita}`}
              className={styles.errore}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className={styles.erroreIcon}>
                <Lucide icon="CircleAlert" width={20} height={20} />
              </div>
              {err.logo && (
                <Dropzone options={{
                  dragend: (event) => {
                    console.log("Drag end", event);
                  },
                  dragenter: (event) => {
                    console.log("Drag enter", event);
                  },
                  addedfile: (file) => {
                    console.log("File added", file);
                    if (err.logo) {
                      handleUploadLoghi(file, err.logo);
                    }
                  },
                  method: "POST",
                  url: "uploadTracciati",
                  acceptedFiles: 'image/png | image/jpeg | image/webp',
                  autoProcessQueue: false,
                  addRemoveLinks: true,
                }} getRef={function (el: DropzoneElement): void {
                }} >
                  <div className="text-lg font-medium">
                    Fai clic o trascina i tracciati qui per caricarli
                  </div>
                  <div className="text-sm text-gray-400">Accetta solo file .png, .jpg, .jpeg, .webp</div>
                </Dropzone>
              )}
              {common}
            </motion.div>
          );
        case GRAVITA_PROBLEMA.MEDIA:
          return (
            <motion.div
              key={`${err.type}-${err.gravita}`}
              className={styles.warning}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className={styles.warningIcon}>
                <Lucide icon="TriangleAlert" width={20} height={20} />
              </div>
              {common}
            </motion.div>
          );
        case GRAVITA_PROBLEMA.BASSA:
          return (
            <motion.div
              key={`${err.type}-${err.gravita}`}
              className={styles.suggerimenti}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className={styles.suggerimentiIcon}>
                <Lucide icon="Info" width={20} height={20} />
              </div>
              {common}
            </motion.div>
          );
        default:
          return null;
      }
    },
    []
  );

  // Tab definitions
  const tabs = useMemo(
    () => [
      { key: 'all', label: 'Tutti', count: errorCounts.all },
      { key: 'critical', label: 'Critici', count: errorCounts.critical },
      { key: 'medium', label: 'Warning', count: errorCounts.medium },
      { key: 'low', label: 'Info', count: errorCounts.low }
    ],
    [errorCounts]
  );
  if (mode === 'final_user') return null;

  return (
    <AnimatePresence>
      {visibleErrors && (
        <motion.div
          className={styles.container}
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.header}>
            <h1 className={styles.title}>
              Problemi rilevati <span className={styles.errorCount}>{errorCounts.all}</span>
            </h1>
            <button onClick={toggleErrorConsole} className={styles.closeButton}>
              <Lucide icon="X" />
            </button>
          </div>

          {errorCounts.all > 0 ? (
            <>
              <div className={styles.tabs}>
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    className={`${styles.tab} ${activeTab === tab.key ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab(tab.key as any)}
                  >
                    {tab.label} {tab.count > 0 && <span className={styles.errorCount}>{tab.count}</span>}
                  </button>
                ))}
              </div>

              <div className={styles.formContainer}>
                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {groupedErrors[activeTab].map((err, idx) => (
                      <React.Fragment key={`${err.type}-${err.gravita}-${idx}`}>{renderError(err)}</React.Fragment>
                    ))}
                  </motion.div>
                </AnimatePresence>

                <div className={styles.sectionFooter}>
                  <Button variant="outline-dark" onClick={toggleErrorConsole}>
                    Chiudi Console
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <Lucide icon="CircleCheck" width={48} height={48} />
              <h3 className={styles.emptyStateMessage}>Nessun problema rilevato</h3>
              <p className={styles.emptyStateSubMessage}>Tutto sembra funzionare correttamente</p>
            </div>
          )}
        </motion.div>
      )}

      {visibleTimeline && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 bg-white z-[9999999] rounded-t-md shadow-lg"
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ duration: 0.3 }}
        >
          <Timeline tasks={tasks} onClose={toggleTimelineConsole} />
        </motion.div>
      )}

      {visibleRefs && <GestioneReferenze />}
    </AnimatePresence>
  );
});

export default React.memo(DeveloperConsole);
