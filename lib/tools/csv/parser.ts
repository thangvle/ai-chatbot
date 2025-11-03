/**
 * CSV Parser and Data Analysis Utilities
 * Parses CSV files using PapaParse and provides statistical analysis
 */

import Papa from 'papaparse';

/**
 * Parsed CSV data structure
 */
export type ParsedCSV = {
  headers: string[];
  rows: Record<string, string | number>[];
  rowCount: number;
  columnCount: number;
};

/**
 * Column statistics
 */
export type ColumnStats = {
  column: string;
  type: 'numeric' | 'text' | 'date' | 'mixed';
  count: number;
  nullCount: number;
  uniqueCount: number;
  // Numeric stats (if applicable)
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  sum?: number;
  // Text stats (if applicable)
  mostCommon?: string;
  mostCommonCount?: number;
};

/**
 * Complete data analysis result
 */
export type DataAnalysis = {
  summary: {
    totalRows: number;
    totalColumns: number;
    columnNames: string[];
  };
  columnStats: ColumnStats[];
  recommendations: {
    suggestedChartType: string;
    xAxis?: string;
    yAxis?: string[];
    reasoning: string;
  };
};

/**
 * Parses CSV content from string using PapaParse
 * @param csvContent - Raw CSV content as string
 * @returns Parsed CSV data
 */
export function parseCSV(csvContent: string): ParsedCSV {
  // Parse CSV using PapaParse
  const parseResult = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // We'll handle type conversion manually
    transformHeader: (header: string) => header.trim(),
  });

  if (parseResult.errors && parseResult.errors.length > 0) {
    console.warn('CSV parsing warnings:', parseResult.errors);
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file is empty or could not be parsed');
  }

  // Extract headers from the first row keys
  const headers = Object.keys(parseResult.data[0]);

  // Convert rows and parse numeric values
  const rows: Record<string, string | number>[] = parseResult.data.map((row: Record<string, string>) => {
    const convertedRow: Record<string, string | number> = {};

    for (const header of headers) {
      const value = row[header];
      // Try to parse as number, otherwise keep as string
      convertedRow[header] = isNumeric(value) ? Number.parseFloat(value) : value;
    }

    return convertedRow;
  });

  return {
    headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length
  };
}

/**
 * Checks if a value can be parsed as a number
 * @param value - Value to check
 * @returns true if numeric
 */
function isNumeric(value: string): boolean {
  if (value === '' || value === null || value === undefined) {
    return false;
  }
  const num = Number.parseFloat(value);
  return !Number.isNaN(num) && Number.isFinite(num);
}

// Date pattern regex for detecting date strings
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/;

/**
 * Determines the data type of a column
 * @param values - Array of values from the column
 * @returns Data type
 */
function detectColumnType(values: (string | number)[]): ColumnStats['type'] {
  let numericCount = 0;
  let textCount = 0;
  let dateCount = 0;

  for (const value of values) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    if (typeof value === 'number') {
      numericCount++;
    } else if (typeof value === 'string') {
      // Check if it's a date
      if (DATE_PATTERN.test(value)) {
        dateCount++;
      } else {
        textCount++;
      }
    }
  }

  const total = numericCount + textCount + dateCount;

  // Determine primary type (>80% threshold)
  if (numericCount / total > 0.8) {
    return 'numeric';
  }
  if (dateCount / total > 0.8) {
    return 'date';
  }
  if (textCount / total > 0.8) {
    return 'text';
  }

  return 'mixed';
}

/**
 * Calculates statistics for a numeric column
 * @param values - Numeric values
 * @returns Numeric statistics
 */
function calculateNumericStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  return {
    min: sorted[0],
    max: sorted.at(-1) ?? 0,
    mean: Number.parseFloat(mean.toFixed(2)),
    median,
    sum: Number.parseFloat(sum.toFixed(2))
  };
}

/**
 * Finds the most common value in an array
 * @param values - Array of values
 * @returns Most common value and its count
 */
function findMostCommon(values: (string | number)[]): { value: string; count: number } {
  const frequency: Record<string, number> = {};

  for (const val of values) {
    const key = String(val);
    frequency[key] = (frequency[key] || 0) + 1;
  }

  let maxCount = 0;
  let mostCommon = '';

  for (const [value, count] of Object.entries(frequency)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = value;
    }
  }

  return { value: mostCommon, count: maxCount };
}

/**
 * Analyzes a single column
 * @param columnName - Name of the column
 * @param rows - All data rows
 * @returns Column statistics
 */
export function analyzeColumn(
  columnName: string,
  rows: Record<string, string | number>[]
): ColumnStats {
  const values = rows.map(row => row[columnName]);
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');

  const type = detectColumnType(nonNullValues);
  const uniqueValues = new Set(nonNullValues);

  const stats: ColumnStats = {
    column: columnName,
    type,
    count: nonNullValues.length,
    nullCount: rows.length - nonNullValues.length,
    uniqueCount: uniqueValues.size
  };

  // Add numeric stats if applicable
  if (type === 'numeric') {
    const numericValues = nonNullValues.filter(v => typeof v === 'number') as number[];
    const numericStats = calculateNumericStats(numericValues);
    Object.assign(stats, numericStats);
  }

  // Add text stats
  if (type === 'text' || type === 'mixed') {
    const { value, count } = findMostCommon(nonNullValues);
    stats.mostCommon = value;
    stats.mostCommonCount = count;
  }

  return stats;
}

/**
 * Performs comprehensive data analysis on CSV
 * @param parsed - Parsed CSV data
 * @returns Complete data analysis
 */
export function analyzeData(parsed: ParsedCSV): DataAnalysis {
  // Analyze each column
  const columnStats = parsed.headers.map(header =>
    analyzeColumn(header, parsed.rows)
  );

  // Generate recommendations for visualization
  const recommendations = generateVisualizationRecommendations(parsed, columnStats);

  return {
    summary: {
      totalRows: parsed.rowCount,
      totalColumns: parsed.columnCount,
      columnNames: parsed.headers
    },
    columnStats,
    recommendations
  };
}

/**
 * Generates smart visualization recommendations
 * @param _parsed - Parsed CSV data (reserved for future use)
 * @param columnStats - Column statistics
 * @returns Visualization recommendations
 */
function generateVisualizationRecommendations(
  _parsed: ParsedCSV,
  columnStats: ColumnStats[]
): DataAnalysis['recommendations'] {
  const numericColumns = columnStats.filter(c => c.type === 'numeric');
  const textColumns = columnStats.filter(c => c.type === 'text');
  const dateColumns = columnStats.filter(c => c.type === 'date');

  // Time series data (date + numeric)
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    return {
      suggestedChartType: 'line',
      xAxis: dateColumns[0].column,
      yAxis: numericColumns.map(c => c.column),
      reasoning: 'Time series data detected. Line chart shows trends over time.'
    };
  }

  // Category with single numeric (column chart - vertical bars)
  if (textColumns.length > 0 && numericColumns.length === 1) {
    const categoryCol = textColumns.find(c => c.uniqueCount < 20); // Reasonable categories
    if (categoryCol) {
      return {
        suggestedChartType: 'column',
        xAxis: categoryCol.column,
        yAxis: [numericColumns[0].column],
        reasoning: 'Categorical data with numeric values. Column chart shows comparison between categories.'
      };
    }
  }

  // Multiple numeric columns (line chart for comparison)
  if (numericColumns.length >= 2) {
    return {
      suggestedChartType: 'line',
      xAxis: numericColumns[0].column,
      yAxis: numericColumns.slice(1).map(c => c.column),
      reasoning: 'Multiple numeric columns detected. Line chart shows comparison between variables.'
    };
  }

  // Distribution analysis (histogram)
  if (numericColumns.length === 1) {
    return {
      suggestedChartType: 'histogram',
      xAxis: numericColumns[0].column,
      yAxis: [],
      reasoning: 'Single numeric column. Histogram shows data distribution.'
    };
  }

  // Pie chart for categorical distribution
  if (textColumns.length > 0) {
    const categoryCol = textColumns.find(c => c.uniqueCount < 10);
    if (categoryCol) {
      return {
        suggestedChartType: 'pie',
        xAxis: categoryCol.column,
        yAxis: [],
        reasoning: 'Categorical data with few categories. Pie chart shows proportions.'
      };
    }
  }

  // Default fallback to column chart (vertical bars)
  return {
    suggestedChartType: 'column',
    reasoning: 'General purpose column chart for data overview.'
  };
}

/**
 * Fetches CSV content from R2 S3 bucket
 * Handles proxy URLs (/api/files/get?key=...) by extracting the key
 * @param url - URL to CSV file (proxy URL with key parameter)
 * @returns CSV content as string
 */
export async function fetchCSVContent(url: string): Promise<string> {
  try {
    console.log('[fetchCSVContent] Fetching CSV from URL:', url);

    // Import R2 client dynamically (server-side only)
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { r2Client, r2BucketName } = await import('@/lib/blob/r2');

    console.log('[fetchCSVContent] R2 bucket:', r2BucketName);

    // Extract key from proxy URL
    let key: string;

    if (url.startsWith('/api/files/get')) {
      // Parse proxy URL to get the key parameter
      const urlObj = new URL(url, 'http://localhost');
      const keyParam = urlObj.searchParams.get('key');

      if (!keyParam) {
        throw new Error('No key parameter found in URL');
      }

      key = keyParam;
      console.log('[fetchCSVContent] Extracted key from proxy URL:', key);
    } else if (url.includes('r2.cloudflarestorage.com')) {
      // Extract key from R2 URL
      const match = url.match(/r2\.cloudflarestorage\.com\/([^?]+)/);
      if (!match || !match[1]) {
        throw new Error('Could not extract key from R2 URL');
      }
      key = match[1];
      console.log('[fetchCSVContent] Extracted key from R2 URL:', key);
    } else {
      console.error('[fetchCSVContent] Unsupported URL format:', url);
      throw new Error(`Unsupported URL format: ${url}. Expected proxy URL (/api/files/get?key=...) or R2 URL.`);
    }

    // Fetch file directly from R2
    console.log('[fetchCSVContent] Fetching from R2 with key:', key);
    const getCommand = new GetObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    });

    const response = await r2Client.send(getCommand);
    console.log('[fetchCSVContent] R2 response received, ContentType:', response.ContentType);

    if (!response.Body) {
      throw new Error('File not found in R2 bucket');
    }

    // Convert stream to string
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const content = buffer.toString('utf-8');

    console.log('[fetchCSVContent] CSV content fetched, length:', content.length);

    if (!content || content.trim().length === 0) {
      throw new Error('CSV file is empty');
    }

    return content;
  } catch (error) {
    console.error('[fetchCSVContent] Error:', error);
    throw new Error(
      `Error fetching CSV from R2: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
