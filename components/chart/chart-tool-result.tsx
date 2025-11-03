import { memo } from 'react';
import { LineChartIcon } from '@/components/shared/icons';
import { useArtifact } from '@/hooks/use-artifact';

type ChartToolResultProps = {
  result: {
    id: string;
    title: string;
    chartType: string;
  };
};

function PureChartToolResult({ result }: ChartToolResultProps) {
  const { setArtifact } = useArtifact();

  return (
    <button
      className="flex w-fit cursor-pointer flex-row items-start gap-3 rounded-xl border bg-background px-3 py-2 transition-colors hover:bg-muted"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();

        const boundingBox = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

        setArtifact({
          documentId: result.id,
          kind: 'chart',
          content: '',
          title: result.title,
          isVisible: true,
          status: 'idle',
          boundingBox,
        });
      }}
      type="button"
    >
      <div className="mt-1 text-muted-foreground">
        <LineChartIcon />
      </div>
      <div className="text-left">
        {`View "${result.title}" (${result.chartType} chart)`}
      </div>
    </button>
  );
}

export const ChartToolResult = memo(PureChartToolResult, () => true);
