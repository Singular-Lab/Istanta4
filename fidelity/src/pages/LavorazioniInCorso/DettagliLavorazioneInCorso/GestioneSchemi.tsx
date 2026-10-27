import Button from "@/components/Base/Button";
import { FormInput } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Skeleton from "@/components/Base/Skeleton";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import React, { useRef, useState } from "react";
import { ServerCall } from "../../../../lib/server_call";
import type { TipoSchema, TracciatiSchemaConfronto, TracciatiSchemaItem, TracciatiSchemaResponseDTO } from "../../../../lib/types";

// ─── Configurazione tipi schema ───────────────────────────────────────────────

const TIPI_SCHEMA: { value: TipoSchema; label: string; colorClass: string; activeClass: string }[] = [
  { value: 'BUSINESS', label: 'Business', colorClass: 'bg-sky-100 text-sky-800', activeClass: 'ring-1 ring-sky-400 bg-sky-100 text-sky-800' },
  { value: 'AGENZIA', label: 'Agenzia', colorClass: 'bg-theme-1/10 text-theme-1', activeClass: 'ring-1 ring-theme-1/40 bg-theme-1/10 text-theme-1' },
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
      "group flex items-center gap-2 rounded-control border px-2.5 py-1.5 transition-all",
      selectionMode
        ? isSelected
          ? "border-primary bg-primary/10 ring-1 ring-primary/40 cursor-pointer"
          : "border-slate-200 bg-slate-50 hover:border-slate-300 cursor-pointer"
        : "border-slate-200 bg-slate-50"
    )}
    onClick={selectionMode ? onSelect : undefined}
  >
    {isInPair && (
      <span title="In una coppia di confronto" className="inline-flex shrink-0 items-center rounded-full bg-teal-100 p-1 text-teal-800">
        <Lucide icon="GitCompare" aria-hidden="true" className="h-2.5 w-2.5" />
        <span className="sr-only">In una coppia di confronto</span>
      </span>
    )}
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggleSnapshot(); }}
      title={item.snapshot ? "Snapshot — clicca per cambiare in Normale" : "Normale — clicca per cambiare in Snapshot"}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wide transition-colors",
        item.snapshot ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-theme-1/10 text-theme-1 hover:bg-theme-1/20"
      )}
    >
      <Lucide icon={item.snapshot ? "Camera" : "List"} aria-hidden="true" className="h-3 w-3" />
      {item.snapshot ? "Snap" : "Norm"}
    </button>
    <span className="flex-1 text-sm text-slate-700 truncate">{item.nome}</span>
    {isSelected && (
      <span className="shrink-0 text-3xs text-primary font-semibold">selezionato</span>
    )}
    {!selectionMode && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label={`Rimuovi ${item.nome}`}
        className="shrink-0 rounded-control p-0.5 text-slate-400 opacity-0 transition-all hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Lucide icon="X" aria-hidden="true" className="w-3.5 h-3.5" />
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
    <div className="flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-card border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
        <h3 className="title-card flex-1 truncate">{schema.nome}</h3>
        {/* Badge tipo */}
        <div className="flex shrink-0 items-center gap-1">
          {tipi.map((t) => {
            const cfg = TIPI_SCHEMA.find(ts => ts.value === t);
            return cfg ? (
              <span key={t} className={clsx("rounded-full px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wide", cfg.colorClass)}>
                {cfg.label}
              </span>
            ) : null;
          })}
        </div>
        <Button
          type="button"
          variant="outline-danger"
          size="xs"
          aria-label={`Elimina lo schema ${schema.nome}`}
          title="Elimina schema"
          onClick={() => setShowConfirmDelete(true)}
          loading={isDeleting}
        >
          {!isDeleting && <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <ConfirmDialog
        open={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={() => {
          onDelete(schema.id);
          setShowConfirmDelete(false);
        }}
        loading={isDeleting}
        title="Elimina schema"
        confirmLabel="Elimina"
        description={
          <p>
            Lo schema <span className="font-semibold text-slate-800">{schema.nome}</span> verrà eliminato definitivamente.
          </p>
        }
      />

      {/* Items */}
      <div className="flex min-h-20 flex-1 flex-col gap-1.5 p-3">
        {schema.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-16 text-slate-400 text-xs text-center">
            <Lucide icon="ListX" aria-hidden="true" className="mb-1 h-5 w-5 opacity-50" />
            Nessun momento definito
          </div>
        ) : (
          schema.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-control border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <span className={clsx(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wide",
                item.snapshot ? "bg-amber-100 text-amber-800" : "bg-theme-1/10 text-theme-1"
              )}>
                <Lucide icon={item.snapshot ? "Camera" : "List"} aria-hidden="true" className="h-3 w-3" />
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
          <p className="title-eyebrow mb-1.5">Confronti</p>
          <div className="flex flex-col gap-1">
            {confronti.map((c, idx) => {
              const itemA = schema.items.find(it => it.ordine === c.a);
              const itemB = schema.items.find(it => it.ordine === c.b);
              return (
                <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Lucide icon="GitCompare" aria-hidden="true" className="h-3 w-3 shrink-0 text-teal-600" />
                  <span className="max-w-24 truncate font-medium">{itemA?.nome ?? `#${c.a}`}</span>
                  <span className="shrink-0 text-slate-400">↔</span>
                  <span className="max-w-24 truncate font-medium">{itemB?.nome ?? `#${c.b}`}</span>
                  {c.terremotoDegradoMassimo != null && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-3xs font-semibold text-amber-800" title="Degrado terremoto massimo del confronto">
                      <Lucide icon="Zap" aria-hidden="true" className="h-2.5 w-2.5" />
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
    <div className="w-80 flex-shrink-0 space-y-3 rounded-card border border-dashed border-theme-1/40 bg-theme-1/5 p-4">
      <h3 className="title-card">Nuovo schema</h3>

      {/* Nome schema */}
      <FormInput
        formInputSize="sm"
        aria-label="Nome dello schema"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome schema…"
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
                aria-pressed={active}
                className={clsx(
                  "flex-1 rounded-control border px-2 py-1.5 text-xs font-semibold transition-all",
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
            aria-pressed={newItemSnapshot}
            title="Tipo del nuovo momento: Snapshot o Normale"
            className={clsx(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-3xs font-semibold uppercase tracking-wide transition-colors",
              newItemSnapshot ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-theme-1/10 text-theme-1 hover:bg-theme-1/20"
            )}
          >
            <Lucide icon={newItemSnapshot ? "Camera" : "List"} aria-hidden="true" className="h-3 w-3" />
            {newItemSnapshot ? "Snap" : "Norm"}
          </button>
          <FormInput
            ref={itemInputRef}
            formInputSize="sm"
            aria-label="Nome del momento"
            className="flex-1"
            value={newItemNome}
            onChange={(e) => setNewItemNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
            placeholder="Nome momento…"
          />
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            onClick={addItem}
            disabled={!newItemNome.trim()}
            aria-label="Aggiungi momento"
            className="shrink-0"
          >
            <Lucide icon="Plus" aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Lista item + selezione confronti */}
        {items.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            {selectionMode && (
              <>
                <p className="px-0.5 text-2xs font-medium text-slate-500">
                  {selectedForConfronto !== null
                    ? "Seleziona il secondo momento per creare la coppia"
                    : "Clicca due momenti per definire una coppia di confronto"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Lucide icon="Zap" aria-hidden="true" className="h-3 w-3 shrink-0 text-amber-500" />
                  <FormInput
                    type="number"
                    formInputSize="sm"
                    min={0}
                    max={100}
                    step={1}
                    aria-label="Degrado terremoto del prossimo collegamento (%)"
                    value={newConfrontoTerremoto}
                    onChange={(e) => setNewConfrontoTerremoto(e.target.value)}
                    placeholder="Degrado terremoto del prossimo collegamento %"
                    className="flex-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
          <div className="mt-1 flex flex-col gap-1 border-t border-slate-200 pt-1">
            <p className="title-eyebrow">Confronti</p>
            {confronti.map((c, idx) => {
              const itemA = items.find((it) => it.ordine === c.a);
              const itemB = items.find((it) => it.ordine === c.b);
              return (
                <div key={idx} className="flex items-center gap-1.5 rounded-control border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs text-teal-800">
                  <Lucide icon="GitCompare" aria-hidden="true" className="h-3 w-3 shrink-0 text-teal-600" />
                  <span className="max-w-20 truncate font-medium">{itemA?.nome ?? `#${c.a}`}</span>
                  <span className="shrink-0 text-teal-500">↔</span>
                  <span className="max-w-20 truncate font-medium">{itemB?.nome ?? `#${c.b}`}</span>
                  {c.terremotoDegradoMassimo != null && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-3xs font-semibold text-amber-800">
                      <Lucide icon="Zap" aria-hidden="true" className="h-2.5 w-2.5" />
                      {c.terremotoDegradoMassimo}%
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeConfronto(idx)}
                    aria-label="Rimuovi confronto"
                    className="ml-auto rounded-control p-0.5 text-teal-600 transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Lucide icon="X" aria-hidden="true" className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Azioni */}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline-secondary" size="sm" onClick={onCancel}>
          Annulla
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSave(nome.trim(), tipo, items, confronti)}
          disabled={!nome.trim() || items.length === 0 || tipo.length === 0}
          loading={isSaving}
        >
          Salva schema
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
        <p className="text-sm text-slate-500">
          Gestisci i template di schema: definisci la struttura dei momenti e i confronti da eseguire
        </p>
        {!showCreating && (
          <Button variant="primary" size="sm" onClick={() => setShowCreating(true)}>
            <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Nuovo schema
          </Button>
        )}
      </div>

      {/* Lista schemi + form creazione */}
      {schemiQuery.isLoading ? (
        <div className="flex gap-3" aria-busy="true">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-72 flex-shrink-0 rounded-card" />
          ))}
        </div>
      ) : schemiQuery.isError ? (
        <PageError
          compatta
          titolo="Schemi non caricati"
          motivo={(schemiQuery.error as Error | null)?.message || "Impossibile caricare gli schemi."}
          onRiprova={() => schemiQuery.refetch()}
        />
      ) : schemi.length === 0 && !showCreating ? (
        <EmptyState
          compatta
          icon="LayoutTemplate"
          title="Nessuno schema disponibile"
          description="Crea il primo schema per velocizzare la configurazione dei momenti"
          className="rounded-card border border-dashed border-slate-200"
        />
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
