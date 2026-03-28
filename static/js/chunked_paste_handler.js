/**
 * ===================================================================
 * ⚡ PRODUCTION READY CHUNKED PASTE HANDLER
 * ===================================================================
 * Features:
 * - Visual progress bar (0-100%)
 * - Stable chunked processing
 * - Plain text & HTML support
 * - Memory efficient
 * - Error handling
 * - Works on all browsers
 */

class ProductionChunkedPasteHandler {
    constructor() {
        // Configuration
        this.CHUNK_SIZE = 1000;           // Characters per chunk
        this.CHUNK_DELAY = 30;            // Milliseconds between chunks
        this.MAX_PASTE_SIZE = 500000;     // Max 500KB paste
        
        // State tracking
        this.isPasting = false;
        this.currentPaste = null;
        this.processedChunks = 0;
        this.totalChunks = 0;
        
        console.log('🎯 Production Chunked Paste Handler initializing...');
        this.init();
    }

    /**
     * Initialize paste handler
     */
    init() {
        // Add CSS animations
        this.injectStyles();
        
        // Attach paste event listener
        document.addEventListener('paste', (e) => {
            if (e.target.classList.contains('page-content')) {
                this.handlePasteEvent(e);
            }
        });

        console.log('✅ Production Paste Handler ready');
    }

    /**
     * Main paste event handler
     */
    handlePasteEvent(e) {
        e.preventDefault();
        
        // Don't allow simultaneous pastes
        if (this.isPasting) {
            console.log('⏳ Already pasting, please wait...');
            this.showNotification('Paste in progress, please wait...', 'warning');
            return;
        }

        const pageContent = e.target;
        const clipboardData = e.clipboardData || window.clipboardData;
        
        // Try HTML first, fallback to plain text
        let pasteContent = clipboardData.getData('text/html') || 
                          clipboardData.getData('text/plain');
        
        if (!pasteContent || pasteContent.trim().length === 0) {
            console.warn('⚠️ Empty paste detected');
            return;
        }

        // Check size limit
        if (pasteContent.length > this.MAX_PASTE_SIZE) {
            console.error('❌ Paste too large');
            this.showNotification(
                `Content too large (${Math.round(pasteContent.length / 1024)}KB). Max: 500KB`,
                'error'
            );
            return;
        }

        console.log(`📥 Paste detected: ${pasteContent.length} characters`);

        // Process paste
        this.processPaste(pageContent, pasteContent);
    }

    /**
     * Main paste processing function
     */
    processPaste(pageContent, content) {
        // Mark as pasting
        this.isPasting = true;
        this.processedChunks = 0;
        
        // Split into chunks
        const chunks = this.createChunks(content);
        this.totalChunks = chunks.length;
        
        console.log(`📦 Split into ${this.totalChunks} chunks`);

        // Show progress UI
        this.showProgressBar();

        // Process chunks sequentially
        this.processChunkSequence(pageContent, chunks, 0);
    }

    /**
     * Create chunks from content
     */
    createChunks(content) {
        const chunks = [];
        let index = 0;

        while (index < content.length) {
            let endIndex = Math.min(index + this.CHUNK_SIZE, content.length);

            // Try to break at a boundary (newline or space)
            if (endIndex < content.length) {
                const lookback = 200;
                const searchStart = Math.max(index, endIndex - lookback);
                
                // Find last newline
                const lastNewline = content.lastIndexOf('\n', endIndex);
                if (lastNewline > searchStart) {
                    endIndex = lastNewline + 1;
                } else {
                    // Find last space
                    const lastSpace = content.lastIndexOf(' ', endIndex);
                    if (lastSpace > searchStart) {
                        endIndex = lastSpace + 1;
                    }
                }
            }

            const chunk = content.substring(index, endIndex).trim();
            if (chunk.length > 0) {
                chunks.push(chunk);
            }
            
            index = endIndex;
        }

        return chunks;
    }

    /**
     * Process chunks sequentially with proper error handling
     */
    processChunkSequence(pageContent, chunks, chunkIndex) {
        // All chunks processed
        if (chunkIndex >= chunks.length) {
            this.completePaste();
            return;
        }

        const chunk = chunks[chunkIndex];

        try {
            // Ensure page content is focused
            pageContent.focus();

            // Determine if HTML or plain text
            const isHTML = chunk.includes('<') && chunk.includes('>');

            if (isHTML) {
                // Insert HTML directly
                document.execCommand('insertHTML', false, chunk);
            } else {
                // Insert plain text with smart formatting
                this.insertPlainText(chunk);
            }

            // Update progress
            this.processedChunks++;
            this.updateProgress();

            // Schedule next chunk
            setTimeout(() => {
                this.processChunkSequence(pageContent, chunks, chunkIndex + 1);
            }, this.CHUNK_DELAY);

        } catch (error) {
            console.error(`❌ Error processing chunk ${chunkIndex}:`, error);
            
            // Try fallback
            try {
                document.execCommand('insertText', false, chunk);
            } catch (fallbackError) {
                console.error('Fallback failed:', fallbackError);
            }

            // Continue to next chunk anyway
            this.processedChunks++;
            this.updateProgress();

            setTimeout(() => {
                this.processChunkSequence(pageContent, chunks, chunkIndex + 1);
            }, this.CHUNK_DELAY);
        }
    }

    /**
     * Insert plain text with proper formatting
     */
    insertPlainText(text) {
        // Escape HTML characters
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        // Split by lines
        const lines = escaped.split('\n');

        lines.forEach((line, index) => {
            if (line.trim().length === 0) {
                // Empty line - add paragraph break
                document.execCommand('insertHTML', false, '<p><br></p>');
            } else {
                // Insert line content
                document.execCommand('insertHTML', false, `<p>${line}</p>`);
            }
        });
    }

    /**
     * Show progress bar UI
     */
    showProgressBar() {
        // Remove existing progress bar
        const existing = document.getElementById('paste-progress-container');
        if (existing) existing.remove();

        // Create container
        const container = document.createElement('div');
        container.id = 'paste-progress-container';
        container.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: white;
            border: 2px solid #667eea;
            border-radius: 12px;
            padding: 20px;
            z-index: 10000;
            min-width: 350px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
            animation: slideInUp 0.3s ease;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            font-weight: 600;
            color: #333;
        `;
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-paste';
        icon.style.cssText = 'color: #667eea; font-size: 18px;';
        
        const title = document.createElement('span');
        title.textContent = 'Pasting Content...';
        title.style.cssText = 'flex: 1; font-size: 14px;';

        header.appendChild(icon);
        header.appendChild(title);

        // Progress bar wrapper
        const barWrapper = document.createElement('div');
        barWrapper.style.cssText = `
            background: #f0f0f0;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
            border: 1px solid #e0e0e0;
        `;

        // Progress bar fill
        const barFill = document.createElement('div');
        barFill.id = 'paste-progress-fill';
        barFill.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            width: 0%;
            transition: width 0.2s ease;
            border-radius: 4px;
        `;
        barWrapper.appendChild(barFill);

        // Progress text
        const progressText = document.createElement('div');
        progressText.id = 'paste-progress-text';
        progressText.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: #666;
        `;
        
        const percentSpan = document.createElement('span');
        percentSpan.id = 'paste-percent';
        percentSpan.style.cssText = 'font-weight: 700; color: #667eea; font-size: 13px;';
        percentSpan.textContent = '0%';
        
        const chunkSpan = document.createElement('span');
        chunkSpan.id = 'paste-chunks';
        chunkSpan.textContent = `0 / ${this.totalChunks} chunks`;
        
        progressText.appendChild(chunkSpan);
        progressText.appendChild(percentSpan);

        // Assemble
        container.appendChild(header);
        container.appendChild(barWrapper);
        container.appendChild(progressText);
        document.body.appendChild(container);

        console.log('📊 Progress bar shown');
    }

    /**
     * Update progress bar
     */
    updateProgress() {
        const percentage = Math.round((this.processedChunks / this.totalChunks) * 100);
        
        // Update fill
        const fill = document.getElementById('paste-progress-fill');
        if (fill) {
            fill.style.width = `${percentage}%`;
        }

        // Update percentage text
        const percentSpan = document.getElementById('paste-percent');
        if (percentSpan) {
            percentSpan.textContent = `${percentage}%`;
        }

        // Update chunks text
        const chunksSpan = document.getElementById('paste-chunks');
        if (chunksSpan) {
            chunksSpan.textContent = `${this.processedChunks} / ${this.totalChunks} chunks`;
        }

        console.log(`📊 Progress: ${percentage}% (${this.processedChunks}/${this.totalChunks})`);
    }

    /**
     * Complete paste operation
     */
    completePaste() {
        console.log('✅ Paste completed successfully!');
        
        this.isPasting = false;

        // Show completion
        this.updateProgress(); // Set to 100%
        
        // Keep progress visible for 1.5 seconds
        setTimeout(() => {
            this.closeProgressBar();
        }, 1500);

        // Trigger editor updates
        this.triggerEditorUpdates();
    }

    /**
     * Close progress bar
     */
    closeProgressBar() {
        const container = document.getElementById('paste-progress-container');
        if (container) {
            container.style.animation = 'slideOutDown 0.3s ease';
            setTimeout(() => container.remove(), 300);
        }
    }

    /**
     * Trigger editor update functions
     */
    triggerEditorUpdates() {
        // Update word editor
        if (window.wordEditor) {
            if (typeof window.wordEditor.updateEditorState === 'function') {
                window.wordEditor.updateEditorState();
            }
            if (typeof window.wordEditor.updateNavigation === 'function') {
                window.wordEditor.updateNavigation();
            }
            if (typeof window.wordEditor.updateCounts === 'function') {
                window.wordEditor.updateCounts();
            }
        }

        // Check for overflow
        if (window.smartOverflowUnderflow) {
            if (typeof window.smartOverflowUnderflow.smartCheckAllPages === 'function') {
                setTimeout(() => {
                    window.smartOverflowUnderflow.smartCheckAllPages('paste');
                }, 100);
            }
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 30px;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 13px;
            z-index: 9999;
            animation: slideInUp 0.3s ease;
        `;

        if (type === 'error') {
            notif.style.background = '#f8d7da';
            notif.style.color = '#721c24';
            notif.style.border = '1px solid #f5c6cb';
        } else if (type === 'warning') {
            notif.style.background = '#fff3cd';
            notif.style.color = '#856404';
            notif.style.border = '1px solid #ffeeba';
        } else {
            notif.style.background = '#d4edda';
            notif.style.color = '#155724';
            notif.style.border = '1px solid #c3e6cb';
        }

        notif.textContent = message;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.animation = 'slideOutDown 0.3s ease';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    /**
     * Inject CSS animations
     */
    injectStyles() {
        if (document.getElementById('paste-handler-styles')) return;

        const style = document.createElement('style');
        style.id = 'paste-handler-styles';
        style.textContent = `
            @keyframes slideInUp {
                from {
                    transform: translateY(50px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutDown {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(50px);
                    opacity: 0;
                }
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(50px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(50px);
                    opacity: 0;
                }
            }

            /* Progress bar styling */
            #paste-progress-fill {
                transition: width 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Debug info
     */
    getStats() {
        return {
            'Chunk Size': `${this.CHUNK_SIZE} chars`,
            'Chunk Delay': `${this.CHUNK_DELAY}ms`,
            'Max Paste': `${Math.round(this.MAX_PASTE_SIZE / 1024)}KB`,
            'Currently Pasting': this.isPasting,
            'Processed Chunks': this.processedChunks,
            'Total Chunks': this.totalChunks
        };
    }
}

// ==================== INITIALIZATION ====================

window.chunkedPasteHandler = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize after small delay to ensure DOM is ready
    setTimeout(() => {
        if (!window.chunkedPasteHandler) {
            window.chunkedPasteHandler = new ProductionChunkedPasteHandler();
            console.log('✅ Production Paste Handler initialized');
            console.log('📊 Stats:', window.chunkedPasteHandler.getStats());
        }
    }, 300);
});

// Prevent duplicate initialization
if (window.chunkedPasteHandlerLoaded) {
    console.warn('⚠️ Paste handler already loaded');
} else {
    window.chunkedPasteHandlerLoaded = true;
    console.log('🚀 Production Chunked Paste Handler loaded successfully');
}