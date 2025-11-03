/**
 * Query CSV Rows Tool for AI
 * Allows the AI to query and filter specific rows from CSV files for detailed analysis
 */

import { tool } from "ai";
import { z } from "zod";
import {
  fetchCSVContent,
  type ParsedCSV,
  parseCSV,
} from "@/lib/tools/csv/parser";

// Tool parameters schema
const queryCSVRowsParametersSchema = z.object({
  fileUrl: z
    .string()
    .optional()
    .describe(
      "The URL path to the CSV file (e.g., /api/files/get?key=filename.csv). If not provided, uses the most recently uploaded CSV file."
    ),
  filters: z
    .array(
      z.object({
        column: z.string().describe("Column name to filter on"),
        operator: z
          .enum([
            "equals",
            "contains",
            "greater_than",
            "less_than",
            "not_equals",
          ])
          .describe("Comparison operator"),
        value: z
          .union([z.string(), z.number()])
          .describe("Value to compare against"),
      })
    )
    .optional()
    .describe("Filters to apply to rows. If not provided, returns all rows."),
  columns: z
    .array(z.string())
    .optional()
    .describe(
      "Specific columns to return. If not provided, returns all columns."
    ),
  limit: z
    .number()
    .optional()
    .default(50)
    .describe("Maximum number of rows to return (default: 50, max: 1000)"),
  offset: z
    .number()
    .optional()
    .default(0)
    .describe("Number of rows to skip (for pagination, default: 0)"),
});

/**
 * Applies filters to CSV rows
 * @param rows - Parsed CSV rows
 * @param filters - Filter criteria
 * @returns Filtered rows
 */
function applyFilters(
  rows: ParsedCSV["rows"],
  filters: Array<{
    column: string;
    operator:
      | "equals"
      | "contains"
      | "greater_than"
      | "less_than"
      | "not_equals";
    value: string | number;
  }>
): ParsedCSV["rows"] {
  if (!filters || filters.length === 0) {
    return rows;
  }

  return rows.filter((row) => {
    // All filters must match (AND logic)
    return filters.every((filter) => {
      const cellValue = row[filter.column];

      // Handle missing columns
      if (cellValue === undefined || cellValue === null) {
        return false;
      }

      switch (filter.operator) {
        case "equals":
          return (
            String(cellValue).toLowerCase() ===
            String(filter.value).toLowerCase()
          );

        case "not_equals":
          return (
            String(cellValue).toLowerCase() !==
            String(filter.value).toLowerCase()
          );

        case "contains":
          return String(cellValue)
            .toLowerCase()
            .includes(String(filter.value).toLowerCase());

        case "greater_than":
          if (
            typeof cellValue === "number" &&
            typeof filter.value === "number"
          ) {
            return cellValue > filter.value;
          }
          // Fallback to string comparison
          return String(cellValue) > String(filter.value);

        case "less_than":
          if (
            typeof cellValue === "number" &&
            typeof filter.value === "number"
          ) {
            return cellValue < filter.value;
          }
          // Fallback to string comparison
          return String(cellValue) < String(filter.value);

        default:
          return false;
      }
    });
  });
}

/**
 * Selects specific columns from rows
 * @param rows - Parsed CSV rows
 * @param columns - Columns to select
 * @returns Rows with only selected columns
 */
function selectColumns(
  rows: ParsedCSV["rows"],
  columns?: string[]
): ParsedCSV["rows"] {
  if (!columns || columns.length === 0) {
    return rows;
  }

  return rows.map((row) => {
    const selectedRow: Record<string, string | number> = {};
    for (const col of columns) {
      if (row[col] !== undefined) {
        selectedRow[col] = row[col];
      }
    }
    return selectedRow;
  });
}

/**
 * Formats rows as a readable table string
 * @param rows - Rows to format
 * @param headers - Column headers
 * @returns Formatted table string
 */
function formatRowsAsTable(rows: ParsedCSV["rows"], headers: string[]): string {
  if (rows.length === 0) {
    return "No rows found.";
  }

  // Calculate column widths
  const columnWidths: Record<string, number> = {};
  for (const header of headers) {
    columnWidths[header] = Math.max(
      header.length,
      ...rows.map((row) => String(row[header] || "").length)
    );
  }

  // Build table header
  let table = "| ";
  table += headers.map((h) => h.padEnd(columnWidths[h])).join(" | ");
  table += " |\n";

  // Build separator
  table += "| ";
  table += headers.map((h) => "-".repeat(columnWidths[h])).join(" | ");
  table += " |\n";

  // Build rows
  for (const row of rows) {
    table += "| ";
    table += headers
      .map((h) => String(row[h] || "").padEnd(columnWidths[h]))
      .join(" | ");
    table += " |\n";
  }

  return table;
}

/**
 * Creates the CSV rows query tool
 * @param csvFiles - Array of CSV files uploaded in the current conversation
 * @returns AI tool for querying CSV rows
 */
export function queryCSVRows({
  csvFiles = [],
}: {
  csvFiles?: Array<{ url: string; name: string }>;
}) {
  return tool({
    description:
      "Query and filter specific rows from CSV data files for detailed analysis. " +
      (csvFiles.length > 0
        ? `Available CSV files: ${csvFiles.map((f) => `"${f.name}"`).join(", ")}. `
        : "") +
      "This tool allows you to filter rows based on conditions, select specific columns, " +
      "and paginate through results. Use this when the user asks questions about specific data rows, " +
      "wants to find records matching criteria, or needs to see detailed row-level data. " +
      "Examples: 'Show me rows where sales > 1000', 'Find all entries for region East', " +
      "'What are the details for customer John?'",
    inputSchema: queryCSVRowsParametersSchema,
    execute: async ({ fileUrl, filters, columns, limit = 50, offset = 0 }) => {
      // Enforce max limit to prevent excessive data
      const safeLimit = Math.min(limit, 1000);

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
            "[queryCSVRows] No fileUrl provided and no CSV files available"
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
        // Fetch and parse CSV
        const csvContent = await fetchCSVContent(actualFileUrl);
        const parsed = parseCSV(csvContent);

        // Apply filters
        let filteredRows = applyFilters(parsed.rows, filters || []);

        // Select specific columns
        const selectedHeaders =
          columns && columns.length > 0 ? columns : parsed.headers;

        filteredRows = selectColumns(filteredRows, columns);

        // Apply pagination
        const totalMatchingRows = filteredRows.length;
        const paginatedRows = filteredRows.slice(offset, offset + safeLimit);

        // Format results
        const formattedTable = formatRowsAsTable(
          paginatedRows,
          selectedHeaders
        );

        // Build response message
        let message = "# CSV Query Results\n\n";
        message += `**File:** ${csvFiles.find((f) => f.url === actualFileUrl)?.name || "CSV file"}\n`;
        message += `**Total rows in file:** ${parsed.rowCount}\n`;
        message += `**Matching rows:** ${totalMatchingRows}\n`;
        message += `**Showing:** ${paginatedRows.length} rows (offset: ${offset})\n\n`;

        if (filters && filters.length > 0) {
          message += "**Filters applied:**\n";
          for (const filter of filters) {
            message += `- ${filter.column} ${filter.operator} "${filter.value}"\n`;
          }
          message += "\n";
        }

        message += `## Data\n\n${formattedTable}\n`;

        if (totalMatchingRows > offset + safeLimit) {
          const remaining = totalMatchingRows - (offset + safeLimit);
          message += `\n*${remaining} more rows available. Use offset=${offset + safeLimit} to see more.*\n`;
        }

        return {
          success: true,
          totalRows: parsed.rowCount,
          matchingRows: totalMatchingRows,
          returnedRows: paginatedRows.length,
          offset,
          limit: safeLimit,
          rows: paginatedRows,
          headers: selectedHeaders,
          message,
        };
      } catch (error) {
        console.error("[queryCSVRows] Error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        return {
          success: false,
          error: errorMessage,
          message: `Failed to query CSV rows: ${errorMessage}\n\nFile URL: ${fileUrl}\n\nPlease ensure the file is accessible and is a valid CSV format.`,
        };
      }
    },
  });
}
