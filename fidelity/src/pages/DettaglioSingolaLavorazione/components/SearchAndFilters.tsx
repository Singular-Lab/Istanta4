import React from 'react';
import Lucide from "@/components/Base/Lucide";
import { FormInput } from "@/components/Base/Form";

interface SearchAndFiltersProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
}

const SearchAndFilters = ({ searchQuery, setSearchQuery }: SearchAndFiltersProps) => (
    <div className="mb-4">
        <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Lucide icon="Search" className="w-4 h-4 text-slate-400" />
            </div>
            <FormInput
                type="text"
                placeholder="Cerca file per nome o descrizione..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-10 border-slate-200"
            />
        </div>
    </div>
);

export default SearchAndFilters; 