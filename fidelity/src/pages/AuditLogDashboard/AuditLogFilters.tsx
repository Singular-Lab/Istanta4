import { FC, useCallback, useEffect, useRef, useState } from "react";
import Lucide from "@/components/Base/Lucide";
import type { AuditLogFilters as FiltersType } from "@/query/query";

interface AuditLogFiltersProps {
  filters: FiltersType;
  onChange: (filters: Partial<FiltersType>) => void;
  onReset: () => void;
  eventTypes: { value: string; label: string }[];
  severities: { value: string; label: string }[];
}

const AuditLogFilters: FC<AuditLogFiltersProps> = ({
  filters,
  onChange,
  onReset,
  eventTypes,
  severities,
}) => {
  const [searchInput, setSearchInput] = useState(filters.searchTerm ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange({ searchTerm: value || undefined, page: 1 });
      }, 400);
    },
    [onChange]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const selectClass =
    "h-9 px-3 pr-8 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-theme-1/30 focus:border-theme-1 appearance-none cursor-pointer";
  const inputClass =
    "h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-theme-1/30 focus:border-theme-1";

  const hasActiveFilters =
    filters.eventType ||
    filters.severity ||
    filters.result ||
    filters.searchTerm ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Ricerca */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Ricerca
        </label>
        <div className="relative">
          <Lucide
            icon="Search"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          />
          <input
            type="text"
            placeholder="Cerca nei log..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={`${inputClass} pl-9 w-52`}
          />
        </div>
      </div>

      {/* Tipo evento */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Tipo evento
        </label>
        <select
          value={filters.eventType ?? ""}
          onChange={(e) =>
            onChange({ eventType: e.target.value || undefined, page: 1 })
          }
          className={selectClass}
        >
          <option value="">Tutti</option>
          {eventTypes.map((et) => (
            <option key={et.value} value={et.value}>
              {et.label}
            </option>
          ))}
        </select>
      </div>

      {/* Severita */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Severita
        </label>
        <select
          value={filters.severity ?? ""}
          onChange={(e) =>
            onChange({ severity: e.target.value || undefined, page: 1 })
          }
          className={selectClass}
        >
          <option value="">Tutte</option>
          {severities.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Risultato */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Risultato
        </label>
        <select
          value={filters.result ?? ""}
          onChange={(e) =>
            onChange({ result: e.target.value || undefined, page: 1 })
          }
          className={selectClass}
        >
          <option value="">Tutti</option>
          <option value="SUCCESS">Successo</option>
          <option value="FAILURE">Fallito</option>
          <option value="PARTIAL">Parziale</option>
        </select>
      </div>

      {/* Date range */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Da
        </label>
        <input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(e) =>
            onChange({ dateFrom: e.target.value || undefined, page: 1 })
          }
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          A
        </label>
        <input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(e) =>
            onChange({ dateTo: e.target.value || undefined, page: 1 })
          }
          className={inputClass}
        />
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
        >
          <Lucide icon="X" className="w-3.5 h-3.5" />
          Reset
        </button>
      )}
    </div>
  );
};

export default AuditLogFilters;
