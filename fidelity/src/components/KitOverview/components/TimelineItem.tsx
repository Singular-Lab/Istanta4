import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import dayjs from "dayjs";
import "dayjs/locale/it";
import { FC } from "react";
import { TimelineItemProps } from "../types";

dayjs.locale("it");

/**
 * Componente TimelineItem per visualizzare un singolo evento nella timeline.
 */
const TimelineItem: FC<TimelineItemProps> = ({
  icon,
  iconColor,
  iconBg,
  title,
  description,
  timestamp,
  isLast
}) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <div className={clsx("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", iconBg)}>
        <Lucide icon={icon as any} className={clsx("h-4 w-4", iconColor)} />
      </div>
      {!isLast && <div className="w-px h-full bg-slate-200 my-1" />}
    </div>
    <div className={clsx("pb-4", isLast && "pb-0")}>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      <p className="text-[10px] text-slate-400 mt-1">
        {dayjs(timestamp).format("DD MMM YYYY, HH:mm")}
      </p>
    </div>
  </div>
);

export default TimelineItem;
