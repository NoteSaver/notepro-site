class FormattingDialogs {
    constructor() {
        this.pageMargins = { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 };
        this.gutter = 0;
        this.gutterPosition = 'left';
        this.lineSpacing = 1.5;
        this.paragraphSpacing = { before: 0, after: 0 };
        this.tabStops = [];
        
        this.loadSettings();
        this.applyMarginsToAllPages();
        this.observeNewPages();
        
        console.log('🔥 Advanced Formatting Dialogs initialized');
    }

    // ==================== LOAD/SAVE SETTINGS ====================
    
    loadSettings() {
        try {
            const saved = sessionStorage.getItem('formattingSettings');
            if (saved) {
                const data = JSON.parse(saved);
                this.pageMargins      = data.margins        || this.pageMargins;
                this.gutter           = data.gutter         || 0;
                this.gutterPosition   = data.gutterPosition || 'left';
                this.lineSpacing      = data.lineSpacing    || 1.5;
                this.paragraphSpacing = data.paragraphSpacing || { before: 0, after: 0 };
                console.log('✅ Settings loaded from session');
                // Re-apply spacing CSS so saved settings persist across page load
                // (inline styles are lost on reload; global CSS is re-injected here)
                this._applySpacingCSS(
                    this.lineSpacing,
                    this.paragraphSpacing.before,
                    this.paragraphSpacing.after
                );
            }
        } catch (e) {
            console.log('Using default formatting settings');
        }
    }

    saveSettings() {
        try {
            sessionStorage.setItem('formattingSettings', JSON.stringify({
                margins: this.pageMargins,
                gutter: this.gutter,
                gutterPosition: this.gutterPosition,
                lineSpacing: this.lineSpacing,
                paragraphSpacing: this.paragraphSpacing
            }));
            console.log('✅ Settings saved to session');
        } catch (e) {
            console.log('Could not save settings');
        }
    }

    // ==================== OBSERVE NEW PAGES ====================
    
    observeNewPages() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.classList?.contains('page-content')) {
                                this.applyMarginsToElement(node);
                            }
                            node.querySelectorAll?.('.page-content')
                                ?.forEach(el => this.applyMarginsToElement(el));
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ==================== PAGE ELEMENT CHECK ====================
    
    isPageElement(element) {
        return element.classList?.contains('editor-page') ||
               element.classList?.contains('page-content') ||
               element.hasAttribute('data-page');
    }

    // ==================== APPLY MARGINS ====================
    
    applyMarginsToElement(element) {
        // Only .page-content needs margin positioning — it is position:absolute
        // inside .editor-page. Margins = top/left/right/bottom in px.
        // .editor-page is just the paper wrapper — never touch its styles.
        if (!element.classList.contains('page-content')) return;

        const { top, bottom, left, right } = this.pageMargins;
        let finalTop  = top;
        let finalLeft = left;

        if (this.gutterPosition === 'top') {
            finalTop  += this.gutter;
        } else {
            finalLeft += this.gutter;
        }

        // 1 cm = 96px / 2.54 ≈ 37.7953 px  (screen 96 DPI)
        const CM = 37.7952755906;
        element.style.top    = (finalTop  * CM) + 'px';
        element.style.bottom = (bottom    * CM) + 'px';
        element.style.left   = (finalLeft * CM) + 'px';
        element.style.right  = (right     * CM) + 'px';
        element.style.padding = '0';
    }

    applyMarginsToAllPages() {
        // Only .page-content — the actual text area whose position = the margin
        document.querySelectorAll('.page-content').forEach(el => this.applyMarginsToElement(el));
        this.updateGlobalMarginStyles();
    }

    updateGlobalMarginStyles() {
        document.getElementById('globalPageMarginStyles')?.remove();

        const { top, bottom, left, right } = this.pageMargins;
        let finalTop  = top;
        let finalLeft = left;

        if (this.gutterPosition === 'top') finalTop  += this.gutter;
        else                               finalLeft += this.gutter;

        // cm → px (96 DPI)
        const CM     = 37.7952755906;
        const topPx  = Math.round(finalTop  * CM);
        const botPx  = Math.round(bottom    * CM);
        const lefPx  = Math.round(finalLeft * CM);
        const rigPx  = Math.round(right     * CM);

        // Inject CSS: .page-content uses top/left/right/bottom (position:absolute)
        // Paper classes (.paper-a4 etc.) also override — we beat them with !important
        const style = document.createElement('style');
        style.id = 'globalPageMarginStyles';
        style.textContent = `
            .page-content {
                top:    ${topPx}px !important;
                bottom: ${botPx}px !important;
                left:   ${lefPx}px !important;
                right:  ${rigPx}px !important;
                padding: 0       !important;
            }
            @page {
                size: A4 portrait;
                margin: ${finalTop}cm ${right}cm ${bottom}cm ${finalLeft}cm;
            }
            @media print {
                .editor-page, .page-content {
                    page-break-after: always;
                    margin: 0 !important; padding: 0 !important;
                    box-shadow: none !important;
                }
            }
        `;
        document.head.appendChild(style);

        // Sync ReflowEngine so page-overflow calc uses correct marginPx
        this._notifyReflow(Math.round((topPx + botPx) / 2));
    }

    _notifyReflow(marginPx) {
        const ctrl = window.wordFlow || window.wordFlowController;
        if (!ctrl) return;
        try {
            if (ctrl._config?.merge) {
                ctrl._config.merge({ paper: { size: ctrl._config.get('paper.size') || 'a4', marginPx } });
            }
            const fn = ctrl.reflowAll || ctrl.performReflow;
            if (typeof fn === 'function') fn.call(ctrl);
        } catch(e) { console.warn('[FormattingDialogs] reflow notify failed:', e); }
    }

        // ── Resolve transform:translate(-50%,-50%) → absolute px immediately after open
    //    so drag never fights a pending CSS transform.
    _resolveDialogPosition(dialog) {
        requestAnimationFrame(() => {
            const r = dialog.getBoundingClientRect();
            dialog.style.animation = 'none';   // stop animation (already played)
            dialog.style.transform = 'none';
            dialog.style.left      = r.left + 'px';
            dialog.style.top       = r.top  + 'px';
            dialog.style.margin    = '0';
        });
    }

    _makeDraggable(dialog, handle) {
        let dragging = false, startX, startY, origL, origT;

        const onMove = e => {
            if (!dragging) return;
            // Clamp inside viewport so dialog never flies off screen
            const W = dialog.offsetWidth, H = dialog.offsetHeight;
            const nx = Math.max(0, Math.min(window.innerWidth  - W, origL + e.clientX - startX));
            const ny = Math.max(0, Math.min(window.innerHeight - H, origT + e.clientY - startY));
            dialog.style.left = nx + 'px';
            dialog.style.top  = ny + 'px';
        };
        const onUp = () => {
            dragging = false;
            handle.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
        };
        handle.style.cursor = 'grab';
        handle.addEventListener('mousedown', e => {
            if (e.target.closest('.fd-close')) return;
            e.preventDefault();
            dragging = true;
            handle.style.cursor = 'grabbing';
            // Always read current pixel position (transform already resolved)
            startX = e.clientX; startY = e.clientY;
            origL  = parseFloat(dialog.style.left) || 0;
            origT  = parseFloat(dialog.style.top)  || 0;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });
    }

    // ==================== PAGE MARGINS DIALOG ====================
    
    openPageMarginsDialog() {
        document.getElementById('fd-margins-dialog')?.remove();

        // ── Backdrop (pointer-events:none so dragging outside works) ──
        const backdrop = document.createElement('div');
        backdrop.id = 'fd-margins-backdrop';
        backdrop.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,.38);
            z-index:10001;pointer-events:none;
            animation:fdFadeIn .15s ease;
        `;

        // ── Dialog ──
        const dialog = document.createElement('div');
        dialog.id = 'fd-margins-dialog';
        dialog.style.cssText = `
            position:fixed;
            top:50%;left:50%;
            transform:translate(-50%,-50%);
            width:460px;max-width:96vw;
            background:#fff;
            border-radius:14px;
            box-shadow:0 8px 40px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.10);
            z-index:10002;
            pointer-events:all;
            font-family:'DM Sans',system-ui,sans-serif;
            overflow:hidden;
            animation:fdSlideUp .2s cubic-bezier(.34,1.56,.64,1);
        `;

        dialog.innerHTML = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
            @keyframes fdFadeIn  { from{opacity:0} to{opacity:1} }
            @keyframes fdSlideUp { from{opacity:0;transform:translate(-50%,-46%) scale(.97)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }

            #fd-margins-dialog * { box-sizing:border-box; }

            .fd-hdr {
                display:flex;align-items:center;gap:8px;
                padding:12px 14px 10px;
                border-bottom:1px solid #f0f0f0;
                background:#fafafa;
                user-select:none;
            }
            .fd-hdr-icon { font-size:15px; }
            .fd-hdr-title {
                flex:1;font-size:13px;font-weight:600;color:#1a1d2e;
                letter-spacing:-.2px;
            }
            .fd-hdr-sub { font-size:10px;color:#aaa;font-weight:400;margin-right:4px; }
            .fd-close {
                width:22px;height:22px;border-radius:6px;
                border:none;background:#ebebeb;color:#555;
                cursor:pointer;font-size:13px;line-height:1;
                display:flex;align-items:center;justify-content:center;
                flex-shrink:0;transition:background .12s;
                padding:0;
            }
            .fd-close:hover { background:#e03131;color:#fff; }

            .fd-body { display:grid;grid-template-columns:1fr 140px;gap:0; }

            .fd-left  { padding:12px 14px 14px;border-right:1px solid #f0f0f0; }
            .fd-right { padding:12px 10px 14px;display:flex;flex-direction:column;align-items:center; }

            /* Presets */
            .fd-section-label {
                font-size:10px;font-weight:600;color:#888;
                text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;
            }
            .fd-presets { display:flex;gap:5px;margin-bottom:12px; }
            .fd-preset {
                flex:1;padding:5px 4px;font-size:10px;font-weight:600;
                border:1.5px solid #e0e0e0;border-radius:7px;
                background:#fff;color:#444;cursor:pointer;
                transition:all .14s;text-align:center;line-height:1.3;
            }
            .fd-preset:hover  { border-color:#4f46e5;color:#4f46e5;background:#f0f0ff; }
            .fd-preset.active { border-color:#4f46e5;background:#4f46e5;color:#fff; }

            /* Grid inputs */
            .fd-grid {
                display:grid;grid-template-columns:1fr 1fr;gap:7px;
                margin-bottom:10px;
            }
            .fd-field { display:flex;flex-direction:column;gap:3px; }
            .fd-field label {
                font-size:10px;font-weight:600;color:#888;
                text-transform:uppercase;letter-spacing:.4px;
            }
            .fd-field-row {
                display:flex;align-items:center;gap:4px;
            }
            .fd-input {
                flex:1;padding:5px 7px;
                border:1.5px solid #e8e8e8;border-radius:7px;
                font-size:12px;color:#1a1d2e;background:#fafafa;
                outline:none;transition:border-color .13s,box-shadow .13s;
                font-family:inherit;
                -moz-appearance:textfield;
            }
            .fd-input::-webkit-outer-spin-button,
            .fd-input::-webkit-inner-spin-button { -webkit-appearance:none; }
            .fd-input:focus { border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1);background:#fff; }
            .fd-unit { font-size:10px;color:#bbb;font-weight:500; }

            .fd-divider { border:none;border-top:1px solid #f0f0f0;margin:8px 0; }

            .fd-gutter-row { display:grid;grid-template-columns:1fr 1fr;gap:7px; }
            .fd-select {
                width:100%;padding:5px 7px;
                border:1.5px solid #e8e8e8;border-radius:7px;
                font-size:12px;color:#1a1d2e;background:#fafafa;
                outline:none;cursor:pointer;font-family:inherit;
            }
            .fd-select:focus { border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1); }

            /* Preview */
            .fd-preview-label { font-size:10px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px; }
            .fd-page {
                position:relative;width:100px;height:130px;
                background:#fff;border:2px solid #333;
                box-shadow:0 3px 10px rgba(0,0,0,.12);
                border-radius:2px;flex-shrink:0;
            }
            .fd-pm { position:absolute;background:rgba(239,68,68,.1); }
            .fd-pc {
                position:absolute;background:rgba(79,70,229,.1);
                border:1.5px dashed rgba(79,70,229,.5);
                border-radius:1px;
            }
            .fd-legend {
                margin-top:8px;font-size:9px;color:#aaa;line-height:1.7;
            }
            .fd-legend span { display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:3px;vertical-align:middle; }

            /* Footer */
            .fd-foot {
                display:flex;justify-content:flex-end;gap:7px;
                padding:10px 14px;border-top:1px solid #f0f0f0;
                background:#fafafa;
            }
            .fd-btn {
                padding:6px 14px;border-radius:8px;border:none;
                font-size:12px;font-weight:600;cursor:pointer;
                transition:all .14s;font-family:inherit;
            }
            .fd-btn-cancel { background:#f0f0f0;color:#555; }
            .fd-btn-cancel:hover { background:#e4e4e4; }
            .fd-btn-apply {
                background:#4f46e5;color:#fff;
                box-shadow:0 2px 8px rgba(79,70,229,.3);
            }
            .fd-btn-apply:hover { background:#4338ca;transform:translateY(-1px);box-shadow:0 4px 12px rgba(79,70,229,.4); }
        </style>

        <div class="fd-hdr" id="fd-margins-hdr">
            <span class="fd-hdr-icon">📐</span>
            <span class="fd-hdr-title">Page Margins</span>
            <span class="fd-hdr-sub">⠿ drag</span>
            <button class="fd-close">✕</button>
        </div>

        <div class="fd-body">
            <div class="fd-left">
                <div class="fd-section-label">Quick Presets</div>
                <div class="fd-presets">
                    <button class="fd-preset" data-preset="normal">Normal<br><span style="font-weight:400;color:inherit;opacity:.7">1.27</span></button>
                    <button class="fd-preset" data-preset="narrow">Narrow<br><span style="font-weight:400;color:inherit;opacity:.7">0.63</span></button>
                    <button class="fd-preset" data-preset="moderate">Moderate<br><span style="font-weight:400;color:inherit;opacity:.7">1.91</span></button>
                    <button class="fd-preset" data-preset="wide">Wide<br><span style="font-weight:400;color:inherit;opacity:.7">2.54</span></button>
                </div>

                <div class="fd-section-label">Custom Margins <span style="font-weight:400;text-transform:none;letter-spacing:0">(cm)</span></div>
                <div class="fd-grid">
                    <div class="fd-field">
                        <label>↑ Top</label>
                        <div class="fd-field-row">
                            <input class="fd-input fd-margin-field" id="fdTop" type="number" value="\${this.pageMargins.top}" step="0.1" min="0" max="10">
                        </div>
                    </div>
                    <div class="fd-field">
                        <label>↓ Bottom</label>
                        <div class="fd-field-row">
                            <input class="fd-input fd-margin-field" id="fdBottom" type="number" value="\${this.pageMargins.bottom}" step="0.1" min="0" max="10">
                        </div>
                    </div>
                    <div class="fd-field">
                        <label>← Left</label>
                        <div class="fd-field-row">
                            <input class="fd-input fd-margin-field" id="fdLeft" type="number" value="\${this.pageMargins.left}" step="0.1" min="0" max="10">
                        </div>
                    </div>
                    <div class="fd-field">
                        <label>→ Right</label>
                        <div class="fd-field-row">
                            <input class="fd-input fd-margin-field" id="fdRight" type="number" value="\${this.pageMargins.right}" step="0.1" min="0" max="10">
                        </div>
                    </div>
                </div>

                <hr class="fd-divider">

                <div class="fd-section-label">Gutter</div>
                <div class="fd-gutter-row">
                    <div class="fd-field">
                        <label>Size (cm)</label>
                        <input class="fd-input fd-margin-field" id="fdGutter" type="number" value="\${this.gutter}" step="0.1" min="0" max="10">
                    </div>
                    <div class="fd-field">
                        <label>Position</label>
                        <select class="fd-select" id="fdGutterPos">
                            <option value="left"  \${this.gutterPosition==='left' ?'selected':''}>Left</option>
                            <option value="top"   \${this.gutterPosition==='top'  ?'selected':''}>Top</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="fd-right">
                <div class="fd-preview-label">Preview</div>
                <div class="fd-page" id="fdPage">
                    <div class="fd-pm" id="fdPT"></div>
                    <div class="fd-pm" id="fdPB"></div>
                    <div class="fd-pm" id="fdPL"></div>
                    <div class="fd-pm" id="fdPR"></div>
                    <div class="fd-pc" id="fdPC"></div>
                </div>
                <div class="fd-legend">
                    <div><span style="background:rgba(239,68,68,.2)"></span>Margins</div>
                    <div><span style="background:rgba(79,70,229,.2)"></span>Content</div>
                </div>
            </div>
        </div>

        <div class="fd-foot">
            <button class="fd-btn fd-btn-cancel" id="fdCancel">Cancel</button>
            <button class="fd-btn fd-btn-apply" id="fdApply">✓ Apply Margins</button>
        </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);
        this._resolveDialogPosition(dialog); // fix transform before drag

        // ── Wire close / cancel / apply ──
        const close = () => { backdrop.remove(); dialog.remove(); };
        dialog.querySelector('.fd-close').addEventListener('click', close);
        dialog.querySelector('#fdCancel').addEventListener('click', close);
        backdrop.addEventListener('click', close); // click outside closes
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
        });

        dialog.querySelector('#fdApply').addEventListener('click', () => {
            this._applyMarginsFromDialog();
            close();
        });

        // ── Presets ──
        const presets = {
            normal:   { top:1.27, bottom:1.27, left:1.27, right:1.27 },
            narrow:   { top:0.63, bottom:0.63, left:0.63, right:0.63 },
            moderate: { top:1.91, bottom:1.91, left:1.91, right:1.91 },
            wide:     { top:2.54, bottom:2.54, left:2.54, right:2.54 }
        };
        dialog.querySelectorAll('.fd-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = presets[btn.dataset.preset];
                if (!p) return;
                dialog.querySelector('#fdTop').value    = p.top;
                dialog.querySelector('#fdBottom').value = p.bottom;
                dialog.querySelector('#fdLeft').value   = p.left;
                dialog.querySelector('#fdRight').value  = p.right;
                dialog.querySelectorAll('.fd-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._updateMarginsPreview(dialog);
            });
        });

        // ── Live preview on input ──
        dialog.querySelectorAll('.fd-margin-field').forEach(inp =>
            inp.addEventListener('input', () => this._updateMarginsPreview(dialog)));
        dialog.querySelector('#fdGutterPos').addEventListener('change', () => this._updateMarginsPreview(dialog));

        // ── Draggable ──
        this._makeDraggable(dialog, dialog.querySelector('#fd-margins-hdr'));

        this._updateMarginsPreview(dialog);
    }

    _updateMarginsPreview(dialog) {
        const W = 100, H = 130, PW = 21, PH = 29.7;
        const sx = W / PW, sy = H / PH;
        const t  = (parseFloat(dialog.querySelector('#fdTop').value)    || 0) * sy;
        const b  = (parseFloat(dialog.querySelector('#fdBottom').value) || 0) * sy;
        const l  = (parseFloat(dialog.querySelector('#fdLeft').value)   || 0) * sx;
        const r  = (parseFloat(dialog.querySelector('#fdRight').value)  || 0) * sx;
        const g  = (parseFloat(dialog.querySelector('#fdGutter').value) || 0);
        const gp = dialog.querySelector('#fdGutterPos').value;
        const gl = gp === 'left' ? g * sx : 0;
        const gt = gp === 'top'  ? g * sy : 0;

        dialog.querySelector('#fdPT').style.cssText = `top:0;left:0;right:0;height:${t+gt}px;`;
        dialog.querySelector('#fdPB').style.cssText = `bottom:0;left:0;right:0;height:${b}px;`;
        dialog.querySelector('#fdPL').style.cssText = `top:0;left:0;width:${l+gl}px;bottom:0;`;
        dialog.querySelector('#fdPR').style.cssText = `top:0;right:0;width:${r}px;bottom:0;`;
        dialog.querySelector('#fdPC').style.cssText = `top:${t+gt}px;bottom:${b}px;left:${l+gl}px;right:${r}px;`;
    }

    _applyMarginsFromDialog() {
        const get = id => parseFloat(document.getElementById(id)?.value) || 0;
        this.pageMargins = {
            top:    get('fdTop'),
            bottom: get('fdBottom'),
            left:   get('fdLeft'),
            right:  get('fdRight'),
        };
        this.gutter         = get('fdGutter');
        this.gutterPosition = document.getElementById('fdGutterPos')?.value || 'left';
        this.saveSettings();
        this.applyMarginsToAllPages();
        console.log('✅ Margins applied:', this.pageMargins);
    }

    // ==================== LINE SPACING DIALOG ====================
    
    openLineSpacingDialog() {
        document.getElementById('fd-spacing-dialog')?.remove();
        document.getElementById('fd-spacing-backdrop')?.remove();

        const backdrop = document.createElement('div');
        backdrop.id = 'fd-spacing-backdrop';
        backdrop.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,.38);
            z-index:10001;pointer-events:none;
            animation:fdFadeIn .15s ease;
        `;

        const dialog = document.createElement('div');
        dialog.id = 'fd-spacing-dialog';
        dialog.style.cssText = `
            position:fixed;
            top:50%;left:50%;
            transform:translate(-50%,-50%);
            width:300px;max-width:96vw;
            background:#fff;
            border-radius:14px;
            box-shadow:0 8px 40px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.10);
            z-index:10002;
            pointer-events:all;
            font-family:'DM Sans',system-ui,sans-serif;
            overflow:hidden;
            animation:fdSlideUp .2s cubic-bezier(.34,1.56,.64,1);
        `;

        dialog.innerHTML = `
        <style>
            #fd-spacing-dialog * { box-sizing:border-box; }
            .fds-hdr {
                display:flex;align-items:center;gap:8px;
                padding:12px 14px 10px;border-bottom:1px solid #f0f0f0;
                background:#fafafa;user-select:none;
            }
            .fds-title { flex:1;font-size:13px;font-weight:600;color:#1a1d2e;letter-spacing:-.2px; }
            .fds-sub   { font-size:10px;color:#aaa;font-weight:400;margin-right:4px; }

            .fds-body  { padding:12px 14px 14px; }
            .fds-label {
                font-size:10px;font-weight:600;color:#888;
                text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px;display:block;
            }

            /* Spacing pill buttons */
            .fds-pills { display:flex;gap:6px;margin-bottom:12px; }
            .fds-pill {
                flex:1;padding:6px 4px;text-align:center;
                font-size:12px;font-weight:600;
                border:1.5px solid #e0e0e0;border-radius:8px;
                background:#fff;color:#444;cursor:pointer;
                transition:all .13s;
            }
            .fds-pill:hover  { border-color:#4f46e5;color:#4f46e5;background:#f0f0ff; }
            .fds-pill.active { border-color:#4f46e5;background:#4f46e5;color:#fff; }

            /* Custom spacing */
            .fds-custom-row {
                display:flex;align-items:center;gap:8px;
                background:#f8f8fb;border-radius:8px;
                padding:7px 10px;margin-bottom:12px;
            }
            .fds-custom-label { font-size:11px;color:#888;flex:1; }
            .fds-num {
                width:64px;padding:5px 8px;
                border:1.5px solid #e8e8e8;border-radius:7px;
                font-size:13px;font-weight:600;color:#1a1d2e;
                background:#fff;outline:none;text-align:center;
                font-family:inherit;transition:border-color .13s;
                -moz-appearance:textfield;
            }
            .fds-num::-webkit-outer-spin-button,
            .fds-num::-webkit-inner-spin-button { -webkit-appearance:none; }
            .fds-num:focus { border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1); }

            .fds-divider { border:none;border-top:1px solid #f0f0f0;margin:4px 0 12px; }

            /* Para spacing */
            .fds-para-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px; }
            .fds-para-field { display:flex;flex-direction:column;gap:3px; }
            .fds-para-field label { font-size:10px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.4px; }
            .fds-para-row { display:flex;align-items:center;gap:4px; }
            .fds-para-input {
                flex:1;padding:5px 7px;
                border:1.5px solid #e8e8e8;border-radius:7px;
                font-size:12px;color:#1a1d2e;background:#fafafa;
                outline:none;font-family:inherit;
                transition:border-color .13s;
                -moz-appearance:textfield;
            }
            .fds-para-input::-webkit-outer-spin-button,
            .fds-para-input::-webkit-inner-spin-button { -webkit-appearance:none; }
            .fds-para-input:focus { border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1);background:#fff; }
            .fds-para-unit { font-size:10px;color:#bbb; }

            .fds-foot {
                display:flex;justify-content:flex-end;gap:7px;
                padding:10px 14px;border-top:1px solid #f0f0f0;background:#fafafa;
            }

            /* ── Shared button styles (fd-close, fd-btn) ── */
            #fd-spacing-dialog .fd-close {
                width:22px;height:22px;border-radius:6px;
                border:none;background:#ebebeb;color:#555;
                cursor:pointer;font-size:13px;line-height:1;
                display:flex;align-items:center;justify-content:center;
                flex-shrink:0;transition:background .12s;
                padding:0;
            }
            #fd-spacing-dialog .fd-close:hover { background:#e03131;color:#fff; }

            #fd-spacing-dialog .fd-btn {
                padding:6px 14px;border-radius:8px;border:none;
                font-size:12px;font-weight:600;cursor:pointer;
                transition:all .14s;font-family:inherit;
            }
            #fd-spacing-dialog .fd-btn-cancel { background:#f0f0f0;color:#555; }
            #fd-spacing-dialog .fd-btn-cancel:hover { background:#e4e4e4; }
            #fd-spacing-dialog .fd-btn-apply {
                background:#4f46e5;color:#fff;
                box-shadow:0 2px 8px rgba(79,70,229,.3);
            }
            #fd-spacing-dialog .fd-btn-apply:hover {
                background:#4338ca;
                transform:translateY(-1px);
                box-shadow:0 4px 12px rgba(79,70,229,.4);
            }
        </style>

        <div class="fds-hdr" id="fds-hdr">
            <span style="font-size:15px">📏</span>
            <span class="fds-title">Line & Paragraph Spacing</span>
            <span class="fds-sub">⠿ drag</span>
            <button class="fd-close">✕</button>
        </div>

        <div class="fds-body">
            <span class="fds-label">Line Spacing</span>
            <div class="fds-pills">
                <button class="fds-pill" data-ls="1">Single<br><span style="opacity:.6;font-size:10px">×1</span></button>
                <button class="fds-pill" data-ls="1.15">Compact<br><span style="opacity:.6;font-size:10px">×1.15</span></button>
                <button class="fds-pill" data-ls="1.5">Normal<br><span style="opacity:.6;font-size:10px">×1.5</span></button>
                <button class="fds-pill" data-ls="2">Double<br><span style="opacity:.6;font-size:10px">×2</span></button>
            </div>

            <div class="fds-custom-row">
                <span class="fds-custom-label">Custom value</span>
                <input class="fds-num" id="fdsCustom" type="number" value="\${this.lineSpacing}" step="0.05" min="0.5" max="10">
            </div>

            <hr class="fds-divider">

            <span class="fds-label">Paragraph Spacing (pt)</span>
            <div class="fds-para-grid">
                <div class="fds-para-field">
                    <label>↑ Before</label>
                    <div class="fds-para-row">
                        <input class="fds-para-input" id="fdsSpBefore" type="number" value="\${this.paragraphSpacing.before}" step="0.5" min="0" max="72">
                        <span class="fds-para-unit">pt</span>
                    </div>
                </div>
                <div class="fds-para-field">
                    <label>↓ After</label>
                    <div class="fds-para-row">
                        <input class="fds-para-input" id="fdsSpAfter" type="number" value="\${this.paragraphSpacing.after}" step="0.5" min="0" max="72">
                        <span class="fds-para-unit">pt</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="fds-foot">
            <button class="fd-btn fd-btn-cancel" id="fdsCancel">Cancel</button>
            <button class="fd-btn fd-btn-apply" id="fdsApply">✓ Apply</button>
        </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);
        this._resolveDialogPosition(dialog); // fix transform before drag

        // ── Mark active pill ──
        const markPill = val => {
            dialog.querySelectorAll('.fds-pill').forEach(p => {
                p.classList.toggle('active', parseFloat(p.dataset.ls) === val);
            });
        };
        markPill(this.lineSpacing);

        dialog.querySelectorAll('.fds-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const v = parseFloat(btn.dataset.ls);
                dialog.querySelector('#fdsCustom').value = v;
                markPill(v);
            });
        });

        dialog.querySelector('#fdsCustom').addEventListener('input', function() {
            markPill(parseFloat(this.value));
        });

        const close = () => { backdrop.remove(); dialog.remove(); };
        dialog.querySelector('.fd-close').addEventListener('click', close);
        dialog.querySelector('#fdsCancel').addEventListener('click', close);
        backdrop.addEventListener('click', close);
        document.addEventListener('keydown', function escH(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escH); }
        });

        dialog.querySelector('#fdsApply').addEventListener('click', () => {
            this._applySpacingFromDialog(dialog);
            close();
        });

        this._makeDraggable(dialog, dialog.querySelector('#fds-hdr'));
    }

    _applySpacingFromDialog(dialog) {
        const spacing       = parseFloat(dialog.querySelector('#fdsCustom').value)   || 1.5;
        const spacingBefore = parseFloat(dialog.querySelector('#fdsSpBefore').value) || 0;
        const spacingAfter  = parseFloat(dialog.querySelector('#fdsSpAfter').value)  || 0;

        this.lineSpacing        = spacing;
        this.paragraphSpacing   = { before: spacingBefore, after: spacingAfter };
        this.saveSettings();
        this._applySpacingCSS(spacing, spacingBefore, spacingAfter);
        console.log('✅ Spacing applied:', spacing, 'before:', spacingBefore, 'after:', spacingAfter);
    }

    // ── Inject global CSS so spacing works on ALL paragraphs —
    //    including ones typed AFTER apply (inline style can't do this).
    //    Uses !important to beat the hardcoded CSS rules:
    //      .page-content { line-height: 24px }
    //      .page-content p { margin: 0; padding: 0; }
    _applySpacingCSS(lineSpacing, spacingBefore, spacingAfter) {
        // Remove previous injection
        document.getElementById('globalSpacingStyles')?.remove();

        const style = document.createElement('style');
        style.id = 'globalSpacingStyles';
        style.textContent = `
            /* Line spacing — unitless multiplier beats hardcoded 24px */
            .page-content,
            .page-content p,
            .page-content div,
            .page-content li,
            .page-content h1,
            .page-content h2,
            .page-content h3,
            .page-content h4,
            .page-content h5,
            .page-content h6 {
                line-height: ${lineSpacing} !important;
            }

            /* Paragraph spacing — beats .page-content p { margin:0 } */
            .page-content p {
                margin-top:    ${spacingBefore}pt !important;
                margin-bottom: ${spacingAfter}pt  !important;
                padding: 0 !important;
            }
        `;
        document.head.appendChild(style);
    }

}

// ==================== GLOBAL INITIALIZATION ====================

let formattingDialogs = null;

document.addEventListener('DOMContentLoaded', function() {
    formattingDialogs = new FormattingDialogs();
    window.formattingDialogs = formattingDialogs;
    window.openPageMarginsDialog = () => formattingDialogs.openPageMarginsDialog();
    window.openLineSpacingDialog = () => formattingDialogs.openLineSpacingDialog();
    console.log('✅ Advanced Formatting Dialogs initialized');
});

window.FormattingDialogs = FormattingDialogs;

console.log('📝 Formatting Dialogs loaded');