import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useState } from "react";
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
      <span className="text-slate-700 dark:text-slate-200 font-medium">Statistiche</span>
    </nav>
  );
}

// Componente CodeBlock
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-slate-200 dark:border-darkmode-400 rounded-lg overflow-hidden">
      <div className="bg-slate-100 dark:bg-darkmode-400 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{language}</span>
        <Button variant="primary" size="sm" onClick={copyToClipboard}>
          {copied ? (
            <>
              <Lucide icon="Check" className="w-4 h-4 mr-1" />
              Copiato!
            </>
          ) : (
            <>
              <Lucide icon="Copy" className="w-4 h-4 mr-1" />
              Copia
            </>
          )}
        </Button>
      </div>
      <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
        <code className="text-sm font-mono">{code}</code>
      </pre>
    </div>
  );
}

// Lista Sistemi Operativi supportati
const operatingSystems = [
  { name: "Windows", icon: "Monitor", color: "text-blue-500", description: "Windows 7, 8, 10, 11" },
  { name: "macOS", icon: "Laptop", color: "text-slate-700 dark:text-slate-300", description: "macOS 10.x+" },
  { name: "Linux", icon: "Terminal", color: "text-orange-500", description: "Ubuntu, Debian, Fedora, ecc." },
  { name: "iOS", icon: "Smartphone", color: "text-slate-500", description: "iPhone, iPod Touch" },
  { name: "iPadOS", icon: "Tablet", color: "text-slate-500", description: "iPad" },
  { name: "Android", icon: "Smartphone", color: "text-green-500", description: "Tutti i dispositivi Android" },
  { name: "ChromeOS", icon: "Globe", color: "text-blue-400", description: "Chromebook" },
  { name: "SmartTV", icon: "Tv", color: "text-purple-500", description: "Tizen, WebOS, Roku" },
  { name: "Console", icon: "Gamepad2", color: "text-red-500", description: "PS5, Xbox, Nintendo Switch" },
  { name: "Bot", icon: "Bot", color: "text-amber-500", description: "Googlebot, crawler, API clients" },
];

function DocumentazioneStatisticsPage() {
  const baseUrl = ServerCall.getUrl();

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* Header */}
        <PageHeader
          title="Statistiche & Monitoring"
          description="Monitora le chiamate API e analizza i dati di utilizzo"
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
                  <Lucide icon="BarChart3" className="w-6 h-6 text-danger" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Panoramica Statistiche
                  </h2>
                </div>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    Il sistema di statistiche registra automaticamente ogni chiamata alle External API,
                    raccogliendo metriche su performance, utilizzo e dispositivi. Questi dati ti permettono
                    di monitorare l'integrazione, identificare problemi e ottimizzare le configurazioni.
                  </p>
                </div>

                <Alert variant="soft-info" className="mt-6">
                  <div className="flex items-start gap-3">
                    <Lucide icon="Info" className="w-5 h-5 mt-0.5" />
                    <div>
                      <p className="text-sm">
                        La raccolta statistiche avviene in modo <strong>asincrono</strong> e non impatta
                        le performance delle risposte API. I dati vengono aggregati periodicamente per
                        analisi.
                      </p>
                    </div>
                  </div>
                </Alert>
              </section>

              {/* Metriche Disponibili */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Activity" className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Metriche Disponibili
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="box p-4 border-l-4 border-primary">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Richieste Totali
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Conteggio totale delle chiamate API nel periodo selezionato
                    </p>
                  </div>
                  <div className="box p-4 border-l-4 border-success">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Success Rate
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Percentuale di richieste completate con successo (2xx)
                    </p>
                  </div>
                  <div className="box p-4 border-l-4 border-danger">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Failure Rate
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Percentuale di errori (4xx, 5xx) con dettaglio per codice
                    </p>
                  </div>
                  <div className="box p-4 border-l-4 border-warning">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Tempo Risposta
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Tempo medio di risposta in millisecondi (avg, p50, p95, p99)
                    </p>
                  </div>
                  <div className="box p-4 border-l-4 border-info">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Uso Endpoint
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Distribuzione chiamate per endpoint (/refs, /files, /promo, ecc.)
                    </p>
                  </div>
                  <div className="box p-4 border-l-4 border-pending">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Trend Temporale
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Andamento richieste per ora, giorno, settimana
                    </p>
                  </div>
                </div>
              </section>

              {/* OS Detection */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Monitor" className="w-6 h-6 text-info" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Rilevamento Sistema Operativo
                  </h2>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none mb-6">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    Il sistema analizza l'header <code>User-Agent</code> di ogni richiesta per identificare
                    il sistema operativo del client. Questo ti permette di capire da quali dispositivi
                    vengono effettuate le chiamate API.
                  </p>
                </div>

                <div className="box p-6 mb-6">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Sistemi Operativi Rilevati
                  </h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {operatingSystems.map((os) => (
                      <div
                        key={os.name}
                        className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-darkmode-600 rounded-lg"
                      >
                        <Lucide icon={os.icon as any} className={`w-5 h-5 ${os.color}`} />
                        <div>
                          <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                            {os.name}
                          </span>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{os.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Alert variant="soft-warning" className="mb-6">
                  <div className="flex items-start gap-3">
                    <Lucide icon="AlertTriangle" className="w-5 h-5 mt-0.5" />
                    <div>
                      <h5 className="font-medium mb-1">Nota sul Rilevamento</h5>
                      <p className="text-sm">
                        Il rilevamento si basa sull'User-Agent che può essere modificato dal client.
                        I bot e gli API client (Postman, cURL, ecc.) vengono categorizzati separatamente.
                        Richieste senza User-Agent sono classificate come "Unknown".
                      </p>
                    </div>
                  </div>
                </Alert>
              </section>

              {/* Accesso Statistiche */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Eye" className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Accesso alle Statistiche
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Lucide icon="LayoutDashboard" className="w-5 h-5 text-primary" />
                      Dashboard Grafica
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      Visualizza grafici interattivi, filtra per periodo e esporta i dati in vari formati.
                    </p>
                    <Link
                      to="/gestione-api/statistiche"
                      className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm"
                    >
                      <Lucide icon="ExternalLink" className="w-4 h-4" />
                      Apri Dashboard Statistiche
                    </Link>
                  </div>

                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Lucide icon="Code" className="w-5 h-5 text-info" />
                      API Endpoint
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      Recupera dati statistici programmaticamente per integrarli nei tuoi sistemi.
                    </p>
                    <code className="text-xs bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">
                      GET /external/statistiche/aggregate
                    </code>
                  </div>
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
              </section>

              {/* Export */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Download" className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Export Dati
                  </h2>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none mb-6">
                  <p className="text-slate-600 dark:text-slate-300">
                    Dalla dashboard puoi esportare i dati statistici in diversi formati per analisi
                    esterne o reportistica.
                  </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="box p-4 text-center">
                    <Lucide icon="FileSpreadsheet" className="w-10 h-10 text-green-600 mx-auto mb-2" />
                    <h5 className="font-medium text-slate-900 dark:text-slate-100">CSV</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Formato tabellare per Excel, Google Sheets
                    </p>
                  </div>
                  <div className="box p-4 text-center">
                    <Lucide icon="FileJson" className="w-10 h-10 text-amber-600 mx-auto mb-2" />
                    <h5 className="font-medium text-slate-900 dark:text-slate-100">Excel (.xlsx)</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Foglio di calcolo con formattazione
                    </p>
                  </div>
                  <div className="box p-4 text-center">
                    <Lucide icon="FileText" className="w-10 h-10 text-red-600 mx-auto mb-2" />
                    <h5 className="font-medium text-slate-900 dark:text-slate-100">PDF</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Report formattato per stampa/condivisione
                    </p>
                  </div>
                </div>
              </section>

              {/* Interpretazione */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Lightbulb" className="w-6 h-6 text-warning" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Interpretazione dei Dati
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <Lucide icon="TrendingDown" className="w-5 h-5 text-danger" />
                      Success Rate in calo
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Un calo del success rate può indicare: (1) API Key scadute o errate, (2) modifiche
                      ai template_id, (3) problemi di rete del client. Controlla i codici di errore
                      specifici nella dashboard dettagli.
                    </p>
                  </div>

                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <Lucide icon="Clock" className="w-5 h-5 text-warning" />
                      Tempo di risposta alto
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Tempi superiori a 500ms possono essere causati da: (1) query complesse con molti filtri,
                      (2) template con molte referenze, (3) carico del database. Considera di usare
                      Filter Templates con filtri ottimizzati.
                    </p>
                  </div>

                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <Lucide icon="Bot" className="w-5 h-5 text-info" />
                      Alto traffico da Bot
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Se una percentuale significativa di richieste proviene da "Bot", potrebbe trattarsi di:
                      (1) crawler legittimi (Googlebot), (2) automazioni (API client), (3) potenziale scraping.
                      Valuta se implementare rate limiting più restrittivo.
                    </p>
                  </div>

                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <Lucide icon="Smartphone" className="w-5 h-5 text-success" />
                      Distribuzione Dispositivi
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      La distribuzione tra Desktop (Windows/macOS/Linux) e Mobile (iOS/Android) ti aiuta
                      a capire dove ottimizzare. Se la maggior parte del traffico è mobile, assicurati
                      che il Plugin sia responsive e i tempi di caricamento siano ottimizzati.
                    </p>
                  </div>
                </div>
              </section>

              {/* Data Retention */}
              <section className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Database" className="w-6 h-6 text-slate-500" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Retention dei Dati
                  </h2>
                </div>

                <div className="box p-6">
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    I dati statistici vengono conservati secondo la seguente policy:
                  </p>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <Lucide icon="Check" className="w-4 h-4 text-success" />
                      <span><strong>Dati dettagliati:</strong> 90 giorni (poi aggregati)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Lucide icon="Check" className="w-4 h-4 text-success" />
                      <span><strong>Aggregazioni giornaliere:</strong> 1 anno</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Lucide icon="Check" className="w-4 h-4 text-success" />
                      <span><strong>Aggregazioni mensili:</strong> Illimitato</span>
                    </li>
                  </ul>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
                    È possibile richiedere la pulizia anticipata dei dati tramite l'endpoint
                    <code className="bg-slate-100 dark:bg-darkmode-400 px-1.5 py-0.5 rounded mx-1">
                      POST /external/statistiche/pulisci
                    </code>
                    (richiede permessi amministratore).
                  </p>
                </div>
              </section>

              {/* Link correlati */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="ArrowRight" className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Pagine Correlate
                  </h2>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Link
                    to="/gestione-api/statistiche"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <Lucide icon="BarChart3" className="w-8 h-8 text-danger mb-2" />
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">
                      Dashboard Statistiche
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Visualizza grafici e metriche in tempo reale
                    </p>
                  </Link>
                  <Link
                    to="/documentazione/api"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <Lucide icon="Code" className="w-8 h-8 text-info mb-2" />
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">
                      API Reference
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Endpoint statistiche completi
                    </p>
                  </Link>
                  <Link
                    to="/documentazione/panoramica"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <Lucide icon="BookOpen" className="w-8 h-8 text-primary mb-2" />
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">
                      Panoramica Sistema
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Come funziona la raccolta dati
                    </p>
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

export default DocumentazioneStatisticsPage;
