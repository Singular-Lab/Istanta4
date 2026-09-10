import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useRef,
  useEffect,
} from "react";
import dayjs from "dayjs";
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localeData from 'dayjs/plugin/localeData';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/it';
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(localeData);
dayjs.extend(relativeTime);
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.locale('it');

/* ------------------------------------------------------------------
   1) CONTEXT
------------------------------------------------------------------ */

interface TimelineContextType {
  today: dayjs.Dayjs;
  range: number;
  sliderValue: number;
  setSliderValue: React.Dispatch<React.SetStateAction<number>>;
  selectedDate: dayjs.Dayjs;
  setSelectedDate: React.Dispatch<React.SetStateAction<dayjs.Dayjs>>;
  dates: dayjs.Dayjs[];
  updateDateRange: (
    value: number,
    onDateRangeChange?: (arg0: string[]) => void
  ) => void;
  dateRange: string[];
  numeroRefPromo: Array<{
    idPromo: string;
    numeroRefPromo: number;
  }>;
  setNumeroRefPromo: React.Dispatch<React.SetStateAction<Array<{ idPromo: string; numeroRefPromo: number }>>>;
}

const TimelineContext = createContext<TimelineContextType | null>(null);

interface TimelineProviderProps {
  range: number; // Numero di giorni totali
  children: React.ReactNode;
}

export const TimelineProvider: React.FC<TimelineProviderProps> = ({
  range,
  children,
}) => {
  dayjs.locale("it");
  const today = dayjs().startOf("day");
  const [sliderValue, setSliderValue] = useState(0);
  const [numeroRefPromo, setNumeroRefPromo] = useState<Array<{ idPromo: string; numeroRefPromo: number }>>([]);
  // Costruiamo l'array di date
  const dates = useMemo(() => {
    return Array.from({ length: range }, (_, i) =>
      today.clone().add(i, "days")
    );
  }, [range, today]);
  // FAI IN MODO CHE IL CAMBIO DI DATA METTA NEI PARAMETRI DELLA URL LA DATA
 
  const [selectedDate, setSelectedDate] = useState(today);
  const [dateRange, setDateRange] = useState<string[]>([
    today.format("YYYY-MM-DD"),
    dates[0].format("YYYY-MM-DD"),
  ]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Aggiorna il range delle date selezionate (debounce)
  const updateDateRange = (
    value: number,
    onDateRangeChange?: (arg0: string[]) => void
  ) => {
    setSliderValue(value);
    setSelectedDate(dates[value]);

    const newRange = [
      today.format("YYYY-MM-DD"),
      dates[value].format("YYYY-MM-DD"),
    ];

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }



    timeoutRef.current = setTimeout(() => {
      setDateRange(newRange);
      if (onDateRangeChange) onDateRangeChange(newRange);
    }, 200);
  };

  const value = {
    numeroRefPromo,
    setNumeroRefPromo,
    today,
    range,
    sliderValue,
    setSliderValue,
    selectedDate,
    setSelectedDate,
    dates,
    dateRange,
    updateDateRange,
  };
  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  );
};

export const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error(
      "useTimeline deve essere utilizzato all'interno di un TimelineProvider"
    );
  }
  return context;
};
