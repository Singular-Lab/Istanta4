import { useState, useCallback, useEffect } from "react";
import { ServerCall } from "../../../../lib/server_call";
import { useNotification } from "../../../context/NotificationContext";
import { useUser } from "../../../context/UserContext";
import Lucide from "../../../components/Base/Lucide";
import type { StatoApiKey } from "../types";

const NESSUNA_CHIAVE: StatoApiKey = { configurata: false, generataIl: null };

export function useApiKeyManagement(statoIniziale?: StatoApiKey | null) {
  const [stato, setStato] = useState<StatoApiKey>(statoIniziale ?? NESSUNA_CHIAVE);
  // La chiave in chiaro esiste solo qui, subito dopo la generazione: il server ne
  // conserva l'hash e non la restituisce più. Non va salvata altrove nel browser.
  const [chiaveGenerata, setChiaveGenerata] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { showNotification } = useNotification();
  const { user } = useUser();

  // Sincronizza con lo stato del loader quando cambia (es. dopo una revalidate)
  useEffect(() => {
    if (statoIniziale) {
      setStato(statoIniziale);
    }
  }, [statoIniziale]);

  // Reset automatico del flag 'copied' dopo 2 secondi
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  // Genera una nuova API key
  const generateKey = useCallback(async () => {
    if (!user?.id) {
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleAlert" className="text-danger w-6 h-6" />
          <div className="ml-3">
            <div className="font-semibold">Errore</div>
            <div className="text-xs text-slate-500">Utente non autenticato</div>
          </div>
        </div>
      );
      return;
    }

    setIsGenerating(true);
    try {
      // Il server rigenera sempre la chiave del ruolo dell'utente della sessione
      const result = await ServerCall.post<any>('/external/generate-api-key', {}, false);

      if (result.success && result.apiKey?.apiKey) {
        setChiaveGenerata(result.apiKey.apiKey);
        setStato({ configurata: true, generataIl: result.apiKey.generated_at ?? new Date().toISOString() });
        showNotification(
          <div className="flex items-center">
            <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
            <div className="ml-3">
              <div className="font-semibold">API Key generata con successo!</div>
              <div className="text-xs text-slate-500">Copiala ora: non sarà più mostrata</div>
            </div>
          </div>
        );
      } else {
        throw new Error('Risposta non valida dal server');
      }
    } catch (error) {
      console.error('Errore durante la generazione della API key:', error);
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleX" className="text-danger w-6 h-6" />
          <div className="ml-3">
            <div className="font-semibold">Errore durante la generazione</div>
            <div className="text-xs text-slate-500">
              {error instanceof Error ? error.message : 'Errore sconosciuto'}
            </div>
          </div>
        </div>
      );
    } finally {
      setIsGenerating(false);
    }
  }, [user, showNotification]);

  // Copia negli appunti la chiave appena generata (l'unica disponibile in chiaro)
  const copyToClipboard = useCallback(() => {
    if (!chiaveGenerata) {
      return;
    }

    navigator.clipboard.writeText(chiaveGenerata);
    setCopied(true);
    showNotification(
      <div className="flex items-center">
        <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
        <div className="ml-3">
          <div className="font-semibold">Copiato!</div>
          <div className="text-xs text-slate-500">API Key copiata negli appunti</div>
        </div>
      </div>
    );
  }, [chiaveGenerata, showNotification]);

  return {
    stato,
    chiaveGenerata,
    copied,
    isGenerating,
    generateKey,
    copyToClipboard
  };
}
