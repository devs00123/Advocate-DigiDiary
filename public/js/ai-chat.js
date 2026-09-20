/**
 * Advocate DigiDiary — AI Legal Assistant & Document Summarizer
 * Powered by Google Gemini 2.0 Flash / Chamber Intelligence Engine
 */

(function () {
  // Prevent duplicate initialization
  if (window.__DIGIDIARY_AI_INITIALIZED__) return;
  window.__DIGIDIARY_AI_INITIALIZED__ = true;

  // Don't show on unauthenticated auth pages
  const isAuthPage =
    window.location.pathname.includes('login.html') ||
    window.location.pathname.includes('register.html') ||
    window.location.pathname.includes('forgot-password.html') ||
    window.location.pathname.includes('reset-password.html') ||
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('index.html');

  if (isAuthPage) return;

  // Chat state
  let chatHistory = [];
  let isThinking = false;
  let activeTab = 'chat'; // 'chat' or 'summarize'

  // Load history from session storage if exists
  try {
    const saved = sessionStorage.getItem('digidiary_ai_history');
    if (saved) chatHistory = JSON.parse(saved);
  } catch (e) {
    chatHistory = [];
  }

  // Inject AI Assistant CSS Styles
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Floating AI Trigger Button */
    .ai-assistant-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9990;
      display: flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #0A1128 0%, #162447 100%);
      color: #FFFFFF;
      border: 1.5px solid #C59B27;
      border-radius: 999px;
      padding: 10px 18px 10px 14px;
      cursor: pointer;
      box-shadow: 0 10px 25px -5px rgba(10, 17, 40, 0.4), 0 0 15px rgba(197, 155, 39, 0.3);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    }
    .ai-assistant-fab:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 14px 28px -4px rgba(10, 17, 40, 0.5), 0 0 20px rgba(197, 155, 39, 0.45);
      border-color: #DFB743;
    }
    .ai-assistant-fab .fab-icon-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(197, 155, 39, 0.2);
      color: #C59B27;
      font-size: 20px;
    }
    .ai-assistant-fab .fab-label {
      font-family: var(--font-label, 'Plus Jakarta Sans', sans-serif);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .ai-assistant-fab .fab-pulse {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 10px;
      height: 10px;
      background: #10B981;
      border: 2px solid #0A1128;
      border-radius: 50%;
    }

    /* Chat Panel Window */
    .ai-chat-window {
      position: fixed;
      bottom: 84px;
      right: 24px;
      width: 420px;
      max-width: calc(100vw - 32px);
      height: 600px;
      max-height: calc(100vh - 100px);
      background: #FFFFFF;
      border-radius: 16px;
      border: 1px solid #E2E8F0;
      box-shadow: 0 20px 40px -10px rgba(10, 17, 40, 0.25), 0 0 0 1px rgba(197, 155, 39, 0.2);
      display: none;
      flex-direction: column;
      z-index: 9999;
      overflow: hidden;
      animation: aiSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ai-chat-window.open {
      display: flex;
    }
    @keyframes aiSlideUp {
      from { opacity: 0; transform: translateY(18px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Window Header */
    .ai-chat-header {
      background: linear-gradient(135deg, #0A1128 0%, #162447 100%);
      color: #FFFFFF;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #C59B27;
    }
    .ai-chat-header-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ai-chat-header-title h3 {
      margin: 0;
      font-family: var(--font-headline, 'Playfair Display', serif);
      font-size: 15px;
      font-weight: 700;
      color: #FFFFFF;
      line-height: 1.2;
    }
    .ai-chat-header-title span.sub {
      font-size: 10px;
      color: #C59B27;
      display: block;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .ai-chat-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ai-icon-btn {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #FFFFFF;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .ai-icon-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Window Tabs */
    .ai-chat-tabs {
      display: flex;
      background: #F8FAFC;
      border-bottom: 1px solid #E2E8F0;
      padding: 0 12px;
    }
    .ai-tab-btn {
      flex: 1;
      text-align: center;
      padding: 9px 12px;
      font-size: 12px;
      font-weight: 600;
      color: #64748B;
      border: none;
      background: transparent;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .ai-tab-btn.active {
      color: #0A1128;
      border-bottom-color: #C59B27;
      background: #FFFFFF;
      font-weight: 700;
    }

    /* Messages Stream */
    .ai-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #F8FAFC;
      scrollbar-width: thin;
      scrollbar-color: #CBD5E1 #F1F5F9;
    }
    .ai-chat-messages::-webkit-scrollbar {
      width: 6px;
    }
    .ai-chat-messages::-webkit-scrollbar-thumb {
      background: #CBD5E1;
      border-radius: 4px;
    }

    /* Chat Bubbles */
    .ai-msg {
      display: flex;
      flex-direction: column;
      max-width: 88%;
      animation: aiFadeIn 0.2s ease-out;
    }
    @keyframes aiFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ai-msg.user {
      align-self: flex-end;
    }
    .ai-msg.assistant {
      align-self: flex-start;
    }
    .ai-msg-bubble {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      word-break: break-word;
    }
    .ai-msg.user .ai-msg-bubble {
      background: #0A1128;
      color: #FFFFFF;
      border-bottom-right-radius: 3px;
    }
    .ai-msg.assistant .ai-msg-bubble {
      background: #FFFFFF;
      color: #0F172A;
      border: 1px solid #E2E8F0;
      border-bottom-left-radius: 3px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .ai-msg.assistant .ai-msg-bubble h3 {
      font-size: 14px;
      margin: 4px 0 8px 0;
      color: #0A1128;
      font-family: var(--font-headline, 'Playfair Display', serif);
    }
    .ai-msg.assistant .ai-msg-bubble h4 {
      font-size: 13px;
      margin: 8px 0 4px 0;
      color: #1E2D5C;
    }
    .ai-msg.assistant .ai-msg-bubble ul,
    .ai-msg.assistant .ai-msg-bubble ol {
      margin: 6px 0;
      padding-left: 20px;
    }
    .ai-msg.assistant .ai-msg-bubble li {
      margin-bottom: 4px;
    }
    .ai-msg.assistant .ai-msg-bubble blockquote {
      border-left: 3px solid #C59B27;
      margin: 8px 0;
      padding: 4px 10px;
      background: rgba(197, 155, 39, 0.08);
      font-style: italic;
    }
    .ai-msg-time {
      font-size: 10px;
      color: #94A3B8;
      margin-top: 3px;
      padding: 0 4px;
    }
    .ai-msg.user .ai-msg-time {
      align-self: flex-end;
    }

    /* Quick Prompt Pills */
    .ai-quick-pills {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 8px 12px;
      background: #FFFFFF;
      border-top: 1px solid #E2E8F0;
      white-space: nowrap;
      scrollbar-width: none;
    }
    .ai-quick-pills::-webkit-scrollbar {
      display: none;
    }
    .ai-pill-btn {
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 500;
      color: #334155;
      cursor: pointer;
      transition: all 0.15s;
    }
    .ai-pill-btn:hover {
      background: #0A1128;
      color: #FFFFFF;
      border-color: #0A1128;
    }

    /* Input Footer */
    .ai-chat-footer {
      padding: 10px 12px;
      background: #FFFFFF;
      border-top: 1px solid #E2E8F0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ai-chat-input {
      flex: 1;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 13px;
      font-family: inherit;
      resize: none;
      outline: none;
      transition: border-color 0.15s;
      max-height: 80px;
    }
    .ai-chat-input:focus {
      border-color: #C59B27;
      box-shadow: 0 0 0 2px rgba(197, 155, 39, 0.15);
    }
    .ai-send-btn {
      background: #0A1128;
      color: #FFFFFF;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s;
    }
    .ai-send-btn:hover {
      background: #152042;
    }
    .ai-send-btn:disabled {
      background: #CBD5E1;
      cursor: not-allowed;
    }

    /* Document Summarizer Pane */
    .ai-doc-pane {
      display: none;
      flex-direction: column;
      padding: 16px;
      gap: 14px;
      flex: 1;
      overflow-y: auto;
      background: #F8FAFC;
    }
    .ai-doc-pane.active {
      display: flex;
    }
    .ai-upload-dropzone {
      border: 2px dashed #CBD5E1;
      border-radius: 12px;
      padding: 24px 16px;
      text-align: center;
      background: #FFFFFF;
      cursor: pointer;
      transition: all 0.2s;
    }
    .ai-upload-dropzone:hover,
    .ai-upload-dropzone.dragover {
      border-color: #C59B27;
      background: rgba(197, 155, 39, 0.04);
    }
    .ai-upload-icon {
      font-size: 36px;
      color: #C59B27;
      margin-bottom: 8px;
    }
    .ai-upload-title {
      font-weight: 700;
      font-size: 13px;
      color: #0A1128;
      margin-bottom: 4px;
    }
    .ai-upload-desc {
      font-size: 11px;
      color: #64748B;
    }
    .ai-doc-results {
      flex: 1;
      overflow-y: auto;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 14px;
      font-size: 12px;
      line-height: 1.5;
    }

    /* Thinking Indicator */
    .ai-thinking-dots {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
    }
    .ai-dot {
      width: 6px;
      height: 6px;
      background: #C59B27;
      border-radius: 50%;
      animation: aiBounce 1.2s infinite ease-in-out;
    }
    .ai-dot:nth-child(2) { animation-delay: 0.2s; }
    .ai-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes aiBounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
      40% { transform: scale(1.1); opacity: 1; }
    }

    /* Mobile Adaptations */
    @media (max-width: 480px) {
      .ai-chat-window {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100vw;
        max-width: 100vw;
        height: 85vh;
        max-height: 85vh;
        border-radius: 16px 16px 0 0;
      }
      .ai-assistant-fab {
        bottom: 16px;
        right: 16px;
        padding: 8px 14px 8px 10px;
      }
      .ai-assistant-fab .fab-label {
        font-size: 12px;
      }
    }
  `;
  document.head.appendChild(styleEl);

  // Markdown to Safe HTML Formatter
  function renderMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h3>$1</h3>')
      .replace(/^# (.*$)/gim, '<h3>$1</h3>')
      // Blockquote
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Inline Code
      .replace(/`([^`]+)`/gim, '<code style="background:#E2E8F0;padding:2px 4px;border-radius:3px;font-family:var(--font-mono);font-size:11px;">$1</code>')
      // Bullet list
      .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
      .replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>')
      // Numbered list
      .replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li><strong>$1.</strong> $2</li>')
      // Line breaks
      .replace(/\n\n/gim, '<br><br>')
      .replace(/\n/gim, '<br>');

    // Wrap loose <li> in <ul>
    if (html.includes('<li>')) {
      html = html.replace(/(<li>[\s\S]*?<\/li>)/gim, '<ul style="margin:6px 0;padding-left:18px;">$1</ul>');
    }
    return html;
  }

  // Create UI DOM
  function createAIWidget() {
    // 1. Floating Action Button (FAB)
    const fab = document.createElement('div');
    fab.className = 'ai-assistant-fab';
    fab.id = 'digidiaryAiFab';
    fab.title = 'Open DigiDiary Legal AI Assistant';
    fab.innerHTML = `
      <div class="fab-icon-box">
        <span class="material-symbols-outlined" style="font-size: 20px;">psychology</span>
      </div>
      <span class="fab-label">Legal AI</span>
      <div class="fab-pulse" title="AI Ready"></div>
    `;
    document.body.appendChild(fab);

    // 2. Chat Window
    const win = document.createElement('div');
    win.className = 'ai-chat-window';
    win.id = 'digidiaryAiWindow';
    win.innerHTML = `
      <!-- Header -->
      <div class="ai-chat-header">
        <div class="ai-chat-header-title">
          <span class="material-symbols-outlined" style="color: #C59B27; font-size: 22px;">balance</span>
          <div>
            <h3>DigiDiary Legal AI</h3>
            <span class="sub">Gemini 2.0 • Legal Companion</span>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <button class="ai-icon-btn" id="aiClearBtn" title="Clear Conversation">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete_sweep</span>
          </button>
          <button class="ai-icon-btn" id="aiCloseBtn" title="Close AI Assistant">
            <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
          </button>
        </div>
      </div>

      <!-- Mode Tabs -->
      <div class="ai-chat-tabs">
        <button class="ai-tab-btn active" id="aiTabChat">
          <span class="material-symbols-outlined" style="font-size: 16px;">forum</span>
          <span>Legal Chat</span>
        </button>
        <button class="ai-tab-btn" id="aiTabSummarize">
          <span class="material-symbols-outlined" style="font-size: 16px;">document_scanner</span>
          <span>Doc Summarizer</span>
        </button>
      </div>

      <!-- Tab 1: Chat Stream -->
      <div class="ai-chat-messages" id="aiChatMessages">
        <div class="ai-msg assistant">
          <div class="ai-msg-bubble">
            <strong>Greetings, Counsel.</strong> I am your DigiDiary Legal Practice Assistant.<br><br>
            I can help draft petitions, verify limitation periods under Indian law, outline bail strategies, prepare Section 138 NI Act notices, and summarize legal documents.<br><br>
            <em>How may I assist your chamber today?</em>
          </div>
          <span class="ai-msg-time">Just now</span>
        </div>
      </div>

      <!-- Quick Prompt Pills (Only for Chat Tab) -->
      <div class="ai-quick-pills" id="aiQuickPills">
        <button class="ai-pill-btn" data-query="Section 138 NI Act Cheque Dishonour Checklist">Sec 138 NI Act</button>
        <button class="ai-pill-btn" data-query="Anticipatory Bail Grounds under BNSS / CrPC">Anticipatory Bail</button>
        <button class="ai-pill-btn" data-query="Limitation Period for High Court Appeal & Condonation of Delay">Limitation Rules</button>
        <button class="ai-pill-btn" data-query="Drafting Essentials for Legal Notice under CPC">Drafting Notice</button>
      </div>

      <!-- Tab 1 Footer Input -->
      <div class="ai-chat-footer" id="aiChatFooter">
        <input type="file" id="aiChatFileInput" accept=".pdf,image/png,image/jpeg,image/webp" style="display: none;">
        <button class="ai-icon-btn" id="aiAttachBtn" title="Upload Document or Photo" style="color: #64748B; background: transparent; border: 1px solid #E2E8F0;">
          <span class="material-symbols-outlined" style="font-size: 18px;">attach_file</span>
        </button>
        <input type="text" class="ai-chat-input" id="aiChatInput" placeholder="Ask legal question or citation..." autocomplete="off">
        <button class="ai-send-btn" id="aiSendBtn" title="Send Message">
          <span class="material-symbols-outlined" style="font-size: 18px;">send</span>
        </button>
      </div>

      <!-- Tab 2: Document Summarizer Pane -->
      <div class="ai-doc-pane" id="aiDocPane">
        <div class="ai-upload-dropzone" id="aiDocDropzone">
          <input type="file" id="aiDocFileInput" accept=".pdf,image/png,image/jpeg,image/webp" style="display: none;">
          <span class="material-symbols-outlined ai-upload-icon">upload_file</span>
          <div class="ai-upload-title">Drop legal PDF or photo here</div>
          <div class="ai-upload-desc">Supports Plaints, Orders, FIRs, Cheques, Agreements (PDF, JPG, PNG up to 10MB)</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="text" class="form-control" id="aiDocPrompt" placeholder="Specific instruction (e.g. Extract prayer & hearing dates)..." style="font-size: 12px; padding: 6px 10px;">
          <button class="btn btn-sm btn-primary" id="aiDocSubmitBtn" style="white-space: nowrap;">
            <span class="material-symbols-outlined" style="font-size: 16px;">auto_awesome</span>
            <span>Analyze</span>
          </button>
        </div>
        <div class="ai-doc-results" id="aiDocResults" style="display: none;">
          <!-- Results injected here -->
        </div>
      </div>
    `;
    document.body.appendChild(win);

    setupEventListeners(fab, win);
  }

  // Event Handlers
  function setupEventListeners(fab, win) {
    const closeBtn = win.querySelector('#aiCloseBtn');
    const clearBtn = win.querySelector('#aiClearBtn');
    const chatTab = win.querySelector('#aiTabChat');
    const summarizeTab = win.querySelector('#aiTabSummarize');
    const chatMessages = win.querySelector('#aiChatMessages');
    const quickPills = win.querySelector('#aiQuickPills');
    const chatFooter = win.querySelector('#aiChatFooter');
    const docPane = win.querySelector('#aiDocPane');
    const chatInput = win.querySelector('#aiChatInput');
    const sendBtn = win.querySelector('#aiSendBtn');
    const attachBtn = win.querySelector('#aiAttachBtn');
    const chatFileInput = win.querySelector('#aiChatFileInput');

    const docDropzone = win.querySelector('#aiDocDropzone');
    const docFileInput = win.querySelector('#aiDocFileInput');
    const docPrompt = win.querySelector('#aiDocPrompt');
    const docSubmitBtn = win.querySelector('#aiDocSubmitBtn');
    const docResults = win.querySelector('#aiDocResults');

    let selectedDocFile = null;

    // Toggle window
    fab.addEventListener('click', () => {
      win.classList.toggle('open');
      if (win.classList.contains('open')) {
        chatInput.focus();
      }
    });

    closeBtn.addEventListener('click', () => {
      win.classList.remove('open');
    });

    // Clear history
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear AI conversation history?')) {
        chatHistory = [];
        sessionStorage.removeItem('digidiary_ai_history');
        chatMessages.innerHTML = `
          <div class="ai-msg assistant">
            <div class="ai-msg-bubble">
              Conversation cleared. Ready for your next legal inquiry, Counsel.
            </div>
            <span class="ai-msg-time">Just now</span>
          </div>
        `;
      }
    });

    // Tab Switcher
    chatTab.addEventListener('click', () => {
      activeTab = 'chat';
      chatTab.classList.add('active');
      summarizeTab.classList.remove('active');
      chatMessages.style.display = 'flex';
      quickPills.style.display = 'flex';
      chatFooter.style.display = 'flex';
      docPane.classList.remove('active');
    });

    summarizeTab.addEventListener('click', () => {
      activeTab = 'summarize';
      summarizeTab.classList.add('active');
      chatTab.classList.remove('active');
      chatMessages.style.display = 'none';
      quickPills.style.display = 'none';
      chatFooter.style.display = 'none';
      docPane.classList.add('active');
    });

    // Quick prompt pills
    quickPills.querySelectorAll('.ai-pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const query = btn.getAttribute('data-query');
        chatInput.value = query;
        handleSendMessage();
      });
    });

    // Send on Enter
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    sendBtn.addEventListener('click', handleSendMessage);

    // Attach File in chat
    attachBtn.addEventListener('click', () => chatFileInput.click());
    chatFileInput.addEventListener('change', () => {
      if (chatFileInput.files && chatFileInput.files[0]) {
        const f = chatFileInput.files[0];
        // Switch to summarizer tab and select file
        selectedDocFile = f;
        summarizeTab.click();
        renderSelectedFilePreview(f);
      }
    });

    // Doc Summarizer File Pick
    docDropzone.addEventListener('click', () => docFileInput.click());
    docFileInput.addEventListener('change', () => {
      if (docFileInput.files && docFileInput.files[0]) {
        selectedDocFile = docFileInput.files[0];
        renderSelectedFilePreview(selectedDocFile);
      }
    });

    // Drag & Drop
    docDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      docDropzone.classList.add('dragover');
    });
    docDropzone.addEventListener('dragleave', () => {
      docDropzone.classList.remove('dragover');
    });
    docDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      docDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        selectedDocFile = e.dataTransfer.files[0];
        renderSelectedFilePreview(selectedDocFile);
      }
    });

    function renderSelectedFilePreview(file) {
      docDropzone.innerHTML = `
        <span class="material-symbols-outlined ai-upload-icon" style="color: #059669;">check_circle</span>
        <div class="ai-upload-title" style="color: #059669;">${escapeHTML(file.name)}</div>
        <div class="ai-upload-desc">${Math.round(file.size / 1024)} KB • Click to change file</div>
      `;
    }

    // Submit Document for Summarization
    docSubmitBtn.addEventListener('click', async () => {
      if (!selectedDocFile) {
        alert('Please choose or drop a PDF or image file first.');
        return;
      }

      docResults.style.display = 'block';
      docResults.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; color: #C59B27; font-weight: 600;">
          <span class="material-symbols-outlined" style="animation: spin 1s infinite linear;">progress_activity</span>
          <span>Reading & analyzing document with AI...</span>
        </div>
      `;
      docSubmitBtn.disabled = true;

      try {
        const formData = new FormData();
        formData.append('document', selectedDocFile);
        if (docPrompt.value.trim()) {
          formData.append('prompt', docPrompt.value.trim());
        }

        const res = await fetch('/api/ai/summarize', {
          method: 'POST',
          body: formData,
        });

        const json = await res.json();
        if (json.success && json.data) {
          const warningHtml = json.data.warning
            ? `<div style="background: #FFF3CD; border: 1px solid #FFC107; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 12px; color: #856404; display: flex; align-items: flex-start; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 18px; color: #D4A017; flex-shrink: 0;">warning</span>
                <div>
                  <strong>AI Vision Not Configured:</strong> ${escapeHTML(json.data.warning)}
                  <div style="margin-top: 6px;">
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #856404; font-weight: 600; text-decoration: underline;">Get free Gemini API key</a>
                    &mdash; Add to <code style="background: rgba(0,0,0,0.08); padding: 1px 4px; border-radius: 3px;">.env</code> as <code style="background: rgba(0,0,0,0.08); padding: 1px 4px; border-radius: 3px;">GEMINI_API_KEY</code>
                  </div>
                </div>
              </div>`
            : '';
          docResults.innerHTML = `
            ${warningHtml}
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #E2E8F0;">
              <span style="font-weight: 700; color: #0A1128;">${escapeHTML(json.data.fileName)}</span>
              <span class="badge badge-gold" style="font-size: 10px;">${escapeHTML(json.data.source)}</span>
            </div>
            <div>${renderMarkdown(json.data.summary)}</div>
          `;
        } else {
          docResults.innerHTML = `
            <div style="color: #DC2626;">
              <strong>Error:</strong> ${escapeHTML(json.message || 'Failed to summarize document.')}
            </div>
          `;
        }
      } catch (err) {
        docResults.innerHTML = `
          <div style="color: #DC2626;">
            <strong>Network Error:</strong> ${escapeHTML(err.message)}
          </div>
        `;
      } finally {
        docSubmitBtn.disabled = false;
      }
    });

    // Chat Message Flow
    async function handleSendMessage() {
      const text = chatInput.value.trim();
      if (!text || isThinking) return;

      // Append user bubble
      appendMessage('user', text);
      chatInput.value = '';
      chatInput.focus();

      // Show thinking bubble
      const thinkingEl = appendThinking();
      isThinking = true;
      sendBtn.disabled = true;

      try {
        const res = await api.post('/ai/chat', {
          prompt: text,
          history: chatHistory.slice(-8),
        });

        thinkingEl.remove();

        if (res && res.success && res.data) {
          const reply = res.data.reply;
          appendMessage('assistant', reply);
          chatHistory.push({ role: 'user', content: text });
          chatHistory.push({ role: 'assistant', content: reply });
          try {
            sessionStorage.setItem('digidiary_ai_history', JSON.stringify(chatHistory));
          } catch (e) {}
        } else {
          appendMessage('assistant', (res && res.message) || 'I encountered an issue generating a response.');
        }
      } catch (err) {
        thinkingEl.remove();
        appendMessage('assistant', `Error connecting to AI assistant: ${err.message || 'Please verify network connection.'}`);
      } finally {
        isThinking = false;
        sendBtn.disabled = false;
      }
    }

    function appendMessage(role, content) {
      const msg = document.createElement('div');
      msg.className = `ai-msg ${role}`;
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      msg.innerHTML = `
        <div class="ai-msg-bubble">
          ${role === 'assistant' ? renderMarkdown(content) : escapeHTML(content)}
        </div>
        <span class="ai-msg-time">${now}</span>
      `;
      chatMessages.appendChild(msg);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendThinking() {
      const el = document.createElement('div');
      el.className = 'ai-msg assistant';
      el.innerHTML = `
        <div class="ai-msg-bubble">
          <div class="ai-thinking-dots">
            <div class="ai-dot"></div>
            <div class="ai-dot"></div>
            <div class="ai-dot"></div>
          </div>
        </div>
      `;
      chatMessages.appendChild(el);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return el;
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createAIWidget);
  } else {
    createAIWidget();
  }
})();
