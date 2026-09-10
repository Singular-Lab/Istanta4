import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useState } from "react";
import { Link, useLoaderData } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import PageHeader from "../../../components/Base/PageHeader";

interface LoaderData {
  apiKey: string;
}

// Componente Breadcrumb per navigazione
function DocsBreadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
      <Link to="/documentazione" className="hover:text-primary flex items-center gap-1">
        <Lucide icon="BookOpen" className="w-4 h-4" />
        Documentazione
      </Link>
      <Lucide icon="ChevronRight" className="w-4 h-4" />
      <span className="text-slate-700 dark:text-slate-200 font-medium">Guida Rapida</span>
    </nav>
  );
}

// Componente Step
function Step({
  number,
  title,
  children,
  completed = false,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  completed?: boolean;
}) {
  return (
    <div className="relative pl-12 pb-8 last:pb-0">
      {/* Linea verticale */}
      <div className="absolute left-[18px] top-10 bottom-0 w-0.5 bg-slate-200 dark:bg-darkmode-400 last:hidden" />

      {/* Numero step */}
      <div
        className={`absolute left-0 top-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-white ${completed ? "bg-success" : "bg-primary"
          }`}
      >
        {completed ? <Lucide icon="Check" className="w-5 h-5" /> : number}
      </div>

      {/* Contenuto */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">{title}</h3>
        <div className="text-slate-600 dark:text-slate-300">{children}</div>
      </div>
    </div>
  );
}

// Componente CodeBlock semplificato
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

function DocumentazioneGettingStartedPage() {
  const loaderData = useLoaderData<LoaderData | undefined>();
  const apiKey = loaderData?.apiKey || "YOUR_API_KEY";
  const baseUrl = ServerCall.getUrl();

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* Header */}
        <PageHeader
          title="Guida Rapida"
          description="Inizia a usare le External API in pochi minuti"
        />

        {/* Content */}
        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">
            <div className="p-5 sm:p-8">
              {/* Breadcrumb */}
              <DocsBreadcrumb />

              {/* Intro */}
              <div className="mb-10 max-w-3xl">
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Questa guida ti accompagna passo dopo passo nell'integrazione delle External API.
                  Alla fine sarai in grado di recuperare dati delle promozioni dal tuo server o
                  visualizzarli direttamente nel browser con il Plugin JavaScript.
                </p>
              </div>

              {/* Prerequisites */}
              <Alert variant="soft-primary" className="mb-10">
                <div className="flex items-start gap-3">
                  <Lucide icon="Info" className="w-5 h-5 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Prerequisiti</h4>
                    <ul className="text-sm space-y-1">
                      <li>Account Istanta 2 GDO Suite con ruolo GDO, Agenzia o superiore</li>
                      <li>Almeno una promozione attiva con referenze</li>
                      <li>Per test API: client HTTP (Postman, cURL, browser)</li>
                    </ul>
                  </div>
                </div>
              </Alert>

              {/* Steps */}
              <div className="max-w-3xl">
                {/* Step 1 */}
                <Step number={1} title="Genera la tua API Key">
                  <p className="mb-4">
                    L'API Key è necessaria per autenticare le richieste server-to-server.
                    Ogni organizzazione può avere più chiavi per ambienti diversi (produzione, staging, test).
                  </p>

                  <div className="box p-4 bg-slate-50 dark:bg-darkmode-600 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Lucide icon="Key" className="w-5 h-5 text-primary" />
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        La tua API Key attuale:
                      </span>
                    </div>
                    <code className="block bg-slate-900 text-green-400 px-4 py-2 rounded font-mono text-sm break-all">
                      {apiKey}
                    </code>
                  </div>

                  <Link
                    to="/gestione-api/keys"
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
                  >
                    <Lucide icon="Settings" className="w-4 h-4" />
                    Gestisci le tue API Keys
                  </Link>
                </Step>

                {/* Step 2 */}
                <Step number={2} title="Testa la Connessione">
                  <p className="mb-4">
                    Prima di procedere, verifica che la connessione funzioni correttamente
                    chiamando l'endpoint di stato.
                  </p>

                  <Tab.Group>
                    <Tab.List variant="boxed-tabs" className="mb-4">
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          cURL
                        </Tab.Button>
                      </Tab>
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          JavaScript
                        </Tab.Button>
                      </Tab>
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          Python
                        </Tab.Button>
                      </Tab>
                    </Tab.List>
                    <Tab.Panels>
                      <Tab.Panel>
                        <CodeBlock
                          language="cURL"
                          code={`curl -X GET "${baseUrl}/external/status" \\
  -H "x-api-key: ${apiKey}"`}
                        />
                      </Tab.Panel>
                      <Tab.Panel>
                        <CodeBlock
                          language="JavaScript"
                          code={`const response = await fetch('${baseUrl}/external/status', {
  method: 'GET',
  headers: {
    'x-api-key': '${apiKey}'
  }
});

const data = await response.json();
console.log(data); // { success: true, status: 'ok' }`}
                        />
                      </Tab.Panel>
                      <Tab.Panel>
                        <CodeBlock
                          language="Python"
                          code={`import requests

response = requests.get(
    '${baseUrl}/external/status',
    headers={'x-api-key': '${apiKey}'}
)

print(response.json())  # {'success': True, 'status': 'ok'}`}
                        />
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>

                  <Alert variant="soft-success" className="mt-4">
                    <div className="flex items-center gap-2">
                      <Lucide icon="Check" className="w-4 h-4" />
                      <span>
                        Risposta attesa: <code className="bg-white/50 px-1 rounded">{`{"success": true, "status": "ok"}`}</code>
                      </span>
                    </div>
                  </Alert>
                </Step>

                {/* Step 3 */}
                <Step number={3} title="Recupera le Promozioni Attive">
                  <p className="mb-4">
                    Ora che la connessione funziona, recupera l'elenco delle promozioni attualmente valide
                    per ottenere gli ID necessari per le chiamate successive.
                  </p>

                  <Tab.Group>
                    <Tab.List variant="boxed-tabs" className="mb-4">
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          cURL
                        </Tab.Button>
                      </Tab>
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          JavaScript
                        </Tab.Button>
                      </Tab>
                    </Tab.List>
                    <Tab.Panels>
                      <Tab.Panel>
                        <CodeBlock
                          language="cURL"
                          code={`curl -X GET "${baseUrl}/external/promo" \\
  -H "x-api-key: ${apiKey}"`}
                        />
                      </Tab.Panel>
                      <Tab.Panel>
                        <CodeBlock
                          language="JavaScript"
                          code={`const response = await fetch('${baseUrl}/external/promo', {
  headers: { 'x-api-key': '${apiKey}' }
});

const { data } = await response.json();
console.log('Promozioni attive:', data);
// [{ id: "PROMO_001", nome: "Promo Estate", ... }]`}
                        />
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>
                </Step>

                {/* Step 4 */}
                <Step number={4} title="Recupera le Referenze">
                  <p className="mb-4">
                    Con gli ID dei template (ottenuti dalla promozione), puoi recuperare
                    le referenze prodotto con i loro dati compilati.
                  </p>

                  <Tab.Group>
                    <Tab.List variant="boxed-tabs" className="mb-4">
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          cURL
                        </Tab.Button>
                      </Tab>
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          JavaScript
                        </Tab.Button>
                      </Tab>
                    </Tab.List>
                    <Tab.Panels>
                      <Tab.Panel>
                        <CodeBlock
                          language="cURL"
                          code={`curl -X POST "${baseUrl}/external/refs" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{
    "template_id": ["TEMPLATE_ID_1", "TEMPLATE_ID_2"]
  }'`}
                        />
                      </Tab.Panel>
                      <Tab.Panel>
                        <CodeBlock
                          language="JavaScript"
                          code={`const response = await fetch('${baseUrl}/external/refs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${apiKey}'
  },
  body: JSON.stringify({
    template_id: ['TEMPLATE_ID_1', 'TEMPLATE_ID_2']
  })
});

const { data } = await response.json();
console.log('Referenze:', data.risposta);`}
                        />
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>

                  <div className="mt-4 p-4 bg-slate-50 dark:bg-darkmode-600 rounded-lg">
                    <h5 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                      Struttura risposta:
                    </h5>
                    <pre className="text-xs text-slate-600 dark:text-slate-300 overflow-x-auto">
                      {`{
  "success": true,
  "data": {
    "conteggio": 50,
    "risposta": [{
      "id_promo": "PROMO_001",
      "nome_promo": "Promozione Estate",
      "kit": [{
        "id_kit": "KIT_001",
        "referenze": [{
          "_id": "ref_001",
          "compiledFields": { "nome": "Prodotto", "prezzo": 9.99 },
          "foto": ["https://..."],
          "meccanica": "Sconto 20%"
        }]
      }]
    }]
  }
}`}
                    </pre>
                  </div>
                </Step>

                {/* Step 5 - Plugin (Opzionale) */}
                <Step number={5} title="Integra il Plugin JavaScript (Opzionale)">
                  <p className="mb-4">
                    Se vuoi visualizzare le referenze direttamente in una pagina web,
                    il Plugin JavaScript gestisce automaticamente autenticazione e rendering.
                    Il plugin richiede uno <code className="bg-slate-100 dark:bg-darkmode-400 px-1 rounded">slug</code> per caricare la configurazione dal Filter Template.
                  </p>

                  <CodeBlock
                    language="HTML + JavaScript"
                    code={`<!-- 1. Includi lo script -->
<script src="https://cdn.istn.it/1.0.0/index.global.js"></script>

<!-- 2. Crea il container -->
<div id="fp-container"></div>

<!-- 3. Inizializza il plugin con lo slug -->
<script>
const fp = new FP();

fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'nome-del-tuo-filter-template'  // Obbligatorio
}).then(() => {
  fp.render();
});
</script>`}
                  />

                  <Link
                    to="/documentazione/plugin"
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium mt-4"
                  >
                    <Lucide icon="BookOpen" className="w-4 h-4" />
                    Documentazione completa Plugin
                  </Link>
                </Step>
              </div>

              {/* Troubleshooting */}
              <div className="mt-12 pt-8 border-t border-slate-200 dark:border-darkmode-400">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="AlertTriangle" className="w-6 h-6 text-warning" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Risoluzione Problemi Comuni
                  </h2>
                </div>

                <div className="space-y-4 max-w-3xl">
                  <div className="box p-4">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <code className="text-danger">401 Unauthorized</code>
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      API Key mancante o non valida. Verifica che l'header <code>x-api-key</code> sia
                      presente e contenga una chiave valida. Le chiavi sono sensibili alle maiuscole.
                    </p>
                  </div>

                  <div className="box p-4">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <code className="text-danger">400 Bad Request</code>
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Parametri mancanti o non validi. Assicurati che <code>template_id</code> sia
                      un array con almeno un ID valido. Usa{" "}
                      <Link to="/gestione-api/test" className="text-primary hover:underline">
                        Test API
                      </Link>{" "}
                      per verificare gli ID disponibili.
                    </p>
                  </div>

                  <div className="box p-4">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <code className="text-danger">CORS Error</code>
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Per chiamate browser-based, usa il Plugin JavaScript invece di chiamate
                      fetch dirette. Il Plugin gestisce automaticamente l'autenticazione con
                      Ephemeral Token.
                    </p>
                  </div>

                  <div className="box p-4">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                      Risposta vuota o nessuna referenza
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Verifica che: (1) la promozione sia attualmente valida (date inizio/fine),
                      (2) i template_id siano corretti, (3) esistano referenze associate ai template.
                    </p>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="mt-10">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="ArrowRight" className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Prossimi Passi
                  </h2>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Link
                    to="/documentazione/api"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <Lucide icon="Code" className="w-8 h-8 text-info mb-2" />
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">
                      API Reference
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Esplora tutti gli endpoint e i filtri avanzati
                    </p>
                  </Link>
                  <Link
                    to="/documentazione/filter-templates"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <Lucide icon="Filter" className="w-8 h-8 text-pending mb-2" />
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">
                      Filter Templates
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Crea configurazioni riutilizzabili con slug
                    </p>
                  </Link>
                  <Link
                    to="/documentazione/statistiche"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <Lucide icon="BarChart3" className="w-8 h-8 text-danger mb-2" />
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">
                      Statistiche
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Monitora le chiamate API e analizza i dati
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentazioneGettingStartedPage;
