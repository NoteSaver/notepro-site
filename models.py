"""
===================================================================
📦 MODELS.PY — v2.0 "WORD FLOW SYNC EDITION"
===================================================================
✅ Synced with:
  - WordFlowEngine v4.1 (notepro-professional.css paper dimensions)
  - PaperRegistry pixel values from CSS:
      letter:    w=816  h=1056  marginPx=96
      legal:     w=816  h=1344  marginPx=96
      executive: w=696  h=1008  marginPx=80
      a3:        w=1123 h=1587  marginPx=112
      a4:        w=794  h=1123  marginPx=96
      a5:        w=559  h=794   marginPx=64
  - HTML form fields: noteTitle, noteCategory, noteContent, paperSize
  - Auto-save draft format matching JS (title, category, content, timestamp)
  - Page break marker: '<div class="page-break-marker" ...>'
  - Content size limits: MAX_CONTENT_SIZE = 10,000,000 bytes
  - Hindi/Indic script support (preserves lang/font spans)

🔧 FIXES vs v1.0:
  - Paper size list synced with CSS + JS (added 'executive', 'a3', 'letter')
  - update_content_stats() now uses per-paper lines_per_page (not hardcoded 55)
  - get_paper_config() returns pixel dims matching CSS/JS PaperRegistry
  - validate_for_unified_flow() checks all valid sizes from CSS
  - Storage limit: Note.MAX_NOTE_SIZE = 10MB (matches backend MAX_CONTENT_SIZE)
  - datetime.utcnow() → timezone-aware UTC (deprecation fix)
  - Added content_hash for fast change detection
  - Added page_break_count for multi-page tracking
===================================================================
"""

from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
import pytz
from extensions import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash


# ===================================================================
# ⚙️  PAPER REGISTRY — Pixel-accurate, matches CSS + JS PaperRegistry
# ===================================================================

# CSS source (notepro-professional.css lines 749-762):
#   .paper-letter  .editor-page { width: 816px;  height: 1056px; }
#   .paper-letter  .page-content { top:96px; bottom:96px; left:96px; right:96px; }
#   .paper-a4      .editor-page { width: 794px;  height: 1123px; }
#   .paper-a4      .page-content { top:96px; bottom:96px; left:96px; right:96px; }
#   .paper-a3      .editor-page { width: 1123px; height: 1587px; }
#   .paper-a3      .page-content { top:112px; bottom:112px; left:112px; right:112px; }
#   .paper-a5      .editor-page { width: 559px;  height: 794px; }
#   .paper-a5      .page-content { top:64px; bottom:64px; left:64px; right:64px; }
#   .paper-legal   .editor-page { width: 816px;  height: 1344px; }
#   .paper-legal   .page-content { top:96px; bottom:96px; left:96px; right:96px; }
#   executive: assumed 696×1008, marginPx=80 (from JS PaperRegistry)

PAPER_REGISTRY = {
    # key: matches HTML <select> option values + JS PaperRegistry keys + CSS class suffixes
    'letter': {
        'name':         'Letter',
        'display':      'Letter (8.5" × 11")',
        'width_px':     816,
        'height_px':    1056,
        'margin_px':    96,
        # Derived: content area = height_px - 2×margin_px = 864px
        'content_height_px': 864,
        'content_width_px':  624,
        # For server-side estimation (96px ≈ 1 inch at 96dpi)
        'width_in':     8.5,
        'height_in':    11.0,
        'margin_in':    1.0,
        # lines_per_page: (content_height_px / line_height_px) where line≈18px
        'lines_per_page': 48,
    },
    'a4': {
        'name':         'A4',
        'display':      'A4 (8.27" × 11.69")',
        'width_px':     794,
        'height_px':    1123,
        'margin_px':    96,
        'content_height_px': 931,
        'content_width_px':  602,
        'width_in':     8.27,
        'height_in':    11.69,
        'margin_in':    1.0,
        'lines_per_page': 51,
    },
    'a3': {
        'name':         'A3',
        'display':      'A3 (11.69" × 16.54")',
        'width_px':     1123,
        'height_px':    1587,
        'margin_px':    112,
        'content_height_px': 1363,
        'content_width_px':  899,
        'width_in':     11.69,
        'height_in':    16.54,
        'margin_in':    1.17,
        'lines_per_page': 75,
    },
    'a5': {
        'name':         'A5',
        'display':      'A5 (5.83" × 8.27")',
        'width_px':     559,
        'height_px':    794,
        'margin_px':    64,
        'content_height_px': 666,
        'content_width_px':  431,
        'width_in':     5.83,
        'height_in':    8.27,
        'margin_in':    0.67,
        'lines_per_page': 37,
    },
    'legal': {
        'name':         'Legal',
        'display':      'Legal (8.5" × 14")',
        'width_px':     816,
        'height_px':    1344,
        'margin_px':    96,
        'content_height_px': 1152,
        'content_width_px':  624,
        'width_in':     8.5,
        'height_in':    14.0,
        'margin_in':    1.0,
        'lines_per_page': 64,
    },
    'executive': {
        'name':         'Executive',
        'display':      'Executive (7.25" × 10.5")',
        'width_px':     696,
        'height_px':    1008,
        'margin_px':    80,
        'content_height_px': 848,
        'content_width_px':  536,
        'width_in':     7.25,
        'height_in':    10.5,
        'margin_in':    0.83,
        'lines_per_page': 47,
    },
    # 'plain' → alias for 'letter' (backward compat with old notes)
    'plain': {
        'name':         'Plain',
        'display':      'Plain (8.5" × 11")',
        'width_px':     816,
        'height_px':    1056,
        'margin_px':    96,
        'content_height_px': 864,
        'content_width_px':  624,
        'width_in':     8.5,
        'height_in':    11.0,
        'margin_in':    1.0,
        'lines_per_page': 48,
    },
}

VALID_PAPER_SIZES = set(PAPER_REGISTRY.keys())

# JS page-break serialization marker (must match serialize()/deserialize() in JS)
PAGE_BREAK_MARKER = '<div class="page-break-marker" style="page-break-after:always;"></div>'

# Content limits (match unified_flow_backend.py MAX_CONTENT_SIZE)
MAX_NOTE_SIZE_BYTES = 10_000_000   # 10MB
MAX_TITLE_LENGTH    = 200          # matches Note.title Column(String(200))
MAX_CATEGORY_LENGTH = 50           # matches Note.category Column(String(50))

# Approximate line height in px for content area calculations
_LINE_HEIGHT_PX = 18


def _now_utc() -> datetime:
    """Timezone-aware UTC now (replaces deprecated datetime.utcnow())"""
    return datetime.now(timezone.utc)


# ===================================================================
# 🔐 USER SESSION MODEL
# ===================================================================

class UserSession(db.Model):
    __tablename__ = 'user_session'

    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    session_token  = db.Column(db.String(120), unique=True, nullable=False)
    device         = db.Column(db.String(120))
    ip_address     = db.Column(db.String(50))
    location       = db.Column(db.String(150))
    created_at     = db.Column(db.DateTime(timezone=True), default=_now_utc)
    last_activity  = db.Column(db.DateTime(timezone=True), default=_now_utc)
    is_active      = db.Column(db.Boolean, default=True)

    user = db.relationship('User', backref='sessions')

    def touch(self):
        """Update last_activity to now"""
        self.last_activity = _now_utc()

    def __repr__(self):
        return f'<UserSession user={self.user_id} active={self.is_active}>'


# ===================================================================
# 👤 USER MODEL
# ===================================================================

class User(db.Model, UserMixin):
    __tablename__ = 'user'

    id           = db.Column(db.Integer, primary_key=True)
    username     = db.Column(db.String(80),  unique=True, nullable=False, index=True)
    email        = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)

    # Profile
    first_name   = db.Column(db.String(50),  nullable=True)
    last_name    = db.Column(db.String(50),  nullable=True)
    bio          = db.Column(db.String(150),  nullable=True)
    mobile_number = db.Column(db.String(20), nullable=True)
    profile_picture_url = db.Column(db.String(255), nullable=True)

    # Email Verification
    is_verified  = db.Column(db.Boolean, default=False, nullable=False)
    otp_code     = db.Column(db.String(6),  nullable=True)
    otp_expiry   = db.Column(db.DateTime(timezone=True), nullable=True)

    # Premium
    is_premium   = db.Column(db.Boolean, default=False)
    premium_expiry = db.Column(db.DateTime(timezone=True), nullable=True)

    created_at   = db.Column(db.DateTime(timezone=True), default=_now_utc)

    notes = db.relationship(
        'Note',
        backref='author',
        lazy='dynamic',
        cascade='all, delete-orphan'
    )

    # ── Auth ──────────────────────────────────────────────────────

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    # ── Premium ───────────────────────────────────────────────────

    def is_premium_active(self) -> bool:
        if not self.is_premium or not self.premium_expiry:
            return False
        expiry = self.premium_expiry
        # DB se naive datetime aaye toh UTC assume karke aware banao
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        return expiry > _now_utc()

    # ── Storage ───────────────────────────────────────────────────

    def get_max_storage(self) -> int:
        """Bytes: Premium=500MB, Free=50MB"""
        return 500 * 1024 * 1024 if self.is_premium_active() else 50 * 1024 * 1024

    def get_max_storage_mb(self) -> float:
        return round(self.get_max_storage() / (1024 * 1024), 2)

    def get_storage_used(self) -> int:
        """Total bytes across all notes (content + title)"""
        total = 0
        for note in self.notes:
            total += len((note.content or '').encode('utf-8'))
            total += len((note.title or '').encode('utf-8'))
        return total

    def get_storage_used_mb(self) -> float:
        return round(self.get_storage_used() / (1024 * 1024), 2)

    def is_storage_available(self, additional_bytes: int = 0) -> bool:
        return (self.get_storage_used() + additional_bytes) <= self.get_max_storage()

    # ── Note Counts ───────────────────────────────────────────────

    def get_notes_count(self) -> int:
        return self.notes.count()

    def get_favorite_notes_count(self) -> int:
        return self.notes.filter_by(is_favorite=True).count()

    def get_private_notes_count(self) -> int:
        return self.notes.filter_by(is_private=True).count()

    def __repr__(self):
        return f'<User {self.username}>'


# ===================================================================
# 🔐 COLLABORATOR MODEL
# ===================================================================

class Collaborator(db.Model):
    """
    Permission levels:
    - 'admin'   : Full access (edit, delete, manage collaborators)
    - 'edit'    : Can edit notes
    - 'comment' : Can add comments
    - 'view'    : View only (restricted to specific page)
    """
    __tablename__ = 'collaborator'

    id                  = db.Column(db.Integer, primary_key=True)
    note_id             = db.Column(db.Integer, db.ForeignKey('note.id'), nullable=False, index=True)
    collaborator_email  = db.Column(db.String(120), nullable=False, index=True)
    collaborator_id     = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True, index=True)
    permission          = db.Column(db.String(20), default='view', nullable=False, index=True)
    restricted_page     = db.Column(db.String(255), nullable=True)
    invited_at          = db.Column(db.DateTime(timezone=True), default=_now_utc, index=True)
    accepted_at         = db.Column(db.DateTime(timezone=True), nullable=True)
    status              = db.Column(db.String(20), default='pending', nullable=False, index=True)

    note         = db.relationship('Note', backref=db.backref('collaborators', cascade='all, delete-orphan'))
    collaborator = db.relationship('User', backref=db.backref('collaborations', cascade='all, delete-orphan'))

    _PERMISSION_LEVELS = {'view': 0, 'comment': 1, 'edit': 2, 'admin': 3}

    # ── Permission checks ─────────────────────────────────────────

    def get_permission_level(self) -> int:
        return self._PERMISSION_LEVELS.get(self.permission, 0)

    def has_permission(self, required: str) -> bool:
        if self.status != 'accepted':
            return False
        return self.get_permission_level() >= self._PERMISSION_LEVELS.get(required, 0)

    def can_edit(self) -> bool:
        return self.has_permission('edit')

    def can_comment(self) -> bool:
        return self.has_permission('comment')

    def can_delete(self) -> bool:
        return self.permission == 'admin' and self.status == 'accepted'

    def can_manage_collaborators(self) -> bool:
        return self.permission == 'admin' and self.status == 'accepted'

    def can_access_page(self, page_url: str) -> bool:
        if self.status != 'accepted':
            return False
        if self.permission in ['admin', 'edit', 'comment']:
            return True
        return self.permission == 'view' and page_url == self.restricted_page

    def is_expired(self) -> bool:
        from datetime import timedelta
        return _now_utc() > (self.invited_at + timedelta(days=7)) and self.status == 'pending'

    def get_accessible_routes(self) -> list:
        if self.status != 'accepted':
            return []
        routes = [f'/edit_note/{self.note_id}']
        if self.has_permission('comment'):
            routes.extend(['/dashboard', f'/note/{self.note_id}/comments'])
        if self.has_permission('edit'):
            routes.extend(['/profile', f'/download/pdf/{self.note_id}', f'/download/doc/{self.note_id}'])
        if self.permission == 'admin':
            routes.extend(['/settings', f'/api/remove-collaborator/{self.note_id}'])
        return routes

    # ── Serialization ─────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            'id':              self.id,
            'email':           self.collaborator_email,
            'permission':      self.permission,
            'status':          self.status,
            'invited_at':      self.invited_at.isoformat(),
            'accepted_at':     self.accepted_at.isoformat() if self.accepted_at else None,
            'restricted_page': self.restricted_page,
            'user_id':         self.collaborator_id,
        }

    def to_dict_detailed(self) -> dict:
        d = self.to_dict()
        d.update({
            'can_edit':              self.can_edit(),
            'can_comment':           self.can_comment(),
            'can_delete':            self.can_delete(),
            'can_manage':            self.can_manage_collaborators(),
            'permission_level':      self.get_permission_level(),
            'accessible_routes':     self.get_accessible_routes(),
        })
        return d

    def __repr__(self):
        return f'<Collaborator {self.collaborator_email} - {self.permission}>'


# ===================================================================
# 📝 NOTE MODEL
# ===================================================================

class Note(db.Model):
    __tablename__ = 'note'

    id           = db.Column(db.Integer, primary_key=True)
    title        = db.Column(db.String(200), nullable=False, index=True)
    content      = db.Column(db.Text, nullable=False)

    is_favorite  = db.Column(db.Boolean, default=False, index=True)
    is_private   = db.Column(db.Boolean, default=False, index=True)
    private_password_hash = db.Column(db.String(256), nullable=True)

    category     = db.Column(db.String(50), default='General', index=True)

    # ⭐ Paper size — synced with JS PaperRegistry + CSS paper classes
    # Valid values: 'plain', 'letter', 'a4', 'a3', 'a5', 'legal', 'executive'
    paper_size   = db.Column(db.String(20), default='a4', nullable=False, index=True)

    created_at   = db.Column(db.DateTime(timezone=True), default=_now_utc, index=True)
    updated_at   = db.Column(db.DateTime(timezone=True), default=_now_utc, onupdate=_now_utc, index=True)

    user_id      = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)

    # ⭐ Unified Flow Metadata — synced with WordFlowEngine stats
    word_count       = db.Column(db.Integer, default=0)
    char_count       = db.Column(db.Integer, default=0)
    estimated_pages  = db.Column(db.Integer, default=1)
    page_break_count = db.Column(db.Integer, default=0)   # ← NEW: actual page breaks in content
    content_hash     = db.Column(db.String(64), nullable=True)  # ← NEW: for change detection
    last_validation  = db.Column(db.DateTime(timezone=True), nullable=True)
    content_version  = db.Column(db.Integer, default=1)

    # ── Private Note ──────────────────────────────────────────────

    def set_private_password(self, password: str):
        self.private_password_hash = generate_password_hash(password)

    def check_private_password(self, password: str) -> bool:
        if not self.private_password_hash:
            return False
        return check_password_hash(self.private_password_hash, password)

    # ── Paper Config ──────────────────────────────────────────────

    def get_paper_config(self) -> dict:
        """
        Returns pixel-accurate paper config matching CSS + JS PaperRegistry.

        Matches CSS values:
          .paper-a4    .editor-page  { width: 794px;  height: 1123px; }
          .paper-a4    .page-content { top:96px; bottom:96px; left:96px; right:96px; }
        etc.
        """
        return PAPER_REGISTRY.get(self.paper_size, PAPER_REGISTRY['a4'])

    @staticmethod
    def get_all_paper_configs() -> dict:
        """Returns full registry — use for API endpoint /api/editor/paper-size-info"""
        return PAPER_REGISTRY

    # ── Content Stats ─────────────────────────────────────────────

    def update_content_stats(self) -> bool:
        """
        Update word_count, char_count, estimated_pages, page_break_count.

        ✅ FIX vs v1.0:
        - Uses per-paper lines_per_page from PAPER_REGISTRY (not hardcoded 55)
        - Counts actual JS page-break markers for page_break_count
        - Uses content_height_px for more accurate page estimation
        - Avoids BeautifulSoup import at module level (lazy import)
        """
        from bs4 import BeautifulSoup
        import hashlib

        try:
            content = self.content or ''

            # Count actual page breaks (JS serialize() inserts these)
            self.page_break_count = content.count('page-break-marker')

            # Parse HTML → plain text for stats
            soup = BeautifulSoup(content, 'html.parser')

            # ✅ HINDI FIX: preserve lang/dir attributes like JS HTMLSanitizer does
            # Just extract text; BeautifulSoup handles Unicode correctly
            text = soup.get_text(separator=' ', strip=True)

            self.char_count = len(text)
            self.word_count = len(text.split()) if text.strip() else 0

            # ✅ FIX: Use paper-specific lines_per_page
            paper_cfg    = self.get_paper_config()
            lines_pp     = paper_cfg.get('lines_per_page', 48)
            content_w_px = paper_cfg.get('content_width_px', 624)

            # Approximate chars per line based on content width
            # Assuming ~1 char ≈ 7.5px average for standard fonts at 12pt
            chars_per_line = max(40, int(content_w_px / 7.5))
            total_lines    = max(1, self.char_count // chars_per_line)

            pages_from_text = max(1, (total_lines + lines_pp - 1) // lines_pp)

            # If content has explicit page breaks, use whichever is larger
            self.estimated_pages = max(
                pages_from_text,
                self.page_break_count + 1  # page breaks + 1
            )

            # Content hash for change detection (first 10KB is enough)
            self.content_hash = hashlib.sha256(
                content[:10000].encode('utf-8', errors='replace')
            ).hexdigest()

            self.last_validation = _now_utc()
            return True

        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"update_content_stats error: {e}")
            return False

    def get_content_size_bytes(self) -> int:
        return len((self.content or '').encode('utf-8'))

    def get_content_size_mb(self) -> float:
        return round(self.get_content_size_bytes() / (1024 * 1024), 2)

    def is_content_changed(self, new_content: str) -> bool:
        """Quick change detection using stored hash"""
        import hashlib
        if not self.content_hash:
            return True
        new_hash = hashlib.sha256(
            new_content[:10000].encode('utf-8', errors='replace')
        ).hexdigest()
        return self.content_hash != new_hash

    # ── Validation ────────────────────────────────────────────────

    def validate_for_unified_flow(self) -> Tuple[bool, str, dict]:
        """
        Validate before save. Matches unified_flow_backend.py validate_content().

        ✅ FIX vs v1.0:
        - Checks all paper sizes from PAPER_REGISTRY (not hardcoded list)
        - Uses MAX_NOTE_SIZE_BYTES (10MB) matching backend
        - Title max 200 chars (matches Column(String(200)))
        """
        content_size = self.get_content_size_bytes()

        if content_size > MAX_NOTE_SIZE_BYTES:
            return False, f"Content size {content_size:,} bytes exceeds {MAX_NOTE_SIZE_BYTES:,} limit", {
                'current_size': content_size,
                'max_size':     MAX_NOTE_SIZE_BYTES
            }

        if not self.title or not self.title.strip():
            return False, "Title is required", {}

        if len(self.title) > MAX_TITLE_LENGTH:
            return False, f"Title must be {MAX_TITLE_LENGTH} characters or less", {
                'current_length': len(self.title),
                'max_length':     MAX_TITLE_LENGTH
            }

        if not self.content or not self.content.strip():
            return False, "Content is required", {}

        if self.paper_size not in VALID_PAPER_SIZES:
            return False, f"Invalid paper size '{self.paper_size}'", {
                'current_size': self.paper_size,
                'valid_sizes':  sorted(VALID_PAPER_SIZES)
            }

        return True, "Validation passed", {
            'size_bytes':      content_size,
            'word_count':      self.word_count,
            'char_count':      self.char_count,
            'pages':           self.estimated_pages,
            'page_breaks':     self.page_break_count,
        }

    # ── Formatting ────────────────────────────────────────────────


# ── Formatting ────────────────────────────────────────────────

    def get_formatted_date(self, timezone_str: str = 'Asia/Kolkata') -> str:
        try:
            tz  = pytz.timezone(timezone_str)
            dt  = self.updated_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(tz).strftime('%d %b %Y, %I:%M %p')
        except Exception:
            return (self.updated_at or _now_utc()).strftime('%d %b %Y')

    def get_preview(self, max_length: int = 150) -> str:
        """
        Plain-text preview for dashboard cards.
        ✅ HINDI FIX: uses separator=' ' so Devanagari words don't merge.
        """
        from bs4 import BeautifulSoup
        import re
        try:
            soup = BeautifulSoup(self.content or '', 'html.parser')
            text = soup.get_text(separator=' ', strip=True)
            text = re.sub(r'\s+', ' ', text).strip()
            if len(text) > max_length:
                text = text[:max_length].rsplit(' ', 1)[0] + '...'
            return text or "Empty note"
        except Exception:
            return "Preview unavailable"

    # ── Collaborator helpers ───────────────────────────────────────

    def get_collaborators(self) -> list:
        return Collaborator.query.filter_by(note_id=self.id, status='accepted').all()

    def has_collaborator(self, user_id: int) -> bool:
        return Collaborator.query.filter_by(
            note_id=self.id, collaborator_id=user_id, status='accepted'
        ).first() is not None

    def get_collaborator_permission(self, user_id: int) -> Optional[str]:
        collab = Collaborator.query.filter_by(
            note_id=self.id, collaborator_id=user_id, status='accepted'
        ).first()
        return collab.permission if collab else None

    def can_be_accessed_by(self, user_id: int) -> bool:
        return self.user_id == user_id or self.has_collaborator(user_id)

    def get_all_collaborators_dict(self) -> list:
        return [c.to_dict_detailed() for c in self.get_collaborators()]

    # ── Serialization ─────────────────────────────────────────────

    def to_dict(self, include_content: bool = True) -> dict:
        """
        JSON-safe dict. include_content=False for list views (saves bandwidth).
        Matches JS auto-save draft format: {title, category, content, timestamp}
        """
        d: Dict[str, Any] = {
            'id':              self.id,
            'title':           self.title,
            'category':        self.category,
            'paper_size':      self.paper_size,
            'is_favorite':     self.is_favorite,
            'is_private':      self.is_private,
            'word_count':      self.word_count,
            'char_count':      self.char_count,
            'estimated_pages': self.estimated_pages,
            'page_break_count': self.page_break_count,
            'content_size_mb': self.get_content_size_mb(),
            'created_at':      self.created_at.isoformat() if self.created_at else None,
            'updated_at':      self.updated_at.isoformat() if self.updated_at else None,
            'paper_config':    self.get_paper_config(),
        }
        if include_content:
            d['content'] = self.content
        return d

    def __repr__(self):
        return f'<Note id={self.id} title="{self.title[:30]}" pages={self.estimated_pages}>'

# ============================================================
# Review Model
# ============================================================
class Review(db.Model):
    __tablename__ = 'review'

    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    name        = db.Column(db.String(60),  nullable=False)
    rating      = db.Column(db.Integer,     nullable=False)   # 1–5
    title       = db.Column(db.String(100), nullable=False)
    body        = db.Column(db.Text,        nullable=False)
    plan        = db.Column(db.String(20),  nullable=True)    # 'free' | 'premium'
    helpful     = db.Column(db.Integer,     default=0)
    is_approved = db.Column(db.Boolean,     default=True)
    created_at  = db.Column(db.DateTime(timezone=True), default=_now_utc)

    user = db.relationship('User', backref=db.backref('reviews', lazy=True), foreign_keys=[user_id])

    def to_dict(self):
        return {
            'id':         self.id,
            'name':       self.name,
            'rating':     self.rating,
            'title':      self.title,
            'body':       self.body,
            'plan':       self.plan or 'free',
            'helpful':    self.helpful,
            'created_at': self.created_at.strftime('%d %b %Y') if self.created_at else '',
        }

    def __repr__(self):
        return f'<Review id={self.id} rating={self.rating} by="{self.name}">'

# ===================================================================
# 🎫 SUPPORT TICKET MODEL
# ===================================================================

class SupportTicket(db.Model):
    """
    Stores user support requests submitted via /support page.

    Status flow:
        open  ->  in_progress  ->  resolved  ->  closed

    ticket_ref: unique human-readable ID like 'NSP-A3F9C1'
    admin_reply: plain text reply sent back to user via email
    """
    __tablename__ = 'support_ticket'

    id          = db.Column(db.Integer, primary_key=True)
    ticket_ref  = db.Column(db.String(20), unique=True, nullable=False, index=True)

    # Link to user
    user_id     = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    user = db.relationship('User', backref=db.backref('tickets', lazy='dynamic'))

    # Ticket content
    category    = db.Column(db.String(50),  nullable=False)
    subject     = db.Column(db.String(200), nullable=False)
    message     = db.Column(db.Text,        nullable=False)

    # Status: open | in_progress | resolved | closed
    status      = db.Column(db.String(20), default='open', nullable=False, index=True)

    # Admin reply
    admin_reply    = db.Column(db.Text,        nullable=True)
    admin_reply_at = db.Column(db.DateTime(timezone=True), nullable=True)
    replied_by     = db.Column(db.String(120), nullable=True)

    # Timestamps
    created_at  = db.Column(db.DateTime(timezone=True), default=_now_utc, index=True)
    updated_at  = db.Column(db.DateTime(timezone=True), default=_now_utc, onupdate=_now_utc)

    def is_replied(self):
        return bool(self.admin_reply)

    def get_status_label(self):
        return self.status.replace('_', ' ').title()

    def get_created_ist(self):
        try:
            tz = pytz.timezone('Asia/Kolkata')
            dt = self.created_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(tz).strftime('%d %b %Y, %I:%M %p')
        except Exception:
            return self.created_at.strftime('%d %b %Y') if self.created_at else '---'

    def get_replied_ist(self):
        if not self.admin_reply_at:
            return None
        try:
            tz = pytz.timezone('Asia/Kolkata')
            dt = self.admin_reply_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(tz).strftime('%d %b %Y, %I:%M %p')
        except Exception:
            return self.admin_reply_at.strftime('%d %b %Y')

    def to_dict(self):
        return {
            'id':             self.id,
            'ticket_ref':     self.ticket_ref,
            'user_id':        self.user_id,
            'username':       self.user.username if self.user else '---',
            'email':          self.user.email    if self.user else '---',
            'category':       self.category,
            'subject':        self.subject,
            'message':        self.message,
            'status':         self.status,
            'status_label':   self.get_status_label(),
            'is_replied':     self.is_replied(),
            'admin_reply':    self.admin_reply,
            'admin_reply_at': self.get_replied_ist(),
            'replied_by':     self.replied_by,
            'created_at':     self.get_created_ist(),
            'updated_at':     self.updated_at.strftime('%d %b %Y, %I:%M %p') if self.updated_at else None,
        }

    def __repr__(self):
        return f'<SupportTicket {self.ticket_ref} status={self.status} user={self.user_id}>'

# ===================================================================
# 🗑️ DELETED ACCOUNT TRACKER
# Tracks emails and mobile numbers of deleted accounts
# so they cannot re-register with same credentials
# ===================================================================

class DeletedAccount(db.Model):
    __tablename__ = 'deleted_account'

    id           = db.Column(db.Integer, primary_key=True)
    email        = db.Column(db.String(120), nullable=False, index=True)
    mobile_number = db.Column(db.String(20), nullable=True, index=True)
    username     = db.Column(db.String(80), nullable=True)
    deleted_at   = db.Column(db.DateTime(timezone=True), default=_now_utc)

    COOLDOWN_DAYS = 7

    def is_cooldown_active(self):
        """Returns True agar abhi bhi 7-day cooldown chal raha hai."""
        if not self.deleted_at:
            return True
        from datetime import timezone
        deleted = self.deleted_at
        # deleted_at naive ho ya aware — dono handle karo
        if deleted.tzinfo is None:
            deleted = deleted.replace(tzinfo=timezone.utc)
        now = datetime.now(tz=timezone.utc)
        return (now - deleted).days < self.COOLDOWN_DAYS

    def cooldown_remaining_days(self):
        """Kitne din baaki hain cooldown mein."""
        if not self.deleted_at:
            return self.COOLDOWN_DAYS
        from datetime import timezone
        deleted = self.deleted_at
        if deleted.tzinfo is None:
            deleted = deleted.replace(tzinfo=timezone.utc)
        now = datetime.now(tz=timezone.utc)
        return max(0, self.COOLDOWN_DAYS - (now - deleted).days)

    def __repr__(self):
        return f'<DeletedAccount {self.email}>'