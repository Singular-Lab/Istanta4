import Alert from "@/components/Base/Alert";
import Badge from "@/components/Base/Badge";
import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Table from "@/components/Base/Table";
import { Link } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import { CodeBlock, DocsCapitolo, DocsGuida } from "../DocsCondivisi";

function DocumentazionePluginPage() {
  const baseUrl = ServerCall.getUrl();

  return (
    <DocsGuida
      titolo="Documentazione Plugin"
      descrizione="Guida all'integrazione del Plugin JavaScript FP"
      corrente="Plugin JavaScript"
    >

              {/* Introduzione */}
              <DocsCapitolo icona="Package" coloreIcona="text-info" titolo="Plugin JavaScript (FP)">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <p className="text-slate-600 mb-4">
                    Il plugin FP permette di integrare facilmente i contenuti di Istanta 2 GDO Suite nel tuo sito web.
                    Il plugin gestisce automaticamente l'autenticazione tramite <strong>Ephemeral Token</strong> e il rendering dei contenuti.
                  </p>
                  <Alert variant="soft-primary" icona="Info" titolo="Architettura Slug-Based" className="mt-4">
                    <p className="text-sm">
                      Il plugin richiede obbligatoriamente uno <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">slug</code> per
                      caricare la configurazione dal server. La configurazione (tipo layout, modalità, filtri, ecc.) viene definita tramite
                      i <Link to="/documentazione/filter-templates" className="text-primary hover:underline">Filter Templates</Link>.
                    </p>
                  </Alert>
                </div>
              </DocsCapitolo>

              {/* Installazione */}
              <DocsCapitolo icona="Download" coloreIcona="text-success" titolo="Installazione">
                <div className="space-y-4 rounded-card border border-slate-200 bg-white p-4">
                  <CodeBlock language="Browser (IIFE)" code={`<script src="https://cdn.istn.it/1.0.0/index.global.js"></script>`} />
                </div>
              </DocsCapitolo>

              {/* Utilizzo Base */}
              <DocsCapitolo icona="Code" coloreIcona="text-primary" titolo="Utilizzo Base">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <p className="text-slate-600 mb-4">
                    L'inizializzazione richiede solo <strong>url</strong>, <strong>container</strong> e <strong>slug</strong>.
                    Tutte le altre impostazioni vengono caricate automaticamente dal Filter Template associato allo slug.
                  </p>
                  <CodeBlock language="JavaScript" code={`// 1. Crea istanza del plugin
const fp = new FP();

// 2. Inizializza con lo slug (OBBLIGATORIO)
await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024'  // Lo slug del Filter Template
});

// 3. Renderizza i contenuti
await fp.render();`} />
                </div>
              </DocsCapitolo>

              {/* FPOptions - Opzioni di Inizializzazione */}
              <DocsCapitolo icona="Settings" coloreIcona="text-info" titolo="FPOptions - Opzioni di Inizializzazione">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <p className="text-slate-600 mb-4">
                    Queste sono le opzioni che puoi passare al metodo <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">init()</code>.
                  </p>
                  <Alert variant="soft-warning" icona="Lightbulb" titolo="Suggerimento" className="mb-4">
                    <p className="text-sm">
                      Se la query non restituisce referenze e desideri nascondere elementi non necessari, puoi aggiungere agli elementi interessati
                      un attributo personalizzato composto da <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">fp-</code> seguito dallo slug.
                      Ad esempio <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">fp-test-of</code> farà sì che l’elemento venga nascosto
                      automaticamente quando non sono disponibili dati per quello slug.
                    </p>
                  </Alert>
                  <div className="overflow-x-auto">
                    <Table className="text-sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Opzione</Table.Th>
                          <Table.Th>Tipo</Table.Th>
                          <Table.Th>Richiesto</Table.Th>
                          <Table.Th>Descrizione</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">url</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td><Badge variant="error" size="sm">Sì</Badge></Table.Td>
                          <Table.Td className="text-slate-600">URL base del server API</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">container</code></Table.Td>
                          <Table.Td className="text-slate-600">HTMLDivElement</Table.Td>
                          <Table.Td><Badge variant="error" size="sm">Sì</Badge></Table.Td>
                          <Table.Td className="text-slate-600">Elemento DOM in cui renderizzare</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">slug</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td><Badge variant="error" size="sm">Sì</Badge></Table.Td>
                          <Table.Td className="text-slate-600">Slug del Filter Template da caricare</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">version</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td><Badge variant="secondary" size="sm">No</Badge></Table.Td>
                          <Table.Td className="text-slate-600">Versione del plugin (default: '1.0.0')</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">templateVersion</code></Table.Td>
                          <Table.Td className="text-slate-600">number</Table.Td>
                          <Table.Td><Badge variant="secondary" size="sm">No</Badge></Table.Td>
                          <Table.Td className="text-slate-600">Versione specifica del template da caricare</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">styles</code></Table.Td>
                          <Table.Td className="text-slate-600">FPStyles</Table.Td>
                          <Table.Td><Badge variant="secondary" size="sm">No</Badge></Table.Td>
                          <Table.Td className="text-slate-600">Opzioni di stile personalizzate</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">classNames</code></Table.Td>
                          <Table.Td className="text-slate-600">FPClassNames</Table.Td>
                          <Table.Td><Badge variant="secondary" size="sm">No</Badge></Table.Td>
                          <Table.Td className="text-slate-600">Classi CSS custom</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">shadowStyles</code></Table.Td>
                          <Table.Td className="text-slate-600">string[]</Table.Td>
                          <Table.Td><Badge variant="secondary" size="sm">No</Badge></Table.Td>
                          <Table.Td className="text-slate-600">URL di stylesheet aggiuntivi da caricare nel Shadow DOM</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">shadowStyles</code></Table.Td>
                          <Table.Td className="text-slate-600">string[]</Table.Td>
                          <Table.Td><Badge variant="secondary" size="sm">No</Badge></Table.Td>
                          <Table.Td className="text-slate-600">URL di stylesheet aggiuntivi da caricare nel Shadow DOM</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">responsive</code></Table.Td>
                          <Table.Td className="text-slate-600">{`Record<number, Partial<FPStyles>>`}</Table.Td>
                          <Table.Td><Badge variant="secondary" size="sm">No</Badge></Table.Td>
                          <Table.Td className="text-slate-600">
                            Mappa di breakpoint (in px) a configurazioni parziali di stile. Ogni voce sovrascrive dinamicamente le opzioni di
                            <code className="rounded-control bg-slate-100 px-2 py-0.5 font-mono ml-1">styles</code> quando la viewport è minore o uguale al breakpoint.
                          </Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </div>
                </div>
              </DocsCapitolo>

              {/* FpOptionsQuery - Configurazione dal Server */}
              <DocsCapitolo icona="Server" coloreIcona="text-warning" titolo="FpOptionsQuery - Configurazione dal Server">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <p className="text-slate-600 mb-4">
                    Queste opzioni vengono caricate automaticamente dal Filter Template tramite lo slug.
                    Puoi accedervi in sola lettura tramite <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">fp.optionsQuery</code>.
                  </p>
                  <div className="overflow-x-auto">
                    <Table className="text-sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Proprietà</Table.Th>
                          <Table.Th>Tipo</Table.Th>
                          <Table.Th>Descrizione</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">type</code></Table.Td>
                          <Table.Td className="text-slate-600">'grid' | 'carousel' | 'list'</Table.Td>
                          <Table.Td className="text-slate-600">Tipologia di rendering</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">mode</code></Table.Td>
                          <Table.Td className="text-slate-600">'refs' | 'refs-html' | 'files'</Table.Td>
                          <Table.Td className="text-slate-600">Modalità di fetch dati</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">filters</code></Table.Td>
                          <Table.Td className="text-slate-600">FilterCondition[][]</Table.Td>
                          <Table.Td className="text-slate-600">Filtri avanzati per le query</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">tipo_export</code></Table.Td>
                          <Table.Td className="text-slate-600">string[]</Table.Td>
                          <Table.Td className="text-slate-600">Tipi di export da filtrare (solo per mode: 'files')</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">template_id</code></Table.Td>
                          <Table.Td className="text-slate-600">string[]</Table.Td>
                          <Table.Td className="text-slate-600">Template ID da caricare (solo per mode: 'refs' e 'refs-html')</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">autoScroll</code></Table.Td>
                          <Table.Td className="text-slate-600">boolean</Table.Td>
                          <Table.Td className="text-slate-600">Abilita auto-scroll per carousel (default: true)</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">scrollSpeed</code></Table.Td>
                          <Table.Td className="text-slate-600">number</Table.Td>
                          <Table.Td className="text-slate-600">Velocità auto-scroll in ms (default: 5000)</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">showIndicators</code></Table.Td>
                          <Table.Td className="text-slate-600">boolean</Table.Td>
                          <Table.Td className="text-slate-600">Mostra indicatori carousel (default: true)</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">showNavButtons</code></Table.Td>
                          <Table.Td className="text-slate-600">boolean</Table.Td>
                          <Table.Td className="text-slate-600">Mostra bottoni navigazione carousel (default: true)</Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </div>
                </div>
              </DocsCapitolo>

              {/* FPStyles - Opzioni di Stile */}
              <DocsCapitolo icona="Palette" coloreIcona="text-pending" titolo="FPStyles - Opzioni di Stile">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <p className="text-slate-600 mb-4">
                    Opzioni per personalizzare l'aspetto del plugin.
                  </p>
                  <div className="overflow-x-auto">
                    <Table className="text-sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Proprietà</Table.Th>
                          <Table.Th>Tipo</Table.Th>
                          <Table.Th>Default</Table.Th>
                          <Table.Th>Descrizione</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">gap</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'12px'</Table.Td>
                          <Table.Td className="text-slate-600">Gap tra elementi</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">scale</code></Table.Td>
                          <Table.Td className="text-slate-600">number</Table.Td>
                          <Table.Td className="text-slate-600">1</Table.Td>
                          <Table.Td className="text-slate-600">Scala elementi</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">maxWidth</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'100%'</Table.Td>
                          <Table.Td className="text-slate-600">Larghezza massima</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">padding</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'16px'</Table.Td>
                          <Table.Td className="text-slate-600">Padding interno</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">grid</code></Table.Td>
                          <Table.Td className="text-slate-600">FPGridStyles</Table.Td>
                          <Table.Td className="text-slate-600">-</Table.Td>
                          <Table.Td className="text-slate-600">Opzioni specifiche per griglia</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">carousel</code></Table.Td>
                          <Table.Td className="text-slate-600">FPCarouselStyles</Table.Td>
                          <Table.Td className="text-slate-600">-</Table.Td>
                          <Table.Td className="text-slate-600">Opzioni specifiche per carousel</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">responsive</code></Table.Td>
                          <Table.Td className="text-slate-600">{`{ [breakpoint: number]: Partial<FPStyles> }`}</Table.Td>
                          <Table.Td className="text-slate-600">-</Table.Td>
                          <Table.Td className="text-slate-600">Breakpoint responsive</Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </div>
                </div>
              </DocsCapitolo>

              {/* FPGridStyles */}
              <DocsCapitolo icona="LayoutGrid" coloreIcona="text-success" titolo="FPGridStyles - Opzioni Griglia">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <div className="overflow-x-auto">
                    <Table className="text-sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Proprietà</Table.Th>
                          <Table.Th>Tipo</Table.Th>
                          <Table.Th>Default</Table.Th>
                          <Table.Th>Descrizione</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">columns</code></Table.Td>
                          <Table.Td className="text-slate-600">string | number</Table.Td>
                          <Table.Td className="text-slate-600">'auto-fill'</Table.Td>
                          <Table.Td className="text-slate-600">Numero colonne o 'auto-fill'</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">minItemWidth</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'280px'</Table.Td>
                          <Table.Td className="text-slate-600">Larghezza minima item</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">maxItems</code></Table.Td>
                          <Table.Td className="text-slate-600">number</Table.Td>
                          <Table.Td className="text-slate-600">0 (nessun limite)</Table.Td>
                          <Table.Td className="text-slate-600">Massimo numero di items visibili</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">itemHeight</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'auto'</Table.Td>
                          <Table.Td className="text-slate-600">Altezza item</Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </div>
                </div>
              </DocsCapitolo>

              {/* FPCarouselStyles */}
              <DocsCapitolo icona="GalleryHorizontal" coloreIcona="text-primary" titolo="FPCarouselStyles - Opzioni Carousel">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <div className="overflow-x-auto">
                    <Table className="text-sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Proprietà</Table.Th>
                          <Table.Th>Tipo</Table.Th>
                          <Table.Th>Default</Table.Th>
                          <Table.Th>Descrizione</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">itemWidth</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'280px'</Table.Td>
                          <Table.Td className="text-slate-600">Larghezza item</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">itemMaxWidth</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'400px'</Table.Td>
                          <Table.Td className="text-slate-600">Larghezza massima item</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">snapAlign</code></Table.Td>
                          <Table.Td className="text-slate-600">'start' | 'center' | 'end'</Table.Td>
                          <Table.Td className="text-slate-600">'start'</Table.Td>
                          <Table.Td className="text-slate-600">Allineamento snap</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">scrollBehavior</code></Table.Td>
                          <Table.Td className="text-slate-600">'smooth' | 'auto'</Table.Td>
                          <Table.Td className="text-slate-600">'smooth'</Table.Td>
                          <Table.Td className="text-slate-600">Comportamento scroll</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">transitionDuration</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'0.4s'</Table.Td>
                          <Table.Td className="text-slate-600">Durata transizione</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">indicatorColor</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'rgba(0, 0, 0, 0.3)'</Table.Td>
                          <Table.Td className="text-slate-600">Colore indicatori</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">indicatorActiveColor</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'rgba(0, 0, 0, 0.7)'</Table.Td>
                          <Table.Td className="text-slate-600">Colore indicatore attivo</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">navSize</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'40px'</Table.Td>
                          <Table.Td className="text-slate-600">Dimensione bottoni navigazione</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">navBg</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'rgba(255, 255, 255, 0.9)'</Table.Td>
                          <Table.Td className="text-slate-600">Background bottoni navigazione</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">navBgHover</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'#fff'</Table.Td>
                          <Table.Td className="text-slate-600">Background bottoni hover</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">navColor</code></Table.Td>
                          <Table.Td className="text-slate-600">string</Table.Td>
                          <Table.Td className="text-slate-600">'rgba(0, 0, 0, 0.6)'</Table.Td>
                          <Table.Td className="text-slate-600">Colore icone navigazione</Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </div>
                </div>
              </DocsCapitolo>

              {/* FPClassNames */}
              <DocsCapitolo icona="Hash" coloreIcona="text-info" titolo="FPClassNames - Classi CSS Custom">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <p className="text-slate-600 mb-4">
                    Permette di personalizzare le classi CSS degli elementi principali.
                  </p>
                  <div className="overflow-x-auto">
                    <Table className="text-sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Proprietà</Table.Th>
                          <Table.Th>Default</Table.Th>
                          <Table.Th>Descrizione</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">refsRoot</code></Table.Td>
                          <Table.Td className="text-slate-600">'fp-refs-root'</Table.Td>
                          <Table.Td className="text-slate-600">Classe per il root container</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">refsWrapper</code></Table.Td>
                          <Table.Td className="text-slate-600">'fp-refs-wrapper'</Table.Td>
                          <Table.Td className="text-slate-600">Classe per il wrapper degli items</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><code className="rounded-control bg-slate-100 px-2 py-1 font-mono">refItem</code></Table.Td>
                          <Table.Td className="text-slate-600">'fp-ref-item'</Table.Td>
                          <Table.Td className="text-slate-600">Classe per ogni singolo item</Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </div>
                </div>
              </DocsCapitolo>

              {/* Metodi Pubblici */}
              <DocsCapitolo icona="Zap" coloreIcona="text-warning" titolo="Metodi Pubblici">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <div className="overflow-x-auto">
                    <Table className="text-sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Metodo</Table.Th>
                          <Table.Th>Descrizione</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td>
                            <code className="rounded-control bg-slate-100 px-2 py-1 text-sm font-mono">init(options: FPOptions)</code>
                          </Table.Td>
                          <Table.Td className="text-slate-600">Inizializza il plugin con le opzioni fornite (chiamabile una sola volta)</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <code className="rounded-control bg-slate-100 px-2 py-1 text-sm font-mono">render()</code>
                          </Table.Td>
                          <Table.Td className="text-slate-600">Carica e renderizza i contenuti (chiamabile multiple volte)</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <code className="rounded-control bg-slate-100 px-2 py-1 text-sm font-mono">setOptions(options: Partial&lt;FPOptions&gt;)</code>
                          </Table.Td>
                          <Table.Td className="text-slate-600">Aggiorna parzialmente le opzioni di stile del plugin</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <code className="rounded-control bg-slate-100 px-2 py-1 text-sm font-mono">isReady()</code>
                          </Table.Td>
                          <Table.Td className="text-slate-600">Verifica se il plugin è inizializzato (returns boolean)</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <code className="rounded-control bg-slate-100 px-2 py-1 text-sm font-mono">destroy()</code>
                          </Table.Td>
                          <Table.Td className="text-slate-600">Pulisce il container e resetta lo stato del plugin</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <code className="rounded-control bg-slate-100 px-2 py-1 text-sm font-mono">reloadCss()</code>
                          </Table.Td>
                          <Table.Td className="text-slate-600">Ricarica il CSS dal server</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <code className="rounded-control bg-slate-100 px-2 py-1 text-sm font-mono">getCss()</code>
                          </Table.Td>
                          <Table.Td className="text-slate-600">Ottiene il CSS come stringa (returns Promise&lt;string&gt;)</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <code className="rounded-control bg-slate-100 px-2 py-1 text-sm font-mono">optionsQuery</code>
                          </Table.Td>
                          <Table.Td className="text-slate-600">Getter per le opzioni caricate dal server (read-only)</Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </div>
                </div>
              </DocsCapitolo>

              {/* Esempi Avanzati */}
              <DocsCapitolo icona="Sparkles" coloreIcona="text-success" titolo="Esempi Avanzati">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <Tab.Group>
                    <Tab.List variant="boxed-tabs" className="mb-4">
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          Con Stili Custom
                        </Tab.Button>
                      </Tab>
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          Responsive
                        </Tab.Button>
                      </Tab>
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          Versione Template
                        </Tab.Button>
                      </Tab>
                      <Tab>
                        <Tab.Button className="w-full py-2" as="button">
                          Shadow Styles
                        </Tab.Button>
                      </Tab>
                    </Tab.List>
                    <Tab.Panels>
                      <Tab.Panel className="leading-relaxed">
                        <CodeBlock language="JavaScript" code={`const fp = new FP();

await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024',
  styles: {
    gap: '16px',
    padding: '24px',
    maxWidth: '1200px',
    grid: {
      columns: 4,
      minItemWidth: '250px',
      maxItems: 12
    },
    carousel: {
      itemWidth: '300px',
      navSize: '48px',
      indicatorActiveColor: '#3b82f6'
    }
  }
});

await fp.render();`} />
                      </Tab.Panel>
                      <Tab.Panel className="leading-relaxed">
                        <CodeBlock language="JavaScript" code={`const fp = new FP();

await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024',
  styles: {
    gap: '16px',
    grid: {
      columns: 'auto-fill',
      minItemWidth: '300px',
      maxItems: 12
    },
    responsive: {
      // Sotto 1024px
      1024: {
        gap: '12px',
        grid: { maxItems: 8, minItemWidth: '250px' }
      },
      // Sotto 768px
      768: {
        gap: '8px',
        padding: '12px',
        grid: { maxItems: 6, minItemWidth: '200px' }
      },
      // Sotto 480px
      480: {
        gap: '6px',
        padding: '8px',
        grid: { maxItems: 4, minItemWidth: '150px' }
      }
    }
  }
});

await fp.render();`} />
                      </Tab.Panel>
                      <Tab.Panel className="leading-relaxed">
                        <CodeBlock language="JavaScript" code={`const fp = new FP();

// Carica una versione specifica del template
await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024',
  templateVersion: 3  // Carica la versione 3 del template
});

await fp.render();

// Puoi accedere alla configurazione caricata
console.log(fp.optionsQuery);
// {
//   type: 'grid',
//   mode: 'refs-html',
//   template_id: ['TEMPLATE_001'],
//   autoScroll: true,
//   ...
// }`} />
                      </Tab.Panel>
                      <Tab.Panel className="leading-relaxed">
                        <CodeBlock language="JavaScript" code={`const fp = new FP();

// Carica CSS aggiuntivi nel Shadow DOM
await fp.init({
  url: '${baseUrl}',
  container: document.getElementById('fp-container'),
  slug: 'promo-estate-2024',
  shadowStyles: [
    'https://mysite.com/custom-plugin-styles.css',
    'https://mysite.com/fonts.css'
  ],
  classNames: {
    refsRoot: 'my-refs-root',
    refsWrapper: 'my-refs-wrapper',
    refItem: 'my-ref-item'
  }
});

await fp.render();`} />
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>
                </div>
              </DocsCapitolo>

              {/* Note Importanti */}
              <DocsCapitolo icona="TriangleAlert" coloreIcona="text-danger" titolo="Note Importanti">
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <ul className="space-y-3 text-slate-600">
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <span>Lo <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">slug</code> è <strong>obbligatorio</strong> e deve corrispondere a un Filter Template esistente</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <span>Le opzioni <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">type</code>, <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">mode</code>, <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">filters</code>, ecc. vengono caricate automaticamente dal Filter Template</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <span>Il metodo <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">init()</code> può essere chiamato una sola volta per istanza</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <span>Usa <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">setOptions()</code> per aggiornare solo le opzioni di stile dopo l'inizializzazione</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <span>Il rendering utilizza Shadow DOM per isolare gli stili CSS dal resto della pagina</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <span>L'autenticazione con Ephemeral Token è gestita automaticamente dal plugin</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <span>Ricorda di chiamare <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">destroy()</code> quando rimuovi il componente per evitare memory leaks</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <span>Le opzioni <code className="rounded-control bg-slate-100 px-2 py-1 font-mono">optionsQuery</code> sono in sola lettura e non possono essere modificate dopo l'inizializzazione</span>
                    </li>
                  </ul>
                </div>
              </DocsCapitolo>
    </DocsGuida>
  );
}

export default DocumentazionePluginPage;
