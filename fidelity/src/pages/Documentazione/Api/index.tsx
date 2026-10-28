import Alert from "@/components/Base/Alert";
import Badge from "@/components/Base/Badge";
import { FormHelp, FormInput, FormLabel } from "@/components/Base/Form";
import { Disclosure, Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Table from "@/components/Base/Table";
import TryItPanel from "@/components/TryItPanel";
import { useFetchFieldOptions, useFetchTipiExport } from "@/query/query";
import { useMemo, useState } from "react";
import { useLoaderData } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import { CodeBlock, DocsCapitolo, DocsCard, DocsGuida } from "../DocsCondivisi";

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
  template: Array<{ guidId: string; titolo: string; quantitaKit: number; formatoTemplate: string; codiceFormato: string }>;
}

function DocumentazioneApiPage() {
  const { template } = useLoaderData<LoaderData>();
  // Il server non restituisce più la chiave salvata: per "Prova questo endpoint"
  // la si incolla qui, e resta solo nello stato della pagina.
  const [chiaveProva, setChiaveProva] = useState("");

  const { data: tipiExportData } = useFetchTipiExport();
  const { data: fieldOptions } = useFetchFieldOptions();
  const normalizedFieldOptions = useMemo(
    () => fieldOptions?.map(({ expected_output }) => expected_output) ?? [],
    [fieldOptions]
  );

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
    'x-api-key': 'LA_TUA_API_KEY'
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
    "x-api-key": "LA_TUA_API_KEY"
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
  -H "x-api-key: LA_TUA_API_KEY" \\
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
    'x-api-key': 'LA_TUA_API_KEY'
  }
});

const data = await response.json();
console.log(data);`
        },
        {
          language: "curl",
          label: "cURL",
          code: `curl -X GET "${ServerCall.getUrl()}/external/promo" \\
  -H "x-api-key: LA_TUA_API_KEY"`
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

  const codice = "rounded-control bg-slate-100 px-2 py-1 font-mono text-sm";

  return (
    <DocsGuida titolo="Documentazione Web API" descrizione="Reference completa delle API REST" corrente="API REST">
      {/* Sezione Autenticazione */}
      <DocsCapitolo icona="Shield" coloreIcona="text-primary" titolo="Autenticazione">
        <DocsCard>
          <p className="text-slate-600">
            Tutte le API esterne richiedono autenticazione tramite API Key. Invia la tua API Key nell'header <code className={codice}>x-api-key</code> o <code className={codice}>api-key</code>.
          </p>
          <div className="mt-4">
            <FormLabel htmlFor="api-key-prova">API Key per provare gli endpoint</FormLabel>
            <FormInput
              id="api-key-prova"
              type="password"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="api-key-prova-aiuto"
              value={chiaveProva}
              onChange={(e) => setChiaveProva(e.target.value)}
              placeholder="Incolla qui la tua API Key"
              className="w-full font-mono"
            />
            <FormHelp id="api-key-prova-aiuto">
              La chiave è mostrata una sola volta, quando la generi: incolla quella che usa la tua integrazione.
              Non viene salvata e serve solo ai pannelli "Prova questo endpoint".
            </FormHelp>
          </div>
        </DocsCard>
      </DocsCapitolo>

      {/* Endpoints API */}
      <DocsCapitolo icona="Code" coloreIcona="text-success" titolo="Endpoints API">
        <Disclosure.Group className="space-y-4">
          {apiEndpoints.map((endpoint, index) => (
            <Disclosure
              key={index}
              className="overflow-hidden rounded-card border border-slate-200 bg-white !py-0 first:mt-0 last:mb-0"
            >
              {({ open }) => (
                <>
                  <Disclosure.Button className="w-full p-5 text-left transition-colors hover:bg-slate-50 !py-5">
                    <div className="flex flex-1 items-center gap-4">
                      <Badge variant={endpoint.method === "GET" ? "success" : "primary"} border>
                        {endpoint.method}
                      </Badge>
                      <code className="font-mono text-base text-slate-800">{endpoint.path}</code>
                      <Lucide
                        icon="ChevronDown"
                        aria-hidden="true"
                        className={`ml-auto h-5 w-5 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      />
                    </div>
                    <p className="mt-2 text-sm font-normal text-slate-600">{endpoint.description}</p>
                  </Disclosure.Button>
                  <Disclosure.Panel className="!mt-0 border-t border-slate-200">
                    <div className="bg-slate-50 p-5">
                      {/* Parametri */}
                      {endpoint.parameters && endpoint.parameters.length > 0 && (
                        <div className="mb-6">
                          <h3 className="title-card mb-3">Parametri</h3>
                          <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
                            <Table className="text-sm">
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>Nome</Table.Th>
                                  <Table.Th>Tipo</Table.Th>
                                  <Table.Th>Richiesto</Table.Th>
                                  <Table.Th>Descrizione</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {endpoint.parameters.map((param, paramIndex) => (
                                  <Table.Tr key={paramIndex}>
                                    <Table.Td>
                                      <code className={codice}>{param.name}</code>
                                    </Table.Td>
                                    <Table.Td className="text-slate-600">{param.type}</Table.Td>
                                    <Table.Td>
                                      <Badge variant={param.required ? "error" : "secondary"} size="sm">
                                        {param.required ? "Sì" : "No"}
                                      </Badge>
                                    </Table.Td>
                                    <Table.Td className="text-slate-600">{param.description}</Table.Td>
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* Esempi di Codice */}
                      <div className="mb-6">
                        <h3 className="title-card mb-3">Esempi di Codice</h3>
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
                          <Tab.Panels>
                            {endpoint.examples.map((example) => (
                              <Tab.Panel key={example.label} className="leading-relaxed">
                                <CodeBlock language={example.label} code={example.code} />
                              </Tab.Panel>
                            ))}
                          </Tab.Panels>
                        </Tab.Group>
                      </div>

                      {/* Risposta */}
                      <div className="mb-6">
                        <h3 className="title-card mb-3">Risposta di Successo</h3>
                        <div className="overflow-hidden rounded-card border border-slate-200">
                          <div className="border-b border-slate-200 bg-success/10 px-4 py-2">
                            <span className="font-medium text-success">200 OK</span>
                          </div>
                          <pre className="max-h-80 overflow-x-auto overflow-y-auto bg-slate-900 p-4 text-slate-100">
                            <code className="font-mono text-sm">{JSON.stringify(endpoint.response.success, null, 2)}</code>
                          </pre>
                        </div>
                      </div>

                      {/* Try It Panel */}
                      <TryItPanel
                        endpoint={endpoint.path}
                        method={endpoint.method as "GET" | "POST"}
                        apiKey={chiaveProva.trim() || undefined}
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
      </DocsCapitolo>

      {/* Sezione Filtri */}
      <DocsCapitolo icona="Database" coloreIcona="text-pending" titolo="Filtri Avanzati">
        <DocsCard>
          <p className="mb-4 text-slate-600">
            L'endpoint <code className={codice}>/api/external/refs</code> supporta filtri avanzati per raffinare i risultati.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="title-card mb-3">Operatori Supportati</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><code className={codice}>equals</code> - Uguale a</li>
                <li><code className={codice}>not_equals</code> - Diverso da</li>
                <li><code className={codice}>greater_than</code> - Maggiore di</li>
                <li><code className={codice}>less_than</code> - Minore di</li>
                <li><code className={codice}>contains</code> - Contiene</li>
                <li><code className={codice}>not_contains</code> - Non contiene</li>
                <li><code className={codice}>in</code> - In lista</li>
                <li><code className={codice}>not_in</code> - Non in lista</li>
              </ul>
            </div>

            <div>
              <h3 className="title-card mb-3">Esempio Filtro Complesso</h3>
              <CodeBlock
                language="JSON"
                code={`{
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
}`}
              />
            </div>
          </div>
        </DocsCard>
      </DocsCapitolo>

      {/* Sezione Errori */}
      <DocsCapitolo icona="Shield" coloreIcona="text-danger" titolo="Gestione Errori">
        <div className="space-y-4">
          <Alert variant="soft-danger" icona="OctagonAlert" titolo="401 Unauthorized" className="mb-0">
            <p className="mb-3 text-sm">API Key mancante o non valida</p>
            <pre className="overflow-x-auto rounded-control bg-slate-900 p-3 text-sm text-slate-100">
              <code className="font-mono">{`{
  "success": false,
  "error": "UnauthorizedError",
  "message": "API Key richiesta per accedere a questo endpoint"
}`}</code>
            </pre>
          </Alert>

          <Alert variant="soft-warning" icona="TriangleAlert" titolo="400 Bad Request" className="mb-0">
            <p className="mb-3 text-sm">Parametri mancanti o non validi</p>
            <pre className="overflow-x-auto rounded-control bg-slate-900 p-3 text-sm text-slate-100">
              <code className="font-mono">{`{
  "success": false,
  "error": "BadRequestError",
  "message": "è obbligatorio selezionare almeno un template kit"
}`}</code>
            </pre>
          </Alert>
        </div>
      </DocsCapitolo>
    </DocsGuida>
  );
}

export default DocumentazioneApiPage;
