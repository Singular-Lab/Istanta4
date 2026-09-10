import Lucide from "@/components/Base/Lucide";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import clsx from "clsx";
import type { HubNewsDTO } from "../../../../lib/types";

interface NewsCardProps {
  news: HubNewsDTO;
  index: number;
}

const tipoConfig: Record<
  string,
  {
    icon: string;
    label: string;
    border: string;
    iconBg: string;
    iconColor: string;
    badge: string;
  }
> = {
  info: {
    icon: "Info",
    label: "Informazione",
    border: "border-l-blue-400",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    badge: "bg-blue-50 text-blue-600 border-blue-100",
  },
  warning: {
    icon: "AlertTriangle",
    label: "Avviso",
    border: "border-l-amber-400",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    badge: "bg-amber-50 text-amber-600 border-amber-100",
  },
  success: {
    icon: "CheckCircle",
    label: "Successo",
    border: "border-l-emerald-400",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-600 border-emerald-100",
  },
  update: {
    icon: "Sparkles",
    label: "Aggiornamento",
    border: "border-l-violet-400",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    badge: "bg-violet-50 text-violet-600 border-violet-100",
  },
};

function isBase64Icon(icona?: string): boolean {
  return typeof icona === "string" && icona.startsWith("data:");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const NewsCard: React.FC<NewsCardProps> = ({ news, index }) => {
  const config = tipoConfig[news.tipo] ?? tipoConfig.info;
  const hasImage = isBase64Icon(news.icona);
  const lucideIcon = !hasImage && news.icona ? news.icona : config.icon;
  const sanitizedContent = sanitizeHtml(news.contenuto);

  return (
    <div
      className={clsx(
        "group bg-white rounded-xl border border-slate-200",
        "p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300",
        "animate-fade-in-up flex flex-col"
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      {/* Immagine opzionale */}
      {hasImage && (
        <div className="mb-4 h-24 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden">
          <img src={news.icona} alt="" className="w-full h-full object-contain" />
        </div>
      )}

      {/* Badges: tipo + in_evidenza */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className={clsx(
          "inline-flex items-center gap-1 px-2 py-0.5",
          "text-[10px] font-semibold uppercase tracking-wide rounded-full border",
          config.badge
        )}>
          <Lucide icon={config.icon as any} className="w-2.5 h-2.5" />
          {config.label}
        </span>

        {news.in_evidenza && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 rounded-full border border-amber-200">
            <Lucide icon="Star" className="w-2.5 h-2.5" />
            In evidenza
          </span>
        )}
      </div>

      {/* Titolo con icona */}
      <div className="flex items-start gap-2.5 mb-3">
        {!hasImage && (
          <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", config.iconBg)}>
            <Lucide icon={lucideIcon as any} className={clsx("w-4 h-4", config.iconColor)} />
          </div>
        )}
        <h4 className="font-semibold text-sm text-slate-800 leading-snug line-clamp-2 mt-1">
          {news.titolo}
        </h4>
      </div>

      {/* Contenuto */}
      <div
        className="text-slate-500 text-sm leading-relaxed min-h-[3.9rem] mb-3 grow max-h-[4.8rem] overflow-hidden [&_a]:text-primary [&_a]:underline [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />

      {/* Footer */}
      <div className="flex items-end justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-slate-400">
            {formatDate(news.data_pubblicazione)}
            {news.autore_nome && ` · ${news.autore_nome}`}
          </span>
          {news.data_scadenza && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600/90">
              <Lucide icon="Clock" className="w-2.5 h-2.5" />
              Scade il {formatDate(news.data_scadenza)}
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
            <Lucide icon="ExternalLink" className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
        )}
      </div>
    </div>
  );
};

export default NewsCard;
