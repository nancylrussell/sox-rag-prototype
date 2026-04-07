const VectorStore = require('./vectorStore');
const { generateEmbedding } = require('./ingest');
require('dotenv').config();

const TOP_K = parseInt(process.env.TOP_K_RESULTS) || 5;

/**
 * Retrieve relevant document chunks for a query
 */
async function retrieveRelevantChunks(query, selectedDocuments = [], topK = TOP_K) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Get vector store
    const vectorStore = new VectorStore();

    if (vectorStore.count() === 0) {
      throw new Error('No documents indexed. Please run "node ingest.js" first.');
    }

    // Build filter for selected documents
    let filter = undefined;
    if (selectedDocuments.length > 0) {
      filter = { documents: selectedDocuments };
    }

    // Query the vector store
    const results = vectorStore.query(queryEmbedding, topK, filter);

    // Format results
    const chunks = results.map(result => ({
      id: result.id,
      text: result.text,
      metadata: result.metadata,
      similarity: result.similarity,
      distance: 1 - result.similarity // Convert similarity to distance
    }));

    return chunks;
  } catch (error) {
    console.error('Error retrieving chunks:', error.message);
    throw error;
  }
}

/**
 * Get list of all indexed documents
 */
async function getIndexedDocuments() {
  try {
    const vectorStore = new VectorStore();
    return vectorStore.getDocuments();
  } catch (error) {
    console.error('Error getting indexed documents:', error.message);
    return [];
  }
}

/**
 * Calculate relevance score and determine confidence level
 */
function calculateConfidence(chunks) {
  if (chunks.length === 0) return 'low';

  // Average similarity of top chunks
  const avgSimilarity = chunks.reduce((sum, chunk) => sum + (chunk.similarity || 0), 0) / chunks.length;

  // Check if chunks are from same document (higher confidence)
  const uniqueDocs = new Set(chunks.map(c => c.metadata.document));
  const sameDocs = uniqueDocs.size <= 2;

  if (avgSimilarity > 0.7 && sameDocs) return 'high';
  if (avgSimilarity > 0.5) return 'medium';
  return 'low';
}

module.exports = {
  retrieveRelevantChunks,
  getIndexedDocuments,
  calculateConfidence
};
