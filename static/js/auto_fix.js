/**
 * ================================================================== 
 * STEP 4: AUTOMATIC CONTENT REDISTRIBUTION
 * ================================================================== 
 * 
 * Overflow होने पर automatically content move करो
 * अपने word-editor.js में add करो
 */

class PageFlowAutoFix {
    constructor() {
        this.isProcessing = false;
        this.lastFixTime = 0;
        this.fixCooldown = 500;  // 500ms cooldown
        this.maxRetries = 3;
        this.detector = window.pageDetector;
        
        console.log('🔧 Auto Fix System initialized');
    }

    // ===== Check करो और auto-fix करो =====
    checkAndFix() {
        // अगर पहले से process हो रहा है तो exit करो
        if (this.isProcessing) {
            console.log('⏳ Already processing...');
            return;
        }

        // Cooldown check करो
        const now = Date.now();
        if (now - this.lastFixTime < this.fixCooldown) {
            console.log('⏱️ Cooldown active...');
            return;
        }

        this.isProcessing = true;
        this.lastFixTime = now;

        try {
            // सभी pages measure करो
            const measurements = this.detector.measureAllPages();
            
            // Overflowing pages find करो
            const overflowing = measurements.filter(m => m.isOverflowing);
            
            if (overflowing.length === 0) {
                console.log('✅ No overflow detected');
                this.isProcessing = false;
                return;
            }

            console.log(`⚠️ Found ${overflowing.length} overflowing pages`);

            // हर overflowing page को fix करो
            overflowing.forEach((measurement, index) => {
                setTimeout(() => {
                    this.fixOverflowingPage(measurement.pageNum);
                }, index * 300);  // Stagger करो
            });

            // Cleanup करो
            setTimeout(() => {
                this.cleanupEmptyPages();
                this.renumberPages();
                this.isProcessing = false;
                console.log('✅ Fix completed');
            }, overflowing.length * 300 + 500);

        } catch (error) {
            console.error('❌ Fix error:', error);
            this.isProcessing = false;
        }
    }

    // ===== Overflowing page को fix करो =====
    fixOverflowingPage(pageNum) {
        console.log(`🔄 Fixing page ${pageNum}...`);

        const pages = document.querySelectorAll('.page-content');
        const currentPageElement = pages[pageNum - 1];
        const nextPageElement = pages[pageNum];

        if (!currentPageElement) {
            console.warn(`❌ Page ${pageNum} not found`);
            return;
        }

        // अगर next page नहीं है तो बना दो
        if (!nextPageElement) {
            this.createNewPage(pageNum + 1);
        }

        // Measurement लो
        const measurement = new PageMeasurement(currentPageElement, pageNum);
        const m = measurement.measure();

        // जब तक overflow न हो जाए, elements move करो
        let moved = 0;
        const maxMoves = 20;

        while (m.contentHeight > m.maxCapacity && moved < maxMoves) {
            const lastChild = currentPageElement.lastElementChild;

            if (!lastChild) {
                console.log(`⚠️ No more elements to move`);
                break;
            }

            // Check करो कि यह meaningful element है या नहीं
            const tagName = lastChild.tagName;
            if (['P', 'DIV', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName)) {
                // Element को move करो
                const nextPage = document.querySelectorAll('.page-content')[pageNum];
                if (nextPage) {
                    const clone = lastChild.cloneNode(true);
                    nextPage.insertAdjacentElement('afterbegin', clone);
                    lastChild.remove();
                    moved++;
                }
            } else {
                // Meaningless element को remove करो
                lastChild.remove();
            }

            // Re-measure करो
            const newMeasurement = new PageMeasurement(currentPageElement, pageNum);
            const newM = newMeasurement.measure();
            m.contentHeight = newM.contentHeight;
            m.maxCapacity = newM.maxCapacity;
        }

        console.log(`  ✅ Moved ${moved} elements from page ${pageNum}`);
    }

    // ===== Empty pages को delete करो =====
    cleanupEmptyPages() {
        console.log('🧹 Cleaning up empty pages...');

        const pageDivs = document.querySelectorAll('.editor-page');
        const minPages = 1;

        if (pageDivs.length <= minPages) {
            console.log('⚠️ Only 1 page - skipping cleanup');
            return;
        }

        let removed = 0;

        // अंत से शुरू करके delete करो (reverse order)
        for (let i = pageDivs.length - 1; i >= minPages; i--) {
            const pageDiv = pageDivs[i];
            const pageContent = pageDiv.querySelector('.page-content');

            if (!pageContent) continue;

            // Check करो empty है या नहीं
            const text = pageContent.innerText.trim();
            const html = pageContent.innerHTML.trim();
            const isEmpty = text.length === 0 || 
                           html === '<p><br></p>' || 
                           html === '<p></p>';

            if (isEmpty) {
                // Smooth animation से remove करो
                pageDiv.style.transition = 'all 0.3s ease';
                pageDiv.style.transform = 'scale(0.95)';
                pageDiv.style.opacity = '0';

                setTimeout(() => {
                    pageDiv.remove();
                    removed++;
                }, 300);
            }
        }

        console.log(`  ✅ Removed ${removed} empty pages`);
    }

    // ===== Pages को re-number करो =====
    renumberPages() {
        console.log('📝 Renumbering pages...');

        const pageDivs = document.querySelectorAll('.editor-page');
        let pageNum = 1;

        pageDivs.forEach((pageDiv) => {
            const pageContent = pageDiv.querySelector('.page-content');
            
            if (pageContent) {
                pageDiv.dataset.page = pageNum;
                pageContent.dataset.page = pageNum;

                const indicator = pageDiv.querySelector('.page-indicator');
                const number = pageDiv.querySelector('.page-number');

                if (indicator) indicator.textContent = `Page ${pageNum}`;
                if (number) number.textContent = pageNum;

                pageNum++;
            }
        });

        // Word editor को update करो
        if (window.wordEditor) {
            window.wordEditor.pages = Array.from(
                document.querySelectorAll('.page-content')
            );
            window.wordEditor.updateNavigation();
            window.wordEditor.updatePageCount();
        }

        console.log(`  ✅ ${pageNum - 1} pages renumbered`);
    }

    // ===== नया page बना दो =====
    createNewPage(pageNum) {
        const container = document.getElementById('pagesContainer');
        if (!container) return null;

        const html = `
            <div class="editor-page" data-page="${pageNum}">
                <div class="page-indicator">Page ${pageNum}</div>
                <div class="page-content" contenteditable="true" data-page="${pageNum}">
                    <p><br></p>
                </div>
                <div class="page-number">${pageNum}</div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', html);
        console.log(`  ✅ Page ${pageNum} created`);
        return true;
    }

    // ===== Force करके fix करो =====
    forceFixAll() {
        console.log('💥 Force fixing all pages...');
        this.isProcessing = false;
        this.lastFixTime = 0;
        this.checkAndFix();
    }
}

// ===== INITIALIZE =====

let autoFixer = null;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.pageDetector && !autoFixer) {
            autoFixer = new PageFlowAutoFix();
            window.autoFixer = autoFixer;
            console.log('✅ Auto Fixer initialized');
        }
    }, 2000);
});

// ===== AUTO-TRIGGER SETUP =====

// Content change पर trigger करो
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('page-content') && autoFixer) {
        setTimeout(() => autoFixer.checkAndFix(), 300);
    }
}, true);

// Delete/Backspace पर trigger करो
document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && 
        e.target.classList.contains('page-content') && autoFixer) {
        setTimeout(() => autoFixer.checkAndFix(), 100);
    }
}, true);

// Paste पर trigger करो
document.addEventListener('paste', () => {
    if (autoFixer) {
        setTimeout(() => autoFixer.checkAndFix(), 500);
    }
}, true);

// ===== CONSOLE COMMANDS =====

window.fixCommands = {
    // Check और fix करो
    fix: () => {
        if (!autoFixer) {
            console.log('❌ Auto Fixer not ready');
            return;
        }
        autoFixer.checkAndFix();
    },

    // Force करके fix करो
    forcefix: () => {
        if (!autoFixer) {
            console.log('❌ Auto Fixer not ready');
            return;
        }
        autoFixer.forceFixAll();
    },

    // Status दिखा दो
    status: () => {
        if (!autoFixer) return;
        console.log(`
🔧 Auto Fixer Status:
   Processing: ${autoFixer.isProcessing ? '🔄 Yes' : '✅ No'}
   Last Fix: ${autoFixer.lastFixTime ? new Date(autoFixer.lastFixTime).toLocaleTimeString() : 'Never'}
   Cooldown: ${autoFixer.fixCooldown}ms
        `);
    },

    // Help
    help: () => {
        console.log(`
╔═══════════════════════════════════════════╗
║     AUTO FIX COMMANDS                     ║
╚═══════════════════════════════════════════╝

🔧 FIXING:
  fixCommands.fix()      → Check and auto-fix
  fixCommands.forcefix() → Force fix all

ℹ️  INFO:
  fixCommands.status()   → Show status
  fixCommands.help()     → Show this help

USAGE:
  fixCommands.fix()      # यह automatic होगा
        `);
    }
};

console.log('✅ Auto Fix System ready - Type: fixCommands.help()');