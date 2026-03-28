/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                              ║
 * ║   📝  WORD EDITOR FUNCTIONS  —  v4.3  "COLOR FIX EDITION"                 ║
 * ║                                                                              ║
 * ║   CHANGES v4.3:                                                             ║
 * ║   ✅ setTextColor  — ADDED (was missing! called but never defined)         ║
 * ║   ✅ setHighlight  — ADDED (was missing! called but never defined)         ║
 * ║   ✅ Both methods work for: selection, multi-page, cursor (no selection)   ║
 * ║   ✅ font[color] tags auto-cleaned to span[style] after execCommand        ║
 * ║   ✅ hiliteColor → backColor fallback for cross-browser highlight          ║
 * ║   ✅ saveSelection() now fires on BOTH apply-btn & arrow-btn mousedown     ║
 * ║                                                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

;(function (global) {
    'use strict';

    const WE_VERSION = '4.3.0';

    /* ═══════════════════════════════════════════════════
     *  SECTION 1 ▸ PRIVATE CORE UTILITIES
     * ═══════════════════════════════════════════════════ */

    function _getFlow() {
        return (typeof global.wordFlow !== 'undefined' &&
                typeof global.wordFlow.reIndexPages === 'function')
            ? global.wordFlow : null;
    }

    function _container() { return document.getElementById('pagesContainer'); }

    function _activePC() {
        const sel = global.getSelection?.();
        if (sel && sel.rangeCount > 0) {
            const node = sel.getRangeAt(0).commonAncestorContainer;
            const el   = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            const pc   = el?.closest?.('.page-content');
            if (pc) return pc;
        }
        return document.activeElement?.classList.contains('page-content')
            ? document.activeElement : null;
    }

    function _hasSelection() {
        const sel = global.getSelection?.();
        return !!(sel && sel.toString().length > 0);
    }

    function _saveRange() {
        const sel = global.getSelection?.();
        return (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
    }

    function _restoreRange(range) {
        if (!range) return;
        try {
            const sel = global.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (_) {}
    }

    function _firstText(el) {
        if (!el) return null;
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        return w.nextNode();
    }

    function _lastText(el) {
        if (!el) return null;
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let last = null, n;
        while ((n = w.nextNode())) last = n;
        return last;
    }

    function _selectedPages() {
        const sel = global.getSelection?.();
        if (!sel || sel.rangeCount === 0) return [];
        const range   = sel.getRangeAt(0);
        const allPCs  = Array.from(document.querySelectorAll('.page-content'));
        const startEl = range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement : range.startContainer;
        const endEl   = range.endContainer.nodeType === Node.TEXT_NODE
            ? range.endContainer.parentElement : range.endContainer;
        const startPC = startEl?.closest?.('.page-content');
        const endPC   = endEl?.closest?.('.page-content');
        if (!startPC || !endPC) { const a = _activePC(); return a ? [a] : []; }
        if (startPC === endPC) return [startPC];
        const si = allPCs.indexOf(startPC);
        const ei = allPCs.indexOf(endPC);
        if (si === -1 || ei === -1) return [startPC];
        return allPCs.slice(Math.min(si, ei), Math.max(si, ei) + 1);
    }

    /** Apply execCommand across single or multi-page selection */
    function _applyFormat(command, value = null) {
        const pages = _selectedPages();
        if (!pages.length) return;
        if (pages.length === 1) { document.execCommand(command, false, value); return; }

        const sel       = global.getSelection();
        const origRange = _saveRange();

        pages.forEach((page, idx) => {
            if (!page.textContent.trim()) return;
            try {
                const r = document.createRange();
                if (idx === 0) {
                    r.setStart(origRange.startContainer, origRange.startOffset);
                    const last = _lastText(page) || page.lastChild;
                    last ? (last.nodeType === Node.TEXT_NODE
                        ? r.setEnd(last, last.length)
                        : r.setEndAfter(last))
                        : r.selectNodeContents(page);
                } else if (idx === pages.length - 1) {
                    const first = _firstText(page) || page.firstChild;
                    first ? (first.nodeType === Node.TEXT_NODE
                        ? r.setStart(first, 0)
                        : r.setStartBefore(first))
                        : r.selectNodeContents(page);
                    r.setEnd(origRange.endContainer, origRange.endOffset);
                } else {
                    r.selectNodeContents(page);
                }
                sel.removeAllRanges();
                sel.addRange(r);
                document.execCommand(command, false, value);
            } catch (e) {
                console.warn(`[WordEditor] Format error page ${page.dataset.page}:`, e);
            }
        });
        _restoreRange(origRange);
    }

    function _normalizeFontSize(sizeValue) {
        if (!sizeValue) return null;
        const str = String(sizeValue).trim();
        const num = parseFloat(str);
        if (isNaN(num)) return null;
        if (/pt$/i.test(str))  return Math.round(num * 1.3333) + 'px';
        if (/em$/i.test(str))  return str;
        if (/rem$/i.test(str)) return str;
        if (/px$/i.test(str))  return str;
        return num + 'px';
    }

    function _reflow(fromPage = 1) {
        const flow = _getFlow();
        if (!flow) return;
        clearTimeout(_reflow._t);
        _reflow._t = setTimeout(() => {
            if (typeof flow.reflowFrom === 'function') flow.reflowFrom(fromPage);
            else if (typeof flow.reflowAll === 'function') flow.reflowAll();
            else if (typeof flow.performReflow === 'function') flow.performReflow();
        }, 50);
    }
    _reflow._t = null;

    function _reflowAfterStyle() {
        requestAnimationFrame(() => {
            const pc = _activePC();
            if (!pc) { _reflow(1); return; }
            const page    = pc.closest('.editor-page');
            const pageNum = parseInt(page?.dataset.page, 10) || 1;
            _reflow(pageNum);
        });
    }

    function _currentPageNum() {
        const pc   = _activePC();
        const page = pc?.closest('.editor-page');
        return parseInt(page?.dataset.page, 10) || 1;
    }

    function _reIndex() {
        const flow = _getFlow();
        if (flow?.reIndexPages) { flow.reIndexPages(); return; }
        const c = _container();
        if (!c) return;
        Array.from(c.querySelectorAll('.editor-page')).forEach((page, i) => {
            const n = i + 1;
            page.dataset.page = n;
            const pc  = page.querySelector('.page-content');
            if (pc) { pc.dataset.page = n; if (!pc.innerHTML.trim()) pc.innerHTML = '<p><br></p>'; }
            const ind = page.querySelector('.page-indicator');
            if (ind) ind.textContent = `Page ${n}`;
            const nb  = page.querySelector('.page-number');
            if (nb)  nb.textContent = n;
        });
    }

    function _createPageEl(pageNum, html = '<p><br></p>') {
        const flow = _getFlow();
        if (flow && typeof flow.createPage === 'function') return flow.createPage(pageNum, html);
        const page              = document.createElement('div');
        page.className          = 'editor-page';
        page.dataset.page       = pageNum;
        const indicator         = document.createElement('div');
        indicator.className     = 'page-indicator';
        indicator.textContent   = `Page ${pageNum}`;
        const content           = document.createElement('div');
        content.className       = 'page-content';
        content.contentEditable = 'true';
        content.dataset.page    = pageNum;
        content.innerHTML       = html;
        const number            = document.createElement('div');
        number.className        = 'page-number';
        number.textContent      = pageNum;
        page.appendChild(indicator);
        page.appendChild(content);
        page.appendChild(number);
        return page;
    }

    function _toast(msg, type = 'info', duration = 2200) {
        const existing = document.getElementById('we-toast');
        if (existing) existing.remove();
        const colors = {
            info:    'linear-gradient(135deg,#1a4fa0,#185abd)',
            success: 'linear-gradient(135deg,#0c5e0c,#107c10)',
            error:   'linear-gradient(135deg,#8b1a1a,#c42b1c)',
            warn:    'linear-gradient(135deg,#8a3800,#d97706)',
        };
        const toast = document.createElement('div');
        toast.id = 'we-toast';
        toast.textContent = msg;
        toast.style.cssText = `
            position:fixed; bottom:70px; left:50%; transform:translateX(-50%) translateY(10px);
            z-index:999999; padding:9px 22px; border-radius:9999px;
            background:${colors[type] || colors.info}; color:#fff;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:.8rem; font-weight:600; letter-spacing:.02em;
            box-shadow:0 4px 16px rgba(0,0,0,.22);
            opacity:0; transition:opacity .2s,transform .2s; pointer-events:none;
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }


    /* ═══════════════════════════════════════════════════
     *  SECTION 2 ▸ CURSOR-STYLE SPAN ENGINE
     * ═══════════════════════════════════════════════════ */

    let _activeCursorSpan = null;

    function _applyStyleAtCursorOrSelection(styleProp, styleValue) {
        const sel = global.getSelection?.();
        if (!sel || sel.rangeCount === 0) return false;
        const range = sel.getRangeAt(0);
        if (!range.collapsed && sel.toString().length > 0) {
            return _wrapSelectionWithStyle(styleProp, styleValue, range, sel);
        }
        return _insertCursorStyleSpan(styleProp, styleValue, range, sel);
    }

    function _wrapSelectionWithStyle(styleProp, styleValue, range, sel) {
        try {
            const frag = range.extractContents();
            const span = document.createElement('span');
            span.style[styleProp] = styleValue;
            span.dataset.weStyle  = styleProp;
            span.appendChild(frag);
            span.querySelectorAll(`span[data-we-style="${styleProp}"]`).forEach(inner => {
                inner.style[styleProp] = styleValue;
                const p = inner.parentNode;
                while (inner.firstChild) p.insertBefore(inner.firstChild, inner);
                p.removeChild(inner);
            });
            span.querySelectorAll('font').forEach(font => {
                const s = document.createElement('span');
                s.style[styleProp] = styleValue;
                while (font.firstChild) s.appendChild(font.firstChild);
                font.parentNode.replaceChild(s, font);
            });
            range.insertNode(span);
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            sel.removeAllRanges();
            sel.addRange(newRange);
            return true;
        } catch (e) {
            console.error('[WordEditor] _wrapSelectionWithStyle error:', e);
            return false;
        }
    }

    function _insertCursorStyleSpan(styleProp, styleValue, range, sel) {
        try {
            _cleanupCursorSpan();
            const span = document.createElement('span');
            span.style[styleProp]  = styleValue;
            span.dataset.weStyle   = styleProp;
            span.dataset.weCursor  = '1';
            const zwsp = document.createTextNode('\u200B');
            span.appendChild(zwsp);
            range.insertNode(span);
            const cursorRange = document.createRange();
            cursorRange.setStart(zwsp, 1);
            cursorRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(cursorRange);
            _activeCursorSpan = span;
            return true;
        } catch (e) {
            console.error('[WordEditor] _insertCursorStyleSpan error:', e);
            return false;
        }
    }

    function _cleanupCursorSpan(spanEl) {
        const span = spanEl || _activeCursorSpan;
        if (!span || !span.parentNode) { _activeCursorSpan = null; return; }
        const content = span.textContent.replace(/\u200B/g, '');
        if (!content.trim()) {
            const parent = span.parentNode;
            const before = span.previousSibling;
            const sel    = global.getSelection?.();
            const cursorRange = document.createRange();
            if (before) {
                if (before.nodeType === Node.TEXT_NODE) {
                    cursorRange.setStart(before, before.length);
                } else {
                    cursorRange.setStartAfter(before);
                }
            } else {
                cursorRange.setStart(parent, 0);
            }
            cursorRange.collapse(true);
            parent.removeChild(span);
            parent.normalize();
            if (sel) {
                try { sel.removeAllRanges(); sel.addRange(cursorRange); } catch (_) {}
            }
        } else {
            delete span.dataset.weCursor;
            span.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('\u200B')) {
                    node.textContent = node.textContent.replace(/\u200B/g, '');
                }
            });
            span.normalize();
        }
        if (_activeCursorSpan === span) _activeCursorSpan = null;
    }

    function _setupCursorSpanWatcher() {
        document.addEventListener('selectionchange', () => {
            if (!_activeCursorSpan) return;
            const sel = global.getSelection?.();
            if (!sel || sel.rangeCount === 0) return;
            const range  = sel.getRangeAt(0);
            const node   = range.startContainer;
            const el     = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            const inside = _activeCursorSpan.contains(el) || _activeCursorSpan === el;
            if (!inside) _cleanupCursorSpan();
        });
    }


    /* ═══════════════════════════════════════════════════
     *  SECTION 3 ▸ PARAGRAPH & BLOCK STYLE HELPERS
     * ═══════════════════════════════════════════════════ */

    function _applyParagraphStyle(styleProp, styleValue) {
        const pages = _selectedPages();
        if (!pages.length) return;
        const sel   = global.getSelection();
        const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
        pages.forEach(pc => {
            const children = Array.from(pc.children);
            children.forEach(child => {
                if (!range) { child.style[styleProp] = styleValue; return; }
                const childRange = document.createRange();
                childRange.selectNodeContents(child);
                if (range.compareBoundaryPoints(Range.END_TO_START, childRange) <= 0 &&
                    range.compareBoundaryPoints(Range.START_TO_END, childRange) >= 0) {
                    child.style[styleProp] = styleValue;
                }
            });
        });
    }

    function _applyLineSpacing(value) {
        _applyParagraphStyle('lineHeight', String(value));
        _reflowAfterStyle();
    }

    function _applyHeading(tag) {
        document.execCommand('formatBlock', false, tag);
    }


    /* ═══════════════════════════════════════════════════
     *  SECTION 4 ▸ TABLE ENGINE
     * ═══════════════════════════════════════════════════ */

    const TableEngine = {

        insert(rows = 3, cols = 3, options = {}) {
            const pc = _activePC();
            if (!pc) { _toast('Click inside document first', 'warn'); return false; }
            const {
                width      = '100%',
                border     = '1px solid #c8cdd8',
                cellPad    = '8px 10px',
                headerRow  = false,
                striped    = false,
            } = options;
            let html = `<table style="width:${width};border-collapse:collapse;margin:8px 0;table-layout:fixed;" class="we-table">`;
            for (let r = 0; r < rows; r++) {
                html += '<tr>';
                for (let c = 0; c < cols; c++) {
                    const isHeader = headerRow && r === 0;
                    const tag      = isHeader ? 'th' : 'td';
                    const bg       = isHeader
                        ? 'background:#f0f2f7;font-weight:600;'
                        : (striped && r % 2 === 0 ? 'background:#f8f9fb;' : '');
                    html += `<${tag} style="border:${border};padding:${cellPad};min-width:40px;vertical-align:top;${bg}" contenteditable="true"><br></${tag}>`;
                }
                html += '</tr>';
            }
            html += '</table><p><br></p>';
            const sel = global.getSelection();
            if (!sel?.rangeCount) return false;
            try {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const tpl  = document.createElement('div');
                tpl.innerHTML = html;
                const frag = document.createDocumentFragment();
                while (tpl.firstChild) frag.appendChild(tpl.firstChild);
                range.insertNode(frag);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
                _reflowAfterStyle();
                _toast(`Table ${rows}×${cols} inserted`, 'success');
                return true;
            } catch (e) {
                console.error('[WordEditor] insertTable error:', e);
                return false;
            }
        },

        _getCurrent() {
            const sel = global.getSelection();
            if (!sel?.rangeCount) return null;
            const node = sel.getRangeAt(0).commonAncestorContainer;
            const el   = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            return el?.closest('table');
        },

        _getCurrentCell() {
            const sel = global.getSelection();
            if (!sel?.rangeCount) return null;
            const node = sel.getRangeAt(0).commonAncestorContainer;
            const el   = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            return el?.closest('td,th');
        },

        addRowAbove() {
            const cell  = this._getCurrentCell();
            const table = this._getCurrent();
            if (!cell || !table) { _toast('Click inside a table cell', 'warn'); return false; }
            const row   = cell.closest('tr');
            const cols  = row.cells.length;
            const newRow = document.createElement('tr');
            for (let i = 0; i < cols; i++) {
                const td = document.createElement('td');
                td.style.cssText   = row.cells[i].style.cssText;
                td.contentEditable = 'true';
                td.innerHTML       = '<br>';
                newRow.appendChild(td);
            }
            row.parentNode.insertBefore(newRow, row);
            _reflowAfterStyle();
            return true;
        },

        addRowBelow() {
            const cell  = this._getCurrentCell();
            const table = this._getCurrent();
            if (!cell || !table) { _toast('Click inside a table cell', 'warn'); return false; }
            const row    = cell.closest('tr');
            const cols   = row.cells.length;
            const newRow = document.createElement('tr');
            for (let i = 0; i < cols; i++) {
                const td = document.createElement('td');
                td.style.cssText   = row.cells[i].style.cssText;
                td.contentEditable = 'true';
                td.innerHTML       = '<br>';
                newRow.appendChild(td);
            }
            row.parentNode.insertBefore(newRow, row.nextSibling);
            _reflowAfterStyle();
            return true;
        },

        addColumnLeft() {
            const table = this._getCurrent();
            const cell  = this._getCurrentCell();
            if (!table || !cell) { _toast('Click inside a table cell', 'warn'); return false; }
            const colIdx = cell.cellIndex;
            Array.from(table.rows).forEach(row => {
                const newCell           = document.createElement(row.cells[colIdx]?.tagName || 'td');
                newCell.style.cssText   = row.cells[colIdx]?.style.cssText || 'border:1px solid #c8cdd8;padding:8px 10px;min-width:40px;vertical-align:top;';
                newCell.contentEditable = 'true';
                newCell.innerHTML       = '<br>';
                row.insertBefore(newCell, row.cells[colIdx]);
            });
            _reflowAfterStyle();
            return true;
        },

        addColumnRight() {
            const table = this._getCurrent();
            const cell  = this._getCurrentCell();
            if (!table || !cell) { _toast('Click inside a table cell', 'warn'); return false; }
            const colIdx = cell.cellIndex;
            Array.from(table.rows).forEach(row => {
                const refCell = row.cells[colIdx];
                const newCell = document.createElement(refCell?.tagName || 'td');
                newCell.style.cssText   = refCell?.style.cssText || 'border:1px solid #c8cdd8;padding:8px 10px;min-width:40px;vertical-align:top;';
                newCell.contentEditable = 'true';
                newCell.innerHTML       = '<br>';
                if (refCell?.nextSibling) row.insertBefore(newCell, refCell.nextSibling);
                else row.appendChild(newCell);
            });
            _reflowAfterStyle();
            return true;
        },

        deleteRow() {
            const table = this._getCurrent();
            const cell  = this._getCurrentCell();
            if (!table || !cell) { _toast('Click inside a table cell', 'warn'); return false; }
            const row = cell.closest('tr');
            if (table.rows.length <= 1) { this.deleteTable(); return true; }
            row.remove();
            _reflowAfterStyle();
            return true;
        },

        deleteColumn() {
            const table = this._getCurrent();
            const cell  = this._getCurrentCell();
            if (!table || !cell) { _toast('Click inside a table cell', 'warn'); return false; }
            const colIdx = cell.cellIndex;
            if (table.rows[0]?.cells.length <= 1) { this.deleteTable(); return true; }
            Array.from(table.rows).forEach(row => {
                if (row.cells[colIdx]) row.deleteCell(colIdx);
            });
            _reflowAfterStyle();
            return true;
        },

        deleteTable() {
            const table = this._getCurrent();
            if (!table) { _toast('Not inside a table', 'warn'); return false; }
            const pc = table.closest('.page-content');
            table.remove();
            if (pc && !pc.textContent.trim()) pc.innerHTML = '<p><br></p>';
            _reflowAfterStyle();
            _toast('Table deleted', 'info');
            return true;
        },

        setCellBorder(style) {
            const cell = this._getCurrentCell();
            if (!cell) return false;
            cell.style.border = style;
            return true;
        },

        setCellAlign(align) {
            const cell = this._getCurrentCell();
            if (!cell) return false;
            cell.style.textAlign = align;
            return true;
        },

        setCellVerticalAlign(align) {
            const cell = this._getCurrentCell();
            if (!cell) return false;
            cell.style.verticalAlign = align;
            return true;
        },
    };


    /* ═══════════════════════════════════════════════════
     *  SECTION 5 ▸ IMAGE ENGINE
     * ═══════════════════════════════════════════════════ */

    const ImageEngine = {

        insertFromFile(file) {
            if (!file || !file.type.startsWith('image/')) {
                _toast('Please select an image file', 'warn');
                return false;
            }
            const reader = new FileReader();
            reader.onload = (e) => this._insertDataUrl(e.target.result, file.name);
            reader.readAsDataURL(file);
            return true;
        },

        insertFromUrl(url, alt = 'Image') {
            if (!url) return false;
            this._insertDataUrl(url, alt);
            return true;
        },

        _insertDataUrl(src, alt = 'Image') {
            const pc = _activePC();
            if (!pc) { _toast('Click inside document first', 'warn'); return; }
            const wrapper = document.createElement('div');
            wrapper.style.cssText   = 'display:block;margin:8px 0;text-align:left;';
            wrapper.contentEditable = 'false';
            wrapper.className       = 'we-image-wrapper';
            const img         = document.createElement('img');
            img.src           = src;
            img.alt           = alt;
            img.style.cssText = 'max-width:100%;height:auto;cursor:pointer;border-radius:2px;';
            img.className     = 'we-image';
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                this._selectImage(img);
            });
            wrapper.appendChild(img);
            const sel = global.getSelection();
            if (sel?.rangeCount) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(wrapper);
                const after = document.createRange();
                after.setStartAfter(wrapper);
                after.collapse(true);
                sel.removeAllRanges();
                sel.addRange(after);
            } else {
                pc.appendChild(wrapper);
            }
            if (!wrapper.nextSibling) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                wrapper.parentNode.insertBefore(p, wrapper.nextSibling);
            }
            _reflowAfterStyle();
            _toast('Image inserted', 'success');
        },

        _selectImage(img) {
            document.querySelectorAll('.we-image-selected').forEach(el => el.classList.remove('we-image-selected'));
            document.querySelectorAll('.we-resize-handle').forEach(el => el.remove());
            img.classList.add('we-image-selected');
            img.style.outline = '2px solid #185abd';
            ImageEngine._selectedImage = img;
            this._addResizeHandles(img);
        },

        _addResizeHandles(img) {
            const wrapper = img.closest('.we-image-wrapper') || img.parentElement;
            const handle  = document.createElement('span');
            handle.className  = 'we-resize-handle';
            handle.style.cssText = `
                position:absolute; bottom:-5px; right:-5px;
                width:12px; height:12px; background:#185abd; border-radius:2px;
                cursor:se-resize; z-index:10;
            `;
            wrapper.style.position = 'relative';
            wrapper.style.display  = 'inline-block';
            wrapper.appendChild(handle);
            let startX, startW;
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startX = e.clientX;
                startW = img.offsetWidth;
                const onMove = (mv) => {
                    const newW = Math.max(50, startW + mv.clientX - startX);
                    img.style.width  = newW + 'px';
                    img.style.height = 'auto';
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    _reflowAfterStyle();
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        },

        setAlign(align) {
            const img     = this._selectedImage;
            const wrapper = img?.closest('.we-image-wrapper');
            if (!wrapper) { _toast('Select an image first', 'warn'); return false; }
            wrapper.style.textAlign = { left: 'left', center: 'center', right: 'right' }[align] || 'left';
            return true;
        },

        setWidth(px) {
            const img = this._selectedImage;
            if (!img) { _toast('Select an image first', 'warn'); return false; }
            img.style.width  = px + 'px';
            img.style.height = 'auto';
            _reflowAfterStyle();
            return true;
        },

        deselect() {
            if (this._selectedImage) {
                this._selectedImage.style.outline = '';
                this._selectedImage.classList.remove('we-image-selected');
                this._selectedImage = null;
            }
            document.querySelectorAll('.we-resize-handle').forEach(el => el.remove());
        },

        deleteSelected() {
            const img     = this._selectedImage;
            const wrapper = img?.closest('.we-image-wrapper');
            if (!wrapper) return false;
            wrapper.remove();
            this._selectedImage = null;
            _reflowAfterStyle();
            _toast('Image deleted', 'info');
            return true;
        },

        _selectedImage: null,
    };

    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('we-image')) ImageEngine.deselect();
    });


    /* ═══════════════════════════════════════════════════
     *  SECTION 6 ▸ HYPERLINK ENGINE
     * ═══════════════════════════════════════════════════ */

    const LinkEngine = {

        insert(url, text, newTab = true) {
            if (!url) { _toast('URL is required', 'warn'); return false; }
            if (!url.startsWith('http') && !url.startsWith('mailto:') &&
                !url.startsWith('tel:') && !url.startsWith('#')) {
                url = 'https://' + url;
            }
            const displayText = text || url;
            const sel         = global.getSelection();
            if (sel && sel.toString().length > 0) {
                document.execCommand('createLink', false, url);
                const link = sel.anchorNode?.parentElement?.closest('a');
                if (link && newTab) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
                _toast('Link applied', 'success');
                return true;
            }
            const link = document.createElement('a');
            link.href        = url;
            link.textContent = displayText;
            if (newTab) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
            const range = sel?.getRangeAt(0);
            if (range) {
                range.insertNode(link);
                const after = document.createRange();
                after.setStartAfter(link);
                after.collapse(true);
                sel.removeAllRanges();
                sel.addRange(after);
            }
            _toast('Link inserted', 'success');
            return true;
        },

        remove() {
            const sel  = global.getSelection();
            const node = sel?.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
            const el   = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            const link = el?.closest('a');
            if (!link) {
                document.execCommand('unlink', false, null);
                _toast('Link removed', 'info');
                return true;
            }
            const parent = link.parentNode;
            while (link.firstChild) parent.insertBefore(link.firstChild, link);
            parent.removeChild(link);
            _toast('Link removed', 'info');
            return true;
        },

        edit() {
            const sel  = global.getSelection();
            const node = sel?.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
            const el   = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            const link = el?.closest('a');
            if (!link) { _toast('Click on a link to edit', 'warn'); return false; }
            const newUrl = prompt('Edit link URL:', link.href);
            if (newUrl !== null) { link.href = newUrl; _toast('Link updated', 'success'); }
            return true;
        },
    };


    /* ═══════════════════════════════════════════════════
     *  SECTION 7 ▸ FIND & REPLACE ENGINE
     * ═══════════════════════════════════════════════════ */

    const FindEngine = {
        _state: { lastQuery: '', lastIndex: -1, matches: [] },

        find(query, options = {}) {
            this._clearHighlights();
            if (!query) return 0;
            const { caseSensitive = false, useRegex = false, wholeWord = false } = options;
            let pattern;
            try {
                if (useRegex) {
                    pattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
                } else {
                    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const wp      = wholeWord ? `\\b${escaped}\\b` : escaped;
                    pattern       = new RegExp(wp, caseSensitive ? 'g' : 'gi');
                }
            } catch (e) {
                _toast('Invalid regex pattern', 'error');
                return 0;
            }
            const allPCs = Array.from(document.querySelectorAll('.page-content'));
            let totalMatches = 0;
            allPCs.forEach(pc => {
                const walker = document.createTreeWalker(pc, NodeFilter.SHOW_TEXT);
                const nodes  = []; let n;
                while ((n = walker.nextNode())) nodes.push(n);
                nodes.forEach(textNode => {
                    if (textNode.parentElement?.classList.contains('we-find-highlight')) return;
                    const text    = textNode.textContent;
                    const matches = [...text.matchAll(pattern)];
                    if (!matches.length) return;
                    totalMatches += matches.length;
                    const parent = textNode.parentNode;
                    const frag   = document.createDocumentFragment();
                    let lastIdx  = 0;
                    matches.forEach(match => {
                        if (match.index > lastIdx) {
                            frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
                        }
                        const mark = document.createElement('mark');
                        mark.className     = 'we-find-highlight search-highlight';
                        mark.style.cssText = 'background:#FFD700;color:#000;border-radius:2px;';
                        mark.textContent   = match[0];
                        frag.appendChild(mark);
                        lastIdx = match.index + match[0].length;
                    });
                    if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
                    try { parent.replaceChild(frag, textNode); } catch (_) {}
                });
            });
            this._state.lastQuery = query;
            this._state.lastIndex = -1;
            this._state.matches   = Array.from(document.querySelectorAll('.we-find-highlight'));
            if (totalMatches > 0) _toast(`${totalMatches} match${totalMatches > 1 ? 'es' : ''} found`, 'info');
            else _toast('No matches found', 'warn');
            return totalMatches;
        },

        findNext() {
            const matches = this._state.matches;
            if (!matches.length) return false;
            matches.forEach(m => m.classList.remove('current'));
            this._state.lastIndex = (this._state.lastIndex + 1) % matches.length;
            const cur = matches[this._state.lastIndex];
            cur.classList.add('current');
            cur.style.background = '#ff8c00';
            cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
        },

        findPrev() {
            const matches = this._state.matches;
            if (!matches.length) return false;
            matches.forEach(m => m.classList.remove('current'));
            this._state.lastIndex = (this._state.lastIndex - 1 + matches.length) % matches.length;
            const cur = matches[this._state.lastIndex];
            cur.classList.add('current');
            cur.style.background = '#ff8c00';
            cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
        },

        replace(replacement = '') {
            if (!this._state.matches.length) return 0;
            const mark = this._state.matches[this._state.lastIndex < 0 ? 0 : this._state.lastIndex];
            if (!mark) return 0;
            mark.replaceWith(document.createTextNode(replacement));
            this._state.matches   = this._state.matches.filter(m => m !== mark);
            this._state.lastIndex = Math.max(0, this._state.lastIndex - 1);
            _reflow();
            return 1;
        },

        replaceAll(query, replacement = '', options = {}) {
            const count = this.find(query, options);
            if (!count) return 0;
            this._state.matches.forEach(mark => mark.replaceWith(document.createTextNode(replacement)));
            this._state.matches = [];
            _reflow();
            _toast(`Replaced ${count} occurrence${count > 1 ? 's' : ''}`, 'success');
            return count;
        },

        _clearHighlights() {
            document.querySelectorAll('.we-find-highlight').forEach(mark =>
                mark.replaceWith(document.createTextNode(mark.textContent))
            );
            document.querySelectorAll('.page-content').forEach(pc => pc.normalize());
            this._state.matches   = [];
            this._state.lastIndex = -1;
        },

        clear() {
            this._clearHighlights();
            this._state = { lastQuery: '', lastIndex: -1, matches: [] };
        },
    };


    /* ═══════════════════════════════════════════════════
     *  SECTION 8 ▸ STATISTICS ENGINE
     * ═══════════════════════════════════════════════════ */

    const StatsEngine = {

        wordCount() {
            let total = 0;
            document.querySelectorAll('.page-content').forEach(pc => {
                const text = pc.textContent.replace(/\u200B/g, '').replace(/\u00A0/g, ' ').trim();
                if (text) total += text.split(/\s+/).filter(Boolean).length;
            });
            return total;
        },

        charCount(includeSpaces = true) {
            let total = 0;
            document.querySelectorAll('.page-content').forEach(pc => {
                const text = pc.textContent.replace(/\u200B/g, '');
                total += includeSpaces ? text.length : text.replace(/\s/g, '').length;
            });
            return total;
        },

        paragraphCount() {
            let total = 0;
            document.querySelectorAll('.page-content p, .page-content div').forEach(el => {
                if (el.textContent.trim()) total++;
            });
            return total;
        },

        lineCount() {
            let total = 0;
            document.querySelectorAll('.page-content').forEach(pc => {
                const lineH = parseFloat(getComputedStyle(pc).lineHeight) || 24;
                total += Math.max(1, Math.round(pc.scrollHeight / lineH));
            });
            return total;
        },

        pageCount() {
            return document.querySelectorAll('.editor-page').length;
        },

        all() {
            return {
                words:      this.wordCount(),
                chars:      this.charCount(true),
                charsNoSp:  this.charCount(false),
                paragraphs: this.paragraphCount(),
                lines:      this.lineCount(),
                pages:      this.pageCount(),
            };
        },

        updateStatusBar() {
            const stats = this.all();
            const $ = id => document.getElementById(id);
            if ($('totalPages')) $('totalPages').textContent = stats.pages;
            if ($('wordCount'))  $('wordCount').textContent  = stats.words;
            if ($('charCount'))  $('charCount').textContent  = stats.chars;
        },
    };


    /* ═══════════════════════════════════════════════════
     *  SECTION 9 ▸ CONTEXT MENU ENGINE
     * ═══════════════════════════════════════════════════ */

    const ContextMenuEngine = {
        _menu: null,
        _savedRange: null,

        _isInsideTable() {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return false;
            const node = sel.getRangeAt(0).commonAncestorContainer;
            const el   = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            return !!(el?.closest('table'));
        },

        _saveCurrentSelection() {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                this._savedRange = sel.getRangeAt(0).cloneRange();
            } else {
                this._savedRange = null;
            }
        },

        _restoreSelection() {
            if (!this._savedRange) return;
            try {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(this._savedRange);
            } catch (_) {}
        },

        build(editor) {
            const inTable = this._isInsideTable();
            const always = [
                { label: '✂️ Cut',           action: () => { this._restoreSelection(); editor.cut(); },           shortcut: 'Ctrl+X' },
                { label: '📋 Copy',          action: () => { this._restoreSelection(); editor.copy(); },          shortcut: 'Ctrl+C' },
                { label: '📌 Paste',         action: () => { this._restoreSelection(); editor.pasteFallback(); }, shortcut: 'Ctrl+V' },
                { type: 'separator' },
                { label: '🔍 Find…',         action: () => editor.openFindDialog(),  shortcut: 'Ctrl+F' },
                { type: 'separator' },
                { label: '🔗 Insert Link',   action: () => { this._restoreSelection(); editor.promptInsertLink(); } },
                { label: '🖼️ Insert Image…', action: () => { this._restoreSelection(); editor.promptInsertImage(); } },
                { label: '📊 Insert Table',  action: () => { this._restoreSelection(); editor.tableEngine.insert(3, 3); } },
            ];
            const tableItems = inTable ? [
                { type: 'separator' },
                { label: '➕ Add Row Above',  action: () => editor.tableEngine.addRowAbove()  },
                { label: '➕ Add Row Below',  action: () => editor.tableEngine.addRowBelow()  },
                { label: '➕ Add Col Left',   action: () => editor.tableEngine.addColumnLeft()  },
                { label: '➕ Add Col Right',  action: () => editor.tableEngine.addColumnRight() },
                { label: '🗑️ Delete Row',     action: () => editor.tableEngine.deleteRow()    },
                { label: '🗑️ Delete Column',  action: () => editor.tableEngine.deleteColumn() },
                { label: '🗑️ Delete Table',   action: () => editor.tableEngine.deleteTable()  },
            ] : [];
            const formatting = [
                { type: 'separator' },
                { label: '🗂️ Heading 1',   action: () => { this._restoreSelection(); editor.applyHeading('h1'); } },
                { label: '🗂️ Heading 2',   action: () => { this._restoreSelection(); editor.applyHeading('h2'); } },
                { label: '🗂️ Heading 3',   action: () => { this._restoreSelection(); editor.applyHeading('h3'); } },
                { label: '📝 Normal Text', action: () => { this._restoreSelection(); editor.applyHeading('p');  } },
                { type: 'separator' },
                { label: '🚫 Clear Format', action: () => { this._restoreSelection(); editor.clearFormatting(); }, shortcut: 'Ctrl+⇧+H' },
            ];
            return [...always, ...tableItems, ...formatting];
        },

        show(x, y, editor) {
            this._saveCurrentSelection();
            this.hide();
            const menu     = document.createElement('div');
            this._menu     = menu;
            menu.className = 'we-context-menu';
            menu.style.cssText = `
                position:fixed; left:${Math.min(x, window.innerWidth - 240)}px;
                top:${Math.min(y, window.innerHeight - 400)}px;
                z-index:999999; min-width:220px;
                background:#fff; border:1px solid #dde1ea; border-radius:8px;
                box-shadow:0 8px 28px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.08);
                padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                font-size:.82rem; animation:weMenuIn .12s ease; overflow:hidden;
            `;
            if (!document.getElementById('we-ctx-style')) {
                const s = document.createElement('style');
                s.id = 'we-ctx-style';
                s.textContent = `
                    @keyframes weMenuIn { from{opacity:0;transform:scale(.94) translateY(-4px)} to{opacity:1;transform:scale(1)} }
                    .we-ctx-item { display:flex;justify-content:space-between;align-items:center;
                        padding:7px 14px; cursor:pointer; color:#2d333a;
                        transition:background .1s,color .1s; gap:16px; }
                    .we-ctx-item:hover { background:#e8f0fe; color:#185abd; }
                    .we-ctx-sep { height:1px; background:#eaedf4; margin:3px 0; }
                    .we-ctx-shortcut { font-size:.72rem; color:#9ca3af; font-variant:small-caps; flex-shrink:0; }
                `;
                document.head.appendChild(s);
            }
            this.build(editor).forEach(item => {
                if (item.type === 'separator') {
                    const sep = document.createElement('div');
                    sep.className = 'we-ctx-sep';
                    menu.appendChild(sep);
                    return;
                }
                const row = document.createElement('div');
                row.className = 'we-ctx-item';
                const label = document.createElement('span');
                label.textContent = item.label;
                row.appendChild(label);
                if (item.shortcut) {
                    const sc = document.createElement('span');
                    sc.className   = 'we-ctx-shortcut';
                    sc.textContent = item.shortcut;
                    row.appendChild(sc);
                }
                row.addEventListener('mousedown', (e) => e.preventDefault());
                row.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hide();
                    item.action?.();
                });
                menu.appendChild(row);
            });
            document.body.appendChild(menu);
        },

        hide() {
            if (this._menu) { this._menu.remove(); this._menu = null; }
        },
    };

    document.addEventListener('click', () => ContextMenuEngine.hide());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ContextMenuEngine.hide(); });


    /* ═══════════════════════════════════════════════════
     *  SECTION 10 ▸ SPECIAL CHARACTERS & EMOJI
     * ═══════════════════════════════════════════════════ */

    const SpecialCharsEngine = {

        COMMON_CHARS: [
            '©','®','™','°','±','²','³','½','¼','¾','×','÷','√','∞',
            '≈','≠','≤','≥','←','→','↑','↓','↔','↵','•','‣','◦','–',
            '—','…','‹','›','«','»','„','"','"','‚','\'','\'','§','¶',
            '†','‡','‰','€','£','¥','¢','₹','¿','¡','α','β','γ','δ',
            'π','Σ','Ω','μ','∫','∂','∇','∈','∉','∅','∩','∪','⊂','⊃',
        ],

        insert(char) {
            const sel = global.getSelection();
            if (!sel?.rangeCount) return false;
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const node = document.createTextNode(char);
            range.insertNode(node);
            range.setStartAfter(node);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return true;
        },

        showPicker(anchorEl) {
            const existing = document.getElementById('we-char-picker');
            if (existing) { existing.remove(); return; }
            const savedRange = _saveRange();
            const picker  = document.createElement('div');
            picker.id     = 'we-char-picker';
            const rect    = anchorEl?.getBoundingClientRect() || { bottom: 200, left: 200 };
            picker.style.cssText = `
                position:fixed; top:${rect.bottom + 4}px; left:${rect.left}px;
                z-index:999999; background:#fff; border:1px solid #dde1ea;
                border-radius:10px; padding:10px; box-shadow:0 8px 28px rgba(0,0,0,.14);
                display:flex; flex-wrap:wrap; gap:3px; width:340px;
                animation:weMenuIn .12s ease;
            `;
            this.COMMON_CHARS.forEach(ch => {
                const btn = document.createElement('button');
                btn.textContent   = ch;
                btn.title         = `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}`;
                btn.style.cssText = `
                    width:32px; height:32px; font-size:1rem; border:1px solid #e5e9f2;
                    border-radius:5px; cursor:pointer; background:#f8f9fb;
                    transition:background .1s,transform .1s; font-family:sans-serif;
                    display:flex; align-items:center; justify-content:center;
                `;
                btn.addEventListener('mouseenter', () => { btn.style.background = '#e8f0fe'; btn.style.transform = 'scale(1.2)'; });
                btn.addEventListener('mouseleave', () => { btn.style.background = '#f8f9fb'; btn.style.transform = 'scale(1)'; });
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    _restoreRange(savedRange);
                    this.insert(ch);
                    picker.remove();
                });
                picker.appendChild(btn);
            });
            document.body.appendChild(picker);
            setTimeout(() => {
                document.addEventListener('click', function handler(e) {
                    if (!picker.contains(e.target) && e.target !== anchorEl) {
                        picker.remove();
                        document.removeEventListener('click', handler);
                    }
                });
            }, 100);
        },
    };


    /* ═══════════════════════════════════════════════════
     *  SECTION 11 ▸ COLUMN LAYOUT ENGINE
     * ═══════════════════════════════════════════════════ */

    function _applyColumnLayout(cols) {
        const pcs = document.querySelectorAll('.page-content');
        if (cols <= 1) {
            pcs.forEach(pc => { pc.style.columnCount = ''; pc.style.columnGap = ''; pc.style.columnRule = ''; });
            _toast('Single column layout', 'info');
        } else {
            pcs.forEach(pc => { pc.style.columnCount = cols; pc.style.columnGap = '2em'; pc.style.columnRule = '1px solid #dde1ea'; });
            _toast(`${cols}-column layout applied`, 'info');
        }
        _reflowAfterStyle();
    }


    /* ═══════════════════════════════════════════════════
     *  SECTION 12 ▸ SPELL CHECK TOGGLE
     * ═══════════════════════════════════════════════════ */

    let _spellCheckEnabled = true;
    function _toggleSpellCheck(enable) {
        _spellCheckEnabled = enable ?? !_spellCheckEnabled;
        document.querySelectorAll('.page-content').forEach(pc => { pc.spellcheck = _spellCheckEnabled; });
        _toast(_spellCheckEnabled ? 'Spell check ON' : 'Spell check OFF', 'info');
        return _spellCheckEnabled;
    }


    /* ═══════════════════════════════════════════════════
     *  SECTION 13 ▸ READ-ONLY MODE
     * ═══════════════════════════════════════════════════ */

    let _readOnly = false;
    function _setReadOnly(enable) {
        _readOnly = enable;
        document.querySelectorAll('.page-content').forEach(pc => {
            pc.contentEditable = enable ? 'false' : 'true';
        });
        _toast(enable ? '🔒 Read-only mode ON' : '✏️ Edit mode ON', enable ? 'warn' : 'success');
    }


    /* ═══════════════════════════════════════════════════
     *  SECTION 14 ▸ PRINT ENGINE
     * ═══════════════════════════════════════════════════ */

    function _print() {
        const c = _container();
        if (!c) return;
        const pages = c.querySelectorAll('.page-content');
        if (!pages.length) return;

        const paperSizes = {
            a4: '210mm 297mm', a3: '297mm 420mm', a5: '148mm 210mm',
            letter: '8.5in 11in', legal: '8.5in 14in', executive: '184.1mm 266.7mm',
        };
        const paperVal = document.getElementById('paperSize')?.value || 'a4';
        const pageSize = paperSizes[paperVal] || paperSizes.a4;
        const title    = document.getElementById('noteTitle')?.value || 'Document';

        let allContent = '';
        pages.forEach((pg, i) => {
            allContent += pg.innerHTML;
            if (i < pages.length - 1) allContent += '<div style="page-break-after:always;"></div>';
        });

        const existingStyles = Array.from(document.styleSheets).map(ss => {
            try { return Array.from(ss.cssRules).map(r => r.cssText).join('\n'); }
            catch { return ''; }
        }).join('\n');

        // ── Hidden iframe — new tab nahi khulta ──
        const oldFrame = document.getElementById('_we_print_frame');
        if (oldFrame) oldFrame.remove();

        const iframe = document.createElement('iframe');
        iframe.id = '_we_print_frame';
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
        document.body.appendChild(iframe);

        const idoc = iframe.contentDocument || iframe.contentWindow.document;
        idoc.open();
        idoc.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>${title}</title>
<style>
${existingStyles}
*{box-sizing:border-box}
body{font-family:"Times New Roman",Times,serif;line-height:1.6;color:#000;margin:0}
@page{size:${pageSize};margin:2.54cm}
.editor-page,.page-indicator,.page-number,.we-resize-handle{display:none!important}
div[style*="page-break-after"]{page-break-after:always}
p{margin-bottom:.6em}
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ccc;padding:6px 8px}
img{max-width:100%;height:auto}
</style></head><body>
${allContent}</body></html>`);
        idoc.close();

        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => iframe.remove(), 1000);
            }, 200);
        };
    }


    /* ═══════════════════════════════════════════════════
     *  SECTION 15 ▸ KEYBOARD SHORTCUTS MODAL
     * ═══════════════════════════════════════════════════ */

    function _showKeyboardShortcuts() {
        const existing = document.getElementById('we-shortcuts-modal');
        if (existing) { existing.remove(); return; }
        const GROUPS = [
            { group: '✏️ Text Formatting', items: [
                { keys: 'Ctrl+B',    desc: 'Bold' },
                { keys: 'Ctrl+I',    desc: 'Italic' },
                { keys: 'Ctrl+U',    desc: 'Underline' },
                { keys: 'Ctrl+⇧+X', desc: 'Strikethrough' },
                { keys: 'Ctrl+⇧+H', desc: 'Clear Formatting' },
                { keys: 'Ctrl+⇧+P', desc: 'Superscript' },
                { keys: 'Ctrl+⇧+B', desc: 'Subscript' },
            ]},
            { group: '📐 Alignment', items: [
                { keys: 'Ctrl+L', desc: 'Align Left' },
                { keys: 'Ctrl+E', desc: 'Align Center' },
                { keys: 'Ctrl+R', desc: 'Align Right' },
                { keys: 'Ctrl+J', desc: 'Justify' },
            ]},
            { group: '📋 Lists', items: [
                { keys: 'Ctrl+⇧+L', desc: 'Bullet List' },
                { keys: 'Ctrl+⇧+N', desc: 'Numbered List' },
                { keys: 'Tab',      desc: 'Indent' },
                { keys: '⇧+Tab',   desc: 'Outdent' },
            ]},
            { group: '📄 Document', items: [
                { keys: 'Ctrl+A',  desc: 'Select All' },
                { keys: 'Ctrl+C',  desc: 'Copy' },
                { keys: 'Ctrl+X',  desc: 'Cut' },
                { keys: 'Ctrl+Z',  desc: 'Undo' },
                { keys: 'Ctrl+Y',  desc: 'Redo' },
                { keys: 'Ctrl+P',  desc: 'Print' },
                { keys: 'Ctrl+⏎', desc: 'Page Break' },
                { keys: 'Ctrl+F',  desc: 'Find & Replace' },
                { keys: 'Ctrl+K',  desc: 'Insert Link' },
            ]},
            { group: '🗂️ Headings', items: [
                { keys: 'Ctrl+1', desc: 'Heading 1' },
                { keys: 'Ctrl+2', desc: 'Heading 2' },
                { keys: 'Ctrl+3', desc: 'Heading 3' },
                { keys: 'Ctrl+4', desc: 'Heading 4' },
                { keys: 'Ctrl+5', desc: 'Heading 5' },
                { keys: 'Ctrl+6', desc: 'Heading 6' },
            ]},
        ];
        const modal = document.createElement('div');
        modal.id = 'we-shortcuts-modal';
        modal.style.cssText = `
            position:fixed;inset:0;z-index:99999;
            background:rgba(0,0,0,.45);backdrop-filter:blur(4px);
            display:flex;align-items:center;justify-content:center;
        `;
        const box = document.createElement('div');
        box.style.cssText = `
            background:#fff;border-radius:14px;padding:28px 32px 24px;
            width:min(680px,94vw);max-height:88vh;overflow-y:auto;
            box-shadow:0 24px 64px rgba(0,0,0,.25);position:relative;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        `;
        const title = document.createElement('h2');
        title.textContent = '⌨️ Keyboard Shortcuts';
        title.style.cssText = 'margin:0 0 20px;font-size:1.3rem;color:#1a1d23;border-bottom:2px solid #e8e8f0;padding-bottom:12px;';
        box.appendChild(title);
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML   = '✕';
        closeBtn.style.cssText = `
            position:absolute;top:16px;right:16px;
            background:#f0f0f5;border:none;border-radius:50%;
            width:32px;height:32px;font-size:14px;cursor:pointer;
            color:#555;display:flex;align-items:center;justify-content:center;
        `;
        closeBtn.onclick = () => modal.remove();
        box.appendChild(closeBtn);
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px;';
        GROUPS.forEach(group => {
            const section = document.createElement('div');
            const gh = document.createElement('div');
            gh.textContent = group.group;
            gh.style.cssText = 'font-weight:700;font-size:.82rem;color:#5a5aaa;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;';
            section.appendChild(gh);
            group.items.forEach(item => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f3f3f8;';
                const desc = document.createElement('span');
                desc.textContent  = item.desc;
                desc.style.cssText = 'font-size:.88rem;color:#333;';
                const kbd = document.createElement('span');
                kbd.style.cssText = 'display:flex;gap:4px;';
                item.keys.split('+').forEach((k, idx, arr) => {
                    const kEl = document.createElement('kbd');
                    kEl.textContent = k;
                    kEl.style.cssText = `
                        background:#f0f0f7;border:1px solid #ccc;border-radius:5px;
                        padding:2px 7px;font-size:.75rem;font-family:monospace;
                        color:#1a1a2e;box-shadow:0 1px 0 #bbb;
                    `;
                    kbd.appendChild(kEl);
                    if (idx < arr.length - 1) {
                        const plus = document.createElement('span');
                        plus.textContent   = '+';
                        plus.style.cssText = 'color:#999;font-size:.8rem;align-self:center;';
                        kbd.appendChild(plus);
                    }
                });
                row.appendChild(desc);
                row.appendChild(kbd);
                section.appendChild(row);
            });
            grid.appendChild(section);
        });
        box.appendChild(grid);
        modal.appendChild(box);
        document.body.appendChild(modal);
        const onKey = (e) => {
            if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); }
        };
        document.addEventListener('keydown', onKey);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }


    /* ═══════════════════════════════════════════════════
     *  SECTION 16 ▸ MAIN WORD EDITOR CLASS
     * ═══════════════════════════════════════════════════ */

    class WordEditor {

        constructor() {
            this.tableEngine  = TableEngine;
            this.imageEngine  = ImageEngine;
            this.linkEngine   = LinkEngine;
            this.findEngine   = FindEngine;
            this.statsEngine  = StatsEngine;
            this.specialChars = SpecialCharsEngine;
            this._findState   = { lastQuery: '', lastIndex: -1, matches: [] };
            _setupCursorSpanWatcher();
            this._injectGlobalStyles();
            console.log(`📝 WordEditor v${WE_VERSION} ready`);
        }

        get version() { return WE_VERSION; }

        _injectGlobalStyles() {
            if (document.getElementById('we-global-styles')) return;
            const s = document.createElement('style');
            s.id = 'we-global-styles';
            s.textContent = `
                .we-image:hover { outline: 2px dashed #185abd; cursor:pointer; }
                mark.we-find-highlight { background:#FFD700; color:#000; border-radius:2px; padding:0 1px; }
                mark.we-find-highlight.current { background:#ff8c00; color:#fff; }
                .we-table td:hover, .we-table th:hover { background:rgba(24,90,189,.04); }
                #we-toast { white-space:nowrap; }
                [data-we-cursor="1"] { position:relative; }
            `;
            document.head.appendChild(s);
        }

        /* ── Selection helpers ─────────────────────── */
        saveSelection()        { return _saveRange(); }
        restoreSelection(r)    { _restoreRange(r); }
        getActivePageContent() { return _activePC(); }
        getSelectedPages()     { return _selectedPages(); }

        /* ── Undo / Redo ────────────────────────────── */
        undo() {
            const flow  = _getFlow();
            if (!flow) return;
            const state = flow._undoRedo?.undo?.();
            if (state) { flow._loadState(state); flow._undoRedo.stopApplying(); }
        }
        redo() {
            const flow  = _getFlow();
            if (!flow) return;
            const state = flow._undoRedo?.redo?.();
            if (state) { flow._loadState(state); flow._undoRedo.stopApplying(); }
        }

        /* ── Basic Formatting ──────────────────────── */
        bold()          { _applyFormat('bold'); }
        italic()        { _applyFormat('italic'); }
        underline()     { _applyFormat('underline'); }
        strikethrough() { _applyFormat('strikeThrough'); }
        superscript()   { _applyFormat('superscript'); }
        subscript()     { _applyFormat('subscript'); }

        /* ── Font ──────────────────────────────────── */
        setFontFamily(font) {
            if (!font) return;
            if (_hasSelection()) {
                _applyFormat('fontName', font);
            } else {
                _applyStyleAtCursorOrSelection('fontFamily', font);
            }
            _reflowAfterStyle();
        }

        setFontSize(size) {
            if (!size) return;
            const pxValue = _normalizeFontSize(size);
            if (!pxValue) { console.warn('[WordEditor] Invalid font size:', size); return; }
            const sel = global.getSelection?.();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            if (range.collapsed || !sel.toString().length) {
                _insertCursorStyleSpan('fontSize', pxValue, range, sel);
                return;
            }
            const pages     = _selectedPages();
            const origRange = _saveRange();
            const applyToRange = (r) => {
                sel.removeAllRanges();
                sel.addRange(r);
                document.execCommand('fontSize', false, '7');
                const container = r.commonAncestorContainer;
                const pc = (container.nodeType === Node.TEXT_NODE
                    ? container.parentElement
                    : container)?.closest?.('.page-content') || document;
                pc.querySelectorAll('font[size="7"]').forEach(font => {
                    const span = document.createElement('span');
                    span.style.fontSize  = pxValue;
                    span.dataset.weStyle = 'fontSize';
                    while (font.firstChild) span.appendChild(font.firstChild);
                    font.parentNode.replaceChild(span, font);
                });
            };
            if (pages.length === 1) {
                applyToRange(origRange);
            } else {
                pages.forEach((page, idx) => {
                    if (!page.textContent.trim()) return;
                    try {
                        const r = document.createRange();
                        if (idx === 0) {
                            r.setStart(origRange.startContainer, origRange.startOffset);
                            const last = _lastText(page) || page.lastChild;
                            last ? (last.nodeType === Node.TEXT_NODE ? r.setEnd(last, last.length) : r.setEndAfter(last)) : r.selectNodeContents(page);
                        } else if (idx === pages.length - 1) {
                            const first = _firstText(page) || page.firstChild;
                            first ? (first.nodeType === Node.TEXT_NODE ? r.setStart(first, 0) : r.setStartBefore(first)) : r.selectNodeContents(page);
                            r.setEnd(origRange.endContainer, origRange.endOffset);
                        } else {
                            r.selectNodeContents(page);
                        }
                        applyToRange(r);
                    } catch (e) {
                        console.warn(`[WordEditor] fontSize page ${page.dataset.page}:`, e);
                    }
                });
            }
            try {
                const sel2 = global.getSelection();
                if (sel2 && origRange) {
                    const endNode = origRange.endContainer;
                    const endEl   = endNode.nodeType === Node.TEXT_NODE ? endNode.parentElement : endNode;
                    const lastSpan = endEl?.closest?.('span[data-we-style="fontSize"]')
                                  || endEl?.querySelector?.('span[data-we-style="fontSize"]:last-child');
                    const afterRange = document.createRange();
                    if (lastSpan && lastSpan.parentNode) {
                        let neutralNode = lastSpan.nextSibling;
                        if (!neutralNode || neutralNode.nodeType !== Node.TEXT_NODE || neutralNode.textContent !== '') {
                            neutralNode = document.createTextNode('\u200B');
                            lastSpan.parentNode.insertBefore(neutralNode, lastSpan.nextSibling);
                            requestAnimationFrame(() => {
                                if (neutralNode.textContent === '\u200B') neutralNode.textContent = '';
                            });
                        }
                        afterRange.setStart(neutralNode, neutralNode.nodeType === Node.TEXT_NODE ? Math.min(1, neutralNode.length) : 0);
                        afterRange.collapse(true);
                    } else {
                        afterRange.setStart(origRange.endContainer, origRange.endOffset);
                        afterRange.collapse(true);
                    }
                    sel2.removeAllRanges();
                    sel2.addRange(afterRange);
                }
            } catch (_) {}
            setTimeout(() => {
                const flow = typeof wordFlow !== 'undefined' && typeof wordFlow.reflowAll === 'function'
                    ? wordFlow : null;
                if (flow) flow.reflowAll();
                else _reflowAfterStyle();
            }, 120);
        }

        /* ════════════════════════════════════════════════════════════
         *  ✅ SET TEXT COLOR — FIXED (v4.3)
         *
         *  Was missing entirely — called by wordColorPalette.applyColor()
         *  but never defined, causing silent failure.
         *
         *  Handles:
         *    ✅ Selection on single page  → execCommand('foreColor')
         *    ✅ Selection across pages    → _applyFormat('foreColor') loop
         *    ✅ No selection (cursor)     → cursor span with color style
         *    ✅ Cleans up <font color>    → converts to <span style="color">
         * ════════════════════════════════════════════════════════════ */
setTextColor(hex) {
    if (!hex) return;
    const color = hex.trim();

    const sel = window.getSelection();
    const activePc = _activePC() || document.querySelector('.page-content');

    // 👉 FIX 1: focus force करना जरूरी है
    if (activePc) activePc.focus();

    if (!sel || sel.rangeCount === 0) {
        _applyStyleAtCursorOrSelection('color', color);
        _toast('Text color applied', 'success', 1200);
        return;
    }

    const range = sel.getRangeAt(0);
    const hasText = !range.collapsed && sel.toString().trim().length > 0;

    if (hasText) {
        const pages = _selectedPages();

        if (pages.length <= 1) {
            // 👉 FIX 2: execCommand reliable बनाने के लिए
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('foreColor', false, color);
        } else {
            _applyFormat('foreColor', color);
        }

        // 👉 FIX 3: font tag cleanup (important)
        document.querySelectorAll('.page-content font[color]').forEach(font => {
            const span = document.createElement('span');
            span.style.color = font.color || font.getAttribute('color');
            while (font.firstChild) span.appendChild(font.firstChild);
            font.parentNode.replaceChild(span, font);
        });

    } else {
        _applyStyleAtCursorOrSelection('color', color);
    }

    _toast('Text color applied', 'success', 1200);
}
        /* ════════════════════════════════════════════════════════════
         *  ✅ SET HIGHLIGHT — FIXED (v4.3)
         *
         *  Was missing entirely — called by wordColorPalette.applyColor()
         *  but never defined, causing silent failure.
         *
         *  Handles:
         *    ✅ Selection on single page  → execCommand('hiliteColor')
         *    ✅ Cross-browser fallback    → backColor if hiliteColor fails
         *    ✅ Selection across pages    → _applyFormat loop
         *    ✅ No selection (cursor)     → cursor span with backgroundColor
         * ════════════════════════════════════════════════════════════ */
        setHighlight(hex) {
            if (!hex) return;
            const color = hex.trim();
            const sel   = global.getSelection?.();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);

            if (!range.collapsed && sel.toString().length > 0) {
                // ── Has text selected ──
                const pages = _selectedPages();
                if (pages.length <= 1) {
                    // hiliteColor applies ONLY to selected text (correct behavior)
                    // backColor applies to entire block — so prefer hiliteColor
                    const ok = document.execCommand('hiliteColor', false, color);
                    if (!ok) document.execCommand('backColor', false, color);
                } else {
                    // Multi-page: try hiliteColor loop, fall back to backColor loop
                    try {
                        _applyFormat('hiliteColor', color);
                    } catch (_) {
                        _applyFormat('backColor', color);
                    }
                }
            } else {
                // ── No selection: apply to next typed characters ──
                _applyStyleAtCursorOrSelection('backgroundColor', color);
            }
            _toast('Highlight applied', 'success', 1200);
        }

        /* ── Alignment ─────────────────────────────── */
        alignLeft()    { _applyFormat('justifyLeft'); }
        alignCenter()  { _applyFormat('justifyCenter'); }
        alignRight()   { _applyFormat('justifyRight'); }
        alignJustify() { _applyFormat('justifyFull'); }

        /* ── Lists & Indent ────────────────────────── */
        bulletList()   { _applyFormat('insertUnorderedList'); }
        numberedList() { _applyFormat('insertOrderedList'); }
        indent()       { document.execCommand('indent',  false, null); }
        outdent()      { document.execCommand('outdent', false, null); }

        /* ── Paragraph Styles ──────────────────────── */
        applyHeading(tag) { _applyHeading(tag); _reflowAfterStyle(); }

        setLineSpacing(value) { _applyLineSpacing(value); }

        setParagraphSpacing(options = {}) {
            const { before = null, after = null } = options;
            const pages = _selectedPages();
            if (!pages.length) return;
            pages.forEach(pc => {
                Array.from(pc.children).forEach(child => {
                    if (before !== null) child.style.marginTop    = before;
                    if (after  !== null) child.style.marginBottom = after;
                });
            });
            _reflowAfterStyle();
        }

        /* ── Clear Formatting ──────────────────────── */
        clearFormatting() {
            try {
                document.execCommand('removeFormat', false, null);
                const sel = global.getSelection();
                if (!sel?.rangeCount) return;
                const range = sel.getRangeAt(0);
                if (range.collapsed) return;
                const frag = range.cloneContents();
                const div  = document.createElement('div');
                div.appendChild(frag);
                div.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
                div.querySelectorAll('[data-we-style],[data-we-cursor]').forEach(el => {
                    el.removeAttribute('data-we-style');
                    el.removeAttribute('data-we-cursor');
                });
                div.querySelectorAll('span:not([class])').forEach(span => {
                    if (!span.attributes.length) {
                        const p = span.parentNode;
                        while (span.firstChild) p.insertBefore(span.firstChild, span);
                        p.removeChild(span);
                    }
                });
                range.deleteContents();
                range.insertNode(div);
                const p = div.parentNode;
                while (div.firstChild) p.insertBefore(div.firstChild, div);
                p.removeChild(div);
                _toast('Formatting cleared', 'info');
            } catch (e) {
                console.warn('[WordEditor] clearFormatting error:', e);
            }
        }


        /* ── Image ─────────────────────────────────── */
        insertImageFromFilePicker() {
            const input    = document.createElement('input');
            input.type     = 'file';
            input.accept   = 'image/*';
            input.onchange = (e) => { const file = e.target.files?.[0]; if (file) ImageEngine.insertFromFile(file); };
            input.click();
        }
        promptInsertImage(url) {
            const src = url || prompt('Enter image URL:');
            if (src) ImageEngine.insertFromUrl(src);
        }

        /* ── Link ──────────────────────────────────── */
        promptInsertLink() {
            const url  = prompt('Enter URL (e.g. https://example.com):');
            if (!url) return;
            const text = _hasSelection() ? null : prompt('Link text:', url);
            LinkEngine.insert(url, text);
        }
        insertLink(url, text, newTab = true) { return LinkEngine.insert(url, text, newTab); }
        removeLink()                         { return LinkEngine.remove(); }
        editLink()                           { return LinkEngine.edit(); }

        /* ── Find & Replace ────────────────────────── */
        findText(query, options = {})              { return FindEngine.find(query, options); }
        findNext()                                  { return FindEngine.findNext(); }
        findPrev()                                  { return FindEngine.findPrev(); }
        replaceText(query, replacement, options)    { return FindEngine.replace(replacement); }
        replaceAllText(query, replacement, options) { return FindEngine.replaceAll(query, replacement, options); }
        clearFind()                                 { FindEngine.clear(); }

        openFindDialog() {
            const existing = document.getElementById('we-find-dialog');
            if (existing) { existing.remove(); return; }
            const dialog = document.createElement('div');
            dialog.id = 'we-find-dialog';
            dialog.style.cssText = `
                position:fixed;top:80px;right:20px;z-index:99998;
                background:#fff;border:1px solid #dde1ea;border-radius:12px;
                padding:16px 18px;box-shadow:0 8px 28px rgba(0,0,0,.15);
                width:320px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                font-size:.85rem;
            `;
            dialog.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <strong style="color:#185abd;font-size:.95rem;">🔍 Find & Replace</strong>
                    <button id="we-find-close" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#666;">✕</button>
                </div>
                <input id="we-find-input" placeholder="Find..." style="width:100%;padding:7px 10px;border:1px solid #dde1ea;border-radius:6px;margin-bottom:8px;font-size:.85rem;outline:none;">
                <input id="we-replace-input" placeholder="Replace with..." style="width:100%;padding:7px 10px;border:1px solid #dde1ea;border-radius:6px;margin-bottom:10px;font-size:.85rem;outline:none;">
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
                    <label style="display:flex;align-items:center;gap:4px;font-size:.78rem;cursor:pointer;"><input type="checkbox" id="we-find-case"> Case</label>
                    <label style="display:flex;align-items:center;gap:4px;font-size:.78rem;cursor:pointer;"><input type="checkbox" id="we-find-word"> Whole word</label>
                    <label style="display:flex;align-items:center;gap:4px;font-size:.78rem;cursor:pointer;"><input type="checkbox" id="we-find-regex"> Regex</label>
                </div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    <button id="we-find-btn"    style="flex:1;padding:6px 8px;background:#185abd;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.8rem;font-weight:600;">Find</button>
                    <button id="we-find-prev"   style="padding:6px 10px;background:#f0f2f7;border:none;border-radius:6px;cursor:pointer;">◀</button>
                    <button id="we-find-next"   style="padding:6px 10px;background:#f0f2f7;border:none;border-radius:6px;cursor:pointer;">▶</button>
                    <button id="we-replace-btn" style="flex:1;padding:6px 8px;background:#f0f2f7;border:none;border-radius:6px;cursor:pointer;font-size:.8rem;">Replace</button>
                    <button id="we-replace-all" style="flex:1;padding:6px 8px;background:#e8f0fe;color:#185abd;border:none;border-radius:6px;cursor:pointer;font-size:.8rem;font-weight:600;">All</button>
                </div>
                <div id="we-find-status" style="margin-top:8px;font-size:.75rem;color:#6b7280;min-height:16px;"></div>
            `;
            document.body.appendChild(dialog);
            const getOpts = () => ({
                caseSensitive: document.getElementById('we-find-case')?.checked,
                wholeWord:     document.getElementById('we-find-word')?.checked,
                useRegex:      document.getElementById('we-find-regex')?.checked,
            });
            const updateStatus = (count) => {
                const s = document.getElementById('we-find-status');
                if (s) s.textContent = count > 0 ? `${count} match${count !== 1 ? 'es' : ''} found` : count === 0 ? 'No matches' : '';
            };
            document.getElementById('we-find-btn').onclick    = () => updateStatus(FindEngine.find(document.getElementById('we-find-input').value, getOpts()));
            document.getElementById('we-find-next').onclick   = () => FindEngine.findNext();
            document.getElementById('we-find-prev').onclick   = () => FindEngine.findPrev();
            document.getElementById('we-replace-btn').onclick = () => FindEngine.replace(document.getElementById('we-replace-input').value);
            document.getElementById('we-replace-all').onclick = () => updateStatus(FindEngine.replaceAll(document.getElementById('we-find-input').value, document.getElementById('we-replace-input').value, getOpts()));
            document.getElementById('we-find-close').onclick  = () => dialog.remove();
            document.getElementById('we-find-input').focus();
        }

        /* ── Statistics ────────────────────────────── */
        getWordCount()              { return StatsEngine.wordCount(); }
        getCharCount(includeSpaces) { return StatsEngine.charCount(includeSpaces); }
        getParagraphCount()         { return StatsEngine.paragraphCount(); }
        getLineCount()              { return StatsEngine.lineCount(); }
        getPageCount()              { return StatsEngine.pageCount(); }
        getStats()                  { return StatsEngine.all(); }
        updateStatusBar()           { StatsEngine.updateStatusBar(); }

        /* ── Page Operations ───────────────────────── */
        addNewPage() {
            try {
                const c      = _container();
                if (!c) return false;
                const pages  = c.querySelectorAll('.editor-page');
                const newNum = pages.length + 1;
                const page   = _createPageEl(newNum, '<p><br></p>');
                c.appendChild(page);
                _reIndex();
                const pc = page.querySelector('.page-content');
                if (pc) {
                    pc.focus();
                    const r = document.createRange();
                    r.selectNodeContents(pc.querySelector('p') || pc);
                    r.collapse(true);
                    const sel = global.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(r);
                }
                _toast('New page added', 'success');
                return true;
            } catch (e) {
                console.error('[WordEditor] addNewPage error:', e);
                return false;
            }
        }

        insertPageBreak() {
            try {
                const sel = global.getSelection();
                if (!sel || sel.rangeCount === 0) return false;

                const range = sel.getRangeAt(0);
                const pc    = range.startContainer.nodeType === Node.TEXT_NODE
                    ? range.startContainer.parentElement?.closest('.page-content')
                    : range.startContainer.closest?.('.page-content');
                if (!pc) return false;

                const page    = pc.closest('.editor-page');
                if (!page) return false;
                const pageNum = parseInt(page.dataset.page, 10);

                if (!range.collapsed) range.deleteContents();

                const cursorRange = sel.getRangeAt(0).cloneRange();
                cursorRange.collapse(true);

                const afterRange = document.createRange();
                afterRange.setStart(cursorRange.startContainer, cursorRange.startOffset);
                afterRange.setEnd(pc, pc.childNodes.length);
                const afterContent = afterRange.extractContents();

                pc.normalize();
                if (!pc.innerHTML.trim() || pc.innerHTML.trim() === '<br>') {
                    pc.innerHTML = '<p><br></p>';
                }

                const newPage = _createPageEl(pageNum + 1, '<p><br></p>');
                const newPC   = newPage.querySelector('.page-content');
                newPC.innerHTML = '';

                const hasContent = afterContent.textContent.replace(/​/g, '').trim().length > 0
                    || afterContent.querySelector('img,table') !== null;
                if (hasContent) {
                    newPC.appendChild(afterContent);
                    if (newPC.firstChild && newPC.firstChild.nodeType === Node.TEXT_NODE) {
                        const p = document.createElement('p');
                        while (newPC.firstChild) p.appendChild(newPC.firstChild);
                        newPC.appendChild(p);
                    }
                } else {
                    newPC.innerHTML = '<p><br></p>';
                }

                newPage.dataset.wfManualBreak = '1';
                page.parentNode.insertBefore(newPage, page.nextSibling);
                _reIndex();

                newPC.focus({ preventScroll: true });
                try {
                    const firstText = (function findFirstText(el) {
                        for (const child of el.childNodes) {
                            if (child.nodeType === Node.TEXT_NODE && child.length > 0) return child;
                            if (child.nodeType === Node.ELEMENT_NODE) {
                                const found = findFirstText(child);
                                if (found) return found;
                            }
                        }
                        return null;
                    })(newPC);

                    const nr = document.createRange();
                    if (firstText) {
                        nr.setStart(firstText, 0);
                    } else {
                        nr.selectNodeContents(newPC.querySelector('p') || newPC);
                        nr.collapse(true);
                    }
                    sel.removeAllRanges();
                    sel.addRange(nr);
                } catch (_) {
                    const nr = document.createRange();
                    nr.selectNodeContents(newPC);
                    nr.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(nr);
                }

                const flow = typeof global.wordFlow !== 'undefined' &&
                             typeof global.wordFlow.reflowAll === 'function'
                    ? global.wordFlow : null;
                if (flow) {
                    flow.reflowAll().then(() => {
                        newPC.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                } else {
                    _reflow(1);
                    requestAnimationFrame(() => {
                        newPC.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                }

                _toast('Page break inserted', 'success');
                return true;
            } catch (e) {
                console.error('[WordEditor] insertPageBreak error:', e);
                return false;
            }
        }

        scrollToPage(pageNum) {
            const page = document.querySelector(`.editor-page[data-page="${pageNum}"]`);
            if (!page) { _toast(`Page ${pageNum} not found`, 'warn'); return false; }
            page.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const pc = page.querySelector('.page-content');
            if (pc) pc.focus({ preventScroll: true });
            return true;
        }

        reIndexPages() { _reIndex(); }

        /* ── Insert Elements ───────────────────────── */
        insertHorizontalRule() { document.execCommand('insertHorizontalRule', false, null); _reflowAfterStyle(); }

        insertCodeBlock(language = '') {
            const sel          = global.getSelection();
            const selectedText = sel?.toString() || '';
            const pre  = document.createElement('pre');
            pre.style.cssText = `
                background:#1e1e2e;color:#cdd6f4;font-family:'JetBrains Mono','Cascadia Code',
                'Fira Code',monospace;font-size:.85rem;padding:16px 20px;border-radius:8px;
                margin:10px 0;overflow-x:auto;border:1px solid #313244;
            `;
            const code = document.createElement('code');
            if (language) code.className = `language-${language}`;
            code.contentEditable = 'true';
            code.textContent     = selectedText || 'code here...';
            pre.appendChild(code);
            if (sel?.rangeCount) {
                const range = sel.getRangeAt(0);
                if (selectedText) range.deleteContents();
                range.insertNode(pre);
                range.setStartAfter(pre);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            pre.parentNode.insertBefore(p, pre.nextSibling);
            _reflowAfterStyle();
        }

        insertDateTime(format = 'datetime') {
            try {
                const sel = global.getSelection();
                if (!sel || sel.rangeCount === 0) return false;
                const anchorNode = sel.getRangeAt(0).commonAncestorContainer;
                const anchorEl   = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
                if (!anchorEl?.closest?.('.page-content')) {
                    _toast('Click inside document first', 'warn');
                    return false;
                }
                const now  = new Date();
                const opts = {
                    date:     { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric' },
                    time:     { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' },
                    datetime: { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                };
                const str   = now.toLocaleString('en-IN', opts[format] || opts.datetime);
                const range = sel.getRangeAt(0);
                const node  = document.createTextNode(str);
                range.deleteContents();
                range.insertNode(node);
                range.setStartAfter(node);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                _toast('Date/time inserted', 'success');
                return true;
            } catch (e) {
                console.error('[WordEditor] insertDateTime error:', e);
                return false;
            }
        }

        insertSpecialChar(char)       { return SpecialCharsEngine.insert(char); }
        showSpecialCharPicker(anchor) { SpecialCharsEngine.showPicker(anchor); }

        /* ── Column Layout ─────────────────────────── */
        setColumnLayout(cols) { _applyColumnLayout(cols); }

        /* ── Spell Check & Read-Only ───────────────── */
        toggleSpellCheck(enable) { return _toggleSpellCheck(enable); }
        setReadOnly(enable)      { _setReadOnly(enable); }
        isReadOnly()             { return _readOnly; }

        /* ── Clipboard ─────────────────────────────── */
        copy() {
            try {
                const sel   = global.getSelection();
                if (!sel || !sel.toString()) return false;
                const pages = _selectedPages();
                if (pages.length <= 1) { document.execCommand('copy'); return true; }
                const range     = sel.getRangeAt(0);
                let htmlToCopy  = '', textToCopy = '';
                pages.forEach((page, idx) => {
                    const r = document.createRange();
                    if (idx === 0) {
                        r.setStart(range.startContainer, range.startOffset);
                        const last = _lastText(page) || page.lastChild;
                        last ? (last.nodeType === Node.TEXT_NODE ? r.setEnd(last, last.length) : r.setEndAfter(last)) : r.selectNodeContents(page);
                    } else if (idx === pages.length - 1) {
                        const first = _firstText(page) || page.firstChild;
                        first ? (first.nodeType === Node.TEXT_NODE ? r.setStart(first, 0) : r.setStartBefore(first)) : r.selectNodeContents(page);
                        r.setEnd(range.endContainer, range.endOffset);
                    } else {
                        htmlToCopy += page.innerHTML; textToCopy += page.textContent + '\n'; return;
                    }
                    const frag = r.cloneContents();
                    htmlToCopy += new XMLSerializer().serializeToString(frag);
                    textToCopy += r.toString();
                    if (idx < pages.length - 1) { htmlToCopy += '\n'; textToCopy += '\n'; }
                });
                if (navigator.clipboard?.write) {
                    navigator.clipboard.write([new ClipboardItem({
                        'text/html':  new Blob([htmlToCopy], { type: 'text/html' }),
                        'text/plain': new Blob([textToCopy], { type: 'text/plain' }),
                    })]);
                } else {
                    document.execCommand('copy');
                }
                return true;
            } catch (e) {
                console.error('[WordEditor] copy error:', e);
                return false;
            }
        }

        deleteSelectedContent() {
            try {
                const sel   = global.getSelection();
                if (!sel || sel.rangeCount === 0) return false;
                const pages = _selectedPages();
                if (!pages.length) return false;
                if (pages.length === 1) { document.execCommand('delete'); return true; }
                const baseRange = sel.getRangeAt(0);
                pages.forEach((page, idx) => {
                    const r = document.createRange();
                    if (idx === 0) {
                        r.setStart(baseRange.startContainer, baseRange.startOffset);
                        const last = _lastText(page) || page.lastChild;
                        last ? (last.nodeType === Node.TEXT_NODE ? r.setEnd(last, last.length) : r.setEndAfter(last)) : r.selectNodeContents(page);
                        r.deleteContents();
                    } else if (idx === pages.length - 1) {
                        const first = _firstText(page) || page.firstChild;
                        first ? (first.nodeType === Node.TEXT_NODE ? r.setStart(first, 0) : r.setStartBefore(first)) : r.selectNodeContents(page);
                        r.setEnd(baseRange.endContainer, baseRange.endOffset);
                        r.deleteContents();
                    } else {
                        page.innerHTML = '';
                    }
                });
                _reflow();
                return true;
            } catch (e) {
                console.error('[WordEditor] deleteSelectedContent error:', e);
                return false;
            }
        }

        cut() { return this.copy() && this.deleteSelectedContent(); }
        paste() { return true; }

        pasteFallback() {
            if (!navigator.clipboard) {
                _toast('Clipboard API not available. Use Ctrl+V.', 'warn');
                return false;
            }
            const pc = _activePC();
            if (!pc) { _toast('Click inside document first', 'warn'); return false; }
            const savedRange = _saveRange();
            const doInsertHTML = (html) => {
                _restoreRange(savedRange);
                const clean = (typeof HTMLSanitizer !== 'undefined' && HTMLSanitizer.normalizeFromPaste)
                    ? HTMLSanitizer.normalizeFromPaste(html) : html;
                document.execCommand('insertHTML', false, clean);
                _reflow();
            };
            const doInsertText = (text) => {
                if (!text) return;
                _restoreRange(savedRange);
                document.execCommand('insertText', false, text);
                _reflow();
            };
            const fallbackToText = () => {
                navigator.clipboard.readText()
                    .then(doInsertText)
                    .catch(() => _toast('Paste blocked by browser — use Ctrl+V.', 'warn', 3500));
            };
            navigator.clipboard.read()
                .then(items => {
                    let handled = false;
                    for (const item of items) {
                        if (item.types.includes('text/html')) {
                            handled = true;
                            item.getType('text/html').then(b => b.text()).then(doInsertHTML).catch(fallbackToText);
                            break;
                        }
                        if (item.types.includes('text/plain')) {
                            handled = true;
                            item.getType('text/plain').then(b => b.text()).then(doInsertText).catch(fallbackToText);
                            break;
                        }
                    }
                    if (!handled) fallbackToText();
                })
                .catch(fallbackToText);
            return true;
        }

        /* ════════════════════════════════════════════════════════════
         *  ✅ SELECT ALL — FIXED (v4.2 — kept as-is)
         * ════════════════════════════════════════════════════════════ */
        selectAll() {
            const pages = Array.from(document.querySelectorAll('.page-content'));
            if (!pages.length) return false;
            if (pages.length === 1) {
                pages[0].focus();
                document.execCommand('selectAll', false, null);
                return true;
            }
            const sel     = global.getSelection();
            const range   = document.createRange();
            const firstTN = _firstText(pages[0]);
            const lastTN  = _lastText(pages[pages.length - 1]);
            if (firstTN && lastTN) {
                range.setStart(firstTN, 0);
                range.setEnd(lastTN, lastTN.length);
            } else {
                range.setStart(pages[0], 0);
                range.setEnd(pages[pages.length - 1], pages[pages.length - 1].childNodes.length);
            }
            sel.removeAllRanges();
            sel.addRange(range);
            return true;
        }

        /* ── Print ─────────────────────────────────── */
printNote() {
    _print();
}

        /* ── UI Helpers ────────────────────────────── */
        showKeyboardShortcuts() { _showKeyboardShortcuts(); }
        toast(msg, type, dur)   { _toast(msg, type, dur); }
        showContextMenu(x, y)   { ContextMenuEngine.show(x, y, this); }

    } // end class WordEditor


    /* ═══════════════════════════════════════════════════
     *  SECTION 17 ▸ INITIALIZATION & KEYBOARD BINDINGS
     * ═══════════════════════════════════════════════════ */

    let _instance = null;

    function _initWordEditor() {
        if (_instance) return _instance;
        _instance = new WordEditor();

        const bindChange = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', e => fn(e.target.value));
        };

        bindChange('fontFamily',      v => _instance.setFontFamily(v));
        bindChange('fontSize',        v => _instance.setFontSize(v));
        bindChange('headingStyle',    v => _instance.applyHeading(v || 'p'));
        bindChange('lineSpacing',     v => _instance.setLineSpacing(parseFloat(v) || 1.5));

        document.addEventListener('keydown', (e) => {
            const ctrl  = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;
            const key   = e.key;
            const keyL  = key.toLowerCase();

            if (ctrl && !shift) {
                switch (keyL) {
                    case 'b':     e.preventDefault(); _instance.bold();             return;
                    case 'i':     e.preventDefault(); _instance.italic();           return;
                    case 'u':     e.preventDefault(); _instance.underline();        return;
                    case 'l':     e.preventDefault(); _instance.alignLeft();        return;
                    case 'e':     e.preventDefault(); _instance.alignCenter();      return;
                    case 'r':     e.preventDefault(); _instance.alignRight();       return;
                    case 'j':     e.preventDefault(); _instance.alignJustify();     return;
                    case 'p':     e.preventDefault(); _instance.printNote();        return;
                    case 'k':     e.preventDefault(); _instance.promptInsertLink(); return;
                    case 'f':     e.preventDefault(); _instance.openFindDialog();   return;
                    case 'c':     _instance.copy();                                 return;
                    case 'x':     _instance.cut();                                  return;
                    case 'a':     if (_instance.selectAll()) e.preventDefault();    return;
                    case 'enter': e.preventDefault(); _instance.insertPageBreak();  return;
                    case '1':     e.preventDefault(); _instance.applyHeading('h1'); return;
                    case '2':     e.preventDefault(); _instance.applyHeading('h2'); return;
                    case '3':     e.preventDefault(); _instance.applyHeading('h3'); return;
                    case '4':     e.preventDefault(); _instance.applyHeading('h4'); return;
                    case '5':     e.preventDefault(); _instance.applyHeading('h5'); return;
                    case '6':     e.preventDefault(); _instance.applyHeading('h6'); return;
                }
            }

            if (ctrl && shift) {
                if (['l','n','x','h','p','b'].includes(keyL)) e.preventDefault();
                switch (keyL) {
                    case 'l': _instance.bulletList();      return;
                    case 'n': _instance.numberedList();    return;
                    case 'x': _instance.strikethrough();   return;
                    case 'h': _instance.clearFormatting(); return;
                    case 'p': _instance.superscript();     return;
                    case 'b': _instance.subscript();       return;
                }
            }

            if (key === 'Tab' && document.activeElement?.classList.contains('page-content')) {
                e.preventDefault();
                if (shift) _instance.outdent();
                else       _instance.indent();
                return;
            }

            if ((key === 'Delete' || key === 'Backspace') && _hasSelection()) {
                if (_selectedPages().length > 1) {
                    e.preventDefault();
                    _instance.deleteSelectedContent();
                }
            }

        }, false);

        document.addEventListener('contextmenu', (e) => {
            const target   = e.target;
            const isEditor = target.classList.contains('page-content') ||
                             target.closest?.('.page-content') ||
                             target.classList.contains('we-table') ||
                             target.closest?.('.we-table');
            if (!isEditor) return;
            e.preventDefault();
            ContextMenuEngine.show(e.clientX, e.clientY, _instance);
        });

        document.addEventListener('dragover', (e) => {
            if (e.target.closest?.('.page-content')) e.preventDefault();
        });
        document.addEventListener('drop', (e) => {
            const pc = e.target.closest?.('.page-content');
            if (!pc) return;
            const files = e.dataTransfer?.files;
            if (files?.length) {
                e.preventDefault();
                Array.from(files).forEach(file => {
                    if (file.type.startsWith('image/')) ImageEngine.insertFromFile(file);
                });
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('page-content')) {
                clearTimeout(_initWordEditor._statusTimer);
                _initWordEditor._statusTimer = setTimeout(() => StatsEngine.updateStatusBar(), 500);
            }
        });
        _initWordEditor._statusTimer = null;

        setTimeout(() => StatsEngine.updateStatusBar(), 800);

        global.wordEditor = _instance;
        console.log(`✅ WordEditor v${WE_VERSION} initialized`);
        return _instance;
    }

    function _safeInit() {
        if (_getFlow()) { _initWordEditor(); return; }
        let tries = 0;
        const poll = setInterval(() => {
            if (_getFlow() || ++tries >= 80) {
                clearInterval(poll);
                if (!_getFlow()) console.warn('[WordEditor] WordFlow not detected — initializing standalone');
                _initWordEditor();
            }
        }, 10);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _safeInit);
    } else {
        setTimeout(_safeInit, 0);
    }

    global.WordEditor     = WordEditor;
    global.initWordEditor = _initWordEditor;

    console.log(`📝 Word Editor Functions v${WE_VERSION} loaded`);

})(typeof window !== 'undefined' ? window : this);


/* ═══════════════════════════════════════════════════════════════════════════
 *  STANDALONE FUNCTION: showKeyboardShortcuts()
 * ═══════════════════════════════════════════════════════════════════════════ */
window.showKeyboardShortcuts = function () {
    if (window.wordEditor) window.wordEditor.showKeyboardShortcuts();
};