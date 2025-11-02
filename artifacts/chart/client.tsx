'use client';

/**
 * Chart Artifact for CSV Data Visualization
 * Displays interactive charts generated from CSV analysis
 */

import { Artifact } from '@/components/artifact/create-artifact';

// No special metadata needed for charts
type ChartArtifactMetadata = Record<string, never>;

export const chartArtifact = new Artifact<'chart', ChartArtifactMetadata>({
  kind: 'chart',
  description: 'Interactive data visualization from CSV analysis',
  content: ChartArtifactContent,
  actions: [],
  toolbar: [],
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'data-chartDelta') {
      setArtifact((draftArtifact) => {
        return {
          ...draftArtifact,
          content: draftArtifact.content + streamPart.data,
          isVisible: true,
        };
      });
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
  status: 'streaming' | 'idle';
  isLoading: boolean;
}) {
  if (isLoading || (!content && status === 'streaming')) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="space-y-4 text-center text-muted-foreground">
          <div className="text-lg">Generating chart...</div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  if (!content || content.trim() === '') {
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
            {error instanceof Error ? error.message : 'Invalid chart data'}
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
    case 'bar':
      return <BarChart data={data} />;
    case 'line':
      return <LineChart data={data} />;
    case 'pie':
      return <PieChart data={data} />;
    case 'scatter':
      return <ScatterChart data={data} />;
    case 'histogram':
      return <BarChart data={data} />;
    case 'area':
      return <AreaChart data={data} />;
    default:
      return <SimpleDataDisplay data={data} />;
  }
}

/**
 * Simple Bar Chart Component
 */
function BarChart({ data }: { data: any }) {
  if (!data.labels || !data.datasets) {
    return <div>Invalid bar chart data</div>;
  }

  const maxValue = Math.max(
    ...data.datasets.flatMap((ds: any) => ds.data as number[])
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-1 items-end gap-2">
        {data.labels.map((label: string, index: number) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-2">
            {/* Bar */}
            <div className="flex w-full flex-col gap-1">
              {data.datasets.map((dataset: any, dsIndex: number) => {
                const value = dataset.data[index];
                const heightPercent = (value / maxValue) * 100;

                return (
                  <div
                    key={dsIndex}
                    className="relative w-full rounded-t transition-all hover:opacity-80"
                    style={{
                      height: `${heightPercent}%`,
                      minHeight: '20px',
                      backgroundColor: dataset.backgroundColor || '#3b82f6',
                    }}
                    title={`${dataset.label}: ${value}`}
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Label */}
            <div className="w-full truncate text-center text-xs" title={label}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      {data.datasets.length > 1 && (
        <div className="flex flex-wrap gap-4">
          {data.datasets.map((dataset: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
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
 * Simple Line Chart Component
 */
function LineChart({ data }: { data: any }) {
  if (!data.labels || !data.datasets) {
    return <div>Invalid line chart data</div>;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="text-center text-muted-foreground">
        Line Chart Visualization
      </div>
      <SimpleDataDisplay data={data} />
    </div>
  );
}

/**
 * Simple Pie Chart Component
 */
function PieChart({ data }: { data: any }) {
  if (!data.labels || !data.datasets || !data.datasets[0]) {
    return <div>Invalid pie chart data</div>;
  }

  const dataset = data.datasets[0];
  const total = dataset.data.reduce((sum: number, val: number) => sum + val, 0);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-1 items-center justify-center">
        <div className="grid grid-cols-2 gap-4">
          {data.labels.map((label: string, index: number) => {
            const value = dataset.data[index];
            const percentage = ((value / total) * 100).toFixed(1);

            return (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div
                  className="h-8 w-8 rounded"
                  style={{
                    backgroundColor:
                      dataset.backgroundColor[index] || '#3b82f6',
                  }}
                />
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-muted-foreground text-sm">
                    {value} ({percentage}%)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple Scatter Chart Component
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

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative flex-1 border-b border-l">
        {points.map((point: any, index: number) => {
          const xPercent = ((point.x - minX) / (maxX - minX)) * 100;
          const yPercent = ((point.y - minY) / (maxY - minY)) * 100;

          return (
            <div
              key={index}
              className="absolute h-2 w-2 -translate-x-1 -translate-y-1 rounded-full"
              style={{
                left: `${xPercent}%`,
                bottom: `${yPercent}%`,
                backgroundColor: dataset.backgroundColor || '#3b82f6',
              }}
              title={`(${point.x}, ${point.y})`}
            />
          );
        })}
      </div>
      <div className="text-center text-muted-foreground text-sm">
        {dataset.label}
      </div>
    </div>
  );
}

/**
 * Simple Area Chart Component
 */
function AreaChart({ data }: { data: any }) {
  return <LineChart data={data} />;
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
