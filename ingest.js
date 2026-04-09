const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const VectorStore = require('./vectorStore');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 512;
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP) || 64;
const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || './documents';

/**
 * Split text into chunks with overlap
 * Using approximate token count (1 token ≈ 4 characters)
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  const charSize = chunkSize * 4; // Approximate token to char conversion
  const charOverlap = overlap * 4;

  for (let i = 0; i < text.length; i += charSize - charOverlap) {
    const chunk = text.slice(i, i + charSize);
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
  }

  return chunks;
}

/**
 * Generate embeddings using OpenAI
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Parse PDF and extract metadata
 */
async function parsePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);

  return {
    text: data.text,
    numPages: data.numpages,
    info: data.info,
    metadata: data.metadata
  };
}

/**
 * Process a single document
 */
async function processDocument(filePath, vectorStore) {
  const fileName = path.basename(filePath);
  console.log(`Processing: ${fileName}`);

  try {
    // Parse PDF
    const pdfData = await parsePDF(filePath);
    console.log(`  Pages: ${pdfData.numPages}`);

    // Chunk the text
    const chunks = chunkText(pdfData.text);
    console.log(`  Chunks: ${chunks.length}`);

    // Process chunks in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / batchSize);

      console.log(`  Processing batch ${batchNum}/${totalBatches}...`);

      // Generate embeddings for batch
      const embeddings = await Promise.all(
        batch.map(chunk => generateEmbedding(chunk))
      );

      // Prepare data for vector store
      const vectorData = batch.map((text, idx) => ({
        id: `${fileName}_chunk_${i + idx}`,
        text: text,
        embedding: embeddings[idx],
        metadata: {
          document: fileName,
          chunk_index: i + idx,
          total_chunks: chunks.length,
          num_pages: pdfData.numPages,
          // Estimate page number (rough approximation)
          page: Math.floor(((i + idx) / chunks.length) * pdfData.numPages) + 1
        }
      }));

      // Add to vector store
      vectorStore.add(vectorData);

      // Small delay to avoid rate limiting
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`  ✓ Completed: ${fileName}\n`);
  } catch (error) {
    console.error(`  ✗ Error processing ${fileName}:`, error.message, '\n');
  }
}

/**
 * Main ingestion function
 */
async function ingestDocuments() {
  console.log('=== SOX RAG Document Ingestion ===\n');

  // Initialize vector store
  const vectorStore = new VectorStore();
  vectorStore.clear();
  console.log('Cleared existing vector store\n');

  // Get all PDF files
  const files = fs.readdirSync(DOCUMENTS_PATH)
    .filter(file => file.toLowerCase().endsWith('.pdf'))
    .map(file => path.join(DOCUMENTS_PATH, file));

  if (files.length === 0) {
    console.log('No PDF files found in ./documents/');
    console.log('Please add PDF files to the documents folder and try again.\n');
    return;
  }

  console.log(`Found ${files.length} PDF file(s)\n`);

  // Process each document
  for (const file of files) {
    await processDocument(file, vectorStore);
  }

  console.log('=== Ingestion Complete ===');
  console.log(`Total documents processed: ${files.length}`);
  console.log(`Total chunks in database: ${vectorStore.count()}\n`);
}

// Run if called directly
if (require.main === module) {
  ingestDocuments()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { ingestDocuments, generateEmbedding };
