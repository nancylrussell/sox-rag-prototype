# SOX RAG Q&A Tool - Full RAG Implementation

A fully functional AI-powered SOX policy document assistant built with RAG (Retrieval-Augmented Generation), featuring Claude API integration, vector embeddings, and semantic search.

## Features

- **Natural Language Q&A Interface**: Ask questions in plain English
- **Document Management**: Select which policy documents to query
- **Citation-Backed Answers**: Every answer links to source documents, pages, and sections
- **Confidence Indicators**: Visual feedback on answer reliability
- **Question History**: Track recent queries for easy reference
- **Feedback System**: Thumbs up/down to improve the system
- **Retrieved Chunks View**: Inspect the actual document chunks used for answers

## Tech Stack

- **Backend**: Node.js + Express
- **LLM**: Claude Sonnet 4 (via Anthropic API)
- **Embeddings**: OpenAI text-embedding-3-small
- **Vector Database**: ChromaDB
- **PDF Processing**: pdf-parse
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Icons**: Font Awesome

## Installation

```bash
cd sox-rag-prototype
npm install
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your API keys:
```bash
ANTHROPIC_API_KEY=your_claude_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

Get your API keys from:
- Claude API: https://console.anthropic.com/
- OpenAI API: https://platform.openai.com/

## Document Ingestion

1. Place your PDF documents in the `documents/` folder

2. Run the ingestion script to process and index the documents:
```bash
npm run ingest
```

This will:
- Parse each PDF document
- Split text into chunks (512 tokens with 64 token overlap)
- Generate embeddings using OpenAI
- Store everything in ChromaDB for semantic search

**Note**: The ingestion process may take a few minutes depending on the number and size of documents.

## Running the Application

```bash
npm start
```

Then open http://localhost:3000 in your browser.

The application now uses **real RAG** with:
- Semantic search over your actual documents
- Claude API for intelligent answer generation
- Citation extraction with page references
- Confidence scoring based on retrieval quality

## Architecture

The system implements a complete RAG pipeline:

1. **Document Ingestion** (`ingest.js`)
   - PDF parsing with pdf-parse
   - Text chunking (512 tokens, 64 token overlap)
   - Embedding generation with OpenAI
   - Vector storage in ChromaDB

2. **Retrieval System** (`retrieval.js`)
   - Semantic search using cosine similarity
   - Relevance scoring and ranking
   - Document filtering by user selection
   - Confidence calculation

3. **Answer Generation** (`rag.js`)
   - Context building from retrieved chunks
   - Claude Sonnet 4 for answer generation
   - Grounded system prompts for accuracy
   - Automatic citation extraction

4. **API Server** (`server.js`)
   - RESTful API endpoints
   - Query processing and history
   - Health checks and status monitoring

## Next Steps for Production

To make this production-ready:

- **Evaluation Framework**: Add RAGAS metrics (faithfulness, answer relevancy, context recall)
- **Authentication**: Implement SSO for user access control
- **Document Management**: Build admin UI for uploading/managing documents
- **Advanced Retrieval**: Add MMR reranking for result diversity
- **Monitoring**: Add logging, analytics, and performance tracking
- **Error Handling**: Implement retry logic and better error messages

## Project Structure

```
sox-rag-prototype/
├── server.js           # Express API server
├── rag.js              # RAG pipeline with Claude integration
├── retrieval.js        # Semantic search and vector retrieval
├── ingest.js           # Document ingestion pipeline
├── documents/          # Place PDF files here
├── chroma_db/          # Vector database (auto-generated)
├── public/
│   ├── index.html      # Main UI
│   └── app.js          # Frontend JavaScript
├── .env                # API keys (create from .env.example)
├── .env.example        # Environment template
├── package.json
└── README.md
```

## API Endpoints

- `GET /api/health` - System health check
- `GET /api/documents` - List indexed documents
- `POST /api/query` - Submit a question
- `GET /api/history` - Get query history
- `POST /api/feedback` - Submit feedback on answers

## License

Internal Use Only - Confidential
