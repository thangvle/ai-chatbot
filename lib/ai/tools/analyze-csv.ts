/**
 * CSV Analysis Tool for AI
 * Allows the AI to analyze CSV files and generate visualizations
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { UIMessageStreamWriter } from 'ai';
import {
  analyzeData,
  fetchCSVContent,
  parseCSV,
  type DataAnalysis
} from '@/lib/tools/csv/parser';

// Tool parameters schema
const analyzeCSVParametersSchema = z.object({
  fileUrl: z.string().describe('URL of the CSV file to analyze'),
  chartType: z
    .enum(['bar', 'line', 'pie', 'scatter', 'histogram', 'area', 'auto'])
    .optional()
    .describe('Type of chart to generate. Use "auto" to let the system decide based on data.'),
  columns: z
    .array(z.string())
    .optional()
    .describe('Specific columns to analyze. If not provided, all columns will be analyzed.'),
  includeStats: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to include statistical analysis in the response'),
});

/**
 * Creates the CSV analysis tool
 * @param dataStream - AI data stream for sending artifacts
 * @returns AI tool for CSV analysis
 */
export function analyzeCSV({ dataStream }: { dataStream: UIMessageStreamWriter }) {
  return tool({
    description:
      'Analyzes CSV files and generates statistical summaries and visualizations. ' +
      'Use this tool when the user uploads a CSV file and asks to analyze, visualize, or explore the data. ' +
      'The tool can automatically detect the best chart type based on the data structure, or you can specify a particular chart type.',
    parameters: analyzeCSVParametersSchema,
    execute: async ({ fileUrl, chartType = 'auto', columns, includeStats }) => {
      try {
        // Fetch CSV content from URL
        const csvContent = await fetchCSVContent(fileUrl);

        // Parse CSV
        const parsed = parseCSV(csvContent);

        // Filter columns if specified
        let filteredParsed = parsed;
        if (columns && columns.length > 0) {
          const filteredHeaders = parsed.headers.filter(h =>
            columns.includes(h)
          );
          const filteredRows = parsed.rows.map(row => {
            const filteredRow: Record<string, string | number> = {};
            for (const col of filteredHeaders) {
              filteredRow[col] = row[col];
            }
            return filteredRow;
          });

          filteredParsed = {
            headers: filteredHeaders,
            rows: filteredRows,
            rowCount: filteredRows.length,
            columnCount: filteredHeaders.length
          };
        }

        // Analyze data
        const analysis = analyzeData(filteredParsed);

        // Determine final chart type
        const finalChartType =
          chartType === 'auto'
            ? analysis.recommendations.suggestedChartType
            : chartType;

        // Generate chart data
        const chartData = generateChartData(
          filteredParsed,
          analysis,
          finalChartType
        );

        // Send chart artifact to the data stream
        const artifactId = `csv-chart-${Date.now()}`;

        dataStream.write({
          type: 'data-id',
          data: artifactId,
          transient: true,
        });

        dataStream.write({
          type: 'data-title',
          data: `Data Visualization - ${finalChartType} chart`,
          transient: true,
        });

        dataStream.write({
          type: 'data-kind',
          data: 'chart',
          transient: true,
        });

        // Send chart configuration as JSON
        const chartConfig = {
          type: finalChartType,
          data: chartData,
          title: `${finalChartType} Chart`,
          xAxisLabel: analysis.recommendations.xAxis || 'X Axis',
          yAxisLabel: analysis.recommendations.yAxis?.[0] || 'Y Axis',
        };

        dataStream.write({
          type: 'data-chartDelta',
          data: JSON.stringify(chartConfig),
          transient: true,
        });

        // Build response text
        let responseText = '';

        if (includeStats) {
          responseText += '# Data Analysis Results\n\n';
          responseText += `## Summary\n`;
          responseText += `- Total Rows: ${analysis.summary.totalRows}\n`;
          responseText += `- Total Columns: ${analysis.summary.totalColumns}\n`;
          responseText += `- Columns: ${analysis.summary.columnNames.join(', ')}\n\n`;

          responseText += `## Column Statistics\n\n`;
          for (const stat of analysis.columnStats) {
            responseText += `### ${stat.column} (${stat.type})\n`;
            responseText += `- Count: ${stat.count}\n`;
            responseText += `- Unique Values: ${stat.uniqueCount}\n`;

            if (stat.type === 'numeric') {
              responseText += `- Min: ${stat.min}\n`;
              responseText += `- Max: ${stat.max}\n`;
              responseText += `- Mean: ${stat.mean}\n`;
              responseText += `- Median: ${stat.median}\n`;
              responseText += `- Sum: ${stat.sum}\n`;
            }

            if (stat.mostCommon) {
              responseText += `- Most Common: ${stat.mostCommon} (${stat.mostCommonCount} times)\n`;
            }

            responseText += `\n`;
          }

          responseText += `## Visualization\n`;
          responseText += `**Chart Type:** ${finalChartType}\n`;
          responseText += `**Reasoning:** ${analysis.recommendations.reasoning}\n`;
        }

        return {
          success: true,
          analysis,
          chartType: finalChartType,
          message: responseText || 'CSV analysis completed successfully',
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
          message: `Failed to analyze CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  });
}

/**
 * Generates chart data from parsed CSV based on chart type
 * @param parsed - Parsed CSV data
 * @param analysis - Data analysis results
 * @param chartType - Type of chart to generate
 * @returns Chart data configuration
 */
function generateChartData(
  parsed: ReturnType<typeof parseCSV>,
  analysis: DataAnalysis,
  chartType: string
) {
  const { recommendations } = analysis;

  switch (chartType) {
    case 'bar':
    case 'line':
    case 'area': {
      // Use recommended axes or first text/date column as X, first numeric as Y
      const xAxis =
        recommendations.xAxis ||
        parsed.headers.find(h => {
          const stat = analysis.columnStats.find(s => s.column === h);
          return stat?.type === 'text' || stat?.type === 'date';
        }) ||
        parsed.headers[0];

      const yAxes =
        recommendations.yAxis ||
        parsed.headers.filter(h => {
          const stat = analysis.columnStats.find(s => s.column === h);
          return stat?.type === 'numeric';
        });

      return {
        labels: parsed.rows.map(row => String(row[xAxis])),
        datasets: yAxes.map((yAxis, index) => ({
          label: yAxis,
          data: parsed.rows.map(row => Number(row[yAxis]) || 0),
          backgroundColor: `hsl(${index * 60}, 70%, 50%)`,
          borderColor: `hsl(${index * 60}, 70%, 40%)`,
        })),
      };
    }

    case 'pie': {
      // Use first text column and count occurrences
      const categoryColumn =
        recommendations.xAxis ||
        parsed.headers.find(h => {
          const stat = analysis.columnStats.find(s => s.column === h);
          return stat?.type === 'text';
        }) ||
        parsed.headers[0];

      const counts: Record<string, number> = {};
      for (const row of parsed.rows) {
        const key = String(row[categoryColumn]);
        counts[key] = (counts[key] || 0) + 1;
      }

      const labels = Object.keys(counts);
      const data = Object.values(counts);

      return {
        labels,
        datasets: [
          {
            label: categoryColumn,
            data,
            backgroundColor: labels.map(
              (_, index) => `hsl(${(index * 360) / labels.length}, 70%, 50%)`
            ),
          },
        ],
      };
    }

    case 'scatter': {
      // Use first two numeric columns
      const numericColumns = parsed.headers.filter(h => {
        const stat = analysis.columnStats.find(s => s.column === h);
        return stat?.type === 'numeric';
      });

      const xAxis = numericColumns[0] || parsed.headers[0];
      const yAxis = numericColumns[1] || parsed.headers[1];

      return {
        datasets: [
          {
            label: `${xAxis} vs ${yAxis}`,
            data: parsed.rows.map(row => ({
              x: Number(row[xAxis]) || 0,
              y: Number(row[yAxis]) || 0,
            })),
            backgroundColor: 'hsl(200, 70%, 50%)',
          },
        ],
      };
    }

    case 'histogram': {
      // Use first numeric column and create bins
      const numericColumn =
        parsed.headers.find(h => {
          const stat = analysis.columnStats.find(s => s.column === h);
          return stat?.type === 'numeric';
        }) || parsed.headers[0];

      const values = parsed.rows
        .map(row => Number(row[numericColumn]))
        .filter(v => !Number.isNaN(v));

      const min = Math.min(...values);
      const max = Math.max(...values);
      const binCount = 10;
      const binSize = (max - min) / binCount;

      const bins: number[] = new Array(binCount).fill(0);
      for (const value of values) {
        const binIndex = Math.min(
          Math.floor((value - min) / binSize),
          binCount - 1
        );
        bins[binIndex]++;
      }

      const labels = Array.from({ length: binCount }, (_, i) => {
        const start = min + i * binSize;
        const end = start + binSize;
        return `${start.toFixed(1)}-${end.toFixed(1)}`;
      });

      return {
        labels,
        datasets: [
          {
            label: numericColumn,
            data: bins,
            backgroundColor: 'hsl(200, 70%, 50%)',
          },
        ],
      };
    }

    default: {
      // Default to simple bar chart with all data
      return {
        labels: parsed.rows.map((_, i) => `Row ${i + 1}`),
        datasets: [
          {
            label: 'Data',
            data: parsed.rows.map(row => Number(Object.values(row)[0]) || 0),
            backgroundColor: 'hsl(200, 70%, 50%)',
          },
        ],
      };
    }
  }
}
