// Core Application State
const appState = {
    hospitals: {},
    currentHospitalId: null,
    loggedInDoctor: null,
    bloodGroups: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
};

// Application Logic
const app = {
    async init() {
        this.bindEvents();
        await this.loadHospitals();

        // Handle emergency form submission
        document.getElementById('emergency-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmergencySearch();
        });

        // Auth form submissions
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Handle patient request form submission (Modal)
        document.getElementById('patient-request-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitPatientRequest();
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
                if (!e.currentTarget.classList.contains('btn-primary')) {
                    e.currentTarget.classList.add('active');
                }
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

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hospitalId: hid, doctorId: did, password: pass })
            });
            const data = await res.json();

            if (res.ok) {
                appState.loggedInDoctor = data.doctorName; // Store full name
                appState.currentHospitalId = data.hospitalId;

                document.getElementById('auth-container').classList.add('hidden');
                document.getElementById('stock-editor').classList.remove('hidden');

                this.showToast(`Welcome Dr. ${data.doctorName}`);
                this.loadHospitalStock();
            } else {
                this.showToast(data.error || "Login Failed");
            }
        } catch (e) { console.error(e); this.showToast("Connection Error"); }
    },

    async handleRegister() {
        const hid = document.getElementById('register-hospital').value;
        const dname = document.getElementById('register-doctor-name').value;
        const did = document.getElementById('register-doctor-id').value;
        const pass = document.getElementById('register-password').value;

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hospitalId: hid, doctorName: dname, doctorId: did, password: pass })
            });
            const data = await res.json();

            if (res.ok) {
                this.showToast("Registration Successful! Please login.");
                this.toggleAuthTab('login');
                document.getElementById('register-form').reset();
            } else {
                this.showToast(data.error || "Registration Failed");
            }
        } catch (e) { console.error(e); this.showToast("Connection Error"); }
    },

    logoutDoctor() {
        appState.loggedInDoctor = null;
        appState.currentHospitalId = null;

        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('stock-editor').classList.add('hidden');

        document.getElementById('login-form').reset();
        this.showToast("Logged Out Successfully");
    },

    // --- Hospital Portal Logic ---

    async loadHospitalStock() {
        const hospital = appState.hospitals[appState.currentHospitalId];

        if (!hospital) return;

        document.getElementById('current-hospital-name').textContent = hospital.name;
        document.getElementById('current-hospital-address').innerHTML = `<i class="fa-solid fa-map-pin"></i> ${hospital.address} <br><span style="color:var(--primary); font-size:0.8rem; margin-top:0.4rem; display:inline-block;">Logged in as: ${appState.loggedInDoctor}</span>`;

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
                    ? `<button class="btn btn-primary" onclick="app.approveRequest(${req.id}, '${req.blood_group}')" style="padding: 0.5rem 1rem; font-size:0.9rem;">Approve & Deduct</button>`
                    : ``;

                const div = document.createElement('div');
                div.className = 'request-item fade-in';
                div.innerHTML = `
                    <div class="request-info">
                        <h4>${req.patient_name} <span class="request-status ${statusClass}">${req.status.toUpperCase()}</span></h4>
                        <p><i class="fa-solid fa-droplet" style="color:var(--primary);"></i> <strong>Condition:</strong> 1 Unit of ${req.blood_group} required</p>
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
            grid.innerHTML = '<p style="color:red">Failed to load requests.</p>';
        }
    },

    async approveRequest(reqId, bloodGroup) {
        try {
            const res = await fetch(`/api/requests/${reqId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hospitalId: appState.currentHospitalId, bloodGroup: bloodGroup })
            });

            if (res.ok) {
                this.showToast("Request Approved!");
                this.loadHospitalStock(); // Refresh everything
            } else {
                this.showToast("Error approving request.");
            }
        } catch (error) {
            console.error(error);
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

    saveStock() {
        this.showToast("Blood availability synced to network.");
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

        container.innerHTML = `<div style="padding: 1rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted); font-size: 0.9rem;">Urgent demand: <strong>${reqGroup}</strong> in <strong>${reqLocation}</strong></span>
            <span style="color: var(--primary); font-weight: 600;">${matches.length} Matches Found</span>
        </div>`;

        if (matches.length === 0) {
            container.innerHTML += `
                <div class="empty-state">
                    <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger)"></i>
                    <p style="color: white; font-weight: 500; font-size: 1.2rem; margin-bottom: 0.5rem;">No immediate stock found</p>
                    <p>Contact central dispatch manually.</p>
                </div>
            `;
            return;
        }

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
                <div class="eta-badge ${etaClass}">
                    <span class="eta-time">${match.time}</span>
                    <span class="eta-label">MINUTES ETA</span>
                </div>
            `;
            container.appendChild(card);
        });
    },

    openRequestModal(hId, hName, bgNeeded) {
        document.getElementById('modal-hospital-id').value = hId;
        document.getElementById('modal-hospital-name').textContent = hName;
        document.getElementById('modal-blood-group').value = bgNeeded;

        document.getElementById('request-modal').classList.remove('hidden');
    },

    closeRequestModal() {
        document.getElementById('request-modal').classList.add('hidden');
        document.getElementById('patient-request-form').reset();
    },

    async submitPatientRequest() {
        const hId = document.getElementById('modal-hospital-id').value;
        const bg = document.getElementById('modal-blood-group').value;
        const pName = document.getElementById('modal-patient-name').value;
        const pAddress = document.getElementById('modal-patient-address').value;

        try {
            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hospitalId: hId,
                    patientName: pName,
                    patientAddress: pAddress,
                    bloodGroup: bg
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

    showToast(msg) {
        const toast = document.getElementById('toast');
        document.getElementById('toast-msg').textContent = msg;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
