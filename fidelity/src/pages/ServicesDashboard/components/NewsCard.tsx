import Badge from "@/components/Base/Badge";
import Lucide from "@/components/Base/Lucide";
import { formatData } from "@/utils/format";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import clsx from "clsx";
import type { HubNewsDTO } from "../../../../lib/types";

interface NewsCardProps {
  news: HubNewsDTO;
  index: number;
}

type VarianteBadge = "info" | "warning" | "success" | "primary";

const tipoConfig: Record<
  string,
  {
    icon: string;
    label: string;
    variant: VarianteBadge;
    iconBg: string;
    iconColor: string;
  }
> = {
  info: {
    icon: "Info",
    label: "Informazione",
    variant: "info",
    iconBg: "bg-info/10",
    iconColor: "text-info",
  },
  warning: {
    icon: "AlertTriangle",
    label: "Avviso",
    variant: "warning",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
  },
  success: {
    icon: "CheckCircle",
    label: "Successo",
    variant: "success",
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
  update: {
    icon: "Sparkles",
    label: "Aggiornamento",
    variant: "primary",
    iconBg: "bg-theme-1/10",
    iconColor: "text-theme-1",
  },
};

function isBase64Icon(icona?: string): boolean {
  return typeof icona === "string" && icona.startsWith("data:");
}

const NewsCard: React.FC<NewsCardProps> = ({ news, index }) => {
  const config = tipoConfig[news.tipo] ?? tipoConfig.info;
  const hasImage = isBase64Icon(news.icona);
  const lucideIcon = !hasImage && news.icona ? news.icona : config.icon;
  const sanitizedContent = sanitizeHtml(news.contenuto);

  return (
    <div
      className={clsx(
        "group bg-white rounded-card border border-slate-200",
        "p-5 shadow-card hover:shadow-overlay hover:border-slate-300 transition-all duration-300",
        "animate-fade-in-up flex flex-col"
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      {/* Immagine opzionale */}
      {hasImage && (
        <div className="mb-4 h-24 rounded-control border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden">
          <img src={news.icona} alt="" className="w-full h-full object-contain" />
        </div>
      )}

      {/* Badges: tipo + in_evidenza */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <Badge variant={config.variant} size="sm" border>
          <Lucide icon={config.icon as any} aria-hidden="true" className="h-3 w-3" />
          {config.label}
        </Badge>

        {news.in_evidenza && (
          <Badge variant="warning" size="sm" border className="shrink-0">
            <Lucide icon="Star" aria-hidden="true" className="h-3 w-3" />
            In evidenza
          </Badge>
        )}
      </div>

      {/* Titolo con icona */}
      <div className="flex items-start gap-2.5 mb-3">
        {!hasImage && (
          <div className={clsx("w-8 h-8 rounded-control flex items-center justify-center shrink-0", config.iconBg)}>
            <Lucide icon={lucideIcon as any} aria-hidden="true" className={clsx("w-4 h-4", config.iconColor)} />
          </div>
        )}
        <h3 className="title-card mt-1 line-clamp-2">
          {news.titolo}
        </h3>
      </div>

      {/* Contenuto */}
      <div
        className="text-slate-500 text-sm leading-relaxed min-h-[3.9rem] mb-3 grow max-h-[4.8rem] overflow-hidden [&_a]:text-primary [&_a]:underline [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />

      {/* Footer */}
      <div className="flex items-end justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs text-slate-400">
            {formatData(news.data_pubblicazione)}
            {news.autore_nome && ` · ${news.autore_nome}`}
          </span>
          {news.data_scadenza && (
            <span className="inline-flex items-center gap-1 text-3xs text-warning">
              <Lucide icon="Clock" aria-hidden="true" className="w-2.5 h-2.5" />
              Scade il {formatData(news.data_scadenza)}
            </span>
          )}
        </div>

        {news.url && (
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              "shrink-0 text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-70",
              config.iconColor
            )}
          >
            Leggi di più
            <Lucide icon="ExternalLink" aria-hidden="true" className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
        )}
      </div>
    </div>
  );
};

export default NewsCard;
