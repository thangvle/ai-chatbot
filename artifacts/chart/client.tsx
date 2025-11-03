"use client";

/**
 * Chart Artifact for CSV Data Visualization
 * Displays interactive charts generated from CSV analysis
 */

import { toast } from "sonner";
import { Artifact } from "@/components/artifact/create-artifact";
import {
  CopyIcon,
  DownloadIcon,
  LineChartIcon,
  RedoIcon,
  UndoIcon,
} from "@/components/shared/icons";

// No special metadata needed for charts
type ChartArtifactMetadata = Record<string, never>;

export const chartArtifact = new Artifact<"chart", ChartArtifactMetadata>({
  kind: "chart",
  description: "Interactive data visualization from CSV analysis",
  content: ChartArtifactContent,
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "View previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy chart data to clipboard",
      onClick: ({ content }) => {
        try {
          const chartConfig = JSON.parse(content);
          navigator.clipboard.writeText(JSON.stringify(chartConfig, null, 2));
          toast.success("Chart data copied to clipboard!");
        } catch (error) {
          toast.error("Failed to copy chart data");
        }
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: "Download chart as JSON",
      onClick: ({ content }) => {
        try {
          const chartConfig = JSON.parse(content);
          const blob = new Blob([JSON.stringify(chartConfig, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `chart-${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("Chart data downloaded!");
        } catch (error) {
          toast.error("Failed to download chart data");
        }
      },
    },
  ],
  toolbar: [
    {
      icon: <LineChartIcon size={18} />,
      description: "Chart visualization",
      onClick: () => {
        // Placeholder for potential chart type switching
      },
    },
  ],
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-chartDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        // Replace content instead of concatenating since we send complete JSON in one delta
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
});

/**
 * Chart Artifact Content Component
 * Renders chart visualizations from CSV data
 */
function ChartArtifactContent({
  content,
  status,
  isLoading,
}: {
  content: string;
  status: "streaming" | "idle";
  isLoading: boolean;
}) {
  if (isLoading || (!content && status === "streaming")) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="space-y-4 text-center text-muted-foreground">
          <div className="text-lg">Generating chart...</div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  if (!content || content.trim() === "") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          No chart data available
        </div>
      </div>
    );
  }

  try {
    // Parse the chart configuration
    const chartConfig = JSON.parse(content);

    return (
      <div className="flex h-full flex-col gap-4 p-8">
        {/* Chart Title */}
        {chartConfig.title && (
          <h2 className="font-semibold text-2xl">{chartConfig.title}</h2>
        )}

        {/* Chart Container */}
        <div className="flex-1 rounded-lg border bg-card p-6">
          <ChartRenderer config={chartConfig} />
        </div>

        {/* Chart Info */}
        <div className="text-muted-foreground text-sm">
          Chart Type: {chartConfig.type}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center text-destructive">
          <div className="font-semibold text-lg">Failed to render chart</div>
          <div className="mt-2 text-sm">
            {error instanceof Error ? error.message : "Invalid chart data"}
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Chart Renderer Component
 * Renders different chart types using HTML/CSS/SVG
 */
function ChartRenderer({ config }: { config: any }) {
  const { type, data } = config;

  switch (type) {
    case "column":
    case "bar":
      return <BarChart data={data} />;
    case "line":
      return <LineChart data={data} />;
    case "pie":
      return <PieChart data={data} />;
    case "scatter":
      return <ScatterChart data={data} />;
    case "histogram":
      return <BarChart data={data} />;
    case "area":
      return <AreaChart data={data} />;
    default:
      return <SimpleDataDisplay data={data} />;
  }
}

/**
 * Enhanced Bar Chart Component with improved visuals
 */
function BarChart({ data }: { data: any }) {
  if (!data.labels || !data.datasets) {
    return <div>Invalid bar chart data</div>;
  }

  const maxValue = Math.max(
    ...data.datasets.flatMap((ds: any) => ds.data as number[])
  );

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Chart Area with Grid */}
      <div className="relative flex flex-1 items-end gap-2">
        {/* Y-axis grid lines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => (
            <div className="flex items-center border-muted border-t" key={i}>
              <span className="-ml-12 text-muted-foreground text-xs">
                {(maxValue * (1 - tick)).toFixed(0)}
              </span>
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="flex flex-1 items-end gap-2 pl-12">
          {data.labels.map((label: string, index: number) => (
            <div
              className="flex flex-1 flex-col items-center gap-2"
              key={index}
            >
              {/* Bar Stack */}
              <div className="flex h-full w-full flex-col-reverse justify-end gap-1">
                {data.datasets.map((dataset: any, dsIndex: number) => {
                  const value = dataset.data[index];
                  const heightPercent = (value / maxValue) * 100;

                  return (
                    <div
                      className="group relative w-full cursor-pointer rounded-t transition-all hover:opacity-90"
                      key={dsIndex}
                      style={{
                        height: `${heightPercent}%`,
                        minHeight: value > 0 ? "24px" : "0px",
                        backgroundColor: dataset.backgroundColor || "#3b82f6",
                      }}
                      title={`${dataset.label}: ${value}`}
                    >
                      {/* Value label on hover */}
                      <span className="-top-6 -translate-x-1/2 absolute left-1/2 rounded bg-background px-1 font-medium text-xs opacity-0 transition-opacity group-hover:opacity-100">
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* X-axis Label */}
              <div
                className="w-full truncate text-center font-medium text-xs"
                title={label}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      {data.datasets.length > 1 && (
        <div className="flex flex-wrap justify-center gap-4">
          {data.datasets.map((dataset: any, index: number) => (
            <div className="flex items-center gap-2" key={index}>
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: dataset.backgroundColor }}
              />
              <span className="text-sm">{dataset.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Enhanced Line Chart Component with SVG path
 */
function LineChart({ data }: { data: any }) {
  if (!data.labels || !data.datasets) {
    return <div>Invalid line chart data</div>;
  }

  const maxValue = Math.max(
    ...data.datasets.flatMap((ds: any) => ds.data as number[])
  );
  const minValue = Math.min(
    ...data.datasets.flatMap((ds: any) => ds.data as number[])
  );
  const range = maxValue - minValue || 1;

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Chart Area */}
      <div className="relative flex-1">
        {/* Y-axis grid */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => (
            <div className="flex items-center border-muted border-t" key={i}>
              <span className="-ml-12 text-muted-foreground text-xs">
                {(maxValue - range * tick).toFixed(1)}
              </span>
            </div>
          ))}
        </div>

        {/* SVG Line Chart */}
        <svg
          className="h-full w-full pl-12"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {data.datasets.map((dataset: any, dsIndex: number) => {
            const points = dataset.data.map((value: number, i: number) => {
              const x = (i / (dataset.data.length - 1)) * 100;
              const y = 100 - ((value - minValue) / range) * 100;
              return `${x},${y}`;
            });

            return (
              <g key={dsIndex}>
                {/* Line */}
                <polyline
                  className="transition-all"
                  fill="none"
                  points={points.join(" ")}
                  stroke={
                    dataset.borderColor || dataset.backgroundColor || "#3b82f6"
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="0.5"
                />
                {/* Data points */}
                {dataset.data.map((value: number, i: number) => {
                  const x = (i / (dataset.data.length - 1)) * 100;
                  const y = 100 - ((value - minValue) / range) * 100;
                  return (
                    <circle
                      className="hover:r-2 cursor-pointer transition-all"
                      cx={x}
                      cy={y}
                      fill={dataset.backgroundColor || "#3b82f6"}
                      key={i}
                      r="1"
                    >
                      <title>{`${data.labels[i]}: ${value}`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="mt-2 flex justify-between pl-12">
          {data.labels.map((label: string, i: number) => {
            // Show only first, middle, and last labels to avoid clutter
            if (
              i === 0 ||
              i === Math.floor(data.labels.length / 2) ||
              i === data.labels.length - 1
            ) {
              return (
                <span
                  className="truncate text-muted-foreground text-xs"
                  key={i}
                >
                  {label}
                </span>
              );
            }
            return null;
          })}
        </div>
      </div>

      {/* Legend */}
      {data.datasets.length > 1 && (
        <div className="flex flex-wrap justify-center gap-4">
          {data.datasets.map((dataset: any, index: number) => (
            <div className="flex items-center gap-2" key={index}>
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: dataset.backgroundColor }}
              />
              <span className="text-sm">{dataset.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Enhanced Pie Chart Component with SVG donut chart
 */
function PieChart({ data }: { data: any }) {
  if (!data.labels || !data.datasets || !data.datasets[0]) {
    return <div>Invalid pie chart data</div>;
  }

  const dataset = data.datasets[0];
  const total = dataset.data.reduce((sum: number, val: number) => sum + val, 0);

  // Create pie slices
  const slices = data.labels.map((label: string, index: number) => {
    const value = dataset.data[index];
    const percentage = (value / total) * 100;
    const color =
      dataset.backgroundColor?.[index] ||
      `hsl(${(index * 360) / data.labels.length}, 70%, 50%)`;
    return { label, value, percentage, color };
  });

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="flex w-full flex-1 items-center justify-center gap-8">
        {/* SVG Donut Chart */}
        <svg className="h-64 w-64" viewBox="0 0 100 100">
          {(() => {
            let currentAngle = -90; // Start from top
            return slices.map(
              (
                slice: {
                  label: string;
                  value: number;
                  percentage: number;
                  color: string;
                },
                index: number
              ) => {
                const angle = (slice.percentage / 100) * 360;
                const startAngle = currentAngle;
                currentAngle += angle;

                // Calculate path for donut slice
                const radius = 40;
                const innerRadius = 25;
                const centerX = 50;
                const centerY = 50;

                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (currentAngle * Math.PI) / 180;

                const x1 = centerX + radius * Math.cos(startRad);
                const y1 = centerY + radius * Math.sin(startRad);
                const x2 = centerX + radius * Math.cos(endRad);
                const y2 = centerY + radius * Math.sin(endRad);
                const x3 = centerX + innerRadius * Math.cos(endRad);
                const y3 = centerY + innerRadius * Math.sin(endRad);
                const x4 = centerX + innerRadius * Math.cos(startRad);
                const y4 = centerY + innerRadius * Math.sin(startRad);

                const largeArc = angle > 180 ? 1 : 0;

                const pathData = [
                  `M ${x1} ${y1}`,
                  `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                  `L ${x3} ${y3}`,
                  `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
                  "Z",
                ].join(" ");

                return (
                  <path
                    className="cursor-pointer transition-all hover:opacity-80"
                    d={pathData}
                    fill={slice.color}
                    key={index}
                    stroke="white"
                    strokeWidth="0.5"
                  >
                    <title>{`${slice.label}: ${slice.value} (${slice.percentage.toFixed(1)}%)`}</title>
                  </path>
                );
              }
            );
          })()}

          {/* Center text */}
          <text
            className="fill-current font-semibold text-sm"
            dominantBaseline="middle"
            textAnchor="middle"
            x="50"
            y="50"
          >
            Total
          </text>
          <text
            className="fill-muted-foreground text-xs"
            dominantBaseline="middle"
            textAnchor="middle"
            x="50"
            y="58"
          >
            {total}
          </text>
        </svg>

        {/* Legend */}
        <div className="grid max-w-xs gap-3">
          {slices.map(
            (
              slice: {
                label: string;
                value: number;
                percentage: number;
                color: string;
              },
              index: number
            ) => (
              <div
                className="group flex cursor-pointer items-center gap-3"
                key={index}
              >
                <div
                  className="h-4 w-4 flex-shrink-0 rounded-sm transition-transform group-hover:scale-110"
                  style={{ backgroundColor: slice.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-sm">
                    {slice.label}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {slice.value} ({slice.percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Enhanced Scatter Chart Component with grid and axes
 */
function ScatterChart({ data }: { data: any }) {
  if (!data.datasets || !data.datasets[0]) {
    return <div>Invalid scatter chart data</div>;
  }

  const dataset = data.datasets[0];
  const points = dataset.data;

  const xValues = points.map((p: any) => p.x);
  const yValues = points.map((p: any) => p.y);

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Chart Area */}
      <div className="relative flex-1">
        {/* Grid lines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pl-12">
          {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => (
            <div className="flex items-center border-muted border-t" key={i}>
              <span className="-ml-12 text-muted-foreground text-xs">
                {(maxY - yRange * tick).toFixed(1)}
              </span>
            </div>
          ))}
        </div>

        {/* Scatter points */}
        <div className="relative h-full border-b border-l pb-6 pl-12">
          {points.map((point: any, index: number) => {
            const xPercent = ((point.x - minX) / xRange) * 100;
            const yPercent = ((point.y - minY) / yRange) * 100;

            return (
              <div
                className="group -translate-x-1.5 -translate-y-1.5 absolute h-3 w-3 cursor-pointer rounded-full transition-all hover:scale-150"
                key={index}
                style={{
                  left: `${xPercent}%`,
                  bottom: `${yPercent}%`,
                  backgroundColor: dataset.backgroundColor || "#3b82f6",
                }}
                title={`(${point.x}, ${point.y})`}
              >
                <span className="absolute top-0 left-4 whitespace-nowrap rounded bg-background px-1 text-xs opacity-0 group-hover:opacity-100">
                  ({point.x}, {point.y})
                </span>
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between pl-12">
          <span className="text-muted-foreground text-xs">
            {minX.toFixed(1)}
          </span>
          <span className="text-muted-foreground text-xs">
            {((minX + maxX) / 2).toFixed(1)}
          </span>
          <span className="text-muted-foreground text-xs">
            {maxX.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Dataset label */}
      <div className="text-center font-medium text-muted-foreground text-sm">
        {dataset.label}
      </div>
    </div>
  );
}

/**
 * Enhanced Area Chart Component with filled areas
 */
function AreaChart({ data }: { data: any }) {
  if (!data.labels || !data.datasets) {
    return <div>Invalid area chart data</div>;
  }

  const maxValue = Math.max(
    ...data.datasets.flatMap((ds: any) => ds.data as number[])
  );
  const minValue = Math.min(
    ...data.datasets.flatMap((ds: any) => ds.data as number[])
  );
  const range = maxValue - minValue || 1;

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Chart Area */}
      <div className="relative flex-1">
        {/* Y-axis grid */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => (
            <div className="flex items-center border-muted border-t" key={i}>
              <span className="-ml-12 text-muted-foreground text-xs">
                {(maxValue - range * tick).toFixed(1)}
              </span>
            </div>
          ))}
        </div>

        {/* SVG Area Chart */}
        <svg
          className="h-full w-full pl-12"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {data.datasets.map((dataset: any, dsIndex: number) => {
            // Create line points
            const linePoints = dataset.data.map((value: number, i: number) => {
              const x = (i / (dataset.data.length - 1)) * 100;
              const y = 100 - ((value - minValue) / range) * 100;
              return `${x},${y}`;
            });

            // Create area path (includes baseline)
            const areaPath = [
              "M 0,100", // Start at bottom left
              ...dataset.data.map((value: number, i: number) => {
                const x = (i / (dataset.data.length - 1)) * 100;
                const y = 100 - ((value - minValue) / range) * 100;
                return `L ${x},${y}`;
              }),
              "L 100,100", // End at bottom right
              "Z",
            ].join(" ");

            const baseColor = dataset.backgroundColor || "#3b82f6";
            const fillColor = baseColor.includes("hsl")
              ? baseColor.replace("50%)", "50%, 0.2)")
              : baseColor + "33"; // Add alpha for transparency

            return (
              <g key={dsIndex}>
                {/* Filled area */}
                <path
                  className="transition-all"
                  d={areaPath}
                  fill={fillColor}
                />
                {/* Line */}
                <polyline
                  className="transition-all"
                  fill="none"
                  points={linePoints.join(" ")}
                  stroke={dataset.borderColor || baseColor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="0.5"
                />
                {/* Data points */}
                {dataset.data.map((value: number, i: number) => {
                  const x = (i / (dataset.data.length - 1)) * 100;
                  const y = 100 - ((value - minValue) / range) * 100;
                  return (
                    <circle
                      className="hover:r-2 cursor-pointer transition-all"
                      cx={x}
                      cy={y}
                      fill={baseColor}
                      key={i}
                      r="1"
                    >
                      <title>{`${data.labels[i]}: ${value}`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="mt-2 flex justify-between pl-12">
          {data.labels.map((label: string, i: number) => {
            if (
              i === 0 ||
              i === Math.floor(data.labels.length / 2) ||
              i === data.labels.length - 1
            ) {
              return (
                <span
                  className="truncate text-muted-foreground text-xs"
                  key={i}
                >
                  {label}
                </span>
              );
            }
            return null;
          })}
        </div>
      </div>

      {/* Legend */}
      {data.datasets.length > 1 && (
        <div className="flex flex-wrap justify-center gap-4">
          {data.datasets.map((dataset: any, index: number) => (
            <div className="flex items-center gap-2" key={index}>
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: dataset.backgroundColor }}
              />
              <span className="text-sm">{dataset.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Fallback: Simple Data Display
 */
function SimpleDataDisplay({ data }: { data: any }) {
  return (
    <div className="max-h-full overflow-auto">
      <pre className="rounded-lg bg-muted p-4 text-sm">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
