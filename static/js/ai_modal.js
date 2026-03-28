/**
 * Advanced AI Writing Assistant - Fixed Version
 * Addresses: API integration, event handling, error management, and UX issues
 */

class AdvancedAIAssistant {
    constructor() {
        this.isOpen = false;
        this.isProcessing = false;
        this.currentTab = 'features';
        this.chatHistory = [];
        this.usageHistory = [];
        this.recognition = null;
        this.isRecording = false;
        this.requestCount = 0;
        this.apiEndpoint = '/api/ai/process';
        
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('🚀 Initializing AI Assistant...');
        
        // Verify required elements exist
        if (!this.verifyElements()) {
            console.error('❌ Required elements missing');
            return;
        }
        
        this.setupVoiceRecognition();
        this.bindEvents();
        this.loadStoredData();
        this.setupKeyboardShortcuts();
        this.startWordCounter();
        this.checkAPIStatus();
        
        console.log('✅ AI Assistant initialized successfully');
    }

    verifyElements() {
        const required = [
            'aiToggleBtn',
            'aiPanel',
            'closeAiBtn',
            'chatContainer',
            'sendChatBtn',
            'chatInput'
        ];
        
        const missing = required.filter(id => !document.getElementById(id));
        
        if (missing.length > 0) {
            console.error('Missing elements:', missing);
            return false;
        }
        
        return true;
    }

    async checkAPIStatus() {
        try {
            const response = await fetch('/api/ai/test', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                console.warn('⚠️ AI API not available, using mock mode');
                this.mockMode = true;
            } else {
                const data = await response.json();
                console.log('✅ AI API status:', data);
                this.mockMode = !data.ready;
            }
        } catch (error) {
            console.warn('⚠️ API check failed, using mock mode:', error);
            this.mockMode = true;
        }
    }

    setupVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                const chatInput = document.getElementById('chatInput');
                if (chatInput) chatInput.value = transcript;
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                const voiceBtn = document.getElementById('voiceBtn');
                if (voiceBtn) voiceBtn.classList.remove('recording');
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.showToast('Voice input failed: ' + event.error, 'error');
                this.isRecording = false;
                const voiceBtn = document.getElementById('voiceBtn');
                if (voiceBtn) voiceBtn.classList.remove('recording');
            };
        }
    }

    bindEvents() {
        // Toggle button
        const toggleBtn = document.getElementById('aiToggleBtn');
        const closeBtn = document.getElementById('closeAiBtn');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        // Tab switching
        document.querySelectorAll('.ai-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(tab.dataset.tab);
            });
        });

        // Feature buttons
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!this.isProcessing) {
                    this.processFeature(btn.dataset.feature);
                }
            });
        });

        // Chat functionality
        const sendBtn = document.getElementById('sendChatBtn');
        const chatInput = document.getElementById('chatInput');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.sendChatMessage();
            });
        }
        
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }

        // Voice input
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn && this.recognition) {
            voiceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleVoice();
            });
        }

        // History controls
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        const exportHistoryBtn = document.getElementById('exportHistoryBtn');
        
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearHistory();
            });
        }
        
        if (exportHistoryBtn) {
            exportHistoryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportHistory();
            });
        }

        // Help button
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showHelp();
            });
        }

        // Click outside to close
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('aiPanel');
            const toggleBtn = document.getElementById('aiToggleBtn');
            
            if (this.isOpen && panel && !panel.contains(e.target) && 
                e.target !== toggleBtn && !toggleBtn?.contains(e.target)) {
                this.close();
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt+A to toggle
            if (e.altKey && e.key === 'a') {
                e.preventDefault();
                this.toggle();
            }
            
            // Escape to close
            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.close();
            }
        });
    }

    startWordCounter() {
        setInterval(() => {
            if (this.isOpen && this.currentTab === 'features') {
                this.updateWordCount();
            }
        }, 1000);
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        const panel = document.getElementById('aiPanel');
        
        if (panel) {
            panel.classList.add('show');
            this.updateWordCount();
            this.loadRequestCount();
            
            if (this.currentTab === 'chat') {
                setTimeout(() => {
                    const chatInput = document.getElementById('chatInput');
                    if (chatInput) chatInput.focus();
                }, 300);
            }
        }
    }

    close() {
        this.isOpen = false;
        const panel = document.getElementById('aiPanel');
        if (panel) panel.classList.remove('show');
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        document.querySelectorAll('.ai-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.content === tabName);
        });

        if (tabName === 'history') {
            this.renderHistory();
        } else if (tabName === 'chat') {
            this.renderChatHistory();
            setTimeout(() => {
                const chatInput = document.getElementById('chatInput');
                if (chatInput) chatInput.focus();
            }, 100);
        }
    }

    async processFeature(feature) {
        const editor = this.getActiveEditor();
        const content = this.getEditorContent(editor);

        // Validate content requirements
        if (!content && !['continue', 'custom'].includes(feature)) {
            this.showToast('Please write some content first!', 'warning');
            return;
        }

        if (content.length > 50000) {
            this.showToast('Content too long (max 50,000 characters)', 'error');
            return;
        }

        this.showProcessing(true, `Processing ${this.getFeatureName(feature)}...`);

        try {
            let result;
            
            if (this.mockMode) {
                // Use mock API
                result = await this.mockApiCall(feature, content);
            } else {
                // Use real API
                result = await this.callRealAPI(feature, content);
            }
            
            if (result.success) {
                // Update editor with result
                if (editor && result.content) {
                    editor.innerHTML = result.content;
                }
                
                this.showToast(`${this.getFeatureName(feature)} completed!`, 'success');
                this.addToHistory(feature, content, result.content || 'Success');
                this.incrementRequestCount();
                
                setTimeout(() => this.close(), 1500);
            } else {
                throw new Error(result.message || 'Processing failed');
            }
        } catch (error) {
            console.error('Feature processing error:', error);
            this.showToast(error.message || 'Operation failed. Please try again', 'error');
        } finally {
            this.showProcessing(false);
        }
    }

async callRealAPI(feature, content, extraOptions = {}) {
    // Get clean text content (strip HTML)
    const cleanContent = this.stripHTML(content);
    
// ai_modal.js (FIX)
// Base options from feature tab (tone/language selectors)
const baseOptions = {
    toneStyle: document.getElementById('toneSelect')?.value || 'professional',
    targetLanguage: document.getElementById('targetLanguage')?.value || 'en'
};

// Merge base options with extra options passed from functions like sendChatMessage
// customPrompt, if present in extraOptions, will be added here
const finalOptions = { ...baseOptions, ...extraOptions }; // <--- THIS IS THE KEY FIX

const payload = {
    feature: feature,
    content: cleanContent,
    options: finalOptions // <--- Use the merged options
};

    // Debug log
    console.log('🚀 Sending to API:', {
        feature: payload.feature,
        contentLength: payload.content.length,
        options: payload.options
    });

    try {
        // 🔑 FIX: Get CSRF token from meta tag (assuming it's available in the HTML)
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (!csrfToken) {
            throw new Error('CSRF token not found in page. Refresh and try again.');
        }

        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,  // 🔑 Add this header
                'X-Requested-With': 'XMLHttpRequest'  // Optional: Helps Flask identify AJAX requests
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            console.error('❌ API Error:', { status: response.status, message: errorData.message, fullResponse: errorData });
            throw new Error(errorData.message || `API error (${response.status})`);
        }
        
        const data = await response.json();
        
        // Log successful response details
        console.log('📥 API Response:', data);
        
        return data;
    } catch (error) {
        console.error('API Call Details:', { endpoint: this.apiEndpoint, feature, contentLength: cleanContent.length, options, error: error.message });
        throw error;
    }
}

    async sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput?.value.trim();

        if (!message) {
            this.showToast('Please enter a message', 'warning');
            return;
        }

        if (message.length > 500) {
            this.showToast('Message too long (max 500 characters)', 'error');
            return;
        }

        // Add user message immediately
        this.addChatMessage('user', message);
        chatInput.value = '';

        this.showProcessing(true, 'AI is thinking...');

        try {
            let aiResponse;
            
            if (this.mockMode) {
                // Simulate delay
                await new Promise(resolve => setTimeout(resolve, 1500));
                aiResponse = this.generateMockResponse(message);
            } else {
                // Use custom prompt endpoint
                const result = await this.callRealAPI('custom', '', {
                    customPrompt: message
                });
                
                if (!result.success) {
                    throw new Error(result.message || 'Chat failed');
                }
                
                aiResponse = this.stripHTML(result.content);
            }
            
            this.addChatMessage('ai', aiResponse);
            this.addToHistory('chat', message, aiResponse);
            this.incrementRequestCount();
        } catch (error) {
            console.error('Chat error:', error);
            this.addChatMessage('ai', `Sorry, I encountered an error: ${error.message}`);
        } finally {
            this.showProcessing(false);
        }
    }

    mockApiCall(feature, content) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let result = '';

                switch(feature) {
                    case 'grammar':
                        result = `<div class="ai-result"><p>✓ Grammar corrected: ${content}</p></div>`;
                        break;
                    case 'improve':
                        result = `<div class="ai-result"><p>✨ Enhanced: ${content}</p></div>`;
                        break;
                    case 'summarize':
                        result = `<div class="ai-result"><p><strong>Summary:</strong></p><ul><li>Key point 1</li><li>Key point 2</li><li>Key point 3</li></ul></div>`;
                        break;
                    case 'expand':
                        result = `<div class="ai-result"><p>${content}</p><p>This expanded content provides additional details and context to enhance understanding...</p></div>`;
                        break;
                    case 'translate':
                        const lang = document.getElementById('targetLanguage')?.value || 'en';
                        result = `<div class="ai-result"><p>🌍 Translated to ${lang}: [Translation of: ${content}]</p></div>`;
                        break;
                    case 'tone':
                        const tone = document.getElementById('toneSelect')?.value || 'professional';
                        result = `<div class="ai-result"><p>🎭 Adjusted to ${tone} tone: ${content}</p></div>`;
                        break;
                    case 'bullet-points':
                        result = `<div class="ai-result"><ul><li>Point 1 from content</li><li>Point 2 from content</li><li>Point 3 from content</li></ul></div>`;
                        break;
                    case 'continue':
                        result = `<div class="ai-result"><p>${content}</p><hr><p>Continuing from where you left off, here are additional thoughts and ideas...</p></div>`;
                        break;
                    default:
                        result = `<div class="ai-result"><p>Processed: ${content}</p></div>`;
                }
                
                resolve({ success: true, content: result, feature });
            }, 2000);
        });
    }

    generateMockResponse(message) {
        const lowercaseMsg = message.toLowerCase();
        
        if (lowercaseMsg.includes('help')) {
            return "I can help you with grammar checking, writing improvement, summarization, translation, and more. Select text and use the feature buttons!";
        } else if (lowercaseMsg.includes('how')) {
            return "Simply select your text in the editor, then click one of the feature buttons like 'Grammar', 'Improve', or 'Summarize' to enhance your content.";
        } else {
            const responses = [
                "That's an interesting question! Let me help you with that.",
                "I understand what you're looking for. Here's my suggestion...",
                "Great point! Based on your input, I recommend...",
                "I can help with that. Here's what I think...",
                "Excellent question! Let me provide some insights..."
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }
    }

    getActiveEditor() {
        // Try multiple common editor selectors
        const selectors = [
            '.page-content[contenteditable="true"]',
            '#editor[contenteditable="true"]',
            '[contenteditable="true"]',
            'textarea.editor',
            '#content'
        ];
        
        for (const selector of selectors) {
            const editor = document.querySelector(selector);
            if (editor) return editor;
        }
        
        return null;
    }

    getEditorContent(editor) {
        if (!editor) return '';
        
        if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
            return editor.value;
        }
        
        return editor.innerHTML || editor.textContent || '';
    }

    stripHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    updateWordCount() {
        const editor = this.getActiveEditor();
        if (!editor) {
            const wordCountEl = document.getElementById('wordCount');
            const charCountEl = document.getElementById('charCount');
            if (wordCountEl) wordCountEl.textContent = '0';
            if (charCountEl) charCountEl.textContent = '0';
            return;
        }
        
        const text = this.stripHTML(this.getEditorContent(editor));
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        
        const wordCountEl = document.getElementById('wordCount');
        const charCountEl = document.getElementById('charCount');
        
        if (wordCountEl) wordCountEl.textContent = words;
        if (charCountEl) charCountEl.textContent = chars;
    }

    toggleVoice() {
        if (!this.recognition) {
            this.showToast('Voice input not supported in your browser', 'warning');
            return;
        }

        this.isRecording = !this.isRecording;
        const voiceBtn = document.getElementById('voiceBtn');

        if (this.isRecording) {
            voiceBtn?.classList.add('recording');
            try {
                this.recognition.start();
                this.showToast('🎤 Listening...', 'info');
            } catch (error) {
                console.error('Voice start error:', error);
                this.isRecording = false;
                voiceBtn?.classList.remove('recording');
                this.showToast('Could not start voice input', 'error');
            }
        } else {
            voiceBtn?.classList.remove('recording');
            this.recognition.stop();
        }
    }

    addChatMessage(type, message) {
        this.chatHistory.push({
            type,
            message,
            timestamp: new Date().toISOString()
        });
        
        if (this.chatHistory.length > 50) {
            this.chatHistory.shift();
        }
        
        this.saveChatHistory();
        this.renderChatHistory();
    }

    renderChatHistory() {
        const container = document.getElementById('chatContainer');
        if (!container) return;

        if (this.chatHistory.length === 0) {
            container.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <p>Start a conversation with AI</p>
                    <small>Ask me anything or give instructions</small>
                </div>
            `;
            return;
        }

        container.innerHTML = this.chatHistory.map(chat => {
            const time = new Date(chat.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            return `
                <div class="chat-message ${chat.type}-message">
                    <div class="message-bubble">
                        ${this.escapeHTML(chat.message)}
                    </div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }).join('');

        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }

    addToHistory(feature, input, output) {
        this.usageHistory.push({
            feature,
            input: this.stripHTML(input).substring(0, 200),
            output: this.stripHTML(output).substring(0, 200),
            timestamp: new Date().toISOString()
        });
        
        if (this.usageHistory.length > 100) {
            this.usageHistory.shift();
        }
        
        this.saveHistory();
    }

    renderHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        if (this.usageHistory.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>No history yet</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = this.usageHistory.slice().reverse().map((item, index) => {
            const time = new Date(item.timestamp).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="history-item" data-index="${this.usageHistory.length - 1 - index}">
                    <div class="history-item-header">
                        <span class="history-feature">${this.getFeatureName(item.feature)}</span>
                        <span class="history-time">${time}</span>
                    </div>
                    <div class="history-content">${this.escapeHTML(item.input)}</div>
                </div>
            `;
        }).join('');

        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.restoreFromHistory(index);
            });
        });
    }

    restoreFromHistory(index) {
        const item = this.usageHistory[index];
        if (!item) return;

        const editor = this.getActiveEditor();
        if (editor) {
            if (confirm(`Restore content from ${this.getFeatureName(item.feature)}?`)) {
                if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
                    editor.value = item.output;
                } else {
                    editor.innerHTML = `<p>${item.output}</p>`;
                }
                this.showToast('Content restored from history', 'success');
                this.switchTab('features');
            }
        } else {
            this.showToast('No editor found to restore content', 'warning');
        }
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all history?')) {
            this.usageHistory = [];
            this.saveHistory();
            this.renderHistory();
            this.showToast('History cleared', 'info');
        }
    }

    exportHistory() {
        if (this.usageHistory.length === 0) {
            this.showToast('No history to export', 'warning');
            return;
        }

        const data = JSON.stringify(this.usageHistory, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('History exported successfully', 'success');
    }

    loadStoredData() {
        try {
            const chatData = localStorage.getItem('ai_chat_history');
            if (chatData) this.chatHistory = JSON.parse(chatData);

            const historyData = localStorage.getItem('ai_usage_history');
            if (historyData) this.usageHistory = JSON.parse(historyData);

            const requestData = localStorage.getItem('ai_request_count');
            if (requestData) {
                const data = JSON.parse(requestData);
                const today = new Date().toDateString();
                if (data.date === today) {
                    this.requestCount = data.count;
                } else {
                    this.requestCount = 0;
                    this.saveRequestCount();
                }
            }
        } catch (error) {
            console.error('Error loading stored data:', error);
        }
    }

    saveChatHistory() {
        try {
            localStorage.setItem('ai_chat_history', JSON.stringify(this.chatHistory));
        } catch (error) {
            console.error('Error saving chat history:', error);
        }
    }

    saveHistory() {
        try {
            localStorage.setItem('ai_usage_history', JSON.stringify(this.usageHistory));
        } catch (error) {
            console.error('Error saving history:', error);
        }
    }

    saveRequestCount() {
        try {
            const data = {
                date: new Date().toDateString(),
                count: this.requestCount
            };
            localStorage.setItem('ai_request_count', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving request count:', error);
        }
    }

    incrementRequestCount() {
        this.requestCount++;
        this.saveRequestCount();
        this.loadRequestCount();
    }

    loadRequestCount() {
        const countEl = document.getElementById('requestCount');
        if (countEl) countEl.textContent = this.requestCount;
    }

    showProcessing(show, message = 'Processing...') {
        this.isProcessing = show;
        const processingEl = document.getElementById('aiProcessing');
        
        if (processingEl) {
            processingEl.style.display = show ? 'flex' : 'none';
            if (show && message) {
                const textEl = processingEl.querySelector('span');
                if (textEl) textEl.textContent = message;
            }
        }
        
        // Disable all action buttons while processing
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.disabled = show;
            btn.style.opacity = show ? '0.5' : '1';
            btn.style.cursor = show ? 'not-allowed' : 'pointer';
        });
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.log(`Toast (${type}):`, message);
            return;
        }

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span>${this.escapeHTML(message)}</span>
        `;

        container.appendChild(toast);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showHelp() {
        const helpMessage = `AI Assistant Help

Keyboard Shortcuts:
• Alt+A - Toggle panel
• Ctrl+Enter - Send chat message
• Escape - Close panel

Features:
• Grammar Check - Fix spelling and grammar
• Improve Writing - Enhance quality and clarity
• Summarize - Create concise summaries
• Expand - Add more details
• Translate - Convert to other languages
• Change Tone - Adjust writing style
• Bullet Points - Convert to list format
• Continue Writing - Extend your content

How to Use:
1. Write or select text in the editor
2. Click a feature button
3. Wait for AI to process
4. Review and use the result

Tips:
• Use Chat tab for custom requests
• Check History tab for past operations
• Voice input available in Chat tab`;
        
        alert(helpMessage);
    }

    getFeatureName(feature) {
        const names = {
            'grammar': 'Grammar Check',
            'improve': 'Improve Writing',
            'summarize': 'Summarize',
            'expand': 'Expand Content',
            'translate': 'Translate',
            'tone': 'Change Tone',
            'bullet-points': 'Bullet Points',
            'continue': 'Continue Writing',
            'chat': 'Chat',
            'custom': 'Custom Request'
        };
        return names[feature] || feature;
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.aiAssistant = new AdvancedAIAssistant();
    });
} else {
    window.aiAssistant = new AdvancedAIAssistant();
}