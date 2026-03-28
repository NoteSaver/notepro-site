// Enhanced forgot-note-password.js - static/js/forgot-note-password.js
// Fixed version that works with dynamically created modals

let forgotPasswordInitialized = false;

function initializeForgotPasswordFunctionality() {
    console.log('Attempting to initialize forgot password functionality...');
    
    const resetBtn = document.getElementById('sendNoteResetEmail');
    const emailInput = document.getElementById('forgotNoteEmail');
    const successAlert = document.getElementById('forgotNoteSuccess');
    const errorAlert = document.getElementById('forgotNoteError');
    const spinner = resetBtn?.querySelector('.spinner-border');
    const forgotPasswordModal = document.getElementById('forgotNotePasswordModal');

    // Debug: Check if elements are found
    console.log('Elements found:', {
        resetBtn: !!resetBtn,
        emailInput: !!emailInput,
        successAlert: !!successAlert,
        errorAlert: !!errorAlert,
        spinner: !!spinner,
        modal: !!forgotPasswordModal
    });

    // If elements not found, wait and retry
    if (!resetBtn || !emailInput) {
        console.log('Required elements not found, retrying in 200ms...');
        setTimeout(initializeForgotPasswordFunctionality, 200);
        return;
    }

    // Prevent multiple initialization
    if (forgotPasswordInitialized) {
        console.log('Forgot password already initialized, skipping...');
        return;
    }

    forgotPasswordInitialized = true;
    console.log('Initializing forgot password functionality...');

    // Enhanced email validation
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Clear alerts function
    function clearAlerts() {
        if (successAlert) {
            successAlert.classList.add('d-none');
            successAlert.textContent = '';
        }
        if (errorAlert) {
            errorAlert.classList.add('d-none');
            errorAlert.textContent = '';
        }
    }

    // Show error function
    function showError(message) {
        clearAlerts();
        if (errorAlert) {
            errorAlert.textContent = message;
            errorAlert.classList.remove('d-none');
        }
    }

    // Show success function
    function showSuccess(message) {
        clearAlerts();
        if (successAlert) {
            successAlert.textContent = message;
            successAlert.classList.remove('d-none');
        }
    }

    // CSRF token function
    function getCSRFToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) return metaTag.getAttribute('content');
        
        const csrfInput = document.querySelector('input[name="csrf_token"]');
        if (csrfInput) return csrfInput.value;
        
        return null;
    }

    // Main reset button click handler
    resetBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        console.log('Reset button clicked');

        const email = emailInput.value.trim();

        // Reset alert states
        clearAlerts();

        // Validate email
        if (!email) {
            showError("Please enter your registered email address.");
            emailInput.focus();
            return;
        }

        if (!isValidEmail(email)) {
            showError("Please enter a valid email address.");
            emailInput.focus();
            return;
        }

        // Show loading state
        if (spinner) spinner.classList.remove('d-none');
        resetBtn.disabled = true;
        emailInput.disabled = true;

        try {
            console.log('Sending reset request for email:', email);
            
            const res = await fetch('/api/reset-note-password', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': getCSRFToken()  // Fixed: Added comma and proper token
                },
                body: JSON.stringify({ email })
            });

            console.log('Response status:', res.status);
            const data = await res.json();
            console.log('Response data:', data);

            if (res.ok && data.success) {
                showSuccess(data.message || "Password reset instructions have been sent to your email!");
                emailInput.value = ''; // Clear the form on success
                
                // Optional: Auto-close modal after success
                // Success पर auto-close से पहले फोकस blur करें
              setTimeout(() => {
               if (forgotPasswordModal) {
               const modal = bootstrap.Modal.getInstance(forgotPasswordModal);
               if (modal) {
            // FIX: Hide से पहले modal के अंदर का फोकस blur करें
            if (forgotPasswordModal.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (e) {}
            }
            modal.hide();
        }
    }
}, 3000);
            } else {
                showError(data.message || "Something went wrong. Please try again.");
            }
        } catch (err) {
            console.error('Network error:', err);
            showError("Network error. Please check your connection and try again.");
        } finally {
            // Hide loading state
            if (spinner) spinner.classList.add('d-none');
            resetBtn.disabled = false;
            emailInput.disabled = false;
        }
    });

    // Enter key handler for email input
    emailInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            resetBtn.click();
        }
    });

    // Clear form when modal is shown
    if (forgotPasswordModal) {
        forgotPasswordModal.addEventListener('shown.bs.modal', function() {
            clearAlerts();
            setTimeout(() => {
                if (emailInput) {
                    emailInput.focus();
                }
            }, 100);
            console.log('Forgot password modal shown');
        });

        forgotPasswordModal.addEventListener('hidden.bs.modal', function() {
            clearAlerts();
            emailInput.value = '';
            emailInput.disabled = false;
            resetBtn.disabled = false;
            if (spinner) spinner.classList.add('d-none');
            console.log('Forgot password modal hidden');
        });
    }

    console.log('Forgot note password functionality initialized successfully');
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function () {
    console.log('Forgot note password script loaded');
    
    // Try initial initialization (in case modal already exists)
    initializeForgotPasswordFunctionality();
    
    // Also initialize when forgot password trigger is clicked
    document.addEventListener('DOMContentLoaded', function() {
    const forgotPasswordTrigger = document.getElementById('forgotPasswordTrigger');
    if (forgotPasswordTrigger) {
        forgotPasswordTrigger.addEventListener('click', function(e) {
            e.preventDefault();

            // Modal element ko get karo
            const forgotModalEl = document.getElementById('forgotNotePasswordModal');

            if (forgotModalEl) {
                // Bootstrap modal instance banao
                const forgotModal = new bootstrap.Modal(forgotModalEl);
                forgotModal.show();

                // Modal ke open hone ke baad forgot password functionality initialize karo
                setTimeout(initializeForgotPasswordFunctionality, 100);
            } else {
                // Agar modal abhi DOM mein nahi hai, to thoda wait karo aur phir try karo
                setTimeout(initializeForgotPasswordFunctionality, 300);
            }
        });
    }
});

    
    // Listen for dynamically created modals
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1 && node.id === 'forgotNotePasswordModal') {
                        console.log('Forgot password modal detected via observer');
                        setTimeout(initializeForgotPasswordFunctionality, 100);
                    }
                });
            }
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});