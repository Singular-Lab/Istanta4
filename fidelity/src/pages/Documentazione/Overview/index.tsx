import Lucide from "@/components/Base/Lucide";
import { Link } from "react-router-dom";
import { DocsCapitolo, DocsCard, DocsCollegamento, DocsGuida } from "../DocsCondivisi";

// Diagramma SVG Architettura Autenticazione
function AuthDiagram() {
  return (
    <svg viewBox="0 0 800 400" className="w-full max-w-3xl mx-auto" aria-label="Diagramma architettura autenticazione">
      {/* Background */}
      <rect width="800" height="400" className="fill-slate-50" rx="8" />

      {/* Server Backend Box */}
      <g>
        <rect x="50" y="60" width="180" height="100" rx="8" className="fill-blue-100 stroke-blue-500" strokeWidth="2" />
        <text x="140" y="100" textAnchor="middle" className="fill-slate-800 text-sm font-semibold">Server</text>
        <text x="140" y="125" textAnchor="middle" className="fill-slate-600 text-xs">Backend</text>
        <rect x="90" y="135" width="100" height="20" rx="4" className="fill-blue-500" />
        <text x="140" y="149" textAnchor="middle" className="fill-white text-xs font-medium">Node.js / Python</text>
      </g>

      {/* Browser Plugin Box */}
      <g>
        <rect x="50" y="240" width="180" height="100" rx="8" className="fill-green-100 stroke-green-500" strokeWidth="2" />
        <text x="140" y="280" textAnchor="middle" className="fill-slate-800 text-sm font-semibold">Browser</text>
        <text x="140" y="305" textAnchor="middle" className="fill-slate-600 text-xs">Plugin FP</text>
        <rect x="90" y="315" width="100" height="20" rx="4" className="fill-green-500" />
        <text x="140" y="329" textAnchor="middle" className="fill-white text-xs font-medium">JavaScript</text>
      </g>

      {/* External API Box */}
      <g>
        <rect x="520" y="120" width="220" height="160" rx="8" className="fill-purple-100 stroke-purple-500" strokeWidth="2" />
        <text x="630" y="160" textAnchor="middle" className="fill-slate-800 text-sm font-semibold">External API</text>
        <text x="630" y="185" textAnchor="middle" className="fill-slate-600 text-xs">Istanta 2 GDO Suite</text>

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
        <text x="370" y="85" textAnchor="middle" className="fill-slate-600 text-xs">Header: x-api-key</text>
      </g>

      {/* Arrow: Browser -> API (Ephemeral Token) */}
      <g>
        <line x1="230" y1="290" x2="510" y2="230" className="stroke-green-500" strokeWidth="3" markerEnd="url(#arrowGreen)" />
        <rect x="310" y="270" width="120" height="30" rx="4" className="fill-green-500" />
        <text x="370" y="290" textAnchor="middle" className="fill-white text-xs font-semibold">Ephemeral Token</text>
        <text x="370" y="320" textAnchor="middle" className="fill-slate-600 text-xs">Automatico (Plugin)</text>
      </g>

      {/* Legend */}
      <g>
        <rect x="50" y="370" width="15" height="15" rx="2" className="fill-blue-500" />
        <text x="75" y="382" className="fill-slate-600 text-xs">Server-to-Server (API Key persistente)</text>

        <rect x="350" y="370" width="15" height="15" rx="2" className="fill-green-500" />
        <text x="375" y="382" className="fill-slate-600 text-xs">Browser-based (Token temporaneo)</text>
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
      <rect width="900" height="300" className="fill-slate-50" rx="8" />

      {/* Step 1: Request */}
      <g>
        <rect x="30" y="100" width="120" height="80" rx="8" className="fill-blue-100 stroke-blue-500" strokeWidth="2" />
        <text x="90" y="135" textAnchor="middle" className="fill-slate-800 text-sm font-semibold">Request</text>
        <text x="90" y="155" textAnchor="middle" className="fill-slate-600 text-xs">Client/Plugin</text>
        <circle cx="90" cy="50" r="20" className="fill-blue-500" />
        <text x="90" y="55" textAnchor="middle" className="fill-white text-sm font-bold">1</text>
      </g>

      {/* Arrow 1->2 */}
      <line x1="150" y1="140" x2="195" y2="140" className="stroke-slate-400" strokeWidth="2" markerEnd="url(#arrowGray)" />

      {/* Step 2: Filter Templates */}
      <g>
        <rect x="200" y="100" width="140" height="80" rx="8" className="fill-amber-100 stroke-amber-500" strokeWidth="2" />
        <text x="270" y="135" textAnchor="middle" className="fill-slate-800 text-sm font-semibold">Filter Templates</text>
        <text x="270" y="155" textAnchor="middle" className="fill-slate-600 text-xs">Configurazione Slug</text>
        <circle cx="270" cy="50" r="20" className="fill-amber-500" />
        <text x="270" y="55" textAnchor="middle" className="fill-white text-sm font-bold">2</text>
      </g>

      {/* Arrow 2->3 */}
      <line x1="340" y1="140" x2="385" y2="140" className="stroke-slate-400" strokeWidth="2" markerEnd="url(#arrowGray)" />

      {/* Step 3: Database */}
      <g>
        <rect x="390" y="100" width="120" height="80" rx="8" className="fill-purple-100 stroke-purple-500" strokeWidth="2" />
        <text x="450" y="135" textAnchor="middle" className="fill-slate-800 text-sm font-semibold">Database</text>
        <text x="450" y="155" textAnchor="middle" className="fill-slate-600 text-xs">PostgreSQL</text>
        <circle cx="450" cy="50" r="20" className="fill-purple-500" />
        <text x="450" y="55" textAnchor="middle" className="fill-white text-sm font-bold">3</text>
      </g>

      {/* Arrow 3->4 */}
      <line x1="510" y1="140" x2="555" y2="140" className="stroke-slate-400" strokeWidth="2" markerEnd="url(#arrowGray)" />

      {/* Step 4: Response */}
      <g>
        <rect x="560" y="100" width="120" height="80" rx="8" className="fill-green-100 stroke-green-500" strokeWidth="2" />
        <text x="620" y="135" textAnchor="middle" className="fill-slate-800 text-sm font-semibold">Response</text>
        <text x="620" y="155" textAnchor="middle" className="fill-slate-600 text-xs">JSON / HTML</text>
        <circle cx="620" cy="50" r="20" className="fill-green-500" />
        <text x="620" y="55" textAnchor="middle" className="fill-white text-sm font-bold">4</text>
      </g>

      {/* Statistics Branch */}
      <g>
        <line x1="450" y1="180" x2="450" y2="220" className="stroke-red-400 stroke-dasharray-4" strokeWidth="2" />
        <line x1="450" y1="220" x2="750" y2="220" className="stroke-red-400 stroke-dasharray-4" strokeWidth="2" />
        <line x1="750" y1="220" x2="750" y2="180" className="stroke-red-400 stroke-dasharray-4" strokeWidth="2" markerEnd="url(#arrowRed)" />

        <rect x="710" y="100" width="140" height="80" rx="8" className="fill-red-100 stroke-red-500" strokeWidth="2" />
        <text x="780" y="130" textAnchor="middle" className="fill-slate-800 text-sm font-semibold">Statistiche</text>
        <text x="780" y="150" textAnchor="middle" className="fill-slate-600 text-xs">Async Recording</text>
        <text x="780" y="165" textAnchor="middle" className="fill-slate-600 text-xs">(OS Detection)</text>

        <text x="600" y="240" textAnchor="middle" className="fill-red-500 text-xs italic">raccolta asincrona</text>
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

// Passi del flusso dati, numerati come nel diagramma
const passiFlusso = [
  { titolo: "Request", descrizione: "Il client invia una richiesta autenticata", colore: "bg-info" },
  { titolo: "Filter Templates", descrizione: "I filtri slug-based vengono applicati", colore: "bg-warning" },
  { titolo: "Database", descrizione: "Query ottimizzata su PostgreSQL", colore: "bg-primary" },
  { titolo: "Response", descrizione: "Dati JSON o HTML pre-renderizzato", colore: "bg-success" },
];

// Glossario Item
function GlossaryItem({ term, definition }: { term: string; definition: string }) {
  return (
    <div className="py-3">
      <dt className="font-semibold text-slate-800">{term}</dt>
      <dd className="mt-1 text-sm text-slate-600">{definition}</dd>
    </div>
  );
}

function DocumentazioneOverviewPage() {
  return (
    <DocsGuida
      titolo="Panoramica Sistema"
      descrizione="Architettura e concetti chiave delle External API"
      corrente="Panoramica Sistema"
    >
      {/* Introduzione */}
      <DocsCapitolo icona="Info" coloreIcona="text-primary" titolo="Introduzione al Sistema">
        <p className="leading-relaxed text-slate-600">
          Le <strong>External API</strong> di Istanta 2 GDO Suite forniscono accesso programmatico
          ai dati delle promozioni, referenze prodotto e file generati. Il sistema supporta
          due modalità di autenticazione per coprire diversi scenari di integrazione:
        </p>
        <ul className="mt-4 space-y-2 text-slate-600">
          <li className="flex items-start gap-2">
            <Lucide icon="Server" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-info" />
            <span><strong>Server-to-Server</strong>: Usa API Key per integrazioni backend sicure</span>
          </li>
          <li className="flex items-start gap-2">
            <Lucide icon="Globe" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <span><strong>Browser-based</strong>: Usa Ephemeral Token per il Plugin JavaScript</span>
          </li>
        </ul>
      </DocsCapitolo>

      {/* Architettura Autenticazione */}
      <DocsCapitolo icona="Shield" coloreIcona="text-success" titolo="Architettura Autenticazione">
        <DocsCard className="mb-6 p-5">
          <AuthDiagram />
        </DocsCard>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard titolo="API Key" icona="Key" coloreIcona="text-info" accento="border-l-info">
            <p className="mb-3 text-sm text-slate-600">
              Chiave persistente per integrazioni server-to-server. Fornisce accesso
              completo a tutti gli endpoint e non scade automaticamente.
            </p>
            <ul className="space-y-1 text-sm text-slate-600">
              <li>Header: <code className="rounded-control bg-slate-100 px-1.5 py-0.5 text-xs">x-api-key</code></li>
              <li>Uso: Backend, script, automazioni</li>
              <li>Gestione: <Link to="/gestione-api/keys" className="text-primary hover:underline">Pannello API Keys</Link></li>
            </ul>
          </DocsCard>
          <DocsCard titolo="Ephemeral Token" icona="Clock" coloreIcona="text-success" accento="border-l-success">
            <p className="mb-3 text-sm text-slate-600">
              Token temporaneo generato automaticamente dal Plugin JavaScript.
              Scade dopo un breve periodo e viene rinnovato automaticamente.
            </p>
            <ul className="space-y-1 text-sm text-slate-600">
              <li>Gestito automaticamente dal Plugin FP</li>
              <li>Uso: Siti web, applicazioni browser</li>
              <li>Docs: <Link to="/documentazione/plugin" className="text-primary hover:underline">Plugin JavaScript</Link></li>
            </ul>
          </DocsCard>
        </div>
      </DocsCapitolo>

      {/* Flusso Dati */}
      <DocsCapitolo icona="Workflow" coloreIcona="text-pending" titolo="Flusso dei Dati">
        <DocsCard className="mb-6 p-5">
          <DataFlowDiagram />
        </DocsCard>
        <ol className="grid gap-4 md:grid-cols-4">
          {passiFlusso.map((passo, indice) => (
            <li key={passo.titolo} className="p-4 text-center">
              <div
                aria-hidden="true"
                className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${passo.colore}`}
              >
                {indice + 1}
              </div>
              <h3 className="title-card">{passo.titolo}</h3>
              <p className="mt-1 text-xs text-slate-500">{passo.descrizione}</p>
            </li>
          ))}
        </ol>
      </DocsCapitolo>

      {/* Glossario */}
      <DocsCapitolo icona="BookA" coloreIcona="text-info" titolo="Glossario">
        <DocsCard className="py-1">
          <dl className="divide-y divide-slate-100">
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
        </DocsCard>
      </DocsCapitolo>

      {/* Prossimi Passi */}
      <DocsCapitolo icona="ArrowRight" coloreIcona="text-primary" titolo="Prossimi Passi">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DocsCollegamento
            to="/documentazione/guida-rapida"
            icona="Rocket"
            coloreIcona="text-success"
            titolo="Guida Rapida"
            descrizione="Inizia in pochi minuti"
          />
          <DocsCollegamento
            to="/documentazione/api"
            icona="Code"
            coloreIcona="text-info"
            titolo="API Reference"
            descrizione="Esplora gli endpoint"
          />
          <DocsCollegamento
            to="/documentazione/plugin"
            icona="Package"
            coloreIcona="text-warning"
            titolo="Plugin JavaScript"
            descrizione="Integra nel browser"
          />
        </div>
      </DocsCapitolo>
    </DocsGuida>
  );
}

export default DocumentazioneOverviewPage;
