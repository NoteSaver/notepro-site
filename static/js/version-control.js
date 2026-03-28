/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                              ║
 * ║   📜  VERSION CONTROL & ANNOTATIONS  —  v4.1  "SMOOTH BRANCH EDITION"      ║
 * ║                                                                              ║
 * ║   Architecture: IIFE-isolated, zero global pollution                        ║
 * ║                                                                              ║
 * ║   CHANGES in v4.1:                                                           ║
 * ║   ✅ Branch Manager smooth open/close animations — FIXED                    ║
 * ║   ✅ VcModal._close() animated teardown helper added                        ║
 * ║   ✅ No jarring flash/flicker on branch create/switch/delete reopen         ║
 * ║   ✅ Modal vcSlideDown exit animation added                                 ║
 * ║   ✅ All v4.0 features retained                                              ║
 * ║                                                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

;(function (global) {
    'use strict';

    const VERSION          = '4.3.0';
    const STORAGE_VERSIONS = 'vc:versions';
    const STORAGE_BRANCHES = 'vc:branches';
    const MAX_VERSIONS     = 20;

    /* ═══════════════════════════════════════════════════
     *  CSS INJECTION
     * ═══════════════════════════════════════════════════ */
    function _injectStyles() {
        if (document.getElementById('vc-styles')) return;
        const s = document.createElement('style');
        s.id = 'vc-styles';
        s.textContent = `
            @keyframes vcFadeIn   { from{opacity:0}           to{opacity:1} }
            @keyframes vcFadeOut  { from{opacity:1}           to{opacity:0} }
            @keyframes vcSlideIn  { from{transform:translateX(100%)} to{transform:translateX(0)} }
            @keyframes vcSlideUp  { from{transform:translateY(14px) scale(.97);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
            @keyframes vcSlideDown{ from{transform:translateY(0) scale(1);opacity:1} to{transform:translateY(10px) scale(.97);opacity:0} }
            @keyframes vcToastIn  { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }

            /* ── Backdrop ── */
            .vc-backdrop {
                position:fixed; inset:0;
                background:rgba(0,0,0,.5);
                z-index:10300;
                display:flex; align-items:center; justify-content:center; padding:16px;
                animation:vcFadeIn .15s ease;
                transition: opacity .18s ease;
            }
            .vc-backdrop.vc-closing {
                animation: vcFadeOut .2s ease forwards;
            }

            /* ── Modal ── */
            .vc-modal {
                background:#fff; border-radius:11px;
                box-shadow:0 20px 50px rgba(0,0,0,.24), 0 4px 14px rgba(0,0,0,.10);
                width:100%; max-width:380px; max-height:88vh; overflow-y:auto;
                animation:vcSlideUp .22s cubic-bezier(.34,1.56,.64,1);
                position:fixed;
                transition: opacity .18s ease, transform .18s ease;
            }
            .vc-modal.vc-closing {
                animation: vcSlideDown .18s ease forwards;
            }
            .vc-modal.vc-wide { max-width:820px; }
            .vc-modal.vc-sm   { max-width:300px; }

            .vc-modal-hdr {
                display:flex; align-items:center; justify-content:space-between;
                padding:10px 14px 8px; border-bottom:1px solid #eef0f5;
                cursor:grab; user-select:none;
            }
            .vc-modal-hdr:active { cursor:grabbing; }
            .vc-modal-hdr h5 { margin:0; font-size:12px; font-weight:700; color:#1a1d2e; }
            .vc-modal-body   { padding:12px 14px 6px; }
            .vc-modal-foot   {
                display:flex; justify-content:flex-end; gap:6px;
                padding:9px 14px 12px; border-top:1px solid #eef0f5; flex-wrap:wrap;
            }
            .vc-x {
                width:22px; height:22px; border-radius:5px;
                border:none; background:#f3f4f8; color:#666;
                cursor:pointer; font-size:12px; line-height:22px;
                text-align:center; transition:background .15s; flex-shrink:0;
            }
            .vc-x:hover { background:#e4e6ee; color:#1a1d2e; }

            /* ── Buttons ── */
            .vc-btn {
                padding:5px 11px; border-radius:6px; border:none;
                font-size:11px; font-weight:700; cursor:pointer;
                transition:all .15s; white-space:nowrap;
            }
            .vc-btn-sm { padding:3px 8px; font-size:10px; }
            .vc-ghost   { background:#f0f2f7; color:#555; }
            .vc-ghost:hover   { background:#e2e5f0; }
            .vc-primary { background:#3b5bdb; color:#fff; box-shadow:0 2px 8px rgba(59,91,219,.26); }
            .vc-primary:hover { background:#2f4bc0; transform:translateY(-1px); }
            .vc-danger  { background:#e03131; color:#fff; }
            .vc-danger:hover  { background:#c92a2a; }
            .vc-success { background:#2f9e44; color:#fff; }
            .vc-success:hover { background:#276e34; }

            /* ── Inputs ── */
            .vc-label {
                display:block; font-size:10px; font-weight:700;
                color:#6b7080; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px;
            }
            .vc-input {
                width:100%; padding:6px 9px;
                border:1.5px solid #dde0ea; border-radius:6px;
                font-size:12px; color:#1a1d2e; background:#fff;
                outline:none; transition:border-color .15s, box-shadow .15s; box-sizing:border-box;
            }
            .vc-input:focus { border-color:#3b5bdb; box-shadow:0 0 0 2px rgba(59,91,219,.12); }
            .vc-sep { border:none; border-top:1px solid #eef0f5; margin:9px 0; }
            .vc-msg { font-size:12px; color:#333; line-height:1.6; }

            /* ── Toast ── */
            .vc-toast {
                position:fixed; top:20px; right:20px; z-index:11000;
                min-width:240px; padding:11px 16px; border-radius:10px;
                font-size:13px; font-weight:600; color:#fff;
                box-shadow:0 8px 24px rgba(0,0,0,.18);
                animation:vcToastIn .2s ease; pointer-events:none;
                display:flex; align-items:center; gap:8px;
            }
            .vc-t-info    { background:#1971c2; }
            .vc-t-success { background:#2f9e44; }
            .vc-t-warning { background:#e67700; }
            .vc-t-danger  { background:#c92a2a; }
            .vc-t-autosave{ background:#5c7cfa; }

            /* ── Side Panel ── */
            .vc-panel {
                position:fixed; right:0; top:60px;
                width:260px; height:calc(100vh - 60px);
                background:#f8f9fc; border-left:1px solid #e2e5f0;
                box-shadow:-4px 0 20px rgba(0,0,0,.08);
                z-index:9999; display:flex; flex-direction:column;
                animation:vcSlideIn .25s cubic-bezier(.34,1.56,.64,1);
                overflow:hidden;
            }
            .vc-panel.vc-dragging { box-shadow:0 8px 32px rgba(0,0,0,.22); }
            .vc-panel-hdr {
                padding:9px 11px 7px; background:#fff;
                border-bottom:1px solid #e2e5f0; flex-shrink:0; position:relative;
                cursor:grab; user-select:none;
            }
            .vc-panel-hdr:active { cursor:grabbing; }
            .vc-panel-hdr h5 { margin:0 0 1px; font-size:12px; font-weight:700; color:#1a1d2e; }
            .vc-panel-hdr small { font-size:10px; color:#888; }
            .vc-panel-close {
                position:absolute; top:8px; right:8px;
                width:22px; height:22px; border-radius:5px;
                border:none; background:#f3f4f8; color:#666;
                cursor:pointer; font-size:12px; line-height:22px;
                text-align:center; transition:background .15s;
            }
            .vc-panel-close:hover { background:#e4e6ee; }
            .vc-panel-actions {
                padding:7px 9px; background:#fff;
                border-bottom:1px solid #e2e5f0; flex-shrink:0;
                display:flex; flex-direction:column; gap:5px;
            }
            .vc-panel-scroll { flex:1; overflow-y:auto; padding:9px; }

            /* ── Timeline ── */
            .vc-timeline { position:relative; padding-left:16px; }
            .vc-timeline::before {
                content:''; position:absolute; left:6px; top:0; bottom:0;
                width:2px; background:linear-gradient(to bottom,#3b5bdb22,#3b5bdb55,#3b5bdb22);
                border-radius:2px;
            }
            .vc-card {
                position:relative; margin-bottom:7px; background:#fff;
                border-radius:8px; border:1.5px solid #e8eaf0;
                padding:8px 10px; cursor:pointer; transition:all .18s;
                box-shadow:0 1px 4px rgba(0,0,0,.04);
            }
            .vc-card::before {
                content:''; position:absolute; left:-13px; top:11px;
                width:8px; height:8px; border-radius:50%;
                background:#3b5bdb; border:2px solid #fff;
                box-shadow:0 0 0 2px rgba(59,91,219,.35);
            }
            .vc-card:hover { border-color:#3b5bdb; transform:translateX(2px); box-shadow:0 2px 10px rgba(59,91,219,.12); }
            .vc-card.vc-cur { border-color:#3b5bdb; background:#eef3ff; }
            .vc-card.vc-cur::before { box-shadow:0 0 0 3px rgba(59,91,219,.35); }
            .vc-card-title { font-size:11px; font-weight:700; color:#1a1d2e; margin-bottom:2px; padding-right:18px; }
            .vc-card-meta  { font-size:9px; color:#888; line-height:1.5; }
            .vc-badge {
                display:inline-block; font-size:8px; font-weight:700;
                padding:1px 5px; border-radius:3px; margin-top:3px;
                background:#eef3ff; color:#3b5bdb; border:1px solid #c5d0fa;
            }
            .vc-badge.auto   { background:#fff4e6; color:#e67700; border-color:#ffd8a8; }
            .vc-badge.merge  { background:#f3faf3; color:#2f9e44; border-color:#b2f2bb; }
            .vc-del {
                position:absolute; top:6px; right:6px;
                width:17px; height:17px; border-radius:50%;
                border:none; background:#fee2e2; color:#e03131;
                cursor:pointer; font-size:9px; line-height:17px;
                text-align:center; transition:all .15s; opacity:0;
            }
            .vc-card:hover .vc-del { opacity:1; }
            .vc-del:hover { background:#e03131; color:#fff; }
            .vc-card-btns { display:flex; gap:4px; margin-top:6px; }

            /* ── Diff ── */
            .vc-diff-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
            .vc-diff-panel { border:1.5px solid #e8eaf0; border-radius:10px; overflow:hidden; }
            .vc-diff-phdr  { padding:7px 11px; background:#f8f9fc; border-bottom:1px solid #e8eaf0; font-size:12px; font-weight:700; color:#444; }
            .vc-diff-body  {
                padding:11px; font-size:12px; line-height:1.75;
                max-height:240px; overflow-y:auto;
                font-family:ui-monospace,monospace; color:#333;
                white-space:pre-wrap; word-break:break-word;
            }
            .vc-add  { background:#d3f9d8; color:#1a7f37; border-radius:2px; padding:0 2px; }
            .vc-del2 { background:#ffe3e3; color:#c92a2a; border-radius:2px; padding:0 2px; text-decoration:line-through; }
            .vc-stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
            .vc-stat {
                background:#f8f9fc; border:1px solid #e8eaf0; border-radius:8px;
                padding:10px 14px; text-align:center;
            }
            .vc-stat-val { font-size:22px; font-weight:800; color:#1a1d2e; }
            .vc-stat-lbl { font-size:10px; color:#888; font-weight:600; text-transform:uppercase; }
            .pos { color:#2f9e44 !important; }
            .neg { color:#e03131 !important; }

            /* ── Branch card ── */
            .vc-branch-card {
                border:1.5px solid #e8eaf0; border-radius:10px;
                padding:10px 12px; margin-bottom:8px;
                background:#fff; transition:border-color .15s;
            }
            .vc-branch-card:hover { border-color:#3b5bdb; }
            .vc-branch-name { font-size:13px; font-weight:700; color:#1a1d2e; margin-bottom:2px; }
            .vc-branch-meta { font-size:10px; color:#888; }
            .vc-branch-btns { display:flex; gap:6px; margin-top:8px; }
            .vc-input-row   { display:flex; gap:8px; margin-top:6px; }
            .vc-input-row .vc-input { margin:0; }

            /* ── Comments ── */
            .vc-cpopup {
                position:absolute; z-index:10000;
                background:#fff; border-radius:12px;
                border:1.5px solid #e8eaf0;
                box-shadow:0 8px 32px rgba(0,0,0,.16);
                padding:14px; min-width:230px; max-width:290px;
                font-size:13px; animation:vcSlideUp .2s ease;
            }
            .vc-cbody {
                background:#f8f9fc; border-radius:8px; padding:8px 10px;
                margin:7px 0; font-size:13px; color:#333; line-height:1.5;
                border-left:3px solid #3b5bdb;
            }
            .vc-cmeta { font-size:11px; color:#999; margin-bottom:10px; }

            /* ── Doc spans ── */
            .vc-comment-span  { background:#fff3bf; cursor:pointer; border-radius:2px; padding:0 1px; }
            .vc-comment-span.resolved { background:#c3fae8; }
            .vc-hi  { background:#ffec99; border-radius:2px; }
            .vc-ul  { text-decoration:underline; text-decoration-color:#e03131; text-decoration-thickness:2px; }
            .vc-str { text-decoration:line-through; }
            .vc-box { border:2px solid #3b5bdb; padding:1px 4px; border-radius:3px; }
        `;
        document.head.appendChild(s);
    }

    /* ═══════════════════════════════════════════════════
     *  TOAST
     * ═══════════════════════════════════════════════════ */
    function _toast(msg, type = 'info', ms = 3000) {
        _injectStyles();
        const icons = { info:'ℹ️', success:'✅', warning:'⚠️', danger:'❌', autosave:'💾' };
        const el = Object.assign(document.createElement('div'), {
            className: `vc-toast vc-t-${type}`,
            innerHTML: `<span>${icons[type] || ''}</span><span>${msg}</span>`,
        });
        document.body.appendChild(el);
        setTimeout(() => {
            Object.assign(el.style, { transition:'opacity .3s, transform .3s', opacity:'0', transform:'translateX(20px)' });
            setTimeout(() => el.remove(), 320);
        }, ms);
    }

    /* ═══════════════════════════════════════════════════
     *  MODAL ENGINE  (async alert / confirm / prompt)
     * ═══════════════════════════════════════════════════ */
    class VcModal {
        static alert(msg, icon = '⚠️') {
            return new Promise(res => {
                const { bd, dlg } = VcModal._open('sm');
                dlg.innerHTML = `
                    <div class="vc-modal-hdr"><h5>${icon} Notice</h5></div>
                    <div class="vc-modal-body"><p class="vc-msg">${msg}</p></div>
                    <div class="vc-modal-foot"><button class="vc-btn vc-primary" id="vcAOk">OK</button></div>`;
                const done = () => { VcModal._close(bd, dlg).then(res); };
                dlg.querySelector('#vcAOk').addEventListener('click', done);
                bd.addEventListener('click', e => { if (e.target === bd) done(); });
                const escAlert = e => { if (e.key === 'Escape') { document.removeEventListener('keydown', escAlert); done(); } };
                document.addEventListener('keydown', escAlert);
            });
        }

        static confirm(msg, icon = '⚠️', danger = false) {
            return new Promise(res => {
                const { bd, dlg } = VcModal._open('sm');
                dlg.innerHTML = `
                    <div class="vc-modal-hdr"><h5>${icon} Confirm</h5></div>
                    <div class="vc-modal-body"><p class="vc-msg">${msg}</p></div>
                    <div class="vc-modal-foot">
                        <button class="vc-btn vc-ghost"  id="vcCNo">Cancel</button>
                        <button class="vc-btn ${danger ? 'vc-danger' : 'vc-primary'}" id="vcCYes">Confirm</button>
                    </div>`;
                const closeConfirm = (val) => { document.removeEventListener('keydown', escConfirm); VcModal._close(bd, dlg).then(() => res(val)); };
                const escConfirm = e => { if (e.key === 'Escape') closeConfirm(false); };
                document.addEventListener('keydown', escConfirm);
                dlg.querySelector('#vcCYes').addEventListener('click', () => closeConfirm(true));
                dlg.querySelector('#vcCNo').addEventListener('click',  () => closeConfirm(false));
                bd.addEventListener('click', e => { if (e.target === bd) closeConfirm(false); });
            });
        }

        static prompt(title, placeholder = '', icon = '✏️') {
            return new Promise(res => {
                const { bd, dlg } = VcModal._open('sm');
                dlg.innerHTML = `
                    <div class="vc-modal-hdr"><h5>${icon} ${title}</h5></div>
                    <div class="vc-modal-body">
                        <input class="vc-input" id="vcPI" placeholder="${placeholder}" autocomplete="off" style="margin-top:4px;">
                    </div>
                    <div class="vc-modal-foot">
                        <button class="vc-btn vc-ghost"   id="vcPC">Cancel</button>
                        <button class="vc-btn vc-primary" id="vcPO">OK</button>
                    </div>`;
                const inp = dlg.querySelector('#vcPI');
                requestAnimationFrame(() => inp?.focus());
                const submit = () => {
                    const v = inp.value.trim();
                    if (!v) { inp.style.borderColor = '#e03131'; return; }
                    VcModal._close(bd, dlg).then(() => res(v));
                };
                dlg.querySelector('#vcPO').addEventListener('click', submit);
                inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
                const cancelPrompt = () => { document.removeEventListener('keydown', escPrompt); VcModal._close(bd, dlg).then(() => res(null)); };
                const escPrompt = e => { if (e.key === 'Escape') cancelPrompt(); };
                document.addEventListener('keydown', escPrompt);
                dlg.querySelector('#vcPC').addEventListener('click', cancelPrompt);
                bd.addEventListener('click', e => { if (e.target === bd) cancelPrompt(); });
            });
        }

        /**
         * Animated close — add exit classes, wait for animation, then remove.
         * Returns a Promise that resolves after the element is removed from DOM.
         */
        static _close(bd, dlg) {
            return new Promise(resolve => {
                if (!bd || !bd.isConnected) { resolve(); return; }
                dlg.classList.add('vc-closing');
                bd.classList.add('vc-closing');
                // Match the animation duration (200ms)
                setTimeout(() => {
                    bd.remove();
                    resolve();
                }, 200);
            });
        }

        static _open(size = '') {
            _injectStyles();
            const bd = document.createElement('div');
            bd.className = 'vc-backdrop';
            bd.style.pointerEvents = 'none';
            const dlg = document.createElement('div');
            dlg.className = `vc-modal${size ? ' vc-' + size : ''}`;
            dlg.style.pointerEvents = 'all';
            // Center initially
            dlg.style.left = '50%';
            dlg.style.top  = '50%';
            dlg.style.transform = 'translate(-50%,-50%)';
            bd.appendChild(dlg);
            document.body.appendChild(bd);

            // Make draggable via header (attached after innerHTML is set)
            requestAnimationFrame(() => {
                const hdr = dlg.querySelector('.vc-modal-hdr');
                if (!hdr) return;
                let dragging = false, startX, startY, origL, origT;

                const initPos = () => {
                    if (!dlg.style.left.endsWith('px')) {
                        const r = dlg.getBoundingClientRect();
                        dlg.style.left      = r.left + 'px';
                        dlg.style.top       = r.top  + 'px';
                        dlg.style.transform = 'none';
                    }
                };
                const onMove = e => {
                    if (!dragging) return;
                    dlg.style.left = (origL + e.clientX - startX) + 'px';
                    dlg.style.top  = (origT  + e.clientY - startY) + 'px';
                };
                const onUp = () => {
                    dragging = false;
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup',   onUp);
                };
                hdr.addEventListener('mousedown', e => {
                    if (e.target.classList.contains('vc-x')) return;
                    e.preventDefault();
                    initPos();
                    dragging = true;
                    startX   = e.clientX; startY = e.clientY;
                    origL    = parseFloat(dlg.style.left) || 0;
                    origT    = parseFloat(dlg.style.top)  || 0;
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup',   onUp);
                });
            });

            return { bd, dlg };
        }
    }

    /* ═══════════════════════════════════════════════════
     *  STORAGE  (window.storage API)
     * ═══════════════════════════════════════════════════ */
    async function _sGet(key)         { try { const r = await window.storage?.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; } }
    async function _sSet(key, val)    { try { await window.storage?.set(key, JSON.stringify(val)); }    catch (e) { console.warn('[VC] storage.set:', e); } }

    /* ═══════════════════════════════════════════════════
     *  HELPERS
     * ═══════════════════════════════════════════════════ */
    function _strip(html) {
        const d = document.createElement('div');
        d.innerHTML = html;
        return (d.textContent || d.innerText || '').trim();
    }

    function _getContent() {
        return Array.from(document.querySelectorAll('.page-content'))
            .map(p => p.innerHTML).join('|||PAGE_BREAK|||');
    }

    function _reflow() {
        const f = global.wordFlow || global.wordFlowController;
        if (!f) return;
        (f.reflowAll || f.performReflow)?.call(f);
    }

    function _restoreDOM(content) {
        const pc = document.getElementById('pagesContainer');
        if (!pc) return;
        pc.innerHTML = '';
        content.split('|||PAGE_BREAK|||').forEach((html, i) => {
            const num = i + 1;
            const pg  = document.createElement('div');
            pg.className  = 'editor-page'; pg.dataset.page = num;
            const ce  = document.createElement('div');
            ce.className  = 'page-content'; ce.contentEditable = 'true';
            ce.dataset.page = num; ce.innerHTML = html?.trim() ? html : '<p><br></p>';
            const ind = document.createElement('div');
            ind.className = 'page-indicator'; ind.textContent = `Page ${num}`;
            const nb  = document.createElement('div');
            nb.className  = 'page-number'; nb.textContent = num;
            pg.append(ind, ce, nb);
            pc.appendChild(pg);
        });
        setTimeout(_reflow, 50);
        requestAnimationFrame(() => {
            const first = pc.querySelector('.page-content');
            if (!first) return;
            first.focus();
            const r = document.createRange(); r.selectNodeContents(first); r.collapse(true);
            const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        });
    }

    /* ═══════════════════════════════════════════════════
     *  WORD-LEVEL DIFF  (LCS)
     * ═══════════════════════════════════════════════════ */
    function _wordDiff(a, b) {
        const aw = a.split(/\s+/).filter(Boolean);
        const bw = b.split(/\s+/).filter(Boolean);
        const m  = aw.length, n = bw.length;
        const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
        for (let i = 1; i <= m; i++)
            for (let j = 1; j <= n; j++)
                dp[i][j] = aw[i-1] === bw[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
        const ops = [];
        let i = m, j = n;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && aw[i-1] === bw[j-1]) { ops.unshift({ t:'=', w:aw[i-1] }); i--; j--; }
            else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { ops.unshift({ t:'+', w:bw[j-1] }); j--; }
            else { ops.unshift({ t:'-', w:aw[i-1] }); i--; }
        }
        return ops.map(o => o.t === '=' ? o.w : o.t === '+' ? `<mark class="vc-add">${o.w}</mark>` : `<mark class="vc-del2">${o.w}</mark>`).join(' ');
    }

    /* ═══════════════════════════════════════════════════
     *  MAIN CLASS
     * ═══════════════════════════════════════════════════ */
    class VersionControlSystem {

        constructor() {
            this.versions    = [];
            this.currentIdx  = -1;
            this.branches    = new Map();
            this.comments    = new Map();
            this.annotations = new Map();
            this._autoMs     = 60_000;

            _injectStyles();
            this._init();
            this._bindKeys();
            console.log(`[VersionControl] v${VERSION} ready`);
        }

        /* ─── INIT ─── */
        async _init() {
            const sv = await _sGet(STORAGE_VERSIONS);
            if (sv?.length) { this.versions = sv; this.currentIdx = sv.length - 1; }
            else              await this._save('Initial version', false);

            const sb = await _sGet(STORAGE_BRANCHES);
            if (sb) this.branches = new Map(sb);

            setInterval(async () => {
                const cur  = _getContent();
                const last = this.versions.at(-1);
                const norm = s => s.replace(/\s+/g, ' ').trim();
                if (!last || norm(last.content) !== norm(cur)) {
                    _toast('Auto-saving…', 'autosave', 1800);
                    await this._save('Auto-save', false);
                }
            }, this._autoMs);
        }

        _bindKeys() {
            document.addEventListener('keydown', e => {
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
                    e.preventDefault(); this.openVersionHistory();
                }
            });
        }

        /* ─── VERSION CORE ─── */
        async _save(message = 'Auto-save', notify = true) {
            const content = _getContent();
            const v = {
                id:             'v_' + Date.now(),
                timestamp:      new Date().toISOString(),
                message, content,
                author:         'Anonymous',
                wordCount:      _strip(content).split(/\s+/).filter(Boolean).length,
                characterCount: _strip(content).length,
                isAutoSave:     message === 'Auto-save',
            };
            this.versions.push(v);
            if (this.versions.length > MAX_VERSIONS) this.versions = this.versions.slice(-MAX_VERSIONS);
            this.currentIdx = this.versions.length - 1;
            await _sSet(STORAGE_VERSIONS, this.versions);
            if (notify) _toast(`Checkpoint: "${message}"`, 'success');
            return v;
        }

        async _restore(idx) {
            if (idx < 0 || idx >= this.versions.length) { await VcModal.alert('Invalid version.', '⚠️'); return; }
            const v  = this.versions[idx];
            const ok = await VcModal.confirm(
                `Restore "<strong>${v.message}</strong>"?<br><small style="color:#888">${new Date(v.timestamp).toLocaleString()}</small>`,
                '🔄'
            );
            if (!ok) return;
            _restoreDOM(v.content);
            this.currentIdx = idx;
            _toast(`Restored: "${v.message}"`, 'success');
            this._refreshPanel();
        }

        async _deleteVer(idx) {
            const ver = this.versions[idx];
            if (!ver) return;
            const ok = await VcModal.confirm(`Delete "<strong>${ver.message}</strong>"?`, '🗑️', true);
            if (!ok) return;
            this.versions.splice(idx, 1);
            if (this.versions.length === 0) {
                // Last version deleted — create fresh slate
                await this._save('Initial version', false);
            } else {
                if (this.currentIdx >= idx) this.currentIdx = Math.max(0, this.currentIdx - 1);
                this.currentIdx = Math.min(this.currentIdx, this.versions.length - 1);
                await _sSet(STORAGE_VERSIONS, this.versions);
            }
            _toast('Version deleted', 'warning');
            this._refreshPanel();
        }

        async _clearHistory() {
            const ok = await VcModal.confirm('Clear <strong>all</strong> version history?<br><small style="color:#888">Cannot be undone.</small>', '🗑️', true);
            if (!ok) return;
            const cur = this.versions[this.currentIdx];
            this.versions = cur ? [cur] : [];
            this.currentIdx = 0;
            if (!cur) await this._save('Initial version', false);
            await _sSet(STORAGE_VERSIONS, this.versions);
            _toast('History cleared', 'warning');
            this._refreshPanel();
        }

        /* ─── PANEL ─── */
        openVersionHistory() {
            document.getElementById('vcPanel')?.remove();
            _injectStyles();
            const panel = document.createElement('div');
            panel.id = 'vcPanel'; panel.className = 'vc-panel';
            document.body.appendChild(panel);
            this._renderPanel(panel);

            requestAnimationFrame(() => {
                const hdr = panel.querySelector('.vc-panel-hdr');
                if (!hdr) return;
                let dragging = false, startX, startY, origL, origT;

                const initAbsolute = () => {
                    if (panel.style.position !== 'fixed' || !panel.style.left.endsWith('px')) {
                        const r = panel.getBoundingClientRect();
                        panel.style.right   = 'auto';
                        panel.style.left    = r.left + 'px';
                        panel.style.top     = r.top  + 'px';
                        panel.style.height  = r.height + 'px';
                        panel.style.animation = 'none';
                    }
                };
                const onMove = e => {
                    if (!dragging) return;
                    panel.style.left = (origL + e.clientX - startX) + 'px';
                    panel.style.top  = (origT  + e.clientY - startY) + 'px';
                };
                const onUp = () => {
                    dragging = false;
                    panel.classList.remove('vc-dragging');
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup',   onUp);
                };
                hdr.addEventListener('mousedown', e => {
                    if (e.target.classList.contains('vc-panel-close')) return;
                    e.preventDefault();
                    initAbsolute();
                    dragging = true;
                    panel.classList.add('vc-dragging');
                    startX = e.clientX; startY = e.clientY;
                    origL  = parseFloat(panel.style.left) || 0;
                    origT  = parseFloat(panel.style.top)  || 0;
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup',   onUp);
                });
            });
        }

        _refreshPanel() {
            const p = document.getElementById('vcPanel');
            if (p) this._renderPanel(p);
        }

        _renderPanel(panel) {
            const count = this.versions.length;
            panel.innerHTML = `
                <div class="vc-panel-hdr">
                    <h5>📜 History <span style="font-size:9px;color:#bbb;font-weight:400;">⠿ drag</span></h5>
                    <small>${count} version${count !== 1 ? 's' : ''} · Ctrl+Shift+H</small>
                    <button class="vc-panel-close" id="vcPClose">✕</button>
                </div>
                <div class="vc-panel-actions">
                    <button class="vc-btn vc-primary" id="vcSave" style="display:flex;align-items:center;justify-content:center;gap:5px;">
                        💾 Checkpoint
                    </button>
                    <div style="display:flex;gap:5px;">
                        <button class="vc-btn vc-ghost vc-btn-sm" id="vcBranch" style="flex:1;">🌿 Branches</button>
                        <button class="vc-btn vc-danger vc-btn-sm" id="vcClear" style="flex:1;">🗑️ Clear</button>
                    </div>
                </div>
                <div class="vc-panel-scroll">
                    <div class="vc-timeline">
                        ${this.versions.slice().reverse().map((v, ri) => {
                            const idx = this.versions.length - 1 - ri;
                            const cur = idx === this.currentIdx;
                            const badge = v.isMerge ? 'merge' : v.isAutoSave ? 'auto' : '';
                            const blabel = v.isMerge ? 'Merged' : v.isAutoSave ? 'Auto-save' : 'Checkpoint';
                            return `
                            <div class="vc-card${cur ? ' vc-cur' : ''}" data-idx="${idx}">
                                <button class="vc-del" data-del="${idx}" title="Delete">✕</button>
                                <div class="vc-card-title">${cur ? '👉 ' : ''}${v.message}</div>
                                <div class="vc-card-meta">
                                    ${new Date(v.timestamp).toLocaleString()}<br>
                                    ${v.wordCount} words · ${v.characterCount} chars
                                </div>
                                <span class="vc-badge${badge ? ' ' + badge : ''}">${blabel}</span>
                                ${!cur ? `<div class="vc-card-btns">
                                    <button class="vc-btn vc-ghost vc-btn-sm" data-restore="${idx}">↩ Restore</button>
                                    <button class="vc-btn vc-ghost vc-btn-sm" data-diff="${idx}">🔀 Diff</button>
                                </div>` : ''}
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;

            panel.querySelector('#vcPClose').addEventListener('click', () => panel.remove());
            // ESC closes the history panel
            const escPanel = e => { if (e.key === 'Escape' && document.getElementById('vcPanel')) { document.removeEventListener('keydown', escPanel); panel.remove(); } };
            document.addEventListener('keydown', escPanel);
            panel.querySelector('#vcSave').addEventListener('click',   () => this._promptSave());
            panel.querySelector('#vcClear').addEventListener('click',  () => this._clearHistory());
            panel.querySelector('#vcBranch').addEventListener('click', () => this.openBranchManager());

            panel.querySelectorAll('[data-restore]').forEach(b =>
                b.addEventListener('click', e => { e.stopPropagation(); this._restore(+b.dataset.restore); }));

            panel.querySelectorAll('[data-del]').forEach(b =>
                b.addEventListener('click', e => { e.stopPropagation(); this._deleteVer(+b.dataset.del); }));

            panel.querySelectorAll('[data-diff]').forEach(b =>
                b.addEventListener('click', e => { e.stopPropagation(); this.compareVersions(+b.dataset.diff, this.currentIdx); }));
        }

        async _promptSave() {
            const msg = await VcModal.prompt('Name this checkpoint', 'e.g. Before edits, Draft v2…', '💾');
            if (!msg) return;
            await this._save(msg, true);
            this._refreshPanel();
        }

        /* ─── DIFF MODAL ─── */
        compareVersions(idx1, idx2) {
            const v1 = this.versions[idx1], v2 = this.versions[idx2];
            if (!v1 || !v2) { VcModal.alert('Version not found.', '⚠️'); return; }
            document.getElementById('vcDiffMd')?.remove();

            const t1    = _strip(v1.content), t2 = _strip(v2.content);
            const diff  = _wordDiff(t1, t2);
            const w1    = t1.split(/\s+/).filter(Boolean).length;
            const w2    = t2.split(/\s+/).filter(Boolean).length;
            const wD    = w2 - w1, cD = t2.length - t1.length;

            const { bd, dlg } = VcModal._open('wide');
            dlg.id = 'vcDiffMd';
            dlg.innerHTML = `
                <div class="vc-modal-hdr">
                    <h5>🔀 Diff — <span style="color:#888;font-size:12px;font-weight:400;">"${v1.message}" → "${v2.message}"</span></h5>
                    <button class="vc-x" id="vcDC">✕</button>
                </div>
                <div class="vc-modal-body">
                    <div class="vc-diff-grid">
                        <div class="vc-diff-panel">
                            <div class="vc-diff-phdr">📄 ${v1.message} <small style="font-weight:400;color:#999">· ${new Date(v1.timestamp).toLocaleString()}</small></div>
                            <div class="vc-diff-body">${t1.substring(0, 1200) || '(empty)'}</div>
                        </div>
                        <div class="vc-diff-panel">
                            <div class="vc-diff-phdr">📄 ${v2.message} <small style="font-weight:400;color:#999">· ${new Date(v2.timestamp).toLocaleString()}</small></div>
                            <div class="vc-diff-body">${t2.substring(0, 1200) || '(empty)'}</div>
                        </div>
                    </div>
                    <hr class="vc-sep">
                    <div style="font-size:13px;font-weight:700;color:#444;margin-bottom:10px;">📊 Statistics</div>
                    <div class="vc-stats-grid">
                        <div class="vc-stat">
                            <div class="vc-stat-val ${wD > 0 ? 'pos' : wD < 0 ? 'neg' : ''}">${wD > 0 ? '+' : ''}${wD}</div>
                            <div class="vc-stat-lbl">Words changed</div>
                        </div>
                        <div class="vc-stat">
                            <div class="vc-stat-val ${cD > 0 ? 'pos' : cD < 0 ? 'neg' : ''}">${cD > 0 ? '+' : ''}${cD}</div>
                            <div class="vc-stat-lbl">Characters changed</div>
                        </div>
                    </div>
                    <hr class="vc-sep">
                    <div style="font-size:13px;font-weight:700;color:#444;margin-bottom:8px;">🔍 Word-level diff</div>
                    <div class="vc-diff-body" style="max-height:150px;border:1.5px solid #e8eaf0;border-radius:10px;background:#fafbff;">
                        ${diff || '(no differences)'}
                    </div>
                </div>
                <div class="vc-modal-foot">
                    <button class="vc-btn vc-ghost"   id="vcDC2">Close</button>
                    <button class="vc-btn vc-success"  id="vcDMerge">🔗 Merge into current</button>
                </div>`;

            const close = () => { document.removeEventListener('keydown', escDiff); VcModal._close(bd, dlg); };
            const escDiff = e => { if (e.key === 'Escape') close(); };
            document.addEventListener('keydown', escDiff);
            dlg.querySelector('#vcDC').addEventListener('click', close);
            dlg.querySelector('#vcDC2').addEventListener('click', close);
            bd.addEventListener('click', e => { if (e.target === bd) close(); });
            dlg.querySelector('#vcDMerge').addEventListener('click', async () => {
                const ok = await VcModal.confirm(`Merge "<strong>${v1.message}</strong>" into current?`, '🔗');
                if (!ok) return;
                close();
                this._mergeVersions(idx1, idx2);
            });
        }

        async _mergeVersions(idx1, idx2) {
            const v1 = this.versions[idx1], v2 = this.versions[idx2];
            if (!v1 || !v2) return;
            const mv = {
                id: 'merge_' + Date.now(), timestamp: new Date().toISOString(),
                message: `Merge: ${v1.message} + ${v2.message}`,
                content: v2.content, author: 'Anonymous',
                wordCount: v2.wordCount, characterCount: v2.characterCount, isMerge: true,
            };
            this.versions.push(mv);
            this.currentIdx = this.versions.length - 1;
            _restoreDOM(mv.content);
            await _sSet(STORAGE_VERSIONS, this.versions);
            _toast('Merged ✅', 'success');
            this._refreshPanel();
        }

        /* ─── BRANCH MANAGER ─── */
        openBranchManager() {
            // ✅ FIX: Remove any existing branch modal smoothly before reopening
            const existing = document.getElementById('vcBranchBd');
            if (existing) {
                const existingDlg = existing.querySelector('.vc-modal');
                VcModal._close(existing, existingDlg).then(() => this._openBranchModal());
                return;
            }
            this._openBranchModal();
        }

        _openBranchModal() {
            const { bd, dlg } = VcModal._open();
            // ✅ FIX: Tag the backdrop with a stable ID so we can find & close it smoothly
            bd.id = 'vcBranchBd';
            dlg.id = 'vcBranchMd';

            const renderContent = () => {
                const cards = Array.from(this.branches.entries()).map(([name, b]) => `
                    <div class="vc-branch-card" data-branch="${name}">
                        <div class="vc-branch-name">🌿 ${name}</div>
                        <div class="vc-branch-meta">Created: ${new Date(b.created).toLocaleString()}</div>
                        <div class="vc-branch-btns">
                            <button class="vc-btn vc-primary vc-btn-sm" data-sw="${name}">⇄ Switch</button>
                            <button class="vc-btn vc-danger  vc-btn-sm" data-rm="${name}">🗑️ Delete</button>
                        </div>
                    </div>`).join('') || '<div style="color:#aaa;font-size:13px;text-align:center;padding:20px 0;">No branches yet.</div>';

                dlg.innerHTML = `
                    <div class="vc-modal-hdr">
                        <h5>🌿 Branch Manager <span style="font-size:9px;color:#bbb;font-weight:400;">⠿ drag</span></h5>
                        <button class="vc-x" id="vcBMClose">✕</button>
                    </div>
                    <div class="vc-modal-body">
                        <label class="vc-label">New Branch</label>
                        <div class="vc-input-row">
                            <input class="vc-input" id="vcBNI" placeholder="e.g. draft-v2, review-copy…">
                            <button class="vc-btn vc-primary" id="vcBCreate" style="white-space:nowrap;">+ Create</button>
                        </div>
                        <hr class="vc-sep" style="margin:13px 0;">
                        <div style="font-size:12px;font-weight:700;color:#444;margin-bottom:8px;">All Branches</div>
                        <div id="vcBranchList" style="max-height:320px;overflow-y:auto;">${cards}</div>
                    </div>
                    <div class="vc-modal-foot">
                        <button class="vc-btn vc-ghost" id="vcBMClose2">Close</button>
                    </div>`;

                // ✅ FIX: close() now uses animated teardown — no abrupt disappear
                const close = () => VcModal._close(bd, dlg);

                dlg.querySelector('#vcBMClose').addEventListener('click', close);
                dlg.querySelector('#vcBMClose2').addEventListener('click', close);
                bd.addEventListener('click', e => { if (e.target === bd) close(); });

                const inp = dlg.querySelector('#vcBNI');

                // ✅ FIX: After create/delete, re-render branch list IN PLACE instead of
                //         closing+reopening the whole modal — no flash at all.
                const refreshList = () => {
                    const newCards = Array.from(this.branches.entries()).map(([name, b]) => `
                        <div class="vc-branch-card" data-branch="${name}">
                            <div class="vc-branch-name">🌿 ${name}</div>
                            <div class="vc-branch-meta">Created: ${new Date(b.created).toLocaleString()}</div>
                            <div class="vc-branch-btns">
                                <button class="vc-btn vc-primary vc-btn-sm" data-sw="${name}">⇄ Switch</button>
                                <button class="vc-btn vc-danger  vc-btn-sm" data-rm="${name}">🗑️ Delete</button>
                            </div>
                        </div>`).join('') || '<div style="color:#aaa;font-size:13px;text-align:center;padding:20px 0;">No branches yet.</div>';
                    const list = dlg.querySelector('#vcBranchList');
                    if (list) {
                        list.style.opacity = '0';
                        list.style.transition = 'opacity .15s ease';
                        setTimeout(() => {
                            list.innerHTML = newCards;
                            list.style.opacity = '1';
                            bindBranchActions();
                        }, 150);
                    }
                };

                const bindBranchActions = () => {
                    dlg.querySelectorAll('[data-sw]').forEach(b =>
                        b.addEventListener('click', () => this._switchBranch(b.dataset.sw, close)));
                    dlg.querySelectorAll('[data-rm]').forEach(b =>
                        b.addEventListener('click', () => this._deleteBranch(b.dataset.rm, refreshList)));
                };

                const create = () => this._createBranch(inp.value.trim(), refreshList, inp);
                dlg.querySelector('#vcBCreate').addEventListener('click', create);
                inp.addEventListener('keydown', e => { if (e.key === 'Enter') create(); });

                bindBranchActions();
            };

            renderContent();
        }

        async _createBranch(name, onSuccess, inp) {
            if (!name) { await VcModal.alert('Please enter a branch name.', '⚠️'); return; }
            if (this.branches.has(name)) { await VcModal.alert(`"<strong>${name}</strong>" already exists.`, '⚠️'); return; }
            const cur = this.versions[this.currentIdx];
            if (!cur) return;
            this.branches.set(name, { name, created: new Date().toISOString(), content: cur.content, baseVersion: this.currentIdx });
            await _sSet(STORAGE_BRANCHES, Array.from(this.branches.entries()));
            _toast(`Branch "${name}" created ✅`, 'success');
            // ✅ FIX: Clear input, then refresh list in place — no modal flicker
            if (inp) inp.value = '';
            onSuccess?.();
        }

        async _switchBranch(name, close) {
            const b = this.branches.get(name);
            if (!b) { await VcModal.alert('Branch not found.', '⚠️'); return; }
            const ok = await VcModal.confirm(`Switch to "<strong>${name}</strong>"?`, '🌿');
            if (!ok) return;
            // ✅ FIX: Animate close first, then switch content — no jarring jump
            await close();
            _restoreDOM(b.content);
            _toast(`Switched to "${name}" ✅`, 'success');
        }

        async _deleteBranch(name, onSuccess) {
            const ok = await VcModal.confirm(`Delete branch "<strong>${name}</strong>"?`, '🗑️', true);
            if (!ok) return;
            this.branches.delete(name);
            await _sSet(STORAGE_BRANCHES, Array.from(this.branches.entries()));
            _toast(`Branch "${name}" deleted`, 'warning');
            // ✅ FIX: Refresh list in place — no modal reopen needed
            onSuccess?.();
        }

        /* ─── COMMENTS ─── */
        addComment() {
            const sel = window.getSelection();
            if (!sel?.rangeCount || !sel.toString()) { VcModal.alert('Select text to comment on.', '💬'); return; }
            VcModal.prompt('Add a comment', 'Type your comment…', '💬').then(text => {
                if (!text) return;
                const range = sel.getRangeAt(0);
                const id    = 'vc_c_' + Date.now();
                const span  = document.createElement('span');
                span.id = id; span.className = 'vc-comment-span'; span.dataset.commentId = id;
                try { range.surroundContents(span); }
                catch { const f = range.extractContents(); span.appendChild(f); range.insertNode(span); }
                this.comments.set(id, { text, author: 'Anonymous', timestamp: new Date().toISOString(), resolved: false });
                span.addEventListener('click', e => { e.stopPropagation(); this._showComment(id, span); });
                _toast('Comment added', 'success');
            });
        }

        _showComment(id, anchor) {
            document.querySelectorAll('.vc-cpopup').forEach(p => p.remove());
            const c = this.comments.get(id);
            if (!c) return;
            const popup = document.createElement('div');
            popup.className = 'vc-cpopup';
            popup.innerHTML = `
                <div style="font-size:13px;font-weight:700;color:#1a1d2e;margin-bottom:6px;">💬 Comment</div>
                <div class="vc-cbody">${c.text}</div>
                <div class="vc-cmeta">${c.author} · ${new Date(c.timestamp).toLocaleString()}</div>
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    <button class="vc-btn vc-success vc-btn-sm" id="vcCRes">✓ Resolve</button>
                    <button class="vc-btn vc-ghost   vc-btn-sm" id="vcCCl">✕</button>
                </div>`;
            document.body.appendChild(popup);
            const rect = anchor.getBoundingClientRect();
            popup.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
            popup.style.left = Math.min(rect.left + window.scrollX, window.innerWidth - 300) + 'px';
            popup.querySelector('#vcCRes').addEventListener('click', () => {
                c.resolved = true; anchor.classList.add('resolved'); popup.remove();
                _toast('Comment resolved', 'success');
            });
            popup.querySelector('#vcCCl').addEventListener('click', () => popup.remove());
            setTimeout(() => document.addEventListener('click', () => popup.remove(), { once: true }), 120);
        }

        /* ─── ANNOTATIONS ─── */
        addAnnotation(type) {
            const sel = window.getSelection();
            if (!sel?.rangeCount || !sel.toString()) { VcModal.alert('Select text to annotate.', '✏️'); return; }
            const range = sel.getRangeAt(0);
            const id    = 'vc_a_' + Date.now();
            const span  = document.createElement('span');
            span.id     = id;
            const cls   = { highlight:'vc-hi', underline:'vc-ul', strikethrough:'vc-str', box:'vc-box' }[type];
            if (!cls) return;
            span.className = cls;
            try { range.surroundContents(span); }
            catch { const f = range.extractContents(); span.appendChild(f); range.insertNode(span); }
            this.annotations.set(id, { type, timestamp: new Date().toISOString() });
            _toast(`Annotation: ${type}`, 'info');
        }

        /* ─── PUBLIC ─── */
        saveCheckpoint(msg) {
            return msg ? this._save(msg, true) : this._promptSave();
        }
    }

    /* ═══════════════════════════════════════════════════
     *  BOOTSTRAP
     * ═══════════════════════════════════════════════════ */
    function _bootstrap() {
        if (global.versionControl instanceof VersionControlSystem) {
            console.warn('[VersionControl] Already initialized'); return;
        }
        global.versionControl = new VersionControlSystem();
        console.log(`✅ VersionControl v${VERSION} ready`);
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', _bootstrap, { once: true });
    else
        _bootstrap();

})(typeof window !== 'undefined' ? window : this);