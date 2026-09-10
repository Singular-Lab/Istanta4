import Chart from "@/components/Base/Chart";
import Lucide from "@/components/Base/Lucide";
import { RiepilogoPagina, RiepilogoSectionConfig } from "@/types/flyerInsights";
import { getColor } from "@/utils/colors";
import { selectDarkMode } from "@/stores/darkModeSlice";
import { useAppSelector } from "@/stores/hooks";
import { ChartData, ChartOptions } from "chart.js/auto";
import clsx from "clsx";
import { FC, useMemo } from "react";

interface Props {
  riepilogo: RiepilogoPagina[];
  selectedPage: number | null;
  onSelectPage: (page: number | null) => void;
  config: RiepilogoSectionConfig;
}

const RiepilogoPagine: FC<Props> = ({ riepilogo, selectedPage, onSelectPage, config }) => {
  const darkMode = useAppSelector(selectDarkMode);
  const { chart, fields, display, emptyState } = config;

  const chartData: ChartData = useMemo(() => {
    const labels = riepilogo.map(p =>
      (fields.labelPrefix ?? '') + String((p as any)[fields.labelField])
    );
    const dataReferenze = riepilogo.map(p => (p as any)[fields.valueField]);

    const datasets: any[] = [
      {
        label: fields.valueLabel ?? 'Referenze',
        data: dataReferenze,
        backgroundColor: riepilogo.map(p =>
          p.pagina === selectedPage ? getColor("primary") : getColor("primary", 0.6)
        ),
        hoverBackgroundColor: getColor("primary"),
        borderRadius: chart.borderRadius ?? 4,
        barPercentage: chart.barPercentage ?? 0.7,
        yAxisID: 'y',
      },
    ];

    if (fields.secondaryValueField && chart.secondaryDataset) {
      const sd = chart.secondaryDataset;
      const dataSecondary = riepilogo.map(p => (p as any)[fields.secondaryValueField!]);
      datasets.push({
        label: fields.secondaryValueLabel ?? sd.label,
        data: dataSecondary,
        type: sd.type as any,
        borderColor: getColor("warning"),
        backgroundColor: getColor("warning", 0.1),
        borderWidth: sd.borderWidth,
        pointBackgroundColor: getColor("warning"),
        pointRadius: sd.pointRadius,
        pointHoverRadius: sd.pointHoverRadius,
        tension: sd.tension,
        fill: sd.fill,
        yAxisID: 'y1',
      });
    }

    return { labels, datasets };
  }, [riepilogo, selectedPage, config]);

  const chartOptions: ChartOptions = useMemo(() => {
    const opts: ChartOptions = {
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      onClick: (_event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const pagina = riepilogo[index]?.pagina;
          if (pagina !== undefined) {
            onSelectPage(pagina === selectedPage ? null : pagina);
          }
        }
      },
      plugins: {
        legend: {
          display: display.showLegend,
          position: (display.legendPosition ?? 'top') as any,
          align: 'end' as const,
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            padding: 15,
            font: { size: 11 },
            color: getColor("slate.600"),
          },
        },
        tooltip: {
          callbacks: {
            afterLabel: (context) => {
              if (context.datasetIndex === 0) {
                const pag = riepilogo[context.dataIndex];
                return `Reparti: ${pag.reparti.map(r => r.sigla).join(', ') || 'N/D'}`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            font: { size: 11 },
            color: getColor("slate.500", 0.8),
          },
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          title: {
            display: true,
            text: fields.valueLabel ?? 'Referenze',
            font: { size: 10 },
            color: getColor("slate.500"),
          },
          grid: {
            color: darkMode ? getColor("slate.500", 0.2) : getColor("slate.200"),
          },
          border: { display: false },
          ticks: {
            font: { size: 10 },
            color: getColor("slate.500", 0.8),
          },
        },
      },
    };

    if (fields.secondaryValueField) {
      (opts.scales as any).y1 = {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: fields.secondaryValueLabel ?? 'Ingombro %',
          font: { size: 10 },
          color: getColor("slate.500"),
        },
        grid: { display: false },
        border: { display: false },
        ticks: {
          font: { size: 10 },
          color: getColor("slate.500", 0.8),
          callback: (value: any) => `${value}%`,
        },
        min: 0,
        max: 100,
      };
    }

    return opts;
  }, [riepilogo, selectedPage, darkMode, onSelectPage, config]);

  if (riepilogo.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <Lucide icon={emptyState.icon as any} className="mx-auto h-8 w-8 mb-2 text-slate-400" />
        <p className="text-sm">{emptyState.message}</p>
      </div>
    );
  }

  const chartHeight = chart.height ?? 200;

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">{config.title}</h4>
        {selectedPage !== null && (
          <button
            onClick={() => onSelectPage(null)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Lucide icon="X" className="h-3 w-3" />
            Deseleziona pagina {selectedPage}
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="mb-4" style={{ height: chartHeight }}>
        <Chart
          type={chart.type as any}
          width="auto"
          height={chartHeight}
          data={chartData}
          options={chartOptions}
        />
      </div>

      {/* Lista pagine compatta */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-${display.listCols ?? 4} gap-2 overflow-y-auto`}
        style={{ maxHeight: display.listMaxHeight }}
      >
        {riepilogo.map(pag => (
          <button
            key={pag.pagina}
            onClick={() => onSelectPage(pag.pagina === selectedPage ? null : pag.pagina)}
            className={clsx(
              "flex items-center gap-2 rounded-lg border p-2 text-left transition",
              selectedPage === pag.pagina
                ? "border-primary bg-primary/5"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <div className={clsx(
              "flex h-7 w-7 items-center justify-center rounded text-xs font-bold",
              selectedPage === pag.pagina
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-700"
            )}>
              {pag.pagina}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-800">{pag.numeroReferenze} ref.</p>
              <p className="text-[10px] text-slate-500">{pag.ingombroTotalePerc.toFixed(0)}% ing.</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RiepilogoPagine;
