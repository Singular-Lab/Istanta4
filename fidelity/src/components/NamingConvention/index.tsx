import clsx from 'clsx';
import update from 'immutability-helper';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { DndProvider, DragSourceMonitor, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Button from '../Base/Button';
import { FormInput, InputGroup } from '../Base/Form';
import LoadingIcon from '../Base/LoadingIcon';
import Lucide from '../Base/Lucide';

interface Option {
  id: string;
  nomeVisual: string;
  nome: string;
  descrizione: string;
}

export interface NamingConventionProps {
  onChange: (result: Option[]) => void;
  data: Option[];
  compact?: boolean;

}
export interface NamingConventionRef {
  getSelectedOptions: () => Option[];
  getSeparator: () => string;
  setSeparator: (sep: string) => void;
  setCustomWord: (word: string) => void;
  emptySelectedOption: () => void;
  setAvailableOptionsFull: () => void;
  setSelectedOptions: (options: Option[]) => void;
}


const NamingConvention = forwardRef<NamingConventionRef | undefined, NamingConventionProps>(({ onChange, data = [], compact = true }: NamingConventionProps, ref) => {


  const [selectedOptions, setSelectedOptions] = useState<Option[]>([]);
  const [availableOptions, setAvailableOptions] = useState<Option[]>(data);
  const [separator, setSeparator] = useState<string>(' ');
  const [customWord, setCustomWord] = useState<string>('');

  const memoizedOnChange = useCallback(onChange, []);

  useImperativeHandle(ref, () => ({
    getSelectedOptions: () => selectedOptions,
    getSeparator: () => separator,
    setSeparator: (sep: string) => setSeparator(sep),
    setCustomWord: (word: string) => setCustomWord(word),
    emptySelectedOption: () => setSelectedOptions([]),
    setAvailableOptionsFull: () => setAvailableOptions(data),
    setSelectedOptions: (options: Option[]) => setSelectedOptions(options)
  }));


  useEffect(() => {
    setAvailableOptions(data.filter((option) => !selectedOptions.includes(option)));
  }, [data, selectedOptions]);

  useEffect(() => {
    memoizedOnChange(selectedOptions);
  }, [selectedOptions, memoizedOnChange]);

  const handleAddOption = (option: Option) => {
    setSelectedOptions((prev) => [...prev, option]);
    setAvailableOptions((prev) => prev.filter((opt) => opt.id !== option.id));
  };

  const handleAddCustomWord = (e: React.MouseEvent) => {
    e.preventDefault();
    if (customWord.trim() !== '') {
      setSelectedOptions((prev) => [
        ...prev,
        { id: "0", nome: customWord, descrizione: 'Custom word', nomeVisual: customWord },
      ]);
      setCustomWord('');
    }
  };

  const handleRemoveOption = (index: number) => {
    const removedOption = selectedOptions[index];
    setSelectedOptions((prev) => prev.filter((_, i) => i !== index));
    if (removedOption.id !== "0") {
      setAvailableOptions((prev) => [...prev, removedOption]);
    }
  };

  const moveOption = (dragIndex: number, hoverIndex: number) => {
    const draggedOption = selectedOptions[dragIndex];
    setSelectedOptions(
      update(selectedOptions, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, draggedOption],
        ],
      })
    );
  };

  const SelectedOption = ({ option, index }: { option: Option; index: number }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const [, drop] = useDrop({
      accept: 'option',
      hover(item: { index: number }, monitor: any) {
        if (!ref.current) return;
        const dragIndex = item.index;
        const hoverIndex = index;
        if (dragIndex === hoverIndex) return;
        moveOption(dragIndex, hoverIndex);
        item.index = hoverIndex;
      },
    });
    const [{ isDragging }, drag] = useDrag({
      type: 'option',
      item: { index },
      collect: (monitor: DragSourceMonitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    drag(drop(ref));

    return (
      <div
        ref={ref}
        className={clsx(
          'flex items-center px-2 py-1 bg-blue-50 border border-blue-200 rounded cursor-move text-sm',
          { 'opacity-50': isDragging }
        )}
      >
        <Lucide icon="Move" className="w-3 h-3 mr-1 text-blue-500" />
        <span className="flex-1 text-gray-800">{option.nome}</span>
        <Button
          size="sm"
          variant="danger"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            handleRemoveOption(index);
          }}
          className="ml-1"
        >
          <Lucide icon="Trash2" className="w-3 h-3" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Anteprima Nome File */}
      <div className="px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-800">Anteprima Nome File</h2>
        <div className="mt-2">
          <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm text-gray-700">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((option, index) => (
                <span key={index}>
                  {option.nome}
                  {index < selectedOptions.length - 1 && <span className="text-red-500">{separator}</span>}
                </span>
              ))
            ) : (
              <span className="text-gray-400">Nessuna opzione selezionata</span>
            )}
          </div>
        </div>
      </div>

      {/* Opzioni Disponibili e Selezionate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Opzioni Disponibili */}
        <div className="px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-800">Campi Disponibili</h2>
          <p className="text-gray-600 text-sm mt-1">Seleziona i campi da includere nel nome del file.</p>
          <div className="mt-2 space-y-1">
            {availableOptions == undefined && (
              <LoadingIcon icon="circles" className="w-6 h-6 text-gray-500 mx-auto" />
            )}
            {availableOptions.length > 0 ? (
              availableOptions.map((option, index) => (
                <div
                  key={index}
                  className="flex items-center px-2 py-1 bg-gray-50 border border-gray-200 rounded text-sm"
                >
                  <Lucide icon="CirclePlus" className="w-4 h-4 text-green-500 mr-1" />
                  <span className="flex-1 text-gray-800">{option.nomeVisual}</span>
                  {/* <Tippy content={option.descrizione}>
                    <Lucide icon="Info" className="w-3 h-3 text-gray-500 mr-1" />
                  </Tippy> */}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      handleAddOption(option);
                    }}
                    className="ml-1"
                  >
                    Aggiungi
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">Tutte le opzioni sono state selezionate.</p>
            )}
          </div>

          {/* Aggiungi Parola Personalizzata */}
          <div className="mt-2">
            <label className="block text-gray-700 text-sm font-medium mb-1">Aggiungi parola personalizzata</label>
            <InputGroup>
              <FormInput
                type="text"
                value={customWord}
                onChange={(e) => setCustomWord(e.target.value)}
                placeholder="Inserisci una parola"
                className="text-sm"
              />
              <Button size="sm" variant="primary" onClick={handleAddCustomWord}>
                Aggiungi
              </Button>
            </InputGroup>
          </div>
        </div>

        {/* Opzioni Selezionate */}
        <DndProvider backend={HTML5Backend}>
          <div className="px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-800">Campi Selezionati</h2>
            <p className="text-gray-600 text-sm mt-1">Trascina per riordinare i campi.</p>
            <div className="mt-2 space-y-1">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((option, index) => (
                  <SelectedOption key={index} option={option} index={index} />
                ))
              ) : (
                <p className="text-gray-500 text-sm">Nessun campo selezionato.</p>
              )}
            </div>
          </div>
        </DndProvider>
      </div>

      {/* Impostazioni Separatore */}
      <div className="px-4 py-3">

        <h2 className="text-lg font-semibold text-gray-800">Impostazioni</h2>
        <div className="mt-2">
          <label className="block text-gray-700 text-sm font-medium mb-1">Separatore</label>
          <FormInput
            disabled
            type="text"
            value={separator}
            onChange={(e) => setSeparator(e.target.value)}
            placeholder="Inserisci un separatore (es. _ - /)"
            className="text-sm w-full"
          />
          <div className='flex items-center bg-yellow-100 border border-yellow-300 rounded px-4 py-2 my-4 text-yellow-800'>
            <Lucide icon="TriangleAlert" className="w-4 h-4 mr-2" />
            <span>Non ancora implementato</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default NamingConvention;
