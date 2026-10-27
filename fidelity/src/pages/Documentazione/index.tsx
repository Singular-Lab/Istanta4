import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import withSessionCheck from "@/components/SessionChecker";
import { Link } from "react-router-dom";
import { twMerge } from "@/utils/twMerge";

interface DocSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  /** Colore dell'icona. */
  color: string;
  /** Sfondo della tessera dell'icona. */
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
    bgColor: "bg-primary/10",
  },
  {
    id: "guida-rapida",
    title: "Guida Rapida",
    description: "Inizia subito con una guida step-by-step per integrare l'API nel tuo progetto",
    icon: "Rocket",
    path: "/documentazione/guida-rapida",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    id: "api",
    title: "API REST",
    description: "Reference completa degli endpoint, parametri, esempi di codice e test interattivi",
    icon: "Code",
    path: "/documentazione/api",
    color: "text-info",
    bgColor: "bg-info/10",
  },
  {
    id: "plugin",
    title: "Plugin JavaScript",
    description: "Integra i contenuti nel browser con il plugin FP: installazione, metodi e configurazione",
    icon: "Package",
    path: "/documentazione/plugin",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    id: "filter-templates",
    title: "Template Filtri",
    description: "Crea e gestisci configurazioni riutilizzabili con il sistema slug-based",
    icon: "Filter",
    path: "/documentazione/filter-templates",
    color: "text-pending",
    bgColor: "bg-pending/10",
  },
  {
    id: "statistiche",
    title: "Statistiche & Monitoring",
    description: "Monitora le chiamate API, analizza i sistemi operativi e esporta i dati",
    icon: "BarChart3",
    path: "/documentazione/statistiche",
    color: "text-danger",
    bgColor: "bg-danger/10",
  },
];

const linkRapidi = [
  { to: "/gestione-api/keys", icon: "Key", label: "Gestisci API Keys" },
  { to: "/gestione-api/plugin", icon: "Settings", label: "Configura Plugin" },
  { to: "/gestione-api/statistiche", icon: "BarChart3", label: "Dashboard Statistiche" },
  { to: "/gestione-api/test", icon: "PlayCircle", label: "Test API" },
];

function DocumentazioneHubPage() {
  return (
    <Pagina
      titolo="Documentazione Web API"
      descrizione="Guida completa all'integrazione delle External API di Istanta 2 GDO Suite"
    >
      <Sezione titolo="Benvenuto nella Documentazione">
        <div className="flex flex-col gap-8">
          {/* Intro */}
          <div className="max-w-3xl space-y-4 leading-relaxed text-slate-600">
            <p>
              Le External API di Istanta 2 GDO Suite ti permettono di accedere a referenze prodotto,
              promozioni e file direttamente dal tuo sistema. Puoi integrare i dati tramite
              chiamate REST dirette oppure utilizzare il Plugin JavaScript per il rendering
              automatico nel browser.
            </p>
            <p>
              Scegli una sezione per iniziare oppure segui la{" "}
              <Link to="/documentazione/guida-rapida" className="font-medium text-primary hover:text-primary/80">
                Guida Rapida
              </Link>{" "}
              per essere operativo in pochi minuti.
            </p>
          </div>

          {/* Sezioni della documentazione */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docSections.map((section) => (
              <Link
                key={section.id}
                to={section.path}
                className="group flex flex-col rounded-card border border-slate-200 bg-white p-4 transition-colors hover:border-primary/40 hover:shadow-card"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className={twMerge("flex-none rounded-control p-2", section.bgColor, section.color)}>
                    <Lucide icon={section.icon} aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <h3 className="title-card">{section.title}</h3>
                </div>
                <p className="flex-1 text-sm leading-relaxed text-slate-600">{section.description}</p>
                <div className="mt-4 flex items-center text-sm font-medium text-slate-500 group-hover:text-slate-700">
                  Vai alla sezione
                  <Lucide
                    icon="ArrowRight"
                    aria-hidden="true"
                    className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
                  />
                </div>
              </Link>
            ))}
          </div>

          {/* Link rapidi */}
          <div className="border-t border-dashed border-slate-200 pt-6">
            <h3 className="title-card mb-4">Link Rapidi</h3>
            <div className="flex flex-wrap gap-2">
              {linkRapidi.map((link) => (
                <Button key={link.to} as={Link} to={link.to} variant="outline-secondary">
                  <Lucide icon={link.icon} aria-hidden="true" className="mr-2 h-4 w-4" />
                  {link.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Versione */}
          <div className="flex items-center gap-2 rounded-card border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            <Lucide icon="Info" aria-hidden="true" className="h-4 w-4 flex-none" />
            <span>
              API Version: <code className="rounded-control bg-slate-200 px-1.5 py-0.5 font-mono text-xs">v1</code>
              {" "}&bull;{" "}
              Ultimo aggiornamento: Gennaio 2026
            </span>
          </div>
        </div>
      </Sezione>
    </Pagina>
  );
}

export default withSessionCheck(DocumentazioneHubPage);
