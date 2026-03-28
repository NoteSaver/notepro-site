# extensions.py

from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_wtf import CSRFProtect

# database
db = SQLAlchemy()

# login manager
login_manager = LoginManager()
login_manager.login_view = "login"

# CSRF protection
csrf = CSRFProtect()
