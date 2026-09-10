import { useState, useCallback, useEffect } from "react";
import { ServerCall } from "../../../../lib/server_call";
import { useNotification } from "../../../context/NotificationContext";
import { useUser } from "../../../context/UserContext";
import Lucide from "../../../components/Base/Lucide";

export function useApiKeyManagement(initialApiKey: string = "") {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { showNotification } = useNotification();
  const { user } = useUser();

  // Sincronizza con l'API key iniziale quando cambia
  useEffect(() => {
    if (initialApiKey) {
      setApiKey(initialApiKey);
    }
  }, [initialApiKey]);

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
      const result = await ServerCall.post<any>('/external/generate-api-key', {
        id_utente: user.id
      }, false);

      if (result.success && result.apiKey) {
        setApiKey(result.apiKey.apiKey);
        setCopied(true);
        showNotification(
          <div className="flex items-center">
            <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
            <div className="ml-3">
              <div className="font-semibold">API Key generata con successo!</div>
              <div className="text-xs text-slate-500">La chiave è stata copiata negli appunti</div>
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

  // Copia la API key negli appunti
  const copyToClipboard = useCallback(() => {
    if (!apiKey) {
      return;
    }

    navigator.clipboard.writeText(apiKey);
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
  }, [apiKey, showNotification]);

  return {
    apiKey,
    copied,
    isGenerating,
    generateKey,
    copyToClipboard,
    setApiKey
  };
}
