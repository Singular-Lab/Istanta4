import React, { useState, useEffect, Fragment } from "react";
import {
    FormCheck,
    FormInline,
    FormInput,
    FormLabel,
    FormSelect,
} from "@/components/Base/Form";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { useFetchFieldOptions } from "@/query/query";
import { FilterCondition, FilterConditionContesto, operatorOptions, PageLayoutItem } from "../../../../lib/types";

interface GrigliaReferenzeProps {
    id: string;
    updateElementContent: (id: string, content: any) => void;
    locked: boolean;
    item: PageLayoutItem
}

const GrigliaReferenze: React.FC<GrigliaReferenzeProps> = ({
    id,
    updateElementContent,
    locked,
    item
}) => {

    const [localContent, setLocalContent] = useState<any>(item.content);

    const fieldOptionsData = useFetchFieldOptions();
    const memoizedFieldOptionsData = React.useMemo(() => fieldOptionsData, [fieldOptionsData]);


    const stableUpdateElementContent = React.useCallback(updateElementContent, []);

    useEffect(() => {
        // Update parent component when localContent changes
        stableUpdateElementContent(id, localContent);
    }, [localContent, id, stableUpdateElementContent]);

    const handleChange = (key: string, value: any) => {
        setLocalContent((prevContent: any) => ({
            ...prevContent,
            [key]: value,
        }));
    };

    const addFilter = () => {
        const newFilters = [
            ...(localContent.filters || []),
            { field: "", operator: "", value: "" },
        ];
        handleChange("filters", newFilters);
    };

    const addFiltroContesto = () => {
        const newFilters = [
            ...(localContent.filtriContesto || []),
            { nome_field: "", operator: "", user_value: "" },
        ];
        handleChange("filtriContesto", newFilters);
    };

    const removeFilter = (index: number) => {
        const newFilters = (localContent.filters || []).filter(
            (_: any, i: number) => i !== index
        );
        handleChange("filters", newFilters);
    };

    const removeFiltroContesto = (index: number) => {
        const newFilters = (localContent.filtriContesto || []).filter(
            (_: any, i: number) => i !== index
        );
        handleChange("filtriContesto", newFilters);
    };

    const updateFilter = (index: number, key: string, value: string) => {
        const filters = localContent.filters || [];
        const updatedFilters = filters.map((filter: any, i: number) =>
            i === index ? { ...filter, [key]: value } : filter
        );
        handleChange("filters", updatedFilters);
    };

    const updateFiltriContesto = (index: number, key: string, value: string) => {
        const filtriContesto = localContent.filtriContesto || [];
        const updatedFiltriContesto = filtriContesto.map((filter: any, i: number) =>
            i === index ? { ...filter, [key]: value } : filter
        );
        handleChange("filtriContesto", updatedFiltriContesto);
    };
    if (!item.type || item.type !== "griglia_referenze") {
        return null;
    }
    return (
        <div className="">
            <div className="mb-6">
                <div className="flex flex-col justify-between font-semibold">
                    <FormLabel formLabelSize="sm" htmlFor="filters" className="mb-3">Filtri</FormLabel>
                    {(localContent.filters || []).map((filter: FilterCondition, index: number) => (
                        <div key={index} className="flex items-center space-x-2 mb-2">
                            <FormSelect
                                formSelectSize="sm"
                                value={filter.field}
                                onChange={(e) => updateFilter(index, "field", e.target.value)}
                                className="w-1/3"
                                disabled={locked}
                            >
                                <option value="">Seleziona Campo</option>
                                {memoizedFieldOptionsData?.data?.map((option, i) => (
                                    <option key={i} value={option.expected_input}>
                                        {option.expected_output != "" ? option.expected_output : option.expected_input}
                                    </option>
                                ))}
                            </FormSelect>
                            <FormSelect
                                formSelectSize="sm"
                                value={filter.operator}
                                onChange={(e) => updateFilter(index, "operator", e.target.value)}
                                className="w-1/4"
                                disabled={locked}
                            >
                                <option value="">Operatore</option>
                                {operatorOptions.map((option, i) => (
                                    <option key={i} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </FormSelect>
                            <FormInput
                                formInputSize="sm"
                                type="text"
                                value={filter.value}
                                onChange={(e) => updateFilter(index, "value", e.target.value)}
                                placeholder="Valore"
                                className="w-1/3"
                                disabled={locked}
                            />
                            <Button
                                onClick={() => removeFilter(index)}
                                className=""
                                variant="danger"
                                size="xs"
                                disabled={locked}
                            >
                                <Lucide icon="Trash2" className="w-5 h-5" />
                            </Button>
                        </div>
                    ))}
                    <Button
                        variant="primary"
                        size="xs"
                        onClick={addFilter}
                        disabled={locked}
                    >
                        Aggiungi Filtro
                    </Button>
                </div>
            </div>
            <div className=" cursor-pointer font-semibold flex flex-col">
                <FormLabel formLabelSize="sm" htmlFor="filters">Filtri Nuovi</FormLabel>
                {(localContent.filtersNew && localContent.filtersNew.length > 0) && (
                    <div className="space-y-6">
                        {localContent.filtersNew.map((filterGroup : any, groupIndex : number) => (
                            <Fragment key={groupIndex}>
                                <div className="p-4 border rounded-md shadow-sm">
                                    <h4 className="font-bold mb-4">Gruppo Filtri {groupIndex + 1}</h4>
                                    <div className="space-y-3">
                                        {filterGroup?.map((filter:any, filterIndex:number) => (
                                            <div key={filterIndex} className="flex flex-col items-center space-x-2">
                                                <FormInline className="gap-2">

                                                    <FormSelect
                                                        formSelectSize="sm"
                                                        value={filter.field}
                                                        onChange={(e) => {
                                                            const updatedFiltersNew = [...(localContent.filtersNew || [])];
                                                            updatedFiltersNew[groupIndex][filterIndex] = {
                                                                ...filter,
                                                                field: e.target.value,
                                                            };
                                                            handleChange("filtersNew", updatedFiltersNew);
                                                        }}
                                                        className="w-1/3"
                                                    >
                                                        <option value="">Seleziona Campo</option>
                                                        {memoizedFieldOptionsData?.data?.map((option, i) => (
                                                            <option key={i} value={option.expected_input}>
                                                                {option.expected_output != "" ? option.expected_output : option.expected_input}
                                                            </option>
                                                        ))}
                                                    </FormSelect>
                                                    <FormSelect
                                                        formSelectSize="sm"
                                                        value={filter.operator}
                                                        onChange={(e) => {
                                                            const updatedFiltersNew = [...(localContent.filtersNew || [])];
                                                            updatedFiltersNew[groupIndex][filterIndex] = {
                                                                ...filter,
                                                                operator: e.target.value,
                                                            };
                                                            handleChange("filtersNew", updatedFiltersNew);
                                                        }}
                                                        className="w-1/4"
                                                    >
                                                        <option value="">Operatore</option>
                                                        {operatorOptions.map((option, i) => (
                                                            <option key={i} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </FormSelect>
                                                    <FormInput
                                                        formInputSize="sm"
                                                        type="text"
                                                        value={filter.value}
                                                        onChange={(e) => {
                                                            const updatedFiltersNew = [...(localContent.filtersNew || [])];
                                                            updatedFiltersNew[groupIndex][filterIndex] = {
                                                                ...filter,
                                                                value: e.target.value,
                                                            };
                                                            handleChange("filtersNew", updatedFiltersNew);
                                                        }}
                                                        placeholder="Valore"
                                                        className="w-1/3"
                                                    />
                                                    <Button
                                                        onClick={() => {
                                                            const updatedFiltersNew = [...(localContent.filtersNew || [])];
                                                            updatedFiltersNew[groupIndex] = updatedFiltersNew[groupIndex].filter(
                                                                (_: any, i: number) => i !== filterIndex
                                                            );
                                                            handleChange("filtersNew", updatedFiltersNew);
                                                        }}
                                                        variant="danger"
                                                        size="xs"
                                                    >
                                                        <Lucide icon="Trash2" className="w-5 h-5" />
                                                    </Button>
                                                </FormInline>
                                                {filterIndex < filterGroup.length - 1 && (
                                                    <span className="font-bold text-gray-500 mt-2">AND</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex space-x-2">
                                        <Button
                                            onClick={() => {
                                                const updatedFiltersNew = [...(localContent.filtersNew ?? [])];
                                                updatedFiltersNew[groupIndex].push({
                                                    field: "",
                                                    operator: "",
                                                    value: "",
                                                });
                                                handleChange("filtersNew", updatedFiltersNew);
                                            }}
                                            variant="primary"
                                            size="xs"
                                        >
                                            Aggiungi Filtro al Gruppo
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                const updatedFiltersNew = (localContent.filtersNew ?? []).filter(
                                                    (_: any, i: number) => i !== groupIndex
                                                );
                                                handleChange("filtersNew", updatedFiltersNew);
                                            }}
                                            variant="danger"
                                            size="xs"
                                        >
                                            Rimuovi Gruppo
                                        </Button>
                                    </div>
                                </div>
                                {groupIndex < (localContent.filtersNew ?? []).length - 1 && (
                                    <div className="text-center font-bold text-gray-500 mt-4">OR</div>
                                )}
                            </Fragment>
                        ))}
                    </div>
                )}
                <Button
                    className="mt-4"
                    onClick={() => {
                        const updatedFiltersNew = [
                            ...(localContent.filtersNew || []),
                            [{ field: "", operator: "", value: "" }],
                        ];
                        handleChange("filtersNew", updatedFiltersNew);
                    }}
                    variant="primary"
                    size="xs"
                >
                    Aggiungi Gruppo Filtri
                </Button>
            </div>
            <hr className="my-4 border-primary opacity-30" />

            {/* Context Filters Section */}
            <div className="mb-6">
                <div className="flex flex-col justify-between font-semibold">
                    <FormLabel 
                        className={localContent.filtroContesto ? "" : "mr-2"} 
                        formLabelSize="sm" 
                        htmlFor="filtriContesto"
                        >
                        Filtri contesto
                    </FormLabel>
                    {(localContent.filtriContesto || []).map((filter: FilterConditionContesto, index: number) => (
                        <div key={index} className="flex items-center space-x-2 mb-2">
                            <FormInput
                                formInputSize="sm"
                                value={filter.nome_field}
                                onChange={(e) => updateFiltriContesto(index, "nome_field", e.target.value)}
                                className="w-1/3"
                                placeholder="Nome campo"
                                disabled={locked}
                            />
                            <FormSelect
                                formSelectSize="sm"
                                value={filter.operator}
                                onChange={(e) => updateFiltriContesto(index, "operator", e.target.value)}
                                className="w-1/4"
                                disabled={locked}
                            >
                                <option value="">Operatore</option>
                                {operatorOptions.map((option, i) => (
                                    <option key={i} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </FormSelect>
                            <FormInput
                                formInputSize="sm"
                                type="text"
                                value={filter.user_value}
                                onChange={(e) => updateFiltriContesto(index, "user_value", e.target.value)}
                                placeholder="Valore"
                                className="w-1/3"
                                disabled={locked}
                            />
                            <Button
                                onClick={() => removeFiltroContesto(index)}
                                className=""
                                variant="danger"
                                size="xs"
                                disabled={locked}
                            >
                                <Lucide icon="Trash2" className="w-5 h-5" />
                            </Button>
                        </div>
                    ))}
                    <Button 
                        className={localContent.filtroContesto ? "ml-2" : ""} 
                        variant="primary" 
                        size="xs" 
                        onClick={addFiltroContesto}
                        disabled={locked}
                    >
                        Aggiungi Filtro di contesto
                    </Button>
                </div>
            </div>

            {/* Add other GrigliaReferenze specific content here */}
        </div>
    );
};

export default GrigliaReferenze;