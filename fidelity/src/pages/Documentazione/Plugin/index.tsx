import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { Link } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import PageHeader from "../../../components/Base/PageHeader";

// Componente Breadcrumb per navigazione
function DocsBreadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
      <Link to="/documentazione" className="hover:text-primary flex items-center gap-1">
        <Lucide icon="BookOpen" className="w-4 h-4" />
        Documentazione
      </Link>
      <Lucide icon="ChevronRight" className="w-4 h-4" />
      <span className="text-slate-700 dark:text-slate-200 font-medium">Plugin JavaScript</span>
    </nav>
  );
}

function DocumentazionePluginPage() {
  const baseUrl = ServerCall.getUrl();

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* Header */}
        <PageHeader
          title="Documentazione Plugin"
          description="Guida all'integrazione del Plugin JavaScript FP"
        />
        {/* Content */}
        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">
            <div className="p-5">
              {/* Breadcrumb */}
              <DocsBreadcrumb />

              {/* Introduzione */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Package" className="w-6 h-6 text-info" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Plugin JavaScript (FP)</h2>
                </div>
                <div className="box p-6">
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Il plugin FP permette di integrare facilmente i contenuti di Istanta 2 GDO Suite nel tuo sito web.
                    Il plugin gestisce automaticamente l'autenticazione tramite <strong>Ephemeral Token</strong> e il rendering dei contenuti.
                  </p>
                  <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Lucide icon="Info" className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Architettura Slug-Based</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Il plugin richiede obbligatoriamente uno <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">slug</code> per
                      caricare la configurazione dal server. La configurazione (tipo layout, modalità, filtri, ecc.) viene definita tramite
                      i <Link to="/documentazione/filter-templates" className="text-primary hover:underline">Filter Templates</Link>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Installazione */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Download" className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Installazione</h2>
                </div>
                <div className="box p-6 space-y-4">
                  <div className="border border-slate-200 dark:border-darkmode-400 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 dark:bg-darkmode-400 px-4 py-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">Browser (IIFE)</span>
                    </div>
                    <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
                      <code className="text-sm font-mono">{`<script src="https://cdn.istn.it/1.0.0/index.global.js"></script>`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              {/* Utilizzo Base */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Code" className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Utilizzo Base</h2>
                </div>
                <div className="box p-6">
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    L'inizializzazione richiede solo <strong>url</strong>, <strong>container</strong> e <strong>slug</strong>.
                    Tutte le altre impostazioni vengono caricate automaticamente dal Filter Template associato allo slug.
                  </p>
                  <div className="border border-slate-200 dark:border-darkmode-400 rounded-lg overflow-hidden">
                    <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
                      <code className="text-sm font-mono">{`// 1. Crea istanza del plugin
const fp = new FP();

// 2. Inizializza con lo slug (OBBLIGATORIO)
await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024'  // Lo slug del Filter Template
});

// 3. Renderizza i contenuti
await fp.render();`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              {/* FPOptions - Opzioni di Inizializzazione */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Settings" className="w-6 h-6 text-info" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">FPOptions - Opzioni di Inizializzazione</h2>
                </div>
                <div className="box p-6">
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Queste sono le opzioni che puoi passare al metodo <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">init()</code>.
                  </p>
                  <div className="p-4 border border-warning/40 bg-warning/5 rounded-lg text-sm text-slate-600 dark:text-slate-300 space-y-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Suggerimento</p>
                    <p>
                      Se la query non restituisce referenze e desideri nascondere elementi non necessari, puoi aggiungere agli elementi interessati
                      un attributo personalizzato composto da <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">fp-</code> seguito dallo slug.
                      Ad esempio <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">fp-test-of</code> farà sì che l’elemento venga nascosto
                      automaticamente quando non sono disponibili dati per quello slug.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-darkmode-400">
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Opzione</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Tipo</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Richiesto</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Descrizione</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">url</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-danger/10 text-danger">Sì</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">URL base del server API</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">container</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">HTMLDivElement</td>
                          <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-danger/10 text-danger">Sì</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Elemento DOM in cui renderizzare</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">slug</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-danger/10 text-danger">Sì</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Slug del Filter Template da caricare</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">version</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-slate-100 dark:bg-darkmode-400 text-slate-600 dark:text-slate-300">No</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Versione del plugin (default: '1.0.0')</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">templateVersion</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">number</td>
                          <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-slate-100 dark:bg-darkmode-400 text-slate-600 dark:text-slate-300">No</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Versione specifica del template da caricare</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">styles</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">FPStyles</td>
                          <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-slate-100 dark:bg-darkmode-400 text-slate-600 dark:text-slate-300">No</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Opzioni di stile personalizzate</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">classNames</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">FPClassNames</td>
                          <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-slate-100 dark:bg-darkmode-400 text-slate-600 dark:text-slate-300">No</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Classi CSS custom</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">shadowStyles</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string[]</td>
                          <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-slate-100 dark:bg-darkmode-400 text-slate-600 dark:text-slate-300">No</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">URL di stylesheet aggiuntivi da caricare nel Shadow DOM</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">shadowStyles</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string[]</td>
                          <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-slate-100 dark:bg-darkmode-400 text-slate-600 dark:text-slate-300">No</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">URL di stylesheet aggiuntivi da caricare nel Shadow DOM</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">responsive</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">{`Record<number, Partial<FPStyles>>`}</td>
                          <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-slate-100 dark:bg-darkmode-400 text-slate-600 dark:text-slate-300">No</span></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">
                            Mappa di breakpoint (in px) a configurazioni parziali di stile. Ogni voce sovrascrive dinamicamente le opzioni di
                            <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-0.5 rounded font-mono ml-1">styles</code> quando la viewport è minore o uguale al breakpoint.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* FpOptionsQuery - Configurazione dal Server */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Server" className="w-6 h-6 text-warning" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">FpOptionsQuery - Configurazione dal Server</h2>
                </div>
                <div className="box p-6">
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Queste opzioni vengono caricate automaticamente dal Filter Template tramite lo slug.
                    Puoi accedervi in sola lettura tramite <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">fp.optionsQuery</code>.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-darkmode-400">
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Proprietà</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Tipo</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Descrizione</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">type</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'grid' | 'carousel' | 'list'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Tipologia di rendering</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">mode</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'refs' | 'refs-html' | 'files'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Modalità di fetch dati</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">filters</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">FilterCondition[][]</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Filtri avanzati per le query</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">tipo_export</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string[]</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Tipi di export da filtrare (solo per mode: 'files')</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">template_id</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string[]</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Template ID da caricare (solo per mode: 'refs' e 'refs-html')</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">autoScroll</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">boolean</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Abilita auto-scroll per carousel (default: true)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">scrollSpeed</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">number</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Velocità auto-scroll in ms (default: 5000)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">showIndicators</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">boolean</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Mostra indicatori carousel (default: true)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">showNavButtons</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">boolean</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Mostra bottoni navigazione carousel (default: true)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* FPStyles - Opzioni di Stile */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Palette" className="w-6 h-6 text-pending" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">FPStyles - Opzioni di Stile</h2>
                </div>
                <div className="box p-6">
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Opzioni per personalizzare l'aspetto del plugin.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-darkmode-400">
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Proprietà</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Tipo</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Default</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Descrizione</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">gap</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'12px'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Gap tra elementi</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">scale</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">number</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">1</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Scala elementi</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">maxWidth</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'100%'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Larghezza massima</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">padding</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'16px'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Padding interno</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">grid</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">FPGridStyles</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">-</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Opzioni specifiche per griglia</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">carousel</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">FPCarouselStyles</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">-</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Opzioni specifiche per carousel</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">responsive</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">{`{ [breakpoint: number]: Partial<FPStyles> }`}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">-</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Breakpoint responsive</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* FPGridStyles */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="LayoutGrid" className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">FPGridStyles - Opzioni Griglia</h2>
                </div>
                <div className="box p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-darkmode-400">
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Proprietà</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Tipo</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Default</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Descrizione</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">columns</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string | number</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'auto-fill'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Numero colonne o 'auto-fill'</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">minItemWidth</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'280px'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Larghezza minima item</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">maxItems</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">number</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">0 (nessun limite)</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Massimo numero di items visibili</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">itemHeight</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'auto'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Altezza item</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* FPCarouselStyles */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="GalleryHorizontal" className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">FPCarouselStyles - Opzioni Carousel</h2>
                </div>
                <div className="box p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-darkmode-400">
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Proprietà</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Tipo</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Default</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Descrizione</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">itemWidth</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'280px'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Larghezza item</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">itemMaxWidth</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'400px'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Larghezza massima item</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">snapAlign</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'start' | 'center' | 'end'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'start'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Allineamento snap</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">scrollBehavior</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'smooth' | 'auto'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'smooth'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Comportamento scroll</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">transitionDuration</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'0.4s'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Durata transizione</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">indicatorColor</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'rgba(0, 0, 0, 0.3)'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Colore indicatori</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">indicatorActiveColor</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'rgba(0, 0, 0, 0.7)'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Colore indicatore attivo</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">navSize</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'40px'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Dimensione bottoni navigazione</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">navBg</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'rgba(255, 255, 255, 0.9)'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Background bottoni navigazione</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">navBgHover</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'#fff'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Background bottoni hover</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">navColor</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'rgba(0, 0, 0, 0.6)'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Colore icone navigazione</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* FPClassNames */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Hash" className="w-6 h-6 text-info" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">FPClassNames - Classi CSS Custom</h2>
                </div>
                <div className="box p-6">
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Permette di personalizzare le classi CSS degli elementi principali.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-darkmode-400">
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Proprietà</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Default</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Descrizione</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">refsRoot</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'fp-refs-root'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Classe per il root container</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">refsWrapper</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'fp-refs-wrapper'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Classe per il wrapper degli items</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">refItem</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">'fp-ref-item'</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Classe per ogni singolo item</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Metodi Pubblici */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Zap" className="w-6 h-6 text-warning" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Metodi Pubblici</h2>
                </div>
                <div className="box p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-darkmode-400">
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Metodo</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Descrizione</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3">
                            <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">init(options: FPOptions)</code>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Inizializza il plugin con le opzioni fornite (chiamabile una sola volta)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3">
                            <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">render()</code>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Carica e renderizza i contenuti (chiamabile multiple volte)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3">
                            <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">setOptions(options: Partial&lt;FPOptions&gt;)</code>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Aggiorna parzialmente le opzioni di stile del plugin</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3">
                            <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">isReady()</code>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Verifica se il plugin è inizializzato (returns boolean)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3">
                            <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">destroy()</code>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Pulisce il container e resetta lo stato del plugin</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3">
                            <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">reloadCss()</code>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Ricarica il CSS dal server</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3">
                            <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">getCss()</code>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Ottiene il CSS come stringa (returns Promise&lt;string&gt;)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3">
                            <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">optionsQuery</code>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Getter per le opzioni caricate dal server (read-only)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Esempi Avanzati */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Sparkles" className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Esempi Avanzati</h2>
                </div>
                <div className="box p-6">
                  <Tab.Group>
                    <Tab.List variant="boxed-tabs" className="mb-4">
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          Con Stili Custom
                        </Tab.Button>
                      </Tab>
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          Responsive
                        </Tab.Button>
                      </Tab>
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          Versione Template
                        </Tab.Button>
                      </Tab>
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          Shadow Styles
                        </Tab.Button>
                      </Tab>
                    </Tab.List>
                    <Tab.Panels className="mt-5">
                      <Tab.Panel className="leading-relaxed">
                        <div className="border border-slate-200 dark:border-darkmode-400 rounded-lg overflow-hidden">
                          <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
                            <code className="text-sm font-mono">{`const fp = new FP();

await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024',
  styles: {
    gap: '16px',
    padding: '24px',
    maxWidth: '1200px',
    grid: {
      columns: 4,
      minItemWidth: '250px',
      maxItems: 12
    },
    carousel: {
      itemWidth: '300px',
      navSize: '48px',
      indicatorActiveColor: '#3b82f6'
    }
  }
});

await fp.render();`}</code>
                          </pre>
                        </div>
                      </Tab.Panel>
                      <Tab.Panel className="leading-relaxed">
                        <div className="border border-slate-200 dark:border-darkmode-400 rounded-lg overflow-hidden">
                          <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
                            <code className="text-sm font-mono">{`const fp = new FP();

await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024',
  styles: {
    gap: '16px',
    grid: {
      columns: 'auto-fill',
      minItemWidth: '300px',
      maxItems: 12
    },
    responsive: {
      // Sotto 1024px
      1024: {
        gap: '12px',
        grid: { maxItems: 8, minItemWidth: '250px' }
      },
      // Sotto 768px
      768: {
        gap: '8px',
        padding: '12px',
        grid: { maxItems: 6, minItemWidth: '200px' }
      },
      // Sotto 480px
      480: {
        gap: '6px',
        padding: '8px',
        grid: { maxItems: 4, minItemWidth: '150px' }
      }
    }
  }
});

await fp.render();`}</code>
                          </pre>
                        </div>
                      </Tab.Panel>
                      <Tab.Panel className="leading-relaxed">
                        <div className="border border-slate-200 dark:border-darkmode-400 rounded-lg overflow-hidden">
                          <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
                            <code className="text-sm font-mono">{`const fp = new FP();

// Carica una versione specifica del template
await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024',
  templateVersion: 3  // Carica la versione 3 del template
});

await fp.render();

// Puoi accedere alla configurazione caricata
console.log(fp.optionsQuery);
// {
//   type: 'grid',
//   mode: 'refs-html',
//   template_id: ['TEMPLATE_001'],
//   autoScroll: true,
//   ...
// }`}</code>
                          </pre>
                        </div>
                      </Tab.Panel>
                      <Tab.Panel className="leading-relaxed">
                        <div className="border border-slate-200 dark:border-darkmode-400 rounded-lg overflow-hidden">
                          <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
                            <code className="text-sm font-mono">{`const fp = new FP();

// Carica CSS aggiuntivi nel Shadow DOM
await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024',
  shadowStyles: [
    'https://mysite.com/custom-plugin-styles.css',
    'https://mysite.com/fonts.css'
  ],
  classNames: {
    refsRoot: 'my-refs-root',
    refsWrapper: 'my-refs-wrapper',
    refItem: 'my-ref-item'
  }
});

await fp.render();`}</code>
                          </pre>
                        </div>
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>
                </div>
              </div>

              {/* Note Importanti */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="TriangleAlert" className="w-6 h-6 text-danger" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Note Importanti</h2>
                </div>
                <div className="box p-6">
                  <ul className="space-y-3 text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span>Lo <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">slug</code> è <strong>obbligatorio</strong> e deve corrispondere a un Filter Template esistente</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span>Le opzioni <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">type</code>, <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">mode</code>, <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">filters</code>, ecc. vengono caricate automaticamente dal Filter Template</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span>Il metodo <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">init()</code> può essere chiamato una sola volta per istanza</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span>Usa <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">setOptions()</code> per aggiornare solo le opzioni di stile dopo l'inizializzazione</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span>Il rendering utilizza Shadow DOM per isolare gli stili CSS dal resto della pagina</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span>L'autenticazione con Ephemeral Token è gestita automaticamente dal plugin</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span>Ricorda di chiamare <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">destroy()</code> quando rimuovi il componente per evitare memory leaks</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span>Le opzioni <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">optionsQuery</code> sono in sola lettura e non possono essere modificate dopo l'inizializzazione</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentazionePluginPage;
