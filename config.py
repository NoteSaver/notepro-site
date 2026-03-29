import os
from dotenv import load_dotenv

load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))


def _require_env(key: str) -> str:
    val = os.environ.get(key, '').strip()
    if not val:
        raise RuntimeError(
            f"\n\n❌  MISSING REQUIRED ENVIRONMENT VARIABLE: '{key}'\n"
            f"    .env file mein '{key}=' set karo.\n"
            f"    App tab tak start nahi hogi.\n"
        )
    return val


class Config:
    # ──────────────────────────────────────────────────────────
    # 🔐 SECRET KEY
    # ──────────────────────────────────────────────────────────
    SECRET_KEY = _require_env('SECRET_KEY')

    # ──────────────────────────────────────────────────────────
    # 🗄️  DATABASE
    # ──────────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:////tmp/notes.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ──────────────────────────────────────────────────────────
    # 🛡️  SECURITY
    # ──────────────────────────────────────────────────────────
    WTF_CSRF_ENABLED = True
    RATELIMIT_HEADERS_ENABLED = True

    # ──────────────────────────────────────────────────────────
    # 📧  EMAIL  (SendGrid via Flask-Mail)
    #
    # SendGrid setup:
    #   MAIL_SERVER  = smtp.sendgrid.net
    #   MAIL_PORT    = 587
    #   MAIL_USE_TLS = True
    #   MAIL_USERNAME = apikey        ← hamesha 'apikey' hi likhna hai
    #   MAIL_PASSWORD = SENDGRID_API_KEY  ← Render Environment mein set karo
    #
    # Render Dashboard mein 2 variables add karo:
    #   SENDGRID_API_KEY = SG.xxxxxxxx...
    #   MAIL_DEFAULT_SENDER = noteprosupport@gmail.com
    # ──────────────────────────────────────────────────────────
    MAIL_SERVER  = os.environ.get('MAIL_SERVER',  'smtp.sendgrid.net')
    MAIL_PORT    = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower()  == 'true'
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', 'False').lower() == 'true'
    MAIL_TIMEOUT = int(os.environ.get('MAIL_TIMEOUT', 10))

    # SendGrid ke liye USERNAME hamesha 'apikey' string hoti hai
    MAIL_USERNAME       = 'apikey'
    # Actual API Key Render ke SENDGRID_API_KEY env variable se aayegi
    MAIL_PASSWORD       = _require_env('SENDGRID_API_KEY')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'noteprosupport@gmail.com')

    # ──────────────────────────────────────────────────────────
    # ⚡ RATE LIMITING
    # ──────────────────────────────────────────────────────────
    RATE_LIMIT_IP_WHITELIST = []
    ADMIN_RATE_LIMIT_ENFORCED_ENDPOINTS = [
        'login', 'register', 'verify_note_password',
        'forgot_password', 'reset_password', 'api_reset_note_password'
    ]
