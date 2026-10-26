import Chart from "@/components/Base/Chart";
import Lucide from "@/components/Base/Lucide";
import { RiepilogoMeccanica, RiepilogoSectionConfig } from "@/types/flyerInsights";
import { getColor } from "@/utils/colors";
import { resolveColor, formatTooltip } from "@/utils/flyerInsightsHelpers";
import { selectDarkMode } from "@/stores/darkModeSlice";
import { useAppSelector } from "@/stores/hooks";
import { ChartData, ChartOptions } from "chart.js/auto";
import { FC, useMemo } from "react";

interface Props {
  riepilogo: RiepilogoMeccanica[];
  config: RiepilogoSectionConfig;
}

const RiepilogoMeccaniche: FC<Props> = ({ riepilogo, config }) => {
  const darkMode = useAppSelector(selectDarkMode);
  const { chart, colorStrategy, fields, display, emptyState } = config;

  const getChartColor = (value: string) => {
    return colorStrategy ? resolveColor(value, colorStrategy).hex : '#64748b';
  };

  const getColorClass = (value: string) => {
    return colorStrategy ? resolveColor(value, colorStrategy).tw : 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const chartData: ChartData = useMemo(() => {
    const labels = riepilogo.map(m =>
      (m as any)[fields.labelField] || fields.labelFallback || ''
    );
    const data = riepilogo.map(m => (m as any)[fields.valueField]);
    const colors = riepilogo.map(m => getChartColor((m as any)[fields.labelField] || ''));

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          hoverBackgroundColor: colors.map(c => c + 'dd'),
          borderRadius: chart.borderRadius ?? 4,
          barThickness: chart.barThickness,
        },
      ],
    };
  }, [riepilogo, config]);

  const chartOptions: ChartOptions = useMemo(() => {
    return {
      indexAxis: (chart.indexAxis ?? 'x') as 'x' | 'y',
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: display.showLegend,
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const item = riepilogo[context.dataIndex];
              const value = context.raw as number;
              const percentage = item.percentuale;
              return display.tooltipFormat
                ? formatTooltip(display.tooltipFormat, value, percentage)
                : `${value} (${percentage.toFixed(1)}%)`;
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
          grid: { display: false },
          border: { display: false },
          ticks: {
            font: { size: 11 },
            color: getColor("slate.600"),
          },
        },
      },
    };
  }, [riepilogo, darkMode, config]);

  if (riepilogo.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <Lucide icon={emptyState.icon as any} className="mx-auto h-8 w-8 mb-2 text-slate-400" />
        <p className="text-sm">{emptyState.message}</p>
      </div>
    );
  }

  const chartHeight = Math.max(
    chart.minHeight ?? 150,
    riepilogo.length * (chart.heightPerItem ?? 35)
  );

  return (
    <div className="p-4">
      <h4 className="text-sm font-semibold text-slate-800 mb-4">{config.title}</h4>

      <div className="grid grid-cols-2 gap-6">
        {/* Horizontal Bar Chart */}
        <div style={{ height: chartHeight }}>
          <Chart
            type={chart.type as any}
            width="auto"
            height={chartHeight}
            data={chartData}
            options={chartOptions}
          />
        </div>

        {/* Lista dettagliata */}
        <div
          className="space-y-2 overflow-y-auto"
          style={{ maxHeight: display.listMaxHeight }}
        >
          {riepilogo.map(mec => {
            const label = (mec as any)[fields.labelField] || fields.labelFallback || '';
            const colorClass = getColorClass(label);
            const chartColor = getChartColor(label);
            const value = (mec as any)[fields.valueField] as number;
            return (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: chartColor }}
                  />
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-800">{value}</span>
                  <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(mec.percentuale, 100)}%`,
                        backgroundColor: chartColor
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 w-10 text-right">{mec.percentuale.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RiepilogoMeccaniche;
