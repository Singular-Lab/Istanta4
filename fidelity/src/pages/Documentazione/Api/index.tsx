import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { Disclosure, Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import TryItPanel from "@/components/TryItPanel";
import { useFetchFieldOptions, useFetchTipiExport } from "@/query/query";
import { useCallback, useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import PageHeader from "../../../components/Base/PageHeader";

// Componente Breadcrumb per navigazione
function DocsBreadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
      <Link to="/documentazione" className="hover:text-primary flex items-center gap-1">
        <Lucide icon="BookOpen" className="w-4 h-4" />
        Documentazione
      </Link>
      <Lucide icon="ChevronRight" className="w-4 h-4" />
      <span className="text-slate-700 font-medium">API REST</span>
    </nav>
  );
}

interface CodeExample {
  language: string;
  label: string;
  code: string;
}

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  auth: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  response: {
    success: any;
    error?: any;
  };
  examples: CodeExample[];
}

interface LoaderData {
  apiKey: string;
  template: Array<{ guidId: string; titolo: string; quantitaKit: number; formatoTemplate: string; codiceFormato: string }>;
}

function DocumentazioneApiPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { apiKey, template } = useLoaderData<LoaderData>();

  const { data: tipiExportData } = useFetchTipiExport();
  const { data: fieldOptions } = useFetchFieldOptions();
  const normalizedFieldOptions = useMemo(
    () => fieldOptions?.map(({ expected_output }) => expected_output) ?? [],
    [fieldOptions]
  );

  const copyToClipboard = useCallback(async (code: string, language: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(`${language}-${code.slice(0, 20)}`);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Errore nella copia:', err);
    }
  }, []);

  const getEndpointType = (path: string): "refs" | "files" | "promo" | "status" => {
    if (path.includes('/refs')) return 'refs';
    if (path.includes('/files')) return 'files';
    if (path.includes('/promo')) return 'promo';
    return 'status';
  };

  const apiEndpoints: ApiEndpoint[] = useMemo(() => [
    {
      method: "POST",
      path: "/external/refs",
      description: "Recupera le referenze dei prodotti basate sui template kit e filtri applicati",
      auth: "API Key (x-api-key header)",
      parameters: [
        {
          name: "template_id",
          type: "string[]",
          required: true,
          description: "Array di ID dei template kit da utilizzare per la ricerca"
        },
        {
          name: "filters",
          type: "FilterCondition[][]",
          required: false,
          description: "Array di gruppi di filtri da applicare alle referenze"
        }
      ],
      response: {
        success: {
          success: true,
          data: {
            conteggio: 150,
            risposta: [
              {
                id_promo: "PROMO_001",
                nome_promo: "Promozione Estate 2024",
                validita_dal: "2024-06-01T00:00:00.000Z",
                validita_al: "2024-08-31T23:59:59.000Z",
                kit: [
                  {
                    id_kit: "KIT_001",
                    id_template: "TEMPLATE_001",
                    id_promo: "PROMO_001",
                    referenze: [
                      {
                        _id: "ref_001",
                        id: "REF_001",
                        compiledFields: { nome: "Prodotto Test", prezzo: 29.99 },
                        foto: ["https://example.com/foto1.jpg"],
                        meccanica: "Sconto 20%",
                        codiceBox: "BOX_001"
                      }
                    ]
                  }
                ]
              }
            ],
            timestamp: "2024-01-15T10:30:00.000Z"
          }
        }
      },
      examples: [
        {
          language: "javascript",
          label: "JavaScript (Fetch)",
          code: `const response = await fetch('${ServerCall.getUrl()}/external/refs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key-here'
  },
  body: JSON.stringify({
    template_id: ['template_001', 'template_002'],
    filters: [
      [
        { field: 'categoria', operator: 'equals', value: 'elettronica' },
        { field: 'prezzo', operator: 'greater_than', value: '50' }
      ]
    ]
  })
});

const data = await response.json();
console.log(data);`
        },
        {
          language: "python",
          label: "Python (Requests)",
          code: `import requests

url = "${ServerCall.getUrl()}/external/refs"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "your-api-key-here"
}
payload = {
    "template_id": ["template_001", "template_002"],
    "filters": [
        [
            {"field": "categoria", "operator": "equals", "value": "elettronica"},
            {"field": "prezzo", "operator": "greater_than", "value": "50"}
        ]
    ]
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print(data)`
        },
        {
          language: "curl",
          label: "cURL",
          code: `curl -X POST "${ServerCall.getUrl()}/external/refs" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: your-api-key-here" \\
  -d '{
    "template_id": ["template_001", "template_002"],
    "filters": [
      [
        {"field": "categoria", "operator": "equals", "value": "elettronica"},
        {"field": "prezzo", "operator": "greater_than", "value": "50"}
      ]
    ]
  }'`
        }
      ]
    },
    {
      method: "GET",
      path: "/external/promo",
      description: "Recupera tutte le promozioni attualmente valide",
      auth: "API Key (x-api-key header)",
      response: {
        success: {
          success: true,
          data: [
            {
              id: "PROMO_001",
              nome: "Promozione Estate 2024",
              validita_dal: "2024-06-01T00:00:00.000Z",
              validita_al: "2024-08-31T23:59:59.000Z",
              is_active: true,
              is_expired: false
            }
          ]
        }
      },
      examples: [
        {
          language: "javascript",
          label: "JavaScript (Fetch)",
          code: `const response = await fetch('${ServerCall.getUrl()}/external/promo', {
  method: 'GET',
  headers: {
    'x-api-key': 'your-api-key-here'
  }
});

const data = await response.json();
console.log(data);`
        },
        {
          language: "curl",
          label: "cURL",
          code: `curl -X GET "${ServerCall.getUrl()}/external/promo" \\
  -H "x-api-key: your-api-key-here"`
        }
      ]
    },
    {
      method: "POST",
      path: "/external/files",
      description: "Recupera i file dal database con filtri avanzati sui metadati",
      auth: "Ephemeral Token (automatico)",
      parameters: [
        {
          name: "tipo_export",
          type: "string[]",
          required: false,
          description: "Array di tipi di file da filtrare (es: ['POP', 'JPG'])"
        },
        {
          name: "filters",
          type: "FilterCondition[][]",
          required: false,
          description: "Array di gruppi di filtri da applicare ai metadati dei files"
        }
      ],
      response: {
        success: {
          success: true,
          data: {
            conteggio: 10,
            files: [
              {
                id: "file_001",
                nome: "promo_estate_2024.POP",
                url: "https://storage.example.com/files/promo_estate_2024.POP",
                tipo_export: "POP",
                meta_olimpo_cloud: {
                  stato: "completed",
                  formato: "POP"
                }
              }
            ]
          }
        }
      },
      examples: [
        {
          language: "javascript",
          label: "JavaScript (Fetch)",
          code: `const response = await fetch('${ServerCall.getUrl()}/external/files', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tipo_export: ['POP', 'JPG'],
    filters: [[
      { field: 'stato', operator: 'equals', value: 'completed' }
    ]]
  })
});

const data = await response.json();
console.log(data);`
        }
      ]
    }
  ], []);

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* Header */}
        <PageHeader
          title="Documentazione Web API"
          description="Reference completa delle API REST"
        />
        {/* Content */}
        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">
            <div className="p-5">
              {/* Breadcrumb */}
              <DocsBreadcrumb />

              {/* Sezione Autenticazione */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Shield" className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Autenticazione</h2>
                </div>
                <div className="box p-6">
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Tutte le API esterne richiedono autenticazione tramite API Key. Invia la tua API Key nell'header <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">x-api-key</code> o <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">api-key</code>.
                  </p>
                </div>
              </div>

              {/* Endpoints API */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Code" className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Endpoints API</h2>
                </div>

                <Disclosure.Group className="space-y-4">
                  {apiEndpoints.map((endpoint, index) => (
                    <Disclosure key={index} className="box overflow-hidden !py-0 !border-0">
                      {({ open }) => (
                        <>
                          <Disclosure.Button className="w-full text-left p-5 hover:bg-slate-50 dark:hover:bg-darkmode-600 transition-colors !py-5">
                            <div className="flex items-center gap-4 flex-1">
                              <span className={`px-3 py-1 rounded-md text-sm font-medium ${endpoint.method === 'GET'
                                ? 'bg-success/10 text-success border border-success/20'
                                : 'bg-primary/10 text-primary border border-primary/20'
                                }`}>
                                {endpoint.method}
                              </span>
                              <code className="text-base font-mono text-slate-900 dark:text-slate-100">{endpoint.path}</code>
                              <Lucide
                                icon="ChevronDown"
                                className={`w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform duration-200 ml-auto ${open ? 'rotate-180' : ''}`}
                              />
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm">{endpoint.description}</p>
                          </Disclosure.Button>
                          <Disclosure.Panel className="border-t border-slate-200 dark:border-darkmode-400 !mt-0">
                            <div className="p-6 bg-slate-50 dark:bg-darkmode-600">
                              {/* Parametri */}
                              {endpoint.parameters && endpoint.parameters.length > 0 && (
                                <div className="mb-6">
                                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Parametri</h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-slate-200 dark:border-darkmode-400">
                                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Nome</th>
                                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Tipo</th>
                                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Richiesto</th>
                                          <th className="text-left py-2 font-medium text-slate-900 dark:text-slate-100">Descrizione</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {endpoint.parameters.map((param, paramIndex) => (
                                          <tr key={paramIndex} className="border-b border-slate-100 dark:border-darkmode-400">
                                            <td className="py-2">
                                              <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">{param.name}</code>
                                            </td>
                                            <td className="py-2 text-slate-600 dark:text-slate-300">{param.type}</td>
                                            <td className="py-2">
                                              <span className={`px-2 py-1 rounded text-xs ${param.required
                                                ? 'bg-danger/10 text-danger border border-danger/20'
                                                : 'bg-slate-100 text-slate-800 dark:bg-darkmode-400 dark:text-slate-300'
                                                }`}>
                                                {param.required ? 'Sì' : 'No'}
                                              </span>
                                            </td>
                                            <td className="py-2 text-slate-600 dark:text-slate-300">{param.description}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Esempi di Codice */}
                              <div className="mb-6">
                                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Esempi di Codice</h4>
                                <Tab.Group>
                                  <Tab.List variant="boxed-tabs" className="mb-4">
                                    {endpoint.examples.map((example) => (
                                      <Tab key={example.label}>
                                        <Tab.Button className="w-full py-2" as="button">
                                          {example.label}
                                        </Tab.Button>
                                      </Tab>
                                    ))}
                                  </Tab.List>
                                  <Tab.Panels className="mt-5">
                                    {endpoint.examples.map((example) => (
                                      <Tab.Panel key={example.label} className="leading-relaxed">
                                        <div className="border border-slate-200 dark:border-darkmode-400 rounded-lg overflow-hidden">
                                          <div className="bg-slate-100 dark:bg-darkmode-400 px-4 py-2 flex items-center justify-between">
                                            <span className="font-medium text-slate-900 dark:text-slate-100">{example.label}</span>
                                            <Button
                                              variant="primary"
                                              size="sm"
                                              onClick={() => copyToClipboard(example.code, example.language)}
                                            >
                                              {copiedCode === `${example.language}-${example.code.slice(0, 20)}` ? (
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
                                            <code className="text-sm font-mono">{example.code}</code>
                                          </pre>
                                        </div>
                                      </Tab.Panel>
                                    ))}
                                  </Tab.Panels>
                                </Tab.Group>
                              </div>

                              {/* Risposta */}
                              <div className="mb-6">
                                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Risposta di Successo</h4>
                                <div className="border border-slate-200 dark:border-darkmode-400 rounded-lg overflow-hidden">
                                  <div className="bg-success/10 px-4 py-2 border-b border-slate-200 dark:border-darkmode-400">
                                    <span className="text-success font-medium">200 OK</span>
                                  </div>
                                  <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto max-h-80 overflow-y-auto">
                                    <code className="text-sm font-mono">{JSON.stringify(endpoint.response.success, null, 2)}</code>
                                  </pre>
                                </div>
                              </div>

                              {/* Try It Panel */}
                              <TryItPanel
                                endpoint={endpoint.path}
                                method={endpoint.method as "GET" | "POST"}
                                apiKey={apiKey}
                                templates={template}
                                tipiExport={tipiExportData || []}
                                fieldOptions={normalizedFieldOptions}
                                endpointType={getEndpointType(endpoint.path)}
                              />
                            </div>
                          </Disclosure.Panel>
                        </>
                      )}
                    </Disclosure>
                  ))}
                </Disclosure.Group>
              </div>

              {/* Sezione Filtri */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Database" className="w-6 h-6 text-pending" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Filtri Avanzati</h2>
                </div>
                <div className="box p-6">
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    L'endpoint <code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded text-sm font-mono">/api/external/refs</code> supporta filtri avanzati per raffinare i risultati.
                  </p>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Operatori Supportati</h4>
                      <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <li><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">equals</code> - Uguale a</li>
                        <li><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">not_equals</code> - Diverso da</li>
                        <li><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">greater_than</code> - Maggiore di</li>
                        <li><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">less_than</code> - Minore di</li>
                        <li><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">contains</code> - Contiene</li>
                        <li><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">not_contains</code> - Non contiene</li>
                        <li><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">in</code> - In lista</li>
                        <li><code className="bg-slate-100 dark:bg-darkmode-400 px-2 py-1 rounded font-mono">not_in</code> - Non in lista</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Esempio Filtro Complesso</h4>
                      <pre className="bg-slate-900 text-slate-100 p-4 rounded text-sm overflow-x-auto">
                        <code className="font-mono">{`{
  "template_id": ["template_001"],
  "filters": [
    [
      { "field": "categoria", "operator": "equals", "value": "elettronica" },
      { "field": "prezzo", "operator": "greater_than", "value": "100" }
    ],
    [
      { "field": "marca", "operator": "in", "value": "Samsung,Apple,Sony" }
    ]
  ]
}`}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sezione Errori */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Shield" className="w-6 h-6 text-danger" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Gestione Errori</h2>
                </div>
                <div className="box p-6">
                  <div className="space-y-4">
                    <Alert variant="danger" className="mb-0">
                      <div className="mb-3">
                        <h4 className="font-semibold text-lg mb-1">401 Unauthorized</h4>
                        <p className="text-sm">API Key mancante o non valida</p>
                      </div>
                      <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
                        <code className="font-mono">{`{
  "success": false,
  "error": "UnauthorizedError",
  "message": "API Key richiesta per accedere a questo endpoint"
}`}</code>
                      </pre>
                    </Alert>

                    <Alert variant="warning" className="mb-0">
                      <div className="mb-3">
                        <h4 className="font-semibold text-lg mb-1">400 Bad Request</h4>
                        <p className="text-sm">Parametri mancanti o non validi</p>
                      </div>
                      <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
                        <code className="font-mono">{`{
  "success": false,
  "error": "BadRequestError",
  "message": "è obbligatorio selezionare almeno un template kit"
}`}</code>
                      </pre>
                    </Alert>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentazioneApiPage;
