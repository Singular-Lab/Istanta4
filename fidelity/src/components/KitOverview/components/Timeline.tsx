import Lucide from "@/components/Base/Lucide";
import EmptyState from "@/components/EmptyState";
import { FC, useMemo } from "react";
import { getTimelineIconConfig } from "../config/stateConfig";
import { TimelineEvent, TimelineProps } from "../types";
import TimelineItem from "./TimelineItem";

/**
 * Timeline - Visualizza la cronologia degli eventi del kit.
 * Gli eventi sono ordinati dal più recente al più vecchio.
 */
const Timeline: FC<TimelineProps> = ({
  events,
  maxItems = 5
}) => {
  // Ordina e limita gli eventi
  const sortedEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxItems);
  }, [events, maxItems]);

  return (
    <div className="box box--stacked p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <Lucide icon="History" className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800">Attività Recenti</h3>
          <p className="text-xs text-slate-500">Cronologia lavorazione</p>
        </div>
      </div>

      {/* Timeline Content */}
      {sortedEvents.length > 0 ? (
        <div className="space-y-0">
          {sortedEvents.map((event, idx) => {
            const iconConfig = getTimelineIconConfig(event.type);
            return (
              <TimelineItem
                key={`${event.type}-${idx}-${event.timestamp}`}
                icon={iconConfig.icon}
                iconColor={iconConfig.color}
                iconBg={iconConfig.bg}
                title={event.title}
                description={event.description}
                timestamp={event.timestamp}
                isLast={idx === sortedEvents.length - 1}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="Clock"
          title="Nessuna attività"
          description="Non sono disponibili informazioni sulla cronologia."
        />
      )}
    </div>
  );
};

/**
 * Helper function per costruire gli eventi timeline dai dati del kit
 */
export const buildTimelineEvents = (
  lavorazione: { createdAt?: Date | string; updatedAt?: Date | string },
  filesData?: Array<{
    log?: {
      logs?: Array<{
        azione: string;
        data_notifica: Date;
        messaggio?: string;
        utente_notifica?: string;
      }>;
    };
  }>
): TimelineEvent[] => {
  const events: TimelineEvent[] = [];

  // Kit creation event
  if (lavorazione.createdAt) {
    events.push({
      type: "created",
      timestamp: new Date(lavorazione.createdAt),
      title: "Kit creato",
      description: "Inizio lavorazione"
    });
  }

  // File logs
  if (filesData) {
    filesData.forEach((file) => {
      if (file.log?.logs) {
        file.log.logs.forEach((log) => {
          let type: TimelineEvent["type"] = "upload";
          if (log.azione === "Accettato") type = "accepted";
          else if (log.azione === "Rifiutato") type = "rejected";
          else if (log.azione === "Upload") type = "upload";

          events.push({
            type,
            timestamp: new Date(log.data_notifica),
            title: log.azione,
            description: log.messaggio || undefined
          });
        });
      }
    });
  }

  // Kit published event (solo se updatedAt è diverso da createdAt)
  if (lavorazione.updatedAt && lavorazione.createdAt) {
    const createdTime = new Date(lavorazione.createdAt).getTime();
    const updatedTime = new Date(lavorazione.updatedAt).getTime();

    // Aggiungi solo se c'è una differenza significativa (più di 1 minuto)
    if (updatedTime - createdTime > 60000) {
      events.push({
        type: "published",
        timestamp: new Date(lavorazione.updatedAt),
        title: "Kit aggiornato",
        description: "Ultima modifica"
      });
    }
  }

  return events;
};

export default Timeline;
