import { FC, useCallback, useEffect, useId, useRef, useState } from "react";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import FormInput from "@/components/Base/Form/FormInput";
import FormSelect from "@/components/Base/Form/FormSelect";
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
  const idDal = useId();
  const idAl = useId();
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

  const hasActiveFilters =
    filters.eventType ||
    filters.severity ||
    filters.result ||
    filters.searchTerm ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <BarraFiltri
      destra={
        hasActiveFilters ? (
          <Button type="button" variant="outline-secondary" size="sm" onClick={onReset}>
            <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Azzera filtri
          </Button>
        ) : undefined
      }
    >
      <CampoRicerca
        etichetta="Cerca nei log"
        placeholder="Cerca nei log…"
        value={searchInput}
        onChange={handleSearchChange}
        className="sm:w-60"
      />

      <FormSelect
        formSelectSize="sm"
        aria-label="Tipo evento"
        value={filters.eventType ?? ""}
        onChange={(e) => onChange({ eventType: e.target.value || undefined, page: 1 })}
        className="sm:w-48"
      >
        <option value="">Tutti i tipi di evento</option>
        {eventTypes.map((et) => (
          <option key={et.value} value={et.value}>
            {et.label}
          </option>
        ))}
      </FormSelect>

      <FormSelect
        formSelectSize="sm"
        aria-label="Severità"
        value={filters.severity ?? ""}
        onChange={(e) => onChange({ severity: e.target.value || undefined, page: 1 })}
        className="sm:w-40"
      >
        <option value="">Tutte le severità</option>
        {severities.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </FormSelect>

      <FormSelect
        formSelectSize="sm"
        aria-label="Esito"
        value={filters.result ?? ""}
        onChange={(e) => onChange({ result: e.target.value || undefined, page: 1 })}
        className="sm:w-36"
      >
        <option value="">Tutti gli esiti</option>
        <option value="SUCCESS">Successo</option>
        <option value="FAILURE">Fallito</option>
        <option value="PARTIAL">Parziale</option>
      </FormSelect>

      <div className="flex items-center gap-2">
        <label htmlFor={idDal} className="text-sm text-slate-500">
          Dal
        </label>
        <FormInput
          id={idDal}
          type="date"
          formInputSize="sm"
          value={filters.dateFrom ?? ""}
          onChange={(e) => onChange({ dateFrom: e.target.value || undefined, page: 1 })}
          className="sm:w-auto"
        />
        <label htmlFor={idAl} className="text-sm text-slate-500">
          al
        </label>
        <FormInput
          id={idAl}
          type="date"
          formInputSize="sm"
          value={filters.dateTo ?? ""}
          onChange={(e) => onChange({ dateTo: e.target.value || undefined, page: 1 })}
          className="sm:w-auto"
        />
      </div>
    </BarraFiltri>
  );
};

export default AuditLogFilters;
