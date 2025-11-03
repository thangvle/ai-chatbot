/**
 * CSV Analysis Tool for AI
 * Allows the AI to analyze CSV files and generate visualizations
 */

import type { UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { saveDocument } from "@/lib/db/queries";
import {
  analyzeData,
  type DataAnalysis,
  fetchCSVContent,
  parseCSV,
} from "@/lib/tools/csv/parser";
import { generateUUID } from "@/lib/utils";

// Tool parameters schema
const analyzeCSVParametersSchema = z.object({
  fileUrl: z
    .string()
    .optional()
    .describe(
      "The URL path to the CSV file (e.g., /api/files/get?key=filename.csv). If not provided, uses the most recently uploaded CSV file."
    ),
  chartType: z
    .enum(["column", "bar", "line", "pie", "histogram", "area", "auto"])
    .optional()
    .default("auto")
    .describe(
      'Type of chart to generate. "column" for vertical bars, "bar" for horizontal bars. Use "auto" to let the system decide based on data.'
    ),
  columns: z
    .array(z.string())
    .optional()
    .describe(
      "Specific columns to analyze. If not provided, all columns will be analyzed."
    ),
  includeStats: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to include statistical analysis in the response"),
});

/**
 * Creates the CSV analysis tool
 * @param dataStream - AI data stream for sending artifacts
 * @param csvFiles - Array of CSV files uploaded in the current conversation
 * @param session - User session for saving documents
 * @returns AI tool for CSV analysis
 */
export function analyzeCSV({
  dataStream,
  csvFiles = [],
  session,
}: {
  dataStream: UIMessageStreamWriter;
  csvFiles?: Array<{ url: string; name: string }>;
  session: Session;
}) {
  return tool({
    description:
      "Analyzes CSV data files and creates visualizations. " +
      (csvFiles.length > 0
        ? `Available CSV files in conversation: ${csvFiles.map((f) => `"${f.name}"`).join(", ")}. `
        : "") +
      "This tool parses CSV files, generates statistical analysis, and creates interactive charts. " +
      "Use when user asks to analyze, visualize, chart, plot, or explore CSV data. " +
      "If fileUrl is not provided, the most recently uploaded CSV file will be used automatically.",
    inputSchema: analyzeCSVParametersSchema,
    execute: async ({
      fileUrl,
      chartType = "auto",
      columns,
      includeStats = true,
    }) => {
      // Auto-detect CSV file if not provided
      let actualFileUrl = fileUrl;

      if (!actualFileUrl || actualFileUrl.trim() === "") {
        if (csvFiles.length > 0) {
          // Use the most recent CSV file
          const latestFile = csvFiles.at(-1);
          if (latestFile) {
            actualFileUrl = latestFile.url;
          }
        }

        if (!actualFileUrl) {
          console.error(
            "[analyzeCSV] No fileUrl provided and no CSV files available"
          );
          return {
            success: false,
            error: "No CSV file available",
            message:
              "No CSV file URL provided and no CSV files found in the conversation. Please upload a CSV file first.",
          };
        }
      }

      try {
        // Fetch CSV content from URL
        const csvContent = await fetchCSVContent(actualFileUrl);

        // Parse CSV
        const parsed = parseCSV(csvContent);

        // Filter columns if specified
        let filteredParsed = parsed;
        if (columns && columns.length > 0) {
          const filteredHeaders = parsed.headers.filter((h) =>
            columns.includes(h)
          );
          const filteredRows = parsed.rows.map((row) => {
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
            columnCount: filteredHeaders.length,
          };
        }

        // Analyze data
        const analysis = analyzeData(filteredParsed);

        // Determine final chart type
        const finalChartType =
          chartType === "auto"
            ? analysis.recommendations.suggestedChartType
            : chartType;

        // Generate chart data
        const chartData = generateChartData(
          filteredParsed,
          analysis,
          finalChartType
        );

        // Send chart artifact to the data stream
        // Use UUID for compatibility with PostgreSQL database
        const artifactId = generateUUID();

        try {
          // Write stream data sequentially with error handling
          dataStream.write({
            type: "data-id",
            data: artifactId,
            transient: true,
          });

          dataStream.write({
            type: "data-title",
            data: `Data Visualization - ${finalChartType} chart`,
            transient: true,
          });

          dataStream.write({
            type: "data-kind",
            data: "chart",
            transient: true,
          });

          // Send chart configuration as JSON
          // Ensure the config is properly serializable
          const chartConfig = {
            type: finalChartType,
            data: chartData,
            title: `${finalChartType} Chart`,
            xAxisLabel: analysis.recommendations.xAxis || "X Axis",
            yAxisLabel: analysis.recommendations.yAxis?.[0] || "Y Axis",
          };

          // Validate chartConfig can be stringified before sending
          const chartConfigString = JSON.stringify(chartConfig);

          dataStream.write({
            type: "data-chartDelta",
            data: chartConfigString,
            transient: true,
          });

          // Finish the stream immediately to unblock text streaming
          dataStream.write({
            type: "data-finish",
            data: null,
            transient: true,
          });

          // Save chart to database asynchronously (non-blocking)
          // The promise runs in background while tool returns immediately
          if (session?.user?.id) {
            saveDocument({
              id: artifactId,
              title: `Data Visualization - ${finalChartType} chart`,
              kind: "chart",
              content: chartConfigString,
              userId: session.user.id,
            })
              .then(() => {})
              .catch((error) => {
                console.error(
                  "[analyzeCSV] Failed to save chart document:",
                  error
                );
              });
          } else {
            console.warn(
              "[analyzeCSV] Chart not saved - no valid user session"
            );
          }
        } catch (streamError) {
          console.error(
            "[analyzeCSV] Error writing to data stream:",
            streamError
          );
          throw new Error(
            `Failed to write chart to stream: ${streamError instanceof Error ? streamError.message : "Unknown stream error"}`
          );
        }

        // Build response text
        let responseText = "";

        if (includeStats) {
          responseText += "# Data Analysis Results\n\n";
          responseText += "## Summary\n";
          responseText += `- Total Rows: ${analysis.summary.totalRows}\n`;
          responseText += `- Total Columns: ${analysis.summary.totalColumns}\n`;
          responseText += `- Columns: ${analysis.summary.columnNames.join(", ")}\n\n`;

          responseText += "## Column Statistics\n\n";
          for (const stat of analysis.columnStats) {
            responseText += `### ${stat.column} (${stat.type})\n`;
            responseText += `- Count: ${stat.count}\n`;
            responseText += `- Unique Values: ${stat.uniqueCount}\n`;

            if (stat.type === "numeric") {
              responseText += `- Min: ${stat.min}\n`;
              responseText += `- Max: ${stat.max}\n`;
              responseText += `- Mean: ${stat.mean}\n`;
              responseText += `- Median: ${stat.median}\n`;
              responseText += `- Sum: ${stat.sum}\n`;
            }

            if (stat.mostCommon) {
              responseText += `- Most Common: ${stat.mostCommon} (${stat.mostCommonCount} times)\n`;
            }

            responseText += "\n";
          }

          responseText += "## Visualization\n";
          responseText += `**Chart Type:** ${finalChartType}\n`;
          responseText += `**Reasoning:** ${analysis.recommendations.reasoning}\n`;
        }

        return {
          success: true,
          analysis,
          chartType: finalChartType,
          artifactId,
          title: `Data Visualization - ${finalChartType} chart`,
          message: responseText || "CSV analysis completed successfully",
        };
      } catch (error) {
        console.error("[analyzeCSV] Error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        return {
          success: false,
          error: errorMessage,
          message: `Failed to analyze CSV: ${errorMessage}\n\nFile URL: ${fileUrl}\n\nPlease ensure the file is accessible and is a valid CSV format.`,
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

  // Helper to safely convert values to numbers (avoiding NaN/Infinity in JSON)
  const safeNumber = (value: any): number => {
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      return 0;
    }
    return num;
  };

  switch (chartType) {
    case "column":
    case "bar":
    case "line":
    case "area": {
      // Use recommended axes or first text/date column as X, first numeric as Y
      const xAxis =
        recommendations.xAxis ||
        parsed.headers.find((h) => {
          const stat = analysis.columnStats.find((s) => s.column === h);
          return stat?.type === "text" || stat?.type === "date";
        }) ||
        parsed.headers[0];

      const yAxes =
        recommendations.yAxis ||
        parsed.headers.filter((h) => {
          const stat = analysis.columnStats.find((s) => s.column === h);
          return stat?.type === "numeric";
        });

      return {
        labels: parsed.rows.map((row) => String(row[xAxis])),
        datasets: yAxes.map((yAxis, index) => ({
          label: yAxis,
          data: parsed.rows.map((row) => safeNumber(row[yAxis])),
          backgroundColor: `hsl(${index * 60}, 70%, 50%)`,
          borderColor: `hsl(${index * 60}, 70%, 40%)`,
        })),
      };
    }

    case "pie": {
      // Use first text column and count occurrences
      const categoryColumn =
        recommendations.xAxis ||
        parsed.headers.find((h) => {
          const stat = analysis.columnStats.find((s) => s.column === h);
          return stat?.type === "text";
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

    case "histogram": {
      // Use first numeric column and create bins
      const numericColumn =
        parsed.headers.find((h) => {
          const stat = analysis.columnStats.find((s) => s.column === h);
          return stat?.type === "numeric";
        }) || parsed.headers[0];

      const values = parsed.rows
        .map((row) => safeNumber(row[numericColumn]))
        .filter(
          (v) =>
            v !== 0 ||
            parsed.rows.some((r) => safeNumber(r[numericColumn]) === 0)
        ); // Keep valid zeros

      if (values.length === 0) {
        return {
          labels: ["No Data"],
          datasets: [
            {
              label: numericColumn,
              data: [0],
              backgroundColor: "hsl(200, 70%, 50%)",
            },
          ],
        };
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const binCount = 10;
      const range = max - min;
      const binSize = range > 0 ? range / binCount : 1;

      const bins: number[] = new Array(binCount).fill(0);
      for (const value of values) {
        const binIndex =
          range > 0
            ? Math.min(Math.floor((value - min) / binSize), binCount - 1)
            : 0;
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
            backgroundColor: "hsl(200, 70%, 50%)",
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
            label: "Data",
            data: parsed.rows.map((row) => safeNumber(Object.values(row)[0])),
            backgroundColor: "hsl(200, 70%, 50%)",
          },
        ],
      };
    }
  }
}
