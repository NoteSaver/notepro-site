/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                              ║
 * ║   ⚡  ADVANCED EDITOR FEATURES  —  v3.0  "DRAGGABLE TABLE EDITION"         ║
 * ║                                                                              ║
 * ║   Architecture: IIFE-isolated, Flow.js safe, zero global pollution          ║
 * ║                                                                              ║
 * ║   CHANGES in v3.0:                                                           ║
 * ║   🔧 Glass/blur backdrop REMOVED — simple dark overlay only                ║
 * ║   ✅ Tables are DRAGGABLE — pakad ke kahi bhi move kar sako                ║
 * ║   ✅ Drag handle (⠿) appears on table hover top-left corner               ║
 * ║   ✅ Table wraps in position:absolute container after first drag            ║
 * ║   ✅ Touch/mobile drag support included                                     ║
 * ║   ✅ All v2.0 features retained (Find/Replace, Image, Export, etc.)        ║
 * ║                                                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

;(function (global) {
    'use strict';

    const VERSION = '3.0.0';

    /* ═══════════════════════════════════════════════════
     *  HELPERS
     * ═══════════════════════════════════════════════════ */

    function _flow() {
        const f = global.wordFlow || global.wordFlowController;
        return (f && typeof f.reflowAll === 'function') ? f : null;
    }

    function _reflow() {
        const f = _flow();
        if (!f) return;
        if (typeof f.reflowAll === 'function')         f.reflowAll();
        else if (typeof f.performReflow === 'function') f.performReflow();
    }

    function _activePC() {
        const sel = global.getSelection?.();
        if (sel && sel.rangeCount > 0) {
            const node = sel.getRangeAt(0).commonAncestorContainer;
            const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            const pc = el?.closest?.('.page-content');
            if (pc) return pc;
        }
        if (document.activeElement?.classList.contains('page-content'))
            return document.activeElement;
        return document.querySelector('.page-content');
    }

    function _esc(str) {
        return String(str).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
        })[c]);
    }

    function _textNodes(root) {
        const nodes = [];
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        let n;
        while ((n = w.nextNode())) nodes.push(n);
        return nodes;
    }


    /* ═══════════════════════════════════════════════════
     *  SCOPED CSS (injected once)
     * ═══════════════════════════════════════════════════ */
    function _injectStyles() {
        if (document.getElementById('aef-styles')) return;
        const style = document.createElement('style');
        style.id = 'aef-styles';
        style.textContent = `
            /* ── Backdrop — NO blur, NO glass ── */
            .aef-backdrop {
                position: fixed; inset: 0;
                background: rgba(0, 0, 0, 0.45);
                z-index: 10200;
                display: flex; align-items: center; justify-content: center;
                padding: 12px;
                animation: aefFadeIn .15s ease;
                pointer-events: none;
            }
            @keyframes aefFadeIn { from { opacity:0; } to { opacity:1; } }

            /* ── Dialog panel ── */
            .aef-dialog {
                background: #ffffff;
                border-radius: 10px;
                box-shadow: 0 16px 40px rgba(0,0,0,.25), 0 3px 10px rgba(0,0,0,.10);
                width: 100%; max-width: 380px;
                max-height: 85vh; overflow-y: auto;
                animation: aefSlideUp .2s cubic-bezier(.34,1.56,.64,1);
                position: fixed;
                pointer-events: all;
                cursor: default;
            }
            .aef-dialog.aef-wide { max-width: 480px; }
            .aef-dialog.aef-draggable-dlg { user-select: none; }
            @keyframes aefSlideUp {
                from { transform: translateY(16px) scale(.97); opacity:0; }
                to   { transform: translateY(0)    scale(1);   opacity:1; }
            }

            /* ── Header ── */
            .aef-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 11px 14px 9px;
                border-bottom: 1px solid #eef0f5;
                cursor: grab;
            }
            .aef-header:active { cursor: grabbing; }
            .aef-header h5 {
                margin: 0; font-size: 13px; font-weight: 700;
                color: #1a1d2e; letter-spacing: -.1px;
            }
            .aef-close {
                width: 24px; height: 24px; border-radius: 6px;
                border: none; background: #f3f4f8; color: #666;
                cursor: pointer; font-size: 13px; line-height: 24px;
                text-align: center; transition: background .15s;
                flex-shrink: 0;
            }
            .aef-close:hover { background: #e4e6ee; color: #1a1d2e; }

            /* ── Body / Footer ── */
            .aef-body  { padding: 12px 14px 4px; }
            .aef-footer {
                display: flex; justify-content: flex-end; gap: 6px;
                padding: 8px 14px 12px;
                border-top: 1px solid #eef0f5;
                flex-wrap: wrap;
            }

            /* ── Buttons ── */
            .aef-btn {
                padding: 6px 12px; border-radius: 6px; border: none;
                font-size: 11px; font-weight: 700; cursor: pointer;
                transition: all .15s; white-space: nowrap;
            }
            .aef-btn-ghost   { background: #f0f2f7; color: #555; }
            .aef-btn-ghost:hover { background: #e2e5f0; }
            .aef-btn-primary { background: #3b5bdb; color: #fff; box-shadow: 0 2px 8px rgba(59,91,219,.28); }
            .aef-btn-primary:hover { background: #2f4bc0; box-shadow: 0 4px 12px rgba(59,91,219,.42); transform: translateY(-1px); }
            .aef-btn-danger  { background: #e03131; color: #fff; }
            .aef-btn-danger:hover  { background: #c92a2a; }
            .aef-btn-success { background: #2f9e44; color: #fff; }
            .aef-btn-success:hover { background: #276e34; }
            .aef-btn-warn    { background: #f08c00; color: #fff; }
            .aef-btn-warn:hover { background: #d47500; }

            /* ── Form elements ── */
            .aef-label {
                display: block; font-size: 10px; font-weight: 700;
                color: #6b7080; text-transform: uppercase; letter-spacing: .5px;
                margin-bottom: 4px;
            }
            .aef-input, .aef-select {
                width: 100%; padding: 6px 9px;
                border: 1.5px solid #dde0ea; border-radius: 6px;
                font-size: 12px; color: #1a1d2e; background: #fff;
                outline: none; transition: border-color .15s, box-shadow .15s;
                margin-bottom: 10px; box-sizing: border-box;
            }
            .aef-input:focus, .aef-select:focus {
                border-color: #3b5bdb;
                box-shadow: 0 0 0 2px rgba(59,91,219,.12);
            }
            .aef-check-row {
                display: flex; align-items: center; gap: 6px;
                font-size: 12px; color: #444; margin-bottom: 6px; cursor: pointer;
            }
            .aef-check-row input[type=checkbox] {
                width: 13px; height: 13px; accent-color: #3b5bdb; cursor: pointer;
            }

            /* ── Search highlight ── */
            mark.aef-match {
                background: #FFD43B; color: #000; border-radius: 2px; padding: 0 1px;
            }
            mark.aef-match.aef-current {
                background: #ff6b35; color: #fff; outline: 2px solid #ff6b35;
            }
            mark.aef-match.aef-replaced {
                background: #8ce99a; color: #000;
            }

            /* ── Stats pill ── */
            .aef-stats {
                background: #eef3ff; border: 1px solid #c5d0fa;
                border-radius: 6px; padding: 5px 9px;
                font-size: 11px; color: #3b5bdb; font-weight: 600;
                margin-bottom: 10px; display: none;
            }

            /* ── Notification toast ── */
            .aef-toast {
                position: fixed; top: 20px; right: 20px;
                z-index: 10500; min-width: 280px;
                padding: 12px 18px; border-radius: 10px;
                font-size: 13px; font-weight: 600; color: #fff;
                box-shadow: 0 8px 24px rgba(0,0,0,.18);
                animation: aefToastIn .2s ease;
                pointer-events: none;
            }
            @keyframes aefToastIn {
                from { opacity:0; transform: translateX(20px); }
                to   { opacity:1; transform: translateX(0); }
            }
            .aef-toast-info    { background: #1971c2; }
            .aef-toast-success { background: #2f9e44; }
            .aef-toast-warning { background: #e67700; }
            .aef-toast-danger  { background: #c92a2a; }

            /* ── Export format buttons ── */
            .aef-export-grid {
                display: grid; grid-template-columns: 1fr 1fr 1fr;
                gap: 10px; margin-top: 8px;
            }
            .aef-export-btn {
                display: flex; flex-direction: column; align-items: center;
                gap: 6px; padding: 14px 10px;
                border: 1.5px solid #dde0ea; border-radius: 10px;
                background: #fff; cursor: pointer; font-size: 12px;
                font-weight: 700; color: #555; transition: all .15s;
            }
            .aef-export-btn:hover {
                border-color: #3b5bdb; background: #eef3ff; color: #3b5bdb;
            }
            .aef-export-btn span.aef-icon { font-size: 22px; }

            /* ── Separator ── */
            .aef-sep { border: none; border-top: 1px solid #eef0f5; margin: 8px 0; }

            /* ── Navigation row ── */
            .aef-nav-row {
                display: flex; align-items: center; gap: 5px; margin-bottom: 10px;
            }
            .aef-nav-row .aef-count {
                flex: 1; font-size: 11px; color: #888; font-weight: 600;
            }

            /* ══════════════════════════════════════════
             *  DRAGGABLE TABLE STYLES
             * ══════════════════════════════════════════ */

            /* Wrapper that enables free positioning */
            .aef-table-wrapper {
                position: relative;
                display: inline-block;
                margin: 8px 0;
            }

            /* Blue drag handle — shows on wrapper hover */
            .aef-drag-handle {
                position: absolute;
                top: -18px;
                left: 0;
                height: 18px;
                padding: 0 8px;
                background: #3b5bdb;
                color: #fff;
                font-size: 11px;
                font-weight: 700;
                line-height: 18px;
                border-radius: 4px 4px 0 0;
                cursor: grab;
                user-select: none;
                opacity: 0;
                transition: opacity .15s;
                z-index: 100;
                white-space: nowrap;
                letter-spacing: 1px;
            }
            .aef-drag-handle:active { cursor: grabbing; }

            .aef-table-wrapper:hover .aef-drag-handle,
            .aef-table-wrapper.aef-dragging .aef-drag-handle {
                opacity: 1;
            }

            /* Blue dashed outline while dragging */
            .aef-table-wrapper.aef-dragging table {
                outline: 2px dashed #3b5bdb;
                outline-offset: 3px;
            }
        `;
        document.head.appendChild(style);
    }


    /* ═══════════════════════════════════════════════════
     *  DIALOG BASE
     * ═══════════════════════════════════════════════════ */
    class AefDialog {
        constructor() {
            this._backdrop   = null;
            this._prevFocus  = null;
            this._keyHandler = null;
        }

        open({ id, title, icon, wide = false, bodyHTML, footerHTML }) {
            _injectStyles();
            this.close();
            this._prevFocus = document.activeElement;

            const bd = document.createElement('div');
            bd.className = 'aef-backdrop';
            if (id) bd.id = id + '-backdrop';

            const dlg = document.createElement('div');
            dlg.className = 'aef-dialog' + (wide ? ' aef-wide' : '');
            dlg.setAttribute('role', 'dialog');
            dlg.setAttribute('aria-modal', 'true');
            dlg.setAttribute('aria-label', title);
            dlg.tabIndex = -1;

            dlg.innerHTML = `
                <div class="aef-header">
                    <h5>${icon} ${_esc(title)}</h5>
                    <button class="aef-close" aria-label="Close">✕</button>
                </div>
                <div class="aef-body">${bodyHTML}</div>
                ${footerHTML ? `<div class="aef-footer">${footerHTML}</div>` : ''}
            `;

            bd.appendChild(dlg);
            document.body.appendChild(bd);
            this._backdrop = bd;
            this._dialog   = dlg;

            dlg.querySelector('.aef-close').addEventListener('click', () => this.close());
            // Click outside dialog to close
            bd.addEventListener('click', e => { if (e.target === bd) this.close(); });
            document.addEventListener('click', e => {
                if (this._backdrop && dlg.style.left && !dlg.contains(e.target)) {
                    this.close();
                }
            }, { once: true, capture: false });

            this._keyHandler = e => {
                if (e.key === 'Escape') { this.close(); return; }
                if (e.key === 'Tab')    this._trapFocus(e);
            };
            document.addEventListener('keydown', this._keyHandler);

            requestAnimationFrame(() => dlg.focus());

            // Make dialog draggable via header
            const header = dlg.querySelector('.aef-header');
            if (header) {
                let dlgDragging = false, dlgStartX = 0, dlgStartY = 0, dlgOrigL = 0, dlgOrigT = 0;

                const initPos = () => {
                    if (!dlg.style.left) {
                        const r = dlg.getBoundingClientRect();
                        dlg.style.left = r.left + 'px';
                        dlg.style.top  = r.top  + 'px';
                        dlg.style.transform = 'none';
                        dlg.classList.add('aef-draggable-dlg');
                    }
                };

                const onDlgMove = e => {
                    if (!dlgDragging) return;
                    dlg.style.left = (dlgOrigL + (e.clientX - dlgStartX)) + 'px';
                    dlg.style.top  = (dlgOrigT  + (e.clientY - dlgStartY)) + 'px';
                };
                const onDlgUp = () => {
                    dlgDragging = false;
                    document.removeEventListener('mousemove', onDlgMove);
                    document.removeEventListener('mouseup',   onDlgUp);
                };

                header.addEventListener('mousedown', e => {
                    if (e.target.classList.contains('aef-close')) return;
                    e.preventDefault();
                    initPos();
                    dlgDragging = true;
                    dlgStartX   = e.clientX;
                    dlgStartY   = e.clientY;
                    dlgOrigL    = parseFloat(dlg.style.left) || 0;
                    dlgOrigT    = parseFloat(dlg.style.top)  || 0;
                    document.addEventListener('mousemove', onDlgMove);
                    document.addEventListener('mouseup',   onDlgUp);
                });
            }

            return { bd, dlg };
        }

        close() {
            if (this._backdrop) {
                this._backdrop.remove();
                this._backdrop = null;
                this._dialog   = null;
            }
            if (this._keyHandler) {
                document.removeEventListener('keydown', this._keyHandler);
                this._keyHandler = null;
            }
            try { this._prevFocus?.focus(); } catch {}
        }

        _trapFocus(e) {
            if (!this._dialog) return;
            const focusable = [...this._dialog.querySelectorAll(
                'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )].filter(el => !el.disabled);
            if (!focusable.length) return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first)      { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }

        q(sel)  { return this._dialog?.querySelector(sel); }
        qa(sel) { return [...(this._dialog?.querySelectorAll(sel) || [])]; }
    }


    /* ═══════════════════════════════════════════════════
     *  DRAGGABLE TABLE MANAGER
     * ═══════════════════════════════════════════════════ */
    class TableDragManager {
        /**
         * Wraps a <table> in .aef-table-wrapper and makes it draggable.
         * Safe to call multiple times — skips already-wrapped tables.
         */
        static make(table) {
            if (!table || table.closest('.aef-table-wrapper')) return;

            /* -- Create wrapper -- */
            const wrapper = document.createElement('div');
            wrapper.className = 'aef-table-wrapper';

            /* -- Create drag handle -- */
            const handle = document.createElement('div');
            handle.className = 'aef-drag-handle';
            handle.title     = 'Drag to move table anywhere';
            handle.innerHTML = '⠿ Move Table';
            handle.setAttribute('contenteditable', 'false');

            /* -- Wrap the table -- */
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(handle);
            wrapper.appendChild(table);
            table.setAttribute('draggable', 'false'); // prevent native drag conflict

            /* -- Drag state -- */
            let dragging = false;
            let startX = 0, startY = 0;
            let origLeft = 0, origTop = 0;

            /* -- Convert to absolute on first drag -- */
            function activateAbsolute() {
                if (wrapper.style.position === 'absolute') return;
                const wRect   = wrapper.getBoundingClientRect();
                const parent  = wrapper.offsetParent || document.body;
                const pRect   = parent.getBoundingClientRect();
                const scrollL = wrapper.offsetParent?.scrollLeft || 0;
                const scrollT = wrapper.offsetParent?.scrollTop  || 0;

                wrapper.style.position = 'absolute';
                wrapper.style.left     = (wRect.left - pRect.left + scrollL) + 'px';
                wrapper.style.top      = (wRect.top  - pRect.top  + scrollT) + 'px';
                wrapper.style.margin   = '0';
                wrapper.style.zIndex   = '50';
                wrapper.style.width    = wRect.width + 'px';
            }

            /* -- Mouse events -- */
            const onMouseMove = e => {
                if (!dragging) return;
                wrapper.style.left = (origLeft + (e.clientX - startX)) + 'px';
                wrapper.style.top  = (origTop  + (e.clientY - startY)) + 'px';
            };

            const onMouseUp = () => {
                dragging = false;
                wrapper.classList.remove('aef-dragging');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup',   onMouseUp);
            };

            const startDrag = (clientX, clientY) => {
                activateAbsolute();
                dragging = true;
                wrapper.classList.add('aef-dragging');
                startX   = clientX;
                startY   = clientY;
                origLeft = parseFloat(wrapper.style.left) || 0;
                origTop  = parseFloat(wrapper.style.top)  || 0;
            };

            handle.addEventListener('mousedown', e => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                startDrag(e.clientX, e.clientY);
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup',   onMouseUp);
            });

            /* -- Touch events (mobile support) -- */
            handle.addEventListener('touchstart', e => {
                e.preventDefault();
                const t = e.touches[0];
                startDrag(t.clientX, t.clientY);
            }, { passive: false });

            handle.addEventListener('touchmove', e => {
                if (!dragging) return;
                const t = e.touches[0];
                wrapper.style.left = (origLeft + (t.clientX - startX)) + 'px';
                wrapper.style.top  = (origTop  + (t.clientY - startY)) + 'px';
            }, { passive: true });

            handle.addEventListener('touchend', () => {
                dragging = false;
                wrapper.classList.remove('aef-dragging');
            });
        }
    }


    /* ═══════════════════════════════════════════════════
     *  MAIN CLASS
     * ═══════════════════════════════════════════════════ */
    class AdvancedEditorFeatures {

        constructor() {
            this._matches    = [];
            this._matchIdx   = -1;
            this._lastFormat = 'pdf';

            this._dlg = new AefDialog();

            this._kbHandler = this._onKeyboard.bind(this);
            document.addEventListener('keydown', this._kbHandler);

            _injectStyles();
            console.log(`[AdvancedEditorFeatures] v${VERSION} ready`);
        }


        /* ─────────────────────────────────────────────────
         *  KEYBOARD SHORTCUTS
         * ───────────────────────────────────────────────── */
        _onKeyboard(e) {
            const ctrl = e.ctrlKey || e.metaKey;
            if (!ctrl) return;
            switch (e.key.toLowerCase()) {
                case 'h': e.preventDefault(); this.openSearchReplaceDialog(); break;
                case 'f':
                    if (document.activeElement?.classList.contains('page-content')) {
                        e.preventDefault(); this.openSearchReplaceDialog();
                    }
                    break;
            }
        }


        /* ═══════════════════════════════════════════════
         *  SEARCH & REPLACE
         * ═══════════════════════════════════════════════ */
        openSearchReplaceDialog() {
            const body = `
                <label class="aef-label">Find</label>
                <input id="aefFind" class="aef-input" type="text" placeholder="Search text…" autocomplete="off" />

                <label class="aef-label">Replace with</label>
                <input id="aefReplace" class="aef-input" type="text" placeholder="Replacement…" autocomplete="off" />

                <div class="aef-check-row">
                    <input type="checkbox" id="aefCase"> <label for="aefCase">Case Sensitive</label>
                </div>
                <div class="aef-check-row">
                    <input type="checkbox" id="aefWord"> <label for="aefWord">Whole Word</label>
                </div>
                <div class="aef-check-row">
                    <input type="checkbox" id="aefRegex"> <label for="aefRegex">Regular Expression</label>
                </div>

                <hr class="aef-sep">

                <div class="aef-nav-row">
                    <span class="aef-count" id="aefCount">No results</span>
                    <button class="aef-btn aef-btn-ghost" id="aefPrev">◀ Prev</button>
                    <button class="aef-btn aef-btn-ghost" id="aefNext">Next ▶</button>
                </div>
                <div class="aef-stats" id="aefStats"></div>
            `;

            const footer = `
                <button class="aef-btn aef-btn-ghost"  id="aefBtnFind">🔍 Find All</button>
                <button class="aef-btn aef-btn-warn"   id="aefBtnReplOne">Replace</button>
                <button class="aef-btn aef-btn-danger" id="aefBtnReplAll">Replace All</button>
                <button class="aef-btn aef-btn-ghost"  id="aefBtnClose">Close</button>
            `;

            this._dlg.open({ id: 'aef-search', title: 'Find & Replace', icon: '🔍', bodyHTML: body, footerHTML: footer });

            const d = this._dlg;
            d.q('#aefBtnFind').addEventListener('click',    () => this._doFind());
            d.q('#aefBtnReplOne').addEventListener('click', () => this._doReplaceOne());
            d.q('#aefBtnReplAll').addEventListener('click', () => this._doReplaceAll());
            d.q('#aefBtnClose').addEventListener('click',   () => { this._clearHighlights(); this._dlg.close(); });
            d.q('#aefPrev').addEventListener('click',       () => this._navigate(-1));
            d.q('#aefNext').addEventListener('click',       () => this._navigate(+1));
            d.q('#aefFind').addEventListener('keydown', e => { if (e.key === 'Enter') this._doFind(); });

            setTimeout(() => d.q('#aefFind')?.focus(), 80);
        }

        _buildRegex(term, { caseSensitive, wholeWord, useRegex }) {
            const flags = caseSensitive ? 'g' : 'gi';
            let pat = term;
            if (!useRegex) {
                pat = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (wholeWord) pat = `\\b${pat}\\b`;
            }
            return new RegExp(pat, flags);
        }

        _getSearchOpts() {
            const d = this._dlg;
            return {
                caseSensitive: d.q('#aefCase')?.checked  || false,
                wholeWord:     d.q('#aefWord')?.checked  || false,
                useRegex:      d.q('#aefRegex')?.checked || false,
            };
        }

        _doFind() {
            const term = this._dlg.q('#aefFind')?.value?.trim();
            if (!term) { this._notify('Enter text to find', 'warning'); return; }

            this._clearHighlights();

            let regex;
            try { regex = this._buildRegex(term, this._getSearchOpts()); }
            catch (e) { this._notify('Invalid regex: ' + e.message, 'danger'); return; }

            const pages = [...document.querySelectorAll('.page-content')];
            const nodeSnapshots = [];
            pages.forEach(page => _textNodes(page).forEach(tn => nodeSnapshots.push({ tn })));

            this._matches = [];

            nodeSnapshots.forEach(({ tn }) => {
                const text = tn.textContent;
                regex.lastIndex = 0;
                const found = [];
                let m;
                while ((m = regex.exec(text)) !== null) {
                    found.push({ index: m.index, len: m[0].length, text: m[0] });
                    if (!regex.global) break;
                }
                if (!found.length) return;

                const parent = tn.parentNode;
                if (!parent) return;

                const frag = document.createDocumentFragment();
                let cursor = 0;

                found.forEach(({ index, len, text: matchText }) => {
                    if (index > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, index)));
                    const mark = document.createElement('mark');
                    mark.className   = 'aef-match';
                    mark.textContent = matchText;
                    frag.appendChild(mark);
                    this._matches.push(mark);
                    cursor = index + len;
                });

                if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
                parent.replaceChild(frag, tn);
            });

            const count   = this._matches.length;
            const statsEl = this._dlg.q('#aefStats');
            const countEl = this._dlg.q('#aefCount');

            if (count === 0) {
                if (statsEl) { statsEl.textContent = 'No matches found'; statsEl.style.display = 'block'; }
                if (countEl) countEl.textContent = 'No results';
                this._notify('No matches found', 'info');
                return;
            }

            if (statsEl) { statsEl.textContent = `✅ ${count} match${count !== 1 ? 'es' : ''} found`; statsEl.style.display = 'block'; }

            this._matchIdx = 0;
            this._scrollToMatch(0);
            this._updateCount();
        }

        _navigate(dir) {
            if (!this._matches.length) { this._doFind(); return; }
            this._matchIdx = (this._matchIdx + dir + this._matches.length) % this._matches.length;
            this._scrollToMatch(this._matchIdx);
            this._updateCount();
        }

        _scrollToMatch(idx) {
            this._matches.forEach((m, i) => m.classList.toggle('aef-current', i === idx));
            this._matches[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        _updateCount() {
            const el = this._dlg.q?.('#aefCount');
            if (el) el.textContent = `${this._matchIdx + 1} / ${this._matches.length}`;
        }

        _doReplaceOne() {
            if (!this._matches.length) { this._notify('Find text first', 'warning'); return; }
            const rep  = this._dlg.q('#aefReplace')?.value ?? '';
            const idx  = Math.max(0, this._matchIdx);
            const mark = this._matches[idx];
            if (!mark?.parentNode) { this._notify('Match no longer in DOM', 'warning'); return; }

            mark.textContent = rep;
            mark.classList.add('aef-replaced');
            mark.classList.remove('aef-current');
            this._matches.splice(idx, 1);

            if (this._matches.length) {
                this._matchIdx = idx % this._matches.length;
                this._scrollToMatch(this._matchIdx);
            }
            this._updateCount();
            _normalizePages();
            _reflow();
        }

        _doReplaceAll() {
            if (!this._matches.length) { this._notify('Find text first', 'warning'); return; }
            const rep   = this._dlg.q('#aefReplace')?.value ?? '';
            const count = this._matches.length;

            this._matches.forEach(mark => {
                if (mark.parentNode) mark.replaceWith(document.createTextNode(rep));
            });
            this._matches  = [];
            this._matchIdx = -1;

            _normalizePages();
            _reflow();

            const el = this._dlg.q('#aefCount');
            if (el) el.textContent = `Replaced ${count}`;
            const statsEl = this._dlg.q('#aefStats');
            if (statsEl) { statsEl.textContent = `✅ Replaced ${count} match${count !== 1 ? 'es' : ''}`; statsEl.style.display = 'block'; }

            this._notify(`Replaced ${count} match${count !== 1 ? 'es' : ''}`, 'success');
        }

        _clearHighlights() {
            this._matches.forEach(mark => {
                try { if (mark.parentNode) mark.replaceWith(document.createTextNode(mark.textContent)); } catch {}
            });
            this._matches  = [];
            this._matchIdx = -1;
            _normalizePages();
        }


        /* ═══════════════════════════════════════════════
         *  TABLE INSERT  ✅ Draggable
         * ═══════════════════════════════════════════════ */
        insertTable() {
            const body = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                    <div>
                        <label class="aef-label">Rows</label>
                        <input id="aefTRows" class="aef-input" type="number" value="3" min="1" max="20">
                    </div>
                    <div>
                        <label class="aef-label">Columns</label>
                        <input id="aefTCols" class="aef-input" type="number" value="3" min="1" max="10">
                    </div>
                </div>

                <label class="aef-label">Border Style</label>
                <select id="aefTBorder" class="aef-select">
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="none">No Border</option>
                </select>

                <div class="aef-check-row" style="margin-bottom:14px;">
                    <input type="checkbox" id="aefTHeader" checked>
                    <label for="aefTHeader">Include header row</label>
                </div>
                <div class="aef-check-row">
                    <input type="checkbox" id="aefTStripe">
                    <label for="aefTStripe">Alternating row colors</label>
                </div>
            `;

            const footer = `
                <button class="aef-btn aef-btn-ghost"   id="aefTCancel">Cancel</button>
                <button class="aef-btn aef-btn-primary" id="aefTInsert">Insert Table</button>
            `;

            this._dlg.open({ id: 'aef-table', title: 'Insert Table', icon: '📊', bodyHTML: body, footerHTML: footer });
            this._dlg.q('#aefTCancel').addEventListener('click', () => this._dlg.close());
            this._dlg.q('#aefTInsert').addEventListener('click', () => this._confirmTable());
        }

        _confirmTable() {
            const rows   = Math.min(20, Math.max(1, parseInt(this._dlg.q('#aefTRows')?.value) || 3));
            const cols   = Math.min(10, Math.max(1, parseInt(this._dlg.q('#aefTCols')?.value) || 3));
            const border = this._dlg.q('#aefTBorder')?.value || 'solid';
            const header = this._dlg.q('#aefTHeader')?.checked;
            const stripe = this._dlg.q('#aefTStripe')?.checked;
            const bStyle = border === 'none' ? 'none' : `1px ${border} #ccc`;

            let tableHTML = `<table class="we-table" style="width:100%;border-collapse:collapse;table-layout:fixed;">`;

            if (header) {
                tableHTML += '<thead><tr>';
                for (let c = 0; c < cols; c++)
                    tableHTML += `<th style="border:${bStyle};padding:8px 10px;background:#f3f4f8;font-weight:700;font-size:13px;" contenteditable="true">Header ${c + 1}</th>`;
                tableHTML += '</tr></thead>';
            }

            tableHTML += '<tbody>';
            for (let r = 0; r < rows; r++) {
                const bg = stripe && r % 2 === 1 ? 'background:#fafbff;' : '';
                tableHTML += '<tr>';
                for (let c = 0; c < cols; c++)
                    tableHTML += `<td style="border:${bStyle};padding:8px 10px;font-size:13px;${bg}" contenteditable="true"><br></td>`;
                tableHTML += '</tr>';
            }
            tableHTML += '</tbody></table>';

            this._insertAtCursor(tableHTML + '<p><br></p>');
            this._dlg.close();

            // Make newly inserted table draggable
            setTimeout(() => {
                document.querySelectorAll('.page-content table:not(.aef-table-wrapper table)').forEach(tbl => {
                    TableDragManager.make(tbl);
                });
                this._notify(`Table ${rows}×${cols} inserted — hover to see ⠿ Move handle`, 'success');
            }, 60);
        }


        /* ═══════════════════════════════════════════════
         *  IMAGE INSERT
         * ═══════════════════════════════════════════════ */
        insertImage() {
            const body = `
                <label class="aef-label">Image URL</label>
                <input id="aefImgUrl" class="aef-input" type="url" placeholder="https://example.com/image.png">

                <div style="text-align:center;color:#aaa;font-size:12px;margin:-8px 0 10px;">— or —</div>

                <label class="aef-label">Upload from device</label>
                <input id="aefImgFile" class="aef-input" type="file" accept="image/*" style="padding:6px 10px;">

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:4px;">
                    <div>
                        <label class="aef-label">Width</label>
                        <input id="aefImgW" class="aef-input" type="text" placeholder="100%" value="100%">
                    </div>
                    <div>
                        <label class="aef-label">Alignment</label>
                        <select id="aefImgAlign" class="aef-select">
                            <option value="none">None</option>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                </div>
                <div id="aefImgPreviewWrap" style="display:none;margin-top:8px;text-align:center;">
                    <img id="aefImgPreview" style="max-width:100%;max-height:140px;border-radius:6px;border:1px solid #eee;" src="" alt="Preview">
                </div>
            `;

            const footer = `
                <button class="aef-btn aef-btn-ghost"   id="aefImgCancel">Cancel</button>
                <button class="aef-btn aef-btn-primary" id="aefImgInsert">Insert Image</button>
            `;

            this._dlg.open({ id: 'aef-image', title: 'Insert Image', icon: '🖼️', bodyHTML: body, footerHTML: footer });

            this._dlg.q('#aefImgUrl').addEventListener('input', () => {
                const url  = this._dlg.q('#aefImgUrl').value.trim();
                const wrap = this._dlg.q('#aefImgPreviewWrap');
                const img  = this._dlg.q('#aefImgPreview');
                if (url) { img.src = url; wrap.style.display = 'block'; }
                else       wrap.style.display = 'none';
            });

            this._dlg.q('#aefImgFile').addEventListener('change', e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                    this._dlg.q('#aefImgPreview').src = ev.target.result;
                    this._dlg.q('#aefImgPreviewWrap').style.display = 'block';
                };
                reader.readAsDataURL(file);
            });

            this._dlg.q('#aefImgCancel').addEventListener('click', () => this._dlg.close());
            this._dlg.q('#aefImgInsert').addEventListener('click', () => this._confirmImage());
        }

        _confirmImage() {
            const width   = this._dlg.q('#aefImgW')?.value.trim() || '100%';
            const align   = this._dlg.q('#aefImgAlign')?.value    || 'none';
            const preview = this._dlg.q('#aefImgPreview');
            let src = this._dlg.q('#aefImgUrl')?.value.trim() || preview?.src;

            if (!src || src === location.href) {
                this._notify('Please provide an image URL or upload a file', 'warning');
                return;
            }

            let wrapStyle = 'display:block;margin:8px 0;';
            if (align === 'center')     wrapStyle += 'text-align:center;';
            else if (align === 'left')  wrapStyle += 'float:left;margin-right:12px;';
            else if (align === 'right') wrapStyle += 'float:right;margin-left:12px;';

            const html = `<div style="${wrapStyle}"><img src="${_esc(src)}" style="max-width:${_esc(width)};height:auto;display:inline-block;" alt="image"></div><p><br></p>`;
            this._insertAtCursor(html);
            this._dlg.close();
            this._notify('Image inserted', 'success');
        }


        /* ═══════════════════════════════════════════════
         *  EXPORT
         * ═══════════════════════════════════════════════ */
        openExportDialog() {
            const formats = [
                { key: 'pdf',      icon: '📄', label: 'PDF' },
                { key: 'html',     icon: '🌐', label: 'HTML' },
                { key: 'markdown', icon: '📝', label: 'Markdown' },
                { key: 'txt',      icon: '🔤', label: 'Plain Text' },
                { key: 'json',     icon: '📦', label: 'JSON' },
                { key: 'docx',     icon: '📘', label: 'DOCX' },
            ];

            const btns = formats.map(f => `
                <button class="aef-export-btn" data-fmt="${f.key}">
                    <span class="aef-icon">${f.icon}</span>${f.label}
                </button>
            `).join('');

            this._dlg.open({
                id: 'aef-export', title: 'Export Document', icon: '💾',
                bodyHTML: `<p style="font-size:13px;color:#666;margin-bottom:14px;">Select a format to export your document:</p><div class="aef-export-grid">${btns}</div>`,
                footerHTML: ''
            });

            this._dlg.qa('[data-fmt]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const fmt = btn.dataset.fmt;
                    this._dlg.close();
                    this.exportAs(fmt);
                });
            });
        }

        exportAs(format) {
            const title   = document.getElementById('noteTitle')?.value?.trim() || 'Document';
            const content = this._getContent();
            this._lastFormat = format;

            try {
                switch (format) {
                    case 'pdf':      this._exportPDF(title, content); break;
                    case 'html':     this._download(this._toHTML(title, content), `${title}.html`,  'text/html');       break;
                    case 'markdown': this._download(this._toMD(content),          `${title}.md`,    'text/markdown');   break;
                    case 'txt':      this._download(this._toText(content),         `${title}.txt`,   'text/plain');      break;
                    case 'json':     this._download(this._toJSON(title, content),  `${title}.json`,  'application/json'); break;
                    case 'docx':     this._notify('DOCX export requires server-side processing', 'info'); return;
                    default:         this._notify(`Unknown format: ${format}`, 'danger'); return;
                }
                this._notify(`Exported as ${format.toUpperCase()} ✅`, 'success');
            } catch (e) {
                this._notify('Export failed: ' + e.message, 'danger');
                console.error('[AdvancedEditor] Export error:', e);
            }
        }

        _getContent() {
            const pages = [...document.querySelectorAll('.page-content')];
            return pages.map((p, i) =>
                p.innerHTML + (i < pages.length - 1 ? '<div style="page-break-after:always"></div>' : '')
            ).join('');
        }

        _exportPDF(title, content) {
            if (typeof html2pdf === 'undefined') {
                this._notify('html2pdf not found — using browser print', 'warning');
                window.print();
                return;
            }
            const el = document.createElement('div');
            el.innerHTML = content;
            html2pdf().set({
                margin: 10, filename: `${title}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
            }).save(el);
        }

        _toHTML(title, content) {
            return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${_esc(title)}</title>
<style>
body { font-family: Georgia, serif; line-height: 1.7; max-width: 860px; margin: 0 auto; padding: 40px 24px; color: #222; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; }
th, td { border: 1px solid #ccc; padding: 10px 12px; }
th { background: #f5f5f5; }
img { max-width: 100%; height: auto; }
</style></head>
<body><h1>${_esc(title)}</h1>${content}</body></html>`;
        }

        _toMD(content) {
            return content
                .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, n, t) => '#'.repeat(+n) + ' ' + this._strip(t) + '\n\n')
                .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
                .replace(/<b[^>]*>(.*?)<\/b>/gi,           '**$1**')
                .replace(/<em[^>]*>(.*?)<\/em>/gi,         '*$1*')
                .replace(/<i[^>]*>(.*?)<\/i>/gi,           '*$1*')
                .replace(/<u[^>]*>(.*?)<\/u>/gi,           '_$1_')
                .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
                .replace(/<li[^>]*>(.*?)<\/li>/gi,         '- $1\n')
                .replace(/<p[^>]*>(.*?)<\/p>/gi,           '$1\n\n')
                .replace(/<br\s*\/?>/gi,                   '\n')
                .replace(/<[^>]+>/g,                       '')
                .replace(/\n{3,}/g, '\n\n').trim();
        }

        _toText(content) {
            const d = document.createElement('div');
            d.innerHTML = content;
            return (d.textContent || d.innerText || '').trim();
        }

        _toJSON(title, content) {
            return JSON.stringify({
                metadata: {
                    title, exportedAt: new Date().toISOString(),
                    pages: document.querySelectorAll('.page-content').length,
                    words: this._toText(content).split(/\s+/).filter(Boolean).length,
                    chars: this._strip(content).length,
                },
                content,
            }, null, 2);
        }

        _strip(html) {
            const d = document.createElement('div');
            d.innerHTML = html;
            return d.textContent || '';
        }

        _download(text, filename, mime) {
            const blob = new Blob([text], { type: mime });
            const url  = URL.createObjectURL(blob);
            const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }


        /* ═══════════════════════════════════════════════
         *  INSERT AT CURSOR
         * ═══════════════════════════════════════════════ */
        _insertAtCursor(html) {
            const sel = global.getSelection();

            if (sel && sel.rangeCount > 0) {
                const range  = sel.getRangeAt(0);
                const anchor = range.commonAncestorContainer;
                const pc = (anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor)?.closest('.page-content');

                if (pc) {
                    try {
                        range.deleteContents();
                        const tpl = document.createElement('div');
                        tpl.innerHTML = html;
                        const frag = document.createDocumentFragment();
                        while (tpl.firstChild) frag.appendChild(tpl.firstChild);
                        range.insertNode(frag);
                        range.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        setTimeout(_reflow, 50);
                        return;
                    } catch (e) {
                        console.warn('[AdvancedEditor] insertAtCursor fallback:', e);
                    }
                }
            }

            this._appendToPage(html);
        }

        _appendToPage(html) {
            const pc = _activePC();
            if (!pc) { this._notify('No active page to insert into', 'warning'); return; }
            pc.insertAdjacentHTML('beforeend', html);
            setTimeout(_reflow, 50);
        }


        /* ═══════════════════════════════════════════════
         *  NOTIFICATION
         * ═══════════════════════════════════════════════ */
        _notify(msg, type = 'info') {
            const map    = { info: 'successToast',   success: 'successToast',   warning: 'errorToast',   danger: 'errorToast'   };
            const msgMap = { info: 'successMessage', success: 'successMessage', warning: 'errorMessage', danger: 'errorMessage' };
            const toastEl = document.getElementById(map[type]);
            const msgEl   = document.getElementById(msgMap[type]);

            if (toastEl && msgEl && typeof bootstrap !== 'undefined') {
                msgEl.textContent = msg;
                bootstrap.Toast.getOrCreateInstance(toastEl, { delay: type === 'danger' ? 5000 : 3000 }).show();
                return;
            }

            _injectStyles();
            const toast = Object.assign(document.createElement('div'), {
                className:   `aef-toast aef-toast-${type}`,
                textContent: msg,
            });
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.transition = 'opacity .3s';
                toast.style.opacity    = '0';
                setTimeout(() => toast.remove(), 300);
            }, 3200);
        }


        /* ═══════════════════════════════════════════════
         *  PUBLIC ALIASES
         * ═══════════════════════════════════════════════ */
        openInsertImageDialog() { this.insertImage(); }

        /** Make a specific table draggable manually */
        makeTableDraggable(table) { TableDragManager.make(table); }

        /** Make ALL existing tables on the page draggable at once */
        makeAllTablesDraggable() {
            document.querySelectorAll('.page-content table:not(.aef-table-wrapper table)').forEach(t => {
                TableDragManager.make(t);
            });
        }


        /* ═══════════════════════════════════════════════
         *  CLEANUP
         * ═══════════════════════════════════════════════ */
        destroy() {
            this._clearHighlights();
            this._dlg.close();
            document.removeEventListener('keydown', this._kbHandler);
            console.log('[AdvancedEditorFeatures] Destroyed');
        }
    }


    /* ═══════════════════════════════════════════════════
     *  MODULE HELPERS
     * ═══════════════════════════════════════════════════ */
    function _normalizePages() {
        document.querySelectorAll('.page-content').forEach(pc => {
            try { pc.normalize(); } catch {}
        });
    }


    /* ═══════════════════════════════════════════════════
     *  BOOTSTRAP
     * ═══════════════════════════════════════════════════ */
    function _bootstrap() {
        if (global.advancedEditor instanceof AdvancedEditorFeatures) {
            console.warn('[AdvancedEditorFeatures] Already initialized');
            return;
        }
        const instance = new AdvancedEditorFeatures();
        global.advancedEditor         = instance;
        global.AdvancedEditorFeatures = AdvancedEditorFeatures;
        global.TableDragManager       = TableDragManager;
        console.log(`✅ AdvancedEditorFeatures v${VERSION} ready`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _bootstrap, { once: true });
    } else {
        _bootstrap();
    }

})(typeof window !== 'undefined' ? window : this);