import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
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
                "relative w-full overflow-hidden rounded-card border bg-white transition-colors",
                selected
                    ? "border-primary/40 ring-1 ring-primary/20"
                    : "border-slate-200 hover:border-primary/30",
                !template.is_active && "opacity-90"
            )}
        >
            {/* Corpo: seleziona il template */}
            <button
                type="button"
                onClick={() => {
                    onSelect()
                }}
                aria-pressed={selected}
                className={clsx(
                    "flex w-full cursor-pointer flex-col gap-4 p-5 text-left transition-opacity",
                    !template.is_active && "text-slate-400"
                )}
            >
                {/* Intestazione */}
                <span className="flex items-start justify-between gap-4">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center gap-2">
                            <span className="title-card truncate">
                                {template.nome}
                            </span>

                            {!template.is_active && (
                                <StatusBadge tono="neutral" etichetta="Inattivo" />
                            )}
                        </span>

                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Lucide icon="Hash" aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
                            <code className="rounded-control bg-slate-100 px-1.5 py-0.5 font-mono">
                                {template.slug}
                            </code>
                        </span>
                    </span>

                    {selected && (
                        <StatusBadge tono="brand" icon="Check" etichetta="Selezionato" />
                    )}
                </span>

                {/* Descrizione */}
                {template.descrizione && (
                    <span className="line-clamp-2 block text-sm leading-relaxed text-slate-600">
                        {template.descrizione}
                    </span>
                )}

                {/* Sorgente e modalità di rendering */}
                <span className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="secondary" size="sm" className="gap-1.5">
                        <Lucide
                            icon={getEndpointIcon(template.endpoint_type)}
                            aria-hidden="true"
                            className="h-3 w-3"
                        />
                        {getEndpointLabel(template.endpoint_type)}
                    </Badge>

                    <Badge variant="secondary" size="sm" className="gap-1.5">
                        <Lucide
                            icon={
                                template.render_type === "grid"
                                    ? "Grid3x3"
                                    : template.render_type === "list"
                                        ? "List"
                                        : "ArrowLeftRight"
                            }
                            aria-hidden="true"
                            className="h-3 w-3"
                        />
                        {template.render_type === "grid" ? "Griglia" : template.render_type === "list" ? "Lista" : "Carousel"}
                    </Badge>
                </span>

                {/* Conteggi */}
                <span className="mt-2 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    {template.template_ids.length > 0 && (
                        <span className="flex items-center gap-1.5">
                            <Lucide icon="Layers" aria-hidden="true" className="h-4 w-4 text-slate-400" />
                            {template.template_ids.length} template
                        </span>
                    )}

                    {template.export_codes?.length > 0 && (
                        <span className="flex items-center gap-1.5">
                            <Lucide icon="FileType" aria-hidden="true" className="h-4 w-4 text-slate-400" />
                            {template.export_codes.length} export
                        </span>
                    )}

                    {template.filters.length > 0 && (
                        <span className="flex items-center gap-1.5">
                            <Lucide icon="Filter" aria-hidden="true" className="h-4 w-4 text-slate-400" />
                            {template.filters.length} filtri
                        </span>
                    )}
                </span>
            </button>

            {/* Azioni */}
            <div className="flex justify-between gap-2 border-t border-slate-100 px-5 py-3">
                <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={copySlug}
                >
                    <Lucide icon="Copy" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Copia slug
                </Button>
                {onEdit && (
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onEdit();
                        }}
                    >
                        <Lucide icon="Pen" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                        Modifica
                    </Button>
                )}
            </div>
            {!template.is_active && (
                <div className="pointer-events-none absolute inset-0 bg-white/40" />
            )}
        </div>
    );
}

export default TemplateFilterCard;
