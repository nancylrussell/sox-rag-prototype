const express = require('express');
const path = require('path');
const { generateAnswer, healthCheck } = require('./rag');
const { getIndexedDocuments } = require('./retrieval');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Query history
let queryHistory = [];

// API Routes

/**
 * Health check endpoint
 */
app.get('/api/health', async (req, res) => {
  try {
    const health = await healthCheck();
    const allHealthy = Object.values(health).every(v => v);

    res.json({
      success: allHealthy,
      status: allHealthy ? 'healthy' : 'degraded',
      checks: health,
      message: allHealthy ? 'All systems operational' : 'Some systems are not configured'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'error',
      message: error.message
    });
  }
});

/**
 * Get list of indexed documents
 */
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await getIndexedDocuments();

    // Transform to match frontend format
    const formattedDocs = documents.map((doc, idx) => ({
      id: idx + 1,
      name: doc.name,
      pages: doc.pages,
      chunks: doc.chunks,
      uploaded: 'Indexed'
    }));

    res.json({
      success: true,
      documents: formattedDocs
    });
  } catch (error) {
    console.error('Error fetching documents:', error.message);

    // Return empty list if collection doesn't exist yet
    res.json({
      success: true,
      documents: [],
      message: 'No documents indexed yet. Please run "node ingest.js" to index documents.'
    });
  }
});

/**
 * Query endpoint - uses real RAG pipeline
 */
app.post('/api/query', async (req, res) => {
  const { question, selectedDocuments } = req.body;

  if (!question || question.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Question is required'
    });
  }

  try {
    // Generate answer using RAG
    const result = await generateAnswer(question, selectedDocuments);

    // Add to history
    const historyEntry = {
      id: Date.now(),
      question,
      answer: result.answer,
      confidence: result.confidence,
      timestamp: new Date().toISOString(),
      selectedDocuments: selectedDocuments || []
    };
    queryHistory.unshift(historyEntry);

    // Keep only last 50
    if (queryHistory.length > 50) {
      queryHistory = queryHistory.slice(0, 50);
    }

    // Return response
    res.json({
      success: true,
      response: {
        answer: result.answer,
        confidence: result.confidence,
        citations: result.citations,
        retrievedChunks: result.retrievedChunks,
        queryId: historyEntry.id
      }
    });

  } catch (error) {
    console.error('Error processing query:', error.message);

    res.status(500).json({
      success: false,
      message: error.message.includes('collection not found')
        ? 'Documents not indexed yet. Please run "node ingest.js" first.'
        : 'Error processing your question. Please try again.',
      error: error.message
    });
  }
});

/**
 * Get query history
 */
app.get('/api/history', (req, res) => {
  res.json({
    success: true,
    history: queryHistory.slice(0, 20)
  });
});

/**
 * Submit feedback
 */
app.post('/api/feedback', (req, res) => {
  const { queryId, feedback } = req.body;
  console.log(`Feedback for query ${queryId}: ${feedback}`);

  // In a production system, you'd store this in a database
  // For now, just log it
  res.json({ success: true });
});

/**
 * Serve frontend
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n=== SOX RAG Q&A Tool ===`);
  console.log(`Server running at http://localhost:${PORT}\n`);

  // Run health check on startup
  try {
    const health = await healthCheck();
    console.log('System Status:');
    console.log(`  Claude API: ${health.anthropic ? '✓' : '✗'}`);
    console.log(`  OpenAI API: ${health.openai ? '✓' : '✗'}`);
    console.log(`  ChromaDB: ${health.chromadb ? '✓' : '✗'}`);

    if (!health.anthropic || !health.openai) {
      console.log('\n⚠️  Warning: API keys not configured');
      console.log('   Create a .env file with your API keys (see .env.example)');
    }

    if (!health.chromadb) {
      console.log('\n⚠️  Warning: No documents indexed');
      console.log('   Run "node ingest.js" to index your PDF documents');
    }

    console.log('');
  } catch (error) {
    console.error('Warning: Health check failed:', error.message);
  }
});
