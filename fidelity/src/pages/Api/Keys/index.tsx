import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useState, useCallback } from "react";
import { useLoaderData } from "react-router-dom";
import { Dialog } from "../../../components/Base/Headless";
import PageHeader from "../../../components/Base/PageHeader";
import { useApiKeyManagement } from "../../GestioneApi/hooks/useApiKeyManagement";

interface LoaderData {
  apiKey: string;
}

function ApiKeysPage() {
  const { apiKey: apiKeyLoader } = useLoaderData<LoaderData>();
  const { apiKey, copied, isGenerating, generateKey, copyToClipboard } = useApiKeyManagement(apiKeyLoader);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [copiedExample, setCopiedExample] = useState<string | null>(null);

  const copyExample = useCallback(async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedExample(id);
      setTimeout(() => setCopiedExample(null), 2000);
    } catch (err) {
      console.error('Errore nella copia:', err);
    }
  }, []);

  const curlExample = `curl -H "x-api-key: ${apiKey || 'your-api-key'}" \\
  ${window.location.origin}/api/external/refs`;

  const jsExample = `fetch('${window.location.origin}/api/external/refs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${apiKey || 'your-api-key'}'
  },
  body: JSON.stringify({
    template_id: ['template_001']
  })
});`;

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* Header */}
        <PageHeader
          title="API Keys"
          description="Gestisci le chiavi di accesso alle API esterne"
        />

        {/* Dialog conferma generazione */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          staticBackdrop={true}
        >
          <Dialog.Panel>
            <Dialog.Title>
              <h2 className="mr-auto text-base font-medium">
                Generazione nuova API Key
              </h2>
            </Dialog.Title>

            <Dialog.Description className="space-y-4">
              <p>
                Creando una nuova chiave, la precedente verrà automaticamente revocata.
                Assicurati di aggiornare tutti i servizi che la utilizzano prima di procedere.
              </p>

              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                <li>Salva subito la nuova chiave: non sarà più mostrata dopo la chiusura del dialog.</li>
                <li>Distribuisci la chiave solo a canali sicuri.</li>
                <li>Rigenera periodicamente per mantenere un alto livello di sicurezza.</li>
              </ul>

              <div className="p-4 border border-amber-200 bg-amber-50 rounded">
                <div className="flex items-center text-amber-700 font-medium mb-1">
                  <Lucide icon="ShieldAlert" className="w-4 h-4 mr-2" />
                  Stato attuale
                </div>
                <code className="block text-xs break-all">
                  {apiKey ?? "Nessuna API Key attiva"}
                </code>
              </div>
            </Dialog.Description>

            <Dialog.Footer className="flex justify-end gap-2">
              <Button
                variant="outline-secondary"
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={isGenerating}
              >
                Annulla
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={async () => {
                  await generateKey();
                  setDialogOpen(false);
                }}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                    Generazione in corso...
                  </>
                ) : (
                  <>
                    <Lucide icon="KeyRound" className="w-4 h-4 mr-2" />
                    Conferma
                  </>
                )}
              </Button>
            </Dialog.Footer>
          </Dialog.Panel>
        </Dialog>

        {/* Content */}
        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">
            <div className="p-5">
              {/* Sezione Gestione API Key */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Key" className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold text-slate-900">Gestione API Key</h2>
                </div>

                <div className="box p-6 space-y-4">
                  <p className="text-slate-600 mb-4">
                    Le API Key sono necessarie per accedere agli endpoint protetti dell'External API.
                    Mantieni sempre le tue chiavi al sicuro e non condividerle pubblicamente.
                  </p>

                  {apiKey ? (
                    <div className="border border-success/30 bg-success/5 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Lucide icon="CircleCheck" className="w-5 h-5 text-success" />
                          <span className="font-medium text-slate-900">API Key Attiva</span>
                        </div>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={copyToClipboard}
                          disabled={copied}
                        >
                          {copied ? (
                            <>
                              <Lucide icon="Check" className="w-4 h-4 mr-1 text-success" />
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
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
                          <code className="text-sm font-mono">{apiKey}</code>
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-warning/30 bg-warning/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Lucide icon="AlertTriangle" className="w-5 h-5 text-warning" />
                        <span className="font-medium text-slate-900">Nessuna API Key Attiva</span>
                      </div>
                      <p className="text-slate-600 text-sm">
                        Genera una nuova API Key per iniziare ad utilizzare le API esterne.
                      </p>
                    </div>
                  )}

                  <PermissionGate permission={PERMISSIONS.API.GESTISCI_CHIAVI} mode="disable">
                    <Button
                      variant="primary"
                      onClick={() => setDialogOpen(true)}
                    >
                      <Lucide icon="Plus" className="w-4 h-4 mr-2" />
                      Genera Nuova API Key
                    </Button>
                  </PermissionGate>
                </div>
              </div>

              {/* Sezione Come Usare l'API Key */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Code" className="w-6 h-6 text-success" />
                  <h2 className="text-2xl font-bold text-slate-900">Come Usare l'API Key</h2>
                </div>

                <div className="box p-6">
                  <p className="text-slate-600 mb-6">
                    Invia la tua API Key nell'header <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono">x-api-key</code> di ogni richiesta HTTP.
                  </p>

                  <div className="space-y-6">
                    {/* Esempio cURL */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-900">Esempio cURL</h4>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => copyExample(curlExample, 'curl')}
                        >
                          {copiedExample === 'curl' ? (
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
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
                          <code className="text-sm font-mono">{curlExample}</code>
                        </pre>
                      </div>
                    </div>

                    {/* Esempio JavaScript */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-900">Esempio JavaScript</h4>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => copyExample(jsExample, 'js')}
                        >
                          {copiedExample === 'js' ? (
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
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
                          <code className="text-sm font-mono">{jsExample}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sezione Sicurezza */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Shield" className="w-6 h-6 text-warning" />
                  <h2 className="text-2xl font-bold text-slate-900">Best Practice di Sicurezza</h2>
                </div>

                <div className="box p-6">
                  <ul className="space-y-3 text-slate-600">
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span><strong>Non esporre mai</strong> la tua API Key nel codice frontend o in repository pubblici</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span><strong>Usa variabili d'ambiente</strong> per memorizzare le chiavi nei tuoi server</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span><strong>Rigenera periodicamente</strong> le chiavi per mantenere un alto livello di sicurezza</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lucide icon="Check" className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span><strong>Monitora le statistiche</strong> per rilevare eventuali utilizzi anomali</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withSessionCheck(ApiKeysPage);
