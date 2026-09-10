import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";

interface ApiKeysTabProps {
  apiKey: string;
  copied: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}

function ApiKeysTab({ apiKey, copied, isGenerating, onGenerate, onCopy }: ApiKeysTabProps) {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8">
        <div className="box p-5">
          <h3 className="text-lg font-medium mb-4">Gestione API Keys</h3>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center mb-2">
                <Lucide icon="Info" className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-800">Informazioni API Key</span>
              </div>
              <p className="text-sm text-blue-700">
                Le API Key sono necessarie per accedere agli endpoint protetti.
                Mantieni sempre le tue chiavi al sicuro e non condividerle pubblicamente.
              </p>
            </div>

            {apiKey && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-800">API Key Generata</span>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={onCopy}
                    disabled={copied}
                  >
                    {copied ? (
                      <>
                        <Lucide icon="Check" className="w-4 h-4 mr-1 text-green-600" />
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
                <code className="block p-2 bg-white rounded border text-sm break-all">
                  {apiKey}
                </code>
              </div>
            )}

            <Button
              variant="primary"
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Lucide icon="Plus" className="w-4 h-4 mr-2" />
                  Genera Nuova API Key
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-4">
        <div className="box p-5">
          <h3 className="text-lg font-medium mb-4">Come usare l'API Key</h3>
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium text-slate-700 mb-1">Header di Autenticazione</h4>
              <code className="block p-2 bg-slate-100 rounded text-xs">
                x-api-key: your-api-key-here
              </code>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 mb-1">Esempio cURL</h4>
              <code className="break-all block p-2 bg-slate-100 rounded text-xs">
                curl -H "x-api-key: your-key" <br />
                {window.location.origin}/api/external/refs
              </code>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 mb-1">Esempio JavaScript</h4>
              <code className="break-all block p-2 bg-slate-100 rounded text-xs">
                {`fetch('/api/external/refs', {
  headers: {
    'x-api-key': 'your-key'
  }
})`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApiKeysTab;
