import clsx from "clsx";
import { twMerge } from "tailwind-merge";

type ProgressSegment = {
  value: number; // valore in percentuale per questo segmento
  color: string; // classe CSS per il colore (es. "bg-blue-500", "bg-red-400")
  label?: string; // etichetta opzionale per questo segmento
};

type ProgressProps = React.ComponentPropsWithoutRef<"div"> & {
  // Per compatibilità con la versione precedente
  progress?: number;
  // Nuova prop per segmenti multipli
  segments?: ProgressSegment[];
  // Stili
  classNameProgress?: string;
  // Controllo del testo
  showText?: boolean;
  textContent?: string | ((totalProgress: number, segments?: ProgressSegment[]) => string);
  textClassName?: string;
};

function Progress({ 
  progress, 
  segments,
  className,
  classNameProgress, 
  showText = true,
  textContent,
  textClassName,
  ...props 
}: ProgressProps) {
  // Calcola il progresso totale
  const totalProgress = segments 
    ? segments.reduce((sum, segment) => sum + segment.value, 0)
    : progress || 0;

  // Genera il contenuto del testo
  const getTextContent = () => {
    if (!showText) return null;
    
    if (textContent) {
      return typeof textContent === 'function' 
        ? textContent(totalProgress, segments)
        : textContent;
    }
    
    return `${Math.round(totalProgress)}%`;
  };

  return (
    <div
      {...props}
      className={twMerge([
        "relative w-full h-2 bg-slate-200 rounded dark:bg-black/20",
        className,
      ])}
    >
      {/* Rendering per segmenti multipli */}
      {segments ? (
        <>
          {segments.map((segment, index) => {
            // Calcola la posizione di partenza di questo segmento
            const startPosition = segments
              .slice(0, index)
              .reduce((sum, prevSegment) => sum + prevSegment.value, 0);
            
            return (
              <div
                key={index}
                style={{ 
                  left: `${startPosition}%`,
                  width: `${segment.value}%` 
                }}
                className={clsx(
                  "absolute top-0 h-full rounded-sm",
                  segment.color,
                  // Arrotonda solo i bordi esterni
                  index === 0 && "rounded-l",
                  index === segments.length - 1 && "rounded-r"
                )}
                title={segment.label}
              />
            );
          })}
        </>
      ) : (
        /* Rendering per progresso singolo (compatibilità) */
        <div
          style={{ width: `${progress}%` }}
          className={clsx(
            "absolute top-0 left-0 h-full bg-primary rounded",
            classNameProgress
          )}
        />
      )}

      {/* Testo della percentuale (opzionale) */}
      {showText && (
        <span className={clsx(
          "absolute inset-0 flex items-center justify-center text-xs text-white font-medium drop-shadow-sm",
          textClassName
        )}>
          {getTextContent()}
        </span>
      )}
    </div>
  );
}

export default Progress;

// Esempi di utilizzo:

// 1. Uso semplice (compatibile con versione precedente)
// <Progress progress={75} />

// 2. Con testo personalizzato
// <Progress progress={75} textContent="3 su 4 completati" />

// 3. Senza testo
// <Progress progress={75} showText={false} />

// 4. Con segmenti multipli
// <Progress 
//   segments={[
//     { value: 30, color: "bg-green-500", label: "Completato" },
//     { value: 20, color: "bg-yellow-500", label: "In corso" },
//     { value: 10, color: "bg-red-500", label: "Errori" }
//   ]}
// />

// 5. Con testo personalizzato per segmenti
// <Progress 
//   segments={[
//     { value: 30, color: "bg-green-500", label: "Completato" },
//     { value: 20, color: "bg-yellow-500", label: "In corso" }
//   ]}
//   textContent={(total, segs) => `${total}% (${segs?.length} categorie)`}
// />