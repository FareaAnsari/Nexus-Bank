// Core Application State
const appState = {
    hospitals: {},
    currentHospitalId: null,
    loggedInDoctor: null,
    loggedInDonor: null,
    loggedInPatient: null, // New Patient State
    bloodGroups: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
};

// Application Logic
const app = {
    async init() {
        this.bindEvents();
        await this.loadHospitals();

        // Check for saved session
        const savedPatient = localStorage.getItem('patientAccount');
        if (savedPatient) {
            appState.loggedInPatient = JSON.parse(savedPatient);
            this.updatePatientDashboard();
        }

        // Handle emergency form submission
        document.getElementById('emergency-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmergencySearch();
        });

        // --- Patient Portal Events ---
        document.getElementById('tab-patient-login')?.addEventListener('click', () => this.togglePatientAuthTab('login'));
        document.getElementById('tab-patient-register')?.addEventListener('click', () => this.togglePatientAuthTab('register'));

        document.getElementById('patient-login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePatientLogin();
        });
        document.getElementById('patient-register-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePatientRegister();
        });

        // Auth form submissions
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Forgot Password Action (OTP Request)
        document.getElementById('request-otp-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.requestPasswordReset();
        });

        // Verify OTP and Execute Reset Action
        document.getElementById('verify-reset-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitPasswordReset();
        });

        // Add domain hint helper and new hospital fields toggle
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
        // Toggle custom hospital fields when "Other" is selected
        document.getElementById('register-hospital').addEventListener('change', (e) => {
            const hid = e.target.value;
            const newHospFields = document.getElementById('new-hospital-fields');
            
            if (hid === 'other') {
                newHospFields.classList.remove('hidden');
            } else {
                newHospFields.classList.add('hidden');
            }
        });

        // Handle patient request form submission (Modal)
        document.getElementById('patient-request-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitPatientRequest();
        });

        // Handle inline searching of patient results
        const filterEl = document.getElementById('patient-hospital-filter');
        if (filterEl) {
            filterEl.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const cards = document.querySelectorAll('#results-container .result-card');
                cards.forEach(card => {
                    const name = card.querySelector('h4').textContent.toLowerCase();
                    if (name.includes(query)) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }

        // --- Donor Portal Events ---
        document.getElementById('tab-donor-login')?.addEventListener('click', () => this.toggleDonorAuthTab('login'));
        document.getElementById('tab-donor-register')?.addEventListener('click', () => this.toggleDonorAuthTab('register'));

        document.getElementById('donor-login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDonorLogin();
        });
        document.getElementById('donor-register-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDonorRegister();
        });

        // Doctor Logs Formal Donation
        document.getElementById('log-donation-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogDonation();
        });

        // Donor Password Reset Listeners
        document.getElementById('donor-request-otp-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDonorRequestOTP();
        });
        document.getElementById('donor-verify-reset-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDonorResetPassword();
        });
    },

    bindEvents() {
        // Navigation
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                this.navigate(target);

                navBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });
    },

    navigate(sectionId) {
        const sections = document.querySelectorAll('.page-section');
        sections.forEach(sec => {
            sec.classList.remove('active-section', 'fade-in');
            setTimeout(() => {
                if (sec.id !== sectionId) sec.style.display = 'none';
            }, 300);
        });

        setTimeout(() => {
            const targetSec = document.getElementById(sectionId);
            targetSec.style.display = 'flex';
            if (sectionId === 'hospital' && appState.loggedInDoctor) {
                this.loadHospitalStock(); // auto load if already logged in securely
            }
            void targetSec.offsetWidth;
            targetSec.classList.add('active-section', 'fade-in');
        }, 300);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async loadHospitals() {
        try {
            const res = await fetch('/api/hospitals');
            const data = await res.json();

            const loginSelect = document.getElementById('login-hospital');
            const registerSelect = document.getElementById('register-hospital');

            loginSelect.innerHTML = '<option value="" disabled selected>Select Hospital...</option>';
            registerSelect.innerHTML = '<option value="" disabled selected>Select Hospital...</option>';

            data.hospitals.forEach(h => {
                appState.hospitals[h.id] = h;

                const optLogin = document.createElement('option');
                optLogin.value = h.id;
                optLogin.textContent = `${h.name} (${h.area})`;
                loginSelect.appendChild(optLogin);

                const optReg = document.createElement('option');
                optReg.value = h.id;
                optReg.textContent = `${h.name} (${h.area})`;
                registerSelect.appendChild(optReg);
            });

            // Append "Other" option for custom hospital registration
            const optOther = document.createElement('option');
            optOther.value = 'other';
            optOther.textContent = 'Other (Register New Hospital)...';
            registerSelect.appendChild(optOther);
        } catch (error) {
            console.error("Failed to load hospitals", error);
        }
    },

    // --- Authentication Logic ---

    toggleAuthTab(tab) {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const btnLogin = document.getElementById('tab-login');
        const btnRegister = document.getElementById('tab-register');

        if (tab === 'login') {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            btnLogin.style.background = 'var(--primary)';
            btnLogin.style.borderColor = 'var(--primary)';
            btnRegister.style.background = 'transparent';
            btnRegister.style.borderColor = 'var(--primary)';
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            btnRegister.style.background = 'var(--primary)';
            btnRegister.style.borderColor = 'var(--primary)';
            btnLogin.style.background = 'transparent';
            btnLogin.style.borderColor = 'var(--primary)';
        }
    },

    async handleLogin() {
        const hid = document.getElementById('login-hospital').value;
        const did = document.getElementById('login-doctor-id').value;
        const pass = document.getElementById('login-password').value;

        if (!hid || !did || !pass) return this.showToast("Please fill all fields", true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hospitalId: hid, doctorId: did, password: pass })
            });
            const data = await res.json();

            if (res.ok) {
                appState.loggedInDoctor = {
                    name: data.doctorName,
                    id: data.doctorId
                };
                appState.currentHospitalId = data.hospitalId;

                document.getElementById('auth-container').classList.add('hidden');
                document.getElementById('stock-editor').classList.remove('hidden');

                this.showToast(`Welcome Dr. ${data.doctorName}`);
                this.loadHospitalStock();
            } else {
                this.showToast(data.error || "Login Failed", true);
            }
        } catch (e) { console.error(e); this.showToast("Connection Error", true); }
    },

    async handleRegister() {
        const hid = document.getElementById('register-hospital').value;
        const dname = document.getElementById('register-doctor-name').value;
        const did = document.getElementById('register-doctor-id').value;
        const pass = document.getElementById('register-password').value;

        if (!hid || !dname || !did || !pass) return this.showToast("All fields are required", true);

        const payload = { hospitalId: hid, doctorName: dname, doctorId: did, password: pass };

        if (hid === 'other') {
            payload.isNewHospital = true;
            payload.hospitalData = {
                name: document.getElementById('new-hospital-name').value,
                region: document.getElementById('new-hospital-region').value,
                address: document.getElementById('new-hospital-address').value
            };

            if (!payload.hospitalData.name || !payload.hospitalData.region || !payload.hospitalData.address) {
                this.showToast("Please fill all custom hospital fields.", true);
                return;
            }
        }

        try {
            const res = await fetch('/api/auth/register-doctor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                this.showToast("Registration Successful! Please login with your new credentials.");
                // Reload hospitals so the new hospital appears in the login select
                await this.loadHospitals();
                this.toggleAuthTab('login');
                document.getElementById('register-form').reset();
                document.getElementById('new-hospital-fields').classList.add('hidden');
            } else {
                this.showToast(data.error || "Registration Failed", true);
            }
        } catch (e) { console.error(e); this.showToast("Connection Error", true); }
    },

    logoutDoctor() {
        appState.loggedInDoctor = null;
        appState.currentHospitalId = null;

        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('stock-editor').classList.add('hidden');

        document.getElementById('login-form').reset();
        this.showToast("Logged Out Successfully");
    },

    openResetPasswordModal() {
        const loginEmail = document.getElementById('login-doctor-id').value;
        
        document.getElementById('reset-password-modal').classList.remove('hidden');
        document.getElementById('request-otp-form').classList.remove('hidden');
        document.getElementById('verify-reset-form').classList.add('hidden');
        document.getElementById('request-otp-form').reset();
        document.getElementById('verify-reset-form').reset();
        
        if (loginEmail && loginEmail.includes('@')) {
            document.getElementById('reset-email').value = loginEmail;
        }

        document.getElementById('reset-instructions').innerHTML = "Enter your registered email to receive a recovery code.";
    },

    closeResetPasswordModal() {
        document.getElementById('reset-password-modal').classList.add('hidden');
        document.getElementById('request-otp-form').reset();
        document.getElementById('verify-reset-form').reset();
    },

    async requestPasswordReset() {
        const doctorId = document.getElementById('reset-email').value;
        if (!doctorId) return this.showToast("Email ID is required", true);

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doctorId: doctorId })
            });
            const data = await res.json();
            
            if (res.ok) {
                this.showToast(data.message);
                document.getElementById('request-otp-form').classList.add('hidden');
                document.getElementById('verify-reset-form').classList.remove('hidden');
                
                if (data.otp) {
                    // Dev mode simulation
                    document.getElementById('reset-instructions').innerHTML = `
                        <i class="fa-solid fa-flask" style="color:var(--warning)"></i> [Dev Mode] Simulated recovery code for <b>${doctorId}</b>.<br>
                        <span style="display:block; margin-top:0.8rem; background:rgba(255,255,255,0.05); padding:1rem; border-radius:8px; border:1px dashed var(--border-color); text-align:center;">
                            Recovery Code: <b style="color:var(--primary); font-size:1.4rem; letter-spacing:3px;">${data.otp}</b>
                        </span>
                    `;
                    document.getElementById('reset-otp').value = data.otp;
                } else {
                    document.getElementById('reset-instructions').innerHTML = `
                        <i class="fa-solid fa-envelope-circle-check" style="color:var(--success)"></i> A secure recovery code has been sent to <b>${doctorId}</b>.
                    `;
                }
            } else {
                this.showToast(data.error || "Failed reset request", true);
            }
        } catch (error) {
            this.showToast("Connection failed", true);
        }
    },

    async submitPasswordReset() {
        const doctorId = document.getElementById('reset-email').value;
        const otp = document.getElementById('reset-otp').value;
        const newPassword = document.getElementById('reset-new-password').value;

        if (!otp || !newPassword) return this.showToast("All fields required", true);

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doctorId: doctorId, otp, newPassword })
            });

            const data = await res.json();
            if (res.ok) {
                this.showToast("Password securely updated!");
                this.closeResetPasswordModal();
            } else {
                this.showToast(data.error, true);
            }
        } catch (error) {
            this.showToast("Connection failed", true);
        }
    },

    // --- Hospital Portal Logic ---

    async loadHospitalStock() {
        const hospital = appState.hospitals[appState.currentHospitalId];

        if (!hospital) return;

        document.getElementById('current-hospital-name').textContent = hospital.name;
        document.getElementById('current-hospital-address').innerHTML = `<i class="fa-solid fa-map-pin"></i> ${hospital.address} <br><span style="color:var(--primary); font-size:0.8rem; margin-top:0.4rem; display:inline-block;">Logged in as: ${appState.loggedInDoctor.name}</span>`;

        try {
            const statsRes = await fetch('/api/stats');
            if (statsRes.ok) {
                const stats = await statsRes.json();
                document.getElementById('macro-requests').textContent = stats.totalRequests;
                document.getElementById('macro-donors').textContent = stats.totalDonors;

                // Render Detailed Donors
                const donorBody = document.getElementById('stat-donors-body');
                donorBody.innerHTML = '';
                if (stats.detailedDonors && stats.detailedDonors.length > 0) {
                    stats.detailedDonors.forEach(d => {
                        const tr = document.createElement('tr');
                        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                        tr.innerHTML = `
                            <td style="padding: 0.8rem 0.5rem; color: white;">${d.email}</td>
                            <td style="padding: 0.8rem 0.5rem;"><span style="color: var(--warning); font-weight: bold;">${d.blood_group}</span></td>
                            <td style="padding: 0.8rem 0.5rem; text-align: right; color: var(--text-muted); font-weight: bold;">${d.points}</td>
                        `;
                        donorBody.appendChild(tr);
                    });
                } else {
                    donorBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem; color: var(--text-muted);">No donors found</td></tr>';
                }

                // Render Detailed Requests
                const reqBody = document.getElementById('stat-requests-body');
                reqBody.innerHTML = '';
                if (stats.detailedRequests && stats.detailedRequests.length > 0) {
                    stats.detailedRequests.forEach(r => {
                        const tr = document.createElement('tr');
                        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                        tr.innerHTML = `
                            <td style="padding: 0.8rem 0.5rem; color: white;">${r.patient_name}</td>
                            <td style="padding: 0.8rem 0.5rem;"><span style="color: var(--danger); font-weight: bold;">${r.blood_group}</span></td>
                            <td style="padding: 0.8rem 0.5rem; text-align: right; color: var(--text-muted); border-left: 2px solid var(--danger);">${r.units_required}u</td>
                        `;
                        reqBody.appendChild(tr);
                    });
                } else {
                    reqBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem; color: var(--text-muted);">No requests found</td></tr>';
                }
            }
        } catch (e) {
            console.error("Failed to load detailed stats.", e);
        }

        await this.updateSMSLogs();

        const grid = document.getElementById('stock-grid');
        grid.innerHTML = '<div class="spinner"></div>'; // Loading indicator

        try {
            const res = await fetch(`/api/stock/${appState.currentHospitalId}`);
            const data = await res.json();
            const stock = data.stock || {};

            grid.innerHTML = '';

            appState.bloodGroups.forEach(bg => {
                const qty = stock[bg] || 0;
                const div = document.createElement('div');
                div.className = 'stock-item';
                div.innerHTML = `
                    <h4>${bg}</h4>
                    <div class="stock-controls">
                        <button class="stock-btn" onclick="app.adjustStock('${bg}', -1)"><i class="fa-solid fa-minus"></i></button>
                        <span class="stock-val" id="val-${bg}">${qty}</span>
                        <button class="stock-btn" onclick="app.adjustStock('${bg}', 1)"><i class="fa-solid fa-plus"></i></button>
                    </div>
                `;
                grid.appendChild(div);
            });
        } catch (error) {
            grid.innerHTML = '<p style="color:red">Failed to load stock.</p>';
            console.error(error);
        }

        // Parallel load incoming requests
        this.loadHospitalRequests();
    },

    async updateSMSLogs() {
        const container = document.getElementById('sms-log-container');
        if (!container) return;

        try {
            const res = await fetch('/api/sms-logs');
            if (res.ok) {
                const data = await res.json();
                container.innerHTML = '';
                if (data.logs && data.logs.length > 0) {
                    data.logs.forEach(log => {
                        const logEl = document.createElement('div');
                        const isSimulated = log.status?.includes('Simulated');
                        const isTrial = log.status?.includes('Trial');
                        
                        logEl.className = 'glass-container';
                        logEl.style.padding = '1rem';
                        logEl.style.background = isSimulated ? 'rgba(255, 171, 0, 0.05)' : 'rgba(0, 242, 254, 0.05)';
                        logEl.style.borderLeft = isSimulated ? '4px solid var(--warning)' : '4px solid #00f2fe';
                        logEl.style.borderRadius = '4px';
                        
                        let warningText = '';
                        if (log.status?.includes('Self-Test')) {
                             warningText = '<i class="fa-solid fa-circle-info"></i> Delivery was simulated because the patient number matches your Twilio sender number.';
                        } else if (isTrial) {
                             warningText = '<i class="fa-solid fa-lock"></i> Delivery was simulated because this patient number is <b>Unverified</b> on your Twilio Trial account.';
                        }

                         logEl.innerHTML = `
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; align-items:center;">
                                <b style="color:${isSimulated ? 'var(--warning)' : '#00f2fe'}; font-size:0.8rem;">Mobile To: ${log.to}</b>
                                <span style="font-size:0.7rem; padding:2px 8px; border-radius:10px; background:rgba(255,255,255,0.1); color:var(--text-muted);">
                                    <i class="fa-solid ${isSimulated ? 'fa-flask' : 'fa-check'}"></i> ${log.status || 'Dispatched'}
                                </span>
                            </div>
                            <p style="font-size:0.9rem; color:white; font-style:italic; margin-bottom:0.8rem;">"${log.message}"</p>
                            
                            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:0.6rem; border:1px solid rgba(255,255,255,0.05);">
                                <div style="display:flex; justify-content:space-between; align-items:center; opacity:0.8;">
                                    <span style="font-size:0.75rem; color:#fff;"><i class="fa-solid fa-envelope" style="color:var(--primary); margin-right:4px;"></i> Backup Email: <span style="color:var(--text-muted)">${log.emailTo || 'None'}</span></span>
                                    <span style="font-size:0.65rem; color:${log.emailStatus?.includes('Delivered') ? 'var(--success)' : 'var(--warning)'}; font-weight:bold; letter-spacing:0.5px;">${log.emailStatus?.toUpperCase() || 'PENDING'}</span>
                                </div>
                            </div>

                            ${warningText ? `<p style="font-size:0.7rem; color:var(--warning); margin-top:0.8rem; border-top:1px dashed rgba(255,171,0,0.2); padding-top:0.5rem;">${warningText}</p>` : ''}
                        `;
                        container.appendChild(logEl);
                    });
                } else {
                    container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:1rem;">Waiting for new hospital alerts...</div>';
                }
            }
        } catch (e) {
            console.error("Failed to fetch SMS logs", e);
        }
    },

    async loadHospitalRequests() {
        const grid = document.getElementById('requests-grid');
            grid.innerHTML = '<div class="spinner" style="width: 25px; height: 25px; margin: 1rem auto;"></div>';

        try {
            const res = await fetch(`/api/requests/${appState.currentHospitalId}`);
            const data = await res.json();

            grid.innerHTML = '';

            if (!data.requests || data.requests.length === 0) {
                grid.innerHTML = '<p style="color: var(--text-muted);">No incoming requests.</p>';
                return;
            }

            data.requests.forEach(req => {
                const isPending = req.status === 'pending';
                const statusClass = isPending ? 'pending' : 'approved';
                const actionBtn = isPending
                    ? `<div style="display:flex; gap:0.5rem;"><button class="btn btn-allow" onclick="app.approveRequest(${req.id}, '${req.blood_group}')" style="padding: 0.5rem 1.2rem; font-size:0.9rem;"><i class="fa-solid fa-check"></i> Allow</button><button class="btn btn-deny-outline" onclick="app.denyRequest(${req.id})" style="padding: 0.5rem 1.2rem; font-size:0.9rem;"><i class="fa-solid fa-xmark"></i> Deny</button></div>`
                    : `<button class="btn" onclick="app.deleteRequest(${req.id})" style="padding: 0.5rem 1rem; font-size:0.9rem; background:transparent; border:1px solid #ff2a2a; color:#ff2a2a"><i class="fa-solid fa-trash-can"></i> Dismiss</button>`;

                const isDonor = req.is_donor ? true : false;
                const donorBadge = isDonor 
                    ? `<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-left: 0.5rem;"><i class="fa-solid fa-star"></i> REGISTERED DONOR</span>` 
                    : '';

                const div = document.createElement('div');
                div.className = 'request-item fade-in';
                div.innerHTML = `
                    <div class="request-info">
                        <div style="display:flex; align-items:center;">
                            <h4 style="margin:0;">${req.patient_name}</h4>
                            ${donorBadge}
                            <span class="request-status ${statusClass}" style="margin-left:auto;">${req.status.toUpperCase()}</span>
                        </div>
                        <p style="margin-top:0.5rem;"><i class="fa-solid fa-droplet" style="color:var(--primary);"></i> <strong>Condition:</strong> <span style="font-weight: bold; color: white;">${req.units_required || 1} Units</span> of ${req.blood_group} required</p>
                        <p><i class="fa-solid fa-phone"></i> <strong>Contact:</strong> ${req.patient_contact || 'N/A'} ${isDonor ? `(<small>${req.donor_email}</small>)` : ''}</p>
                        ${isDonor ? `<p><i class="fa-solid fa-coins" style="color:#ffd700;"></i> <strong>Current Credits:</strong> <span style="color:#ffd700; font-weight:bold;">${req.donor_points || 0} Points</span></p>` : ''}
                        <p><i class="fa-solid fa-map-pin"></i> <strong>Location:</strong> ${req.patient_address}</p>
                        <p style="font-size:0.8rem; opacity:0.6;"><i class="fa-solid fa-clock"></i> ${new Date(req.timestamp).toLocaleString()}</p>
                    </div>
                    <div>
                        ${actionBtn}
                    </div>
                `;
                grid.appendChild(div);
            });
        } catch (error) {
            if (!isBackground) {
                grid.innerHTML = '<p style="color:red">Failed to load requests.</p>';
            }
        }
    },

    async approveRequest(reqId, bloodGroup) {
        try {
            const res = await fetch(`/api/requests/${reqId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hospitalId: appState.currentHospitalId, bloodGroup: bloodGroup })
            });
            const data = await res.json();

            if (res.ok) {
                this.showToast(`Request Allowed! Patient Notified.`);
                this.showPatientAlert(data.patientName, data.patientContact, 'Approval');
                this.loadHospitalStock(); // Refresh everything
            } else {
                this.showToast(data.error || "Error allowing request.", true);
            }
        } catch (error) {
            console.error(error);
        }
    },

    async denyRequest(reqId) {
        try {
            const res = await fetch(`/api/requests/${reqId}/deny`, {
                method: 'POST'
            });
            const data = await res.json();

            if (res.ok) {
                this.showToast("Request Denied. Patient Notified.");
                this.showPatientAlert(data.patientName, data.patientContact, 'Rejection');
                this.loadHospitalRequests(true); // Silent refresh
            } else {
                this.showToast(data.error || "Failed to deny request.", true);
            }
        } catch (error) {
            console.error("Error denying request:", error);
        }
    },

    showPatientAlert(name, phone, type) {
        // Trigger a specialized notification after 1 second for realism
        setTimeout(() => {
            this.showToast(`System Notice: Patient ${name} has received the ${type} notice on ${phone}.`, false, true);
        }, 800);
    },

    async deleteRequest(reqId) {
        try {
            const res = await fetch(`/api/requests/${reqId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                this.showToast("Request dismissed from dashboard.");
                this.loadHospitalRequests(true); // Silent refresh of the list
            } else {
                this.showToast("Failed to dismiss request.");
            }
        } catch (error) {
            console.error("Error dismissing request:", error);
        }
    },

    async adjustStock(bg, amount) {
        const el = document.getElementById(`val-${bg}`);
        let newQty = parseInt(el.textContent) + amount;
        if (newQty < 0) newQty = 0;
        if (newQty > 99) newQty = 99;

        // Optimistic UI update
        el.textContent = newQty;

        // Update via API
        try {
            await fetch('/api/stock/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hospitalId: appState.currentHospitalId,
                    bloodGroup: bg,
                    quantity: newQty
                })
            });
        } catch (error) {
            this.showToast("Error updating stock!");
            // Revert on error
            el.textContent = newQty - amount;
        }
    },

    // --- Emergency Logic ---

    async handleEmergencySearch() {
        const bg = document.getElementById('patient-blood-group').value;
        const location = document.getElementById('patient-location').value;

        const resultsContainer = document.getElementById('results-container');
        const loading = document.getElementById('loading-state');

        // UI State: Show loading
        resultsContainer.innerHTML = '';
        loading.classList.remove('hidden');

        try {
            // Search matches from specific algorithm endpoint
            const res = await fetch(`/api/search?bloodGroup=${encodeURIComponent(bg)}&location=${encodeURIComponent(location)}`);
            const data = await res.json();

            this.renderResults(data.matches, location, bg);
        } catch (error) {
            console.error(error);
            resultsContainer.innerHTML = '<p style="color:red; padding:2rem;">Connection Error.</p>';
        } finally {
            loading.classList.add('hidden');
        }
    },

    renderResults(matches, reqLocation, reqGroup) {
        const container = document.getElementById('results-container');
        const filterInput = document.getElementById('patient-hospital-filter');

        container.innerHTML = `<div style="padding: 1rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted); font-size: 0.9rem;">Urgent demand: <strong>${reqGroup}</strong> in <strong>${reqLocation}</strong></span>
            <span style="color: var(--primary); font-weight: 600;">${matches.length} Matches Found</span>
        </div>`;

        if (matches.length === 0) {
            filterInput.style.display = 'none';
            filterInput.value = '';
            container.innerHTML += `
                <div class="empty-state">
                    <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger)"></i>
                    <p style="color: white; font-weight: 500; font-size: 1.2rem; margin-bottom: 0.5rem;">No immediate stock found</p>
                    <p>Contact central dispatch manually.</p>
                </div>
            `;
            return;
        }

        filterInput.style.display = 'block';
        filterInput.value = '';

        matches.forEach((match, index) => {
            const h = match.hospital;
            const etaClass = match.time <= 10 ? '' : 'warning';

            const card = document.createElement('div');
            card.className = 'result-card fade-in';
            card.style.animationDelay = `${index * 0.1}s`;
            card.style.cursor = 'pointer';
            card.onclick = () => app.openRequestModal(h.id, h.name, reqGroup);

            card.innerHTML = `
                <div class="hosp-info">
                    <h4>${h.name}</h4>
                    <div class="hosp-meta">
                        <span><i class="fa-solid fa-location-dot"></i> ${h.area}</span>
                        <span><i class="fa-solid fa-layer-group"></i> ${match.qty} units available</span>
                    </div>
                    <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-top: 0.3rem;">
                        <i class="fa-solid fa-map-pin"></i> ${h.address}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    },

    openRequestModal(hId, hName, bgNeeded) {
        document.getElementById('modal-hospital-id').value = hId;
        document.getElementById('modal-hospital-name').textContent = hName;
        document.getElementById('modal-blood-group').value = bgNeeded;

        // Smart Mapping: Pre-fill if patient is logged in
        if (appState.loggedInPatient) {
            document.getElementById('modal-patient-name').value = appState.loggedInPatient.name;
            document.getElementById('modal-patient-contact').value = appState.loggedInPatient.phone;
            document.getElementById('modal-patient-address').value = `${appState.loggedInPatient.state}, ${appState.loggedInPatient.country}`;
            
            // Highlight the auto-fill
            this.showToast(`Auto-mapped to ${appState.loggedInPatient.name}'s account`, false, true);
        }

        document.getElementById('request-modal').classList.remove('hidden');
    },

    closeRequestModal() {
        document.getElementById('request-modal').classList.add('hidden');
        document.getElementById('patient-request-form').reset();
    },

    async submitPatientRequest() {
        const hId = document.getElementById('modal-hospital-id').value;
        const bg = document.getElementById('modal-blood-group').value;
        const units = document.getElementById('modal-units-required').value;
        const pName = document.getElementById('modal-patient-name').value;
        const pContact = document.getElementById('modal-patient-contact').value;
        const pEmail = document.getElementById('modal-patient-email').value;
        const pAddress = document.getElementById('modal-patient-address').value;

        try {
            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hospitalId: hId,
                    patientId: appState.loggedInPatient ? appState.loggedInPatient.id : null, // Link if exists
                    patientName: pName,
                    patientContact: pContact,
                    patientEmail: pEmail,
                    patientAddress: pAddress,
                    bloodGroup: bg,
                    unitsRequired: units,
                    isDonor: document.getElementById('modal-is-donor').checked,
                    donorEmail: document.getElementById('modal-donor-email').value
                })
            });

            if (res.ok) {
                this.closeRequestModal();
                this.showToast("Request sent to Hospital successfully!");
            } else {
                this.showToast("Error sending request.");
            }
        } catch (error) {
            console.error(error);
            this.showToast("Connection failed.");
        }
    },

    showToast(msg, isError = false, isInfo = false) {
        const toast = document.getElementById('toast');
        const icon = toast.querySelector('i');
        const msgEl = document.getElementById('toast-msg');

        toast.className = 'toast'; // reset
        if (isError) {
            toast.style.background = 'var(--danger)';
            icon.className = 'fa-solid fa-triangle-exclamation';
        } else if (isInfo) {
            toast.classList.add('info');
            toast.style.background = ''; // use CSS .info
            icon.className = 'fa-solid fa-mobile-screen-button';
        } else {
            toast.style.background = 'var(--success)';
            icon.className = 'fa-solid fa-circle-check';
        }

        msgEl.textContent = msg;
        toast.classList.add('show');

        // Longer display for simulated SMS info
        const duration = isInfo ? 5000 : 3000;
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    // --- DONOR PORTAL LOGIC --- //

    toggleDonorAuthTab(tab) {
        const loginForm = document.getElementById('donor-login-form');
        const regForm = document.getElementById('donor-register-form');
        const tabs = document.querySelectorAll('.auth-tabs .tab-btn');
        tabs.forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tab-donor-${tab}`).classList.add('active');
        
        if (tab === 'login') {
            loginForm.classList.remove('hidden');
            regForm.classList.add('hidden');
        } else {
            loginForm.classList.add('hidden');
            regForm.classList.remove('hidden');
        }
    },

    async handleDonorRegister() {
        const payload = {
            name: document.getElementById('donor-reg-name').value,
            email: document.getElementById('donor-reg-email').value,
            password: document.getElementById('donor-reg-password').value,
            bloodGroup: document.getElementById('donor-reg-bg').value
        };

        try {
            const res = await fetch('/api/donor/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                this.showToast("Donor Account created! Please log in.");
                this.toggleDonorAuthTab('login');
                document.getElementById('donor-register-form').reset();
            } else {
                this.showToast(data.error, true);
            }
        } catch (e) {
            this.showToast("Connection failed", true);
        }
    },

    async handleDonorLogin() {
        const payload = {
            email: document.getElementById('donor-login-email').value,
            password: document.getElementById('donor-login-password').value
        };

        try {
            const res = await fetch('/api/donor/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                appState.loggedInDonor = data.donor;
                this.showToast("Logged in successfully!");
                document.getElementById('donor-auth-panel').classList.add('hidden');
                document.getElementById('donor-dashboard-panel').classList.remove('hidden');
                this.loadDonorDashboard();
            } else {
                this.showToast(data.error, true);
            }
        } catch (e) {
            this.showToast("Connection failed", true);
        }
    },

    logoutDonor() {
        appState.loggedInDonor = null;
        document.getElementById('donor-auth-panel').classList.remove('hidden');
        document.getElementById('donor-dashboard-panel').classList.add('hidden');
        document.getElementById('donor-login-form').reset();
        this.showToast("Logged out successfully");
    },

    async loadDonorDashboard() {
        if (!appState.loggedInDonor) return;
        
        try {
            const res = await fetch(`/api/donor/${appState.loggedInDonor.id}/dashboard`);
            if (res.ok) {
                const data = await res.json();
                
                // Update header Info
                document.getElementById('donor-dash-name').textContent = `Welcome, ${data.donor.name}`;
                document.getElementById('donor-dash-bg').textContent = data.donor.blood_group;
                
                // Calculate Stats
                const totalUnits = data.history.reduce((sum, item) => sum + item.units, 0);
                const points = data.donor.points;
                
                // Determine Rank
                let rank = "Bronze";
                let rankClass = "bronze";
                if (points >= 2000) {
                    rank = "Gold";
                    rankClass = "gold";
                } else if (points >= 500) {
                    rank = "Silver";
                    rankClass = "silver";
                }
                
                // Update Metric Cards
                document.getElementById('donor-dash-points').textContent = points;
                document.getElementById('donor-dash-units').textContent = totalUnits;
                const rankEl = document.getElementById('donor-dash-rank');
                rankEl.textContent = rank;
                rankEl.className = `rank-${rankClass}`;
                
                const rankCard = document.getElementById('rank-card');
                rankCard.className = `stock-item ${rankClass}`;

                // Update Table
                const tbody = document.getElementById('donor-history-tbody');
                tbody.innerHTML = '';
                
                if (data.history.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-style: italic;">No donations logged yet. Help save lives to earn points!</td></tr>`;
                    return;
                }

                data.history.forEach(item => {
                    const date = new Date(item.timestamp).toLocaleDateString();
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
                    tr.innerHTML = `
                        <td style="padding: 1.2rem; color: var(--text-muted); font-size: 0.9rem;">${date}</td>
                        <td style="padding: 1.2rem; color: white; font-weight: 500;">
                            ${item.hospitalName}
                            <span style="display: block; font-size: 0.75rem; color: var(--text-muted); font-weight: 400; margin-top: 0.2rem;">
                                <i class="fa-solid fa-location-dot" style="font-size: 0.7rem;"></i> ${item.area}
                            </span>
                        </td>
                        <td style="padding: 1.2rem; color: var(--danger); font-weight: bold;">
                            <span style="background: rgba(255, 42, 42, 0.1); padding: 0.3rem 0.6rem; border-radius: 4px;">
                                ${item.units} Units
                            </span>
                        </td>
                        <td style="padding: 1.2rem; color: var(--warning); font-weight: bold;">
                            <i class="fa-solid fa-star" style="font-size: 0.8rem;"></i> +${item.units * 50}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch (e) {
            console.error(e);
        }
    },

    openDonorResetModal() {
        document.getElementById('donor-reset-modal').classList.remove('hidden');
        document.getElementById('donor-request-otp-form').classList.remove('hidden');
        document.getElementById('donor-verify-reset-form').classList.add('hidden');
        document.getElementById('donor-request-otp-form').reset();
        document.getElementById('donor-verify-reset-form').reset();
        document.getElementById('donor-reset-instructions').innerHTML = "Enter your registered Email ID to receive a recovery code.";
    },

    closeDonorResetModal() {
        document.getElementById('donor-reset-modal').classList.add('hidden');
        document.getElementById('donor-request-otp-form').reset();
        document.getElementById('donor-verify-reset-form').reset();
    },

    async handleDonorRequestOTP() {
        const email = document.getElementById('donor-reset-email').value;
        try {
            const res = await fetch('/api/donor/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            
            if (res.ok) {
                this.showToast(data.message);
                document.getElementById('donor-request-otp-form').classList.add('hidden');
                document.getElementById('donor-verify-reset-form').classList.remove('hidden');
                
                if (data.otp) {
                    // Dev mode simulation
                    document.getElementById('donor-reset-instructions').innerHTML = `
                        <i class="fa-solid fa-flask" style="color:var(--warning)"></i> [Dev Mode] Simulated recovery code for <b>${email}</b>.<br>
                        <span style="display:block; margin-top:0.8rem; background:rgba(255,255,255,0.05); padding:1rem; border-radius:8px; border:1px dashed var(--border-color); text-align:center;">
                            Recovery Code: <b style="color:var(--primary); font-size:1.4rem; letter-spacing:3px;">${data.otp}</b>
                        </span>
                    `;
                    document.getElementById('donor-reset-otp').value = data.otp;
                } else {
                    document.getElementById('donor-reset-instructions').innerHTML = `
                        <i class="fa-solid fa-envelope-circle-check" style="color:var(--success)"></i> A secure recovery code has been sent to <b>${email}</b>.
                    `;
                }
            } else {
                this.showToast(data.error, true);
            }
        } catch (e) {
            this.showToast("Connection failed", true);
        }
    },

    async handleDonorResetPassword() {
        const email = document.getElementById('donor-reset-email').value;
        const otp = document.getElementById('donor-reset-otp').value;
        const newPassword = document.getElementById('donor-reset-new-password').value;

        if (newPassword.length < 6) return this.showToast("Password too short (min 6 chars)", true);

        try {
            const res = await fetch('/api/donor/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, newPassword })
            });
            const data = await res.json();
            
            if (res.ok) {
                this.showToast(data.message);
                this.closeDonorResetModal();
            } else {
                this.showToast(data.error, true);
            }
        } catch (e) {
            this.showToast("Connection failed", true);
        }
    },


    // --- Patient Portal Logic ---
    togglePatientAuthTab(tab) {
        const loginForm = document.getElementById('patient-login-form');
        const regForm = document.getElementById('patient-register-form');
        const loginTabBtn = document.getElementById('tab-patient-login');
        const regTabBtn = document.getElementById('tab-patient-register');

        if (tab === 'login') {
            loginForm.classList.remove('hidden');
            regForm.classList.add('hidden');
            loginTabBtn.classList.add('active');
            regTabBtn.classList.remove('active');
        } else {
            loginForm.classList.add('hidden');
            regForm.classList.remove('hidden');
            loginTabBtn.classList.remove('active');
            regTabBtn.classList.add('active');
        }
    },

    async handlePatientRegister() {
        const name = document.getElementById('patient-reg-name').value;
        const phone = document.getElementById('patient-reg-phone').value;
        const state = document.getElementById('patient-reg-state').value;
        const country = document.getElementById('patient-reg-country').value;
        const password = document.getElementById('patient-reg-password').value;

        try {
            const res = await fetch('/api/patient/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, state, country, password })
            });
            const data = await res.json();
            if (res.ok) {
                this.showToast(data.message);
                this.togglePatientAuthTab('login');
            } else {
                this.showToast(data.error, true);
            }
        } catch (e) {
            this.showToast("Connection failed", true);
        }
    },

    async handlePatientLogin() {
        const phone = document.getElementById('patient-login-phone').value;
        const password = document.getElementById('patient-login-password').value;

        try {
            const res = await fetch('/api/patient/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });
            const data = await res.json();
            if (res.ok) {
                appState.loggedInPatient = data.patient;
                localStorage.setItem('patientAccount', JSON.stringify(data.patient));
                this.updatePatientDashboard();
                this.showToast("Patient Login Successful!");
            } else {
                this.showToast(data.error, true);
            }
        } catch (e) {
            this.showToast("Connection failed", true);
        }
    },

    logoutPatient() {
        appState.loggedInPatient = null;
        localStorage.removeItem('patientAccount');
        document.getElementById('patient-dashboard-panel').classList.add('hidden');
        document.getElementById('patient-auth-panel').classList.remove('hidden');
        this.showToast("Logged out from Patient Portal");
    },

    async updatePatientDashboard() {
        if (!appState.loggedInPatient) return;

        // Hide auth, show dashboard
        document.getElementById('patient-auth-panel').classList.add('hidden');
        document.getElementById('patient-dashboard-panel').classList.remove('hidden');

        // Populate header
        document.getElementById('patient-dash-name').textContent = appState.loggedInPatient.name;
        document.getElementById('patient-dash-loc').textContent = `${appState.loggedInPatient.state}, ${appState.loggedInPatient.country}`;

        // Fetch requests
        try {
            const res = await fetch(`/api/patient/dashboard/${appState.loggedInPatient.id}`);
            const data = await res.json();
            
            if (res.ok) {
                const container = document.getElementById('patient-requests-container');
                
                // Update Quick Stats
                const total = data.requests.length;
                const pending = data.requests.filter(r => r.status === 'pending').length;
                const approved = data.requests.filter(r => r.status === 'approved').length;
                
                document.getElementById('stat-total-req').textContent = total;
                document.getElementById('stat-pending-req').textContent = pending;
                document.getElementById('stat-approved-req').textContent = approved;

                if (total === 0) {
                    container.innerHTML = `
                        <div class="empty-state" style="padding: 6rem 0; text-align: center;">
                            <div style="width: 100px; height: 100px; background: rgba(255,255,255,0.02); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem;">
                                <i class="fa-solid fa-notes-medical" style="opacity: 0.2; font-size: 3rem;"></i>
                            </div>
                            <h4 style="color: white; margin-bottom: 0.5rem;">System Clear</h4>
                            <p style="max-width: 400px; margin: 0 auto; color: var(--text-muted);">You have no active or historical emergency requests. Your life-saving data index is empty.</p>
                        </div>
                    `;
                } else {
                    let html = '<div style="display: flex; flex-direction: column;">';
                    data.requests.forEach((req, index) => {
                        const statusClass = `status-${req.status}`;
                        const statusIcon = req.status === 'approved' ? 'fa-circle-check' : (req.status === 'denied' ? 'fa-circle-xmark' : 'fa-clock-rotate-left');
                        
                        html += `
                            <div class="request-card-v2" style="animation-delay: ${index * 0.1}s">
                                <div class="req-main">
                                    <div class="req-hosp-name">${req.hospital_name}</div>
                                    <div class="req-details">
                                        <span><i class="fa-solid fa-map-location-dot"></i> ${req.area}</span>
                                        <span><i class="fa-solid fa-droplet" style="color: var(--danger);"></i> Group ${req.blood_group}</span>
                                        <span><i class="fa-solid fa-box-open"></i> ${req.units_required} Units Required</span>
                                    </div>
                                    <div style="margin-top: 1rem; color: rgba(255,255,255,0.3); font-size: 0.75rem; font-weight: 500;">
                                        <i class="fa-solid fa-calendar-day"></i> Registered: ${new Date(req.timestamp).toLocaleString()}
                                    </div>
                                </div>
                                <div class="req-status-pill ${statusClass}">
                                    <i class="fa-solid ${statusIcon}"></i> ${req.status.toUpperCase()}
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                    container.innerHTML = html;
                }
            }
        } catch (e) {
            console.error("Dashboard update failed", e);
        }
    },


    async handleLogDonation() {
        if (!appState.loggedInDoctor || !appState.currentHospitalId) return;

        const email = document.getElementById('log-donor-email').value;
        const bg = document.getElementById('log-donor-bg').value;
        const units = document.getElementById('log-donor-units').value;

        try {
            const res = await fetch(`/api/hospital/${appState.currentHospitalId}/log-donation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ donorEmail: email, bloodGroup: bg, units: units })
            });
            const data = await res.json();
            
            if (res.ok) {
                this.showToast(data.message);
                document.getElementById('log-donation-form').reset();
                this.loadHospitalStock(); // Refresh local grid stock & macro stats
            } else {
                this.showToast(data.error, true);
            }
        } catch (e) {
            this.showToast("Connection failed", true);
        }
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
