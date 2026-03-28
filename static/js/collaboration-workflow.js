/**
 * ===================================================================
 * 🔥 COLLABORATION SYSTEM - REAL MODE ONLY (PRODUCTION)
 * ===================================================================
 * Features: Real-time Collaboration, Email Invitations, Workflow
 * Mode: REAL MODE ONLY - No mock, no testing, pure production
 */

class CollaborationSystem {
    constructor() {
        this.users = new Map();
        this.invitations = new Map();
        this.workflowStages = ['Draft', 'Review', 'Approval', 'Published'];
        this.currentStage = 0;
        this.securityLog = [];
        this.approvers = [];
        
        // API Configuration
        this.api = {
            baseURL: window.location.origin,
            endpoints: {
                sendEmail: '/api/send-invitation-email',
                emailStatus: '/api/email-status',
                emailHealth: '/api/email-health',
                pendingInvitations: '/api/pending-invitations'
            }
        };
        
        // Rate limiting
        this.emailRateLimit = new Map();
        this.maxEmailsPerHour = 100;
        
        this.init();
        console.log('🔥 Collaboration System (REAL MODE ONLY) initialized');
    }

    // ==================== INITIALIZATION ====================

    init() {
        // Add current user
        this.addUser({
            id: 'user_1',
            name: localStorage.getItem('username') || 'You',
            color: '#FF6B6B',
            status: 'active',
            email: localStorage.getItem('userEmail') || 'current@user.local'
        });

        // Check email service on load
        this.checkEmailService();
        
        console.log('✅ System initialized');
    }

    // ==================== EMAIL SERVICE HEALTH ====================

    async checkEmailService() {
        try {
            const response = await fetch(`${this.api.baseURL}${this.api.endpoints.emailHealth}`);
            const data = await response.json();
            
            if (data.mail_configured) {
                console.log('✅ Email service configured:', {
                    server: data.mail_server,
                    port: data.mail_port,
                    tls: data.mail_use_tls
                });
            } else {
                console.warn('⚠️ Email service not configured');
            }
        } catch (error) {
            console.error('❌ Could not check email service:', error);
        }
    }

    // ==================== ADD COLLABORATOR ====================

    addCollaborator() {
        const existing = document.getElementById('addCollabModal');
        if (existing) {
            existing.style.display = 'block';
            return;
        }

        const html = `
            <div id="addCollabModal" class="modal" tabindex="-1" style="display:none; z-index:9999;">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">👥 Add Collaborator</h5>
                            <button type="button" class="btn-close"
                                onclick="document.getElementById('addCollabModal')?.remove()"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Email Address</label>
                                <input type="email" id="collabEmail" class="form-control" 
                                       placeholder="user@example.com" required/>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Permission Level</label>
                                <select id="collabPermission" class="form-select">
                                    <option value="view">👁️ View Only</option>
                                    <option value="comment">💬 Comment</option>
                                    <option value="edit" selected>✏️ Edit</option>
                                    <option value="admin">⚙️ Admin</option>
                                </select>
                            </div>
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" id="sendEmail" checked />
                                <label class="form-check-label">Send invitation email</label>
                            </div>
                            
                            <!-- Status Display -->
                            <div id="statusContainer" style="display:none; margin-top:15px;">
                                <div id="statusMessage" style="padding:10px; background:#f0f0f0; 
                                                               border-radius:4px; font-size:14px;"></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" 
                                onclick="document.getElementById('addCollabModal')?.remove()">
                                Cancel
                            </button>
                            <button class="btn btn-primary" id="sendBtn"
                                onclick="window.collaboration.inviteCollaborator()">
                                📧 Send Invitation
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('addCollabModal').style.display = 'block';
    }

    // ==================== INVITE COLLABORATOR (REAL MODE) ====================

    async inviteCollaborator() {
        const emailEl = document.getElementById('collabEmail');
        const permEl = document.getElementById('collabPermission');
        const sendEmailEl = document.getElementById('sendEmail');
        const btn = document.getElementById('sendBtn');

        const email = emailEl.value.trim();
        const permission = permEl.value;
        const shouldSendEmail = sendEmailEl.checked;

        // ✅ VALIDATION: Permission must be one of allowed values
        const validPermissions = ['view', 'comment', 'edit', 'admin'];
        if (!validPermissions.includes(permission)) {
            this.showStatus('❌ Invalid permission level selected', 'error');
            return;
        }

        // Validation
        if (!email) {
            this.showStatus('❌ Please enter email address', 'error');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showStatus('❌ Invalid email address', 'error');
            return;
        }

        // Check if already a collaborator
        if (Array.from(this.users.values()).some(u => u.email === email)) {
            this.showStatus('❌ Already a collaborator', 'error');
            return;
        }

        // Disable button and show loading
        btn.disabled = true;
        btn.innerHTML = '⏳ Sending...';

        try {
            // Create user object
            const userId = 'user_' + Date.now();
            const invitationToken = this.generateInvitationToken(email, permission);
            
            const newUser = {
                id: userId,
                name: email.split('@')[0],
                email: email,
                permission: permission,  // ✅ STORE PERMISSION
                color: this.getRandomColor(),
                status: 'pending',
                invitedAt: new Date().toISOString(),
                invitationToken: invitationToken  // ✅ ADD SECURITY TOKEN
            };

            // Add to users map
            this.addUser(newUser);

            // Store invitation with all details
            this.invitations.set(email, {
                userId: userId,
                email: email,
                permission: permission,  // ✅ CRITICAL: Store permission
                invitedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'pending',
                token: invitationToken  // ✅ Security token
            });

            // Log event with permission
            this.logEvent('COLLABORATOR_INVITED', {
                email: email,
                permission: permission,  // ✅ LOG PERMISSION
                invitedBy: localStorage.getItem('username') || 'Unknown',
                token: invitationToken
            });

            // Determine note_id if present in URL or meta tag
            let noteId = null;
            try {
                const meta = document.querySelector('meta[name="note-id"]');
                if (meta && meta.content) noteId = meta.content;
            } catch (e) {}

            if (!noteId) {
                // Try to extract from URL patterns like /edit_note/123 or /note/123
                const m = window.location.pathname.match(/(?:edit_note|note|view_note)\/(\d+)/);
                if (m && m[1]) noteId = m[1];
            }

            // Send email if requested (include noteId for server-side persistence)
            if (shouldSendEmail) {
                await this.sendInvitationEmail(email, permission, userId, invitationToken, noteId);
            }

            this.showStatus(`✅ Collaborator added with "${permission}" permission!${shouldSendEmail ? ' 📧 Invitation sent' : ''}`, 'success');
            
            // Close modal after 2 seconds
            setTimeout(() => {
                document.getElementById('addCollabModal')?.remove();
                btn.disabled = false;
                btn.innerHTML = '📧 Send Invitation';
            }, 2000);

        } catch (error) {
            console.error('❌ Error:', error);
            this.showStatus(`❌ ${error.message}`, 'error');
            btn.disabled = false;
            btn.innerHTML = '📧 Send Invitation';
        }
    }

    // ✅ NEW: Generate invitation token for security
    generateInvitationToken(email, permission) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const token = btoa(`${email}|${permission}|${timestamp}|${random}`);
        return token;
    }

    // ==================== SEND INVITATION EMAIL (REAL MODE) ====================

   // collaboration-real-mode-only.js में:

async sendInvitationEmail(email, permission, userId, token, noteId = null) {
    console.log('📧 Sending real email to:', email);

    if (!this.checkRateLimit(email)) {
        throw new Error('Too many invitations. Try again later.');
    }

        const emailData = {
        to: email,
        subject: `You've been invited to collaborate!`,
        body: this.generateEmailHTML(email, permission),
        permission: permission,
        invitedBy: localStorage.getItem('username') || 'Unknown',
            note_id: noteId,
        documentTitle: document.title || 'Document',
        userId: userId
    };

    try {
        // 🔥 CSRF Token को HTML से निकालो
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                         document.querySelector('input[name="csrf_token"]')?.value ||
                         '';

        console.log('🔐 CSRF Token:', csrfToken ? 'Present' : 'Missing');

        const response = await fetch(`${this.api.baseURL}${this.api.endpoints.sendEmail}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': csrfToken  // ← ADD THIS
            },
            body: JSON.stringify(emailData),
            credentials: 'same-origin'
        });

        const responseText = await response.text();
        console.log('Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${responseText}`);
        }

        const result = JSON.parse(responseText);
        console.log('✅ Email sent successfully:', result);
        
        this.logEvent('EMAIL_SENT', {
            to: email,
            messageId: result.messageId,
            provider: result.provider
        });

        return result;

    } catch (error) {
        console.error('❌ Email sending failed:', error);
        this.logEvent('EMAIL_SEND_FAILED', {
            to: email,
            error: error.message
        });
        throw error;
    }
}

    // ==================== EMAIL TEMPLATE ====================

    generateEmailHTML(email, permission) {
        const docName = document.title || 'Document';
        const sender = localStorage.getItem('username') || 'Someone';

        return `
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .body { background: #f9f9f9; padding: 20px; }
        .footer { background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; }
        .button { background: #28a745; color: white; padding: 10px 20px; border-radius: 5px; 
                 text-decoration: none; display: inline-block; margin: 20px 0; }
        .badge { background: #007bff; color: white; padding: 5px 10px; border-radius: 3px; 
                font-weight: bold; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>👋 You're Invited to Collaborate</h2>
        </div>
        
        <div class="body">
            <p>Hello ${email.split('@')[0]},</p>
            
            <p>${sender} has invited you to collaborate on <strong>"${docName}"</strong>.</p>
            
            <p>
                Your Role: <span class="badge">${permission.toUpperCase()}</span>
            </p>
            
            <h3>📋 What You Can Do:</h3>
            <ul>
                ${this.getPermissionsList(permission)}
            </ul>
            
            <p style="margin-top: 30px; text-align: center;">
                <a href="${window.location.origin}/accept-invitation?email=${encodeURIComponent(email)}" 
                   class="button">✅ Accept Invitation</a>
            </p>
            
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
                <strong>Note:</strong> This invitation expires in 7 days.
            </p>
        </div>
        
        <div class="footer">
            <p>© 2024 Collaboration System. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    getPermissionsList(permission) {
        const permissions = {
            'view': '<li>View document</li><li>See other comments</li>',
            'comment': '<li>View document</li><li>Add/edit comments</li><li>See version history</li>',
            'edit': '<li>View document</li><li>Add/edit comments</li><li>Edit content</li><li>See version history</li>',
            'admin': '<li>All of above</li><li>Manage collaborators</li><li>Change settings</li>'
        };
        return permissions[permission] || '<li>Basic access</li>';
    }

    // ==================== VALIDATION & RATE LIMITING ====================

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    checkRateLimit(email) {
        const now = Date.now();
        const hour = 60 * 60 * 1000;

        if (!this.emailRateLimit.has(email)) {
            this.emailRateLimit.set(email, { count: 1, timestamp: now });
            return true;
        }

        const record = this.emailRateLimit.get(email);
        
        if (now - record.timestamp > hour) {
            record.count = 1;
            record.timestamp = now;
            return true;
        }

        if (record.count >= this.maxEmailsPerHour) {
            return false;
        }

        record.count++;
        return true;
    }

    // ==================== USER MANAGEMENT ====================

    addUser(user) {
        if (!user || !user.id) return;
        this.users.set(user.id, user);
        console.log(`✅ User added: ${user.name}`);
    }

    getRandomColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    removeUser(userId) {
        if (!confirm('Remove this collaborator?')) return;
        
        const user = this.users.get(userId);
        this.users.delete(userId);
        
        this.logEvent('COLLABORATOR_REMOVED', {
            email: user?.email,
            removedBy: localStorage.getItem('username') || 'Unknown'
        });

        document.getElementById('usersPanel')?.remove();
        this.showActiveUsers();
    }

    // ==================== SHOW ACTIVE USERS ====================

    showActiveUsers() {
        document.getElementById('usersPanel')?.remove();

        const activeCount = Array.from(this.users.values()).filter(u => u.status === 'active').length;
        const pendingCount = this.invitations.size;

        const html = `
            <div id="usersPanel"
                 style="position:fixed; right:0; top:60px; width:350px;
                        height:calc(100vh - 60px); background:white;
                        border-left:1px solid #ddd; overflow-y:auto;
                        box-shadow:-2px 0 5px rgba(0,0,0,0.1); z-index:999;">
                <div style="padding:15px; border-bottom:1px solid #ddd;">
                    <h5>👥 Active Users (${this.users.size})</h5>
                    <small style="color:#666;">
                        Active: ${activeCount} | Pending: ${pendingCount}
                    </small>
                </div>

                <div style="padding:10px;">
                    <button class="btn btn-sm btn-primary"
                        onclick="window.collaboration.addCollaborator()"
                        style="width:100%; margin-bottom:10px;">
                        ➕ Add Collaborator
                    </button>
                </div>

                <div style="padding:10px;">
                    ${Array.from(this.users.values())
                        .filter(u => u.status === 'active')
                        .map(user => `
                        <div style="padding:10px; border:1px solid #e0e0e0;
                                    margin-bottom:10px; border-radius:4px;">
                            <div style="display:flex; gap:10px; align-items:center;">
                                <div style="width:30px; height:30px;
                                            background:${user.color};
                                            border-radius:50%;
                                            color:#fff; font-weight:bold;
                                            display:flex; align-items:center;
                                            justify-content:center;">
                                    ${user.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div style="flex:1;">
                                    <strong>${user.name}</strong><br>
                                    <small>${user.permission}</small>
                                </div>
                                <button class="btn btn-sm btn-outline-danger"
                                    onclick="window.collaboration.removeUser('${user.id}')"
                                    style="padding:2px 8px;">✕</button>
                            </div>
                        </div>
                    `).join('')}
                    
                    ${pendingCount > 0 ? `
                        <h6 style="margin-top:20px; border-top:1px solid #ddd; padding-top:10px;">
                            ⏳ Pending (${pendingCount})
                        </h6>
                        ${Array.from(this.invitations.values()).map(inv => `
                            <div style="padding:8px; background:#fff3cd; border:1px solid #ffc107;
                                        margin-bottom:8px; border-radius:4px; font-size:12px;">
                                📧 ${inv.email}<br>
                                <strong>${inv.permission}</strong>
                            </div>
                        `).join('')}
                    ` : ''}
                </div>

                <button onclick="document.getElementById('usersPanel')?.remove()"
                    style="position:absolute; top:10px; right:10px;
                           background:none; border:none; font-size:20px;
                           cursor:pointer;">×</button>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    }

    // ==================== WORKFLOW MANAGEMENT ====================

    openWorkflowManager() {
        const existing = document.getElementById('workflowModal');
        if (existing) {
            existing.style.display = 'block';
            return;
        }

        const html = `
            <div id="workflowModal" class="modal" tabindex="-1" style="display:none; z-index:9999;">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">📊 Workflow</h5>
                            <button class="btn-close"
                                onclick="document.getElementById('workflowModal')?.remove()"></button>
                        </div>
                        <div class="modal-body">
                            <h6>Current: <strong>${this.workflowStages[this.currentStage]}</strong></h6>
                            <div style="margin:20px 0;">
                                ${this.workflowStages.map((s, i) => `
                                    <div style="display:flex; align-items:center; margin-bottom:15px;">
                                        <div style="width:30px; height:30px; border-radius:50%;
                                                    background:${i <= this.currentStage ? '#28a745' : '#ddd'};
                                                    color:white; display:flex; align-items:center;
                                                    justify-content:center; font-weight:bold;">
                                            ${i <= this.currentStage ? '✓' : i + 1}
                                        </div>
                                        <div style="margin-left:15px;"><strong>${s}</strong></div>
                                    </div>
                                `).join('')}
                            </div>
                            ${this.approvers.length > 0 ? `
                                <h6>Approvers</h6>
                                <div style="background:#f5f5f5; padding:10px; border-radius:4px;">
                                    ${this.approvers.map(a => `<div>✓ ${a}</div>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline-secondary"
                                onclick="window.collaboration.requestApproval()">
                                Request Approval
                            </button>
                            <button class="btn btn-primary"
                                onclick="window.collaboration.advanceWorkflow()">
                                Next Stage
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('workflowModal').style.display = 'block';
    }

    requestApproval() {
        const approver = prompt('Enter approver email:');
        if (!approver) return;

        this.approvers.push(approver);
        this.logEvent('APPROVAL_REQUESTED', { approver });
        alert(`✅ Approval requested from ${approver}`);
        
        document.getElementById('workflowModal')?.remove();
        this.openWorkflowManager();
    }

    advanceWorkflow() {
        if (this.currentStage < this.workflowStages.length - 1) {
            this.currentStage++;
            this.logEvent('WORKFLOW_ADVANCED', {
                newStage: this.workflowStages[this.currentStage]
            });
            alert(`✅ Advanced to: ${this.workflowStages[this.currentStage]}`);
            document.getElementById('workflowModal')?.remove();
            this.openWorkflowManager();
        } else {
            alert('⚠️ Already at final stage!');
        }
    }

    openSecuritySettings() {
        alert('🔐 Security Settings Panel - Coming Soon');
    }

    // ==================== UI HELPERS ====================

    showStatus(message, type = 'info') {
        const container = document.getElementById('statusContainer');
        const msgEl = document.getElementById('statusMessage');
        
        if (container && msgEl) {
            container.style.display = 'block';
            container.style.background = type === 'error' ? '#f8d7da' : 
                                        type === 'success' ? '#d4edda' : '#f0f0f0';
            msgEl.style.color = type === 'error' ? '#721c24' : 
                               type === 'success' ? '#155724' : '#666';
            msgEl.textContent = message;
        }
    }

    // ==================== LOGGING ====================

    logEvent(event, details) {
        const log = {
            timestamp: new Date().toISOString(),
            event: event,
            details: details,
            user: localStorage.getItem('username') || 'Unknown'
        };
        
        this.securityLog.push(log);
        console.log(`📋 [${event}]`, details);
    }
}

// ==================== INITIALIZATION ====================

function initializeCollaboration() {
    if (window.collaboration) {
        console.log('✅ Collaboration already initialized');
        return;
    }

    window.collaboration = new CollaborationSystem();
    console.log('✅ Collaboration System Ready (REAL MODE ONLY)');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCollaboration);
} else {
    setTimeout(initializeCollaboration, 0);
}

// Make available globally
window.initializeCollaboration = initializeCollaboration;