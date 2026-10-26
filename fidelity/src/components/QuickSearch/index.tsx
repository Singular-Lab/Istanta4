import { Popover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { FormInput } from "@/components/Base/Form";
import {
  DialogPanel,
  Dialog as HeadlessDialog,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  Fragment,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ServerCall } from "../../../lib/server_call";

interface MainProps {
  quickSearch: boolean;
  setQuickSearch: (val: boolean) => void;
}

interface SearchItem {
  id: string; // optional placeholder, not usato per l'indicizzazione
  title: string;
  path: string;
  icon: string;
  category: string;
  description?: string;
  icon_color?: string;
}

interface SuggestionItem {
  term: string;
  icon: string;
}

// -------- utility ---------------------------------------------------------
const getIconColorClass = (iconColor?: string): string => {
  if (!iconColor) return "text-slate-500";
  const colorMap: Record<string, string> = {
    green: "text-green-500",
    blue: "text-blue-500",
    red: "text-red-500",
    yellow: "text-yellow-500",
    purple: "text-purple-500",
    pink: "text-pink-500",
    indigo: "text-indigo-500",
    gray: "text-gray-500",
    slate: "text-slate-500",
    zinc: "text-zinc-500",
    neutral: "text-neutral-500",
    stone: "text-stone-500",
    orange: "text-orange-500",
    amber: "text-amber-500",
    lime: "text-lime-500",
    emerald: "text-emerald-500",
    teal: "text-teal-500",
    cyan: "text-cyan-500",
    sky: "text-sky-500",
    violet: "text-violet-500",
    fuchsia: "text-fuchsia-500",
    rose: "text-rose-500",
  };
  return colorMap[iconColor] ?? "text-slate-500";
};

const FALLBACK_PRIMARY_SUGGESTIONS: SuggestionItem[] = [
  { term: "dashboard", icon: "LayoutDashboard" },
  { term: "promozioni", icon: "Activity" },
  { term: "materiali", icon: "FolderOpen" },
  { term: "volantini", icon: "FileText" },
  { term: "ordini", icon: "PackagePlus" },
  { term: "impostazioni", icon: "Settings" },
];

const FALLBACK_EXTRA_SUGGESTIONS: SuggestionItem[] = [
  { term: "utenti", icon: "Users" },
  { term: "permessi", icon: "Shield" },
  { term: "documentazione", icon: "BookOpen" },
];

const formatSuggestionLabel = (term: string): string =>
  term
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// ==========================================================================
function Main(props: MainProps) {
  // --------------------- state -------------------------------------------
  const [search, setSearch] = useState("");
  const [filteredResults, setFilteredResults] = useState<SearchItem[]>([]);
  const [recentPages, setRecentPages] = useState<SearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const keyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const navigate = useNavigate();

  // ------------------- fetch settings ------------------------------------
  const { data: quickSearchSettings } = useQuery<SearchItem[], Error>({
    queryKey: ["quickSearchSettings"],
    queryFn: async () => {
      const data = await ServerCall.get("/get_quick_search_settings");
      return data as unknown as SearchItem[];
    },
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // ------------------- derive results ------------------------------------
  const memoizedFilteredResults = useMemo(() => {
    if (!search.trim() || !quickSearchSettings) return [];
    const term = search.toLowerCase();
    return quickSearchSettings.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term))
    );
  }, [search, quickSearchSettings]);

  useEffect(() => setFilteredResults(memoizedFilteredResults), [memoizedFilteredResults]);

  // -------------------- helpers ------------------------------------------
  const addToRecentPages = useCallback((page: SearchItem) => {
    setRecentPages((prev) => [page, ...prev.filter((p) => p.title !== page.title)].slice(0, 3));
  }, []);

  // results raggruppati per categoria (solo per la UI)
  const groupedResults = useMemo(() => {
    return filteredResults.reduce<Record<string, SearchItem[]>>((acc, item) => {
      (acc[item.category] = acc[item.category] || []).push(item);
      return acc;
    }, {});
  }, [filteredResults]);

  const { primarySuggestions, extraSuggestions } = useMemo(() => {
    if (!quickSearchSettings || quickSearchSettings.length === 0) {
      return {
        primarySuggestions: FALLBACK_PRIMARY_SUGGESTIONS,
        extraSuggestions: FALLBACK_EXTRA_SUGGESTIONS,
      };
    }

    const categoryMap = new Map<string, { term: string; icon: string; count: number }>();

    quickSearchSettings.forEach((item) => {
      const rawCategory = item.category?.trim();
      if (!rawCategory) return;

      const key = rawCategory.toLowerCase();
      const existing = categoryMap.get(key);

      if (existing) {
        existing.count += 1;
        return;
      }

      categoryMap.set(key, {
        term: key,
        icon: item.icon || "Search",
        count: 1,
      });
    });

    const dynamicSuggestions: SuggestionItem[] = Array.from(categoryMap.values())
      .sort((a, b) => b.count - a.count)
      .map(({ term, icon }) => ({ term, icon }));

    const primary = dynamicSuggestions.slice(0, 6);
    const extra = dynamicSuggestions.slice(6, 9);
    const used = new Set(dynamicSuggestions.map((s) => s.term));

    const fillSuggestions = (
      target: SuggestionItem[],
      fallback: SuggestionItem[],
      max: number
    ) => {
      for (const item of fallback) {
        if (target.length >= max) break;
        if (used.has(item.term)) continue;
        target.push(item);
        used.add(item.term);
      }
    };

    fillSuggestions(primary, FALLBACK_PRIMARY_SUGGESTIONS, 6);
    fillSuggestions(extra, FALLBACK_EXTRA_SUGGESTIONS, 3);

    return {
      primarySuggestions: primary,
      extraSuggestions: extra,
    };
  }, [quickSearchSettings]);

  // array **lineare** nell'ordine effettivamente renderizzato
  const displayItems: SearchItem[] = useMemo(() => {
    if (!search.trim()) return recentPages;
    return Object.values(groupedResults).flat();
  }, [search, groupedResults, recentPages]);

  // ------------------- scroll handling -----------------------------------
  const scrollToSelectedItem = useCallback((index: number) => {
    if (!scrollContainerRef.current || index < 0) return;
    const node = scrollContainerRef.current.querySelector<HTMLElement>(
      `[data-item-index="${index}"]`
    );
    node?.scrollIntoView({ block: "nearest" });
  }, []);

  useEffect(() => scrollToSelectedItem(selectedIndex), [selectedIndex, scrollToSelectedItem]);

  // ------------------- keyboard handler ----------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = displayItems.length - 1;
      const debounce = (fn: () => void) => {
        if (keyTimeoutRef.current) return; // ancora in debounce
        fn();
        keyTimeoutRef.current = setTimeout(() => (keyTimeoutRef.current = null), 80);
      };

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          debounce(() => setSelectedIndex((prev) => (prev >= maxIndex ? 0 : prev + 1)));
          break;
        case "ArrowUp":
          e.preventDefault();
          debounce(() => setSelectedIndex((prev) => (prev <= 0 ? maxIndex : prev - 1)));
          break;
        case "Enter":
          if (selectedIndex >= 0 && selectedIndex < displayItems.length) {
            e.preventDefault();
            handleItemClick(displayItems[selectedIndex]);
          }
          break;
        case "Escape":
          props.setQuickSearch(false);
          inputRef.current?.blur();
          break;
      }
    },
    [displayItems, selectedIndex, props]
  );

  // reset selezione quando cambia sorgente
  useEffect(() => setSelectedIndex(-1), [search, recentPages]);

  // ------------------- hotkeys globali -----------------------------------
  useHotkeys("esc", () => {
    props.setQuickSearch(false);
    inputRef.current?.blur();
  });

  useHotkeys([
    "ctrl+k",
    "meta+k",
  ], (event) => {
    event.preventDefault();
    inputRef.current?.focus();
    props.setQuickSearch(true);
  });

  // focus auto
  useEffect(() => {
    if (props.quickSearch) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [props.quickSearch]);

  // ------------------- helpers UI ----------------------------------------
  const handleItemClick = useCallback(
    (item: SearchItem) => {
      navigate(item.path);
      props.setQuickSearch(false);
      setSearch("");
      setSelectedIndex(-1);
      addToRecentPages(item);
    },
    [navigate, props.setQuickSearch, addToRecentPages]
  );

  // ------------------- render --------------------------------------------
  return (
    <>
      <Transition appear show={props.quickSearch} as={Fragment}>
        <HeadlessDialog
          as="div"
          className="relative z-[60] overflow-visible"
          onClose={() => {
            props.setQuickSearch(false);
            inputRef.current?.blur();
          }}
        >
          {/* backdrop */}
          <TransitionChild
            as={Fragment}
            enter="ease-in-out duration-50"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in-out duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gradient-to-b from-theme-1/50 via-theme-2/50 to-black/50 backdrop-blur-sm" />
          </TransitionChild>

          {/* dialog */}
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex justify-center my-2 sm:mt-40">
              <TransitionChild
                as={Fragment}
                enter="ease-in-out duration-50"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in-out duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="sm:w-[700px] lg:w-[850px] w-[98%] relative mx-auto transition-transform">
                  {/* input search */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center justify-center w-12">
                      <Lucide icon="Search" className="w-5 h-5 -mr-1.5 text-slate-500 stroke-[1]" />
                    </div>
                    <FormInput
                      ref={inputRef}
                      className="pl-12 pr-14 py-3.5 text-base rounded-lg focus:ring-0 border-0 shadow-lg"
                      type="text"
                      placeholder="Ricerca rapida..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center w-14">
                      <div className="px-2 py-1 mr-auto text-xs border rounded-[0.4rem] bg-slate-100 text-slate-500/80">ESC</div>
                    </div>
                  </div>

                  {/* risultati */}
                  <div
                    ref={scrollContainerRef}
                    className="relative z-10 pb-1 mt-1 bg-white rounded-lg shadow-lg max-h-[468px] sm:max-h-[615px] overflow-y-auto"
                  >
                    {/* SEZIONE: ricerca */}
                    {search.trim() ? (
                      filteredResults.length ? (
                        <div className="p-4">
                          {/* grouping */}
                          {(() => {
                            let runningIndex = -1;
                            return Object.entries(groupedResults).map(([category, items]) => (
                              <div key={category} className="mb-6 last:mb-0">
                                {/* header categoria */}
                                <div className="flex items-center mb-3">
                                  <div className="text-xs font-medium uppercase text-slate-500">{category}</div>
                                  <div className="ml-2 text-xs text-slate-400">({items.length})</div>
                                </div>

                                {/* items */}
                                <div className="space-y-1">
                                  {items.map((item) => {
                                    runningIndex += 1;
                                    const isSelected = runningIndex === selectedIndex;
                                    return (
                                      <button
                                        key={`${item.title}-${runningIndex}`}
                                        data-item-index={runningIndex}
                                        onClick={() => handleItemClick(item)}
                                        className={`flex items-center w-full p-3 text-left transition-colors rounded-lg focus:outline-none ${
                                          isSelected ? "bg-slate-100" : "hover:bg-slate-100 focus:bg-slate-100"
                                        }`}
                                      >
                                        <div className="flex items-center justify-center w-8 h-8 mr-3 rounded-lg bg-slate-100">
                                          <Lucide
                                            icon={item.icon as any}
                                            className={`w-4 h-4 stroke-[1.3] ${getIconColorClass(item.icon_color)}`}
                                          />
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-medium text-slate-900">{item.title}</div>
                                          {item.description && <div className="text-sm text-slate-500">{item.description}</div>}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-20 pb-28">
                          <Lucide icon="SearchX" className="w-20 h-20 text-theme-1/20 fill-theme-1/5 stroke-[0.5]" />
                          <div className="mt-5 text-xl font-medium">Nessun risultato trovato</div>
                          <div className="w-2/3 mt-3 leading-relaxed text-center text-slate-500">
                            Nessun risultato trovato per <span className="italic font-medium">"{search}"</span>. Prova con un termine di ricerca diverso o controlla l'ortografia.
                          </div>
                        </div>
                      )
                    ) : (
                      /* SEZIONE: suggerimenti + recenti */
                      <div>
                        {/* suggerimenti (chip) */}
                        <div className="px-5 py-4">
                          <div className="flex items-center">
                            <div className="text-xs uppercase text-slate-500">Inizia la tua ricerca qui...</div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3.5">
                            {primarySuggestions.map(({ term, icon }) => (
                              <button
                                key={term}
                                onClick={() => setSearch(term)}
                                className="flex items-center gap-x-1.5 border rounded-full px-3 py-0.5 border-slate-300/70 hover:bg-slate-50"
                              >
                                <Lucide icon={icon as any} className="w-4 h-4 stroke-[1.3]" />
                                {formatSuggestionLabel(term)}
                              </button>
                            ))}
                            {extraSuggestions.length > 0 && (
                              <Popover className="z-50">
                                <Popover.Button className="flex items-center gap-x-1.5 border rounded-full px-3 py-0.5 border-slate-300/70 hover:bg-slate-50">
                                  Altro
                                  <Lucide icon="ChevronDown" className="w-4 h-4 stroke-[1.3] -ml-0.5" />
                                </Popover.Button>
                                <Popover.Panel className="w-52 mt-2 p-0">
                                  {extraSuggestions.map(({ term, icon }) => (
                                    <button
                                      key={term}
                                      onClick={() => setSearch(term)}
                                      className="flex items-center w-full px-3 py-2 text-left hover:bg-slate-50"
                                    >
                                      <Lucide icon={icon as any} className="w-4 h-4 mr-2" />
                                      {formatSuggestionLabel(term)}
                                    </button>
                                  ))}
                                </Popover.Panel>
                              </Popover>
                            )}
                          </div>
                        </div>

                        {/* recenti */}
                        <div className="px-5 py-4 border-t border-dashed">
                          <div className="flex items-center">
                            <div className="text-xs uppercase text-slate-500">Pagine Recenti</div>
                          </div>
                          <div className="flex flex-col gap-1 mt-3.5">
                            {recentPages.map((page, index) => {
                              const isSelected = index === selectedIndex;
                              return (
                                <button
                                  key={`${page.title}-${index}`}
                                  data-item-index={index}
                                  onClick={() => handleItemClick(page)}
                                  className={`flex items-center p-2 text-left transition-colors rounded focus:outline-none ${
                                    isSelected ? "bg-slate-100" : "hover:bg-slate-100"
                                  }`}
                                >
                                  <Lucide icon={page.icon as any} className={`w-4 h-4 mr-2 ${getIconColorClass(page.icon_color)}`} />
                                  <span>{page.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* tips */}
                        <div className="px-5 py-4 border-t border-dashed">
                          <div className="flex items-center">
                            <div className="text-xs uppercase text-slate-500">Suggerimenti</div>
                          </div>
                          <div className="flex flex-col gap-1 mt-3.5 text-sm text-slate-600">
                            <div>• Usa Ctrl+K per aprire rapidamente la ricerca</div>
                            <div>• Cerca per nome pagina o categoria</div>
                            <div>• Premi ESC per chiudere</div>
                            <div>• Usa ↑↓ per navigare e Enter per selezionare</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </HeadlessDialog>
      </Transition>
    </>
  );
}

export default Main;
