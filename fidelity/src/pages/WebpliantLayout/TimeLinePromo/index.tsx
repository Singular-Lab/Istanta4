import React, { useState, useMemo, useRef, useEffect } from "react";
import dayjs from "dayjs";

import { useTimeline } from "@/context/TimeLinePromoContext";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import Lucide from "@/components/Base/Lucide";
import { FormCheck } from "@/components/Base/Form";
import clsx from "clsx";
import Tippy from '@tippyjs/react';
import { TimelinePromoItem } from "../../../../lib/types";
import { useLocation, useNavigate, useRevalidator } from "react-router-dom";

interface TimelineProps {
  tasks: TimelinePromoItem[];
  onDateRangeChange?: (value: string[]) => void;
  height?: string;
  onClose?: () => void;
}

const TimeLinePromo: React.FC<TimelineProps> = ({
  tasks: initialTasks,
  onDateRangeChange,
  height = "h-[320px]",
  onClose,
}) => {
  useEffect(() => { console.log(initialTasks) }, [initialTasks])
  // Stati principali
  const [tasks, setTasks] = useState<TimelinePromoItem[]>(initialTasks);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { today, range, sliderValue, dates, selectedDate, updateDateRange, numeroRefPromo } = useTimeline();

  // Riferimenti DOM
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Navigazione
  const navigate = useNavigate();
  const location = useLocation();

  // Costanti per il layout - Sistema di allineamento perfetto
  const DAY_WIDTH = 32; // Larghezza standard per giorni
  const TASK_HEIGHT = 44; // Altezza righe task
  const SIDEBAR_WIDTH = 280; // Larghezza sidebar

  // Calcola la larghezza totale della timeline
  const timelineWidth = range * DAY_WIDTH;

  // Effetto per sincronizzare lo scrolling
  useEffect(() => {
    const container = containerRef.current;
    const timeline = timelineRef.current;
    const header = headerRef.current;

    if (!container || !timeline || !header) return;

    const handleContainerScroll = () => {
      if (header) {
        header.scrollLeft = container.scrollLeft;
      }
    };

    container.addEventListener('scroll', handleContainerScroll);

    return () => {
      container.removeEventListener('scroll', handleContainerScroll);
    };
  }, []);

  // Gestisci il click sulla timeline
  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left + containerRef.current.scrollLeft;
    const dayIndex = Math.floor(x / DAY_WIDTH);

    if (dayIndex >= 0 && dayIndex < range) {
      updateDateRange(dayIndex, onDateRangeChange);

      // Aggiorna il parametro della data nell'URL
      const params = new URLSearchParams(location.search);
      params.set("date", dates[dayIndex].format("YYYY-MM-DD"));
      navigate(
        {
          pathname: location.pathname,
          search: params.toString(),
        },
        { replace: false }
      );
    }
  };

  // Ottimizza il calcolo della struttura della timeline
  const timelineStructure = useMemo(() => {
    const months: { start: number; end: number; name: string }[] = [];
    let currentMonth = dates[0].format("MMM YYYY");
    let startIndex = 0;

    dates.forEach((date, index) => {
      const month = date.format("MMM YYYY");
      if (month !== currentMonth) {
        months.push({
          start: startIndex,
          end: index - 1,
          name: currentMonth
        });
        currentMonth = month;
        startIndex = index;
      }
    });
    months.push({ start: startIndex, end: dates.length - 1, name: currentMonth });

    return { months, weeks: Math.ceil(dates.length / 7) };
  }, [dates]);

  // Funzione per scorrere alla data selezionata
  useEffect(() => {
    if (containerRef.current && sliderValue >= 0) {
      const scrollPosition = sliderValue * DAY_WIDTH - containerRef.current.clientWidth / 2;
      containerRef.current.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  }, [sliderValue, DAY_WIDTH]);

  // Funzione per calcolare la posizione e la larghezza di un task
  const calculateTaskPosition = (task: TimelinePromoItem) => {
    const startDate = dayjs(task.startDate, 'DD/MM/YYYY');
    const endDate = dayjs(task.endDate, 'DD/MM/YYYY');

    const startDiff = startDate.diff(today, 'day');
    const endDiff = endDate.diff(today, 'day');

    // Verifica se la task è visibile nella timeline corrente
    if (startDiff >= range || endDiff < 0) {
      return null;
    }

    // Calcolo preciso della posizione con padding
    const startPos = Math.max(0, startDiff) * DAY_WIDTH + 2; // +2px padding
    const endPos = Math.min(range - 1, endDiff) * DAY_WIDTH + DAY_WIDTH - 2; // -2px padding
    const width = endPos - startPos;

    return { startPos, width };
  };

  // Funzione per scorrere verso la data corrente
  const scrollToToday = () => {
    const todayIndex = dates.findIndex(date => date.isSame(dayjs(), 'day'));
    if (todayIndex >= 0) {
      updateDateRange(todayIndex, onDateRangeChange);
    }
  };

  return (
    <div className={clsx(
      "bg-white rounded-xl shadow-lg border border-slate-200/60 backdrop-blur-sm overflow-hidden",
      "transition-all duration-500 ease-out transform",
      isCollapsed ? "h-12 translate-y-2 opacity-90" : "h-[520px] translate-y-0 opacity-100",
      // Animazione slide-up dal basso
      !isCollapsed && "animate-in slide-in-from-bottom-4 duration-500"
    )}>
      {/* Header principale */}
      <div className="flex items-center px-4 py-3 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100/50 backdrop-blur-sm">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="mr-3 p-2 hover:bg-white/60 rounded-lg text-slate-700 transition-all duration-200 hover:shadow-sm group"
        >
          <Lucide 
            icon={isCollapsed ? "ChevronUp" : "ChevronDown"} 
            className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" 
          />
        </button>

        <div className="flex-1 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-gradient-to-b from-primary to-primary/70 rounded-full"></div>
            <h3 className="font-semibold text-slate-800 text-sm tracking-tight">Timeline Promozioni</h3>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1 bg-white/70 rounded-md border border-slate-200/50">
            <Lucide icon="Calendar" className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 text-xs font-medium">
              {dates[0].format("DD MMM")} - {dates[dates.length - 1].format("DD MMM YYYY")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            className="p-2 hover:bg-white/60 rounded-lg text-slate-600 transition-all duration-200 hover:shadow-sm hover:text-primary group"
            onClick={scrollToToday}
            title="Vai a oggi"
          >
            <Lucide icon="CalendarDays" className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
          </button>
          <button className="p-2 hover:bg-white/60 rounded-lg text-slate-600 transition-all duration-200 hover:shadow-sm hover:text-primary group">
            <Lucide icon="ZoomIn" className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
          </button>
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <button 
            className="p-2 hover:bg-red-50 rounded-lg text-slate-600 hover:text-red-600 transition-all duration-200 hover:shadow-sm group" 
            onClick={onClose}
          >
            <Lucide icon="X" className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Header della timeline - Sistema allineamento perfetto */}
          <div className="flex border-b border-slate-200/60 bg-gradient-to-b from-slate-25 to-white overflow-hidden">
            {/* Sidebar placeholder */}
            <div 
              className="flex-shrink-0 border-r border-slate-200/60 bg-slate-50/50" 
              style={{ width: `${SIDEBAR_WIDTH}px` }}
            />

            {/* Container header timeline */}
            <div 
              ref={headerRef} 
              className="overflow-hidden relative flex-1"
            >
              <div style={{ width: `${timelineWidth}px` }}>
                {/* Riga mesi */}
                <div className="h-8 relative border-b border-slate-200/40">
                  {timelineStructure.months.map((month, i) => {
                    const startPos = month.start * DAY_WIDTH;
                    const width = (month.end - month.start + 1) * DAY_WIDTH;
                    
                    return (
                      <div
                        key={i}
                        className="absolute top-0 h-8 flex items-center justify-center text-xs font-semibold text-slate-600 border-r border-slate-200/40 bg-gradient-to-r from-slate-50 to-transparent"
                        style={{
                          left: `${startPos}px`,
                          width: `${width}px`
                        }}
                      >
                        {month.name}
                      </div>
                    );
                  })}
                </div>

                {/* Riga giorni - Allineamento perfetto */}
                <div className="h-12 relative">
                  {dates.map((date, i) => {
                    const isToday = date.isSame(dayjs(), 'day');
                    const isSelected = date.isSame(selectedDate, 'day');
                    const isWeekend = date.day() === 0 || date.day() === 6;
                    
                    return (
                      <div
                        key={i}
                        className={clsx(
                          "absolute h-12 flex flex-col items-center justify-center border-r border-slate-200/40 transition-all duration-200",
                          isSelected && "bg-primary/10 border-primary/30",
                          isToday && !isSelected && "bg-emerald-50 border-emerald-200",
                          isWeekend && "bg-slate-50/50"
                        )}
                        style={{
                          left: `${i * DAY_WIDTH}px`,
                          width: `${DAY_WIDTH}px`
                        }}
                      >
                        <span className={clsx(
                          "font-semibold text-xs transition-colors duration-200",
                          isSelected ? "text-primary" :
                          isToday ? "text-emerald-700" :
                          isWeekend ? "text-slate-500" : "text-slate-700"
                        )}>
                          {date.format("DD")}
                        </span>
                        <span className={clsx(
                          "text-[10px] leading-none font-medium",
                          isSelected ? "text-primary/70" :
                          isToday ? "text-emerald-600" :
                          isWeekend ? "text-slate-400" : "text-slate-500"
                        )}>
                          {date.format("ddd").charAt(0).toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Corpo principale */}
          <div className="flex h-[320px]">
            {/* Sidebar */}
            <div 
              ref={sidebarRef} 
              className="border-r border-slate-200/60 flex-shrink-0 overflow-y-auto bg-gradient-to-b from-slate-25 to-slate-50/30"
              style={{ width: `${SIDEBAR_WIDTH}px` }}
            >
              {tasks.map((task, i) => {
                const hasError = numeroRefPromo.some(v => v.idPromo === task.idPromo && v.numeroRefPromo > 0);
                const errorInfo = numeroRefPromo.find(v => v.idPromo === task.idPromo);

                return (
                  <div 
                    key={i} 
                    className={clsx(
                      "group flex items-center justify-between px-4 py-2 border-b border-slate-200/40 hover:bg-white/70 transition-all duration-200 hover:shadow-sm relative", 
                      task.disabled && "opacity-60",
                      hasError && "bg-red-50/50 hover:bg-red-50/80"
                    )}
                    style={{ height: `${TASK_HEIGHT}px` }}
                  >
                    {/* Indicatore laterale */}
                    <div className={clsx(
                      "absolute left-0 top-0 bottom-0 w-1 transition-all duration-200",
                      hasError ? "bg-red-400" : 
                      task.disabled ? "bg-slate-300" : "bg-transparent group-hover:bg-primary/40"
                    )} />
                    
                    <div className="flex items-center gap-2 flex-1 overflow-hidden ml-2">
                      <FormCheck className="flex items-center">
                        <FormCheck.Input
                          type="checkbox"
                          checked={!task.disabled}
                          onChange={() => setTasks(prev => {
                            const newTasks = [...prev];
                            newTasks[i].disabled = !newTasks[i].disabled;
                            return newTasks;
                          })}
                          className="w-3.5 h-3.5 text-primary border-2 border-slate-300 rounded focus:ring-primary/20 focus:ring-2 transition-all duration-200"
                        />
                      </FormCheck>

                      <div className="flex-1 overflow-hidden">
                        <span className={clsx(
                          "block text-xs font-medium truncate transition-colors duration-200",
                          task.disabled ? "text-slate-400" :
                          hasError ? "text-red-700" : "text-slate-800"
                        )}>
                          {task.name}
                        </span>
                        
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {hasError && errorInfo && (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium">
                              <Lucide icon="TriangleAlert" className="w-2.5 h-2.5" />
                              {errorInfo.numeroRefPromo}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <span>{dayjs(task.startDate, 'DD/MM/YYYY').format("DD/MM")}</span>
                            <Lucide icon="ArrowRight" className="w-2.5 h-2.5" />
                            <span>{dayjs(task.endDate, 'DD/MM/YYYY').format("DD/MM")}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Menu as="div" className="relative">
                      <MenuButton className="p-1.5 hover:bg-white/80 rounded-md text-slate-500 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:text-slate-700 hover:shadow-sm">
                        <Lucide icon="EllipsisVertical" className="w-3.5 h-3.5" />
                      </MenuButton>

                      <MenuItems className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200/60 z-20 py-1 backdrop-blur-sm">
                        <MenuItem as="button" className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors duration-150">
                          <Lucide icon="Pen" className="w-3.5 h-3.5" /> Modifica
                        </MenuItem>
                        <div className="h-px bg-slate-200/60 my-1 mx-2"></div>
                        <MenuItem as="button" className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors duration-150">
                          <Lucide icon="Trash2" className="w-3.5 h-3.5" /> Elimina
                        </MenuItem>
                      </MenuItems>
                    </Menu>
                  </div>
                );
              })}
            </div>

            {/* Timeline principale - Allineamento perfetto */}
            <div 
              ref={containerRef}
              className="flex-grow overflow-auto relative bg-gradient-to-br from-slate-25 via-white to-slate-50/30"
              onClick={handleTimelineClick}
            >
              <div 
                ref={timelineRef}
                className="relative"
                style={{ width: `${timelineWidth}px`, height: "100%" }}
              >
                {/* Griglie verticali - Perfettamente allineate */}
                {dates.map((date, i) => {
                  const isToday = date.isSame(dayjs(), 'day');
                  const isSelected = date.isSame(selectedDate, 'day');
                  const isWeekend = date.day() === 0 || date.day() === 6;
                  
                  return (
                    <div
                      key={i}
                      className={clsx(
                        "absolute top-0 bottom-0 border-r cursor-pointer transition-all duration-200 hover:bg-primary/5",
                        isSelected ? "bg-primary/8 border-primary/30" :
                        isToday ? "bg-emerald-50/70 border-emerald-200" :
                        isWeekend ? "bg-slate-50/40 border-slate-200/60" : "border-slate-200/40"
                      )}
                      style={{
                        left: `${i * DAY_WIDTH}px`,
                        width: `${DAY_WIDTH}px`
                      }}
                    />
                  );
                })}

                {/* Griglie orizzontali */}
                {tasks.map((_, i) => (
                  <div
                    key={`row-${i}`}
                    className="absolute left-0 right-0 border-b border-slate-200/30"
                    style={{
                      top: `${i * TASK_HEIGHT}px`,
                      height: `${TASK_HEIGHT}px`
                    }}
                  />
                ))}

                {/* Barre delle attività */}
                {tasks.map((task, i) => {
                  if (task.disabled) return null;
                  
                  const position = calculateTaskPosition(task);
                  if (!position) return null;
                  
                  const { startPos, width } = position;
                  const hasError = numeroRefPromo.some(v => v.idPromo === task.idPromo && v.numeroRefPromo > 0);
                  const errorCount = numeroRefPromo.find(v => v.idPromo === task.idPromo)?.numeroRefPromo;

                  return (
                    <Tippy
                      key={i}
                      content={
                        <div className="p-3 rounded-lg bg-white border border-slate-200/60 shadow-xl backdrop-blur-sm max-w-xs">
                          <div className="font-semibold text-slate-800 mb-1 text-xs">{task.name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 mb-1">
                            <div className="flex items-center gap-1">
                              <Lucide icon="Calendar" className="w-2.5 h-2.5" />
                              <span>{dayjs(task.startDate, 'DD/MM/YYYY').format("DD MMM")}</span>
                            </div>
                            <Lucide icon="ArrowRight" className="w-2.5 h-2.5" />
                            <span>{dayjs(task.endDate, 'DD/MM/YYYY').format("DD MMM")}</span>
                          </div>
                          {hasError && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded text-[10px] text-red-700 border border-red-200/60">
                              <Lucide icon="TriangleAlert" className="w-3 h-3" />
                              <span className="font-medium">{errorCount} referenze mancanti</span>
                            </div>
                          )}
                        </div>
                      }
                      theme="light"
                      placement="top"
                    >
                      <div
                        className="absolute cursor-pointer z-[2] group"
                        style={{
                          left: `${startPos}px`,
                          width: `${width}px`,
                          top: `${i * TASK_HEIGHT + 8}px`,
                          height: `28px`
                        }}
                      >
                        <div className={clsx(
                          "h-full rounded-md relative transition-all duration-200 shadow-sm hover:shadow-md group-hover:scale-[1.02]",
                          hasError ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700" : 
                          "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                        )}>
                          {/* Maniglie ridimensionamento */}
                          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md bg-black/10 cursor-ew-resize hover:bg-black/20 transition-all duration-200 opacity-0 group-hover:opacity-100" />
                          <div className="absolute right-0 top-0 bottom-0 w-1 rounded-r-md bg-black/10 cursor-ew-resize hover:bg-black/20 transition-all duration-200 opacity-0 group-hover:opacity-100" />
                          
                          {/* Etichetta */}
                          {width > 60 && (
                            <div className="absolute left-0 right-0 top-0 bottom-0 flex items-center px-2">
                              <span className="text-white text-[10px] font-medium truncate drop-shadow-sm">{task.name}</span>
                            </div>
                          )}
                          
                          {/* Indicatore errore */}
                          {hasError && (
                            <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-white/30 rounded-full animate-pulse" />
                          )}
                        </div>
                      </div>
                    </Tippy>
                  );
                })}

                {/* Indicatore giorno selezionato */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/60 via-primary to-primary/60 z-10 pointer-events-none shadow-sm"
                  style={{ left: `${sliderValue * DAY_WIDTH + DAY_WIDTH/2 - 1}px` }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100/30">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/60 rounded-md text-slate-600 hover:text-primary transition-all duration-200 hover:shadow-sm group"
              onClick={() => updateDateRange(Math.max(0, sliderValue - 1), onDateRangeChange)}
            >
              <Lucide icon="ChevronLeft" className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform duration-200" />
              <span className="text-xs font-medium">Precedente</span>
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/70 rounded-md border border-slate-200/50 shadow-sm">
              <Lucide icon="Calendar" className="w-3.5 h-3.5 text-primary" />
              <div className="text-xs text-slate-700 font-semibold">
                {selectedDate.format("dddd, D MMMM YYYY")}
              </div>
            </div>

            <button
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/60 rounded-md text-slate-600 hover:text-primary transition-all duration-200 hover:shadow-sm group"
              onClick={() => updateDateRange(Math.min(range - 1, sliderValue + 1), onDateRangeChange)}
            >
              <span className="text-xs font-medium">Successivo</span>
              <Lucide icon="ChevronRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TimeLinePromo;