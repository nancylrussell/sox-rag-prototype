const fs = require('fs');
const path = require('path');

const STORE_PATH = process.env.VECTOR_STORE_PATH || './vector_store.json';

/**
 * Simple file-based vector store
 */
class VectorStore {
  constructor() {
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf8');
      return JSON.parse(content);
    }
    return { chunks: [], metadata: {} };
  }

  save() {
    fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2));
  }

  clear() {
    this.data = { chunks: [], metadata: {} };
    this.save();
  }

  add(chunks) {
    chunks.forEach(chunk => {
      this.data.chunks.push(chunk);
    });
    this.save();
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Query the vector store
   */
  query(queryEmbedding, topK = 5, filter = null) {
    let chunks = this.data.chunks;

    // Apply filter if provided
    if (filter && filter.documents) {
      chunks = chunks.filter(chunk =>
        filter.documents.includes(chunk.metadata.document)
      );
    }

    // Calculate similarities
    const results = chunks.map(chunk => ({
      ...chunk,
      similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding)
    }));

    // Sort by similarity (highest first) and take top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  count() {
    return this.data.chunks.length;
  }

  getDocuments() {
    const docs = {};
    this.data.chunks.forEach(chunk => {
      const docName = chunk.metadata.document;
      if (!docs[docName]) {
        docs[docName] = {
          name: docName,
          chunks: 0,
          pages: chunk.metadata.num_pages || 0
        };
      }
      docs[docName].chunks++;
    });
    return Object.values(docs);
  }
}

module.exports = VectorStore;
