import Lucide from "@/components/Base/Lucide";
import { Link } from "react-router-dom";
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
      <span className="text-slate-700 dark:text-slate-200 font-medium">Panoramica Sistema</span>
    </nav>
  );
}

// Diagramma SVG Architettura Autenticazione
function AuthDiagram() {
  return (
    <svg viewBox="0 0 800 400" className="w-full max-w-3xl mx-auto" aria-label="Diagramma architettura autenticazione">
      {/* Background */}
      <rect width="800" height="400" className="fill-slate-50 dark:fill-darkmode-600" rx="8" />

      {/* Server Backend Box */}
      <g>
        <rect x="50" y="60" width="180" height="100" rx="8" className="fill-blue-100 dark:fill-blue-900/30 stroke-blue-500" strokeWidth="2" />
        <text x="140" y="100" textAnchor="middle" className="fill-slate-800 dark:fill-slate-200 text-sm font-semibold">Server</text>
        <text x="140" y="125" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">Backend</text>
        <rect x="90" y="135" width="100" height="20" rx="4" className="fill-blue-500" />
        <text x="140" y="149" textAnchor="middle" className="fill-white text-xs font-medium">Node.js / Python</text>
      </g>

      {/* Browser Plugin Box */}
      <g>
        <rect x="50" y="240" width="180" height="100" rx="8" className="fill-green-100 dark:fill-green-900/30 stroke-green-500" strokeWidth="2" />
        <text x="140" y="280" textAnchor="middle" className="fill-slate-800 dark:fill-slate-200 text-sm font-semibold">Browser</text>
        <text x="140" y="305" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">Plugin FP</text>
        <rect x="90" y="315" width="100" height="20" rx="4" className="fill-green-500" />
        <text x="140" y="329" textAnchor="middle" className="fill-white text-xs font-medium">JavaScript</text>
      </g>

      {/* External API Box */}
      <g>
        <rect x="520" y="120" width="220" height="160" rx="8" className="fill-purple-100 dark:fill-purple-900/30 stroke-purple-500" strokeWidth="2" />
        <text x="630" y="160" textAnchor="middle" className="fill-slate-800 dark:fill-slate-200 text-sm font-semibold">External API</text>
        <text x="630" y="185" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">Istanta 2 GDO Suite</text>

        {/* Endpoints */}
        <rect x="545" y="200" width="70" height="24" rx="4" className="fill-purple-500" />
        <text x="580" y="216" textAnchor="middle" className="fill-white text-xs">/refs</text>

        <rect x="645" y="200" width="70" height="24" rx="4" className="fill-purple-500" />
        <text x="680" y="216" textAnchor="middle" className="fill-white text-xs">/files</text>

        <rect x="595" y="235" width="70" height="24" rx="4" className="fill-purple-500" />
        <text x="630" y="251" textAnchor="middle" className="fill-white text-xs">/promo</text>
      </g>

      {/* Arrow: Server -> API (API Key) */}
      <g>
        <line x1="230" y1="110" x2="510" y2="170" className="stroke-blue-500" strokeWidth="3" markerEnd="url(#arrowBlue)" />
        <rect x="310" y="100" width="120" height="30" rx="4" className="fill-blue-500" />
        <text x="370" y="120" textAnchor="middle" className="fill-white text-xs font-semibold">API Key</text>
        <text x="370" y="85" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">Header: x-api-key</text>
      </g>

      {/* Arrow: Browser -> API (Ephemeral Token) */}
      <g>
        <line x1="230" y1="290" x2="510" y2="230" className="stroke-green-500" strokeWidth="3" markerEnd="url(#arrowGreen)" />
        <rect x="310" y="270" width="120" height="30" rx="4" className="fill-green-500" />
        <text x="370" y="290" textAnchor="middle" className="fill-white text-xs font-semibold">Ephemeral Token</text>
        <text x="370" y="320" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">Automatico (Plugin)</text>
      </g>

      {/* Legend */}
      <g>
        <rect x="50" y="370" width="15" height="15" rx="2" className="fill-blue-500" />
        <text x="75" y="382" className="fill-slate-600 dark:fill-slate-400 text-xs">Server-to-Server (API Key persistente)</text>

        <rect x="350" y="370" width="15" height="15" rx="2" className="fill-green-500" />
        <text x="375" y="382" className="fill-slate-600 dark:fill-slate-400 text-xs">Browser-based (Token temporaneo)</text>
      </g>

      {/* Arrow Markers */}
      <defs>
        <marker id="arrowBlue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" className="fill-blue-500" />
        </marker>
        <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" className="fill-green-500" />
        </marker>
      </defs>
    </svg>
  );
}

// Diagramma SVG Flusso Dati
function DataFlowDiagram() {
  return (
    <svg viewBox="0 0 900 300" className="w-full max-w-4xl mx-auto" aria-label="Diagramma flusso dati">
      {/* Background */}
      <rect width="900" height="300" className="fill-slate-50 dark:fill-darkmode-600" rx="8" />

      {/* Step 1: Request */}
      <g>
        <rect x="30" y="100" width="120" height="80" rx="8" className="fill-blue-100 dark:fill-blue-900/30 stroke-blue-500" strokeWidth="2" />
        <text x="90" y="135" textAnchor="middle" className="fill-slate-800 dark:fill-slate-200 text-sm font-semibold">Request</text>
        <text x="90" y="155" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">Client/Plugin</text>
        <circle cx="90" cy="50" r="20" className="fill-blue-500" />
        <text x="90" y="55" textAnchor="middle" className="fill-white text-sm font-bold">1</text>
      </g>

      {/* Arrow 1->2 */}
      <line x1="150" y1="140" x2="195" y2="140" className="stroke-slate-400" strokeWidth="2" markerEnd="url(#arrowGray)" />

      {/* Step 2: Filter Templates */}
      <g>
        <rect x="200" y="100" width="140" height="80" rx="8" className="fill-amber-100 dark:fill-amber-900/30 stroke-amber-500" strokeWidth="2" />
        <text x="270" y="135" textAnchor="middle" className="fill-slate-800 dark:fill-slate-200 text-sm font-semibold">Filter Templates</text>
        <text x="270" y="155" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">Configurazione Slug</text>
        <circle cx="270" cy="50" r="20" className="fill-amber-500" />
        <text x="270" y="55" textAnchor="middle" className="fill-white text-sm font-bold">2</text>
      </g>

      {/* Arrow 2->3 */}
      <line x1="340" y1="140" x2="385" y2="140" className="stroke-slate-400" strokeWidth="2" markerEnd="url(#arrowGray)" />

      {/* Step 3: Database */}
      <g>
        <rect x="390" y="100" width="120" height="80" rx="8" className="fill-purple-100 dark:fill-purple-900/30 stroke-purple-500" strokeWidth="2" />
        <text x="450" y="135" textAnchor="middle" className="fill-slate-800 dark:fill-slate-200 text-sm font-semibold">Database</text>
        <text x="450" y="155" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">PostgreSQL</text>
        <circle cx="450" cy="50" r="20" className="fill-purple-500" />
        <text x="450" y="55" textAnchor="middle" className="fill-white text-sm font-bold">3</text>
      </g>

      {/* Arrow 3->4 */}
      <line x1="510" y1="140" x2="555" y2="140" className="stroke-slate-400" strokeWidth="2" markerEnd="url(#arrowGray)" />

      {/* Step 4: Response */}
      <g>
        <rect x="560" y="100" width="120" height="80" rx="8" className="fill-green-100 dark:fill-green-900/30 stroke-green-500" strokeWidth="2" />
        <text x="620" y="135" textAnchor="middle" className="fill-slate-800 dark:fill-slate-200 text-sm font-semibold">Response</text>
        <text x="620" y="155" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">JSON / HTML</text>
        <circle cx="620" cy="50" r="20" className="fill-green-500" />
        <text x="620" y="55" textAnchor="middle" className="fill-white text-sm font-bold">4</text>
      </g>

      {/* Statistics Branch */}
      <g>
        <line x1="450" y1="180" x2="450" y2="220" className="stroke-red-400 stroke-dasharray-4" strokeWidth="2" />
        <line x1="450" y1="220" x2="750" y2="220" className="stroke-red-400 stroke-dasharray-4" strokeWidth="2" />
        <line x1="750" y1="220" x2="750" y2="180" className="stroke-red-400 stroke-dasharray-4" strokeWidth="2" markerEnd="url(#arrowRed)" />

        <rect x="710" y="100" width="140" height="80" rx="8" className="fill-red-100 dark:fill-red-900/30 stroke-red-500" strokeWidth="2" />
        <text x="780" y="130" textAnchor="middle" className="fill-slate-800 dark:fill-slate-200 text-sm font-semibold">Statistiche</text>
        <text x="780" y="150" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">Async Recording</text>
        <text x="780" y="165" textAnchor="middle" className="fill-slate-600 dark:fill-slate-400 text-xs">(OS Detection)</text>

        <text x="600" y="240" textAnchor="middle" className="fill-red-500 dark:fill-red-400 text-xs italic">raccolta asincrona</text>
      </g>

      {/* Arrow Markers */}
      <defs>
        <marker id="arrowGray" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" className="fill-slate-400" />
        </marker>
        <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" className="fill-red-400" />
        </marker>
      </defs>
    </svg>
  );
}

// Glossario Item
function GlossaryItem({ term, definition }: { term: string; definition: string }) {
  return (
    <div className="border-b border-slate-100 dark:border-darkmode-400 py-3 last:border-b-0">
      <dt className="font-semibold text-slate-900 dark:text-slate-100">{term}</dt>
      <dd className="mt-1 text-slate-600 dark:text-slate-300 text-sm">{definition}</dd>
    </div>
  );
}

function DocumentazioneOverviewPage() {
  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* Header */}
        <PageHeader
          title="Panoramica Sistema"
          description="Architettura e concetti chiave delle External API"
        />

        {/* Content */}
        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">
            <div className="p-5 sm:p-8">
              {/* Breadcrumb */}
              <DocsBreadcrumb />

              {/* Introduzione */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Info" className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Introduzione al Sistema
                  </h2>
                </div>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    Le <strong>External API</strong> di Istanta 2 GDO Suite forniscono accesso programmatico
                    ai dati delle promozioni, referenze prodotto e file generati. Il sistema supporta
                    due modalità di autenticazione per coprire diversi scenari di integrazione:
                  </p>
                  <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <Lucide icon="Server" className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                      <span><strong>Server-to-Server</strong>: Usa API Key per integrazioni backend sicure</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Globe" className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>Browser-based</strong>: Usa Ephemeral Token per il Plugin JavaScript</span>
                    </li>
                  </ul>
                </div>
              </section>

              {/* Architettura Autenticazione */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Shield" className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Architettura Autenticazione
                  </h2>
                </div>
                <div className="box p-6 mb-6">
                  <AuthDiagram />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="box p-5 border-l-4 border-blue-500">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <Lucide icon="Key" className="w-5 h-5 text-blue-500" />
                      API Key
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                      Chiave persistente per integrazioni server-to-server. Fornisce accesso
                      completo a tutti gli endpoint e non scade automaticamente.
                    </p>
                    <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                      <li>Header: <code className="bg-slate-100 dark:bg-darkmode-400 px-1.5 py-0.5 rounded text-xs">x-api-key</code></li>
                      <li>Uso: Backend, script, automazioni</li>
                      <li>Gestione: <Link to="/gestione-api/keys" className="text-primary hover:underline">Pannello API Keys</Link></li>
                    </ul>
                  </div>
                  <div className="box p-5 border-l-4 border-green-500">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <Lucide icon="Clock" className="w-5 h-5 text-green-500" />
                      Ephemeral Token
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                      Token temporaneo generato automaticamente dal Plugin JavaScript.
                      Scade dopo un breve periodo e viene rinnovato automaticamente.
                    </p>
                    <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                      <li>Gestito automaticamente dal Plugin FP</li>
                      <li>Uso: Siti web, applicazioni browser</li>
                      <li>Docs: <Link to="/documentazione/plugin" className="text-primary hover:underline">Plugin JavaScript</Link></li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Flusso Dati */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Workflow" className="w-6 h-6 text-pending" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Flusso dei Dati
                  </h2>
                </div>
                <div className="box p-6 mb-6">
                  <DataFlowDiagram />
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">1</div>
                    <h5 className="font-medium text-slate-900 dark:text-slate-100">Request</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Il client invia una richiesta autenticata</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">2</div>
                    <h5 className="font-medium text-slate-900 dark:text-slate-100">Filter Templates</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">I filtri slug-based vengono applicati</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">3</div>
                    <h5 className="font-medium text-slate-900 dark:text-slate-100">Database</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Query ottimizzata su PostgreSQL</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">4</div>
                    <h5 className="font-medium text-slate-900 dark:text-slate-100">Response</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dati JSON o HTML pre-renderizzato</p>
                  </div>
                </div>
              </section>

              {/* Glossario */}
              <section className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="BookA" className="w-6 h-6 text-info" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Glossario
                  </h2>
                </div>
                <div className="box p-6">
                  <dl className="divide-y divide-slate-100 dark:divide-darkmode-400">
                    <GlossaryItem
                      term="Referenza"
                      definition="Un prodotto all'interno di una promozione, con i suoi dati compilati (nome, prezzo, foto, meccanica)."
                    />
                    <GlossaryItem
                      term="Template Kit"
                      definition="Un layout predefinito che definisce come le referenze vengono visualizzate (es. griglia prodotti, lista offerte)."
                    />
                    <GlossaryItem
                      term="Promozione"
                      definition="Un contenitore temporale che raggruppa kit e referenze con date di validità."
                    />
                    <GlossaryItem
                      term="Filter Template"
                      definition="Una configurazione salvata di filtri e opzioni di visualizzazione, accessibile tramite uno slug univoco."
                    />
                    <GlossaryItem
                      term="Slug"
                      definition="Identificatore URL-safe (es. 'promo-estate-2024') usato per accedere ai Filter Templates senza esporre ID interni."
                    />
                    <GlossaryItem
                      term="Ephemeral Token"
                      definition="Token di accesso temporaneo generato dal sistema per autenticare richieste browser-based in modo sicuro."
                    />
                    <GlossaryItem
                      term="Export Code"
                      definition="Codice che identifica un tipo di file esportato (es. 'POP', 'PDF', 'JPG') dal sistema di rendering."
                    />
                  </dl>
                </div>
              </section>

              {/* Prossimi Passi */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="ArrowRight" className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Prossimi Passi
                  </h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Link
                    to="/documentazione/guida-rapida"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Lucide icon="Rocket" className="w-8 h-8 text-success" />
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">Guida Rapida</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Inizia in pochi minuti</p>
                      </div>
                    </div>
                  </Link>
                  <Link
                    to="/documentazione/api"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Lucide icon="Code" className="w-8 h-8 text-info" />
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">API Reference</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Esplora gli endpoint</p>
                      </div>
                    </div>
                  </Link>
                  <Link
                    to="/documentazione/plugin"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Lucide icon="Package" className="w-8 h-8 text-warning" />
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">Plugin JavaScript</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Integra nel browser</p>
                      </div>
                    </div>
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentazioneOverviewPage;
