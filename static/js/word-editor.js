/**
 * ====================================================================
 * MS WORD-LIKE EDITOR - PROPER PAPER SIZE & OVERFLOW HANDLING (FIXED)
 * ====================================================================
 * Paper sizes like MS Word
 * Proper overflow detection and content distribution
 * FIXED: Auto overflow detection on ALL pages
 */

class MSWordLikeEditor {
    constructor() {
        this.container = document.getElementById('pagesContainer');
        this.paperSize = 'a4';
        this.margins = { top: 20, right: 20, bottom: 20, left: 20 }; // mm
        
        // Paper sizes (width x height in mm)
        this.paperSizes = {
            'a4': { width: 210, height: 297, name: 'A4' },
            'a3': { width: 297, height: 420, name: 'A3' },
            'a5': { width: 148, height: 210, name: 'A5' },
            'letter': { width: 215.9, height: 279.4, name: 'Letter' },
            'legal': { width: 215.9, height: 355.6, name: 'Legal' }
        };
        
        // Timeout tracking
        this.overflowCheckTimers = new Map();
        
        console.log('🚀 MS Word-like Editor initializing...');
    }

    init() {
        this.setupPages();
        this.bindEvents();
        this.bindPaperSizeSelector();
        console.log('✅ Editor initialized');
    }

    setupPages() {
        if (!this.container) {
            console.error('❌ Pages container not found');
            return;
        }

        const pages = this.container.querySelectorAll('.page-content');
        console.log(`📄 Found ${pages.length} pages`);
        
        pages.forEach((page, index) => {
            this.bindPageEvents(page);
        });
    }

    bindPageEvents(pageElement) {
        // FIXED: Use contenteditable detection instead of storing on element
        pageElement.addEventListener('input', (e) => {
            this.scheduleOverflowCheck(pageElement);
        });

        pageElement.addEventListener('paste', (e) => {
            // After paste, check after content settles
            setTimeout(() => {
                this.scheduleOverflowCheck(pageElement);
            }, 50);
        });

        pageElement.addEventListener('keydown', (e) => {
            // On delete/backspace - consolidate pages
            if (e.key === 'Backspace' || e.key === 'Delete') {
                setTimeout(() => {
                    this.consolidatePages();
                }, 50);
            }
        });

        // FIXED: Also check on blur (when user clicks away)
        pageElement.addEventListener('blur', (e) => {
            setTimeout(() => {
                this.checkPageOverflow(pageElement);
            }, 100);
        });
    }

    // FIXED: Better timeout management
    scheduleOverflowCheck(pageElement) {
        // Get unique ID for this page
        const pageDiv = pageElement.closest('.editor-page');
        const pageNum = pageDiv ? pageDiv.dataset.page : 'unknown';
        const timeoutKey = `page-${pageNum}`;

        // Clear existing timeout for this page
        if (this.overflowCheckTimers.has(timeoutKey)) {
            clearTimeout(this.overflowCheckTimers.get(timeoutKey));
        }

        // Schedule new check
        const timeout = setTimeout(() => {
            this.checkPageOverflow(pageElement);
            this.overflowCheckTimers.delete(timeoutKey);
        }, 100);

        this.overflowCheckTimers.set(timeoutKey, timeout);
    }

    bindPaperSizeSelector() {
        const selector = document.getElementById('paperSize');
        if (!selector) return;

        selector.addEventListener('change', (e) => {
            this.changePaperSize(e.target.value);
        });
    }

    changePaperSize(size) {
        if (!this.paperSizes[size]) return;

        this.paperSize = size;
        const sizeInfo = this.paperSizes[size];

        // Update container class
        this.container.className = this.container.className.replace(/paper-\w+/g, '');
        this.container.classList.add(`paper-${size}`);

        // Update actual CSS for pages
        const style = document.getElementById('dynamic-paper-size');
        if (style) style.remove();

        const newStyle = document.createElement('style');
        newStyle.id = 'dynamic-paper-size';
        newStyle.innerHTML = `
            .paper-${size} .editor-page {
                width: ${sizeInfo.width}mm !important;
                height: ${sizeInfo.height}mm !important;
                min-height: ${sizeInfo.height}mm !important;
                max-height: ${sizeInfo.height}mm !important;
            }
            .paper-${size} .page-content {
                height: ${sizeInfo.height - (this.margins.top + this.margins.bottom)}mm !important;
                max-height: ${sizeInfo.height - (this.margins.top + this.margins.bottom)}mm !important;
                overflow: hidden !important;
            }
        `;
        document.head.appendChild(newStyle);

        console.log(`📄 Paper size changed to: ${sizeInfo.name} (${sizeInfo.width}mm x ${sizeInfo.height}mm)`);

        // Re-check all pages for overflow after layout settles
        setTimeout(() => {
            this.checkAllPagesForOverflow();
        }, 300);
    }

    checkAllPagesForOverflow() {
        const pages = this.container.querySelectorAll('.page-content');
        console.log(`🔍 Checking ${pages.length} pages for overflow...`);
        
        pages.forEach((page) => {
            this.checkPageOverflow(page);
        });
    }

    checkPageOverflow(pageElement) {
        if (!pageElement || !pageElement.closest('.editor-page')) {
            return;
        }

        const pageDiv = pageElement.closest('.editor-page');
        const pageNum = pageDiv.dataset.page;

        // FIXED: Get measurements more accurately
        const pageHeight = pageDiv.offsetHeight;
        const contentHeight = pageElement.scrollHeight;
        const overflow = contentHeight - pageHeight;

        // FIXED: Log more details for debugging
        if (overflow > 5) {
            console.log(`⚠️ Page ${pageNum}: Overflow ${overflow}px (content: ${contentHeight}px, page: ${pageHeight}px)`);
            this.handlePageOverflow(pageElement);
        } else if (overflow > 0) {
            console.log(`📊 Page ${pageNum}: Minor overflow ${overflow}px (tolerated)`);
        }
    }

    handlePageOverflow(pageElement) {
        const pageDiv = pageElement.closest('.editor-page');
        const pageNum = parseInt(pageDiv.dataset.page);

        console.log(`🔄 Moving content from page ${pageNum}...`);

        // Get or create next page
        let nextPageDiv = document.querySelector(`.editor-page[data-page="${pageNum + 1}"]`);
        let nextPageContent;

        if (!nextPageDiv) {
            this.createNewPage(pageNum + 1);
            nextPageDiv = document.querySelector(`.editor-page[data-page="${pageNum + 1}"]`);
        }

        if (!nextPageDiv) {
            console.error(`❌ Failed to create page ${pageNum + 1}`);
            return;
        }

        nextPageContent = nextPageDiv.querySelector('.page-content');
        if (!nextPageContent) return;

        // Move elements from current to next page
        let moved = false;
        let iterations = 0;
        const maxIterations = 100;

        while (pageElement.scrollHeight > pageElement.offsetHeight + 5 && iterations < maxIterations) {
            const lastChild = pageElement.lastElementChild;

            if (!lastChild || lastChild.textContent.trim().length === 0) {
                break;
            }

            // Move element to next page
            nextPageContent.insertBefore(lastChild, nextPageContent.firstChild);
            moved = true;
            iterations++;

            // Check if next page is overflowing
            if (nextPageContent.scrollHeight > nextPageDiv.offsetHeight + 5) {
                // Move it back and try splitting
                pageElement.appendChild(lastChild);

                // Try to split the element
                if (this.splitElement(lastChild, pageElement, pageDiv.offsetHeight)) {
                    const overflowNode = pageElement.lastElementChild;
                    if (overflowNode && overflowNode !== lastChild) {
                        nextPageContent.insertBefore(overflowNode, nextPageContent.firstChild);
                    }
                }
                break;
            }
        }

        if (moved) {
            console.log(`✅ Moved content, ${iterations} iterations`);
            
            // Renumber pages
            this.renumberPages();
            
            // FIXED: Recursively check if next page is also overflowing
            setTimeout(() => {
                this.checkPageOverflow(nextPageContent);
            }, 50);
        } else {
            console.log(`⚠️ No elements moved from page ${pageNum}`);
        }

        if (iterations >= maxIterations) {
            console.warn(`⚠️ Page ${pageNum}: Reached max iterations (${maxIterations})`);
        }
    }

    splitElement(element, pageElement, maxHeight) {
        const original = element.innerHTML;
        const words = original.split(/(\s+)/);

        let fitted = '';
        let overflow = '';
        let foundSplit = false;

        for (let i = 0; i < words.length; i++) {
            const test = fitted + words[i];
            element.innerHTML = test;

            if (pageElement.scrollHeight <= pageElement.offsetHeight + 5) {
                fitted = test;
            } else {
                overflow = words.slice(i).join('');
                foundSplit = true;
                break;
            }
        }

        element.innerHTML = original;

        if (foundSplit && overflow.length > 0) {
            const newElement = element.cloneNode(false);
            newElement.innerHTML = overflow;
            element.innerHTML = fitted;
            element.parentNode.insertBefore(newElement, element.nextSibling);
            console.log(`✂️ Split element on page`);
            return true;
        }

        return false;
    }

    consolidatePages() {
        const pages = Array.from(this.container.querySelectorAll('.editor-page'));
        console.log(`🔄 Consolidating ${pages.length} pages...`);

        for (let i = pages.length - 1; i >= 1; i--) {
            const currentPageContent = pages[i].querySelector('.page-content');
            const prevPageContent = pages[i - 1].querySelector('.page-content');

            if (!currentPageContent || !prevPageContent) continue;

            // If current page is mostly empty, try to move content from previous
            if (currentPageContent.textContent.trim().length < 100) {
                const lastChild = prevPageContent.lastElementChild;
                
                if (lastChild) {
                    currentPageContent.insertBefore(lastChild, currentPageContent.firstChild);

                    // Check if this caused overflow
                    if (prevPageContent.scrollHeight <= prevPageContent.offsetHeight + 5) {
                        // Success - keep it there
                        console.log(`↑ Moved content to page ${i}`);
                        continue;
                    } else {
                        // Move it back
                        prevPageContent.appendChild(lastChild);
                    }
                }
            }

            // Remove empty pages
            if (currentPageContent.textContent.trim().length === 0 && 
                currentPageContent.innerHTML.trim().length < 50) {
                console.log(`🗑️ Removed empty page ${i}`);
                pages[i].remove();
            }
        }

        this.renumberPages();
    }

    renumberPages() {
        const pages = this.container.querySelectorAll('.editor-page');
        pages.forEach((pageDiv, index) => {
            const pageNum = index + 1;
            pageDiv.dataset.page = pageNum;
            
            const indicator = pageDiv.querySelector('.page-indicator');
            const pageNumber = pageDiv.querySelector('.page-number');
            
            if (indicator) indicator.textContent = `Page ${pageNum}`;
            if (pageNumber) pageNumber.textContent = pageNum;
        });

        // Update total pages display
        const totalPages = document.getElementById('totalPages');
        if (totalPages) {
            totalPages.textContent = pages.length;
        }

        console.log(`📋 Renumbered ${pages.length} pages`);
    }

    createNewPage(pageNum) {
        const newPageHtml = `
            <div class="editor-page" data-page="${pageNum}">
                <div class="page-indicator">Page ${pageNum}</div>
                <div class="page-content" contenteditable="true">
                    <p><br></p>
                </div>
                <div class="page-number">${pageNum}</div>
            </div>
        `;

        this.container.insertAdjacentHTML('beforeend', newPageHtml);

        const newPage = this.container.querySelector(`.editor-page[data-page="${pageNum}"]`);
        if (newPage) {
            const pageContent = newPage.querySelector('.page-content');
            this.bindPageEvents(pageContent);
            console.log(`✅ Created page ${pageNum}`);
            return newPage;
        }
        return null;
    }

    // FIXED: Cleanup method
    destroy() {
        // Clear all pending timeouts
        this.overflowCheckTimers.forEach(timeout => clearTimeout(timeout));
        this.overflowCheckTimers.clear();
        console.log('🧹 Editor destroyed');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.msWordEditor = new MSWordLikeEditor();
    window.msWordEditor.init();
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (window.msWordEditor) {
        window.msWordEditor.destroy();
    }
});

// Export
window.MSWordLikeEditor = MSWordLikeEditor;