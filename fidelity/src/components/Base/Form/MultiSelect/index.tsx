import React, { useEffect, useState } from 'react';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import clsx from 'clsx';
import Lucide from '../../Lucide';

export interface Option {
  id: number | string;
  name: string;
}

interface MultiSelectProps {
  label?: string;
  options: Option[];
  value?: Option[] | Option | null;
  formSelectSize?: 'sm' | 'md' | 'lg';
  onChangefunc?: (selected: Option[] | Option | null) => void;
  multiple?: boolean;
}

const sizeClasses = {
  sm: 'text-xs py-1 pl-1 pr-8',
  md: 'py-2 text-sm',
  lg: 'text-lg py-1.5 pl-4 pr-8',
};

export default function MultiSelect({
  label,
  options,
  formSelectSize = 'md',
  onChangefunc,
  value,
  multiple = false,
}: MultiSelectProps) {
  // Stato per i valori selezionati
  const [selected, setSelected] = useState<Option[] | Option | null>(
    multiple ? [] : null
  );
  const [filteredOptions, setFilteredOptions] = useState<Option[]>(options);
  // Stato per il testo che l’utente digita (ricerca)
  const [query, setQuery] = useState('');

  // --- Effetto per sincronizzare il valore iniziale o esterno (prop `value`)
  useEffect(() => {
    if (multiple) {
      const newValue = Array.isArray(value) ? value : [];
      setSelected(newValue);
    } else {
      const newValue = Array.isArray(value) ? value[0] || null : value || null;
      setSelected(newValue);
    }
  }, [value, multiple]);

  // --- Funzione che filtra le opzioni in base alla query
  useEffect(() => {
    const filtered = query === ''
      ? options
      : options.filter((option) =>
          option?.name?.toLowerCase().includes(query.toLowerCase())
        );
    setFilteredOptions(filtered);
  }, [query, options]);

  // --- displayValue: come mostrare i valori selezionati nel ComboboxInput
  const displayValue = (val: Option[] | Option | null) => {
    if (!val) return '';
    if (Array.isArray(val)) {
      // Multi-select: unisci i nomi con virgola o trattino, a tuo piacimento
      return val.map((o) => o.name).join(', ');
    }
    // Single-select
    return val.name;
  };

  return (
    <div className="mx-auto w-full">
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <Combobox
        value={selected}
        multiple={multiple}
        // Questa funzione si attiva ogni volta che l’utente seleziona/deseleziona
        onChange={(newValue: Option | Option[] | { id: string | number; name: string }[] | null[] | null) => {
          const normalized = (newValue ?? (multiple ? [] : null)) as Option[] | Option | null;
          setSelected(normalized);
          onChangefunc?.(normalized);
          // Se vuoi azzerare la ricerca subito dopo la selezione, decommenta:
          setQuery('');
        }}
        // Quando si chiude il menù a tendina, resettiamo comunque la query,
        // così l’input torna a mostrare i valori selezionati
        onClose={() => setQuery('')}
      >
        <div className="relative">
          <ComboboxInput
            // Headless UI userà questa callback per mostrare i valori selezionati
            displayValue={displayValue}
            // Se l’utente digita, aggiorniamo solo `query`.
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Seleziona..."
            className={clsx(
              'w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm',
              'shadow-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 data-[focus]:outline-2 data-[focus]:-outline-offset-2',
              sizeClasses[formSelectSize]
            )}
          />

          <ComboboxButton className="group absolute inset-y-0 right-0 flex items-center pr-2.5">
            <Lucide
              icon="ChevronDown"
              className="h-4 w-4 text-slate-500 group-hover:text-slate-700"
            />
          </ComboboxButton>
        </div>

        <ComboboxOptions
          // `anchor="bottom"` a volte dà problemi con scroll/portali: puoi anche rimuoverlo
          anchor="bottom"
          className={clsx(
            // Se preferisci, rimuovi pure la variabile CSS e imposta una larghezza fissa o "min-w"
            'w-[var(--input-width)] absolute z-10 mt-1 max-h-60 overflow-auto rounded-md',
            'bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none'
          )}
        >
          {filteredOptions?.length === 0 ? (
            <div className="relative cursor-default select-none py-2 px-3 text-sm text-gray-500">
              Nessun risultato trovato
            </div>
          ) : (
            filteredOptions?.map((option) => (
              <ComboboxOption
                key={option.id}
                value={option}
                className={({ selected, active }) =>
                  clsx(
                    'relative flex cursor-pointer select-none items-center gap-2 py-2 pl-3 pr-9 text-sm',
                    active && !selected && 'bg-primary/10 text-primary',
                    selected && 'bg-primary text-white'
                  )
                }
              >
                {({ selected: isSelected, active }) => (
                  <>
                    <span
                      className={clsx(
                        'block truncate',
                        isSelected && 'font-medium'
                      )}
                    >
                      {option.name}
                    </span>
                    {isSelected && (
                      <span
                        className={clsx(
                          'absolute inset-y-0 right-0 flex items-center pr-3',
                          // per highlight su hover/focus
                          active ? 'text-white' : 'text-primary'
                        )}
                      >
                        <Lucide icon="Check" className="h-4 w-4" />
                      </span>
                    )}
                  </>
                )}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </Combobox>
    </div>
  );
}

