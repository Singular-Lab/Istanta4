import Alert from "@/components/Base/Alert";
import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Table from "@/components/Base/Table";
import { Link } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import { CodeBlock, DocsCapitolo, DocsCard, DocsCollegamento, DocsGuida } from "../DocsCondivisi";

const campiTemplate = [
  { campo: "nome", tipo: "string", descrizione: "Nome descrittivo del template" },
  { campo: "slug", tipo: "string", descrizione: "Identificatore URL-safe univoco (es. \"promo-estate\")" },
  { campo: "endpoint_type", tipo: "\"refs\" | \"refs-html\" | \"files\"", descrizione: "Tipo di endpoint (refs-html è per uso interno del plugin)" },
  { campo: "render_type", tipo: "\"grid\" | \"carousel\" | \"list\"", descrizione: "Layout di visualizzazione" },
  { campo: "template_ids", tipo: "string[]", descrizione: "Array di ID template kit (per refs)" },
  { campo: "export_codes", tipo: "string[]", descrizione: "Array di codici export (per files: \"POP\", \"PDF\", ecc.)" },
  { campo: "filters", tipo: "FilterCondition[][]", descrizione: "Gruppi di filtri (AND tra gruppi, OR dentro gruppo)" },
  { campo: "carousel_options", tipo: "object", descrizione: "autoScroll, scrollSpeed, ecc. (opzionale)" },
  { campo: "is_active", tipo: "boolean", descrizione: "Se false, il template non è accessibile pubblicamente" },
];

const bestPractice = [
  {
    titolo: "Slug descrittivi",
    testo: (
      <>
        Usa slug leggibili come "promo-estate-2024" invece di "template1". Facilita
        il debugging e la comunicazione con il team.
      </>
    ),
  },
  {
    titolo: "Un template per caso d'uso",
    testo: (
      <>
        Crea template separati per contesti diversi (homepage, app, totem) invece di
        riutilizzare lo stesso ovunque.
      </>
    ),
  },
  {
    titolo: "Testa prima di attivare",
    testo: (
      <>
        Crea il template con <code>is_active: false</code>, verifica che funzioni,
        poi attivalo.
      </>
    ),
  },
  {
    titolo: "Versioning consapevole",
    testo: (
      <>
        Prima di modifiche importanti, annota cosa stai cambiando. Il sistema salva
        automaticamente le versioni, ma un commento aiuta a ricordare il motivo.
      </>
    ),
  },
];

function DocumentazioneFilterTemplatesPage() {
  const baseUrl = ServerCall.getUrl();

  return (
    <DocsGuida
      titolo="Template Filtri"
      descrizione="Crea configurazioni riutilizzabili con il sistema slug-based"
      corrente="Template Filtri"
    >
      {/* Introduzione */}
      <DocsCapitolo icona="Filter" coloreIcona="text-pending" titolo="Cosa sono i Template Filtri">
        <p className="mb-4 leading-relaxed text-slate-600">
          I <strong>Template Filtri</strong> (o Filter Templates) permettono di salvare
          configurazioni di filtri, template e opzioni di visualizzazione in modo riutilizzabile.
          Ogni configurazione è accessibile tramite uno <strong>slug</strong> univoco,
          un identificatore URL-safe che evita di esporre ID interni.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <DocsCard titolo="Configurazioni Salvate" icona="Bookmark" coloreIcona="text-pending" accento="border-l-pending">
            <p className="text-sm text-slate-600">
              Salva filtri, template_id, tipo rendering e opzioni carousel in un unico oggetto
            </p>
          </DocsCard>
          <DocsCard titolo="Accesso via Slug" icona="Link" coloreIcona="text-info" accento="border-l-info">
            <p className="text-sm text-slate-600">
              Usa slug leggibili come "promo-estate-2024" invece di UUID complessi
            </p>
          </DocsCard>
          <DocsCard titolo="Versioning" icona="History" coloreIcona="text-success" accento="border-l-success">
            <p className="text-sm text-slate-600">
              Storico delle modifiche con possibilità di ripristinare versioni precedenti
            </p>
          </DocsCard>
        </div>
      </DocsCapitolo>

      {/* Struttura Template */}
      <DocsCapitolo icona="FileCode" coloreIcona="text-info" titolo="Struttura di un Template">
        <div className="overflow-x-auto rounded-card border border-slate-200">
          <Table className="text-sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Campo</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Descrizione</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {campiTemplate.map((voce) => (
                <Table.Tr key={voce.campo}>
                  <Table.Td>
                    <code className="rounded-control bg-slate-100 px-2 py-1">{voce.campo}</code>
                  </Table.Td>
                  <Table.Td className="text-slate-600">{voce.tipo}</Table.Td>
                  <Table.Td className="text-slate-600">{voce.descrizione}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </DocsCapitolo>

      {/* Creazione Template */}
      <DocsCapitolo icona="Plus" coloreIcona="text-success" titolo="Creazione di un Template">
        <p className="mb-6 text-slate-600">
          Puoi creare template tramite l'interfaccia grafica o via API REST.
        </p>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <DocsCard titolo="Via Interfaccia Grafica" icona="MousePointer" coloreIcona="text-primary">
            <p className="mb-4 text-sm text-slate-600">
              Usa il pannello di configurazione plugin per creare e modificare template
              con un'interfaccia intuitiva.
            </p>
            <Link
              to="/gestione-api/plugin"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
            >
              <Lucide icon="Settings" aria-hidden="true" className="h-4 w-4" />
              Apri Configurazione Plugin
            </Link>
          </DocsCard>

          <DocsCard titolo="Via API REST" icona="Code" coloreIcona="text-info">
            <p className="mb-4 text-sm text-slate-600">
              Crea template programmaticamente con una chiamata POST all'endpoint dedicato.
            </p>
            <code className="rounded-control bg-slate-100 px-2 py-1 text-xs">
              POST /external/filter-templates
            </code>
          </DocsCard>
        </div>

        <CodeBlock
          language="JavaScript - Creazione via API"
          code={`const response = await fetch('${baseUrl}/external/filter-templates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    nome: 'Promozione Estate 2024',
    slug: 'promo-estate-2024',
    endpoint_type: 'refs-html',
    render_type: 'grid',
    template_ids: ['TEMPLATE_001', 'TEMPLATE_002'],
    filters: [
      [
        { field: 'categoria', operator: 'equals', value: 'bevande' }
      ]
    ],
    is_active: true
  })
});

const { data } = await response.json();
console.log('Template creato:', data.slug);`}
        />
      </DocsCapitolo>

      {/* Utilizzo via Slug */}
      <DocsCapitolo icona="Link" coloreIcona="text-primary" titolo="Utilizzo via Slug">
        <Alert variant="soft-warning" icona="Info" className="mb-6">
          <p className="text-sm">
            Lo slug è pubblico e non richiede autenticazione. Questo permette al Plugin
            JavaScript di caricare la configurazione senza esporre API keys nel browser.
          </p>
        </Alert>

        <Tab.Group>
          <Tab.List variant="boxed-tabs" className="mb-4">
            <Tab>
              <Tab.Button className="w-full py-2" as="button">
                Recupero Template
              </Tab.Button>
            </Tab>
            <Tab>
              <Tab.Button className="w-full py-2" as="button">
                Plugin con Slug
              </Tab.Button>
            </Tab>
            <Tab>
              <Tab.Button className="w-full py-2" as="button">
                Storico Versioni
              </Tab.Button>
            </Tab>
          </Tab.List>
          <Tab.Panels>
            <Tab.Panel>
              <CodeBlock
                language="JavaScript - GET Template by Slug"
                code={`// Recupera la configurazione del template
const response = await fetch(
  '${baseUrl}/external/filter-templates/slug/promo-estate-2024'
);

const { data } = await response.json();
console.log('Configurazione:', data);
// {
//   nome: 'Promozione Estate 2024',
//   slug: 'promo-estate-2024',
//   endpoint_type: 'refs-html',
//   render_type: 'grid',
//   template_ids: ['TEMPLATE_001', 'TEMPLATE_002'],
//   filters: [...],
//   ...
// }`}
              />
            </Tab.Panel>
            <Tab.Panel>
              <CodeBlock
                language="JavaScript - Plugin con Slug"
                code={`const fp = new FP();

// Il plugin carica automaticamente la configurazione dallo slug
await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024'  // <-- usa lo slug invece di template_id
});

await fp.render();
// Il plugin usa automaticamente endpoint_type, render_type,
// template_ids, filters e carousel_options dal template`}
              />
            </Tab.Panel>
            <Tab.Panel>
              <CodeBlock
                language="JavaScript - Storico Versioni"
                code={`// Recupera lo storico delle versioni
const response = await fetch(
  '${baseUrl}/external/filter-templates/slug/promo-estate-2024/versions',
  { headers: { 'x-api-key': 'YOUR_API_KEY' } }
);

const { data } = await response.json();
console.log('Versioni:', data);
// [
//   { version: 3, created_at: '2024-06-15T10:00:00Z', changes: {...} },
//   { version: 2, created_at: '2024-06-01T08:00:00Z', changes: {...} },
//   { version: 1, created_at: '2024-05-20T14:00:00Z', changes: {...} }
// ]

// Ripristina una versione precedente
await fetch(
  '${baseUrl}/external/filter-templates/slug/promo-estate-2024/restore/2',
  {
    method: 'POST',
    headers: { 'x-api-key': 'YOUR_API_KEY' }
  }
);`}
              />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </DocsCapitolo>

      {/* Esempi Pratici */}
      <DocsCapitolo icona="Lightbulb" coloreIcona="text-warning" titolo="Esempi Pratici">
        <div className="space-y-6">
          <DocsCard titolo="E-commerce: Vetrina Prodotti" icona="ShoppingCart" coloreIcona="text-success">
            <p className="mb-4 text-sm text-slate-600">
              Mostra le offerte settimanali in una griglia responsive sul tuo sito e-commerce.
            </p>
            <CodeBlock
              language="JSON"
              code={`{
  "nome": "Offerte Settimanali",
  "slug": "offerte-settimanali",
  "endpoint_type": "refs-html",
  "render_type": "grid",
  "template_ids": ["TEMPLATE_OFFERTE"],
  "filters": [
    [{ "field": "in_evidenza", "operator": "equals", "value": "true" }]
  ]
}`}
            />
          </DocsCard>

          <DocsCard titolo="Digital Signage: Carousel Automatico" icona="Monitor" coloreIcona="text-info">
            <p className="mb-4 text-sm text-slate-600">
              Scorri automaticamente i volantini PDF su schermi in negozio.
            </p>
            <CodeBlock
              language="JSON"
              code={`{
  "nome": "Totem Ingresso",
  "slug": "totem-ingresso",
  "endpoint_type": "files",
  "render_type": "carousel",
  "export_codes": ["POP", "PDF"],
  "carousel_options": {
    "autoScroll": true,
    "scrollSpeed": 5000,
    "showArrows": false
  }
}`}
            />
          </DocsCard>

          <DocsCard titolo="App Mobile: Lista Categorie" icona="Smartphone" coloreIcona="text-warning">
            <p className="mb-4 text-sm text-slate-600">
              Recupera JSON delle referenze per rendering custom nell'app.
            </p>
            <CodeBlock
              language="JSON"
              code={`{
  "nome": "Frutta e Verdura",
  "slug": "frutta-verdura",
  "endpoint_type": "refs",
  "render_type": "list",
  "template_ids": ["TPL_FRUTTA", "TPL_VERDURA"],
  "filters": [
    [
      { "field": "disponibile", "operator": "equals", "value": "true" },
      { "field": "prezzo", "operator": "less_than", "value": "10" }
    ]
  ]
}`}
            />
          </DocsCard>
        </div>
      </DocsCapitolo>

      {/* Best Practices */}
      <DocsCapitolo icona="CircleCheck" coloreIcona="text-success" titolo="Best Practices">
        <DocsCard>
          <ul className="space-y-4">
            {bestPractice.map((voce) => (
              <li key={voce.titolo} className="flex items-start gap-3">
                <Lucide icon="Check" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <div>
                  <h3 className="title-card">{voce.titolo}</h3>
                  <p className="mt-1 text-sm text-slate-600">{voce.testo}</p>
                </div>
              </li>
            ))}
          </ul>
        </DocsCard>
      </DocsCapitolo>

      {/* Link correlati */}
      <DocsCapitolo icona="ArrowRight" coloreIcona="text-primary" titolo="Pagine Correlate">
        <div className="grid gap-4 sm:grid-cols-3">
          <DocsCollegamento
            to="/gestione-api/plugin"
            icona="Settings"
            coloreIcona="text-pending"
            titolo="Gestione Template"
            descrizione="Crea e modifica template dall'interfaccia"
          />
          <DocsCollegamento
            to="/documentazione/plugin"
            icona="Package"
            coloreIcona="text-warning"
            titolo="Plugin JavaScript"
            descrizione="Usa i template con il Plugin FP"
          />
          <DocsCollegamento
            to="/documentazione/api"
            icona="Code"
            coloreIcona="text-info"
            titolo="API Reference"
            descrizione="Endpoint completi filter-templates"
          />
        </div>
      </DocsCapitolo>
    </DocsGuida>
  );
}

export default DocumentazioneFilterTemplatesPage;
