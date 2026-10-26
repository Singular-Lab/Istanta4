import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { icons } from "lucide-react";
import React, { memo, useMemo } from "react";
import { useDrag } from "react-dnd";
import { ItemTypes } from "./types";

interface DraggableItemProps {
  content: string;
  type: string;
  icon: keyof typeof icons;
}

const DraggableItem: React.FC<DraggableItemProps> = memo(({
  content,
  type,
  icon,
}) => {
  // Memoizza l'oggetto item per evitare ricreazioni non necessarie
  const dragItem = useMemo(() => ({
    content,
    type,
    isNew: true,
    parentId: null
  }), [content, type]);

  // Memoizza le opzioni di drag per ottimizzare le performance
  const dragOptions = useMemo(() => ({
    type: ItemTypes.ELEMENT,
    item: dragItem,
    collect: (monitor: any) => {
      const dragging = monitor.isDragging();
      if (dragging) {
        console.log('[DraggableItem] drag start', dragItem);
      }
      return {
        isDragging: dragging,
      };
    },
    end: (item: any, monitor: any) => {
      const dropResult = monitor.getDropResult();
      console.log('[DraggableItem] drag end', {
        item,
        dropResult,
        didDrop: monitor.didDrop()
      });
    },
  }), [dragItem]);

  const [{ isDragging }, drag] = useDrag(dragOptions);

  // Memoizza le classi CSS per evitare ricalcoli
  const containerClasses = useMemo(() => clsx(
    "react-dnd-draggable",
    "flex items-center p-3 bg-white dark:bg-darkmode-600 text-slate-700 dark:text-slate-300 rounded-lg",
    "hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary transition-all duration-200 cursor-pointer",
    "border-2 border-transparent translate-x-0",
    {
      "opacity-50 cursor-grabbing": isDragging,
      "hover:border-primary/20": !isDragging,
    }
  ), [isDragging]);

  return (
    <div
      ref={drag as any}
      className={containerClasses}
    >
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-darkmode-500 rounded-md mr-3">
        <Lucide icon={icon} className="w-5 h-5 text-slate-500 dark:text-slate-400" />
      </div>
      <span className="font-medium text-sm">{content}</span>
    </div>
  );
});

export default DraggableItem;
