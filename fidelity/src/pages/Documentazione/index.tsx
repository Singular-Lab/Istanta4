import Lucide from "@/components/Base/Lucide";
import withSessionCheck from "@/components/SessionChecker";
import { Link } from "react-router-dom";
import PageHeader from "../../components/Base/PageHeader";

interface DocSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  color: string;
  bgColor: string;
}

const docSections: DocSection[] = [
  {
    id: "panoramica",
    title: "Panoramica Sistema",
    description: "Architettura, flusso autenticazione e concetti chiave del sistema External API",
    icon: "BookOpen",
    path: "/documentazione/panoramica",
    color: "text-primary",
    bgColor: "bg-primary/10 border-primary/20",
  },
  {
    id: "guida-rapida",
    title: "Guida Rapida",
    description: "Inizia subito con una guida step-by-step per integrare l'API nel tuo progetto",
    icon: "Rocket",
    path: "/documentazione/guida-rapida",
    color: "text-success",
    bgColor: "bg-success/10 border-success/20",
  },
  {
    id: "api",
    title: "API REST",
    description: "Reference completa degli endpoint, parametri, esempi di codice e test interattivi",
    icon: "Code",
    path: "/documentazione/api",
    color: "text-info",
    bgColor: "bg-info/10 border-info/20",
  },
  {
    id: "plugin",
    title: "Plugin JavaScript",
    description: "Integra i contenuti nel browser con il plugin FP: installazione, metodi e configurazione",
    icon: "Package",
    path: "/documentazione/plugin",
    color: "text-warning",
    bgColor: "bg-warning/10 border-warning/20",
  },
  {
    id: "filter-templates",
    title: "Template Filtri",
    description: "Crea e gestisci configurazioni riutilizzabili con il sistema slug-based",
    icon: "Filter",
    path: "/documentazione/filter-templates",
    color: "text-pending",
    bgColor: "bg-pending/10 border-pending/20",
  },
  {
    id: "statistiche",
    title: "Statistiche & Monitoring",
    description: "Monitora le chiamate API, analizza i sistemi operativi e esporta i dati",
    icon: "BarChart3",
    path: "/documentazione/statistiche",
    color: "text-danger",
    bgColor: "bg-danger/10 border-danger/20",
  },
];

function DocumentazioneHubPage() {
  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* Header */}
        <PageHeader
          title="Documentazione Web API"
          description="Guida completa all'integrazione delle External API di Istanta 2 GDO Suite"
        />

        {/* Content */}
        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">
            <div className="p-5 sm:p-8">
              {/* Intro Section */}
              <div className="mb-10">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    Benvenuto nella Documentazione
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed mb-4">
                    Le External API di Istanta 2 GDO Suite ti permettono di accedere a referenze prodotto,
                    promozioni e file direttamente dal tuo sistema. Puoi integrare i dati tramite
                    chiamate REST dirette oppure utilizzare il Plugin JavaScript per il rendering
                    automatico nel browser.
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
                    Scegli una sezione per iniziare oppure segui la{" "}
                    <Link
                      to="/documentazione/guida-rapida"
                      className="text-primary hover:text-primary/80 font-medium"
                    >
                      Guida Rapida
                    </Link>{" "}
                    per essere operativo in pochi minuti.
                  </p>
                </div>
              </div>

              {/* Sections Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {docSections.map((section) => (
                  <Link
                    key={section.id}
                    to={section.path}
                    className={`
                      group flex flex-col p-6 rounded-xl border-2 transition-all duration-200
                      ${section.bgColor}
                      hover:shadow-lg hover:scale-[1.02]
                    `}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg bg-white dark:bg-darkmode-600 ${section.color}`}>
                        <Lucide icon={section.icon as any} className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {section.title}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                      {section.description}
                    </p>
                    <div className="mt-4 flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
                      Vai alla sezione
                      <Lucide icon="ArrowRight" className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>

              {/* Quick Links */}
              <div className="mt-10 pt-8 border-t border-slate-200 dark:border-darkmode-400">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  Link Rapidi
                </h3>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/gestione-api/keys"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-darkmode-400 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-darkmode-300 transition-colors"
                  >
                    <Lucide icon="Key" className="w-4 h-4" />
                    Gestisci API Keys
                  </Link>
                  <Link
                    to="/gestione-api/plugin"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-darkmode-400 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-darkmode-300 transition-colors"
                  >
                    <Lucide icon="Settings" className="w-4 h-4" />
                    Configura Plugin
                  </Link>
                  <Link
                    to="/gestione-api/statistiche"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-darkmode-400 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-darkmode-300 transition-colors"
                  >
                    <Lucide icon="BarChart3" className="w-4 h-4" />
                    Dashboard Statistiche
                  </Link>
                  <Link
                    to="/gestione-api/test"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-darkmode-400 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-darkmode-300 transition-colors"
                  >
                    <Lucide icon="PlayCircle" className="w-4 h-4" />
                    Test API
                  </Link>
                </div>
              </div>

              {/* Version Info */}
              <div className="mt-8 p-4 rounded-lg bg-slate-50 dark:bg-darkmode-600 border border-slate-200 dark:border-darkmode-400">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Lucide icon="Info" className="w-4 h-4" />
                  <span>
                    API Version: <code className="bg-slate-200 dark:bg-darkmode-400 px-1.5 py-0.5 rounded text-xs font-mono">v1</code>
                    {" "}&bull;{" "}
                    Ultimo aggiornamento: Gennaio 2026
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withSessionCheck(DocumentazioneHubPage);
