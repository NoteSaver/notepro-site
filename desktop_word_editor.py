"""
🔥 COMPLETE FLASK + PyQt5 INTEGRATION
====================================
Ye code aapke existing Flask Word Editor ko PyQt5 desktop app mein convert karega

FEATURES:
- Flask backend running in background
- PyQt5 frontend with embedded browser
- Auto-save functionality
- Dark mode support
- Multi-page editor
- Full HTML/CSS/JS support from your existing code

INSTALLATION:
pip install PyQt5 PyQtWebEngine Flask flask-login flask-wtf

RUN:
python desktop_word_editor.py
"""

import sys
import os
import threading
import webbrowser
from pathlib import Path

from PyQt5.QtWidgets import (QApplication, QMainWindow, QVBoxLayout, 
                            QHBoxLayout, QWidget, QPushButton, QLabel,
                            QToolBar, QAction, QMenuBar, QMenu, QMessageBox,
                            QFileDialog, QStatusBar, QSystemTrayIcon)
from PyQt5.QtCore import QUrl, Qt, QTimer, pyqtSignal, QThread
from PyQt5.QtGui import QIcon, QFont
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEnginePage

# Flask imports (aapke existing code se)
from flask import Flask
from werkzeug.serving import make_server


class FlaskThread(QThread):
    """Flask server ko background thread mein run karega"""
    
    def __init__(self, app, host='127.0.0.1', port=5000):
        super().__init__()
        self.app = app
        self.host = host
        self.port = port
        self.server = None
        
    def run(self):
        """Start Flask server"""
        self.server = make_server(self.host, self.port, self.app, threaded=True)
        print(f"✅ Flask server started on http://{self.host}:{self.port}")
        self.server.serve_forever()
        
    def stop(self):
        """Stop Flask server"""
        if self.server:
            self.server.shutdown()
            print("🛑 Flask server stopped")


class CustomWebPage(QWebEnginePage):
    """Custom web page for better control"""
    
    def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):
        """Log JavaScript console messages"""
        print(f"JS Console [{level}]: {message} (Line {lineNumber})")


class DesktopWordEditor(QMainWindow):
    """Main Desktop Word Editor Window"""
    
    def __init__(self, flask_app):
        super().__init__()
        
        self.flask_app = flask_app
        self.flask_thread = None
        self.base_url = "http://127.0.0.1:5000"
        
        self.init_ui()
        self.start_flask_server()
        
    def init_ui(self):
        """Initialize UI"""
        self.setWindowTitle("NoteSaver Pro - Desktop Edition")
        self.setGeometry(100, 100, 1400, 900)
        
        # Central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Create menu bar
        self.create_menu_bar()
        
        # Web view (embedded browser) - CREATE BEFORE TOOLBAR
        self.web_view = QWebEngineView()
        self.web_page = CustomWebPage()
        self.web_view.setPage(self.web_page)
        
        # Enable developer tools
        self.web_view.settings().setAttribute(
            self.web_view.settings().LocalStorageEnabled, True
        )
        
        # Create toolbar (AFTER web_view is initialized)
        self.create_toolbar()
        
        layout.addWidget(self.web_view)
        
        # Status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Ready")
        
        # System tray icon (optional)
        self.create_tray_icon()
        
    def create_menu_bar(self):
        """Create menu bar"""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu('File')
        
        new_action = QAction('New Note', self)
        new_action.setShortcut('Ctrl+N')
        new_action.triggered.connect(self.new_note)
        file_menu.addAction(new_action)
        
        open_action = QAction('Open Dashboard', self)
        open_action.setShortcut('Ctrl+D')
        open_action.triggered.connect(self.open_dashboard)
        file_menu.addAction(open_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction('Exit', self)
        exit_action.setShortcut('Ctrl+Q')
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # View menu
        view_menu = menubar.addMenu('View')
        
        reload_action = QAction('Reload', self)
        reload_action.setShortcut('F5')
        reload_action.triggered.connect(self.reload_page)
        view_menu.addAction(reload_action)
        
        fullscreen_action = QAction('Toggle Fullscreen', self)
        fullscreen_action.setShortcut('F11')
        fullscreen_action.triggered.connect(self.toggle_fullscreen)
        view_menu.addAction(fullscreen_action)
        
        # Help menu
        help_menu = menubar.addMenu('Help')
        
        about_action = QAction('About', self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
        
    def create_toolbar(self):
        """Create toolbar"""
        toolbar = QToolBar("Main Toolbar")
        toolbar.setMovable(False)
        self.addToolBar(toolbar)
        
        # Back button
        back_btn = QPushButton("⬅ Back")
        back_btn.clicked.connect(self.web_view.back)
        toolbar.addWidget(back_btn)
        
        # Forward button
        forward_btn = QPushButton("➡ Forward")
        forward_btn.clicked.connect(self.web_view.forward)
        toolbar.addWidget(forward_btn)
        
        # Reload button
        reload_btn = QPushButton("🔄 Reload")
        reload_btn.clicked.connect(self.reload_page)
        toolbar.addWidget(reload_btn)
        
        toolbar.addSeparator()
        
        # Dashboard button
        dashboard_btn = QPushButton("📊 Dashboard")
        dashboard_btn.clicked.connect(self.open_dashboard)
        toolbar.addWidget(dashboard_btn)
        
        # New note button
        new_note_btn = QPushButton("📝 New Note")
        new_note_btn.clicked.connect(self.new_note)
        toolbar.addWidget(new_note_btn)
        
        toolbar.addSeparator()
        
        # URL label
        self.url_label = QLabel("")
        self.url_label.setStyleSheet("padding: 5px; color: #666;")
        toolbar.addWidget(self.url_label)
        
        # Update URL label when page changes
        self.web_view.urlChanged.connect(
            lambda url: self.url_label.setText(f"📍 {url.toString()}")
        )
        
    def create_tray_icon(self):
        """Create system tray icon (optional)"""
        try:
            self.tray_icon = QSystemTrayIcon(self)
            # Set icon if available
            # self.tray_icon.setIcon(QIcon('path/to/icon.png'))
            self.tray_icon.setToolTip('NoteSaver Pro')
            
            # Tray menu
            tray_menu = QMenu()
            show_action = tray_menu.addAction("Show")
            show_action.triggered.connect(self.show)
            quit_action = tray_menu.addAction("Quit")
            quit_action.triggered.connect(self.close)
            
            self.tray_icon.setContextMenu(tray_menu)
            self.tray_icon.show()
        except Exception as e:
            print(f"⚠️ Tray icon not created: {e}")
        
    def start_flask_server(self):
        """Start Flask server in background thread"""
        self.flask_thread = FlaskThread(self.flask_app)
        self.flask_thread.start()
        
        # Wait for server to start, then load page
        QTimer.singleShot(2000, self.load_home_page)
        
    def load_home_page(self):
        """Load Flask home page"""
        self.web_view.setUrl(QUrl(f"{self.base_url}/"))
        self.status_bar.showMessage("✅ Connected to local server")
        
    def open_dashboard(self):
        """Open dashboard"""
        self.web_view.setUrl(QUrl(f"{self.base_url}/dashboard"))
        
    def new_note(self):
        """Create new note"""
        self.web_view.setUrl(QUrl(f"{self.base_url}/create_note"))
        
    def reload_page(self):
        """Reload current page"""
        self.web_view.reload()
        self.status_bar.showMessage("🔄 Page reloaded", 2000)
        
    def toggle_fullscreen(self):
        """Toggle fullscreen mode"""
        if self.isFullScreen():
            self.showNormal()
        else:
            self.showFullScreen()
            
    def show_about(self):
        """Show about dialog"""
        QMessageBox.about(
            self,
            "About NoteSaver Pro",
            """
            <h3>NoteSaver Pro - Desktop Edition</h3>
            <p>Professional multi-page word editor with Flask backend</p>
            <p><b>Version:</b> 1.0.0</p>
            <p><b>Features:</b></p>
            <ul>
                <li>Multi-page document editing</li>
                <li>Auto-save functionality</li>
                <li>Rich text formatting</li>
                <li>Dark mode support</li>
                <li>PDF/DOCX export</li>
            </ul>
            """
        )
        
    def closeEvent(self, event):
        """Handle window close event"""
        reply = QMessageBox.question(
            self,
            'Confirm Exit',
            'Are you sure you want to quit?',
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            # Stop Flask server
            if self.flask_thread:
                self.flask_thread.stop()
                self.flask_thread.wait()
            
            event.accept()
        else:
            event.ignore()


def create_flask_app():
    """
    Create Flask app instance
    IMPORTANT: Yahan aapki existing Flask app.py ka code aayega
    """
    # Import your existing Flask app
    try:
        # Option 1: Direct import (if app.py is in same folder)
        from app import app
        return app
    except ImportError:
        # Option 2: Create minimal Flask app for testing
        app = Flask(__name__)
        app.config['SECRET_KEY'] = 'your-secret-key'
        
        @app.route('/')
        def index():
            return """
            <html>
                <head>
                    <title>NoteSaver Pro</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            max-width: 800px;
                            margin: 50px auto;
                            padding: 20px;
                        }
                        h1 { color: #333; }
                        .btn {
                            display: inline-block;
                            padding: 10px 20px;
                            background: #007bff;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                            margin: 10px;
                        }
                    </style>
                </head>
                <body>
                    <h1>📝 NoteSaver Pro - Desktop Edition</h1>
                    <p>Welcome to your desktop word editor!</p>
                    <a href="/dashboard" class="btn">Dashboard</a>
                    <a href="/create_note" class="btn">New Note</a>
                </body>
            </html>
            """
        
        @app.route('/dashboard')
        def dashboard():
            return "<h1>Dashboard</h1><p>Your notes will appear here</p>"
        
        @app.route('/create_note')
        def create_note():
            return "<h1>Create Note</h1><p>Note editor will appear here</p>"
        
        return app


def main():
    """Main application entry point"""
    print("🚀 Starting NoteSaver Pro Desktop Edition...")
    
    # Create Flask app
    flask_app = create_flask_app()
    
    # Create Qt Application
    app = QApplication(sys.argv)
    app.setApplicationName("NoteSaver Pro")
    app.setOrganizationName("NoteSaver")
    
    # Set application style
    app.setStyle("Fusion")
    
    # Create and show main window
    window = DesktopWordEditor(flask_app)
    window.show()
    
    print("✅ NoteSaver Pro Desktop Edition started successfully!")
    print("📌 Window opened - Flask server running in background")
    
    # Run Qt application
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()