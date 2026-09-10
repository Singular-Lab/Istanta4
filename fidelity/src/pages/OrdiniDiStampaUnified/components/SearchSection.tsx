import { FormInput } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import React from "react";

interface SearchSectionProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const SearchSection: React.FC<SearchSectionProps> = ({ searchQuery, setSearchQuery }) => {
  return (
    <div className="flex flex-col box box--stacked">
      <div className="flex flex-col p-5 sm:items-center sm:flex-row gap-y-2">
        <div>
          <div className="relative">
            <Lucide
              icon="Search"
              className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
            />
            <FormInput
              type="text"
              placeholder="Cerca per nome promo o ID ordine..."
              className="pl-9 sm:w-64 rounded-[0.5rem]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchSection;
