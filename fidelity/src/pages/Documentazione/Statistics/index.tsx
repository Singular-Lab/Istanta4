import Alert from "@/components/Base/Alert";
import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { Link } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import { CodeBlock, DocsCapitolo, DocsCard, DocsCollegamento, DocsGuida } from "../DocsCondivisi";

// Lista Sistemi Operativi supportati
const operatingSystems = [
  { name: "Windows", icon: "Monitor", color: "text-info", description: "Windows 7, 8, 10, 11" },
  { name: "macOS", icon: "Laptop", color: "text-slate-700", description: "macOS 10.x+" },
  { name: "Linux", icon: "Terminal", color: "text-warning", description: "Ubuntu, Debian, Fedora, ecc." },
  { name: "iOS", icon: "Smartphone", color: "text-slate-500", description: "iPhone, iPod Touch" },
  { name: "iPadOS", icon: "Tablet", color: "text-slate-500", description: "iPad" },
  { name: "Android", icon: "Smartphone", color: "text-success", description: "Tutti i dispositivi Android" },
  { name: "ChromeOS", icon: "Globe", color: "text-info", description: "Chromebook" },
  { name: "SmartTV", icon: "Tv", color: "text-primary", description: "Tizen, WebOS, Roku" },
  { name: "Console", icon: "Gamepad2", color: "text-danger", description: "PS5, Xbox, Nintendo Switch" },
  { name: "Bot", icon: "Bot", color: "text-warning", description: "Googlebot, crawler, API clients" },
];

const metriche = [
  { titolo: "Richieste Totali", descrizione: "Conteggio totale delle chiamate API nel periodo selezionato", accento: "border-l-primary" },
  { titolo: "Success Rate", descrizione: "Percentuale di richieste completate con successo (2xx)", accento: "border-l-success" },
  { titolo: "Failure Rate", descrizione: "Percentuale di errori (4xx, 5xx) con dettaglio per codice", accento: "border-l-danger" },
  { titolo: "Tempo Risposta", descrizione: "Tempo medio di risposta in millisecondi (avg, p50, p95, p99)", accento: "border-l-warning" },
  { titolo: "Uso Endpoint", descrizione: "Distribuzione chiamate per endpoint (/refs, /files, /promo, ecc.)", accento: "border-l-info" },
  { titolo: "Trend Temporale", descrizione: "Andamento richieste per ora, giorno, settimana", accento: "border-l-pending" },
];

const formatiExport = [
  { titolo: "CSV", icona: "FileSpreadsheet", colore: "text-success", descrizione: "Formato tabellare per Excel, Google Sheets" },
  { titolo: "Excel (.xlsx)", icona: "FileJson", colore: "text-warning", descrizione: "Foglio di calcolo con formattazione" },
  { titolo: "PDF", icona: "FileText", colore: "text-danger", descrizione: "Report formattato per stampa/condivisione" },
];

const interpretazioni = [
  {
    titolo: "Success Rate in calo",
    icona: "TrendingDown",
    colore: "text-danger",
    testo:
      "Un calo del success rate può indicare: (1) API Key scadute o errate, (2) modifiche ai template_id, (3) problemi di rete del client. Controlla i codici di errore specifici nella dashboard dettagli.",
  },
  {
    titolo: "Tempo di risposta alto",
    icona: "Clock",
    colore: "text-warning",
    testo:
      "Tempi superiori a 500ms possono essere causati da: (1) query complesse con molti filtri, (2) template con molte referenze, (3) carico del database. Considera di usare Filter Templates con filtri ottimizzati.",
  },
  {
    titolo: "Alto traffico da Bot",
    icona: "Bot",
    colore: "text-info",
    testo:
      "Se una percentuale significativa di richieste proviene da \"Bot\", potrebbe trattarsi di: (1) crawler legittimi (Googlebot), (2) automazioni (API client), (3) potenziale scraping. Valuta se implementare rate limiting più restrittivo.",
  },
  {
    titolo: "Distribuzione Dispositivi",
    icona: "Smartphone",
    colore: "text-success",
    testo:
      "La distribuzione tra Desktop (Windows/macOS/Linux) e Mobile (iOS/Android) ti aiuta a capire dove ottimizzare. Se la maggior parte del traffico è mobile, assicurati che il Plugin sia responsive e i tempi di caricamento siano ottimizzati.",
  },
];

function DocumentazioneStatisticsPage() {
  const baseUrl = ServerCall.getUrl();

  return (
    <DocsGuida
      titolo="Statistiche & Monitoring"
      descrizione="Monitora le chiamate API e analizza i dati di utilizzo"
      corrente="Statistiche"
    >
      {/* Introduzione */}
      <DocsCapitolo icona="BarChart3" coloreIcona="text-danger" titolo="Panoramica Statistiche">
        <p className="mb-4 leading-relaxed text-slate-600">
          Il sistema di statistiche registra automaticamente ogni chiamata alle External API,
          raccogliendo metriche su performance, utilizzo e dispositivi. Questi dati ti permettono
          di monitorare l'integrazione, identificare problemi e ottimizzare le configurazioni.
        </p>

        <Alert variant="soft-info" icona="Info" className="mt-6">
          <p className="text-sm">
            La raccolta statistiche avviene in modo <strong>asincrono</strong> e non impatta
            le performance delle risposte API. I dati vengono aggregati periodicamente per
            analisi.
          </p>
        </Alert>
      </DocsCapitolo>

      {/* Metriche Disponibili */}
      <DocsCapitolo icona="Activity" coloreIcona="text-success" titolo="Metriche Disponibili">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metriche.map((metrica) => (
            <DocsCard key={metrica.titolo} titolo={metrica.titolo} accento={metrica.accento}>
              <p className="text-sm text-slate-600">{metrica.descrizione}</p>
            </DocsCard>
          ))}
        </div>
      </DocsCapitolo>

      {/* OS Detection */}
      <DocsCapitolo icona="Monitor" coloreIcona="text-info" titolo="Rilevamento Sistema Operativo">
        <p className="mb-6 leading-relaxed text-slate-600">
          Il sistema analizza l'header <code>User-Agent</code> di ogni richiesta per identificare
          il sistema operativo del client. Questo ti permette di capire da quali dispositivi
          vengono effettuate le chiamate API.
        </p>

        <DocsCard titolo="Sistemi Operativi Rilevati" className="mb-6">
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {operatingSystems.map((os) => (
              <div key={os.name} className="flex items-center gap-2 rounded-control bg-slate-50 p-3">
                <Lucide icon={os.icon as any} aria-hidden="true" className={`h-5 w-5 ${os.color}`} />
                <div>
                  <span className="text-sm font-medium text-slate-800">{os.name}</span>
                  <p className="text-xs text-slate-500">{os.description}</p>
                </div>
              </div>
            ))}
          </div>
        </DocsCard>

        <Alert variant="soft-warning" icona="TriangleAlert" titolo="Nota sul Rilevamento">
          <p className="text-sm">
            Il rilevamento si basa sull'User-Agent che può essere modificato dal client.
            I bot e gli API client (Postman, cURL, ecc.) vengono categorizzati separatamente.
            Richieste senza User-Agent sono classificate come "Unknown".
          </p>
        </Alert>
      </DocsCapitolo>

      {/* Accesso Statistiche */}
      <DocsCapitolo icona="Eye" coloreIcona="text-primary" titolo="Accesso alle Statistiche">
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <DocsCard titolo="Dashboard Grafica" icona="LayoutDashboard" coloreIcona="text-primary">
            <p className="mb-4 text-sm text-slate-600">
              Visualizza grafici interattivi, filtra per periodo e esporta i dati in vari formati.
            </p>
            <Link
              to="/gestione-api/statistiche"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
            >
              <Lucide icon="ExternalLink" aria-hidden="true" className="h-4 w-4" />
              Apri Dashboard Statistiche
            </Link>
          </DocsCard>

          <DocsCard titolo="API Endpoint" icona="Code" coloreIcona="text-info">
            <p className="mb-4 text-sm text-slate-600">
              Recupera dati statistici programmaticamente per integrarli nei tuoi sistemi.
            </p>
            <code className="rounded-control bg-slate-100 px-2 py-1 text-xs">
              GET /external/statistiche/aggregate
            </code>
          </DocsCard>
        </div>

        <Tab.Group>
          <Tab.List variant="boxed-tabs" className="mb-4">
            <Tab>
              <Tab.Button className="w-full py-2" as="button">
                Statistiche Aggregate
              </Tab.Button>
            </Tab>
            <Tab>
              <Tab.Button className="w-full py-2" as="button">
                Dettagli con Filtri
              </Tab.Button>
            </Tab>
          </Tab.List>
          <Tab.Panels>
            <Tab.Panel>
              <CodeBlock
                language="JavaScript - Statistiche Aggregate"
                code={`const response = await fetch(
  '${baseUrl}/external/statistiche/aggregate?periodo=7d',
  { headers: { 'x-api-key': 'YOUR_API_KEY' } }
);

const { data } = await response.json();
console.log('Statistiche:', data);
// {
//   totale_richieste: 15420,
//   richieste_riuscite: 15100,
//   richieste_fallite: 320,
//   success_rate: 97.9,
//   tempo_medio_ms: 145,
//   endpoint: {
//     '/refs': { count: 8500, avg_time: 120 },
//     '/files': { count: 5000, avg_time: 95 },
//     '/promo': { count: 1920, avg_time: 45 }
//   },
//   dispositivi: {
//     sistemi_operativi: [
//       { os: 'Windows', totale: 6200, success_rate: 98.1 },
//       { os: 'Android', totale: 4100, success_rate: 97.5 },
//       { os: 'iOS', totale: 2800, success_rate: 98.8 },
//       ...
//     ]
//   }
// }`}
              />
            </Tab.Panel>
            <Tab.Panel>
              <CodeBlock
                language="JavaScript - Dettagli con Filtri"
                code={`const params = new URLSearchParams({
  data_inizio: '2024-01-01',
  data_fine: '2024-01-31',
  endpoint: '/refs',
  status_code: '200',
  limit: '100',
  offset: '0'
});

const response = await fetch(
  '${baseUrl}/external/statistiche/dettagli?' + params,
  { headers: { 'x-api-key': 'YOUR_API_KEY' } }
);

const { data } = await response.json();
console.log('Dettagli:', data);
// {
//   totale: 5000,
//   risultati: [
//     {
//       id: 'stat_001',
//       endpoint: '/refs',
//       method: 'POST',
//       status_code: 200,
//       response_time_ms: 142,
//       user_agent: 'Mozilla/5.0 (Windows NT 10.0...)',
//       os: 'Windows',
//       ip: '192.168.x.x',
//       created_at: '2024-01-15T10:30:00Z'
//     },
//     ...
//   ]
// }`}
              />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </DocsCapitolo>

      {/* Export */}
      <DocsCapitolo icona="Download" coloreIcona="text-success" titolo="Export Dati">
        <p className="mb-6 text-slate-600">
          Dalla dashboard puoi esportare i dati statistici in diversi formati per analisi
          esterne o reportistica.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {formatiExport.map((formato) => (
            <DocsCard key={formato.titolo} className="text-center">
              <Lucide icon={formato.icona} aria-hidden="true" className={`mx-auto mb-2 h-10 w-10 ${formato.colore}`} />
              <h3 className="title-card">{formato.titolo}</h3>
              <p className="mt-1 text-xs text-slate-500">{formato.descrizione}</p>
            </DocsCard>
          ))}
        </div>
      </DocsCapitolo>

      {/* Interpretazione */}
      <DocsCapitolo icona="Lightbulb" coloreIcona="text-warning" titolo="Interpretazione dei Dati">
        <div className="space-y-4">
          {interpretazioni.map((voce) => (
            <DocsCard key={voce.titolo} titolo={voce.titolo} icona={voce.icona} coloreIcona={voce.colore}>
              <p className="text-sm text-slate-600">{voce.testo}</p>
            </DocsCard>
          ))}
        </div>
      </DocsCapitolo>

      {/* Data Retention */}
      <DocsCapitolo icona="Database" coloreIcona="text-slate-500" titolo="Retention dei Dati">
        <DocsCard>
          <p className="mb-4 text-slate-600">
            I dati statistici vengono conservati secondo la seguente policy:
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <Lucide icon="Check" aria-hidden="true" className="h-4 w-4 text-success" />
              <span><strong>Dati dettagliati:</strong> 90 giorni (poi aggregati)</span>
            </li>
            <li className="flex items-center gap-2">
              <Lucide icon="Check" aria-hidden="true" className="h-4 w-4 text-success" />
              <span><strong>Aggregazioni giornaliere:</strong> 1 anno</span>
            </li>
            <li className="flex items-center gap-2">
              <Lucide icon="Check" aria-hidden="true" className="h-4 w-4 text-success" />
              <span><strong>Aggregazioni mensili:</strong> Illimitato</span>
            </li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            È possibile richiedere la pulizia anticipata dei dati tramite l'endpoint
            <code className="mx-1 rounded-control bg-slate-100 px-1.5 py-0.5">
              POST /external/statistiche/pulisci
            </code>
            (richiede permessi amministratore).
          </p>
        </DocsCard>
      </DocsCapitolo>

      {/* Link correlati */}
      <DocsCapitolo icona="ArrowRight" coloreIcona="text-primary" titolo="Pagine Correlate">
        <div className="grid gap-4 sm:grid-cols-3">
          <DocsCollegamento
            to="/gestione-api/statistiche"
            icona="BarChart3"
            coloreIcona="text-danger"
            titolo="Dashboard Statistiche"
            descrizione="Visualizza grafici e metriche in tempo reale"
          />
          <DocsCollegamento
            to="/documentazione/api"
            icona="Code"
            coloreIcona="text-info"
            titolo="API Reference"
            descrizione="Endpoint statistiche completi"
          />
          <DocsCollegamento
            to="/documentazione/panoramica"
            icona="BookOpen"
            coloreIcona="text-primary"
            titolo="Panoramica Sistema"
            descrizione="Come funziona la raccolta dati"
          />
        </div>
      </DocsCapitolo>
    </DocsGuida>
  );
}

export default DocumentazioneStatisticsPage;
