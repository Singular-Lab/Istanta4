import Chart from "@/components/Base/Chart";
import Lucide from "@/components/Base/Lucide";
import { RiepilogoReparto, RiepilogoSectionConfig } from "@/types/flyerInsights";
import { getColor } from "@/utils/colors";
import { resolveColor, formatTooltip } from "@/utils/flyerInsightsHelpers";
import { selectDarkMode } from "@/stores/darkModeSlice";
import { useAppSelector } from "@/stores/hooks";
import { ChartData, ChartOptions } from "chart.js/auto";
import { FC, useMemo } from "react";

interface Props {
  riepilogo: RiepilogoReparto[];
  config: RiepilogoSectionConfig;
}

const RiepilogoReparti: FC<Props> = ({ riepilogo, config }) => {
  const darkMode = useAppSelector(selectDarkMode);
  const { chart, colorStrategy, fields, display, emptyState } = config;

  const getChartColor = (sigla: string) => {
    return colorStrategy ? resolveColor(sigla, colorStrategy).hex : '#64748b';
  };

  const getColorClass = (sigla: string) => {
    return colorStrategy ? resolveColor(sigla, colorStrategy).tw : 'bg-slate-100 text-slate-700';
  };

  const getColorKey = (rep: RiepilogoReparto): string => {
    // Use colorField if specified, otherwise fall back to badgeField or labelField
    const colorField = fields.colorField ?? fields.badgeField ?? fields.labelField;
    return (rep as any)[colorField] ?? '';
  };

  const chartData: ChartData = useMemo(() => {
    const labels = riepilogo.map(r =>
      (r as any)[fields.labelField] || (fields.labelFallback ? (r as any)[fields.labelFallback] : '')
    );
    const data = riepilogo.map(r => (r as any)[fields.valueField]);
    const colors = riepilogo.map(r => getChartColor(getColorKey(r)));

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          hoverBackgroundColor: colors,
          borderWidth: 3,
          borderColor: darkMode ? getColor("darkmode.700") : getColor("white"),
        },
      ],
    };
  }, [riepilogo, darkMode, config]);

  const chartOptions: ChartOptions = useMemo(() => {
    return {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: display.showLegend,
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const total = riepilogo.reduce((acc, r) => acc + (r as any)[fields.valueField], 0);
              const value = context.raw as number;
              const percentage = (value / total) * 100;
              return display.tooltipFormat
                ? formatTooltip(display.tooltipFormat, value, percentage)
                : `${value} (${percentage.toFixed(1)}%)`;
            }
          }
        }
      },
      cutout: chart.cutout,
    };
  }, [riepilogo, config]);

  if (riepilogo.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <Lucide icon={emptyState.icon as any} className="mx-auto h-8 w-8 mb-2 text-slate-400" />
        <p className="text-sm">{emptyState.message}</p>
      </div>
    );
  }

  const totaleReferenze = riepilogo.reduce((acc, r) => acc + (r as any)[fields.valueField], 0);

  return (
    <div className="p-4">
      <h4 className="text-sm font-semibold text-slate-800 mb-4">{config.title}</h4>

      <div className="flex gap-6">
        {/* Donut Chart */}
        <div className="relative flex-shrink-0" style={{ width: chart.width, height: chart.height }}>
          <Chart
            type={chart.type as any}
            width={chart.width}
            height={chart.height}
            data={chartData}
            options={chartOptions}
          />
          {display.centerLabel && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-800">{totaleReferenze}</span>
              <span className="text-[10px] text-slate-500">{display.centerLabel.label}</span>
            </div>
          )}
        </div>

        {/* Lista reparti */}
        <div
          className="flex-1 space-y-2 overflow-y-auto"
          style={{ maxHeight: display.listMaxHeight }}
        >
          {riepilogo.map(rep => {
            const badgeValue = fields.badgeField ? (rep as any)[fields.badgeField] : '';
            const label = (rep as any)[fields.labelField] || (fields.labelFallback ? (rep as any)[fields.labelFallback] : '');
            const value = (rep as any)[fields.valueField] as number;
            const percentage = ((value / totaleReferenze) * 100).toFixed(1);
            const colorKey = getColorKey(rep);
            return (
              <div
                key={badgeValue || label}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: getChartColor(colorKey) }}
                  />
                  {fields.badgeField && (
                    <div className={`flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold ${getColorClass(colorKey)}`}>
                      {badgeValue.substring(0, fields.badgeMaxChars ?? 3)}
                    </div>
                  )}
                  <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-800">{value}</span>
                  <span className="text-slate-400">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RiepilogoReparti;
