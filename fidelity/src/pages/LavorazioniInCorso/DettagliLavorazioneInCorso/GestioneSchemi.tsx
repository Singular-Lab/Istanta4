import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import React, { useRef, useState } from "react";
import { ServerCall } from "../../../../lib/server_call";
import type { TipoSchema, TracciatiSchemaConfronto, TracciatiSchemaItem, TracciatiSchemaResponseDTO } from "../../../../lib/types";

// ─── Configurazione tipi schema ───────────────────────────────────────────────

const TIPI_SCHEMA: { value: TipoSchema; label: string; colorClass: string; activeClass: string }[] = [
  { value: 'BUSINESS', label: 'Business', colorClass: 'bg-blue-100 text-blue-700', activeClass: 'ring-1 ring-blue-400 bg-blue-100 text-blue-700' },
  { value: 'AGENZIA', label: 'Agenzia', colorClass: 'bg-violet-100 text-violet-700', activeClass: 'ring-1 ring-violet-400 bg-violet-100 text-violet-700' },
];

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchSchemi(): Promise<TracciatiSchemaResponseDTO[]> {
  return (await ServerCall.get<TracciatiSchemaResponseDTO[]>("/tracciati/schemi")) ?? [];
}

async function apiCreateSchema(
  nome: string,
  tipo: TipoSchema[],
  items: TracciatiSchemaItem[],
  confronti: TracciatiSchemaConfronto[]
): Promise<TracciatiSchemaResponseDTO> {
  return ServerCall.post<TracciatiSchemaResponseDTO>("/tracciati/schemi", { nome, tipo, items, confronti });
}

async function apiDeleteSchema(id: string): Promise<void> {
  await ServerCall.delete(`/tracciati/schemi/${id}`);
}

// ─── SchemaItemRow ────────────────────────────────────────────────────────────

interface SchemaItemRowProps {
  item: TracciatiSchemaItem;
  isSelected: boolean;
  isInPair: boolean;
  onRemove: () => void;
  onToggleSnapshot: () => void;
  onSelect: () => void;
  selectionMode: boolean;
}

const SchemaItemRow: React.FC<SchemaItemRowProps> = ({
  item, isSelected, isInPair, onRemove, onToggleSnapshot, onSelect, selectionMode,
}) => (
  <div
    className={clsx(
      "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all group",
      selectionMode
        ? isSelected
          ? "border-primary bg-primary/10 ring-1 ring-primary/40 cursor-pointer"
          : "border-slate-200 bg-slate-50 hover:border-slate-300 cursor-pointer"
        : "border-slate-200 bg-slate-50"
    )}
    onClick={selectionMode ? onSelect : undefined}
  >
    {isInPair && (
      <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
        <Lucide icon="GitCompare" className="w-2.5 h-2.5" />
      </span>
    )}
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggleSnapshot(); }}
      title={item.snapshot ? "Snapshot — clicca per cambiare in Normale" : "Normale — clicca per cambiare in Snapshot"}
      className={clsx(
        "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors",
        item.snapshot ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-primary/10 text-primary hover:bg-primary/20"
      )}
    >
      <Lucide icon={item.snapshot ? "Camera" : "List"} className="w-3 h-3" />
      {item.snapshot ? "Snap" : "Norm"}
    </button>
    <span className="flex-1 text-sm text-slate-700 truncate">{item.nome}</span>
    {isSelected && (
      <span className="shrink-0 text-[10px] text-primary font-semibold">selezionato</span>
    )}
    {!selectionMode && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="shrink-0 p-0.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Lucide icon="X" className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

// ─── SchemaCard ───────────────────────────────────────────────────────────────

interface SchemaCardProps {
  schema: TracciatiSchemaResponseDTO;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

const SchemaCard: React.FC<SchemaCardProps> = ({ schema, onDelete, isDeleting }) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const tipi = schema.tipo ?? [];
  const confronti = schema.confronti ?? [];

  return (
    <div className="flex-shrink-0 w-72 flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-800 truncate flex-1">{schema.nome}</span>
        {/* Badge tipo */}
        <div className="flex items-center gap-1 shrink-0">
          {tipi.map((t) => {
            const cfg = TIPI_SCHEMA.find(ts => ts.value === t);
            return cfg ? (
              <span key={t} className={clsx("px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide", cfg.colorClass)}>
                {cfg.label}
              </span>
            ) : null;
          })}
        </div>
        {/* Azioni */}
        <div className="flex items-center gap-1 shrink-0">
          {showConfirmDelete ? (
            <>
              <button
                type="button"
                className="p-1 rounded bg-danger/10 hover:bg-danger/20 text-danger transition-colors"
                onClick={() => { onDelete(schema.id); setShowConfirmDelete(false); }}
                disabled={isDeleting}
              >
                <Lucide icon={isDeleting ? "Loader" : "Check"} className={clsx("w-4 h-4", isDeleting && "animate-spin")} />
              </button>
              <button type="button" className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors" onClick={() => setShowConfirmDelete(false)}>
                <Lucide icon="X" className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button type="button" className="p-1 rounded hover:bg-danger/10 text-slate-400 hover:text-danger transition-colors" onClick={() => setShowConfirmDelete(true)}>
              <Lucide icon="Trash2" className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 flex flex-col gap-1.5 p-3 min-h-[80px]">
        {schema.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-16 text-slate-400 text-xs text-center">
            <Lucide icon="ListX" className="w-5 h-5 mb-1 opacity-50" />
            Nessun momento definito
          </div>
        ) : (
          schema.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className={clsx(
                "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
                item.snapshot ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"
              )}>
                <Lucide icon={item.snapshot ? "Camera" : "List"} className="w-3 h-3" />
                {item.snapshot ? "Snap" : "Norm"}
              </span>
              <span className="flex-1 text-sm text-slate-700 truncate">{item.nome}</span>
            </div>
          ))
        )}
      </div>

      {/* Confronti */}
      {confronti.length > 0 && (
        <div className="px-3 pb-3 pt-2 border-t border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Confronti
          </p>
          <div className="flex flex-col gap-1">
            {confronti.map((c, idx) => {
              const itemA = schema.items.find(it => it.ordine === c.a);
              const itemB = schema.items.find(it => it.ordine === c.b);
              return (
                <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Lucide icon="GitCompare" className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="font-medium truncate max-w-[90px]">{itemA?.nome ?? `#${c.a}`}</span>
                  <span className="text-slate-400 shrink-0">↔</span>
                  <span className="font-medium truncate max-w-[90px]">{itemB?.nome ?? `#${c.b}`}</span>
                  {c.terremotoDegradoMassimo != null && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-semibold" title="Degrado terremoto massimo del confronto">
                      <Lucide icon="Zap" className="w-2.5 h-2.5" />
                      {c.terremotoDegradoMassimo}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── NuovoSchemaForm ──────────────────────────────────────────────────────────

interface NuovoSchemaFormProps {
  onSave: (nome: string, tipo: TipoSchema[], items: TracciatiSchemaItem[], confronti: TracciatiSchemaConfronto[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}

const NuovoSchemaForm: React.FC<NuovoSchemaFormProps> = ({ onSave, onCancel, isSaving }) => {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoSchema[]>(['BUSINESS']);
  const [items, setItems] = useState<TracciatiSchemaItem[]>([]);
  const [confronti, setConfronti] = useState<TracciatiSchemaConfronto[]>([]);
  const [selectedForConfronto, setSelectedForConfronto] = useState<number | null>(null);
  const [newItemNome, setNewItemNome] = useState("");
  const [newItemSnapshot, setNewItemSnapshot] = useState(false);
  const [newConfrontoTerremoto, setNewConfrontoTerremoto] = useState<string>("");
  const itemInputRef = useRef<HTMLInputElement>(null);

  const toggleTipo = (t: TipoSchema) => {
    setTipo((prev) => {
      if (prev.includes(t)) {
        // Non deselezionare se è l'unico attivo
        return prev.length > 1 ? prev.filter((v) => v !== t) : prev;
      }
      return [...prev, t];
    });
  };

  const addItem = () => {
    const trimmed = newItemNome.trim();
    if (!trimmed) return;
    setItems((prev) => [...prev, { nome: trimmed, snapshot: newItemSnapshot, ordine: prev.length }]);
    setNewItemNome("");
    setNewItemSnapshot(false);
    itemInputRef.current?.focus();
  };

  const parseConfrontoTerremoto = () => {
    const raw = newConfrontoTerremoto.trim();
    if (raw === "") return null;
    const parsed = Number(raw);
    return !isNaN(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
  };

  const removeItem = (i: number) => {
    const removedOrdine = items[i].ordine;
    const newItems = items.filter((_, idx) => idx !== i).map((item, idx) => ({ ...item, ordine: idx }));
    // Mappa vecchio ordine → nuovo ordine
    const oldToNew: Record<number, number> = {};
    items.filter((_, idx) => idx !== i).forEach((item, newIdx) => {
      oldToNew[item.ordine] = newIdx;
    });
    // Filtra confronti che includono l'item rimosso e rimappa gli ordini
    setConfronti((prev) =>
      prev
        .filter((c) => c.a !== removedOrdine && c.b !== removedOrdine)
        .map((c) => ({ ...c, a: oldToNew[c.a] ?? c.a, b: oldToNew[c.b] ?? c.b }))
    );
    if (selectedForConfronto === removedOrdine) setSelectedForConfronto(null);
    setItems(newItems);
  };

  const toggleSnapshot = (i: number) =>
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, snapshot: !item.snapshot } : item));

  const handleSelectForConfronto = (ordine: number) => {
    if (selectedForConfronto === null) {
      setSelectedForConfronto(ordine);
    } else if (selectedForConfronto === ordine) {
      setSelectedForConfronto(null);
    } else {
      const exists = confronti.some(
        (c) => (c.a === selectedForConfronto && c.b === ordine) || (c.a === ordine && c.b === selectedForConfronto)
      );
      if (!exists) {
        setConfronti((prev) => [...prev, { a: selectedForConfronto, b: ordine, terremotoDegradoMassimo: parseConfrontoTerremoto() }]);
      }
      setSelectedForConfronto(null);
      setNewConfrontoTerremoto("");
    }
  };

  const removeConfronto = (idx: number) =>
    setConfronti((prev) => prev.filter((_, i) => i !== idx));

  const selectionMode = items.length >= 2;

  return (
    <div className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5 space-y-3 flex-shrink-0 w-80">
      <p className="text-sm font-semibold text-slate-700">Nuovo schema</p>

      {/* Nome schema */}
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome schema..."
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary/20"
      />

      {/* Tipo schema */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">Tipo schema</p>
        <div className="flex gap-1.5">
          {TIPI_SCHEMA.map((t) => {
            const active = tipo.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleTipo(t.value)}
                disabled={active && tipo.length === 1}
                className={clsx(
                  "flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                  active
                    ? `${t.activeClass} border-transparent`
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Aggiunta item */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-500">Momenti dello schema</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setNewItemSnapshot((v) => !v)}
            className={clsx(
              "shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors",
              newItemSnapshot ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
          >
            <Lucide icon={newItemSnapshot ? "Camera" : "List"} className="w-3 h-3" />
            {newItemSnapshot ? "Snap" : "Norm"}
          </button>
          <input
            ref={itemInputRef}
            value={newItemNome}
            onChange={(e) => setNewItemNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
            placeholder="Nome momento..."
            className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!newItemNome.trim()}
            className="shrink-0 p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
          >
            <Lucide icon="Plus" className="w-4 h-4" />
          </button>
        </div>

        {/* Lista item + selezione confronti */}
        {items.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            {selectionMode && (
              <>
                <p className="text-[10px] text-slate-400 font-medium px-0.5">
                  {selectedForConfronto !== null
                    ? "Seleziona il secondo momento per creare la coppia"
                    : "Clicca due momenti per definire una coppia di confronto"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Lucide icon="Zap" className="w-3 h-3 text-orange-400 shrink-0" />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={newConfrontoTerremoto}
                    onChange={(e) => setNewConfrontoTerremoto(e.target.value)}
                    placeholder="Degrado terremoto del prossimo collegamento %"
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-orange-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </>
            )}
            {items.map((item, i) => (
              <SchemaItemRow
                key={i}
                item={item}
                isSelected={selectedForConfronto === item.ordine}
                isInPair={confronti.some((c) => c.a === item.ordine || c.b === item.ordine)}
                onRemove={() => removeItem(i)}
                onToggleSnapshot={() => toggleSnapshot(i)}
                onSelect={() => handleSelectForConfronto(item.ordine)}
                selectionMode={selectionMode}
              />
            ))}
          </div>
        )}

        {/* Coppie confronto aggiunte */}
        {confronti.length > 0 && (
          <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-slate-200">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Confronti</p>
            {confronti.map((c, idx) => {
              const itemA = items.find((it) => it.ordine === c.a);
              const itemB = items.find((it) => it.ordine === c.b);
              return (
                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <Lucide icon="GitCompare" className="w-3 h-3 shrink-0 text-emerald-500" />
                  <span className="font-medium truncate max-w-[70px]">{itemA?.nome ?? `#${c.a}`}</span>
                  <span className="text-emerald-400 shrink-0">↔</span>
                  <span className="font-medium truncate max-w-[70px]">{itemB?.nome ?? `#${c.b}`}</span>
                  {c.terremotoDegradoMassimo != null && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-semibold">
                      <Lucide icon="Zap" className="w-2.5 h-2.5" />
                      {c.terremotoDegradoMassimo}%
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeConfronto(idx)}
                    className="ml-auto p-0.5 rounded text-emerald-500 hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Lucide icon="X" className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Azioni */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => onSave(nome.trim(), tipo, items, confronti)}
          disabled={!nome.trim() || items.length === 0 || tipo.length === 0 || isSaving}
        >
          {isSaving ? <Lucide icon="Loader" className="w-4 h-4 animate-spin" /> : "Salva schema"}
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </div>
  );
};

// ─── GestioneSchemi ───────────────────────────────────────────────────────────

interface GestioneSchemiProps { }

const GestioneSchemi: React.FC<GestioneSchemiProps> = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [showCreating, setShowCreating] = useState(false);

  const schemiQuery = useQuery({
    queryKey: ["tracciatiSchemi"],
    queryFn: fetchSchemi,
    placeholderData: (prev) => prev ?? [],
  });

  const schemi = schemiQuery.data ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tracciatiSchemi"] });

  const createMutation = useMutation({
    mutationFn: ({ nome, tipo, items, confronti }: { nome: string; tipo: TipoSchema[]; items: TracciatiSchemaItem[]; confronti: TracciatiSchemaConfronto[] }) =>
      apiCreateSchema(nome, tipo, items, confronti),
    onSuccess: () => { invalidate(); setShowCreating(false); },
    onError: () =>
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5" />
          <span>Errore durante la creazione dello schema</span>
        </div>
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteSchema(id),
    onSuccess: () => invalidate(),
    onError: () =>
      showNotification(
        <div className="flex items-center gap-3">
          <Lucide icon="CircleAlert" className="text-danger w-5 h-5" />
          <span>Errore durante l'eliminazione dello schema</span>
        </div>
      ),
  });

  return (
    <div className="space-y-3">
      {/* Header sezione */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">
          Gestisci i template di schema: definisci la struttura dei momenti e i confronti da eseguire
        </p>
        {!showCreating && (
          <Button variant="outline-primary" size="sm" onClick={() => setShowCreating(true)}>
            <Lucide icon="Plus" className="w-4 h-4 mr-1.5" />
            Nuovo schema
          </Button>
        )}
      </div>

      {/* Lista schemi + form creazione */}
      {schemiQuery.isLoading ? (
        <div className="flex gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex-shrink-0 w-72 h-48 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : schemi.length === 0 && !showCreating ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
          <Lucide icon="LayoutTemplate" className="w-7 h-7 mb-2 opacity-40" />
          <p className="text-sm font-medium">Nessuno schema disponibile</p>
          <p className="text-xs mt-1">Crea il primo schema per velocizzare la configurazione dei momenti</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {showCreating && (
            <NuovoSchemaForm
              onSave={(nome, tipo, items, confronti) => {
                createMutation.mutate({ nome, tipo, items, confronti })
              }}
              onCancel={() => setShowCreating(false)}
              isSaving={createMutation.isPending}
            />
          )}
          {schemi.map((s) => (
            <SchemaCard
              key={s.id}
              schema={s}
              onDelete={(id) => deleteMutation.mutate(id)}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === s.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GestioneSchemi;
