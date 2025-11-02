/**
 * CSV Intent Detection Utilities
 * Detects user intent to analyze or visualize CSV data from prompts
 */

/**
 * Detects if user wants to analyze or visualize data
 * @param prompt - User's message text
 * @param hasCSVAttachment - Whether a CSV file is attached
 * @returns true if analysis intent is detected
 */
export function detectAnalysisIntent(
  prompt: string,
  hasCSVAttachment: boolean
): boolean {
  if (!hasCSVAttachment) return false;

  const lowerPrompt = prompt.toLowerCase();

  // Analysis keywords - words that indicate data analysis intent
  const analysisKeywords = [
    'analyze', 'analysis', 'examine', 'inspect', 'study',
    'summarize', 'summary', 'statistics', 'stats',
    'describe', 'overview', 'insights', 'trends',
    'calculate', 'compute', 'find', 'determine'
  ];

  // Visualization keywords - words that indicate charting/graphing intent
  const visualizationKeywords = [
    'visualize', 'visualization', 'plot', 'chart', 'graph',
    'show', 'display', 'draw', 'create chart', 'make chart',
    'bar chart', 'line chart', 'pie chart', 'scatter plot',
    'histogram', 'heatmap', 'compare', 'comparison'
  ];

  // Data exploration keywords - words that indicate exploration intent
  const explorationKeywords = [
    'explore', 'explore data', 'what\'s in', 'what is in',
    'show me', 'tell me about', 'breakdown', 'distribution',
    'look at', 'review', 'check', 'view'
  ];

  const allKeywords = [
    ...analysisKeywords,
    ...visualizationKeywords,
    ...explorationKeywords
  ];

  // Check if any keyword is present in the prompt
  return allKeywords.some(keyword => lowerPrompt.includes(keyword));
}

/**
 * Determines the type of visualization requested
 * @param prompt - User's message text
 * @returns Chart type or null if not specified
 */
export function detectVisualizationType(prompt: string): string | null {
  const lowerPrompt = prompt.toLowerCase();

  // Chart type mappings with their associated keywords
  const chartTypes = [
    { keywords: ['bar chart', 'bar graph', 'bars', 'column chart'], type: 'bar' },
    { keywords: ['line chart', 'line graph', 'lines', 'trend line', 'time series'], type: 'line' },
    { keywords: ['pie chart', 'pie graph', 'pie'], type: 'pie' },
    { keywords: ['scatter', 'scatter plot', 'scatterplot'], type: 'scatter' },
    { keywords: ['histogram', 'distribution', 'frequency'], type: 'histogram' },
    { keywords: ['heatmap', 'heat map', 'correlation'], type: 'heatmap' },
    { keywords: ['area chart', 'area graph'], type: 'area' },
  ];

  // Find the first matching chart type
  for (const { keywords, type } of chartTypes) {
    if (keywords.some(kw => lowerPrompt.includes(kw))) {
      return type;
    }
  }

  return null; // No specific chart type requested - let AI decide
}

/**
 * Extracts specific columns mentioned in the prompt
 * @param prompt - User's message text
 * @param csvHeaders - Available column headers from CSV
 * @returns Array of column names mentioned in prompt
 */
export function extractColumnReferences(
  prompt: string,
  csvHeaders: string[]
): string[] {
  const mentionedColumns: string[] = [];
  const promptLower = prompt.toLowerCase();

  csvHeaders.forEach(header => {
    const headerLower = header.toLowerCase();

    // Check if column name is mentioned (with word boundaries to avoid partial matches)
    const regex = new RegExp(`\\b${headerLower}\\b`, 'i');
    if (regex.test(prompt)) {
      mentionedColumns.push(header);
    }
  });

  return mentionedColumns;
}

/**
 * Detects comparison intent between columns or categories
 * @param prompt - User's message text
 * @returns true if comparison intent detected
 */
export function detectComparisonIntent(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();

  const comparisonKeywords = [
    'compare', 'comparison', 'versus', 'vs', 'vs.',
    'difference', 'differences', 'contrast',
    'between', 'against', 'correlation',
    'relationship', 'relate', 'related'
  ];

  return comparisonKeywords.some(keyword => lowerPrompt.includes(keyword));
}

/**
 * Comprehensive intent analysis result
 */
export interface IntentAnalysis {
  shouldAnalyze: boolean;
  chartType: string | null;
  columns: string[];
  isComparison: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Performs comprehensive intent analysis
 * @param prompt - User's message text
 * @param hasCSVAttachment - Whether a CSV file is attached
 * @param csvHeaders - Optional CSV headers for column extraction
 * @returns Complete intent analysis
 */
export function analyzeIntent(
  prompt: string,
  hasCSVAttachment: boolean,
  csvHeaders?: string[]
): IntentAnalysis {
  if (!hasCSVAttachment) {
    return {
      shouldAnalyze: false,
      chartType: null,
      columns: [],
      isComparison: false,
      confidence: 'high'
    };
  }

  const shouldAnalyze = detectAnalysisIntent(prompt, hasCSVAttachment);
  const chartType = detectVisualizationType(prompt);
  const columns = csvHeaders ? extractColumnReferences(prompt, csvHeaders) : [];
  const isComparison = detectComparisonIntent(prompt);

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (shouldAnalyze && chartType) {
    confidence = 'high'; // Both analysis intent and specific chart type
  } else if (shouldAnalyze) {
    confidence = 'medium'; // Analysis intent but no specific chart type
  }

  return {
    shouldAnalyze,
    chartType,
    columns,
    isComparison,
    confidence
  };
}
