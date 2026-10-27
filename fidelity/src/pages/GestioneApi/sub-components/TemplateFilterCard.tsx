import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { useNotification } from "../../../context/NotificationContext";

interface FilterCondition {
    field: string;
    operator: string;
    value: string;
}

interface TemplateFilterCardProps {
    template: {
        id_filter_template: string;
        nome: string;
        slug: string;
        descrizione?: string;
        endpoint_type: "refs" | "refs-html" | "files";
        render_type: "grid" | "carousel" | "list";
        template_ids: string[];
        export_codes: string[];
        filters: FilterCondition[][];
        is_active: boolean;
    };
    selected: boolean;
    onSelect: () => void;
    onEdit?: () => void;
}

function TemplateFilterCard({
    template,
    selected,
    onSelect,
    onEdit,
}: TemplateFilterCardProps) {
    const { showNotification } = useNotification();

    const copySlug = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(template.slug);
        showNotification(
            <div className="flex items-center">
                <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
                <div className="ml-3">
                    <div className="font-semibold">Slug copiato</div>
                    <div className="text-xs text-slate-500">{template.slug}</div>
                </div>
            </div>
        );
    };

    const getEndpointIcon = (type: string) => {
        switch (type) {
            case "refs":
                return "Database";
            case "refs-html":
                return "Code";
            case "files":
                return "FileDown";
            default:
                return "Plug";
        }
    };

    const getEndpointLabel = (type: string) => {
        switch (type) {
            case "refs":
                return "Referenze JSON";
            case "refs-html":
                return "Referenze HTML";
            case "files":
                return "Files";
            default:
                return type;
        }
    };

    return (
        <div
            className={clsx(
                "w-full rounded-xl border transition-all relative overflow-hidden",
                "bg-white dark:bg-darkmode-700",
                selected
                    ? "border-primary/40 ring-1 ring-primary/20"
                    : "border-slate-200 dark:border-slate-600 hover:border-primary/30",
                !template.is_active && "opacity-90"
            )}
        >
            {/* =======================
          BODY: seleziona il template
      ======================= */}
            <button
                type="button"
                onClick={() => {
                    onSelect()
                }}
                aria-pressed={selected}
                className={clsx(
                    "w-full text-left cursor-pointer p-5 flex flex-col gap-4 transition-opacity ",
                    !template.is_active && "text-slate-400 dark:text-slate-400"

                )}
            >

                {/* HEADER */}
                <span className="flex items-start justify-between gap-4">
                    <span className="min-w-0 flex-1 flex flex-col gap-1">
                        <span className="flex items-center gap-2">
                            <span className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {template.nome}
                            </span>

                            {!template.is_active && (
                                <span className="px-2 py-0.5 text-2xs font-semibold rounded-full
                   bg-slate-200 text-slate-600
                   dark:bg-darkmode-500 dark:text-slate-300">
                                    Inattivo
                                </span>
                            )}

                        </span>

                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Lucide icon="Hash" aria-hidden="true" className="w-3.5 h-3.5 text-slate-400" />
                            <code className="font-mono bg-slate-100 dark:bg-darkmode-500 px-1.5 py-0.5 rounded">
                                {template.slug}
                            </code>
                        </span>
                    </span>

                    {selected && (
                        <span className="px-2 py-1 text-xs font-medium rounded-md bg-primary text-white">
                            Selezionato
                        </span>
                    )}
                </span>

                {/* DESCRIZIONE */}
                {template.descrizione && (
                    <span className="block text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                        {template.descrizione}
                    </span>
                )}

                {/* BADGES */}
                <span className="flex flex-wrap gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-light text-dark">
                        <Lucide
                            icon={getEndpointIcon(template.endpoint_type)}
                            aria-hidden="true"
                            className="w-3.5 h-3.5"
                        />
                        {getEndpointLabel(template.endpoint_type)}
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-darkmode-500 dark:text-slate-200">
                        <Lucide
                            icon={
                                template.render_type === "grid"
                                    ? "Grid3x3"
                                    : template.render_type === "list"
                                        ? "List"
                                        : "ArrowLeftRight"
                            }
                            aria-hidden="true"
                            className="w-3.5 h-3.5"
                        />
                        {template.render_type === "grid" ? "Griglia" : template.render_type === "list" ? "Lista" : "Carousel"}
                    </span>
                </span>

                {/* STATS */}
                <span className="pt-3 mt-2 border-t border-slate-100 dark:border-darkmode-600 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                    {template.template_ids.length > 0 && (
                        <span className="flex items-center gap-1.5">
                            <Lucide icon="Layers" aria-hidden="true" className="w-4 h-4 text-slate-400" />
                            {template.template_ids.length} template
                        </span>
                    )}

                    {template.export_codes?.length > 0 && (
                        <span className="flex items-center gap-1.5">
                            <Lucide icon="FileType" aria-hidden="true" className="w-4 h-4 text-slate-400" />
                            {template.export_codes.length} export
                        </span>
                    )}

                    {template.filters.length > 0 && (
                        <span className="flex items-center gap-1.5">
                            <Lucide icon="Filter" aria-hidden="true" className="w-4 h-4 text-slate-400" />
                            {template.filters.length} filtri
                        </span>
                    )}
                </span>
            </button>

            {/* =======================
          FOOTER
      ======================= */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-darkmode-600 flex justify-between">
                <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={copySlug}
                    className="text-xs"
                >
                    <Lucide icon="Copy" className="w-3.5 h-3.5 mr-1.5" />
                    Copia slug
                </Button>
                {onEdit && (
                    <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onEdit();
                        }}
                        className="text-xs"
                    >
                        <Lucide icon="Pen" className="w-3.5 h-3.5 mr-1.5" />
                        Modifica
                    </Button>
                )}
            </div>
            {!template.is_active && (
                <div className="absolute inset-0 bg-white/40 dark:bg-darkmode-700/40 pointer-events-none" />
            )}
        </div>
    );
}

export default TemplateFilterCard;
