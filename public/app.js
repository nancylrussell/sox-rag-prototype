// Global state
let documents = [];
let currentQueryId = null;
let startTime = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadDocuments();
  loadHistory();

  document.getElementById('queryForm').addEventListener('submit', handleSubmit);
});

// Load documents
async function loadDocuments() {
  try {
    const response = await fetch('/api/documents');
    const data = await response.json();

    if (data.success) {
      documents = data.documents;
      renderDocuments();
    }
  } catch (error) {
    console.error('Error loading documents:', error);
  }
}

// Render documents list
function renderDocuments() {
  const container = document.getElementById('documentList');
  container.innerHTML = documents.map(doc => `
    <label class="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
      <input type="checkbox" value="${doc.id}" class="document-checkbox w-4 h-4 text-blue-600 rounded" checked>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">${doc.name}</p>
        <p class="text-xs text-gray-500">${doc.pages} pages</p>
      </div>
    </label>
  `).join('');
}

// Load history
async function loadHistory() {
  try {
    const response = await fetch('/api/history');
    const data = await response.json();

    if (data.success && data.history.length > 0) {
      const container = document.getElementById('historyList');
      container.innerHTML = data.history.map(item => `
        <button onclick="askQuestion('${item.question.replace(/'/g, "\\'")}')"
                class="w-full text-left p-2 hover:bg-gray-50 rounded text-sm text-gray-700 truncate">
          <i class="fas fa-clock text-gray-400 mr-1"></i>
          ${item.question}
        </button>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

// Handle form submission
async function handleSubmit(e) {
  e.preventDefault();

  const question = document.getElementById('questionInput').value.trim();
  if (!question) return;

  const selectedDocs = Array.from(document.querySelectorAll('.document-checkbox:checked'))
    .map(cb => parseInt(cb.value));

  if (selectedDocs.length === 0) {
    alert('Please select at least one document to search');
    return;
  }

  await submitQuery(question, selectedDocs);
}

// Submit query
async function submitQuery(question, selectedDocs) {
  // Show loading state
  document.getElementById('answerContainer').classList.add('hidden');
  document.getElementById('loadingState').classList.remove('hidden');

  // Animate loading steps
  const steps = [
    'Retrieving relevant policy sections...',
    'Analyzing document context...',
    'Generating grounded answer...',
    'Validating citations...'
  ];
  let stepIndex = 0;
  const stepInterval = setInterval(() => {
    document.getElementById('loadingStep').textContent = steps[stepIndex];
    stepIndex = (stepIndex + 1) % steps.length;
  }, 400);

  startTime = Date.now();

  try {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, selectedDocuments: selectedDocs })
    });

    const data = await response.json();

    clearInterval(stepInterval);

    if (data.success) {
      currentQueryId = data.response.queryId;
      displayAnswer(question, data.response);
      loadHistory();
    }
  } catch (error) {
    clearInterval(stepInterval);
    console.error('Error submitting query:', error);
    alert('Error processing your question. Please try again.');
  } finally {
    document.getElementById('loadingState').classList.add('hidden');
  }
}

// Display answer
function displayAnswer(question, response) {
  const container = document.getElementById('answerContainer');
  const responseTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // Confidence badge
  const confidenceBadge = document.getElementById('confidenceBadge');
  const confidenceConfig = {
    high: { color: 'green', icon: 'check-circle', text: 'High Confidence' },
    medium: { color: 'yellow', icon: 'exclamation-circle', text: 'Medium Confidence' },
    low: { color: 'red', icon: 'times-circle', text: 'Low Confidence - Not Found in Documents' }
  };
  const config = confidenceConfig[response.confidence];

  confidenceBadge.innerHTML = `
    <div class="flex items-center space-x-2 bg-${config.color}-100 text-${config.color}-800 px-3 py-1 rounded-full">
      <i class="fas fa-${config.icon}"></i>
      <span class="text-sm font-medium">${config.text}</span>
    </div>
  `;

  // Response time
  document.getElementById('responseTime').textContent = `${responseTime}s`;

  // Answer text
  document.getElementById('answerText').textContent = response.answer;

  // Citations
  const citationsList = document.getElementById('citationsList');
  if (response.citations && response.citations.length > 0) {
    citationsList.innerHTML = response.citations.map((citation, index) => `
      <div class="citation-badge bg-blue-50 border border-blue-200 rounded-lg p-4 cursor-pointer hover:shadow-md">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
              ${index + 1}
            </div>
          </div>
          <div class="flex-1">
            <p class="font-semibold text-gray-900 flex items-center">
              <i class="fas fa-file-pdf text-red-600 mr-2"></i>
              ${citation.doc}
            </p>
            <div class="mt-2 flex items-center space-x-4 text-sm text-gray-600">
              <span><i class="fas fa-file-alt mr-1"></i>Page ${citation.page}</span>
              <span><i class="fas fa-bookmark mr-1"></i>${citation.section}</span>
            </div>
          </div>
          <button class="text-blue-600 hover:text-blue-800 transition">
            <i class="fas fa-external-link-alt"></i>
          </button>
        </div>
      </div>
    `).join('');
  } else {
    citationsList.innerHTML = '<p class="text-sm text-gray-500 italic">No citations available - answer not found in documents</p>';
  }

  // Retrieved chunks
  const chunksContainer = document.getElementById('chunksContainer');
  const chunkCount = document.getElementById('chunkCount');
  if (response.retrievedChunks && response.retrievedChunks.length > 0) {
    chunkCount.textContent = response.retrievedChunks.length;
    chunksContainer.innerHTML = response.retrievedChunks.map((chunk, index) => `
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-gray-700">Chunk ${index + 1}</span>
          <span class="text-xs text-gray-500">${chunk.doc} - Page ${chunk.page}</span>
        </div>
        <p class="text-sm text-gray-600 italic">"${chunk.text}"</p>
      </div>
    `).join('');
  } else {
    chunkCount.textContent = '0';
    chunksContainer.innerHTML = '<p class="text-sm text-gray-500 italic">No chunks retrieved</p>';
  }

  // Show answer container
  container.classList.remove('hidden');

  // Scroll to answer
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Toggle chunks visibility
function toggleChunks() {
  const container = document.getElementById('chunksContainer');
  const icon = document.getElementById('chunkToggleIcon');

  if (container.classList.contains('hidden')) {
    container.classList.remove('hidden');
    icon.classList.remove('fa-chevron-down');
    icon.classList.add('fa-chevron-up');
  } else {
    container.classList.add('hidden');
    icon.classList.remove('fa-chevron-up');
    icon.classList.add('fa-chevron-down');
  }
}

// Ask question programmatically (from example buttons or history)
function askQuestion(question) {
  document.getElementById('questionInput').value = question;
  document.getElementById('questionInput').focus();

  // Auto-submit
  const selectedDocs = Array.from(document.querySelectorAll('.document-checkbox:checked'))
    .map(cb => parseInt(cb.value));

  if (selectedDocs.length > 0) {
    submitQuery(question, selectedDocs);
  }
}

// Submit feedback
async function submitFeedback(feedback) {
  if (!currentQueryId) return;

  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryId: currentQueryId, feedback })
    });

    // Show success message
    const feedbackBtns = document.querySelectorAll('[onclick^="submitFeedback"]');
    feedbackBtns.forEach(btn => {
      btn.disabled = true;
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    });

    const feedbackMsg = document.createElement('span');
    feedbackMsg.className = 'text-sm text-green-600 font-medium';
    feedbackMsg.innerHTML = '<i class="fas fa-check mr-1"></i>Thank you for your feedback!';
    feedbackBtns[0].parentElement.appendChild(feedbackMsg);

  } catch (error) {
    console.error('Error submitting feedback:', error);
  }
}

// Handle file selection and upload
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  if (file.type !== 'application/pdf') {
    alert('Please select a PDF file');
    return;
  }

  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    alert('File size must be less than 10MB');
    return;
  }

  const uploadStatus = document.getElementById('uploadStatus');
  uploadStatus.classList.remove('hidden');
  uploadStatus.innerHTML = '<span class="text-blue-600"><i class="fas fa-spinner fa-spin mr-1"></i>Uploading and indexing...</span>';

  try {
    const formData = new FormData();
    formData.append('document', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      uploadStatus.innerHTML = '<span class="text-green-600"><i class="fas fa-check mr-1"></i>Document uploaded successfully!</span>';

      // Reload document list
      setTimeout(() => {
        loadDocuments();
        uploadStatus.classList.add('hidden');
      }, 2000);
    } else {
      throw new Error(data.message || 'Upload failed');
    }

  } catch (error) {
    console.error('Upload error:', error);
    uploadStatus.innerHTML = '<span class="text-red-600"><i class="fas fa-times mr-1"></i>Upload failed: ' + error.message + '</span>';
  }

  // Clear file input
  event.target.value = '';
}
