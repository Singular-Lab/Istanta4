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
      <span className="text-slate-700 dark:text-slate-200 font-medium">Template Filtri</span>
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

function DocumentazioneFilterTemplatesPage() {
  const baseUrl = ServerCall.getUrl();

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* Header */}
        <PageHeader
          title="Template Filtri"
          description="Crea configurazioni riutilizzabili con il sistema slug-based"
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
                  <Lucide icon="Filter" className="w-6 h-6 text-pending" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Cosa sono i Template Filtri
                  </h2>
                </div>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    I <strong>Template Filtri</strong> (o Filter Templates) permettono di salvare
                    configurazioni di filtri, template e opzioni di visualizzazione in modo riutilizzabile.
                    Ogni configurazione è accessibile tramite uno <strong>slug</strong> univoco,
                    un identificatore URL-safe che evita di esporre ID interni.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-6">
                  <div className="box p-4 border-l-4 border-pending">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <Lucide icon="Bookmark" className="w-5 h-5 text-pending" />
                      Configurazioni Salvate
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Salva filtri, template_id, tipo rendering e opzioni carousel in un unico oggetto
                    </p>
                  </div>
                  <div className="box p-4 border-l-4 border-info">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <Lucide icon="Link" className="w-5 h-5 text-info" />
                      Accesso via Slug
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Usa slug leggibili come "promo-estate-2024" invece di UUID complessi
                    </p>
                  </div>
                  <div className="box p-4 border-l-4 border-success">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <Lucide icon="History" className="w-5 h-5 text-success" />
                      Versioning
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Storico delle modifiche con possibilità di ripristinare versioni precedenti
                    </p>
                  </div>
                </div>
              </section>

              {/* Struttura Template */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="FileCode" className="w-6 h-6 text-info" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Struttura di un Template
                  </h2>
                </div>

                <div className="box p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-darkmode-400">
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Campo</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Tipo</th>
                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Descrizione</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">nome</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Nome descrittivo del template</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">slug</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Identificatore URL-safe univoco (es. "promo-estate")</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">endpoint_type</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">"refs" | "refs-html" | "files"</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Tipo di endpoint (refs-html è per uso interno del plugin)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">render_type</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">"grid" | "carousel" | "list"</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Layout di visualizzazione</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">template_ids</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string[]</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Array di ID template kit (per refs)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">export_codes</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">string[]</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Array di codici export (per files: "POP", "PDF", ecc.)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">filters</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">FilterCondition[][]</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Gruppi di filtri (AND tra gruppi, OR dentro gruppo)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">carousel_options</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">object</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">autoScroll, scrollSpeed, ecc. (opzionale)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-darkmode-400">
                          <td className="py-3"><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">is_active</code></td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">boolean</td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">Se false, il template non è accessibile pubblicamente</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* Creazione Template */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Plus" className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Creazione di un Template
                  </h2>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none mb-6">
                  <p className="text-slate-600 dark:text-slate-300">
                    Puoi creare template tramite l'interfaccia grafica o via API REST.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Lucide icon="MousePointer" className="w-5 h-5 text-primary" />
                      Via Interfaccia Grafica
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      Usa il pannello di configurazione plugin per creare e modificare template
                      con un'interfaccia intuitiva.
                    </p>
                    <Link
                      to="/gestione-api/plugin"
                      className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm"
                    >
                      <Lucide icon="Settings" className="w-4 h-4" />
                      Apri Configurazione Plugin
                    </Link>
                  </div>

                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Lucide icon="Code" className="w-5 h-5 text-info" />
                      Via API REST
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      Crea template programmaticamente con una chiamata POST all'endpoint dedicato.
                    </p>
                    <code className="text-xs bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded">
                      POST /external/filter-templates
                    </code>
                  </div>
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
              </section>

              {/* Utilizzo via Slug */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Link" className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Utilizzo via Slug
                  </h2>
                </div>

                <Alert variant="outline-warning" className="mb-6">
                  <div className="flex items-start gap-3">
                    <Lucide icon="Info" className="w-5 h-5 mt-0.5" />
                    <div>
                      <p className="text-sm">
                        Lo slug è pubblico e non richiede autenticazione. Questo permette al Plugin
                        JavaScript di caricare la configurazione senza esporre API keys nel browser.
                      </p>
                    </div>
                  </div>
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
              </section>

              {/* Esempi Pratici */}
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Lightbulb" className="w-6 h-6 text-warning" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Esempi Pratici
                  </h2>
                </div>

                <div className="space-y-6">
                  {/* Esempio 1 */}
                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Lucide icon="ShoppingCart" className="w-5 h-5 text-success" />
                      E-commerce: Vetrina Prodotti
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      Mostra le offerte settimanali in una griglia responsive sul tuo sito e-commerce.
                    </p>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded text-xs overflow-x-auto">
                      {`{
  "nome": "Offerte Settimanali",
  "slug": "offerte-settimanali",
  "endpoint_type": "refs-html",
  "render_type": "grid",
  "template_ids": ["TEMPLATE_OFFERTE"],
  "filters": [
    [{ "field": "in_evidenza", "operator": "equals", "value": "true" }]
  ]
}`}
                    </pre>
                  </div>

                  {/* Esempio 2 */}
                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Lucide icon="Monitor" className="w-5 h-5 text-info" />
                      Digital Signage: Carousel Automatico
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      Scorri automaticamente i volantini PDF su schermi in negozio.
                    </p>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded text-xs overflow-x-auto">
                      {`{
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
                    </pre>
                  </div>

                  {/* Esempio 3 */}
                  <div className="box p-5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Lucide icon="Smartphone" className="w-5 h-5 text-warning" />
                      App Mobile: Lista Categorie
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      Recupera JSON delle referenze per rendering custom nell'app.
                    </p>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded text-xs overflow-x-auto">
                      {`{
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
                    </pre>
                  </div>
                </div>
              </section>

              {/* Best Practices */}
              <section className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="CircleCheck" className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Best Practices
                  </h2>
                </div>

                <div className="box p-6">
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-900 dark:text-slate-100">Slug descrittivi</strong>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          Usa slug leggibili come "promo-estate-2024" invece di "template1". Facilita
                          il debugging e la comunicazione con il team.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-900 dark:text-slate-100">Un template per caso d'uso</strong>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          Crea template separati per contesti diversi (homepage, app, totem) invece di
                          riutilizzare lo stesso ovunque.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-900 dark:text-slate-100">Testa prima di attivare</strong>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          Crea il template con <code>is_active: false</code>, verifica che funzioni,
                          poi attivalo.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-900 dark:text-slate-100">Versioning consapevole</strong>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          Prima di modifiche importanti, annota cosa stai cambiando. Il sistema salva
                          automaticamente le versioni, ma un commento aiuta a ricordare il motivo.
                        </p>
                      </div>
                    </li>
                  </ul>
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
                    to="/gestione-api/plugin"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <Lucide icon="Settings" className="w-8 h-8 text-pending mb-2" />
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">
                      Gestione Template
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Crea e modifica template dall'interfaccia
                    </p>
                  </Link>
                  <Link
                    to="/documentazione/plugin"
                    className="box p-4 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors group"
                  >
                    <Lucide icon="Package" className="w-8 h-8 text-warning mb-2" />
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary">
                      Plugin JavaScript
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Usa i template con il Plugin FP
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
                      Endpoint completi filter-templates
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

export default DocumentazioneFilterTemplatesPage;
