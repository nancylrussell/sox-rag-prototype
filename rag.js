const Anthropic = require('@anthropic-ai/sdk');
const { retrieveRelevantChunks, calculateConfidence } = require('./retrieval');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Build context from retrieved chunks
 */
function buildContext(chunks) {
  let context = '';

  chunks.forEach((chunk, idx) => {
    const docName = chunk.metadata.document;
    const page = chunk.metadata.page;
    const chunkIndex = chunk.metadata.chunk_index;

    context += `[Document: ${docName}, Page: ${page}, Chunk: ${chunkIndex}]\n`;
    context += `${chunk.text}\n\n`;
  });

  return context;
}

/**
 * Extract citations from Claude's response
 */
function extractCitations(responseText, chunks) {
  const citations = [];
  const citationMap = new Map();

  // Look for document references in the response
  chunks.forEach(chunk => {
    const docName = chunk.metadata.document;
    const page = chunk.metadata.page;

    // If the document or page is mentioned in the response, consider it a citation
    if (responseText.includes(docName) || responseText.toLowerCase().includes(`page ${page}`)) {
      const key = `${docName}:${page}`;

      if (!citationMap.has(key)) {
        citations.push({
          documentName: docName,
          page: page,
          section: chunk.metadata.section || `Relevant content from page ${page}`
        });
        citationMap.set(key, true);
      }
    }
  });

  // If no specific citations found, use the top chunks
  if (citations.length === 0 && chunks.length > 0) {
    const topChunks = chunks.slice(0, 3);
    topChunks.forEach(chunk => {
      citations.push({
        documentName: chunk.metadata.document,
        page: chunk.metadata.page,
        section: `Relevant content from page ${chunk.metadata.page}`
      });
    });
  }

  return citations;
}

/**
 * Generate answer using Claude with RAG
 */
async function generateAnswer(question, selectedDocuments = []) {
  try {
    // Retrieve relevant chunks
    const chunks = await retrieveRelevantChunks(question, selectedDocuments);

    // If no relevant chunks found
    if (chunks.length === 0) {
      return {
        answer: 'This question is not addressed in the provided SOX policy documents. Please try rephrasing your question or contact the compliance team directly for guidance on this topic.',
        confidence: 'low',
        citations: [],
        retrievedChunks: []
      };
    }

    // Build context from chunks
    const context = buildContext(chunks);

    // Create system prompt for Claude
    const systemPrompt = `You are an expert SOX (Sarbanes-Oxley) compliance assistant. Your role is to answer questions based ONLY on the provided policy documents.

Guidelines:
1. Answer questions accurately based on the document excerpts provided
2. If the documents don't contain enough information, state this clearly
3. Reference specific documents and pages when making statements
4. Be precise and professional - this is for compliance purposes
5. If you're unsure or the information is ambiguous, indicate the uncertainty
6. Do not make up or infer information not present in the documents
7. Structure your answer clearly with key points

The user's question may relate to: IT general controls, user access management, change management, SOX 404 requirements, audit procedures, evidence requirements, or compliance frameworks like COBIT.`;

    // Create the prompt with context
    const userPrompt = `Based on the following document excerpts from SOX policy documents, please answer this question:

QUESTION: ${question}

DOCUMENT EXCERPTS:
${context}

Please provide a clear, accurate answer based on these documents. Reference specific documents and pages in your answer.`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    // Extract the answer
    const answer = message.content[0].text;

    // Extract citations
    const citations = extractCitations(answer, chunks);

    // Calculate confidence
    const confidence = calculateConfidence(chunks);

    // Format retrieved chunks for display
    const retrievedChunks = chunks.map(chunk => ({
      doc: chunk.metadata.document,
      page: chunk.metadata.page,
      text: chunk.text.substring(0, 300) + (chunk.text.length > 300 ? '...' : ''),
      similarity: chunk.similarity
    }));

    return {
      answer,
      confidence,
      citations,
      retrievedChunks
    };

  } catch (error) {
    console.error('Error generating answer:', error.message);
    throw error;
  }
}

/**
 * Health check for RAG system
 */
async function healthCheck() {
  const checks = {
    anthropic: false,
    chromadb: false,
    openai: false
  };

  // Check Anthropic API
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      checks.anthropic = true;
    }
  } catch (error) {
    console.error('Anthropic check failed:', error.message);
  }

  // Check OpenAI API
  try {
    if (process.env.OPENAI_API_KEY) {
      checks.openai = true;
    }
  } catch (error) {
    console.error('OpenAI check failed:', error.message);
  }

  // Check ChromaDB
  try {
    const { getIndexedDocuments } = require('./retrieval');
    const docs = await getIndexedDocuments();
    checks.chromadb = docs.length > 0;
  } catch (error) {
    console.error('ChromaDB check failed:', error.message);
  }

  return checks;
}

module.exports = {
  generateAnswer,
  healthCheck
};
