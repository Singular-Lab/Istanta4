import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { ColorStrategy, MappaConfig, ReferenzaPosizione } from "@/types/flyerInsights";
import { resolveColor } from "@/utils/flyerInsightsHelpers";
import clsx from "clsx";
import { FC, memo, useCallback, useMemo, useState } from "react";

interface Props {
  referenze: ReferenzaPosizione[];
  paginaCorrente: number;
  onChangePage: (page: number) => void;
  totalePagine: number;
  config?: MappaConfig;
  repartiColorStrategy?: ColorStrategy;
}

// Colori di fallback per reparto (usati se non c'è config)
const FALLBACK_COLORS: Record<string, { hex: string; label: string }> = {
  'FR': { hex: '#22c55e', label: 'Frutta' },
  'OF': { hex: '#f97316', label: 'Ortofrutta' },
  'LA': { hex: '#3b82f6', label: 'Latticini' },
  'CA': { hex: '#ef4444', label: 'Carni' },
  'PE': { hex: '#06b6d4', label: 'Pesce' },
  'SU': { hex: '#8b5cf6', label: 'Surgelati' },
  'PA': { hex: '#eab308', label: 'Panetteria' },
  'BE': { hex: '#84cc16', label: 'Bevande' },
  'DAL': { hex: '#ec4899', label: 'Drogheria Alimentare' },
  'BV': { hex: '#84cc16', label: 'Bevande' },
  'SG': { hex: '#8b5cf6', label: 'Surgelati' },
  'LS': { hex: '#3b82f6', label: 'Latticini' },
  'EX': { hex: '#c084fc', label: 'Bazar' },
  'DEFAULT': { hex: '#64748b', label: 'Altro' },
};

// Calcola quale spread contiene una pagina
// Spread 0: pagina 1 (copertina)
// Spread 1: pagine 2-3
// Spread 2: pagine 4-5
// etc.
const getSpreadForPage = (page: number): number => {
  if (page === 1) return 0;
  return Math.ceil((page - 1) / 2);
};

// Calcola le pagine in uno spread
const getPagesInSpread = (spread: number, totalPages: number): { left: number | null; right: number | null } => {
  if (spread === 0) {
    // Copertina: solo pagina destra
    return { left: null, right: 1 };
  }

  const leftPage = spread * 2;
  const rightPage = spread * 2 + 1;

  return {
    left: leftPage <= totalPages ? leftPage : null,
    right: rightPage <= totalPages ? rightPage : null
  };
};

// Calcola il numero totale di spread
const getTotalSpreads = (totalPages: number): number => {
  if (totalPages <= 1) return 1;
  return Math.ceil(totalPages / 2);
};

// Componente per renderizzare una singola referenza
interface RefBoxProps {
  ref_data: ReferenzaPosizione;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  pagePosition: 'left' | 'right' | 'single';
  getColorFn: (reparto: string) => string;
}

const RefBox: FC<RefBoxProps> = memo(({ ref_data, isHovered, onMouseEnter, onMouseLeave, pagePosition, getColorFn }) => {
  if (!ref_data.posizione) return null;

  const { x, y, w, h, wPage, hPage } = ref_data.posizione;
  const effectiveX =
    pagePosition === 'right' || pagePosition === 'single'
      ? x - wPage
      : x;


  const leftPerc = (effectiveX / wPage) * 100;
  const topPerc = (y / hPage) * 100;
  const widthPerc = (w / wPage) * 100;
  const heightPerc = (h / hPage) * 100;

  return (
    <div
      className={clsx(
        "absolute rounded-sm cursor-pointer transition-opacity duration-150",
        isHovered ? "z-20 border-2 border-white shadow-lg opacity-100" : "border border-white/60 z-10 opacity-70 hover:opacity-90"
      )}
      style={{
        left: `${leftPerc}%`,
        top: `${topPerc}%`,
        width: `${widthPerc}%`,
        height: `${heightPerc}%`,
        backgroundColor: getColorFn(ref_data.reparto),
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
});

RefBox.displayName = 'RefBox';

// Componente per renderizzare una singola pagina
interface PageMapProps {
  pageNumber: number | null;
  referenze: ReferenzaPosizione[];
  hoveredRefId: string | null;
  onHoverRef: (refId: string | null) => void;
  position: 'left' | 'right' | 'single';
  pageDimensions: { width: number; height: number };
  getColorFn: (reparto: string) => string;
}

const PageMap: FC<PageMapProps> = memo(({ pageNumber, referenze, hoveredRefId, onHoverRef, position, pageDimensions, getColorFn }) => {
  const referenzePagina = useMemo(() => {
    if (pageNumber === null) return [];
    return referenze.filter(r => r.posizione && Number(r.posizione.pag) === pageNumber);
  }, [referenze, pageNumber]);

  const handleMouseEnter = useCallback((refId: string) => {
    onHoverRef(refId);
  }, [onHoverRef]);

  const handleMouseLeave = useCallback(() => {
    onHoverRef(null);
  }, [onHoverRef]);

  if (pageNumber === null) {
    // Placeholder per pagina vuota
    return (
      <div
        className={clsx(
          "relative rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center",
          position === 'left' && "rounded-r-none border-r-0",
          position === 'right' && "rounded-l-none border-l-0"
        )}
        style={{
          aspectRatio: `${pageDimensions.width} / ${pageDimensions.height}`,
          flex: 1
        }}
      >
        <span className="text-xs text-slate-300">-</span>
      </div>
    );
  }

  // Determina la classe del bordo in base alla posizione
  const borderClass = position === 'left'
    ? "rounded-r-none border-r"
    : position === 'right'
      ? "rounded-l-none border-l"
      : "";

  // Posizione del numero pagina e label
  const pageNumPosition = position === 'left' ? "right-1" : "left-1";
  const labelPosition = position === 'left' ? "left-1" : "right-1";
  const labelStyle = position === 'left'
    ? "bg-blue-100 text-blue-600"
    : "bg-green-100 text-green-600";
  const labelText = position === 'single' ? '' : (position === 'left' ? 'SX' : 'DX');

  return (
    <div
      className={clsx(
        "relative rounded-lg border-2 border-slate-300 bg-white shadow-inner overflow-hidden",
        borderClass
      )}
      style={{
        aspectRatio: `${pageDimensions.width} / ${pageDimensions.height}`,
        flex: 1
      }}
    >
      {/* Numero pagina */}
      <div className={clsx(
        "absolute top-1 z-30 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600",
        pageNumPosition
      )}>
        {pageNumber}
      </div>

      {/* Label sinistra/destra - non mostrato per single */}
      {position !== 'single' && (
        <div className={clsx(
          "absolute bottom-1 z-30 px-1.5 py-0.5 rounded text-[9px] font-medium",
          labelPosition,
          labelStyle
        )}>
          {labelText}
        </div>
      )}

      {/* Referenze */}
      {referenzePagina.map((ref, idx) => (
        <RefBox
          key={ref.id || `ref-${idx}`}
          ref_data={ref}
          isHovered={hoveredRefId === ref.id}
          onMouseEnter={() => handleMouseEnter(ref.id)}
          onMouseLeave={handleMouseLeave}
          pagePosition={position}
          getColorFn={getColorFn}
        />

      ))}

      {referenzePagina.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-300 pointer-events-none">
          <div className="text-center">
            <Lucide icon="FileX" className="mx-auto h-6 w-6 mb-1" />
            <p className="text-[10px]">Nessuna ref.</p>
          </div>
        </div>
      )}
    </div>
  );
});

PageMap.displayName = 'PageMap';

// Info panel per referenza hoveredata
interface RefInfoPanelProps {
  ref_data: ReferenzaPosizione | null;
  getColorFn: (reparto: string) => string;
  config?: MappaConfig;
}

const RefInfoPanel: FC<RefInfoPanelProps> = memo(({ ref_data, getColorFn, config }) => {
  if (!ref_data) {
    return (
      <div className="rounded-lg min-h-[14rem] border border-dashed border-slate-200 bg-slate-50/50 p-3 text-center">
        <Lucide icon="MousePointer2" className="mx-auto h-5 w-5 text-slate-400 mb-1" />
        <p className="text-[11px] text-slate-500">
          Passa sopra una referenza per vedere i dettagli
        </p>
      </div>
    );
  }

  const showPrice = config?.infoPanel?.showPrice !== false;
  const showMeccanica = config?.infoPanel?.showMeccanica !== false;
  const showIngombro = config?.infoPanel?.showIngombro !== false;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-800 mb-2 line-clamp-2">
        {ref_data.descrizione || 'Senza descrizione'}
      </p>
      <div className="space-y-1.5 text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <Lucide icon="Barcode" className="h-3 w-3" />
          <span>{ref_data.codiceReferenza || 'N/D'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-3 w-3 rounded"
            style={{ backgroundColor: getColorFn(ref_data.reparto) }}
          />
          <span>{ref_data.reparto} - {ref_data.descrizioneReparto || 'N/D'}</span>
        </div>
        {showMeccanica && (
          <div className="flex items-center gap-1.5">
            <Lucide icon="Tag" className="h-3 w-3" />
            <span>{ref_data.meccanica || 'N/D'}</span>
          </div>
        )}
        {showPrice && ref_data.prezzo && (
          <div className="flex items-center gap-1.5">
            <Lucide icon="Euro" className="h-3 w-3" />
            <span className="font-semibold text-green-600">{ref_data.prezzo}</span>
            {ref_data.prezzoAnziche && (
              <span className="line-through text-slate-400">{ref_data.prezzoAnziche}</span>
            )}
          </div>
        )}
        {ref_data.posizione && (
          <>
            <div className="flex items-center gap-1.5">
              <Lucide icon="FileText" className="h-3 w-3" />
              <span>Pagina {ref_data.posizione.pag}</span>
            </div>
            {showIngombro && (
              <div className="flex items-center gap-1.5">
                <Lucide icon="SquareStack" className="h-3 w-3" />
                <span>Ingombro: {(ref_data.posizione.percIngombro * 100).toFixed(1)}%</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

RefInfoPanel.displayName = 'RefInfoPanel';

const FlyerPageMap: FC<Props> = ({ referenze, paginaCorrente, onChangePage, totalePagine, config, repartiColorStrategy }) => {
  const [hoveredRefId, setHoveredRefId] = useState<string | null>(null);

  // Funzione per ottenere il colore in base alla config
  const getColor = useCallback((reparto: string): string => {
    const colorField = config?.colorField ?? 'sigla';
    const value = colorField === 'sigla' ? reparto.toUpperCase().substring(0, 3) : reparto;

    // Se colorSource è "reparti", usa la colorStrategy dei reparti
    if (config?.colorSource === 'reparti' && repartiColorStrategy) {
      return resolveColor(reparto, repartiColorStrategy).hex;
    }

    // Altrimenti usa la colorStrategy della mappa
    if (config?.colorStrategy?.map) {
      const entry = config.colorStrategy.map[value];
      if (entry) return entry.hex;
      return config.colorStrategy.default?.hex ?? FALLBACK_COLORS.DEFAULT.hex;
    }

    // Fallback ai colori hardcoded
    return FALLBACK_COLORS[value]?.hex ?? FALLBACK_COLORS.DEFAULT.hex;
  }, [config, repartiColorStrategy]);

  // Ottieni la mappa colori per la legenda
  const colorMap = useMemo(() => {
    if (config?.colorSource === 'reparti' && repartiColorStrategy?.type === 'static') {
      return Object.entries(repartiColorStrategy.map).map(([key, entry]) => ({
        sigla: key,
        hex: entry.hex,
        label: key
      }));
    }
    if (config?.colorStrategy?.map) {
      return Object.entries(config.colorStrategy.map).map(([sigla, entry]) => ({
        sigla,
        hex: entry.hex,
        label: entry.label ?? sigla
      }));
    }
    return Object.entries(FALLBACK_COLORS)
      .filter(([k]) => k !== 'DEFAULT')
      .map(([sigla, entry]) => ({ sigla, hex: entry.hex, label: entry.label }));
  }, [config, repartiColorStrategy]);

  // Calcola spread corrente dalla pagina corrente
  const currentSpread = useMemo(() => getSpreadForPage(paginaCorrente), [paginaCorrente]);
  const totalSpreads = useMemo(() => getTotalSpreads(totalePagine), [totalePagine]);
  const { left: leftPage, right: rightPage } = useMemo(
    () => getPagesInSpread(currentSpread, totalePagine),
    [currentSpread, totalePagine]
  );

  // Trova la referenza hovered
  const hoveredRef = useMemo(() => {
    if (!hoveredRefId) return null;
    return referenze.find(r => r.id === hoveredRefId) || null;
  }, [hoveredRefId, referenze]);

  // Trova le dimensioni della pagina dalla prima referenza con posizione
  const pageDimensions = useMemo(() => {
    const refWithPos = referenze.find(r => r.posizione);
    if (refWithPos?.posizione) {
      return {
        width: refWithPos.posizione.wPage,
        height: refWithPos.posizione.hPage
      };
    }
    // Usa le dimensioni di default dalla config o fallback A4
    return config?.display?.defaultPageDimensions ?? { width: 210, height: 297 };
  }, [referenze, config]);

  const goToPrevSpread = useCallback(() => {
    if (currentSpread > 0) {
      const prevSpread = currentSpread - 1;
      const { right } = getPagesInSpread(prevSpread, totalePagine);
      onChangePage(right || 1);
    }
  }, [currentSpread, totalePagine, onChangePage]);

  const goToNextSpread = useCallback(() => {
    if (currentSpread < totalSpreads - 1) {
      const nextSpread = currentSpread + 1;
      const { left, right } = getPagesInSpread(nextSpread, totalePagine);
      onChangePage(left || right || 1);
    }
  }, [currentSpread, totalSpreads, totalePagine, onChangePage]);

  const handleSpreadClick = useCallback((spreadIndex: number) => {
    const { left, right } = getPagesInSpread(spreadIndex, totalePagine);
    onChangePage(left || right || 1);
  }, [totalePagine, onChangePage]);

  // Label per lo spread corrente
  const spreadLabel = useMemo(() => {
    if (currentSpread === 0) {
      return "Copertina (pag. 1)";
    }
    if (leftPage && rightPage) {
      return `Pagine ${leftPage}-${rightPage}`;
    }
    if (leftPage) {
      return `Pagina ${leftPage}`;
    }
    if (rightPage) {
      return `Pagina ${rightPage}`;
    }
    return "";
  }, [currentSpread, leftPage, rightPage]);

  return (
    <div className="p-4">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-800">
          {config?.title ?? 'Mappa Volantino'} - {spreadLabel}
        </h4>
        <div className="flex items-center gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            disabled={currentSpread <= 0}
            onClick={goToPrevSpread}
          >
            <Lucide icon="ChevronLeft" className="h-4 w-4" />
          </Button>
          <span className="text-xs text-slate-600 px-2 min-w-[80px] text-center">
            {currentSpread + 1} / {totalSpreads}
          </span>
          <Button
            variant="outline-secondary"
            size="sm"
            disabled={currentSpread >= totalSpreads - 1}
            onClick={goToNextSpread}
          >
            <Lucide icon="ChevronRight" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Spread Container */}
      <div className="flex gap-4">
        {/* Spread (2 pages side by side) */}
        <div className="flex-1 flex justify-center">
          <div
            className="flex"
            style={{ maxWidth: config?.display?.maxSpreadWidth ?? 600 }}
          >
            {currentSpread === 0 ? (
              // Copertina: solo pagina 1 centrata
              <div className="flex justify-center w-full">
                <div style={{ width: '50%' }}>
                  <PageMap
                    pageNumber={1}
                    referenze={referenze}
                    hoveredRefId={hoveredRefId}
                    onHoverRef={setHoveredRefId}
                    position="single"
                    pageDimensions={pageDimensions}
                    getColorFn={getColor}
                  />
                </div>
              </div>
            ) : (
              // Spread normale: sinistra + destra
              <>
                <PageMap
                  pageNumber={leftPage}
                  referenze={referenze}
                  hoveredRefId={hoveredRefId}
                  onHoverRef={setHoveredRefId}
                  position="left"
                  pageDimensions={pageDimensions}
                  getColorFn={getColor}
                />
                <PageMap
                  pageNumber={rightPage}
                  referenze={referenze}
                  hoveredRefId={hoveredRefId}
                  onHoverRef={setHoveredRefId}
                  position="right"
                  pageDimensions={pageDimensions}
                  getColorFn={getColor}
                />
              </>
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div style={{ width: config?.infoPanel?.width ?? 192 }} className="shrink-0">
          <RefInfoPanel ref_data={hoveredRef} getColorFn={getColor} config={config} />

          {/* Mini navigation */}
          {config?.display?.showMiniNavigation !== false && (
            <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[10px] text-slate-500 mb-2 font-medium">Vai a spread:</p>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: totalSpreads }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => handleSpreadClick(i)}
                    className={clsx(
                      "w-6 h-6 rounded text-[10px] font-semibold transition-colors",
                      i === currentSpread
                        ? "bg-primary text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      {config?.display?.showLegend !== false && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {colorMap.map(({ sigla, hex, label }) => (
            <div key={sigla} className="flex items-center gap-1 text-[10px] text-slate-600">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: hex }} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Info totali */}
      {config?.display?.showTotalInfo !== false && (
        <div className="mt-3 text-center text-[11px] text-slate-500">
          Totale: {totalePagine} pagine ({totalSpreads} spread)
        </div>
      )}
    </div>
  );
};

export default FlyerPageMap;
