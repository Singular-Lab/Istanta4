import Button from "@/components/Base/Button";
import { FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import { useNotification } from "@/context/NotificationContext";
import {
  useDeleteRegoleMenabo,
  useFetchAreeCanaliECombinazioni,
  useFetchRegoleMenabo,
  useSaveRegoleMenabo,
} from "@/query/query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  RegolaMenaboDivisione,
  RegolaMenaboPagina,
  RegoleMenabo,
} from "../../../../lib/types";
import type {
  AreaResponseDTO,
  CanaleResponseDTO,
  CombinazioneCanaleAreaResponseDTO,
} from "../../../../server/core/dto";

const DEFAULT_PAGINA: RegolaMenaboPagina = { etichetta: "", referenzePerPagina: 10 };
const DEFAULT_TIP: RegoleMenabo["tipoDivisione"] = "canale";

// ── Tipi interni del form ────────────────────────────────────────────
interface FormDivisione extends RegolaMenaboDivisione {
  nomeDisplay: string;
}

// ── Helpers ──────────────────────────────────────────────────────────
function buildFormDivisioni(
  tipo: RegoleMenabo["tipoDivisione"],
  canali: CanaleResponseDTO[],
  aree: AreaResponseDTO[],
  combinazioni: CombinazioneCanaleAreaResponseDTO[],
  saved: RegolaMenaboDivisione[],
): FormDivisione[] {
  const savedMap = new Map(saved.map((d) => [d.id, d.pagine]));

  const make = (id: string, nome: string): FormDivisione => ({
    id,
    nomeDisplay: nome,
    pagine: savedMap.get(id) ?? [{ ...DEFAULT_PAGINA }],
  });

  // ID sempre lowercase per combaciare con la sectionKey prodotta da CoopFi
  if (tipo === "canale") return canali.map((c) => make(c.id.toLowerCase(), c.nome));
  if (tipo === "area") return aree.map((a) => make(a.id.toLowerCase(), a.nome));

  // area_e_canale: l'ID è "guidCanale:guidArea" (lowercase), non l'ID della combinazione
  const canaleMap = new Map(canali.map((c) => [c.id, c.nome]));
  const areaMap = new Map(aree.map((a) => [a.id, a.nome]));
  return combinazioni
    .filter((cb) => cb.stato === "ATTIVO")
    .map((cb) => {
      const nc = canaleMap.get(cb.id_canale) ?? cb.id_canale;
      const na = areaMap.get(cb.id_area) ?? cb.id_area;
      const id = `${cb.id_canale.toLowerCase()}:${cb.id_area.toLowerCase()}`;
      return make(id, `${nc} / ${na}`);
    });
}

// ── Componente riga pagina ────────────────────────────────────────────
function PaginaRow({
  pagina,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  pagina: RegolaMenaboPagina;
  index: number;
  canRemove: boolean;
  onChange: (p: RegolaMenaboPagina) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-200">
      <span className="text-xs font-medium text-slate-400 w-5 shrink-0 text-center">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <FormInput
          placeholder="Etichetta (opzionale)"
          value={pagina.etichetta ?? ""}
          onChange={(e) => onChange({ ...pagina, etichetta: e.target.value })}
        />
      </div>
      <div className="w-32 shrink-0">
        <FormInput
          type="number"
          min={1}
          max={50}
          placeholder="Referenze"
          value={pagina.referenzePerPagina}
          onChange={(e) =>
            onChange({ ...pagina, referenzePerPagina: Math.max(1, Number(e.target.value)) })
          }
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline-danger"
        onClick={onRemove}
        disabled={!canRemove}
      >
        <Lucide icon="Trash2" className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ── Componente card divisione ─────────────────────────────────────────
function DivisioneCard({
  div: d,
  expanded,
  onToggle,
  onChange,
}: {
  div: FormDivisione;
  expanded: boolean;
  onToggle: () => void;
  onChange: (updated: FormDivisione) => void;
}) {
  const updatePagina = (i: number, p: RegolaMenaboPagina) => {
    const pagine = d.pagine.map((pg, idx) => (idx === i ? p : pg));
    onChange({ ...d, pagine });
  };

  const removePagina = (i: number) => {
    const pagine = d.pagine.filter((_, idx) => idx !== i);
    onChange({ ...d, pagine });
  };

  const addPagina = () => {
    onChange({ ...d, pagine: [...d.pagine, { ...DEFAULT_PAGINA }] });
  };

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Lucide icon="LayoutList" className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">{d.nomeDisplay}</span>
          <span className="text-xs text-slate-400 ml-1">
            {d.pagine.length} {d.pagine.length === 1 ? "pagina" : "pagine"}
          </span>
        </div>
        <Lucide
          icon={expanded ? "ChevronUp" : "ChevronDown"}
          className="w-4 h-4 text-slate-400 shrink-0"
        />
      </button>

      {/* Body */}
      {expanded && (
        <div className="p-4 space-y-2 bg-slate-50/30">
          {/* Header colonne */}
          <div className="flex items-center gap-3 px-2.5 mb-1">
            <span className="w-5" />
            <span className="flex-1 text-xs text-slate-400 font-medium">Etichetta pagina</span>
            <span className="w-32 text-xs text-slate-400 font-medium">Referenze max</span>
            <span className="w-8" />
          </div>

          {d.pagine.map((pg, i) => (
            <PaginaRow
              key={i}
              pagina={pg}
              index={i}
              canRemove={d.pagine.length > 1}
              onChange={(updated) => updatePagina(i, updated)}
              onRemove={() => removePagina(i)}
            />
          ))}

          <Button
            type="button"
            size="sm"
            variant="outline-primary"
            className="mt-1"
            onClick={addPagina}
          >
            <Lucide icon="Plus" className="w-3.5 h-3.5 mr-1" />
            Aggiungi pagina
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Componente principale ─────────────────────────────────────────────
export default function PanelMenabo() {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const { data: regole, isLoading: isLoadingRegole } = useFetchRegoleMenabo();
  const { data: entita, isLoading: isLoadingEntita } = useFetchAreeCanaliECombinazioni();
  const { mutate: salva, isPending: isSaving } = useSaveRegoleMenabo();
  const { mutate: elimina, isPending: isDeleting } = useDeleteRegoleMenabo();

  const [tipoDivisione, setTipoDivisione] = useState<RegoleMenabo["tipoDivisione"]>(DEFAULT_TIP);
  const [divisioni, setDivisioni] = useState<FormDivisione[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const hasHydratedFromServerRef = useRef(false);

  const canali = useMemo(() => entita?.canali ?? [], [entita]);
  const aree = useMemo(() => entita?.aree ?? [], [entita]);
  const combinazioni = useMemo(() => entita?.combinazioni ?? [], [entita]);

  // Inizializza il form quando i dati arrivano dal server
  useEffect(() => {
    if (!entita) return;
    if (isDirty && hasHydratedFromServerRef.current) return;
    const tip = regole?.tipoDivisione ?? DEFAULT_TIP;
    setTipoDivisione(tip);
    setDivisioni(buildFormDivisioni(tip, canali, aree, combinazioni, regole?.divisioni ?? []));
    setIsDirty(false);
    hasHydratedFromServerRef.current = true;
  }, [regole, entita, canali, aree, combinazioni, isDirty]);

  // Ricalcola le divisioni quando cambia il tipo (riutilizza i dati già inseriti per gli id in comune)
  const handleChangeTipo = (nuovoTipo: RegoleMenabo["tipoDivisione"]) => {
    const currentSaved: RegolaMenaboDivisione[] = divisioni.map(({ id, pagine }) => ({ id, pagine }));
    setTipoDivisione(nuovoTipo);
    setDivisioni(buildFormDivisioni(nuovoTipo, canali, aree, combinazioni, currentSaved));
    setIsDirty(true);
  };

  const handleChangeDivisione = (updated: FormDivisione) => {
    setDivisioni((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setIsDirty(true);
  };

  const handleSave = () => {
    const payload: RegoleMenabo = {
      tipoDivisione,
      divisioni: divisioni.map(({ id, pagine }) => ({ id, pagine })),
    };
    salva(payload, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["regole-menabo"] });
        showNotification("Regole menabò salvate", { variant: "success" });
        setIsDirty(false);
      },
      onError: () => showNotification("Errore durante il salvataggio", { variant: "error" }),
    });
  };

  const handleReset = () => {
    elimina(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["regole-menabo"] });
        showNotification("Regole menabò ripristinate", { variant: "success" });
        setTipoDivisione(DEFAULT_TIP);
        setDivisioni(buildFormDivisioni(DEFAULT_TIP, canali, aree, combinazioni, []));
        setIsDirty(false);
      },
      onError: () => showNotification("Errore durante il ripristino", { variant: "error" }),
    });
  };

  const isLoading = isLoadingRegole || isLoadingEntita;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <Lucide icon="Loader" className="w-5 h-5 animate-spin mr-2" />
        Caricamento…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tipo di divisione */}
      <div className="max-w-xs">
        <FormLabel htmlFor="tipoDivisione">Tipo di divisione</FormLabel>
        <FormSelect
          id="tipoDivisione"
          value={tipoDivisione}
          onChange={(e) => handleChangeTipo(e.target.value as RegoleMenabo["tipoDivisione"])}
        >
          <option value="canale">Per Canale</option>
          <option value="area">Per Area</option>
          <option value="area_e_canale">Per Area e Canale</option>
        </FormSelect>
        <p className="text-xs text-slate-400 mt-1.5">
          Determina come i gruppi vengono suddivisi nel canvas del menabò.
        </p>
      </div>

      {/* Scheletro per ogni divisione */}
      <div>
        <FormLabel>Scheletro pagine</FormLabel>
        {divisioni.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-4">
            Nessuna entità disponibile per il tipo di divisione selezionato.
          </p>
        ) : (
          <div className="space-y-2">
            {divisioni.map((d) => (
              <DivisioneCard
                key={d.id}
                div={d}
                expanded={expandedId === d.id}
                onToggle={() => setExpandedId((prev) => (prev === d.id ? null : d.id))}
                onChange={handleChangeDivisione}
              />
            ))}
          </div>
        )}
      </div>

      {/* Azioni */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
        <Button
          type="button"
          variant="outline-secondary"
          size="sm"
          onClick={handleReset}
          disabled={isDeleting || isSaving}
        >
          <Lucide icon="RotateCcw" className="w-4 h-4 mr-1" />
          Ripristina default
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? (
            <>
              <Lucide icon="Loader" className="w-4 h-4 mr-1 animate-spin" />
              Salvataggio…
            </>
          ) : (
            <>
              <Lucide icon="Save" className="w-4 h-4 mr-1" />
              Salva
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
