import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { CodeBlock } from "@/pages/Documentazione/DocsCondivisi";
import { formatDataOraEstesa } from "@/utils/format";
import { useState } from "react";
import { useLoaderData } from "react-router-dom";
import { useApiKeyManagement } from "../../GestioneApi/hooks/useApiKeyManagement";
import { PLACEHOLDER_API_KEY, type StatoApiKey } from "../../GestioneApi/types";

interface LoaderData {
  statoApiKey: StatoApiKey | null;
}

/** "Chiave configurata il …": la data può mancare per le chiavi migrate senza data. */
function descriviStato(stato: StatoApiKey): string {
  if (!stato.configurata) return "Nessuna API Key attiva";
  return stato.generataIl ? `Chiave configurata il ${formatDataOraEstesa(stato.generataIl)}` : "Chiave configurata";
}

const BEST_PRACTICE = [
  { titolo: "Non esporre mai", testo: "la tua API Key nel codice frontend o in repository pubblici" },
  { titolo: "Usa variabili d'ambiente", testo: "per memorizzare le chiavi nei tuoi server" },
  { titolo: "Rigenera periodicamente", testo: "le chiavi per mantenere un alto livello di sicurezza" },
  { titolo: "Monitora le statistiche", testo: "per rilevare eventuali utilizzi anomali" },
];

function ApiKeysPage() {
  const { statoApiKey } = useLoaderData<LoaderData>();
  const { stato, chiaveGenerata, copied, isGenerating, generateKey, copyToClipboard } = useApiKeyManagement(statoApiKey);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  // La chiave vera solo se appena generata (è in memoria); altrimenti il placeholder
  const chiaveEsempio = chiaveGenerata ?? PLACEHOLDER_API_KEY;

  const curlExample = `curl -H "x-api-key: ${chiaveEsempio}" \\
  ${window.location.origin}/api/external/refs`;

  const jsExample = `fetch('${window.location.origin}/api/external/refs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${chiaveEsempio}'
  },
  body: JSON.stringify({
    template_id: ['template_001']
  })
});`;

  return (
    <Pagina
      titolo="API Keys"
      descrizione="Gestisci le chiavi di accesso alle API esterne"
      azioni={
        <PermissionGate permission={PERMISSIONS.API.GESTISCI_CHIAVI} mode="disable">
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
            Genera nuova API Key
          </Button>
        </PermissionGate>
      }
    >
      {/* Conferma generazione: la chiave precedente viene revocata */}
      <ConfirmDialog
        open={dialogOpen}
        title="Generare una nuova API Key?"
        subtitle={stato.configurata ? "La chiave attuale verrà revocata" : "Nuova chiave di accesso"}
        confirmLabel="Genera chiave"
        confirmVariant={stato.configurata ? "danger" : "primary"}
        loading={isGenerating}
        onClose={() => setDialogOpen(false)}
        onConfirm={async () => {
          await generateKey();
          setDialogOpen(false);
        }}
        description={
          <div className="space-y-4">
            <p>
              Creando una nuova chiave, la precedente verrà automaticamente revocata.
              Assicurati di aggiornare tutti i servizi che la utilizzano prima di procedere.
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>Salva subito la nuova chiave: è mostrata una volta sola e non sarà più visibile lasciata questa pagina.</li>
              <li>Distribuisci la chiave solo a canali sicuri.</li>
              <li>Rigenera periodicamente per mantenere un alto livello di sicurezza.</li>
            </ul>
            <Alert variant="soft-warning" icona="ShieldAlert" titolo="Stato attuale">
              {descriviStato(stato)}
            </Alert>
          </div>
        }
      />

      <Sezione
        icona="Key"
        titolo="Gestione API Key"
        descrizione="Le API Key sono necessarie per accedere agli endpoint protetti dell'External API. Mantieni sempre le tue chiavi al sicuro e non condividerle pubblicamente."
      >
        {chiaveGenerata ? (
          <div className="rounded-card border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="title-card">Nuova API Key</h3>
                <StatusBadge tono="success" etichetta="Attiva" />
              </div>
              <Button variant="outline-secondary" size="sm" onClick={copyToClipboard} disabled={copied}>
                <Lucide icon={copied ? "Check" : "Copy"} aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                {copied ? "Copiato!" : "Copia"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-control bg-slate-900 p-4 text-slate-100">
              <code className="font-mono text-sm">{chiaveGenerata}</code>
            </pre>
            {/* Il server ne conserva solo l'hash: persa la chiave, si può solo rigenerarla */}
            <Alert variant="soft-warning" icona="TriangleAlert" titolo="Copiala ora" className="mt-3">
              Per sicurezza la chiave non sarà più mostrata. Se la perdi dovrai generarne una nuova.
            </Alert>
          </div>
        ) : stato.configurata ? (
          <div className="rounded-card border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="title-card">API Key attiva</h3>
              <StatusBadge tono="success" etichetta="Attiva" />
            </div>
            <p className="mt-2 text-slate-600">{descriviStato(stato)}.</p>
            <p className="mt-1 text-xs text-slate-500">
              Per sicurezza la chiave non è più visualizzabile. Se l'hai persa, generane una nuova.
            </p>
          </div>
        ) : (
          <Alert variant="soft-warning" icona="TriangleAlert" titolo="Nessuna API Key attiva">
            Genera una nuova API Key per iniziare ad utilizzare le API esterne.
          </Alert>
        )}
      </Sezione>

      <Sezione
        icona="Code"
        titolo="Come usare l'API Key"
        descrizione={
          <>
            Invia la tua API Key nell'header{" "}
            <code className="rounded-control bg-slate-100 px-1.5 py-0.5 font-mono text-sm">x-api-key</code> di ogni
            richiesta HTTP.
          </>
        }
      >
        <div className="space-y-4">
          <CodeBlock language="Esempio cURL" code={curlExample} />
          <CodeBlock language="Esempio JavaScript" code={jsExample} />
        </div>
      </Sezione>

      <Sezione icona="Shield" titolo="Best practice di sicurezza">
        <ul className="space-y-3 text-slate-600">
          {BEST_PRACTICE.map((voce) => (
            <li key={voce.titolo} className="flex items-start gap-2">
              <Lucide icon="Check" aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-success" />
              <span>
                <strong>{voce.titolo}</strong> {voce.testo}
              </span>
            </li>
          ))}
        </ul>
      </Sezione>
    </Pagina>
  );
}

export default withSessionCheck(ApiKeysPage);
