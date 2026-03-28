"""
===================================================================
🔥 UNIFIED FLOW HANDLER — v2.0 "WORD FLOW SYNC EDITION"
===================================================================
✅ Synced with:
  - WordFlowEngine v4.1 JS (notepro-professional.css)
  - PaperRegistry pixel values from CSS (exact px dimensions)
  - HTML form: noteTitle, noteCategory, noteContent, paperSize
  - Page-break marker: '<div class="page-break-marker" style="page-break-after:always;"></div>'
  - JS auto-save content format (multi-page with page-break markers)
  - WordFlow status bar: totalPages, wordCount, charCount
  - MAX_CONTENT_SIZE = 10,000,000 bytes

🔧 FIXES vs v1.0:
  - PAPER_SIZES now uses CSS pixel dimensions (width_px, height_px, margin_px)
  - lines_per_page calculated from CSS content_height_px ÷ 18px line-height
  - Added 'executive', 'a3', 'letter' to match CSS + JS PaperRegistry
  - 'plain' kept as alias for backward compat
  - Page break counting uses actual JS marker string
  - ContentOptimizer uses CSS-accurate content widths for char estimation
  - HTML cleanup preserves lang/font spans (Hindi/Indic fix, matches JS HTMLSanitizer)
  - /api/editor/save-note route: properly handles multi-page content
  - Auto-save endpoint (/api/editor/auto-save-draft) for JS auto-save integration
  - /api/editor/paper-size-info returns pixel dims for CSS matching
===================================================================
"""

from flask import request, jsonify
from flask_login import current_user, login_required
from models import Note, PAPER_REGISTRY, VALID_PAPER_SIZES, PAGE_BREAK_MARKER, MAX_NOTE_SIZE_BYTES
from extensions import db
import logging
from datetime import datetime, timezone
import re
import hashlib
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


# ===================================================================
# ⚙️  CONSTANTS — Synced with models.py & JS Engine
# ===================================================================

# Matches JS: MAX_CONTENT_SIZE in unified_flow_backend (original)
MAX_CONTENT_SIZE   = MAX_NOTE_SIZE_BYTES        # 10_000_000 bytes
MAX_TITLE_LENGTH   = 200                         # Note.title Column(String(200))
MAX_CATEGORY_LENGTH = 50                         # Note.category Column(String(50))

# JS page-break marker (must match JS serialize()/deserialize())
_PAGE_BREAK_MARKER = PAGE_BREAK_MARKER

# Approximate font metrics for server-side estimation
# At 12pt on 96dpi screen: ~7.5px per char average
_CHAR_WIDTH_PX  = 7.5
_LINE_HEIGHT_PX = 18.0

# Overflow tolerance (matches JS: reflow.overflowTolerance = 2px)
_OVERFLOW_TOLERANCE_PX = 2


# ===================================================================
# 📐  PAPER SIZES — CSS-accurate pixel values
# ===================================================================
# Source: notepro-professional.css lines 749-762
# NOTE: 'plain' is backward-compat alias for 'letter'

PAPER_SIZES = PAPER_REGISTRY  # re-export from models so single source of truth


def get_paper_size_config(paper_size: str) -> dict:
    """Get paper config. Falls back to a4 (not 'plain') for unknown sizes."""
    if paper_size in PAPER_SIZES:
        return PAPER_SIZES[paper_size]
    logger.warning(f"Unknown paper size '{paper_size}', falling back to a4")
    return PAPER_SIZES['a4']


def validate_paper_size(paper_size: str):
    """Returns (is_valid: bool, error_str | None)"""
    if paper_size in VALID_PAPER_SIZES:
        return True, None
    return False, f"Invalid paper size '{paper_size}'. Valid: {', '.join(sorted(VALID_PAPER_SIZES))}"


def validate_content(title: str, content: str, paper_size: str):
    """Validate all three main form fields."""
    if not title or not title.strip():
        return False, "Title is required"
    if len(title) > MAX_TITLE_LENGTH:
        return False, f"Title must be {MAX_TITLE_LENGTH} characters or less"
    if not content or not content.strip():
        return False, "Content is required"
    content_bytes = len(content.encode('utf-8'))
    if content_bytes > MAX_CONTENT_SIZE:
        return False, f"Content size {content_bytes:,} bytes exceeds {MAX_CONTENT_SIZE:,} limit"
    ok, err = validate_paper_size(paper_size)
    if not ok:
        return False, err
    return True, None


# ===================================================================
# 🧹  HTML CLEANER — Matches JS HTMLSanitizer behavior
# ===================================================================

class HTMLCleaner:
    """
    Server-side HTML cleaner that mirrors JS HTMLSanitizer.clean() behavior.

    KEY RULE (matches JS HTMLSanitizer v4.1.1 HINDI FIX):
      - Strip dangerous/layout mso-* style props
      - PRESERVE lang, font-family, mso-bidi-language, dir attributes
      - PRESERVE spans with lang/font/dir — needed for Devanagari rendering
      - Remove script/style/meta/link/iframe/object/embed/form tags
    """

    # Tags to completely remove (with content)
    _REMOVE_TAGS = ['script', 'style', 'meta', 'link', 'iframe', 'object', 'embed', 'form']

    # MSO style properties safe to keep (needed for Hindi/Indic)
    _MSO_KEEP_RE = re.compile(
        r'mso-(bidi-language|ascii-font-family|fareast-font-family|bidi-font-family)',
        re.IGNORECASE
    )

    # MSO style properties to strip (layout-breaking)
    _MSO_STRIP_RE = re.compile(
        r'mso-(para-margin|margin|indent|list|pagination|line-height|spacerun|tab-stop)[^;]*;?',
        re.IGNORECASE
    )

    # XSS patterns
    _XSS_RE = re.compile(r'(javascript:|vbscript:|on\w+=)', re.IGNORECASE)

    @classmethod
    def clean(cls, html: str) -> str:
        """Clean HTML for safe storage. Mirrors JS HTMLSanitizer.clean()"""
        if not html or not html.strip():
            return '<p><br></p>'
        try:
            soup = BeautifulSoup(html, 'html.parser')
            for tag in soup.find_all(cls._REMOVE_TAGS):
                tag.decompose()
            for tag in soup.find_all(True):
                for attr in list(tag.attrs.keys()):
                    val = str(tag.attrs.get(attr, ''))
                    if cls._XSS_RE.search(val):
                        del tag.attrs[attr]
            return str(soup) or '<p><br></p>'
        except Exception as e:
            logger.error(f"HTMLCleaner.clean error: {e}")
            return '<p><br></p>'

    @classmethod
    def normalize_from_paste(cls, html: str) -> str:
        """
        Normalize pasted HTML. Mirrors JS HTMLSanitizer.normalizeFromPaste().
        Strips Word/LibreOffice markup while preserving Indic script attributes.
        """
        if not html or not html.strip():
            return '<p><br></p>'

        # Remove Office XML namespaced tags
        html = re.sub(r'</?o:[^>]*>', '', html)
        html = re.sub(r'</?w:[^>]*>', '', html)
        html = re.sub(r'<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->', '', html)

        # div → p
        html = re.sub(r'<div([^>]*)>', r'<p\1>', html)
        html = re.sub(r'</div>', '</p>', html)

        # Selective mso style stripping (preserve Hindi/Indic mso- props)
        def _filter_style(m):
            style = m.group(1)
            safe_props = []
            for prop in style.split(';'):
                prop = prop.strip()
                if not prop:
                    continue
                if re.search(r'mso-', prop, re.IGNORECASE):
                    # Keep mso-bidi-language, mso-*-font-family — strip rest
                    if cls._MSO_KEEP_RE.search(prop):
                        safe_props.append(prop)
                    # else: strip
                else:
                    safe_props.append(prop)
            result = '; '.join(safe_props)
            return f'style="{result}"' if result else ''

        html = re.sub(r'style="([^"]*)"', _filter_style, html, flags=re.IGNORECASE)

        # Strip mso class names only
        html = re.sub(r'\s*class="[^"]*mso[^"]*"', '', html, flags=re.IGNORECASE)

        # Empty paragraphs
        html = re.sub(r'<p[^>]*>\s*</p>', '<p><br></p>', html, flags=re.IGNORECASE)

        # Selective span handling: preserve lang/font/dir spans (Hindi fix)
        def _filter_span(m):
            attrs = m.group(1)
            inner = m.group(2)
            if re.search(r'lang=|font-family|mso-bidi|dir=|unicode-bidi', attrs, re.IGNORECASE):
                return f'<span{attrs}>{inner}</span>'
            return inner

        html = re.sub(r'<span([^>]*)>([\s\S]*?)</span>', _filter_span, html, flags=re.IGNORECASE)

        return html.strip() or '<p><br></p>'


# ===================================================================
# 📊  CONTENT OPTIMIZER — CSS pixel-accurate estimation
# ===================================================================

class ContentOptimizer:
    """
    Server-side content analysis.

    ✅ FIX vs v1.0:
    - All measurements use CSS pixel values from PAPER_REGISTRY
    - chars_per_line derived from content_width_px / char_width_px
    - lines_per_page derived from content_height_px / line_height_px
    - Page break markers counted from actual JS marker string
    """

    @staticmethod
    def count_page_breaks(html_content: str) -> int:
        """Count explicit JS page-break markers in content"""
        return html_content.count('page-break-marker')

    @staticmethod
    def split_by_page_breaks(html_content: str) -> list:
        """Split multi-page content into individual page HTML strings"""
        return html_content.split(_PAGE_BREAK_MARKER)

    @staticmethod
    def estimate_content_height(html_content: str, paper_size: str = 'a4') -> dict:
        """
        Estimate content height using CSS-accurate paper dimensions.

        ✅ FIX: Uses content_width_px from PAPER_REGISTRY (not hardcoded width_in * 10)
        """
        try:
            if not html_content or not html_content.strip():
                return {'text_length': 0, 'estimated_lines': 1, 'chars_per_line': 80}

            config       = get_paper_size_config(paper_size)
            content_w_px = config.get('content_width_px', 624)

            # chars_per_line: content width ÷ avg char width
            chars_per_line = max(40, int(content_w_px / _CHAR_WIDTH_PX))

            soup = BeautifulSoup(html_content, 'html.parser')
            for tag in soup.find_all(['script', 'style', 'meta', 'link']):
                tag.decompose()
            text = soup.get_text(separator=' ', strip=True)
            total_chars = len(text)

            estimated_lines = max(1, (total_chars + chars_per_line - 1) // chars_per_line)

            logger.debug(f"Height estimate: {estimated_lines} lines, {total_chars} chars, "
                         f"{chars_per_line} chars/line, paper={paper_size}")

            return {
                'text_length':     total_chars,
                'estimated_lines': estimated_lines,
                'chars_per_line':  chars_per_line,
            }
        except Exception as e:
            logger.error(f"estimate_content_height error: {e}")
            return {'text_length': 0, 'estimated_lines': 1, 'chars_per_line': 80}

    @staticmethod
    def calculate_page_breaks(html_content: str, paper_size: str = 'a4',
                               lines_per_page: int = None) -> dict:
        """
        Calculate page breaks from content.

        ✅ FIX vs v1.0:
        - Uses CSS content_height_px for lines_per_page calculation
        - Element type multipliers tuned to match JS ReflowEngine split() behavior
        - Counts actual JS page-break markers as authoritative page count
        """
        _empty = {
            'estimated_pages': 1, 'page_breaks': [],
            'lines_per_page': 48, 'total_paragraphs': 0,
            'total_chars': 0, 'chars_per_line': 80, 'total_lines': 1,
            'explicit_breaks': 0,
        }

        try:
            if not html_content or not html_content.strip():
                return _empty

            config           = get_paper_size_config(paper_size)
            content_w_px     = config.get('content_width_px', 624)
            content_h_px     = config.get('content_height_px', 931)

            # CSS-accurate derivations
            chars_per_line   = max(40, int(content_w_px / _CHAR_WIDTH_PX))
            lpp              = lines_per_page or max(10, int(content_h_px / _LINE_HEIGHT_PX))

            # Count explicit JS page-break markers (most authoritative)
            explicit_breaks  = ContentOptimizer.count_page_breaks(html_content)

            soup = BeautifulSoup(html_content, 'html.parser')
            for tag in soup.find_all(['script', 'style', 'meta']):
                tag.decompose()

            total_text  = soup.get_text(separator=' ', strip=True)
            total_chars = len(total_text)

            elements = soup.find_all(
                ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote']
            )
            element_count = len(elements)

            if element_count == 0:
                return {**_empty,
                        'total_chars':    total_chars,
                        'chars_per_line': chars_per_line,
                        'lines_per_page': lpp,
                        'explicit_breaks': explicit_breaks}

            # Element-based page break simulation (mirrors JS ReflowEngine logic)
            page_breaks   = []
            current_line  = 0.0
            page_num      = 1

            for idx, elem in enumerate(elements):
                text = elem.get_text(strip=True)
                if not text:
                    continue

                tag = elem.name.lower()

                # Element height multipliers — tuned to match JS behavior
                if tag.startswith('h'):
                    # Headings: larger font + top/bottom margin
                    elem_lines = max(2.0, len(text) / (chars_per_line * 0.65)) + 1.5
                elif tag in ('ul', 'ol'):
                    # Lists: each item on own line + padding
                    elem_lines = max(2.0, len(text) / (chars_per_line * 0.80)) + 2.0
                elif tag == 'blockquote':
                    # Blockquotes: indented narrower
                    elem_lines = max(1.0, len(text) / (chars_per_line * 0.85)) + 1.0
                else:
                    # Regular paragraphs
                    elem_lines = max(1.0, len(text) / chars_per_line)

                # Paragraph spacing (approx 0.5 line)
                elem_lines += 0.5
                current_line += elem_lines

                if current_line > lpp:
                    page_breaks.append({
                        'page':           page_num,
                        'after_element':  idx,
                        'estimated_line': int(current_line),
                        'content_size':   len(text),
                    })
                    current_line = elem_lines
                    page_num    += 1

            # Final page count: max of estimated vs explicit breaks
            total_lines     = max(1, int(total_chars / chars_per_line) + int(element_count * 1.5))
            pages_from_text = max(1, int(total_lines / lpp + 0.5))
            estimated_pages = max(pages_from_text, explicit_breaks + 1)

            logger.info(f"Page calc: {estimated_pages} pages (text={pages_from_text}, "
                        f"explicit={explicit_breaks}), paper={paper_size}")

            return {
                'estimated_pages':  estimated_pages,
                'page_breaks':      page_breaks,
                'lines_per_page':   lpp,
                'total_paragraphs': element_count,
                'total_chars':      total_chars,
                'chars_per_line':   chars_per_line,
                'total_lines':      int(total_lines),
                'explicit_breaks':  explicit_breaks,
            }

        except Exception as e:
            logger.error(f"calculate_page_breaks error: {e}")
            return _empty

    @staticmethod
    def optimize_html_for_storage(html_content: str,
                                   max_size: int = MAX_CONTENT_SIZE):
        """
        Lightweight HTML optimization for storage.

        ✅ FIX vs v1.0:
        - Does NOT strip <p><br></p> — JS engine needs these as placeholders
        - Removes only truly empty paragraphs <p></p> (no br inside)
        - Preserves page-break-marker divs
        - Preserves lang/font spans for Hindi/Indic
        """
        try:
            size_bytes = len(html_content.encode('utf-8'))
            if size_bytes > max_size:
                return None, f"Content {size_bytes:,} bytes exceeds {max_size:,} limit"

            original_len = len(html_content)

            # Collapse excess whitespace (not inside tags)
            optimized = re.sub(r'\n{3,}', '\n\n', html_content)
            optimized = re.sub(r'[ \t]{2,}', ' ', optimized)

            # Remove truly empty <p></p> only (NOT <p><br></p>)
            optimized = re.sub(r'<p(\s[^>]*)?>(\s*)</p>', '', optimized)

            if not optimized.strip():
                optimized = '<p><br></p>'

            reduction_pct = ((original_len - len(optimized)) / original_len * 100
                             if original_len > 0 else 0)
            logger.info(f"HTML optimized: {original_len} → {len(optimized)} "
                        f"({reduction_pct:.1f}% reduction)")

            return optimized, None

        except Exception as e:
            logger.error(f"optimize_html_for_storage error: {e}")
            return html_content, str(e)


# ===================================================================
# 📐  SMART FLOW HANDLER
# ===================================================================

class SmartFlowHandler:
    """
    Content distribution analysis and layout suggestions.

    ✅ FIX vs v1.0:
    - block_height calculated using CSS content_width_px (not hardcoded /80)
    - fill_percent based on lines_per_page from PAPER_REGISTRY
    """

    @staticmethod
    def analyze_content_distribution(content_blocks: list,
                                      paper_size: str = 'a4') -> dict:
        """Analyze block distribution across pages using CSS-accurate dimensions."""
        try:
            if not content_blocks:
                return {
                    'total_blocks':   0,
                    'pages':          [],
                    'orphans':        [],
                    'widows':         [],
                    'recommendations': [],
                }

            config       = get_paper_size_config(paper_size)
            lines_pp     = config.get('lines_per_page', 48)
            content_w_px = config.get('content_width_px', 624)
            chars_per_line = max(40, int(content_w_px / _CHAR_WIDTH_PX))

            result = {
                'total_blocks':   len(content_blocks),
                'pages':          [],
                'orphans':        [],
                'widows':         [],
                'recommendations': [],
            }

            current_page   = 1
            current_height = 0.0
            blocks_on_page = []

            for idx, block in enumerate(content_blocks):
                text       = block.get('text', '')
                block_type = block.get('type', 'p')
                if not text:
                    continue

                # Block height (lines) based on type — same multipliers as calculate_page_breaks
                if block_type.startswith('h'):
                    bh = max(2.0, len(text) / (chars_per_line * 0.65)) + 1.5
                elif block_type in ('ul', 'ol'):
                    bh = max(2.0, len(text) / (chars_per_line * 0.80)) + 2.0
                elif block_type == 'blockquote':
                    bh = max(1.0, len(text) / (chars_per_line * 0.85)) + 1.0
                else:
                    bh = max(1.0, len(text) / chars_per_line)

                total_bh = bh + 0.5  # paragraph spacing

                if current_height + total_bh <= lines_pp:
                    current_height += total_bh
                    blocks_on_page.append({
                        'index':       idx,
                        'text_length': len(text),
                        'type':        block_type,
                        'height':      round(bh, 2),
                    })
                else:
                    # Save current page
                    if blocks_on_page:
                        result['pages'].append({
                            'page':         current_page,
                            'block_count':  len(blocks_on_page),
                            'height':       round(current_height, 2),
                            'blocks':       blocks_on_page,
                            'content_size': sum(b['text_length'] for b in blocks_on_page),
                            'fill_percent': round((current_height / lines_pp) * 100, 1),
                        })
                    current_page  += 1
                    current_height = total_bh
                    blocks_on_page = [{
                        'index':       idx,
                        'text_length': len(text),
                        'type':        block_type,
                        'height':      round(bh, 2),
                    }]

            # Last page
            if blocks_on_page:
                result['pages'].append({
                    'page':         current_page,
                    'block_count':  len(blocks_on_page),
                    'height':       round(current_height, 2),
                    'blocks':       blocks_on_page,
                    'content_size': sum(b['text_length'] for b in blocks_on_page),
                    'fill_percent': round((current_height / lines_pp) * 100, 1),
                })

            # Orphan: single block on a page that isn't the last page
            pages = result['pages']
            for i, page in enumerate(pages):
                if page['block_count'] == 1 and i < len(pages) - 1:
                    result['orphans'].append({
                        'page':        page['page'],
                        'block_count': 1,
                        'height':      page['height'],
                        'severity':    'high',
                    })
                # Widow: page < 30% full and not the last page
                if page['fill_percent'] < 30 and i < len(pages) - 1:
                    result['widows'].append({
                        'page':         page['page'],
                        'height':       page['height'],
                        'fill_percent': page['fill_percent'],
                        'severity':     'medium',
                    })

            logger.info(f"Distribution: {len(pages)} pages, "
                        f"{len(result['orphans'])} orphans, "
                        f"{len(result['widows'])} widows, paper={paper_size}")
            return result

        except Exception as e:
            logger.error(f"analyze_content_distribution error: {e}")
            return None

    @staticmethod
    def suggest_layout_fixes(analysis: dict) -> list:
        """Generate actionable layout suggestions from distribution analysis."""
        suggestions = []
        if not analysis or not analysis.get('pages'):
            return suggestions

        pages = analysis['pages']

        if analysis.get('orphans'):
            suggestions.append({
                'type':     'orphan_blocks',
                'severity': 'high',
                'count':    len(analysis['orphans']),
                'pages':    [o['page'] for o in analysis['orphans']],
                'message':  f"⚠️ {len(analysis['orphans'])} orphan block(s) detected",
                'action':   'Remove extra blank lines or merge with adjacent content',
                'impact':   'Layout looks awkward; wastes paper',
            })

        if analysis.get('widows'):
            w0 = analysis['widows'][0]
            suggestions.append({
                'type':     'widow_pages',
                'severity': 'medium',
                'count':    len(analysis['widows']),
                'pages':    [w['page'] for w in analysis['widows']],
                'message':  f"💡 {len(analysis['widows'])} nearly-empty page(s) "
                            f"({w0['fill_percent']:.0f}% full)",
                'action':   'Reduce margins or spacing to fit more content per page',
                'impact':   'Efficiency: wasted paper',
            })

        over_capacity = [p for p in pages if p['fill_percent'] > 100]
        if over_capacity:
            suggestions.append({
                'type':     'overflow_pages',
                'severity': 'high',
                'count':    len(over_capacity),
                'pages':    [p['page'] for p in over_capacity],
                'message':  f"⚠️ {len(over_capacity)} page(s) overflow — content may be cut off",
                'action':   'Content exceeds page limits; WordFlow engine will reflow automatically',
                'impact':   'Possible data loss if JS reflow is disabled',
            })

        if len(pages) > 10:
            suggestions.append({
                'type':       'too_many_pages',
                'severity':   'low',
                'page_count': len(pages),
                'message':    f"📄 {len(pages)} pages — consider splitting into multiple notes",
                'action':     'Split into smaller, focused notes',
                'impact':     'Usability: large documents are harder to manage',
            })

        heights = [p['fill_percent'] for p in pages]
        if len(heights) > 1:
            min_h = min(heights)
            max_h = max(heights)
            avg_h = sum(heights) / len(heights)
            if avg_h > 0 and max_h > avg_h * 1.5:
                suggestions.append({
                    'type':      'uneven_distribution',
                    'severity':  'low',
                    'min_fill':  round(min_h, 1),
                    'max_fill':  round(max_h, 1),
                    'avg_fill':  round(avg_h, 1),
                    'message':   f"📊 Uneven page distribution ({min_h:.0f}%–{max_h:.0f}% fills)",
                    'action':    'Adjust spacing for better balance',
                    'impact':    'Aesthetics: document looks unbalanced',
                })

        logger.info(f"Generated {len(suggestions)} layout suggestions")
        return suggestions


# ===================================================================
# 🛣️  ROUTE REGISTRATION
# ===================================================================

_ROUTES_REGISTERED = False


def register_unified_flow_routes(app):
    """Register all /api/editor/* routes."""

    global _ROUTES_REGISTERED
    if _ROUTES_REGISTERED:
        logger.warning("Unified flow routes already registered, skipping")
        return
    _ROUTES_REGISTERED = True

    # ── Helper ────────────────────────────────────────────────────

    def _json_ok(data: dict, status: int = 200):
        return jsonify({'success': True, **data}), status

    def _json_err(msg: str, status: int = 400):
        return jsonify({'success': False, 'message': msg}), status

    def _parse_blocks(content: str) -> list:
        """Parse HTML content into block list for analysis."""
        soup = BeautifulSoup(content, 'html.parser')
        blocks = []
        for elem in soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'div', 'blockquote', 'ul', 'ol']):
            text = elem.get_text(strip=True)
            if text:
                blocks.append({'text': text, 'type': elem.name})
        return blocks

    # ─────────────────────────────────────────────────────────────
    # POST /api/editor/save-note
    # Called by HTML form submit (noteForm) via fetch()
    # Form fields: noteTitle, noteCategory, noteContent, paperSize
    # ─────────────────────────────────────────────────────────────
    @app.route('/api/editor/save-note', methods=['POST'])
    @login_required
    def save_note():
        """
        Save or update a note.

        Accepts multipart/form-data (from HTML form) or JSON.
        Content is multi-page HTML joined by JS page-break markers.

        ✅ SYNC with HTML form:
          - 'noteTitle'    → note.title
          - 'noteCategory' → note.category
          - 'noteContent'  → note.content  (full multi-page HTML)
          - 'paperSize'    → note.paper_size
          - 'noteId'       → existing note ID (for update)
        """
        try:
            # Support both form-data and JSON
            if request.is_json:
                data       = request.get_json() or {}
                title      = data.get('noteTitle', data.get('title', '')).strip()
                content    = data.get('noteContent', data.get('content', '')).strip()
                category   = data.get('noteCategory', data.get('category', 'General')).strip()
                paper_size = data.get('paperSize', data.get('paper_size', 'a4')).strip()
                note_id    = data.get('noteId', data.get('id'))
            else:
                title      = (request.form.get('noteTitle', '') or '').strip()
                content    = (request.form.get('noteContent', '') or request.form.get('content', '')).strip()
                category   = (request.form.get('noteCategory', '') or 'General').strip()
                paper_size = (request.form.get('paperSize', '') or 'a4').strip()
                note_id    = request.form.get('noteId') or request.form.get('id')

            # Validate
            ok, err = validate_content(title, content, paper_size)
            if not ok:
                return _json_err(err)

            # Step 1 — XSS clean: script/iframe/onclick sab hatao
            # HTMLCleaner mirrors JS HTMLSanitizer behavior (Hindi/Indic safe)
            xss_clean = HTMLCleaner.clean(content)

            # Step 2 — Optimize: whitespace collapse, empty tags remove
            clean_content, clean_err = ContentOptimizer.optimize_html_for_storage(xss_clean)
            if clean_err:
                return _json_err(clean_err)

            # Storage check
            additional_bytes = len((clean_content or '').encode('utf-8'))
            if not current_user.is_storage_available(additional_bytes):
                used_mb = current_user.get_storage_used_mb()
                max_mb  = current_user.get_max_storage_mb()
                return _json_err(
                    f"Storage limit reached ({used_mb:.1f}MB / {max_mb:.0f}MB). "
                    "Upgrade to Premium for more space.", 413
                )

            # Create or update
            if note_id:
                note = Note.query.filter_by(id=note_id, user_id=current_user.id).first()
                if not note:
                    return _json_err("Note not found", 404)
                note.content_version += 1
            else:
                note = Note(user_id=current_user.id)
                db.session.add(note)

            note.title      = title
            note.content    = clean_content or '<p><br></p>'
            note.category   = category or 'General'
            note.paper_size = paper_size

            # Update computed stats
            note.update_content_stats()

            db.session.commit()

            logger.info(f"Note saved: id={note.id} pages={note.estimated_pages} "
                        f"words={note.word_count} paper={note.paper_size}")

            return _json_ok({
                'id':              note.id,
                'redirect_url':    '/dashboard',
                'estimated_pages': note.estimated_pages,
                'word_count':      note.word_count,
                'char_count':      note.char_count,
            })

        except Exception as e:
            db.session.rollback()
            logger.error(f"save_note error: {e}", exc_info=True)
            return _json_err("Failed to save note", 500)

    # ─────────────────────────────────────────────────────────────
    # POST /api/editor/auto-save-draft
    # Called by JS auto-save mechanism every 30s
    # ─────────────────────────────────────────────────────────────
    @app.route('/api/editor/auto-save-draft', methods=['POST'])
    @login_required
    def auto_save_draft():
        """
        Lightweight auto-save endpoint.
        JS sends: {title, category, content, timestamp, noteId?, paperSize?}

        Does NOT do full validation — just updates the note with minimal processing.
        Returns 200 even on minor issues (don't block the user).
        """
        try:
            data = request.get_json(silent=True) or {}

            title      = (data.get('title', '') or '').strip()
            content    = (data.get('content', '') or '').strip()
            category   = (data.get('category', '') or 'General').strip()
            paper_size = (data.get('paper_size', data.get('paperSize', 'a4')) or 'a4').strip()
            note_id    = data.get('noteId') or data.get('id')

            if not title or not content:
                return _json_ok({'saved': False, 'reason': 'Empty title or content'})

            # Minimal size check
            if len(content.encode('utf-8')) > MAX_CONTENT_SIZE:
                return _json_ok({'saved': False, 'reason': 'Content too large'})

            # Normalize paper size
            if paper_size not in VALID_PAPER_SIZES:
                paper_size = 'a4'

            if note_id:
                note = Note.query.filter_by(id=note_id, user_id=current_user.id).first()
                if not note:
                    return _json_ok({'saved': False, 'reason': 'Note not found'})

                # Skip if content unchanged (hash check)
                if not note.is_content_changed(content):
                    return _json_ok({'saved': False, 'reason': 'No changes', 'unchanged': True})

                note.title      = title[:MAX_TITLE_LENGTH]
                note.content    = content
                note.category   = category[:50]
                note.paper_size = paper_size
                note.update_content_stats()
                db.session.commit()

                return _json_ok({
                    'saved':           True,
                    'id':              note.id,
                    'estimated_pages': note.estimated_pages,
                })
            else:
                # No note_id → don't create, just acknowledge
                return _json_ok({'saved': False, 'reason': 'No note ID for auto-save'})

        except Exception as e:
            db.session.rollback()
            logger.error(f"auto_save_draft error: {e}")
            # Always 200 for auto-save (don't alarm user)
            return _json_ok({'saved': False, 'reason': 'Server error'})

    # ─────────────────────────────────────────────────────────────
    # POST /api/editor/validate-content
    # ─────────────────────────────────────────────────────────────
    @app.route('/api/editor/validate-content', methods=['POST'])
    @login_required
    def validate_editor_content():
        """Validate content with overflow/distribution analysis."""
        try:
            data = request.get_json(silent=True) or {}

            title      = (data.get('title', '') or '').strip()
            content    = (data.get('content', '') or '').strip()
            paper_size = (data.get('paper_size', 'a4') or 'a4').strip()

            ok, err = validate_content(title, content, paper_size)
            if not ok:
                return _json_err(err)

            paper_config   = get_paper_size_config(paper_size)
            height_est     = ContentOptimizer.estimate_content_height(content, paper_size)
            page_breaks    = ContentOptimizer.calculate_page_breaks(content, paper_size)
            blocks         = _parse_blocks(content)
            distribution   = SmartFlowHandler.analyze_content_distribution(blocks, paper_size)
            suggestions    = SmartFlowHandler.suggest_layout_fixes(distribution)

            return _json_ok({
                'validation': {
                    'title_valid':      bool(title),
                    'content_valid':    bool(content),
                    'paper_size_valid': True,
                },
                'analysis': {
                    'content_stats':   height_est,
                    'page_breaks':     page_breaks,
                    'distribution':    distribution,
                    'paper_config':    paper_config,
                },
                'recommendations': suggestions,
            })

        except Exception as e:
            logger.error(f"validate_editor_content error: {e}")
            return _json_err("Validation failed", 500)

    # ─────────────────────────────────────────────────────────────
    # POST /api/editor/estimate-pages
    # ─────────────────────────────────────────────────────────────
    @app.route('/api/editor/estimate-pages', methods=['POST'])
    @login_required
    def estimate_pages():
        """Estimate page count — used by JS status bar."""
        try:
            data = request.get_json(silent=True) or {}

            content    = (data.get('content', '') or '').strip()
            paper_size = (data.get('paper_size', 'a4') or 'a4').strip()

            if not content:
                return _json_ok({'estimated_pages': 1, 'message': 'Empty content'})

            ok, err = validate_paper_size(paper_size)
            if not ok:
                return _json_err(err)

            paper_config = get_paper_size_config(paper_size)
            page_breaks  = ContentOptimizer.calculate_page_breaks(content, paper_size)

            return _json_ok({
                'estimated_pages':    page_breaks['estimated_pages'],
                'explicit_breaks':    page_breaks['explicit_breaks'],
                'page_breaks':        page_breaks['page_breaks'],
                'content_size':       page_breaks['total_chars'],
                'paper_size':         paper_size,
                'paper_config': {
                    'name':      paper_config['name'],
                    'width_px':  paper_config['width_px'],
                    'height_px': paper_config['height_px'],
                },
                'calculation_details': {
                    'total_chars':    page_breaks['total_chars'],
                    'chars_per_line': page_breaks['chars_per_line'],
                    'total_lines':    page_breaks['total_lines'],
                    'lines_per_page': page_breaks['lines_per_page'],
                },
            })

        except Exception as e:
            logger.error(f"estimate_pages error: {e}")
            return _json_err("Estimation failed", 500)

    # ─────────────────────────────────────────────────────────────
    # GET /api/editor/paper-size-info
    # Returns CSS-accurate pixel dimensions for all paper sizes
    # ─────────────────────────────────────────────────────────────
    @app.route('/api/editor/paper-size-info', methods=['GET'])
    @login_required
    def get_paper_size_info():
        """
        Returns CSS-pixel-accurate paper size info.

        ✅ FIX vs v1.0: returns width_px/height_px/margin_px matching CSS:
          .paper-a4 .editor-page { width: 794px; height: 1123px; }
          .paper-a4 .page-content { top: 96px; ... }
        """
        try:
            sizes_info = {}
            for key, cfg in PAPER_SIZES.items():
                sizes_info[key] = {
                    'name':              cfg['name'],
                    'display':           cfg.get('display', cfg['name']),
                    'width_px':          cfg['width_px'],
                    'height_px':         cfg['height_px'],
                    'margin_px':         cfg['margin_px'],
                    'content_width_px':  cfg['content_width_px'],
                    'content_height_px': cfg['content_height_px'],
                    'width_in':          cfg.get('width_in'),
                    'height_in':         cfg.get('height_in'),
                    'lines_per_page':    cfg.get('lines_per_page', 48),
                }

            return _json_ok({
                'paper_sizes': sizes_info,
                'default':     'a4',
                'valid_sizes': sorted(VALID_PAPER_SIZES),
            })

        except Exception as e:
            logger.error(f"get_paper_size_info error: {e}")
            return _json_err("Error loading paper sizes", 500)

    # ─────────────────────────────────────────────────────────────
    # POST /api/editor/analyze-layout
    # ─────────────────────────────────────────────────────────────
    @app.route('/api/editor/analyze-layout', methods=['POST'])
    @login_required
    def analyze_layout():
        """Layout analysis with overflow/underflow detection."""
        try:
            data = request.get_json(silent=True) or {}

            if 'content' not in data:
                return _json_err("Content required")

            content    = data.get('content', '')
            paper_size = data.get('paper_size', 'a4')

            blocks   = _parse_blocks(content)
            analysis = SmartFlowHandler.analyze_content_distribution(blocks, paper_size)

            if analysis is None:
                return _json_err("Analysis failed", 500)

            suggestions = SmartFlowHandler.suggest_layout_fixes(analysis)

            return _json_ok({
                'analysis':    analysis,
                'suggestions': suggestions,
            })

        except Exception as e:
            logger.error(f"analyze_layout error: {e}")
            return _json_err("Analysis failed", 500)

    # ─────────────────────────────────────────────────────────────
    # POST /api/editor/handle-paper-change
    # Called by JS handlePaperSizeChange() after user picks new size
    # ─────────────────────────────────────────────────────────────
    @app.route('/api/editor/handle-paper-change', methods=['POST'])
    @login_required
    def handle_paper_change():
        """
        Compute reflow impact when paper size changes.

        ✅ FIX vs v1.0: compares width_px instead of width_in for precision.
        """
        try:
            data = request.get_json(silent=True) or {}

            old_size = (data.get('old_paper_size', 'a4') or 'a4').strip()
            new_size = (data.get('new_paper_size', 'a4') or 'a4').strip()
            content  = data.get('content', '')

            for size in (old_size, new_size):
                ok, err = validate_paper_size(size)
                if not ok:
                    return _json_err(err)

            old_cfg  = get_paper_size_config(old_size)
            new_cfg  = get_paper_size_config(new_size)

            old_breaks = ContentOptimizer.calculate_page_breaks(content, old_size)
            new_breaks = ContentOptimizer.calculate_page_breaks(content, new_size)

            # Reflow needed if pixel width changed or page count changed
            needs_reflow = (
                old_cfg['width_px'] != new_cfg['width_px'] or
                old_breaks['estimated_pages'] != new_breaks['estimated_pages']
            )

            return _json_ok({
                'paper_change': {
                    'from':       old_size,
                    'to':         new_size,
                    'old_config': {
                        'name':      old_cfg['name'],
                        'width_px':  old_cfg['width_px'],
                        'height_px': old_cfg['height_px'],
                    },
                    'new_config': {
                        'name':      new_cfg['name'],
                        'width_px':  new_cfg['width_px'],
                        'height_px': new_cfg['height_px'],
                    },
                },
                'reflow_needed': needs_reflow,
                'page_info': {
                    'old_pages':  old_breaks['estimated_pages'],
                    'new_pages':  new_breaks['estimated_pages'],
                    'difference': new_breaks['estimated_pages'] - old_breaks['estimated_pages'],
                },
                'action':    'reflow' if needs_reflow else 'no_action',
                'timestamp': datetime.now(timezone.utc).isoformat(),
            })

        except Exception as e:
            logger.error(f"handle_paper_change error: {e}")
            return _json_err("Paper change failed", 500)

    # ─────────────────────────────────────────────────────────────
    # POST /api/editor/optimize-content
    # ─────────────────────────────────────────────────────────────
    @app.route('/api/editor/optimize-content', methods=['POST'])
    @login_required
    def optimize_content_endpoint():
        """Optimize HTML content for storage."""
        try:
            data = request.get_json(silent=True) or {}
            if 'content' not in data:
                return _json_err("Content required")

            content            = data.get('content', '')
            optimized, err     = ContentOptimizer.optimize_html_for_storage(content)
            if err:
                return _json_err(err)

            original_len   = len(content)
            optimized_len  = len(optimized)
            reduction      = original_len - optimized_len
            reduction_pct  = (reduction / original_len * 100) if original_len > 0 else 0

            return _json_ok({
                'original_size':      original_len,
                'optimized_size':     optimized_len,
                'reduction_bytes':    reduction,
                'reduction_percent':  round(reduction_pct, 2),
                'optimized_content':  optimized,
            })

        except Exception as e:
            logger.error(f"optimize_content_endpoint error: {e}")
            return _json_err("Optimization failed", 500)

    logger.info("✅ Unified flow routes registered (v2.0 Word Flow Sync Edition)")


# ===================================================================
# 📤  EXPORTS
# ===================================================================

__all__ = [
    'register_unified_flow_routes',
    'validate_paper_size',
    'validate_content',
    'get_paper_size_config',
    'ContentOptimizer',
    'SmartFlowHandler',
    'HTMLCleaner',
    'PAPER_SIZES',
    'VALID_PAPER_SIZES',
    'PAGE_BREAK_MARKER',
    'MAX_CONTENT_SIZE',
    'MAX_TITLE_LENGTH',
]