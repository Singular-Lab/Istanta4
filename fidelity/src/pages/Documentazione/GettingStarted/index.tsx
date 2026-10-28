import Alert from "@/components/Base/Alert";
import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { formatDataOraEstesa } from "@/utils/format";
import { Link, useLoaderData } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import { PLACEHOLDER_API_KEY, type StatoApiKey } from "../../GestioneApi/types";
import { CodeBlock, DocsCapitolo, DocsCard, DocsCollegamento, DocsGuida } from "../DocsCondivisi";

interface LoaderData {
  statoApiKey: StatoApiKey | null;
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
    <li className="group relative pb-8 pl-12 last:pb-0">
      {/* Linea verticale fino al passo successivo */}
      <div aria-hidden="true" className="absolute bottom-0 left-4 top-10 w-0.5 bg-slate-200 group-last:hidden" />

      {/* Numero step */}
      <div
        aria-hidden="true"
        className={`absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full font-bold text-white ${completed ? "bg-success" : "bg-primary"}`}
      >
        {completed ? <Lucide icon="Check" className="h-5 w-5" /> : number}
      </div>

      {/* Contenuto */}
      <div>
        <h2 className="title-section mb-3">
          <span className="sr-only">Passo {number}: </span>
          {title}
        </h2>
        <div className="text-slate-600">{children}</div>
      </div>
    </li>
  );
}

function DocumentazioneGettingStartedPage() {
  const loaderData = useLoaderData<LoaderData | undefined>();
  const statoApiKey = loaderData?.statoApiKey;
  // Il server conserva solo l'hash della chiave: negli esempi va sempre il placeholder
  const apiKey = PLACEHOLDER_API_KEY;
  const baseUrl = ServerCall.getUrl();

  return (
    <DocsGuida
      titolo="Guida Rapida"
      descrizione="Inizia a usare le External API in pochi minuti"
      corrente="Guida Rapida"
    >
              {/* Intro */}
              <div className="max-w-3xl">
                <p className="leading-relaxed text-slate-600">
                  Questa guida ti accompagna passo dopo passo nell'integrazione delle External API.
                  Alla fine sarai in grado di recuperare dati delle promozioni dal tuo server o
                  visualizzarli direttamente nel browser con il Plugin JavaScript.
                </p>
              </div>

              {/* Prerequisites */}
              <Alert variant="soft-primary" icona="Info" titolo="Prerequisiti">
                <ul className="space-y-1 text-sm">
                  <li>Account Istanta 2 GDO Suite con ruolo GDO, Agenzia o superiore</li>
                  <li>Almeno una promozione attiva con referenze</li>
                  <li>Per test API: client HTTP (Postman, cURL, browser)</li>
                </ul>
              </Alert>

              {/* Steps */}
              <ol className="max-w-3xl">
                {/* Step 1 */}
                <Step number={1} title="Genera la tua API Key">
                  <p className="mb-4">
                    L'API Key è necessaria per autenticare le richieste server-to-server.
                    Ogni organizzazione può avere più chiavi per ambienti diversi (produzione, staging, test).
                  </p>

                  <div className="mb-4 rounded-card border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <Lucide icon="Key" aria-hidden="true" className="h-4 w-4 text-primary" />
                      <span className="font-medium text-slate-800">La tua API Key:</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {statoApiKey?.configurata
                        ? statoApiKey.generataIl
                          ? `Configurata il ${formatDataOraEstesa(statoApiKey.generataIl)}.`
                          : "Configurata."
                        : "Nessuna API Key attiva."}{" "}
                      Per sicurezza la chiave è mostrata una sola volta, quando la generi: negli esempi
                      sostituisci <code className="rounded-control bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{PLACEHOLDER_API_KEY}</code> con la tua.
                    </p>
                  </div>

                  <Link
                    to="/gestione-api/keys"
                    className="inline-flex items-center gap-2 font-medium text-primary hover:text-primary/80"
                  >
                    <Lucide icon="Settings" aria-hidden="true" className="h-4 w-4" />
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

                  <Alert variant="soft-success" icona="Check" className="mt-4">
                    Risposta attesa: <code className="rounded-control bg-white/50 px-1">{`{"success": true, "status": "ok"}`}</code>
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

                  <div className="mt-4 rounded-card border border-slate-200 bg-slate-50 p-4">
                    <h3 className="title-card mb-2">Struttura risposta:</h3>
                    <pre className="overflow-x-auto text-xs text-slate-600">
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
                    Il plugin richiede uno <code className="rounded-control bg-slate-100 px-1">slug</code> per caricare la configurazione dal Filter Template.
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
                    className="mt-4 inline-flex items-center gap-2 font-medium text-primary hover:text-primary/80"
                  >
                    <Lucide icon="BookOpen" aria-hidden="true" className="h-4 w-4" />
                    Documentazione completa Plugin
                  </Link>
                </Step>
              </ol>

              {/* Troubleshooting */}
              <DocsCapitolo icona="TriangleAlert" coloreIcona="text-warning" titolo="Risoluzione Problemi Comuni">
                <div className="max-w-3xl space-y-4">
                  <DocsCard titolo={<code className="text-danger">401 Unauthorized</code>}>
                    <p className="text-sm text-slate-600">
                      API Key mancante o non valida. Verifica che l'header <code>x-api-key</code> sia
                      presente e contenga una chiave valida. Le chiavi sono sensibili alle maiuscole.
                    </p>
                  </DocsCard>

                  <DocsCard titolo={<code className="text-danger">400 Bad Request</code>}>
                    <p className="text-sm text-slate-600">
                      Parametri mancanti o non validi. Assicurati che <code>template_id</code> sia
                      un array con almeno un ID valido. Usa{" "}
                      <Link to="/gestione-api/test" className="text-primary hover:underline">
                        Test API
                      </Link>{" "}
                      per verificare gli ID disponibili.
                    </p>
                  </DocsCard>

                  <DocsCard titolo={<code className="text-danger">CORS Error</code>}>
                    <p className="text-sm text-slate-600">
                      Per chiamate browser-based, usa il Plugin JavaScript invece di chiamate
                      fetch dirette. Il Plugin gestisce automaticamente l'autenticazione con
                      Ephemeral Token.
                    </p>
                  </DocsCard>

                  <DocsCard titolo="Risposta vuota o nessuna referenza">
                    <p className="text-sm text-slate-600">
                      Verifica che: (1) la promozione sia attualmente valida (date inizio/fine),
                      (2) i template_id siano corretti, (3) esistano referenze associate ai template.
                    </p>
                  </DocsCard>
                </div>
              </DocsCapitolo>

              {/* Next Steps */}
              <DocsCapitolo icona="ArrowRight" coloreIcona="text-primary" titolo="Prossimi Passi">
                <div className="grid gap-4 sm:grid-cols-3">
                  <DocsCollegamento
                    to="/documentazione/api"
                    icona="Code"
                    coloreIcona="text-info"
                    titolo="API Reference"
                    descrizione="Esplora tutti gli endpoint e i filtri avanzati"
                  />
                  <DocsCollegamento
                    to="/documentazione/filter-templates"
                    icona="Filter"
                    coloreIcona="text-pending"
                    titolo="Filter Templates"
                    descrizione="Crea configurazioni riutilizzabili con slug"
                  />
                  <DocsCollegamento
                    to="/documentazione/statistiche"
                    icona="BarChart3"
                    coloreIcona="text-danger"
                    titolo="Statistiche"
                    descrizione="Monitora le chiamate API e analizza i dati"
                  />
                </div>
              </DocsCapitolo>
    </DocsGuida>
  );
}

export default DocumentazioneGettingStartedPage;
