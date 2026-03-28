// ========================================
// SETTINGS.JS - ENHANCED SECURITY & FEATURES
// ========================================

(function() {
    'use strict';
    
    // ========================================
    // SECURITY CONFIGURATION
    // ========================================
    const SECURITY_CONFIG = {
        MAX_PASSWORD_LENGTH: 128,
        MIN_PASSWORD_LENGTH: 8,
        MAX_LOGIN_ATTEMPTS: 3,
        SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
        RATE_LIMIT_DELAY: 2000, // 2 seconds between API calls
        XSS_PROTECTION: true,
        ALLOWED_ORIGINS: [window.location.origin]
    };

    // ========================================
    // RATE LIMITING
    // ========================================
    const rateLimiter = {
        lastCall: {},
        
        canMakeRequest: function(endpoint) {
            const now = Date.now();
            const lastCallTime = this.lastCall[endpoint] || 0;
            
            if (now - lastCallTime < SECURITY_CONFIG.RATE_LIMIT_DELAY) {
                console.warn(`Rate limit: Too many requests to ${endpoint}`);
                return false;
            }
            
            this.lastCall[endpoint] = now;
            return true;
        }
    };

    // ========================================
    // INPUT SANITIZATION
    // ========================================
    const sanitizer = {
        /**
         * Remove potentially dangerous HTML/script tags
         */
        sanitizeHTML: function(input) {
            if (!SECURITY_CONFIG.XSS_PROTECTION) return input;
            
            const div = document.createElement('div');
            div.textContent = input;
            return div.innerHTML;
        },
        
        /**
         * Validate and sanitize input length
         */
        validateLength: function(input, min, max) {
            if (typeof input !== 'string') return false;
            return input.length >= min && input.length <= max;
        },
        
        /**
         * Remove dangerous characters from input
         */
        sanitizeInput: function(input) {
            if (typeof input !== 'string') return '';
            // Remove null bytes and control characters
            return input.replace(/[\x00-\x1F\x7F]/g, '');
        }
    };

    // ========================================
    // SESSION MONITORING
    // ========================================
    const sessionMonitor = {
        lastActivityTime: Date.now(),
        inactivityTimer: null,
        
        init: function() {
            this.resetTimer();
            this.attachEventListeners();
        },
        
        resetTimer: function() {
            this.lastActivityTime = Date.now();
            
            if (this.inactivityTimer) {
                clearTimeout(this.inactivityTimer);
            }
            
            this.inactivityTimer = setTimeout(() => {
                this.handleInactivity();
            }, SECURITY_CONFIG.SESSION_TIMEOUT);
        },
        
        handleInactivity: function() {
            console.warn('Session timeout due to inactivity');
            showToast('warning', 'Your session is about to expire due to inactivity. Please refresh the page.');
            
            // Optional: Auto-logout after timeout
            // window.location.href = '/logout';
        },
        
        attachEventListeners: function() {
            const events = ['mousedown', 'keypress', 'scroll', 'touchstart'];
            events.forEach(event => {
                document.addEventListener(event, () => this.resetTimer(), { passive: true });
            });
        }
    };

    // ========================================
    // ELEMENT REFERENCES
    // ========================================
    const elements = {
        // Forms
        changePasswordForm: document.getElementById('changePasswordForm'),
        displaySettingsForm: document.getElementById('displaySettingsForm'),
        
        // Password fields
        currentPassword: document.getElementById('currentPassword'),
        newPassword: document.getElementById('newPassword'),
        confirmNewPassword: document.getElementById('confirmNewPassword'),
        
        // Password toggles
        toggleCurrentPassword: document.getElementById('toggleCurrentPassword'),
        toggleNewPassword: document.getElementById('toggleNewPassword'),
        toggleConfirmNewPassword: document.getElementById('toggleConfirmNewPassword'),
        
        // Password strength indicators
        newPasswordStrength: document.getElementById('newPasswordStrength'),
        strengthText: document.getElementById('strengthText'),
        passwordMatch: document.getElementById('passwordMatch'),
        passwordMismatch: document.getElementById('passwordMismatch'),
        
        // Buttons
        changePasswordBtn: document.getElementById('changePasswordBtn'),
        logoutAllOtherSessionsBtn: document.getElementById('logoutAllOtherSessionsBtn'),
        confirmDeleteAllNotesBtn: document.getElementById('confirmDeleteAllNotes'),
        
        // Other elements
        deleteNotesConfirmInput: document.getElementById('deleteAllNotesConfirmInput'),
        sessionsTableBody: document.getElementById('sessionsTableBody'),
        
        // Toast elements
        successToast: null,
        errorToast: null
    };
    
    // Initialize Bootstrap Toasts
    const successToastEl = document.getElementById('successToast');
    const errorToastEl = document.getElementById('errorToast');
    elements.successToast = successToastEl ? new bootstrap.Toast(successToastEl) : null;
    elements.errorToast = errorToastEl ? new bootstrap.Toast(errorToastEl) : null;
    
 function getCSRFToken() {
    const tokenMeta = document.querySelector('meta[name="csrf-token"]');
    if (tokenMeta) return tokenMeta.getAttribute('content');

    const tokenInput = document.querySelector('input[name="csrf_token"]');
    if (tokenInput) return tokenInput.value;

    if (window.csrf_token) return window.csrf_token;

    console.error("CSRF token missing");
    return "";
}

// make global
window.getCSRFToken = getCSRFToken;


    // ========================================
    // SECURE API CALL WRAPPER
    // ========================================
    async function secureAPICall(endpoint, options = {}) {
        // Check rate limiting
        if (!rateLimiter.canMakeRequest(endpoint)) {
            throw new Error('Too many requests. Please wait a moment.');
        }
        
        // Get CSRF token
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            throw new Error('Security token missing. Please refresh the page.');
        }
        
        // Prepare headers with security measures
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers
        };
        
        // Add request timestamp for replay attack prevention
        if (options.body && typeof options.body === 'object') {
            options.body.timestamp = Date.now();
        }
        
        try {
            const response = await fetch(endpoint, {
                ...options,
                headers,
                credentials: 'same-origin', // Important for CSRF
                body: options.body ? JSON.stringify(options.body) : undefined
            });
            
            // Check for security headers in response
            const contentType = response.headers.get('Content-Type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid response format');
            }
            
            const result = await response.json();
            
            // Validate response structure
            if (!response.ok) {
                throw new Error(result.message || `HTTP Error ${response.status}`);
            }
            
            return { success: true, data: result };
            
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }
    
    // ========================================
    // UTILITY FUNCTIONS
    // ========================================
    
    /**
     * Display toast notification with XSS protection
     */
    function showToast(type, message) {
        const toastElement = type === 'success' ? elements.successToast : elements.errorToast;
        const messageElement = document.getElementById(type === 'success' ? 'successMessage' : 'errorMessage');
        
        if (toastElement && messageElement) {
            const icon = type === 'success' ? 
                '<i class="fas fa-check-circle me-2"></i>' : 
                '<i class="fas fa-exclamation-circle me-2"></i>';
            
            // Sanitize message to prevent XSS
            const safeMessage = sanitizer.sanitizeHTML(message);
            messageElement.innerHTML = icon + safeMessage;
            toastElement.show();
        }
    }
    
    /**
     * Toggle button loading state
     */
    function setButtonLoading(button, isLoading) {
        if (!button) return;
        
        const spinner = button.querySelector('.spinner-border');
        const icon = button.querySelector('i:not(.spinner-border)');
        
        if (isLoading) {
            spinner?.classList.remove('d-none');
            icon?.classList.add('d-none');
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
        } else {
            spinner?.classList.add('d-none');
            icon?.classList.remove('d-none');
            button.disabled = false;
            button.setAttribute('aria-busy', 'false');
        }
    }
    
    /**
     * Add smooth fade-in animation to elements
     */
    function animateElement(element) {
        if (!element) return;
        element.classList.add('animate-card');
    }
    
    // ========================================
    // PASSWORD STRENGTH CHECKER - ENHANCED
    // ========================================
    
    /**
     * Check for common weak passwords
     */
    const weakPasswords = [
        'password', '12345678', 'qwerty', 'abc123', 'password123',
        'admin', 'letmein', 'welcome', 'monkey', '1234567890'
    ];
    
    /**
     * Calculate password strength score with security checks
     */
    function checkPasswordStrength(password) {
        if (!password) return { strength: 'weak', text: 'Enter password', width: '0%', score: 0 };
        
        // Check for common weak passwords
        if (weakPasswords.includes(password.toLowerCase())) {
            return { strength: 'weak', text: 'Too Common', width: '25%', score: 0 };
        }
        
        let score = 0;
        
        // Length checks (progressive scoring)
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (password.length >= 16) score++;
        
        // Character variety checks
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        
        // Check for sequential characters (weakness)
        if (/(.)\1{2,}/.test(password)) score--; // Repeated characters
        if (/(?:abc|bcd|cde|def|123|234|345|456)/i.test(password)) score--; // Sequential
        
        // Ensure score doesn't go negative
        score = Math.max(0, score);
        
        // Determine strength level
        let strength = 'weak';
        let text = 'Weak Password';
        let width = '25%';
        
        if (score >= 6) {
            strength = 'strong';
            text = 'Strong Password';
            width = '100%';
        } else if (score >= 5) {
            strength = 'good';
            text = 'Good Password';
            width = '75%';
        } else if (score >= 3) {
            strength = 'fair';
            text = 'Fair Password';
            width = '50%';
        }
        
        return { strength, text, width, score };
    }
    
    /**
     * Update password strength indicator UI
     */
    function updatePasswordStrength() {
        if (!elements.newPassword || !elements.confirmNewPassword) return;
        
        const password = sanitizer.sanitizeInput(elements.newPassword.value);
        const confirmPassword = sanitizer.sanitizeInput(elements.confirmNewPassword.value);
        
        // Validate password length
        if (password.length > SECURITY_CONFIG.MAX_PASSWORD_LENGTH) {
            elements.newPassword.value = password.substring(0, SECURITY_CONFIG.MAX_PASSWORD_LENGTH);
            showToast('error', `Password cannot exceed ${SECURITY_CONFIG.MAX_PASSWORD_LENGTH} characters`);
            return;
        }
        
        if (password.length === 0) {
            elements.newPasswordStrength.style.width = '0';
            elements.strengthText.textContent = 'Enter new password';
            elements.passwordMatch?.classList.add('d-none');
            elements.passwordMismatch?.classList.add('d-none');
            if (elements.changePasswordBtn) elements.changePasswordBtn.disabled = true;
            return;
        }
        
        // Update strength indicator
        const strength = checkPasswordStrength(password);
        elements.newPasswordStrength.className = 'password-strength ' + strength.strength;
        elements.newPasswordStrength.style.width = strength.width;
        elements.strengthText.textContent = strength.text;
        
        // Check password match
        if (confirmPassword.length > 0) {
            const passwordsMatch = password === confirmPassword;
            
            if (passwordsMatch) {
                elements.passwordMatch?.classList.remove('d-none');
                elements.passwordMismatch?.classList.add('d-none');
            } else {
                elements.passwordMatch?.classList.add('d-none');
                elements.passwordMismatch?.classList.remove('d-none');
            }
        } else {
            elements.passwordMatch?.classList.add('d-none');
            elements.passwordMismatch?.classList.add('d-none');
        }
        
        // Enable submit button if all conditions met
        const canSubmit = 
            password.length >= SECURITY_CONFIG.MIN_PASSWORD_LENGTH && 
            confirmPassword.length > 0 &&
            password === confirmPassword &&
            strength.strength !== 'weak' &&
            elements.currentPassword.value.length > 0;
        
        if (elements.changePasswordBtn) {
            elements.changePasswordBtn.disabled = !canSubmit;
        }
    }
    
    // ========================================
    // PASSWORD VISIBILITY TOGGLE
    // ========================================
    
    /**
     * Toggle password field visibility with security timeout
     */
    function togglePasswordVisibility(inputElement, toggleButton) {
        if (!inputElement || !toggleButton) return;
        
        const isPassword = inputElement.type === 'password';
        inputElement.type = isPassword ? 'text' : 'password';
        
        const icon = toggleButton.querySelector('i');
        if (icon) {
            icon.className = isPassword ? 'fas fa-eye' : 'fas fa-eye-slash';
        }
        
        // Auto-hide password after 30 seconds for security
        if (!isPassword) {
            setTimeout(() => {
                if (inputElement.type === 'text') {
                    inputElement.type = 'password';
                    if (icon) icon.className = 'fas fa-eye-slash';
                }
            }, 30000);
        }
        
        toggleButton.classList.add('toggle-pressed');
        setTimeout(() => toggleButton.classList.remove('toggle-pressed'), 220);
    }
    
    // ========================================
    // API CALL HANDLERS - SECURED
    // ========================================
    
    /**
     * Handle password change form submission with enhanced security
     */
    async function handleChangePassword(e) {
        e.preventDefault();
        
        if (!elements.changePasswordBtn) return;
        setButtonLoading(elements.changePasswordBtn, true);
        
        try {
            // Sanitize inputs
            const currentPassword = sanitizer.sanitizeInput(elements.currentPassword.value);
            const newPassword = sanitizer.sanitizeInput(elements.newPassword.value);
            
            // Validate input lengths
            if (!sanitizer.validateLength(currentPassword, 1, SECURITY_CONFIG.MAX_PASSWORD_LENGTH)) {
                throw new Error('Current password is invalid');
            }
            
            if (!sanitizer.validateLength(newPassword, SECURITY_CONFIG.MIN_PASSWORD_LENGTH, SECURITY_CONFIG.MAX_PASSWORD_LENGTH)) {
                throw new Error(`New password must be ${SECURITY_CONFIG.MIN_PASSWORD_LENGTH}-${SECURITY_CONFIG.MAX_PASSWORD_LENGTH} characters`);
            }
            
            // Check password strength
            const strength = checkPasswordStrength(newPassword);
            if (strength.strength === 'weak') {
                throw new Error('Password is too weak. Please choose a stronger password.');
            }
            
            // Make secure API call
            const result = await secureAPICall('/api/password/change', {
                method: 'POST',
                body: {
                    current_password: currentPassword,
                    new_password: newPassword
                }
            });
            
            if (result.success) {
                showToast('success', result.data.message || 'Password updated successfully!');
                
                // Clear form fields
                elements.currentPassword.value = '';
                elements.newPassword.value = '';
                elements.confirmNewPassword.value = '';
                updatePasswordStrength();
                
                // Add success animation
                elements.changePasswordForm?.classList.add('form-success');
                setTimeout(() => {
                    elements.changePasswordForm?.classList.remove('form-success');
                }, 360);
            }
        } catch (error) {
            console.error('Error changing password:', error);
            showToast('error', error.message || 'Failed to update password');
        } finally {
            setButtonLoading(elements.changePasswordBtn, false);
        }
    }
    
    /**
     * Handle delete all notes action with double confirmation
     */
    async function handleDeleteAllNotes() {
        if (!elements.confirmDeleteAllNotesBtn) return;
        
        // Verify confirmation text
        const confirmText = sanitizer.sanitizeInput(elements.deleteNotesConfirmInput?.value || '');
        if (confirmText !== 'DELETE ALL NOTES') {
            showToast('error', 'Please enter the correct confirmation phrase');
            return;
        }
        
        // Double confirmation with native dialog
        if (!confirm('⚠️ FINAL WARNING: This will permanently delete ALL your notes. This action CANNOT be undone. Are you absolutely sure?')) {
            return;
        }
        
        setButtonLoading(elements.confirmDeleteAllNotesBtn, true);
        
        try {
            const result = await secureAPICall('/api/notes/delete_all', {
                method: 'POST',
                body: {}
            });
            
            if (result.success) {
                showToast('success', result.data.message || 'All notes deleted successfully!');
                
                // Close modal
                const modalEl = document.getElementById('deleteAllNotesModal');
                const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                modal.hide();
                
                // Reset confirmation input
                if (elements.deleteNotesConfirmInput) {
                    elements.deleteNotesConfirmInput.value = '';
                }
                
                // Optionally redirect to dashboard
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            }
        } catch (error) {
            console.error('Error deleting notes:', error);
            showToast('error', error.message || 'Failed to delete notes');
        } finally {
            setButtonLoading(elements.confirmDeleteAllNotesBtn, false);
        }
    }
    
    /**
     * Load active sessions from API
     */
    // Debounce guard — prevent multiple rapid calls within 1 second
    let _sessionsLoadTimer = null;
    const _loadSessionsDebounced = function() {
        if (_sessionsLoadTimer) clearTimeout(_sessionsLoadTimer);
        _sessionsLoadTimer = setTimeout(() => {
            _sessionsLoadTimer = null;
            window.loadActiveSessions();
        }, 400);
    };
    // Expose debounced version globally for location tracker etc.
    window.loadActiveSessionsSafe = _loadSessionsDebounced;

    window.loadActiveSessions = async function() {
        if (!elements.sessionsTableBody) return;
        
        if (elements.logoutAllOtherSessionsBtn) {
            elements.logoutAllOtherSessionsBtn.disabled = true;
        }
        
        elements.sessionsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-5">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    Loading sessions...
                </td>
            </tr>
        `;
        
        try {
            // GET request — plain fetch, no Content-Type JSON header needed
            const res = await fetch('/api/sessions', {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': getCSRFToken()
                },
                credentials: 'same-origin'
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // /api/sessions returns a plain array directly
            const sessions = await res.json();
            
            if (!Array.isArray(sessions) || sessions.length === 0) {
                elements.sessionsTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-muted py-5">
                            <i class="fas fa-info-circle me-2"></i>
                            No active sessions found
                        </td>
                    </tr>
                `;
                return;
            }
            
            let html = '';
            let otherSessionsExist = false;
            
            sessions.forEach((session) => {
                if (!session.is_current) {
                    otherSessionsExist = true;
                }
                
                // Sanitize session data
                const device = sanitizer.sanitizeHTML(session.device || 'Unknown Device');
                const location = sanitizer.sanitizeHTML(session.location || 'Unknown Location');
                const lastActivity = sanitizer.sanitizeHTML(session.last_activity || 'Just now');
                const status = session.is_current ? 
                    '<span class="badge bg-success">Current</span>' : 
                    '<span class="badge bg-secondary">Active</span>';
                
                const ip = sanitizer.sanitizeHTML(session.ip || '');
                const ipBadge = ip ? `<br><small class="text-muted" style="font-size:.75rem;">${ip}</small>` : '';

                html += `
                    <tr>
                        <td><i class="fas fa-laptop me-2"></i>${device}</td>
                        <td><i class="fas fa-map-marker-alt me-2"></i>${location}${ipBadge}</td>
                        <td><i class="fas fa-clock me-2"></i>${lastActivity}</td>
                        <td>${status}</td>
                        <td class="text-center">
                            ${!session.is_current ? '<button class="btn btn-sm btn-outline-danger" onclick="logoutSession(\'' + session.id + '\')"><i class="fas fa-sign-out-alt"></i></button>' : '-'}
                        </td>
                    </tr>
                `;
            });
            
            elements.sessionsTableBody.innerHTML = html;
            
            if (elements.logoutAllOtherSessionsBtn) {
                elements.logoutAllOtherSessionsBtn.disabled = !otherSessionsExist;
            }
            
        } catch (error) {
            console.error('Error loading sessions:', error);
            elements.sessionsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger py-5">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Failed to load sessions
                    </td>
                </tr>
            `;
        }
    }
    
    /**
     * Log out all other sessions
     */
    async function handleLogoutAllOtherSessions() {
        if (!confirm('Are you sure you want to log out ALL sessions including THIS device? You will need to login again.')) {
            return;
        }
        
        if (!elements.logoutAllOtherSessionsBtn) return;
        
        const originalText = elements.logoutAllOtherSessionsBtn.innerHTML;
        elements.logoutAllOtherSessionsBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging out all...';
        elements.logoutAllOtherSessionsBtn.disabled = true;
        
        try {
            const result = await secureAPICall('/api/sessions/logout_all', {
                method: 'POST',
                body: {}
            });
            
            if (result.success) {
                // Sabka logout hua including apna — login page pe bhejo
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Error logging out sessions:', error);
            showToast('error', error.message || 'Failed to log out sessions');
            elements.logoutAllOtherSessionsBtn.innerHTML = originalText;
            elements.logoutAllOtherSessionsBtn.disabled = false;
        }
    }
    
    // ========================================
    // EVENT LISTENERS
    // ========================================
    
    /**
     * Initialize all event listeners
     */
    function initializeEventListeners() {
        // Password change form
        if (elements.changePasswordForm) {
            elements.changePasswordForm.addEventListener('submit', handleChangePassword);
        }
        
        // Password strength monitoring with debouncing
        let strengthCheckTimeout;
        const debouncePasswordCheck = () => {
            clearTimeout(strengthCheckTimeout);
            strengthCheckTimeout = setTimeout(updatePasswordStrength, 300);
        };
        
        if (elements.currentPassword) {
            elements.currentPassword.addEventListener('input', debouncePasswordCheck);
        }
        if (elements.newPassword) {
            elements.newPassword.addEventListener('input', debouncePasswordCheck);
        }
        if (elements.confirmNewPassword) {
            elements.confirmNewPassword.addEventListener('input', debouncePasswordCheck);
        }
        
        // Password visibility toggles
        if (elements.toggleCurrentPassword) {
            elements.toggleCurrentPassword.addEventListener('click', () => {
                togglePasswordVisibility(elements.currentPassword, elements.toggleCurrentPassword);
            });
        }
        if (elements.toggleNewPassword) {
            elements.toggleNewPassword.addEventListener('click', () => {
                togglePasswordVisibility(elements.newPassword, elements.toggleNewPassword);
            });
        }
        if (elements.toggleConfirmNewPassword) {
            elements.toggleConfirmNewPassword.addEventListener('click', () => {
                togglePasswordVisibility(elements.confirmNewPassword, elements.toggleConfirmNewPassword);
            });
        }
        
        // Delete all notes confirmation
        if (elements.deleteNotesConfirmInput) {
            elements.deleteNotesConfirmInput.addEventListener('input', function() {
                const isValid = this.value.trim() === 'DELETE ALL NOTES';
                if (elements.confirmDeleteAllNotesBtn) {
                    elements.confirmDeleteAllNotesBtn.disabled = !isValid;
                }
                
                if (isValid) {
                    this.classList.add('is-valid');
                } else {
                    this.classList.remove('is-valid');
                }
            });
        }
        
        if (elements.confirmDeleteAllNotesBtn) {
            elements.confirmDeleteAllNotesBtn.addEventListener('click', handleDeleteAllNotes);
        }
        
        // Logout all other sessions
        if (elements.logoutAllOtherSessionsBtn) {
            elements.logoutAllOtherSessionsBtn.addEventListener('click', handleLogoutAllOtherSessions);
        }
        
        // Add smooth scroll to tabs
        const tabButtons = document.querySelectorAll('.smart-nav-pills .nav-link');
        tabButtons.forEach(button => {
            button.addEventListener('shown.bs.tab', function() {
                const target = document.querySelector(this.getAttribute('data-bs-target'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        });
    }
    
    // ========================================
    // PAGE ANIMATIONS
    // ========================================
    
    /**
     * Add entry animations to cards
     */
    function initializePageAnimations() {
        const cards = document.querySelectorAll('.smart-settings-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('animate-card');
        });
    }
    
    // ========================================
    // INITIALIZATION
    // ========================================
    
    /**
     * Main initialization function
     */
    function initialize() {
        console.log('🔒 Settings page initialized with enhanced security');
        
        // Initialize session monitoring
        sessionMonitor.init();
        
        // Load active sessions
        loadActiveSessions();
        
        // Initialize event listeners
        initializeEventListeners();
        
        // Initialize page animations
        initializePageAnimations();
        
        // Set initial password strength
        updatePasswordStrength();
        
        console.log('✅ All security features active');
    }
    
    // ========================================
    // SECURITY: Prevent console tampering
    // ========================================
    if (typeof Object.freeze === 'function') {
        Object.freeze(SECURITY_CONFIG);
    }
    
    // ========================================
    // START APPLICATION
    // ========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // ========================================
    // EXPORT FOR DEBUGGING (Production mein remove karein)
    // ========================================
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.settingsDebug = {
            elements,
            getCSRFToken,
            checkPasswordStrength,
            loadActiveSessions,
            securityConfig: SECURITY_CONFIG
        };
    }
    
})();
// ================= LOCATION TRACKER (GLOBAL) =================

// Helper: send coordinates to server with CSRF token
function sendLocationToServer(lat, lon) {
    const csrf = (typeof getCSRFToken === 'function') ? getCSRFToken() : 
                 (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '');

    fetch("/api/update-location", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrf,
            "X-Requested-With": "XMLHttpRequest"
        },
        credentials: "same-origin",
        body: JSON.stringify({ lat, lon })
    })
    .then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
    })
    .then(data => {
        console.log("📡 Location saved:", data.location || "OK");
        // Use debounced reload to avoid triple-call with initialize()
        if (typeof window.loadActiveSessionsSafe === 'function') {
            window.loadActiveSessionsSafe();
        }
    })
    .catch(err => console.warn("Location update failed:", err));
}

window.startLocationTracking = function() {

    // Already sent in this tab — skip
    if (sessionStorage.getItem("location_sent")) {
        console.log("Location already captured this tab");
        return;
    }

    sessionStorage.setItem("location_sent", "1"); // Set early to prevent duplicate calls

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                console.log("📍 GPS:", pos.coords.latitude, pos.coords.longitude);
                sendLocationToServer(pos.coords.latitude, pos.coords.longitude);
            },
            function() {
                console.log("GPS denied → using IP fallback");
                // IP fallback
                fetch("https://ipapi.co/json/")
                    .then(r => r.json())
                    .then(data => {
                        if (data && data.latitude) {
                            sendLocationToServer(data.latitude, data.longitude);
                        }
                    })
                    .catch(() => console.warn("IP fallback also failed"));
            },
            { enableHighAccuracy: false, timeout: 10000 }
        );
    } else {
        // No GPS — try IP directly
        fetch("https://ipapi.co/json/")
            .then(r => r.json())
            .then(data => {
                if (data && data.latitude) {
                    sendLocationToServer(data.latitude, data.longitude);
                }
            })
            .catch(() => console.warn("IP location failed"));
    }
};

// Start after page load — single delayed call
window.addEventListener("load", () => {
    setTimeout(startLocationTracking, 2000);
});


// ================= LOGOUT SINGLE DEVICE =================

window.logoutSession = async function(token){

    if(!confirm("Logout this device?")) return;

    try{
        const res = await fetch("/api/logout-session/" + token,{
            method:"POST",
            headers:{
                "Content-Type":"application/json",
                "X-CSRFToken": getCSRFToken(),
                "X-Requested-With": "XMLHttpRequest"
            },
            credentials:"same-origin"
        });

        // Check HTTP status first
        if(!res.ok){
            const err = await res.json().catch(() => ({}));
            alert(err.error || "Logout failed (server error)");
            return;
        }

        const data = await res.json();

        if(data.success){
            loadActiveSessions();
        }else{
            alert(data.error || data.message || "Logout failed");
        }

    }catch(e){
        console.error("Logout error:", e);
        alert("Network error. Please try again.");
    }
}