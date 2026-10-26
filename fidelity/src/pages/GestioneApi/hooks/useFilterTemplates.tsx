import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRevalidator } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import Lucide from "../../../components/Base/Lucide";
import { useNotification } from "../../../context/NotificationContext";
import type { FilterCondition } from "../types";

// Payload per la creazione (formato camelCase atteso dal backend)
interface CreateFilterTemplatePayload {
  nome: string;
  slug: string;
  descrizione?: string;
  mode: 'refs' | 'refs-html' | 'files';
  renderType?: 'grid' | 'carousel' | 'list';
  templateIds?: string[];
  exportIds?: string[];
  filters: FilterCondition[][];
  autoScroll?: boolean;
  scrollSpeed?: number;
  showIndicators?: boolean;
  showNavButtons?: boolean;
}

// Payload per l'aggiornamento (formato camelCase atteso dal backend)
interface UpdateFilterTemplatePayload extends Partial<CreateFilterTemplatePayload> {
  id: string;
  is_active?: boolean;
}

interface RestoreFilterTemplatePayload {
  slug: string;
  version: number;
}

export function useFilterTemplates(apiKey?: string | null) {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const { revalidate } = useRevalidator();
  const authHeaders = apiKey ? { 'x-api-key': apiKey } : undefined;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateFilterTemplatePayload) => {
      return ServerCall.post('/external/filter-templates', payload, false, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-templates'] });
      revalidate();
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
          <div className="ml-3">
            <div className="font-semibold">Template creato con successo!</div>
          </div>
        </div>
      );
    },
    onError: (error: any) => {
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleX" className="text-danger w-6 h-6" />
          <div className="ml-3">
            <div className="font-semibold">Errore durante la creazione</div>
            <div className="text-xs text-slate-500">{error?.message || 'Errore sconosciuto'}</div>
          </div>
        </div>
      );
      throw error;
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: UpdateFilterTemplatePayload) => {
      return ServerCall.put(`/external/filter-templates/${id}`, payload, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-templates'] });
      revalidate();
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
          <div className="ml-3">
            <div className="font-semibold">Template aggiornato con successo!</div>
          </div>
        </div>
      );
    },
    onError: (error: any) => {
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleX" className="text-danger w-6 h-6" />
          <div className="ml-3">
            <div className="font-semibold">Errore durante l'aggiornamento</div>
            <div className="text-xs text-slate-500">{error?.message || 'Errore sconosciuto'}</div>
          </div>
        </div>
      );
      throw error;
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return ServerCall.delete(`/external/filter-templates/${id}`, undefined, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-templates'] });
      revalidate();
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
          <div className="ml-3">
            <div className="font-semibold">Template eliminato con successo!</div>
          </div>
        </div>
      );
    },
    onError: (error: any) => {
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleX" className="text-danger w-6 h-6" />
          <div className="ml-3">
            <div className="font-semibold">Errore durante l'eliminazione</div>
            <div className="text-xs text-slate-500">{error?.message || 'Errore sconosciuto'}</div>
          </div>
        </div>
      );
      throw error;
    }
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async ({ slug, version }: RestoreFilterTemplatePayload) => {
      return ServerCall.post(`/external/filter-templates/slug/${slug}/restore`, {
        target_version: version
      }, false, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-templates'] });
      revalidate();
      showNotification(
        <div className="flex items-center">
          <Lucide icon="RotateCcw" className="text-success w-6 h-6" />
          <div className="ml-3">
            <div className="font-semibold">Versione ripristinata con successo</div>
          </div>
        </div>
      );
    },
    onError: (error: any) => {
      showNotification(
        <div className="flex items-center">
          <Lucide icon="CircleX" className="text-danger w-6 h-6" />
          <div className="ml-3">
            <div className="font-semibold">Errore durante il ripristino</div>
            <div className="text-xs text-slate-500">{error?.message || 'Errore sconosciuto'}</div>
          </div>
        </div>
      );
      throw error;
    }
  });

  return {
    create: createMutation,
    update: updateMutation,
    deleteTemplate: deleteMutation,
    restore: restoreMutation,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isRestoring: restoreMutation.isPending
  };
}
