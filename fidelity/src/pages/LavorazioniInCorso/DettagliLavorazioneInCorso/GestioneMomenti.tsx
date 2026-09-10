import Button from "@/components/Base/Button";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import "dayjs/locale/it";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import type { TipoSchema, TracciatoReport, TracciatiMomentoConfrontoResponseDTO, TracciatiMomentoResponseDTO, TracciatiSchemaConfronto, TracciatiSchemaResponseDTO } from "../../../../lib/types";
import type { TracciatiResponseDTO } from "../../../../server/core/dto";
dayjs.locale("it");

interface GestioneMomentiProps {
  idPromo: string | null;
  tracciati: TracciatiResponseDTO[];
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function fetchMomenti(idPromo: string): Promise<TracciatiMomentoResponseDTO[]> {
  const data = await ServerCall.get<TracciatiMomentoResponseDTO[]>(
    `/tracciati/momenti/promo/${idPromo}`
  );
  return data ?? [];
}

async function apiCreateMomento(id_promo: string, nome: string, snapshot = false): Promise<TracciatiMomentoResponseDTO> {
  return ServerCall.post<TracciatiMomentoResponseDTO>("/tracciati/momenti", { id_promo, nome, snapshot });
}

async function apiUpdateMomento(id: string, data: { nome?: string; tracciati_ids?: string[]; confronti_ids?: string[]; ordine?: number }): Promise<TracciatiMomentoResponseDTO> {
  return ServerCall.put<TracciatiMomentoResponseDTO>(`/tracciati/momenti/${id}`, data);
}

async function apiDeleteMomento(id: string): Promise<void> {
  await ServerCall.delete(`/tracciati/momenti/${id}`);
}

async function apiCalcolaRisultato(idMomento: string): Promise<TracciatiMomentoResponseDTO> {
  return ServerCall.post<TracciatiMomentoResponseDTO>(`/tracciati/momenti/${idMomento}/risultato`, {});
}

async function apiCreateMomentoConfronto(primario: string, secondario: string): Promise<TracciatiMomentoConfrontoResponseDTO> {
  return ServerCall.post<TracciatiMomentoConfrontoResponseDTO>("/tracciati/momenti/confronti", { primario, secondario });
}

async function apiUpdateConfrontoMeta(idConfronto: string, data: { terremoto_degrado_massimo?: number | null }): Promise<TracciatiMomentoConfrontoResponseDTO> {
  return ServerCall.patch<TracciatiMomentoConfrontoResponseDTO>(`/tracciati/momenti/confronti/${idConfronto}`, data);
}

async function apiCalcolaRisultatoConfronto(idConfronto: string): Promise<TracciatiMomentoConfrontoResponseDTO> {
  return ServerCall.post<TracciatiMomentoConfrontoResponseDTO>(`/tracciati/momenti/confronti/${idConfronto}/risultato`, {});
}

async function apiResetConfronto(idConfronto: string): Promise<void> {
  await ServerCall.delete(`/tracciati/momenti/confronti/${idConfronto}/risultato`);
}

async function apiResetRisultatoMomento(idMomento: string): Promise<TracciatiMomentoResponseDTO> {
  return ServerCall.delete<TracciatiMomentoResponseDTO>(`/tracciati/momenti/${idMomento}/risultato`);
}

async function apiGetPromoScoreboard(idPromo: string): Promise<TracciatoReport | null> {
  try {
    return await ServerCall.get<TracciatoReport>(`/scoreboard/promo/${idPromo}`);
  } catch {
    return null;
  }
}

async function apiCalcolaPromoScoreboard(idPromo: string): Promise<TracciatoReport> {
  return ServerCall.post<TracciatoReport>(`/scoreboard/promo/${idPromo}`, {});
}

async function fetchSchemi(): Promise<TracciatiSchemaResponseDTO[]> {
  return (await ServerCall.get<TracciatiSchemaResponseDTO[]>("/tracciati/schemi")) ?? [];
}

async function apiApplicaSchema(idSchema: string, idPromo: string): Promise<TracciatiMomentoResponseDTO[]> {
  return (await ServerCall.post<TracciatiMomentoResponseDTO[]>(`/tracciati/schemi/${idSchema}/applica`, { idPromo })) ?? [];
}

type MomentoConfrontoPair = { aId: string; bId: string };
type MomentoConfrontoEdge = {
  key: string;
  idA: string;
  idB: string;
  path: string;
  buttonX: number;
  buttonY: number;
  lane: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

const getConfrontoPairKey = (idA: string, idB: string): string =>
  idA < idB ? `${idA}::${idB}` : `${idB}::${idA}`;

const EMPTY_MOMENTI: TracciatiMomentoResponseDTO[] = [];
const EMPTY_SCHEMI: TracciatiSchemaResponseDTO[] = [];
const CONFRONTO_RESULT_HINT = "Confronto disponibile solo quando entrambi i momenti hanno un risultato";
const SNAPSHOT_ANALISI_WARNING = "Attenzione, lo snapshot è come un'istantanea del processo di lavorazione, quindi se si pensa di non avere importato i tracciati necessari, prima importarli e poi far partire il processo di analisi";

const getFloatingDropdownStyle = (
  anchor: HTMLElement | null,
  preferredPlacement: "above" | "below",
  maxHeight = 224
): React.CSSProperties | null => {
  if (!anchor || typeof window === "undefined") return null;

  const rect = anchor.getBoundingClientRect();
  const viewportPadding = 12;
  const gap = 4;
  const minUsefulSpace = 120;
  const availableWidth = window.innerWidth - viewportPadding * 2;
  const width = Math.min(rect.width, availableWidth);
  const left = Math.min(
    Math.max(viewportPadding, rect.left),
    window.innerWidth - width - viewportPadding
  );
  const spaceAbove = rect.top - viewportPadding;
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
  const shouldOpenAbove = preferredPlacement === "above"
    ? spaceAbove >= minUsefulSpace || spaceAbove >= spaceBelow
    : !(spaceBelow >= minUsefulSpace || spaceBelow >= spaceAbove);
  const availableHeight = shouldOpenAbove ? spaceAbove : spaceBelow;
  const dropdownMaxHeight = Math.max(80, Math.min(maxHeight, availableHeight - gap));

  return {
    position: "fixed",
    left,
    width,
    zIndex: 9999,
    maxHeight: dropdownMaxHeight,
    ...(shouldOpenAbove
      ? { bottom: window.innerHeight - rect.top + gap }
      : { top: rect.bottom + gap }),
  };
};

// ─── MomentoCard ─────────────────────────────────────────────────────────────

interface MomentoCardProps {
  momento: TracciatiMomentoResponseDTO;
  tracciati: TracciatiResponseDTO[];
  onRename: (id: string, nome: string) => void;
  onDelete: (id: string) => void;
  onAddTracciato: (id: string, tracciatiIds: string[]) => void;
  onRemoveTracciato: (id: string, tracciatiIds: string[]) => void;
  onPlay: (id: string) => void;
  onResetRisultato: (id: string) => void;
  onCollegaNonAdiacente: (targetId: string) => void;
  momentiCollegabili: TracciatiMomentoResponseDTO[];
  isUpdating: boolean;
  isDeleting: boolean;
  isPlaying: boolean;
  isCollegando: boolean;
}

const MomentoCard: React.FC<MomentoCardProps> = ({
  momento,
  tracciati,
  onRename,
  onDelete,
  onAddTracciato,
  onRemoveTracciato,
  onPlay,
  onResetRisultato,
  onCollegaNonAdiacente,
  momentiCollegabili,
  isUpdating,
  isDeleting,
  isPlaying,
  isCollegando,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(momento.nome);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showCollegaDropdown, setShowCollegaDropdown] = useState(false);
  const [addDropdownStyle, setAddDropdownStyle] = useState<React.CSSProperties | null>(null);
  const [collegaDropdownStyle, setCollegaDropdownStyle] = useState<React.CSSProperties | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const collegaDropdownRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const collegaButtonRef = useRef<HTMLButtonElement>(null);
  const addDropdownMenuRef = useRef<HTMLDivElement>(null);
  const collegaDropdownMenuRef = useRef<HTMLDivElement>(null);

  // Tracciati assegnati a questo momento
  const assignedTracciati = tracciati.filter((t) =>
    momento.tracciati_ids.includes(t.id)
  );

  // Tracciati disponibili da aggiungere: solo quelli non già presenti in questo momento
  // (ogni momento ha la propria selezione indipendente)
  const availableTracciati = tracciati.filter(
    (t) => !momento.tracciati_ids.includes(t.id)
  );
  function getPortX(
    rect: DOMRect,
    containerRect: DOMRect,
    portIndex: number,
    portCount: number
  ) {
    const left = rect.left - containerRect.left;
    const innerPadding = 24;

    if (portCount <= 1) {
      return left + rect.width / 2;
    }

    const usableWidth = Math.max(1, rect.width - innerPadding * 2);
    const step = usableWidth / (portCount - 1);

    return left + innerPadding + step * portIndex;
  }
  const isSnapshot = momento.snapshot === true;
  const hasResult = momento.hasRisultato === true;
  // snapshot: non serve tracciati; normale: almeno un tracciato
  const canPlay = !hasResult && !isPlaying && !isUpdating && (isSnapshot || momento.tracciati_ids.length > 0);
  const playColorCls = canPlay
    ? "border-success/40 text-success bg-success/5 hover:bg-success/10"
    : "border-slate-200 text-slate-400 cursor-not-allowed";
  const addTracCls = availableTracciati.length > 0
    ? "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
    : "border-slate-200 text-slate-400 cursor-not-allowed";

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  // Chiudi il dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current?.contains(target) || addDropdownMenuRef.current?.contains(target)) return;
      setShowAddDropdown(false);
    };
    if (showAddDropdown) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddDropdown]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (collegaDropdownRef.current?.contains(target) || collegaDropdownMenuRef.current?.contains(target)) return;
      setShowCollegaDropdown(false);
    };
    if (showCollegaDropdown) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCollegaDropdown]);

  useEffect(() => {
    if (!showAddDropdown) {
      setAddDropdownStyle(null);
      return;
    }

    const updatePosition = () => {
      setAddDropdownStyle(getFloatingDropdownStyle(addButtonRef.current, "above", 224));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showAddDropdown]);

  useEffect(() => {
    if (!showCollegaDropdown) {
      setCollegaDropdownStyle(null);
      return;
    }

    const updatePosition = () => {
      setCollegaDropdownStyle(getFloatingDropdownStyle(collegaButtonRef.current, "above", 192));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showCollegaDropdown]);

  const handleRenameSubmit = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== momento.nome) {
      onRename(momento.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleRemove = (tracciatoId: string) => {
    onRemoveTracciato(
      momento.id,
      momento.tracciati_ids.filter((id) => id !== tracciatoId)
    );
  };

  const handleAdd = (tracciatoId: string) => {
    onAddTracciato(momento.id, [...momento.tracciati_ids, tracciatoId]);
    setShowAddDropdown(false);
  };

  return (
    <div className="flex-shrink-0 w-80 h-full flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={clsx(
        "flex items-center justify-between px-3 py-2.5 border-b",
        isSnapshot ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
      )}>
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
          {isEditing ? (
            <input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") { setDraftName(momento.nome); setIsEditing(false); }
              }}
              className="flex-1 text-sm font-semibold bg-white border border-primary/40 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary/40"
            />
          ) : (
            <span className="text-sm font-semibold text-slate-800 truncate">
              {momento.nome}
            </span>
          )}
          <span className={clsx(
            "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
            isSnapshot
              ? "bg-amber-100 text-amber-700"
              : "bg-primary/10 text-primary"
          )}>
            <Lucide icon={isSnapshot ? "Camera" : "List"} className="w-3 h-3" />
            {isSnapshot ? "Snapshot" : "Normale"}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            title="Rinomina"
            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
            onClick={() => { setDraftName(momento.nome); setIsEditing(true); }}
          >
            <Lucide icon="Pencil" className="w-4 h-4" />
          </button>
          {showConfirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Conferma eliminazione"
                className="p-1 rounded bg-danger/10 hover:bg-danger/20 text-danger transition-colors"
                onClick={() => { onDelete(momento.id); setShowConfirmDelete(false); }}
                disabled={isDeleting}
              >
                <Lucide icon={isDeleting ? "Loader" : "Check"} className={clsx("w-4 h-4", isDeleting && "animate-spin")} />
              </button>
              <button
                type="button"
                title="Annulla"
                className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
                onClick={() => setShowConfirmDelete(false)}
              >
                <Lucide icon="X" className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              title="Elimina momento"
              className="p-1 rounded hover:bg-danger/10 text-slate-400 hover:text-danger transition-colors"
              onClick={() => setShowConfirmDelete(true)}
            >
              <Lucide icon="Trash2" className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Corpo — differenziato per tipo */}
      {isSnapshot ? (
        <div className="flex-1 flex flex-col items-center justify-center h-24 text-amber-600/70 text-xs text-center px-4 gap-1.5">
          <Lucide icon="Camera" className="w-5 h-5 opacity-60" />
          <span>Capture istantanea della lista corrente<br />senza selezione di tracciati</span>
        </div>
      ) : (
        <>
          {/* Tracciati list */}
          <div className="flex-1 flex flex-col gap-1.5 p-3 overflow-visible">
            {assignedTracciati.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-20 text-slate-400 text-xs text-center px-2">
                <Lucide icon="FileX" className="w-5 h-5 mb-1 opacity-50" />
                Nessun tracciato assegnato
              </div>
            ) : (
              assignedTracciati.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Lucide icon="FileSpreadsheet" className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-slate-700 break-words whitespace-normal max-w-full" title={t.filename}>
                      {t.filename}
                    </span>
                  </div>
                  <button
                    type="button"
                    title="Rimuovi dal momento"
                    className="shrink-0 p-0.5 rounded hover:bg-danger/10 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                    onClick={() => handleRemove(t.id)}
                    disabled={isUpdating}
                  >
                    <Lucide icon="X" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add tracciato */}
          <div className="px-3 pb-3 relative" ref={dropdownRef}>
            <button
              ref={addButtonRef}
              type="button"
              className={clsx(
                "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
                addTracCls
              )}
              disabled={availableTracciati.length === 0 || isUpdating}
              onClick={() => setShowAddDropdown((v) => !v)}
            >
              <Lucide icon="Plus" className="w-4 h-4" />
              Aggiungi tracciato
            </button>

            {showAddDropdown && availableTracciati.length > 0 && addDropdownStyle && createPortal(
              <div
                ref={addDropdownMenuRef}
                style={addDropdownStyle}
                className="bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden overflow-y-auto"
              >
                {availableTracciati.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full border-b border-slate-100 flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-primary/5 transition-colors"
                    onClick={() => handleAdd(t.id)}
                  >
                    <Lucide icon="FileSpreadsheet" className="w-4 h-4 text-primary shrink-0" />
                    <span className="break-words whitespace-normal max-w-full text-slate-700" title={t.filename}>{t.filename}</span>
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
        </>
      )}

      {/* Collega non adiacente */}
      {momentiCollegabili.length > 0 && (
        <div className="px-3 pb-2 relative" ref={collegaDropdownRef}>
          <button
            ref={collegaButtonRef}
            type="button"
            className={clsx(
              "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
              isCollegando
                ? "border-slate-200 text-slate-400 cursor-not-allowed"
                : "border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100"
            )}
            disabled={isCollegando}
            onClick={() => setShowCollegaDropdown((v) => !v)}
          >
            <Lucide icon={isCollegando ? "Loader" : "Link2"} className={clsx("w-4 h-4", isCollegando && "animate-spin")} />
            Collega non adiacente
          </button>
          {showCollegaDropdown && collegaDropdownStyle && createPortal(
            <div
              ref={collegaDropdownMenuRef}
              style={collegaDropdownStyle}
              className="bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden overflow-y-auto"
            >
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                Collega con...
              </p>
              {momentiCollegabili.map((other) => (
                <button
                  key={other.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-violet-50 transition-colors"
                  onClick={() => { setShowCollegaDropdown(false); onCollegaNonAdiacente(other.id); }}
                >
                  <Lucide icon="GitCompare" className="w-4 h-4 text-violet-500 shrink-0" />
                  <span className="truncate text-slate-700">{other.nome}</span>
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      )}

      {/* Play / risultato */}
      <div className="px-3 pb-3 border-t border-slate-100 pt-2.5">
        {hasResult ? (
          <div className="flex flex-col gap-1.5">
            <div className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border border-success/30 bg-success/5 text-success">
              <Lucide icon="CheckCircle2" className="w-4 h-4" />
              Risultato disponibile
            </div>
            {showConfirmReset ? (
              <div className="flex items-center gap-1.5">
                <span className="flex-1 text-xs text-slate-500">Rimuovere il risultato?</span>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded bg-danger/10 hover:bg-danger/20 text-danger font-medium transition-colors"
                  onClick={() => { setShowConfirmReset(false); onResetRisultato(momento.id); }}
                >
                  Sì
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded hover:bg-slate-100 text-slate-500 font-medium transition-colors"
                  onClick={() => setShowConfirmReset(false)}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-400 hover:border-danger/30 hover:text-danger hover:bg-danger/5 transition-colors"
                onClick={() => setShowConfirmReset(true)}
              >
                <Lucide icon="RotateCcw" className="w-3.5 h-3.5" />
                Rimuovi risultato
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={clsx(
              "w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border transition-colors",
              playColorCls
            )}
            disabled={!canPlay}
            onClick={() => onPlay(momento.id)}
          >
            <Lucide
              icon={isPlaying ? "Loader" : "Play"}
              className={clsx("w-4 h-4", isPlaying && "animate-spin")}
            />
            {isPlaying ? "In esecuzione..." : "Avvia analisi"}
          </button>
        )}
      </div>

    </div>
  );
};

// ─── MomentoConnector ────────────────────────────────────────────────────────

interface MomentoConnectorProps {
  momentoA: TracciatiMomentoResponseDTO;
  momentoB: TracciatiMomentoResponseDTO;
  onConfronta: (idA: string, idB: string) => void;
  onMenuAction: (idA: string, idB: string, action: 'apri' | 'rifai' | 'rimuovi') => void;
  onUpdateTerremoto: (idA: string, idB: string, confrontoId: string | undefined, value: number | null) => void;
  confrontoId?: string;
  terremotoDegradoMassimo?: number | null;
  isActive: boolean;
  isLoading: boolean;
  isUpdatingMeta: boolean;
  hasCompleted: boolean;
  isMenuOpen: boolean;
  onOpenMenu: (idA: string, idB: string) => void;
  menuRef?: React.RefObject<HTMLDivElement>;
}

const MomentoConnector: React.FC<MomentoConnectorProps> = ({
  momentoA, momentoB, onConfronta, onMenuAction, onUpdateTerremoto,
  confrontoId, terremotoDegradoMassimo,
  isActive, isLoading, isUpdatingMeta, hasCompleted, isMenuOpen, onOpenMenu, menuRef,
}) => {
  const [draftTerremoto, setDraftTerremoto] = useState(
    terremotoDegradoMassimo != null ? String(terremotoDegradoMassimo) : ""
  );

  useEffect(() => {
    setDraftTerremoto(terremotoDegradoMassimo != null ? String(terremotoDegradoMassimo) : "");
  }, [terremotoDegradoMassimo]);

  const handleTerremotoSubmit = () => {
    const raw = draftTerremoto.trim();
    const parsed = raw === "" ? null : Number(raw);
    const current = terremotoDegradoMassimo ?? null;
    if (parsed === current) return;
    if (parsed !== null && (isNaN(parsed) || parsed < 0 || parsed > 100)) {
      setDraftTerremoto(current != null ? String(current) : "");
      return;
    }
    onUpdateTerremoto(momentoA.id, momentoB.id, confrontoId, parsed);
  };

  return (
  <div
    className={clsx(
      "flex-shrink-0 self-center flex flex-col items-center gap-1",
      isActive && !isLoading && !hasCompleted && "group/connector"
    )}
    style={{ width: "96px" }}
  >
    <div className="w-full flex items-center">
      {/* Pallino sinistro */}
      <div
        className={clsx(
          "w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-200",
          hasCompleted
            ? "bg-success/50"
            : isActive
              ? "bg-slate-300 group-hover/connector:bg-primary/40"
              : "bg-slate-200"
        )}
      />

      {/* Segmento sinistro */}
      <div
        className={clsx(
          "flex-1 h-[1.5px] transition-colors duration-200",
          hasCompleted
            ? "bg-success/30"
            : isActive
              ? "bg-slate-200 group-hover/connector:bg-primary/30"
              : "bg-slate-100"
        )}
      />

      {/* Pulsante confronto */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          title={
            !isActive
              ? CONFRONTO_RESULT_HINT
              : isLoading
                ? "Confronto in esecuzione..."
                : hasCompleted
                  ? `Report disponibile — clicca per le opzioni`
                  : `Confronta "${momentoA.nome}" con "${momentoB.nome}"`
          }
          onClick={() => {
            if (!isActive || isLoading) return;
            if (hasCompleted) onOpenMenu(momentoA.id, momentoB.id);
            else onConfronta(momentoA.id, momentoB.id);
          }}
          disabled={!isActive || isLoading}
          className={clsx(
            "w-9 h-9 flex items-center justify-center rounded-full border-2 shadow-sm transition-all duration-200",
            hasCompleted
              ? "border-success/60 bg-white text-success hover:border-success hover:bg-success/5 hover:shadow-md active:scale-95 cursor-pointer"
              : isActive && !isLoading
                ? "border-slate-200 bg-white text-slate-400 hover:border-primary/60 hover:text-primary hover:bg-primary/5 hover:shadow-md active:scale-95"
                : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
          )}
        >
          <Lucide
            icon={isLoading ? "Loader" : hasCompleted ? "Check" : "GitCompare"}
            className={clsx("w-4 h-4", isLoading && "animate-spin")}
          />
        </button>

        {/* Menu opzioni confronto completato */}
        {isMenuOpen && hasCompleted && (
          <div
            ref={menuRef}
            className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden min-w-[160px]"
          >
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
              Report confronto
            </div>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-700 hover:bg-primary/5 transition-colors"
              onClick={() => onMenuAction(momentoA.id, momentoB.id, 'apri')}
            >
              <Lucide icon="ExternalLink" className="w-4 h-4 text-primary shrink-0" />
              Apri report
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-700 hover:bg-amber-50 transition-colors"
              onClick={() => onMenuAction(momentoA.id, momentoB.id, 'rifai')}
            >
              <Lucide icon="RefreshCw" className="w-4 h-4 text-amber-500 shrink-0" />
              Rifai confronto
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-danger hover:bg-danger/5 transition-colors"
              onClick={() => onMenuAction(momentoA.id, momentoB.id, 'rimuovi')}
            >
              <Lucide icon="Trash2" className="w-4 h-4 shrink-0" />
              Rimuovi report
            </button>
          </div>
        )}
      </div>

      {/* Segmento destro */}
      <div
        className={clsx(
          "flex-1 h-[1.5px] transition-colors duration-200",
          hasCompleted
            ? "bg-success/30"
            : isActive
              ? "bg-slate-200 group-hover/connector:bg-primary/30"
              : "bg-slate-100"
        )}
      />

      {/* Punta freccia destra */}
      <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="flex-shrink-0">
        <path
          d="M1.5 1.5 L6.5 6 L1.5 10.5"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={clsx(
            "transition-colors duration-200",
            hasCompleted
              ? "stroke-success/60"
              : isActive
                ? "stroke-slate-300 group-hover/connector:stroke-primary/50"
                : "stroke-slate-200"
          )}
        />
      </svg>
    </div>

    <label className="flex items-center gap-1 h-7 text-[10px] text-slate-400" title="Degrado terremoto massimo del collegamento lineare">
      <Lucide icon={isUpdatingMeta ? "Loader" : "Zap"} className={clsx("w-3 h-3 text-orange-400", isUpdatingMeta && "animate-spin")} />
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={draftTerremoto}
        onChange={(e) => setDraftTerremoto(e.target.value)}
        onBlur={handleTerremotoSubmit}
        onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
        placeholder="%"
        disabled={isUpdatingMeta}
        className="w-12 h-6 text-center border border-slate-200 rounded-md bg-white px-1 outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-slate-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  </div>
  );
};

// ─── GestioneMomenti ─────────────────────────────────────────────────────────

const GestioneMomenti: React.FC<GestioneMomentiProps> = ({ idPromo, tracciati }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [isCreating, setIsCreating] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newIsSnapshot, setNewIsSnapshot] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [snapshotWarningTargetId, setSnapshotWarningTargetId] = useState<string | null>(null);
  const [showSchemaDropdown, setShowSchemaDropdown] = useState(false);
  const [applyingSchemaId, setApplyingSchemaId] = useState<string | null>(null);
  const [comparingPairKey, setComparingPairKey] = useState<string | null>(null);
  const [isScoreboarding, setIsScoreboarding] = useState(false);
  const [completedConfrontiKeys, setCompletedConfrontiKeys] = useState<Set<string>>(new Set());
  const [openMenuPairKey, setOpenMenuPairKey] = useState<string | null>(null);
  const completedConfrontoIds = useRef<Map<string, string>>(new Map()); // pairKey → confrontoId
  const menuRef = useRef<HTMLDivElement>(null);
  const [schemaConfrontiPairs, setSchemaConfrontiPairs] = useState<MomentoConfrontoPair[]>([]);
  const [schemaConfrontiEdges, setSchemaConfrontiEdges] = useState<MomentoConfrontoEdge[]>([]);
  const [isMassiveRunning, setIsMassiveRunning] = useState(false);
  const [massiveProgress, setMassiveProgress] = useState<{ current: number; total: number; phase: 'analisi' | 'report' } | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const schemaDropdownRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const momentiQuery = useQuery({
    queryKey: ["tracciatiMomenti", idPromo],
    queryFn: () => fetchMomenti(idPromo!),
    enabled: !!idPromo,
    placeholderData: (prev) => prev ?? [],
  });

  const scoreboardQuery = useQuery({
    queryKey: ["promoScoreboard", idPromo],
    queryFn: () => apiGetPromoScoreboard(idPromo!),
    enabled: !!idPromo,
    staleTime: Infinity,
  });
  const savedScoreboard = scoreboardQuery.data ?? null;

  const schemiQuery = useQuery({
    queryKey: ["tracciatiSchemi"],
    queryFn: fetchSchemi,
    placeholderData: (prev) => prev ?? [],
  });

  const momenti: TracciatiMomentoResponseDTO[] = momentiQuery.data ?? EMPTY_MOMENTI;
  const schemi: TracciatiSchemaResponseDTO[] = schemiQuery.data ?? EMPTY_SCHEMI;
  const persistedSchemaPairs = useMemo(() => {
    const byId = new Set(momenti.map((m) => m.id));
    const unique = new Map<string, MomentoConfrontoPair>();

    momenti.forEach((momento) => {
      (momento.confronti_ids ?? []).forEach((linkedId) => {
        if (!byId.has(linkedId) || linkedId === momento.id) return;
        const key = getConfrontoPairKey(momento.id, linkedId);
        if (!unique.has(key)) unique.set(key, { aId: momento.id, bId: linkedId });
      });
    });

    return [...unique.values()];
  }, [momenti]);
  const activeSchemaPairs = useMemo(() => {
    const existingIds = new Set(momenti.map((m) => m.id));
    const unique = new Map<string, MomentoConfrontoPair>();
    [...persistedSchemaPairs, ...schemaConfrontiPairs].forEach((p) => {
      if (!existingIds.has(p.aId) || !existingIds.has(p.bId) || p.aId === p.bId) return;
      const key = getConfrontoPairKey(p.aId, p.bId);
      if (!unique.has(key)) unique.set(key, p);
    });
    return [...unique.values()];
  }, [momenti, persistedSchemaPairs, schemaConfrontiPairs]);
  const schemaConfrontiPairSet = useMemo(
    () => new Set(activeSchemaPairs.map((p) => getConfrontoPairKey(p.aId, p.bId))),
    [activeSchemaPairs]
  );
  const schemaConfrontiMomentiSet = useMemo(() => {
    const result = new Set<string>();
    schemaConfrontiPairSet.forEach((key) => {
      const [aId, bId] = key.split("::");
      result.add(aId);
      result.add(bId);
    });
    return result;
  }, [schemaConfrontiPairSet]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["tracciatiMomenti", idPromo] });

  const createMutation = useMutation({
    mutationFn: ({ nome, snapshot }: { nome: string; snapshot: boolean }) =>
      apiCreateMomento(idPromo!, nome, snapshot),
    onSuccess: () => { invalidate(); setIsCreating(false); setNewNome(""); setNewIsSnapshot(false); },
    onError: () =>
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5" />
          <span>Errore durante la creazione del momento</span>
        </div>
      ),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { nome?: string; tracciati_ids?: string[]; confronti_ids?: string[]; ordine?: number } }) =>
      apiUpdateMomento(id, data),
    onSuccess: () => invalidate(),
    onError: () =>
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5" />
          <span>Errore durante l'aggiornamento del momento</span>
        </div>
      ),
  });

  const updateConfrontoMetaMutation = useMutation({
    mutationFn: async ({ idA, idB, confrontoId, terremoto_degrado_massimo }: { idA: string; idB: string; confrontoId?: string; terremoto_degrado_massimo: number | null }) => {
      const confronto = confrontoId
        ? { id: confrontoId }
        : await apiCreateMomentoConfronto(idA, idB);
      return apiUpdateConfrontoMeta(confronto.id, { terremoto_degrado_massimo });
    },
    onSuccess: () => invalidate(),
    onError: () =>
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5" />
          <span>Errore durante l'aggiornamento del collegamento</span>
        </div>
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteMomento(id),
    onSuccess: () => invalidate(),
    onError: () =>
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5" />
          <span>Errore durante l'eliminazione del momento</span>
        </div>
      ),
  });

  const resetRisultatoMomentoMutation = useMutation({
    mutationFn: (id: string) => apiResetRisultatoMomento(id),
    onSuccess: () => invalidate(),
    onError: () =>
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5" />
          <span>Errore durante la rimozione del risultato</span>
        </div>
      ),
  });

  useEffect(() => {
    if (isCreating) newInputRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (schemaDropdownRef.current && !schemaDropdownRef.current.contains(e.target as Node)) {
        setShowSchemaDropdown(false);
      }
    };
    if (showSchemaDropdown) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSchemaDropdown]);

  useEffect(() => {
    setSchemaConfrontiPairs([]);
    setSchemaConfrontiEdges([]);
    setCompletedConfrontiKeys(new Set());
  }, [idPromo]);

  // Seed completedConfrontiKeys e completedConfrontoIds dai dati persistiti sul backend
  useEffect(() => {
    if (momenti.length === 0) return;
    const persistedKeys = new Set<string>();
    momenti.forEach((m) => {
      (m.confronti_con_risultato ?? []).forEach((altroId) => {
        persistedKeys.add(getConfrontoPairKey(m.id, altroId));
      });
      (m.confronti_con_id ?? []).forEach(({ momentoId, confrontoId }) => {
        const pairKey = getConfrontoPairKey(m.id, momentoId);
        completedConfrontoIds.current.set(pairKey, confrontoId);
      });
    });
    if (persistedKeys.size > 0) {
      setCompletedConfrontiKeys((prev) => {
        const merged = new Set(prev);
        persistedKeys.forEach((k) => merged.add(k));
        return merged;
      });
    }
  }, [momenti]);

  useEffect(() => {
    const currentIds = new Set(momenti.map((m) => m.id));
    Object.keys(cardRefs.current).forEach((id) => {
      if (!currentIds.has(id)) delete cardRefs.current[id];
    });
  }, [momenti]);

  const handleCreateSubmit = () => {
    const trimmed = newNome.trim();
    if (!trimmed) { setIsCreating(false); setNewNome(""); setNewIsSnapshot(false); return; }
    createMutation.mutate({ nome: trimmed, snapshot: newIsSnapshot });
  };

  const startCreating = (snapshot: boolean) => {
    setNewIsSnapshot(snapshot);
    setNewNome("");
    setIsCreating(true);
  };


  const handleApplicaSchema = async (idSchema: string) => {
    setApplyingSchemaId(idSchema);
    setShowSchemaDropdown(false);
    try {
      const schema = schemi.find((s) => s.id === idSchema);
      const baseOrdine = momenti.length;
      const createdMomenti = await apiApplicaSchema(idSchema, idPromo!);

      if (schema) {
        const confronti: TracciatiSchemaConfronto[] = schema.confronti ?? [];
        const byOrdine = new Map(createdMomenti.map((m) => [m.ordine, m] as const));
        const byIndex = [...createdMomenti].sort((a, b) => a.ordine - b.ordine);
        const getMomentoBySchemaOrdine = (schemaOrdine: number): TracciatiMomentoResponseDTO | undefined =>
          byOrdine.get(baseOrdine + schemaOrdine) ??
          byOrdine.get(schemaOrdine) ??
          byIndex[schemaOrdine];

        const nextPairs: MomentoConfrontoPair[] = confronti
          .map((c) => {
            const momentoA = getMomentoBySchemaOrdine(c.a);
            const momentoB = getMomentoBySchemaOrdine(c.b);
            if (!momentoA || !momentoB || momentoA.id === momentoB.id) return null;
            return { aId: momentoA.id, bId: momentoB.id };
          })
          .filter((p): p is MomentoConfrontoPair => p !== null);

        if (nextPairs.length > 0) {
          setSchemaConfrontiPairs((prev) => {
            const merged = [...prev];
            const seen = new Set(prev.map((p) => getConfrontoPairKey(p.aId, p.bId)));
            nextPairs.forEach((pair) => {
              const key = getConfrontoPairKey(pair.aId, pair.bId);
              if (!seen.has(key)) {
                seen.add(key);
                merged.push(pair);
              }
            });
            return merged;
          });
        }
      }

      invalidate();
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CheckCircle" className="text-success w-5 h-5" />
          <span>Schema applicato — momenti creati con successo</span>
        </div>
      );
    } catch {
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5" />
          <span>Errore durante l'applicazione dello schema</span>
        </div>
      );
    } finally {
      setApplyingSchemaId(null);
    }
  };

  // Chiudi menu confronto al click esterno
  useEffect(() => {
    if (!openMenuPairKey) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuPairKey(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuPairKey]);

  const handleConfronta = async (idA: string, idB: string) => {
    const pairKey = getConfrontoPairKey(idA, idB);
    if (comparingPairKey === pairKey) return;

    setComparingPairKey(pairKey);
    const a = momenti.find((m) => m.id === idA);
    const b = momenti.find((m) => m.id === idB);
    try {
      const confronto = await apiCreateMomentoConfronto(idA, idB);
      if (confronto.hasRisultato) {
        completedConfrontoIds.current.set(pairKey, confronto.id);
        setCompletedConfrontiKeys((prev) => {
          const next = new Set(prev);
          next.add(pairKey);
          return next;
        });
        invalidate();
        showNotification(
          <div className="flex items-center gap-3">
            <Lucide icon={confronto.report ? "CheckCircle" : "Info"} className={clsx(confronto.report ? "text-success" : "text-warning", "w-5 h-5 shrink-0")} />
            <span>{confronto.report ? "Confronto già elaborato. Clicca sul connettore per aprire il report." : "Confronto già elaborato, ma report non disponibile."}</span>
          </div>
        );
        return;
      }

      const risultato = await apiCalcolaRisultatoConfronto(confronto.id);
      if (risultato.hasRisultato) {
        completedConfrontoIds.current.set(pairKey, risultato.id);
        setCompletedConfrontiKeys((prev) => {
          const next = new Set(prev);
          next.add(pairKey);
          return next;
        });
      }
      invalidate();
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CheckCircle" className="text-success w-5 h-5 shrink-0" />
          <span>
            Confronto completato tra <strong>{a?.nome}</strong> e <strong>{b?.nome}</strong>. Clicca di nuovo sul pulsante confronto per aprire il report.
          </span>
        </div>
      );
    } catch {
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5 shrink-0" />
          <span>Errore durante il calcolo del confronto</span>
        </div>
      );
    } finally {
      setComparingPairKey(null);
    }
  };

  const handleConfrontaMenu = async (idA: string, idB: string, action: 'apri' | 'rifai' | 'rimuovi') => {
    const pairKey = getConfrontoPairKey(idA, idB);
    const idConfronto = completedConfrontoIds.current.get(pairKey);
    setOpenMenuPairKey(null);

    if (action === 'apri') {
      if (!idConfronto) return;
      navigate(`/promozioni/in-corso/dettagli/${idPromo}/report/${idConfronto}`);
    } else if (action === 'rifai') {
      setCompletedConfrontiKeys((prev) => { const s = new Set(prev); s.delete(pairKey); return s; });
      completedConfrontoIds.current.delete(pairKey);
      await handleConfronta(idA, idB);
    } else if (action === 'rimuovi') {
      if (!idConfronto) return;
      try {
        await apiResetConfronto(idConfronto);
        setCompletedConfrontiKeys((prev) => { const s = new Set(prev); s.delete(pairKey); return s; });
        completedConfrontoIds.current.delete(pairKey);
        invalidate();
      } catch {
        showNotification(
          <div className="flex items-center gap-3">
            <Lucide icon="CircleAlert" className="text-danger w-5 h-5 shrink-0" />
            <span>Errore durante la rimozione del report</span>
          </div>
        );
      }
    }
  };

  const runMomentoAnalisi = async (id: string) => {
    setPlayingId(id);
    try {
      await apiCalcolaRisultato(id);
      invalidate();
    } catch {
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5" />
          <span>Errore durante il calcolo del risultato</span>
        </div>
      );
    } finally {
      setPlayingId(null);
    }
  };

  const handlePlay = (id: string) => {
    const momento = momenti.find((m) => m.id === id);
    if (momento?.snapshot) {
      setSnapshotWarningTargetId(id);
      return;
    }
    void runMomentoAnalisi(id);
  };

  const handleConfirmSnapshotAnalisi = () => {
    if (!snapshotWarningTargetId) return;
    const targetId = snapshotWarningTargetId;
    setSnapshotWarningTargetId(null);
    void runMomentoAnalisi(targetId);
  };

  const handleMassiveRun = async () => {
    if (!idPromo || isMassiveRunning || momenti.length === 0) return;
    setIsMassiveRunning(true);
    try {
      // Fase 1: analisi di tutti i momenti senza risultato
      const momentiSenzaRisultato = momenti.filter((m) => !m.hasRisultato);
      if (momentiSenzaRisultato.length > 0) {
        setMassiveProgress({ current: 0, total: momentiSenzaRisultato.length, phase: 'analisi' });
        for (let i = 0; i < momentiSenzaRisultato.length; i++) {
          setMassiveProgress({ current: i + 1, total: momentiSenzaRisultato.length, phase: 'analisi' });
          try {
            await apiCalcolaRisultato(momentiSenzaRisultato[i].id);
          } catch {
            // continua sugli errori
          }
        }
      }

      // Recupera dati aggiornati dopo le analisi
      let currentMomenti: TracciatiMomentoResponseDTO[];
      try {
        currentMomenti = await fetchMomenti(idPromo!);
      } catch {
        currentMomenti = momenti;
      }
      queryClient.setQueryData(["tracciatiMomenti", idPromo], currentMomenti);

      // Aggiorna completedConfrontoIds dai dati freschi
      const completedFromFresh = new Set<string>();
      currentMomenti.forEach((m) => {
        (m.confronti_con_risultato ?? []).forEach((altroId) => {
          completedFromFresh.add(getConfrontoPairKey(m.id, altroId));
        });
        (m.confronti_con_id ?? []).forEach(({ momentoId, confrontoId }) => {
          completedConfrontoIds.current.set(getConfrontoPairKey(m.id, momentoId), confrontoId);
        });
      });

      // Fase 2: report per tutti i confronti lineari (adiacenti) senza report
      const sortedMomenti = [...currentMomenti].sort((a, b) => a.ordine - b.ordine);
      const linearPairsToRun: Array<{ idA: string; idB: string; pairKey: string }> = [];
      for (let i = 0; i < sortedMomenti.length - 1; i++) {
        const mA = sortedMomenti[i];
        const mB = sortedMomenti[i + 1];
        if (mA.hasRisultato && mB.hasRisultato) {
          const pairKey = getConfrontoPairKey(mA.id, mB.id);
          if (!completedFromFresh.has(pairKey) && !completedConfrontiKeys.has(pairKey)) {
            linearPairsToRun.push({ idA: mA.id, idB: mB.id, pairKey });
          }
        }
      }

      if (linearPairsToRun.length > 0) {
        setMassiveProgress({ current: 0, total: linearPairsToRun.length, phase: 'report' });
        for (let i = 0; i < linearPairsToRun.length; i++) {
          const { idA, idB, pairKey } = linearPairsToRun[i];
          setMassiveProgress({ current: i + 1, total: linearPairsToRun.length, phase: 'report' });
          try {
            const confronto = await apiCreateMomentoConfronto(idA, idB);
            let confrontoId = confronto.id;
            if (!confronto.hasRisultato) {
              const risultato = await apiCalcolaRisultatoConfronto(confronto.id);
              if (risultato.hasRisultato) confrontoId = risultato.id;
            }
            completedConfrontoIds.current.set(pairKey, confrontoId);
            setCompletedConfrontiKeys((prev) => { const s = new Set(prev); s.add(pairKey); return s; });
          } catch {
            // continua sugli errori
          }
        }
      }

      invalidate();
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CheckCircle" className="text-success w-5 h-5 shrink-0" />
          <span>Analisi massiva completata</span>
        </div>
      );
    } finally {
      setIsMassiveRunning(false);
      setMassiveProgress(null);
    }
  };

  const handlePromoScoreboard = async () => {
    if (!idPromo || isScoreboarding) return;
    setIsScoreboarding(true);
    try {
      const report = await apiCalcolaPromoScoreboard(idPromo);
      queryClient.setQueryData(["promoScoreboard", idPromo], report);
      navigate(`/promozioni/in-corso/dettagli/${idPromo}/report/promo-scoreboard`, { state: { report } });
    } catch {
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5 shrink-0" />
          <span>Nessun confronto con report disponibile per calcolare lo scoreboard</span>
        </div>
      );
    } finally {
      setIsScoreboarding(false);
    }
  };

  const schemaDropdownBtnCls = schemi.length > 0 && !applyingSchemaId
    ? "border-slate-300 text-slate-600 bg-white hover:bg-slate-50"
    : "border-slate-200 text-slate-400 cursor-not-allowed bg-white";
  const hasNonLinear = persistedSchemaPairs.length > 0;
  const momentiById = useMemo(
    () => new Map(momenti.map((m) => [m.id, m] as const)),
    [momenti]
  );

  const hasRisultatoForPair = useCallback((idA: string, idB: string): boolean => {
    const momentoA = momentiById.get(idA);
    const momentoB = momentiById.get(idB);
    return Boolean(momentoA?.hasRisultato && momentoB?.hasRisultato);
  }, [momentiById]);

  const recomputeSchemaEdges = useCallback(() => {
    if (!hasNonLinear || !graphRef.current) {
      setSchemaConfrontiEdges([]);
      return;
    }

    const indexById = new Map(momenti.map((m, index) => [m.id, index]));

    const orderedPairs = activeSchemaPairs
      .map((pair) => {
        const idxA = indexById.get(pair.aId);
        const idxB = indexById.get(pair.bId);
        if (idxA === undefined || idxB === undefined || idxA === idxB) return null;

        const leftToRight = idxA < idxB;

        return {
          key: getConfrontoPairKey(pair.aId, pair.bId),
          idA: pair.aId,
          idB: pair.bId,
          leftId: leftToRight ? pair.aId : pair.bId,
          rightId: leftToRight ? pair.bId : pair.aId,
          leftIndex: Math.min(idxA, idxB),
          rightIndex: Math.max(idxA, idxB),
          span: Math.abs(idxA - idxB),
        };
      })
      .filter(
        (
          p
        ): p is {
          key: string;
          idA: string;
          idB: string;
          leftId: string;
          rightId: string;
          leftIndex: number;
          rightIndex: number;
          span: number;
        } => p !== null
      )
      .sort((a, b) => {
        if (a.leftIndex !== b.leftIndex) return a.leftIndex - b.leftIndex;
        return a.span - b.span;
      });

    const containerRect = graphRef.current.getBoundingClientRect();

    function getPortX(
      rect: DOMRect,
      containerRect: DOMRect,
      portIndex: number,
      portCount: number
    ) {
      const left = rect.left - containerRect.left;
      const innerPadding = 24;

      if (portCount <= 1) {
        return left + rect.width / 2;
      }

      const usableWidth = Math.max(1, rect.width - innerPadding * 2);
      const step = usableWidth / (portCount - 1);

      return left + innerPadding + step * portIndex;
    }

    const connectionsByNode = new Map<string, string[]>();

    for (const pair of orderedPairs) {
      if (!connectionsByNode.has(pair.idA)) connectionsByNode.set(pair.idA, []);
      if (!connectionsByNode.has(pair.idB)) connectionsByNode.set(pair.idB, []);
      connectionsByNode.get(pair.idA)!.push(pair.key);
      connectionsByNode.get(pair.idB)!.push(pair.key);
    }

    for (const [nodeId, keys] of connectionsByNode.entries()) {
      keys.sort();
      connectionsByNode.set(nodeId, keys);
    }

    const laneLastRightIndex: number[] = [];

    const computedEdges: MomentoConfrontoEdge[] = orderedPairs.flatMap((pair) => {
      const leftEl = cardRefs.current[pair.leftId];
      const rightEl = cardRefs.current[pair.rightId];
      if (!leftEl || !rightEl) return [];

      const leftRect = leftEl.getBoundingClientRect();
      const rightRect = rightEl.getBoundingClientRect();

      let lane = 0;
      while (
        lane < laneLastRightIndex.length &&
        pair.leftIndex <= laneLastRightIndex[lane]
      ) {
        lane++;
      }
      laneLastRightIndex[lane] = pair.rightIndex;

      const startPorts = connectionsByNode.get(pair.idA) ?? [];
      const endPorts = connectionsByNode.get(pair.idB) ?? [];

      const startPortIndex = startPorts.indexOf(pair.key);
      const endPortIndex = endPorts.indexOf(pair.key);

      const startX = getPortX(leftRect, containerRect, startPortIndex, startPorts.length);
      const endX = getPortX(rightRect, containerRect, endPortIndex, endPorts.length);

      const startY = leftRect.top - containerRect.top - 12;
      const endY = rightRect.top - containerRect.top - 12;

      const stub = 16;
      const baseLift = 46;
      const laneGap = 24;
      const topY = Math.max(20, Math.min(startY, endY) - baseLift - lane * laneGap);

      const path = [
        `M ${startX} ${startY}`,
        `L ${startX} ${startY - stub}`,
        `L ${startX} ${topY}`,
        `L ${endX} ${topY}`,
        `L ${endX} ${endY - stub}`,
        `L ${endX} ${endY}`,
      ].join(" ");

      return [
        {
          key: pair.key,
          idA: pair.idA,
          idB: pair.idB,
          path,
          buttonX: (startX + endX) / 2,
          buttonY: topY,
          lane,
          startX,
          startY,
          endX,
          endY,
        },
      ];
    });

    setSchemaConfrontiEdges(computedEdges);
  }, [activeSchemaPairs, hasNonLinear, momenti]);


  useEffect(() => {
    if (!hasNonLinear) {
      setSchemaConfrontiEdges([]);
      return;
    }

    const raf = window.requestAnimationFrame(recomputeSchemaEdges);
    const handleResize = () => recomputeSchemaEdges();
    window.addEventListener("resize", handleResize);

    let observer: ResizeObserver | null = null;
    if (graphRef.current) {
      observer = new ResizeObserver(() => recomputeSchemaEdges());
      observer.observe(graphRef.current);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, [hasNonLinear, recomputeSchemaEdges]);

  const isConnectorActive = (idA: string, idB: string): boolean =>
    hasRisultatoForPair(idA, idB);

  const momentiCollegabiliPerCardMap = useMemo(() => {
    const collegabiliMap = new Map<string, TracciatiMomentoResponseDTO[]>();

    momenti.forEach((momento, index) => {
      const collegabili: TracciatiMomentoResponseDTO[] = [];

      momenti.forEach((other, j) => {
        if (other.id === momento.id) return;
        if (Math.abs(index - j) <= 1) return;
        if (schemaConfrontiPairSet.has(getConfrontoPairKey(momento.id, other.id))) return;
        collegabili.push(other);
      });

      collegabiliMap.set(momento.id, collegabili);
    });

    return collegabiliMap;
  }, [momenti, schemaConfrontiPairSet]);

  const momentiCollegabiliPerCard = useCallback((momentoId: string, _index: number): TracciatiMomentoResponseDTO[] => {
    return momentiCollegabiliPerCardMap.get(momentoId) ?? [];
  }, [momentiCollegabiliPerCardMap]);

  if (!idPromo) return null;

  return (
    <div className="space-y-4">
      <Dialog
        open={snapshotWarningTargetId !== null}
        onClose={() => setSnapshotWarningTargetId(null)}
        staticBackdrop
        size="md"
      >
        <Dialog.Panel>
          <Dialog.Title className="justify-center">
            <div className="flex items-center gap-2">
              <Lucide icon="TriangleAlert" className="w-5 h-5 text-warning" />
              <h3 className="text-lg font-semibold text-slate-800">Attenzione</h3>
            </div>
          </Dialog.Title>
          <Dialog.Description className="text-center px-6 py-5">
            <div className="flex justify-center mb-4">
              <Lucide icon="Camera" className="w-12 h-12 text-amber-500" />
            </div>
            <p className="text-slate-600">{SNAPSHOT_ANALISI_WARNING}</p>
          </Dialog.Description>
          <Dialog.Footer className="flex justify-center gap-3">
            <Button
              type="button"
              variant="outline-secondary"
              onClick={() => setSnapshotWarningTargetId(null)}
              className="w-32"
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmSnapshotAnalisi}
              className="w-40"
            >
              Avvia analisi
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* Toolbar */}
      <div className="flex items-center justify-end">
        {isCreating ? (
          <div className="flex items-center gap-2">
            <span className={clsx(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0",
              newIsSnapshot ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"
            )}>
              <Lucide icon={newIsSnapshot ? "Camera" : "List"} className="w-3 h-3" />
              {newIsSnapshot ? "Snapshot" : "Normale"}
            </span>
            <input
              ref={newInputRef}
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSubmit();
                if (e.key === "Escape") { setIsCreating(false); setNewNome(""); setNewIsSnapshot(false); }
              }}
              placeholder="Nome momento..."
              className="text-sm border border-primary/40 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary/20 w-52"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? <Lucide icon="Loader" className="w-4 h-4 animate-spin" />
                : "Salva"}
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => { setIsCreating(false); setNewNome(""); setNewIsSnapshot(false); }}
            >
              Annulla
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline-primary" size="sm" onClick={() => startCreating(false)}>
              <Lucide icon="Plus" className="w-4 h-4 mr-1.5" />
              Nuovo momento
            </Button>
            <Button variant="outline-secondary" size="sm" onClick={() => startCreating(true)}>
              <Lucide icon="Camera" className="w-4 h-4 mr-1.5" />
              Nuovo snapshot
            </Button>

            {/* Dropdown applica schema */}
            <div className="relative" ref={schemaDropdownRef}>
              <Button
                type="button"
                size="sm"
                className={clsx(
                  schemaDropdownBtnCls
                )}
                disabled={schemi.length === 0 || applyingSchemaId !== null}
                onClick={() => setShowSchemaDropdown((v) => !v)}
              >
                <Lucide
                  icon={applyingSchemaId ? "Loader" : "LayoutTemplate"}
                  className={clsx("w-4 h-4 mr-1.5", applyingSchemaId && "animate-spin")}
                />
                {applyingSchemaId ? "Applicazione..." : "Applica schema"}
                {!applyingSchemaId && (
                  <Lucide icon="ChevronDown" className="w-3.5 h-3.5 text-slate-400" />
                )}
              </Button>

              {showSchemaDropdown && schemi.length > 0 && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden min-w-[200px]">
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Seleziona schema
                  </p>
                  {schemi.map((s) => {
                    const tipi: TipoSchema[] = s.tipo ?? [];
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-primary/5 transition-colors"
                        onClick={() => handleApplicaSchema(s.id)}
                      >
                        <Lucide icon="LayoutTemplate" className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-slate-700 font-medium truncate">{s.nome}</p>
                            {tipi.map((t) => (
                              <span
                                key={t}
                                className={clsx(
                                  "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
                                  t === 'BUSINESS' ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                                )}
                              >
                                {t === 'BUSINESS' ? 'Business' : 'Agenzia'}
                              </span>
                            ))}
                          </div>
                          <p className="text-[11px] text-slate-400">{s.items.length} moment{s.items.length === 1 ? "o" : "i"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Analisi massiva */}
            {momenti.length > 0 && (() => {
              const canMassive = !isMassiveRunning && (
                momenti.some((m) => !m.hasRisultato) ||
                momenti.some((m, i) => {
                  if (i === 0) return false;
                  const prev = momenti[i - 1];
                  return prev.hasRisultato && m.hasRisultato && !completedConfrontiKeys.has(getConfrontoPairKey(prev.id, m.id));
                })
              );
              return (
                <Button
                  type="button"
                  size="sm"
                  className={clsx(
                    canMassive
                      ? "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                      : "border-slate-200 text-slate-400 cursor-not-allowed bg-white"
                  )}
                  disabled={!canMassive}
                  onClick={handleMassiveRun}
                  title="Avvia analisi di tutti i momenti e genera report per tutti i confronti lineari"
                >
                  <Lucide
                    icon={isMassiveRunning ? "Loader" : "Zap"}
                    className={clsx("w-4 h-4 mr-1.5", isMassiveRunning && "animate-spin")}
                  />
                  {isMassiveRunning ? "In esecuzione..." : "Analisi massiva"}
                </Button>
              );
            })()}

            {/* Scoreboard Promo */}
            {savedScoreboard ? (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                  onClick={() => navigate(`/promozioni/in-corso/dettagli/${idPromo}/report/promo-scoreboard`, { state: { report: savedScoreboard } })}
                  title="Visualizza l'ultimo scoreboard calcolato"
                >
                  <Lucide icon="BarChart3" className="w-4 h-4 mr-1.5" />
                  Analisi totale
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={clsx(
                    completedConfrontiKeys.size > 0 && !isScoreboarding
                      ? "border-slate-300 text-slate-500 bg-white hover:bg-slate-50"
                      : "border-slate-200 text-slate-400 cursor-not-allowed bg-white"
                  )}
                  disabled={completedConfrontiKeys.size === 0 || isScoreboarding}
                  onClick={handlePromoScoreboard}
                  title="Ricalcola lo scoreboard con i dati attuali"
                >
                  <Lucide
                    icon={isScoreboarding ? "Loader" : "RefreshCw"}
                    className={clsx("w-4 h-4", isScoreboarding && "animate-spin")}
                  />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                className={clsx(
                  completedConfrontiKeys.size > 0 && !isScoreboarding
                    ? "border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                    : "border-slate-200 text-slate-400 cursor-not-allowed bg-white"
                )}
                disabled={completedConfrontiKeys.size === 0 || isScoreboarding}
                onClick={handlePromoScoreboard}
                title={completedConfrontiKeys.size === 0 ? "Disponibile dopo aver completato almeno un confronto" : "Calcola lo scoreboard stabilità per reparto"}
              >
                <Lucide
                  icon={isScoreboarding ? "Loader" : "BarChart3"}
                  className={clsx("w-4 h-4 mr-1.5", isScoreboarding && "animate-spin")}
                />
                {isScoreboarding ? "Calcolo..." : "Analisi totale"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Avanzamento analisi massiva */}
      {massiveProgress && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <Lucide icon="Loader" className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-700">
              {massiveProgress.phase === 'analisi'
                ? `Analisi momenti — ${massiveProgress.current} di ${massiveProgress.total}`
                : `Report confronti lineari — ${massiveProgress.current} di ${massiveProgress.total}`}
            </p>
            <div className="mt-1.5 h-1.5 bg-emerald-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${massiveProgress.total > 0 ? (massiveProgress.current / massiveProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-600 shrink-0">
            {massiveProgress.total > 0 ? Math.round((massiveProgress.current / massiveProgress.total) * 100) : 0}%
          </span>
        </div>
      )}

      {/* Momenti orizzontali */}
      {momentiQuery.isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-80 h-56 rounded-lg border border-slate-200 bg-slate-50 animate-pulse"
            />
          ))}
        </div>
      ) : momenti.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Lucide icon="Timer" className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">Nessun momento creato</p>
          <p className="text-xs mt-1">Crea il primo momento per raggruppare i tracciati</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div
            ref={graphRef}
            className="relative w-max"
            style={{ paddingTop: hasNonLinear ? "220px" : "0" }}
          >
            {/* SVG overlay per confronti non adiacenti */}
            {hasNonLinear && (
              <svg className="pointer-events-none absolute inset-0 z-0 w-full h-full overflow-visible">
                <defs>
                  <marker
                    id="momenti-schema-arrow"
                    markerWidth="10"
                    markerHeight="10"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    orient="auto"
                  >
                    <path
                      d="M2 1.5 L8 5 L2 8.5"
                      fill="none"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="stroke-primary/60"
                    />
                  </marker>
                  <marker
                    id="momenti-schema-arrow-success"
                    markerWidth="10"
                    markerHeight="10"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    orient="auto"
                  >
                    <path
                      d="M2 1.5 L8 5 L2 8.5"
                      fill="none"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="stroke-success/60"
                    />
                  </marker>
                </defs>
                {schemaConfrontiEdges.map((edge) => {
                  const isEdgeCompleted = completedConfrontiKeys.has(edge.key);
                  return (
                    <path
                      key={edge.key}
                      d={edge.path}
                      fill="none"
                      stroke="currentColor"
                      className={isEdgeCompleted ? "text-success/50" : "text-primary/35"}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      markerEnd={isEdgeCompleted ? "url(#momenti-schema-arrow-success)" : "url(#momenti-schema-arrow)"}
                    />
                  );
                })}
              </svg>
            )}

            {/* Pulsanti archi non adiacenti */}
            {hasNonLinear && schemaConfrontiEdges.map((edge) => {
              const canConfronta = hasRisultatoForPair(edge.idA, edge.idB);
              const isComparing = comparingPairKey === edge.key;
              const isCompleted = completedConfrontiKeys.has(edge.key);
              const isMenuOpenEdge = openMenuPairKey === edge.key;
              return (
                <div
                  key={`${edge.key}-btn`}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: edge.buttonX, top: edge.buttonY }}
                >
                  <button
                    type="button"
                    title={
                      !canConfronta
                        ? CONFRONTO_RESULT_HINT
                        : isComparing
                          ? "Confronto in esecuzione..."
                          : isCompleted
                            ? "Report disponibile — clicca per le opzioni"
                            : "Confronta momenti collegati"
                    }
                    disabled={!canConfronta || isComparing}
                    className={clsx(
                      "w-8 h-8 flex items-center justify-center rounded-full border-2 shadow-sm transition-colors",
                      isCompleted
                        ? "border-success/60 bg-white text-success hover:border-success cursor-pointer"
                        : canConfronta && !isComparing
                          ? "border-primary/30 bg-white text-primary hover:border-primary/50"
                          : "border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed"
                    )}
                    onClick={() => {
                      if (!canConfronta || isComparing) return;
                      if (isCompleted) setOpenMenuPairKey(edge.key);
                      else handleConfronta(edge.idA, edge.idB);
                    }}
                  >
                    <Lucide
                      icon={isComparing ? "Loader" : isCompleted ? "Check" : "GitCompare"}
                      className={clsx("w-4 h-4", isComparing && "animate-spin")}
                    />
                  </button>
                  {isMenuOpenEdge && isCompleted && (
                    <div
                      ref={menuRef}
                      className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden min-w-[160px]"
                    >
                      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                        Report confronto
                      </div>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-700 hover:bg-primary/5 transition-colors"
                        onClick={() => handleConfrontaMenu(edge.idA, edge.idB, 'apri')}
                      >
                        <Lucide icon="ExternalLink" className="w-4 h-4 text-primary shrink-0" />
                        Apri report
                      </button>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-700 hover:bg-amber-50 transition-colors"
                        onClick={() => handleConfrontaMenu(edge.idA, edge.idB, 'rifai')}
                      >
                        <Lucide icon="RefreshCw" className="w-4 h-4 text-amber-500 shrink-0" />
                        Rifai confronto
                      </button>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-danger hover:bg-danger/5 transition-colors"
                        onClick={() => handleConfrontaMenu(edge.idA, edge.idB, 'rimuovi')}
                      >
                        <Lucide icon="Trash2" className="w-4 h-4 shrink-0" />
                        Rimuovi report
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Layout lineare: connettori adiacenti + card */}
            <div className="flex items-stretch">
              {momenti.map((m, index) => (
                <React.Fragment key={m.id}>
                  {index > 0 && (() => {
                    const previous = momenti[index - 1];
                    const pairKey = getConfrontoPairKey(previous.id, m.id);
                    const confrontoMeta =
                      (previous.confronti_con_id ?? []).find((c) => c.momentoId === m.id) ??
                      (m.confronti_con_id ?? []).find((c) => c.momentoId === previous.id);
                    return (
                      <MomentoConnector
                        momentoA={previous}
                        momentoB={m}
                        onConfronta={handleConfronta}
                        onMenuAction={handleConfrontaMenu}
                        onUpdateTerremoto={(idA, idB, confrontoId, terremoto_degrado_massimo) =>
                          updateConfrontoMetaMutation.mutate({ idA, idB, confrontoId, terremoto_degrado_massimo })
                        }
                        confrontoId={confrontoMeta?.confrontoId}
                        terremotoDegradoMassimo={confrontoMeta?.terremotoDegradoMassimo}
                        isActive={isConnectorActive(previous.id, m.id)}
                        isLoading={comparingPairKey === pairKey}
                        isUpdatingMeta={updateConfrontoMetaMutation.isPending && updateConfrontoMetaMutation.variables
                          ? getConfrontoPairKey(updateConfrontoMetaMutation.variables.idA, updateConfrontoMetaMutation.variables.idB) === pairKey
                          : false}
                        hasCompleted={completedConfrontiKeys.has(pairKey)}
                        isMenuOpen={openMenuPairKey === pairKey}
                        onOpenMenu={(idA, idB) => setOpenMenuPairKey(getConfrontoPairKey(idA, idB))}
                        menuRef={menuRef}
                      />
                    );
                  })()}
                  <div
                    ref={(el) => { cardRefs.current[m.id] = el; }}
                    className="relative z-10"
                  >
                    <MomentoCard
                      momento={m}
                      tracciati={tracciati}
                      onRename={(id, nome) => updateMutation.mutate({ id, data: { nome } })}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      onAddTracciato={(id, tracciati_ids) => updateMutation.mutate({ id, data: { tracciati_ids } })}
                      onRemoveTracciato={(id, tracciati_ids) => updateMutation.mutate({ id, data: { tracciati_ids } })}
                      onPlay={handlePlay}
                      onResetRisultato={(id) => resetRisultatoMomentoMutation.mutate(id)}
                      onCollegaNonAdiacente={(targetId) => handleConfronta(m.id, targetId)}
                      momentiCollegabili={momentiCollegabiliPerCard(m.id, index)}
                      isUpdating={updateMutation.isPending && updateMutation.variables?.id === m.id}
                      isDeleting={deleteMutation.isPending && deleteMutation.variables === m.id}
                      isPlaying={playingId === m.id}
                      isCollegando={comparingPairKey !== null && comparingPairKey.split('::').includes(m.id)}
                    />
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GestioneMomenti;
