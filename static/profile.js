// Enhanced Profile.js - Smart & Smooth with FIXED error handling
(function() {
    'use strict';
    
    console.log('🚀 Profile.js loaded');
    
    // ========== STATE MANAGEMENT ==========
    const state = {
        isEditing: false,
        originalData: {},
        csrfToken: null
    };
    
    // ========== DOM ELEMENTS ==========
    const elements = {
        // Forms
        profileForm: document.getElementById('profileForm'),
        editProfileBtn: document.getElementById('editProfileBtn'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),
        profileFormActions: document.getElementById('profileFormActions'),
        submitBtn: document.getElementById('submitBtn'),
        
        // Profile Picture
        profilePicture: document.getElementById('profilePicture'),
        profilePictureInput: document.getElementById('profilePictureInput'),
        changePictureBtn: document.getElementById('changePictureBtn'),
        removePictureBtn: document.getElementById('removePictureBtn'),
        
        // Form Inputs - Original Fields
        username: document.getElementById('username'),
        email: document.getElementById('email'),
        
        // Form Inputs - New Profile Fields
        firstName: document.getElementById('firstName'),
        lastName: document.getElementById('lastName'),
        mobileNumber: document.getElementById('mobileNumber'),
        bio: document.getElementById('bio'),
        bioCharCount: document.getElementById('bioCharCount'),
        
        // Stats
        totalNotes: document.getElementById('totalNotesStat'),
        lastActivity: document.getElementById('lastActivityStat'),
        tierStat: document.getElementById('tierStat'),
        
        // Account Deletion
        confirmUsername: document.getElementById('confirmUsername'),
        confirmDeleteBtn: document.getElementById('confirmDeleteAccount'),
        expectedUsername: document.getElementById('confirmUsernameDisplay'),
        deleteModal: document.getElementById('deleteAccountModal'),
        
        // Toasts
        successToast: document.getElementById('successToast'),
        errorToast: document.getElementById('errorToast'),
        infoToast: document.getElementById('infoToast')
    };
    
    // ========== INITIALIZATION ==========
    function init() {
        console.log('🎬 Initializing profile page...');
        
        // Get CSRF token
        state.csrfToken = getCSRFToken();
        
        // Load stats with fallback
        loadProfileStats();
        
        // Update bio character count
        updateBioCharCount();
        
        // Store original form data
        saveOriginalData();
        
        // Attach event listeners
        attachEventListeners();
        
        console.log('✅ Profile page initialized');
    }
    
    // ========== UTILITY FUNCTIONS ==========
    function getCSRFToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrf_token') {
                return decodeURIComponent(value);
            }
        }
        
        console.warn('⚠️ CSRF token not found');
        return null;
    }
    
    function showToast(type, message) {
        console.log(`📢 Toast: ${type} - ${message}`);
        
        const toastEl = elements[`${type}Toast`];
        const messageEl = document.getElementById(`${type}Message`);
        
        if (!toastEl || !messageEl) return;
        
        messageEl.textContent = message;
        const toast = new bootstrap.Toast(toastEl, { delay: type === 'error' ? 4000 : 3000 });
        toast.show();
    }
    
    function setLoading(button, isLoading) {
        if (!button) return;
        
        const spinner = button.querySelector('.spinner-border');
        const icon = button.querySelector('i:not(.spinner-border)');
        
        if (spinner) {
            spinner.classList.toggle('d-none', !isLoading);
        }
        if (icon) {
            icon.classList.toggle('d-none', isLoading);
        }
        
        button.disabled = isLoading;
    }
    
    function animateValue(element, start, end, duration = 1000) {
        if (!element) return;
        
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                current = end;
                clearInterval(timer);
            }
            element.textContent = Math.round(current);
        }, 16);
    }
    
    // ========== PROFILE STATS ==========
    async function loadProfileStats() {
        console.log('📊 Loading profile stats...');
        // First, use the stats already rendered on the page
        loadStatsFromPage();
        // Then, optionally fetch fresh stats from the API
        try {
            const response = await fetch('/api/profile/stats', {
                method: 'GET',
                headers: {
                    'X-CSRFToken': state.csrfToken
                }
            });
            if (response.ok) {
                const data = await response.json();
                console.log('📥 Fresh stats received:', data);
                // Update with fresh data if available
                if (data.total_notes !== undefined && elements.totalNotes) {
                    const currentValue = parseInt(elements.totalNotes.textContent) || 0;
                    if (data.total_notes !== currentValue) {
                        animateValue(elements.totalNotes, 0, data.total_notes, 1000);
                    }
                }
                if (data.last_activity && elements.lastActivity) {
                    elements.lastActivity.textContent = data.last_activity;
                }
                if (data.tier && elements.tierStat) {
                    elements.tierStat.textContent = data.tier;
                }
            }
        } catch (error) {
            // Silently fail - we already have page data
            console.log('ℹ️ Could not fetch fresh stats (using page data):', error.message);
        }
    }
    
    // FIXED: Fallback function to load stats from page HTML
    function loadStatsFromPage() {
        console.log('📄 Loading stats from page HTML...');
        
        // The stats are already rendered in the HTML by Flask
        // We just need to check if they exist and optionally animate them
        if (elements.totalNotes) {
            const currentValue = parseInt(elements.totalNotes.textContent) || 0;
            if (currentValue > 0) {
                // Animate from 0 to current value
                animateValue(elements.totalNotes, 0, currentValue, 1500);
            }
            // If it's 0, leave it as is (already correct)
        }
        
        // Last activity is already set by Flask, leave it as is
        if (elements.lastActivity && elements.lastActivity.textContent === 'Never') {
            // Optionally update the text to be more friendly
            elements.lastActivity.textContent = 'No activity yet';
        }
        
        console.log('✅ Stats loaded from page');
    }
    
    // ========== FORM MANAGEMENT ==========
    function saveOriginalData() {
        state.originalData = {
            firstName: elements.firstName?.value || '',
            lastName: elements.lastName?.value || '',
            mobileNumber: elements.mobileNumber?.value || '',
            bio: elements.bio?.value || ''
        };
        console.log('💾 Original data saved:', state.originalData);
    }
    
    function updateBioCharCount() {
        if (!elements.bio || !elements.bioCharCount) return;
        
        const length = elements.bio.value.length;
        const maxLength = elements.bio.maxLength || 150;
        
        elements.bioCharCount.textContent = `${length}/${maxLength}`;
        
        // Change color if near limit
        if (length > maxLength * 0.8) {
            elements.bioCharCount.classList.add('text-warning');
        } else {
            elements.bioCharCount.classList.remove('text-warning');
        }
    }
    
    function checkFormChanges() {
        if (!state.isEditing) return;
        
        const hasChanges = 
            (elements.firstName?.value.trim() || '') !== state.originalData.firstName ||
            (elements.lastName?.value.trim() || '') !== state.originalData.lastName ||
            (elements.mobileNumber?.value.trim() || '') !== state.originalData.mobileNumber ||
            (elements.bio?.value.trim() || '') !== state.originalData.bio;
        
        if (elements.submitBtn) {
            elements.submitBtn.disabled = !hasChanges;
        }
        
        console.log('🔍 Form changes detected:', hasChanges);
    }
    
    function enableEditMode() {
        console.log('✏️ Enabling edit mode...');
        
        state.isEditing = true;
        
        // Enable editing for editable fields
        const editableFields = [
            elements.firstName,
            elements.lastName,
            elements.mobileNumber,
            elements.bio
        ];
        
        editableFields.forEach(field => {
            if (field) {
                field.removeAttribute('readonly');
                field.classList.add('form-input-editable');
                // Add input listener to detect changes
                field.addEventListener('input', checkFormChanges);
            }
        });
        
        // Show form actions
        if (elements.profileFormActions) {
            elements.profileFormActions.classList.remove('d-none');
        }
        
        // Update edit button
        if (elements.editProfileBtn) {
            elements.editProfileBtn.classList.add('d-none');
        }
        
        // Focus on first editable field
        if (elements.firstName) {
            elements.firstName.focus();
        }
        
        console.log('✅ Edit mode enabled');
    }
    
    function disableEditMode() {
        console.log('🔒 Disabling edit mode...');
        
        state.isEditing = false;
        
        // Disable editing for all fields
        const editableFields = [
            elements.firstName,
            elements.lastName,
            elements.mobileNumber,
            elements.bio
        ];
        
        editableFields.forEach(field => {
            if (field) {
                field.setAttribute('readonly', '');
                field.classList.remove('form-input-editable');
                // Remove input listener
                field.removeEventListener('input', checkFormChanges);
            }
        });
        
        // Reset submit button
        if (elements.submitBtn) {
            elements.submitBtn.disabled = true;
        }
        
        // Hide form actions
        if (elements.profileFormActions) {
            elements.profileFormActions.classList.add('d-none');
        }
        
        // Update edit button
        if (elements.editProfileBtn) {
            elements.editProfileBtn.classList.remove('d-none');
        }
        
        console.log('✅ Edit mode disabled');
    }
    
    function restoreOriginalData() {
        console.log('↩️ Restoring original data...');
        
        if (elements.firstName) elements.firstName.value = state.originalData.firstName;
        if (elements.lastName) elements.lastName.value = state.originalData.lastName;
        if (elements.mobileNumber) elements.mobileNumber.value = state.originalData.mobileNumber;
        if (elements.bio) elements.bio.value = state.originalData.bio;
        
        updateBioCharCount();
    }
    
    // ========== FORM SUBMISSION ==========
    async function handleProfileSubmit(e) {
        e.preventDefault();
        
        if (!state.isEditing) {
            console.log('⚠️ Not in edit mode');
            return;
        }
        
        console.log('📤 Submitting profile data...');
        
        if (!elements.submitBtn) return;
        setLoading(elements.submitBtn, true);
        
        try {
            const formData = {
                first_name: elements.firstName?.value.trim() || '',
                last_name: elements.lastName?.value.trim() || '',
                mobile_number: elements.mobileNumber?.value.trim() || '',
                bio: elements.bio?.value.trim() || ''
            };
            
            console.log('📋 Form data to submit:', formData);
            
            const response = await fetch('/api/profile/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': state.csrfToken
                },
                body: JSON.stringify(formData)
            });
            
            // Check if response is actually JSON
            const contentType = response.headers.get('content-type');
            console.log('📥 Response content-type:', contentType);
            console.log('📥 Response status:', response.status);
            
            if (!contentType || !contentType.includes('application/json')) {
                // Response is not JSON - likely HTML error page
                const htmlText = await response.text();
                console.error('❌ Expected JSON but got HTML:', htmlText.substring(0, 200));
                
                // Check if it's a redirect or authentication error
                if (response.status === 401 || htmlText.includes('login') || htmlText.includes('Login')) {
                    throw new Error('Session expired. Please login again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Please check your permissions.');
                } else if (response.status === 404) {
                    throw new Error('API endpoint not found. Please contact support.');
                } else if (response.status === 405) {
                    throw new Error('Method not allowed. The API may need PUT method enabled.');
                } else {
                    throw new Error(`Server error (${response.status}). Please try again later.`);
                }
            }
            
            const data = await response.json();
            console.log('📥 Update response:', data);
            
            if (data.success) {
                // Update original data with new values
                saveOriginalData();
                
                // Disable edit mode
                disableEditMode();
                
                showToast('success', data.message || 'Profile updated successfully!');
                console.log('✅ Profile updated');
            } else {
                throw new Error(data.message || 'Update failed');
            }
            
        } catch (error) {
            console.error('❌ Submit error:', error);
            showToast('error', error.message || 'Failed to update profile');
        } finally {
            setLoading(elements.submitBtn, false);
        }
    }
    
    // ========== PROFILE PICTURE HANDLING ==========
    function handleProfilePictureChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        
        console.log('🖼️ Profile picture selected:', file.name);
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            showToast('error', 'Please select an image file');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB
            showToast('error', 'File size must be less than 5MB');
            return;
        }
        
        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            if (elements.profilePicture) {
                elements.profilePicture.src = e.target.result;
            }
        };
        reader.readAsDataURL(file);
        
        // Upload
        uploadProfilePicture(file);
    }
    
    async function uploadProfilePicture(file) {
        console.log('📤 Uploading profile picture...');
        
        if (!elements.submitBtn) return;
        
        const formData = new FormData();
        formData.append('picture', file);
        
        try {
            const response = await fetch('/api/profile/upload-picture', {
                method: 'POST',
                headers: { 'X-CSRFToken': state.csrfToken },
                body: formData
            });
            
            const data = await response.json();
            console.log('📥 Upload response:', data);
            
            if (data.success) {
                showToast('success', data.message || 'Profile picture updated!');
                
                if (data.new_url) {
                    // Update all profile pictures on page
                    const allImages = document.querySelectorAll('img[alt*="Profile"], img[alt*="profile"], img[alt*="Avatar"], img[alt*="avatar"]');
                    allImages.forEach(img => {
                        img.src = data.new_url + '?t=' + new Date().getTime(); // Cache busting
                    });
                    
                    if (elements.profilePicture && elements.profilePicture.tagName === 'IMG') {
                        elements.profilePicture.src = data.new_url + '?t=' + new Date().getTime();
                    }
                }
                
                // Show remove button
                if (elements.removePictureBtn) {
                    elements.removePictureBtn.classList.remove('d-none');
                }
            } else {
                throw new Error(data.message || 'Upload failed');
            }
            
        } catch (error) {
            console.error('❌ Upload error:', error);
            showToast('error', error.message || 'Failed to upload picture');
            // Reset file input
            if (elements.profilePictureInput) {
                elements.profilePictureInput.value = '';
            }
        }
    }
    
    async function removeProfilePicture() {
        if (!confirm('Remove your profile picture?')) return;
        
        console.log('🗑️ Removing profile picture...');
        
        try {
            const response = await fetch('/api/profile/remove-picture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': state.csrfToken
                }
            });
            
            const data = await response.json();
            console.log('📥 Remove response:', data);
            
            if (data.success) {
                showToast('success', 'Profile picture removed!');
                
                // Create initial div
                const username = elements.username?.value || 'U';
                const initial = username.charAt(0).toUpperCase();
                
                const div = document.createElement('div');
                div.id = 'profilePicture';
                div.className = 'profile-picture-default';
                div.textContent = initial;
                
                if (elements.profilePicture && elements.profilePicture.parentNode) {
                    elements.profilePicture.parentNode.replaceChild(div, elements.profilePicture);
                    elements.profilePicture = div;
                }
                
                if (elements.removePictureBtn) {
                    elements.removePictureBtn.classList.add('d-none');
                }
                
                // Update header pictures
                const allImages = document.querySelectorAll('img[alt*="Profile"], img[alt*="profile"], img[alt*="Avatar"], img[alt*="avatar"]');
                allImages.forEach(img => {
                    if (img.id !== 'profilePicture' && img.parentNode) {
                        const headerDiv = document.createElement('div');
                        headerDiv.className = 'header-avatar-default';
                        headerDiv.textContent = initial;
                        img.parentNode.replaceChild(headerDiv, img);
                    }
                });
            } else {
                throw new Error(data.message || 'Failed to remove');
            }
            
        } catch (error) {
            console.error('❌ Remove error:', error);
            showToast('error', error.message || 'Failed to remove picture');
        }
    }
    
    // ========== ACCOUNT DELETION ==========
    function validateUsernameInput() {
        if (!elements.confirmUsername || !elements.confirmDeleteBtn || !elements.expectedUsername) return;
        
        const expected = elements.expectedUsername.dataset.username || 
                        elements.expectedUsername.textContent.trim();
        const entered = elements.confirmUsername.value.trim();
        const isValid = entered === expected;
        
        elements.confirmDeleteBtn.disabled = !isValid;
        
        console.log(`🔍 Validation: entered="${entered}", expected="${expected}", valid=${isValid}`);
    }
    
    async function handleAccountDeletion() {
        if (!elements.confirmDeleteBtn || !elements.confirmUsername) return;
        
        console.log('⚠️ Account deletion initiated...');
        
        setLoading(elements.confirmDeleteBtn, true);
        
        try {
            const response = await fetch('/api/account/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': state.csrfToken
                },
                body: JSON.stringify({
                    confirm_username: elements.confirmUsername.value.trim()
                })
            });
            
            const data = await response.json();
            console.log('📥 Delete response:', data);
            
            if (data.success) {
                showToast('success', 'Account deleted. Redirecting...');
                setTimeout(() => window.location.href = '/', 2000);
            } else {
                throw new Error(data.message || 'Failed to delete account');
            }
            
        } catch (error) {
            console.error('❌ Delete error:', error);
            showToast('error', error.message || 'Failed to delete account');
            setLoading(elements.confirmDeleteBtn, false);
        }
    }
    
    // ========== EVENT LISTENERS ==========
    function attachEventListeners() {
        // Edit mode
        if (elements.editProfileBtn) {
            elements.editProfileBtn.addEventListener('click', enableEditMode);
        }
        
        if (elements.cancelEditBtn) {
            elements.cancelEditBtn.addEventListener('click', () => {
                restoreOriginalData();
                disableEditMode();
            });
        }
        
        // Form submit
        if (elements.profileForm) {
            elements.profileForm.addEventListener('submit', handleProfileSubmit);
        }
        
        // Bio counter
        if (elements.bio) {
            elements.bio.addEventListener('input', updateBioCharCount);
        }
        
        // Profile picture
        if (elements.changePictureBtn && elements.profilePictureInput) {
            // Find all change picture buttons
            document.querySelectorAll('#changePictureBtn').forEach(btn => {
                btn.addEventListener('click', () => {
                    elements.profilePictureInput.click();
                });
            });
            
            elements.profilePictureInput.addEventListener('change', handleProfilePictureChange);
        }
        
        if (elements.removePictureBtn) {
            elements.removePictureBtn.addEventListener('click', removeProfilePicture);
        }
        
        // Account deletion
        if (elements.confirmUsername) {
            elements.confirmUsername.addEventListener('input', validateUsernameInput);
        }
        
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', handleAccountDeletion);
        }
        
        // Modal events
        if (elements.deleteModal) {
            elements.deleteModal.addEventListener('shown.bs.modal', () => {
                if (elements.confirmUsername) {
                    elements.confirmUsername.value = '';
                    elements.confirmUsername.focus();
                }
            });
            
            elements.deleteModal.addEventListener('hidden.bs.modal', () => {
                if (elements.confirmUsername) {
                    elements.confirmUsername.value = '';
                }
                if (elements.confirmDeleteBtn) {
                    elements.confirmDeleteBtn.disabled = true;
                }
            });
        }
        
        console.log('✅ Event listeners attached');
    }
    
    // ========== START ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();