import { createDocumentHandler } from '@/lib/artifacts/server';

/**
 * Chart Document Handler
 * Handles creation and updates of chart artifacts stored as documents
 */
export const chartDocumentHandler = createDocumentHandler({
  kind: 'chart',

  /**
   * Create a new chart document
   * Charts are created via the analyzeCSV tool, not through this handler
   * This handler exists for consistency with other artifact types
   */
  onCreateDocument: async () => {
    // Charts are created directly in the analyzeCSV tool
    // This handler is not typically called for charts
    // Return empty string as chart data is managed by the analyzeCSV tool
    return '';
  },

  /**
   * Update an existing chart document
   * Currently not supported for charts
   */
  onUpdateDocument: async ({ document }) => {
    // Charts are read-only after creation
    // Return existing content
    return document.content || '';
  },
});
