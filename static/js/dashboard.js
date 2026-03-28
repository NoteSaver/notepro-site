// static/js/dashboard.js
// Dashboard JavaScript - FULLY FIXED VERSION with Download & Sharing Features

let currentAction = null;
let currentNoteId = null;
let currentUrl = null;

// Utility Functions
function getCSRFToken() {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) return metaTag.getAttribute('content');
    const csrfInput = document.querySelector('input[name="csrf_token"]');
    if (csrfInput) return csrfInput.value;
    return null;
}

function showToast(message, type = 'success') {
    const toastId = type === 'success' ? 'successToast' : 'errorToast';
    const messageId = type === 'success' ? 'successMessage' : 'errorMessage';
    const msgEl = document.getElementById(messageId);
    if (msgEl) msgEl.textContent = message;
    const toastEl = document.getElementById(toastId);
    if (toastEl) {
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }
}

function checkPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;
    return score;
}

function updatePasswordStrength(password, strengthElementId, showText = false) {
    const strengthElement = document.getElementById(strengthElementId);
    if (!strengthElement) return;

    const score = checkPasswordStrength(password);
    const percentage = (score / 5) * 100;
    const strengthTexts = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const strengthClasses = ['strength-very-weak', 'strength-weak', 'strength-fair', 'strength-good', 'strength-strong'];

    strengthElement.className = 'password-strength';

    if (password.length > 0) {
        let strengthBar = strengthElement.querySelector('.strength-bar');
        if (!strengthBar) {
            strengthBar = document.createElement('div');
            strengthBar.classList.add('strength-bar');
            strengthElement.appendChild(strengthBar);
        }
        strengthClasses.forEach(cls => strengthBar.classList.remove(cls));
        strengthBar.classList.add(strengthClasses[score]);
        strengthBar.style.width = `${percentage}%`;

        if (showText) {
            const textElement = document.getElementById('strengthText');
            if (textElement) {
                textElement.textContent = strengthTexts[score];
                textElement.className = `text-${score < 2 ? 'danger' : score < 4 ? 'warning' : 'success'}`;
            }
        }
    } else {
        const strengthBar = strengthElement.querySelector('.strength-bar');
        if (strengthBar) {
            strengthBar.style.width = '0%';
            strengthBar.className = 'strength-bar';
        }
        if (showText) {
            const textElement = document.getElementById('strengthText');
            if (textElement) {
                textElement.textContent = '';
                textElement.className = '';
            }
        }
    }
}

function updateProtectionVisuals(noteId, isProtected) {
    // 🛡️ FIX: Safe query selector to prevent invalid selectors
    const safeQuerySelector = (sel) => {
        if (!sel || sel.trim() === '' || sel === '#') {
            console.warn('Invalid selector skipped:', sel);
            return null;
        }
        try {
            return document.querySelector(sel);
        } catch (e) {
            console.error('QuerySelector error:', e, sel);
            return null;
        }
    };

    const noteCard = safeQuerySelector(`[data-note-id="${noteId}"]`);
    if (!noteCard) return;

    const shieldButton = noteCard.querySelector('.private-btn');
    const shieldIcon = shieldButton?.querySelector('i');
    const cardHeader = noteCard.querySelector('.card-header');
    const titleArea = noteCard.querySelector('.note-title');
    const badgeArea = noteCard.querySelector('.note-badges');

    shieldButton?.setAttribute('data-private', isProtected.toString());

    if (isProtected) {
        noteCard.classList.add('border-danger', 'protected-card');
        cardHeader?.classList.add('bg-light-danger');
        shieldIcon?.classList.remove('text-muted');
        shieldIcon?.classList.add('text-danger');
        shieldButton?.setAttribute('title', 'Remove Password Protection');

        if (titleArea && !titleArea.querySelector('.fa-shield-alt')) {
            const shieldSpan = document.createElement('i');
            shieldSpan.className = 'fas fa-shield-alt text-danger me-1';
            shieldSpan.setAttribute('title', 'Password Protected');
            titleArea.insertBefore(shieldSpan, titleArea.firstChild);
        }

        if (titleArea && !titleArea.querySelector('.fa-lock')) {
            const lockIcon = document.createElement('i');
            lockIcon.className = 'fas fa-lock text-danger ms-1';
            lockIcon.setAttribute('title', 'Private Note');
            titleArea.appendChild(lockIcon);
        }

        if (badgeArea && !badgeArea.querySelector('.protection-badge')) {
            const protectedBadge = document.createElement('span');
            protectedBadge.className = 'badge bg-danger protection-badge';
            protectedBadge.innerHTML = '🔒 Protected';
            badgeArea.appendChild(document.createTextNode(' '));
            badgeArea.appendChild(protectedBadge);
        }

        const previewElement = noteCard.querySelector('.note-preview');
        if (previewElement) {
            previewElement.innerHTML = '🔒 This note is password protected. Enter password to view content.';
        }
    } else {
        noteCard.classList.remove('border-danger', 'protected-card');
        cardHeader?.classList.remove('bg-light-danger');
        shieldIcon?.classList.remove('text-danger');
        shieldIcon?.classList.add('text-muted');
        shieldButton?.setAttribute('title', 'Set Password Protection');

        const shieldSpan = titleArea?.querySelector('.fa-shield-alt');
        const lockIcon = titleArea?.querySelector('.fa-lock');
        if (shieldSpan) shieldSpan.remove();
        if (lockIcon) lockIcon.remove();

        const protectedBadge = badgeArea?.querySelector('.protection-badge');
        if (protectedBadge) protectedBadge.remove();

        const protectedActionBtns = noteCard.querySelectorAll('.protected-action-btn');
        protectedActionBtns.forEach(btn => {
            btn.setAttribute('data-is-private', 'false');
        });
    }

    const allProtectedBtns = noteCard.querySelectorAll('.protected-action-btn');
    allProtectedBtns.forEach(btn => {
        btn.setAttribute('data-is-private', isProtected.toString());
    });

    console.log(`Updated note ${noteId} protection state to: ${isProtected}`);
}

function showForgotPasswordModal() {
    console.log('showForgotPasswordModal called');

    let removePasswordModal = document.getElementById('removePasswordModal');
    let forgotPasswordModal = document.getElementById('forgotNotePasswordModal');

    console.log('Modal detection:', {
        removePasswordModal: !!removePasswordModal,
        forgotPasswordModal: !!forgotPasswordModal
    });

    if (!forgotPasswordModal) {
        console.log('Creating forgot password modal dynamically');
        forgotPasswordModal = createForgotPasswordModal();
        document.body.appendChild(forgotPasswordModal);
        setTimeout(() => {
            if (typeof initializeForgotPasswordFunctionality === 'function') {
                initializeForgotPasswordFunctionality();
            }
        }, 0);
    }

    const removeModalInstance = removePasswordModal ? bootstrap.Modal.getInstance(removePasswordModal) : null;

    if (removeModalInstance) {
        console.log('Hiding remove password modal');

        const focused = document.activeElement;
        if (removePasswordModal.contains(focused)) {
            try { focused.blur(); } catch (e) {}
        }

        removeModalInstance.hide();

        removePasswordModal.addEventListener('hidden.bs.modal', function showForgotModal() {
            removePasswordModal.removeEventListener('hidden.bs.modal', showForgotModal);

            if (removePasswordModal.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (e) {}
            }

            setTimeout(() => {
                if (typeof initializeForgotPasswordFunctionality === 'function') {
                    initializeForgotPasswordFunctionality();
                }
            }, 0);

            const forgotModalInstance = new bootstrap.Modal(forgotPasswordModal);
            forgotModalInstance.show();

            forgotPasswordModal.addEventListener('shown.bs.modal', function focusEmail() {
                forgotPasswordModal.removeEventListener('shown.bs.modal', focusEmail);
                const emailInput = document.getElementById('forgotNoteEmail');
                if (emailInput) setTimeout(() => emailInput.focus(), 100);
            });
        });
    } else {
        console.log('No remove modal instance, directly showing forgot password modal');
        const forgotModalInstance = new bootstrap.Modal(forgotPasswordModal);
        setTimeout(() => {
            if (typeof initializeForgotPasswordFunctionality === 'function') {
                initializeForgotPasswordFunctionality();
            }
        }, 0);
        forgotModalInstance.show();
        setTimeout(() => {
            const emailInput = document.getElementById('forgotNoteEmail');
            if (emailInput) emailInput.focus();
        }, 300);
    }
}

function createForgotPasswordModal() {
    const modalHTML = `
    <div class="modal fade" id="forgotNotePasswordModal" tabindex="-1" aria-labelledby="forgotNotePasswordModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="forgotNotePasswordModalLabel">
                        <i class="fas fa-envelope text-primary me-2"></i>
                        Reset Note Password
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        We'll send password reset instructions to your registered email address.
                    </div>
                    <form id="forgotNotePasswordForm" novalidate>
                        <div class="mb-3">
                            <label for="forgotNoteEmail" class="form-label">Registered Email</label>
                            <input type="email" class="form-control" id="forgotNoteEmail" 
                                   placeholder="you@example.com" required>
                            <div class="invalid-feedback">Please enter a valid email address.</div>
                        </div>
                        <div class="alert alert-success d-none" id="forgotNoteSuccess"></div>
                        <div class="alert alert-danger d-none" id="forgotNoteError"></div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="sendNoteResetEmail">
                        <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                        <i class="fas fa-paper-plane me-1"></i>
                        Send Reset Email
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    const modalElement = document.createElement('div');
    modalElement.innerHTML = modalHTML;
    return modalElement.firstElementChild;
}

// FIXED: Password Validation Function
function validatePasswords() {
    const password1 = document.getElementById('newPassword1');
    const password2 = document.getElementById('newPassword2');
    const mismatchDiv = document.getElementById('passwordMismatch');
    const matchDiv = document.getElementById('passwordMatch');
    const setPasswordBtn = document.getElementById('setPassword');
    
    if (!password1 || !password2 || !setPasswordBtn) {
        console.warn('Password validation: Required elements not found');
        return;
    }

    const pwd1 = password1.value.trim();
    const pwd2 = password2.value.trim();

    // Hide all messages initially
    if (mismatchDiv) mismatchDiv.classList.add('d-none');
    if (matchDiv) matchDiv.classList.add('d-none');

    // Case 1: Both fields empty
    if (pwd1.length === 0 && pwd2.length === 0) {
        setPasswordBtn.disabled = true;
        return;
    }

    // Case 2: Password too short
    if (pwd1.length > 0 && pwd1.length < 6) {
        setPasswordBtn.disabled = true;
        if (mismatchDiv) {
            mismatchDiv.textContent = 'Password must be at least 6 characters long!';
            mismatchDiv.classList.remove('d-none');
        }
        return;
    }

    // Case 3: Second password not entered yet
    if (pwd1.length >= 6 && pwd2.length === 0) {
        setPasswordBtn.disabled = true;
        return;
    }

    // Case 4: Passwords don't match
    if (pwd1 !== pwd2) {
        setPasswordBtn.disabled = true;
        if (mismatchDiv) {
            mismatchDiv.textContent = 'Passwords do not match!';
            mismatchDiv.classList.remove('d-none');
        }
        return;
    }

    // Case 5: Everything valid - ENABLE BUTTON
    if (pwd1.length >= 6 && pwd1 === pwd2) {
        setPasswordBtn.disabled = false;
        if (matchDiv) {
            matchDiv.classList.remove('d-none');
        }
        return;
    }

    // Default: disable
    setPasswordBtn.disabled = true;
}

function submitDeleteForm(url) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.name = 'csrf_token';
    csrfInput.value = getCSRFToken();
    form.appendChild(csrfInput);
    document.body.appendChild(form);
    form.submit();
}

function showDeleteConfirmModal(url, noteTitle) {
    const titleEl = document.getElementById('deleteNoteTitle');
    if (titleEl) titleEl.textContent = noteTitle || 'this note';

    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
        const freshBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(freshBtn, confirmBtn);
        freshBtn.addEventListener('click', function () {
            const spinner = freshBtn.querySelector('.spinner-border');
            freshBtn.disabled = true;
            if (spinner) spinner.classList.remove('d-none');
            submitDeleteForm(url);
        });
    }

    const modalEl = document.getElementById('deleteConfirmModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function executeAction(action, url, noteId) {
    if (action === 'delete') {
        const noteCard = document.querySelector(`[data-note-id="${noteId}"]`);
        const noteTitle = noteCard
            ? (noteCard.querySelector('.note-title')?.textContent?.trim() || '')
            : '';
        showDeleteConfirmModal(url, noteTitle);
    } else if (action === 'pdf' || action === 'doc') {
        // Show Download Options Modal instead of direct download
        showDownloadOptionsModal(url, action, noteId);
    } else {
        window.location.href = url;
    }
}

function showDownloadOptionsModal(url, format, noteId) {
    const noteCard = document.querySelector(`[data-note-id="${noteId}"]`);
    const noteName = noteCard?.querySelector('.note-title')?.textContent?.trim() || 'Note';

    // Populate modal
    const nameEl = document.getElementById('downloadOptionsNoteName');
    const labelEl = document.getElementById('downloadOptionsLabel');
    if (nameEl) nameEl.textContent = noteName;
    if (labelEl) labelEl.textContent = `Download as ${format.toUpperCase()}`;

    // Store for confirm button
    const confirmBtn = document.getElementById('confirmDownloadBtn');
    if (confirmBtn) {
        // Clone to remove old listeners
        const fresh = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(fresh, confirmBtn);

        fresh.addEventListener('click', function () {
            const includeTitle  = document.getElementById('dlOptTitle')?.checked  ? '1' : '0';
            const includeMeta   = document.getElementById('dlOptMeta')?.checked   ? '1' : '0';
            const includeFooter = document.getElementById('dlOptFooter')?.checked ? '1' : '0';

            const finalUrl = `${url}?include_title=${includeTitle}&include_meta=${includeMeta}&include_footer=${includeFooter}`;

            const a = document.createElement('a');
            a.href = finalUrl;
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            bootstrap.Modal.getInstance(
                document.getElementById('downloadOptionsModal')
            )?.hide();
        });
    }

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById('downloadOptionsModal')
    ).show();
}

// dashboard.js (Improved handleFileShare function)
async function handleFileShare(noteId, format) {
    const shareButton = document.getElementById(`share${format.charAt(0).toUpperCase() + format.slice(1)}Button`);
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('shareModal'));
    
    // Validate noteId
    if (!noteId || noteId.trim() === '') {
        console.error('Invalid note ID for sharing:', noteId);
        showToast('Cannot share: Invalid note.', 'error');
        return;
    }

    // Check Web Share API support
    const testFile = new File([''], 'test.txt', { type: 'text/plain' });
    if (!navigator.share || !navigator.canShare || !navigator.canShare({ files: [testFile] })) {
        // Fallback to direct download
        const downloadUrl = `/download/${format}/${noteId}`;
        window.open(downloadUrl, '_blank');
        showToast(`Sharing not supported on this device. ${format.toUpperCase()} download started.`, 'warning');
        return;
    }

    // Define file metadata based on format
    const fileMetadata = {
        pdf: { mimeType: 'application/pdf', extension: 'pdf', icon: 'file-pdf', label: 'PDF' },
        txt: { mimeType: 'text/plain', extension: 'txt', icon: 'file-alt', label: 'Text' }
    };

    const metadata = fileMetadata[format];
    if (!metadata) {
        console.error('Unsupported format:', format);
        showToast('Unsupported file format.', 'error');
        return;
    }

    const url = `/download/${format}/${noteId}`;
    const filename = `NoteSaver_Note_${noteId}.${metadata.extension}`;

    // Update button state
    if (shareButton) {
        shareButton.disabled = true;
        shareButton.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Preparing ${metadata.label}...
        `;
        shareButton.setAttribute('aria-busy', 'true');
    }

    try {
        // Fetch file data
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`${metadata.label} file not found.`);
            } else if (response.status === 403) {
                throw new Error('Access denied. Please check note permissions.');
            } else {
                throw new Error(`Failed to fetch ${metadata.label} file. Status: ${response.status}`);
            }
        }

        // Create file from response
        const blob = await response.blob();
        const file = new File([blob], filename, { type: metadata.mimeType });

        // Share via Web Share API
        await navigator.share({
            title: `Share Note: ${noteId} as ${metadata.label}`,
            text: `Shared note from NoteSaver Pro as ${metadata.label} format`,
            files: [file]
        });

        showToast(`${metadata.label} shared successfully!`, 'success');
        console.log(`Successfully shared note ${noteId} as ${format}`);

    } catch (error) {
        if (error.name === 'AbortError') {
            showToast('Sharing cancelled.', 'info');
        } else {
            console.error(`Error sharing ${metadata.label}:`, error);
            showToast(`Failed to share ${metadata.label}: ${error.message}`, 'error');
            // Fallback to direct download
            window.open(url, '_blank');
        }
    } finally {
        if (shareButton) {
            shareButton.disabled = false;
            shareButton.innerHTML = `
                <i class="fas fa-${metadata.icon} me-2"></i>
                Share as ${metadata.label}
            `;
            shareButton.removeAttribute('aria-busy');
        }
        // Hide modal after sharing
        if (modalInstance) {
            modalInstance.hide();
        }
    }
}

// dashboard.js (Updated resetModalForms function)
function resetModalForms() {
    document.querySelectorAll('.modal form').forEach(form => {
        form.reset();
        form.querySelectorAll('.alert-danger, .alert-success').forEach(alert => {
            alert.classList.add('d-none');
        });
        form.querySelectorAll('.password-strength').forEach(strength => {
            strength.innerHTML = '';
        });
    });
    document.querySelectorAll('.modal button[disabled]').forEach(button => {
        button.disabled = false;
        button.removeAttribute('aria-busy');
    });
    // Reset share modal specific elements
    const shareInput = document.getElementById('shareLinkInput');
    const previewText = document.getElementById('notePreviewText');
    if (shareInput) shareInput.value = '';
    if (previewText) previewText.innerHTML = '<i class="fas fa-lock me-1"></i>Loading note preview...';
}

// dashboard.js (Improved showShareModal function)
async function showShareModal(noteId, shareUrl, isPrivate = false) {
    // Get or create the modal
    let shareModal = document.getElementById('shareModal');
    if (!shareModal) {
        shareModal = createShareModal();
        document.body.appendChild(shareModal);
    }

    // Reset modal state
    resetModalForms();
    const shareInput = document.getElementById('shareLinkInput');
    const previewText = document.getElementById('notePreviewText');
    if (shareInput) {
        shareInput.value = shareUrl;
    }

    // Set note ID on buttons
    const buttons = {
        pdf: document.getElementById('sharePdfButton'),
        txt: document.getElementById('shareTxtButton')
    };

    Object.entries(buttons).forEach(([format, button]) => {
        if (button) {
            button.setAttribute('data-note-id', noteId);
            const metadata = {
                pdf: { icon: 'file-pdf', label: 'PDF' },
                txt: { icon: 'file-alt', label: 'Text' }
            }[format];
            button.innerHTML = `
                <i class="fas fa-${metadata.icon} me-2"></i>
                Share as ${metadata.label}
            `;
            button.disabled = isPrivate; // Disable for private notes
            button.setAttribute('aria-disabled', isPrivate.toString());
        }
    });

    // Add event listeners for share buttons
    Object.entries(buttons).forEach(([format, button]) => {
        if (button) {
            // Remove existing listeners to prevent duplicates
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', (e) => {
                const currentId = newButton.getAttribute('data-note-id');
                if (currentId) {
                    handleFileShare(currentId, format);
                }
                e.stopPropagation();
            });
        }
    });

    // Fetch note preview (if not private)
    if (!isPrivate && previewText) {
        try {
            const response = await fetch(`/note_preview/${noteId}`, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': getCSRFToken()
                }
            });
            const data = await response.json();
            if (data.status === 'success' && data.preview) {
                previewText.innerHTML = data.preview.slice(0, 100) + (data.preview.length > 100 ? '...' : '');
            } else {
                previewText.innerHTML = '<i class="fas fa-lock me-1"></i>Note preview unavailable.';
            }
        } catch (error) {
            console.error('Error fetching note preview:', error);
            previewText.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>Error loading preview.';
        }
    } else if (previewText) {
        previewText.innerHTML = '<i class="fas fa-lock me-1"></i>This note is password protected.';
    }

    // Show the modal
    const modalInstance = bootstrap.Modal.getOrCreateInstance(shareModal);
    modalInstance.show();

    // Auto-focus copy button for accessibility
    setTimeout(() => {
        const copyButton = document.getElementById('copyShareLink');
        if (copyButton) copyButton.focus();
    }, 100);
}

// dashboard.js (Improved createShareModal function)
function createShareModal() {
    const modalHTML = `
    <div class="modal fade" id="shareModal" tabindex="-1" aria-labelledby="shareModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="shareModalLabel">
                        <i class="fas fa-share-alt text-info me-2"></i>Share Note
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info" role="alert">
                        <i class="fas fa-info-circle me-2"></i>
                        Share your note directly to apps (WhatsApp, Gmail, etc.) or copy the link below.
                    </div>
                    


                    <!-- Share Formats -->
                    <div class="mb-3">
                        <label class="form-label fw-bold">Share Formats</label>
                        <div class="d-grid gap-2 d-md-flex justify-content-md-start">
                            <button type="button" class="btn btn-danger flex-fill" id="sharePdfButton" 
                                    data-format="pdf" aria-label="Share note as PDF">
                                <i class="fas fa-file-pdf me-2"></i>Share as PDF
                            </button>
<button type="button" class="btn btn-success flex-fill" id="shareTxtButton" 
                                    data-format="txt" aria-label="Share note as Text">
                                <i class="fas fa-file-alt me-2"></i>Share as Text
                            </button>
                        </div>
                    </div>


                    <div class="alert alert-success d-none" id="shareSuccess" role="alert">
                        <i class="fas fa-check-circle me-2"></i>Link copied successfully!
                    </div>
                    <div class="alert alert-danger d-none" id="shareError" role="alert">
                        <i class="fas fa-exclamation-triangle me-2"></i>Failed to copy link.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" 
                            aria-label="Close share modal">Close</button>
                </div>
            </div>
        </div>
    </div>`;

    const modalElement = document.createElement('div');
    modalElement.innerHTML = modalHTML;

    // Add event listener for copy button
    setTimeout(() => {
        const copyButton = document.getElementById('copyShareLink');
        if (copyButton) {
            copyButton.addEventListener('click', async () => {
                const shareInput = document.getElementById('shareLinkInput');
                const successAlert = document.getElementById('shareSuccess');
                const errorAlert = document.getElementById('shareError');
                if (shareInput) {
                    try {
                        await navigator.clipboard.writeText(shareInput.value);
                        successAlert.classList.remove('d-none');
                        errorAlert.classList.add('d-none');
                        showToast('Link copied to clipboard!', 'success');
                        setTimeout(() => successAlert.classList.add('d-none'), 3000);
                    } catch (error) {
                        console.error('Failed to copy:', error);
                        errorAlert.classList.remove('d-none');
                        successAlert.classList.add('d-none');
                        // Fallback for older browsers
                        shareInput.select();
                        try {
                            document.execCommand('copy');
                            successAlert.classList.remove('d-none');
                            errorAlert.classList.add('d-none');
                            showToast('Link copied to clipboard!', 'success');
                            setTimeout(() => successAlert.classList.add('d-none'), 3000);
                        } catch (fallbackError) {
                            showToast('Failed to copy link. Please select and copy manually.', 'error');
                        }
                    }
                }
            });
        }
    }, 0);

    return modalElement.firstElementChild;
}

// Main DOMContentLoaded Event Handler
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard JS initialized');

    // Forgot Password Trigger
    const forgotPasswordTrigger = document.getElementById('forgotPasswordTrigger');
    if (forgotPasswordTrigger) {
        forgotPasswordTrigger.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Forgot password clicked!');
            showForgotPasswordModal();
        });
    }

    // Password Toggle Functionality
    function setupPasswordToggle(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        if (input && button) {
            button.addEventListener('click', () => {
                const type = input.type === 'password' ? 'text' : 'password';
                input.type = type;
                button.innerHTML = `<i class="fas fa-${type === 'password' ? 'eye' : 'eye-slash'}"></i>`;
            });
        }
    }

    setupPasswordToggle('notePassword', 'togglePassword');
    setupPasswordToggle('newPassword1', 'toggleNewPassword1');
    setupPasswordToggle('newPassword2', 'toggleNewPassword2');
    setupPasswordToggle('currentPassword', 'toggleCurrentPassword');

    // FIXED: Password Strength and Validation
    const password1 = document.getElementById('newPassword1');
    const password2 = document.getElementById('newPassword2');
    const currentPassword = document.getElementById('currentPassword');
    const notePassword = document.getElementById('notePassword');

    if (password1) {
        password1.addEventListener('input', () => {
            updatePasswordStrength(password1.value, 'newPassword1Strength', true);
            validatePasswords();
        });
        password1.addEventListener('blur', validatePasswords);
    }

    if (password2) {
        password2.addEventListener('input', validatePasswords);
        password2.addEventListener('blur', validatePasswords);
    }

    if (currentPassword) {
        currentPassword.addEventListener('input', () => {
            updatePasswordStrength(currentPassword.value, 'currentPasswordStrength');
        });
    }

    if (notePassword) {
        notePassword.addEventListener('input', () => {
            updatePasswordStrength(notePassword.value, 'notePasswordStrength');
        });
    }

    // FIXED: Modal Reset on Open
    const setPrivatePasswordModal = document.getElementById('setPrivatePasswordModal');
    if (setPrivatePasswordModal) {
        setPrivatePasswordModal.addEventListener('shown.bs.modal', function() {
            console.log('Set password modal opened - resetting form');
            
            // Reset form fields
            if (password1) password1.value = '';
            if (password2) password2.value = '';
            
            // Reset validation messages
            const mismatchDiv = document.getElementById('passwordMismatch');
            const matchDiv = document.getElementById('passwordMatch');
            if (mismatchDiv) mismatchDiv.classList.add('d-none');
            if (matchDiv) matchDiv.classList.add('d-none');
            
            // Disable button initially
            const setPasswordBtn = document.getElementById('setPassword');
            if (setPasswordBtn) {
                setPasswordBtn.disabled = true;
                console.log('Set password button disabled on modal open');
            }
            
            // Clear strength indicators
            const strength1 = document.getElementById('newPassword1Strength');
            if (strength1) strength1.innerHTML = '';
            
            const strengthText = document.getElementById('strengthText');
            if (strengthText) {
                strengthText.textContent = '';
                strengthText.className = '';
            }
            
            // Focus first password field
            setTimeout(() => {
                if (password1) password1.focus();
            }, 100);
        });
    }

    // Favorite Buttons
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    favoriteButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const noteId = button.dataset.noteId;
            const starIcon = button.querySelector('i');
            try {
                const response = await fetch(`/toggle_favorite/${noteId}`, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    }
                });
                const data = await response.json();
                if (data.status === 'success') {
                    if (data.is_favorite) {
                        starIcon.classList.remove('text-muted');
                        starIcon.classList.add('text-warning');
                        const noteCard = button.closest('.note-card');
                        const badgeArea = noteCard?.querySelector('.note-badges');
                        if (badgeArea && !badgeArea.querySelector('.favorite-badge')) {
                            const favBadge = document.createElement('span');
                            favBadge.className = 'badge bg-warning favorite-badge';
                            favBadge.innerHTML = '⭐ Favorite';
                            badgeArea.appendChild(document.createTextNode(' '));
                            badgeArea.appendChild(favBadge);
                        }
                        showToast('Note added to favorites!', 'success');
                    } else {
                        starIcon.classList.remove('text-warning');
                        starIcon.classList.add('text-muted');
                        const noteCard = button.closest('.note-card');
                        const favBadge = noteCard?.querySelector('.favorite-badge');
                        if (favBadge) favBadge.remove();
                        showToast('Note removed from favorites!', 'success');
                    }
                } else {
                    showToast('Failed to toggle favorite: ' + data.message, 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('An error occurred while updating favorite status.', 'error');
            }
        });
    });

// dashboard.js (Modified section for Share Buttons - around line 527)
// Sharing Buttons
// dashboard.js (Updated shareButtons event listener)
const shareButtons = document.querySelectorAll('.share-btn');
shareButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const noteId = button.dataset.noteId;
        const isPrivate = button.dataset.isPrivate === 'true';

        // Validate noteId
        if (!noteId || noteId.trim() === '') {
            console.error('Invalid note ID for sharing:', noteId);
            showToast('Cannot share: Invalid note.', 'error');
            return;
        }

        // Create shareable link
        const shareUrl = `${window.location.origin}/share/note/${noteId}`;

        try {
            // Check if note is private
            if (isPrivate) {
                showToast('Private notes require password verification before sharing.', 'warning');
                const modal = new bootstrap.Modal(document.getElementById('passwordModal'));
                modal.show();
                setTimeout(() => {
                    document.getElementById('notePassword')?.focus();
                }, 300);
                // Store share action for verification
                currentAction = 'share';
                currentNoteId = noteId;
                currentUrl = shareUrl;
                return;
            }

            // Show share options modal
            showShareModal(noteId, shareUrl, isPrivate);

            // Auto-copy link to clipboard
            try {
                await navigator.clipboard.writeText(shareUrl);
                showToast('Share link copied to clipboard!', 'success');
            } catch (error) {
                console.warn('Clipboard copy failed:', error);
                showToast('Failed to auto-copy link. Please copy manually from the modal.', 'warning');
            }

        } catch (error) {
            console.error('Error opening share modal:', error);
            showToast('An error occurred while preparing share options.', 'error');
        }
    });
});

    // Private Mode Buttons
    const privateButtons = document.querySelectorAll('.private-btn');
    privateButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteId = button.dataset.noteId;
            // 🛡️ FIX: Validate noteId
            if (!noteId || noteId.trim() === '') {
                console.error('Invalid note ID for private toggle:', noteId);
                showToast('Cannot toggle protection: Invalid note.', 'error');
                return;
            }
            const isPrivate = button.dataset.private === 'true';

            if (isPrivate) {
                const removeModalEl = document.getElementById('removePasswordModal');
                document.getElementById('noteIdForRemove').value = noteId;
                const removeModal = new bootstrap.Modal(removeModalEl);
                removeModal.show();
                setTimeout(() => {
                    document.getElementById('currentPassword')?.focus();
                }, 300);
            } else {
                const setModalEl = document.getElementById('setPrivatePasswordModal');
                document.getElementById('noteIdForPrivate').value = noteId;
                const setModal = new bootstrap.Modal(setModalEl);
                setModal.show();
                setTimeout(() => {
                    document.getElementById('newPassword1')?.focus();
                }, 300);
            }
        });
    });

    // Protected Action Buttons
    const protectedButtons = document.querySelectorAll('.protected-action-btn');
    protectedButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const isPrivate = button.dataset.isPrivate === 'true';
            const noteId = button.dataset.noteId;  // 🛡️ Extract safely
            const action = button.dataset.action;
            const url = button.dataset.url;

            // 🛡️ FIX: Validate noteId before using
            if (!noteId || noteId.trim() === '') {
                console.error('Invalid note ID:', noteId);
                showToast('Invalid note selected. Please refresh the page.', 'error');
                return;
            }

            currentAction = action;
            currentNoteId = noteId;
            currentUrl = url;

            if (isPrivate) {
                const modal = new bootstrap.Modal(document.getElementById('passwordModal'));
                modal.show();
                setTimeout(() => {
                    document.getElementById('notePassword')?.focus();
                }, 300);
            } else {
                executeAction(currentAction, currentUrl, currentNoteId);
            }
        });
    });

    // Verify Password Button
    const verifyPasswordBtn = document.getElementById('verifyPassword');
    if (verifyPasswordBtn) {
        verifyPasswordBtn.addEventListener('click', async () => {
            const password = document.getElementById('notePassword').value;
            const errorDiv = document.getElementById('passwordError');
            const button = verifyPasswordBtn;
            const spinner = button.querySelector('.spinner-border');

            if (!password) {
                errorDiv.textContent = 'Please enter a password.';
                errorDiv.classList.remove('d-none');
                return;
            }

            button.disabled = true;
            spinner.classList.remove('d-none');

            try {
                const response = await fetch('/verify_note_password', {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({ password: password, note_id: currentNoteId })
                });

                const data = await response.json();

                if (data.status === 'success') {
                    bootstrap.Modal.getInstance(document.getElementById('passwordModal')).hide();
                    executeAction(currentAction, currentUrl, currentNoteId);
                    document.getElementById('notePassword').value = '';
                    errorDiv.classList.add('d-none');
                } else {
                    errorDiv.textContent = 'Incorrect password. Please try again.';
                    errorDiv.classList.remove('d-none');
                    document.getElementById('notePassword').focus();
                }
            } catch (error) {
                console.error('Error:', error);
                errorDiv.textContent = 'An error occurred. Please try again.';
                errorDiv.classList.remove('d-none');
            } finally {
                button.disabled = false;
                spinner.classList.add('d-none');
            }
        });
    }

    // Set Password Button
    const setPasswordBtn = document.getElementById('setPassword');
    if (setPasswordBtn) {
        setPasswordBtn.addEventListener('click', async () => {
            const noteId = document.getElementById('noteIdForPrivate').value;
            const password1Input = document.getElementById('newPassword1');
            const password2Input = document.getElementById('newPassword2');
            const pwd1 = password1Input.value.trim();
            const pwd2 = password2Input.value.trim();
            const spinner = setPasswordBtn.querySelector('.spinner-border');

            console.log('Set password clicked', {noteId, pwd1Length: pwd1.length, pwd2Length: pwd2.length});

            if (pwd1 !== pwd2) {
                showToast('Passwords do not match!', 'error');
                return;
            }
            if (pwd1.length < 6) {
                showToast('Password must be at least 6 characters long!', 'error');
                return;
            }

            setPasswordBtn.disabled = true;
            spinner.classList.remove('d-none');

            try {
                const response = await fetch(`/set_note_password/${noteId}`, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({ password: pwd1 })
                });

                const data = await response.json();

                if (data.status === 'success') {
                    bootstrap.Modal.getInstance(document.getElementById('setPrivatePasswordModal')).hide();
                    updateProtectionVisuals(noteId, true);
                    showToast('Password protection enabled successfully!', 'success');
                    resetModalForms();
                } else {
                    showToast('Failed to set password: ' + data.message, 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('An error occurred while setting password.', 'error');
            } finally {
                setPasswordBtn.disabled = false;
                spinner.classList.add('d-none');
            }
        });
    }

    // Remove Password Button
    const removePasswordBtn = document.getElementById('removePassword');
    if (removePasswordBtn) {
        removePasswordBtn.addEventListener('click', async () => {
            const noteId = document.getElementById('noteIdForRemove').value;
            const password = document.getElementById('currentPassword').value;
            const errorDiv = document.getElementById('removePasswordError');
            const spinner = removePasswordBtn.querySelector('.spinner-border');

            if (!password) {
                errorDiv.textContent = 'Please enter your current password.';
                errorDiv.classList.remove('d-none');
                return;
            }

            removePasswordBtn.disabled = true;
            spinner.classList.remove('d-none');

            try {
                const response = await fetch(`/remove_note_password/${noteId}`, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({ password: password })
                });

                const data = await response.json();

                if (data.status === 'success') {
                    bootstrap.Modal.getInstance(document.getElementById('removePasswordModal')).hide();
                    updateProtectionVisuals(noteId, false);
                    showToast('Password protection removed successfully!', 'success');
                    resetModalForms();
                } else {
                    errorDiv.textContent = data.message || 'Incorrect password.';
                    errorDiv.classList.remove('d-none');
                }
            } catch (error) {
                console.error('Error:', error);
                errorDiv.textContent = 'An error occurred. Please try again.';
                errorDiv.classList.remove('d-none');
            } finally {
                removePasswordBtn.disabled = false;
                spinner.classList.add('d-none');
            }
        });
    }
});

// Keyboard Event Handlers
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.show');
        if (activeModal) {
            const modalInstance = bootstrap.Modal.getInstance(activeModal);
            if (modalInstance) {
                if (activeModal.contains(document.activeElement)) {
                    try { document.activeElement.blur(); } catch (err) {}
                }
                modalInstance.hide();
            }
        }
    }
    if (e.key === 'Enter') {
        const activeModal = document.querySelector('.modal.show');
        if (activeModal) {
            if (activeModal.id === 'passwordModal') {
                const btn = document.getElementById('verifyPassword');
                if (btn && !btn.disabled) btn.click();
            } else if (activeModal.id === 'setPrivatePasswordModal') {
                const btn = document.getElementById('setPassword');
                if (btn && !btn.disabled) btn.click();
            } else if (activeModal.id === 'removePasswordModal') {
                const btn = document.getElementById('removePassword');
                if (btn && !btn.disabled) btn.click();
            } else if (activeModal.id === 'forgotNotePasswordModal') {
                const btn = document.getElementById('sendNoteResetEmail');
                if (btn && !btn.disabled) btn.click();
            } else if (activeModal.id === 'shareModal') {
                const btn = document.getElementById('copyShareLink');
                if (btn) btn.click();
            } else if (activeModal.id === 'deleteConfirmModal') {
                const btn = document.getElementById('confirmDeleteBtn');
                if (btn && !btn.disabled) btn.click();
            }
        }
    }
});

// Modal Cleanup
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('hidden.bs.modal', function () {
        resetModalForms();
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
    });

    modal.addEventListener('shown.bs.modal', function () {
        const firstInput = modal.querySelector('input:not([type="hidden"]):not(:disabled)');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 100);
        }
    });
});

console.log('Dashboard JS fully loaded and ready');

// Additional Debug Logging
console.log('Password validation system initialized');
console.log('Sharing and download features initialized');
console.log('All event listeners attached successfully');