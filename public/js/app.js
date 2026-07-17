// Global State Variables
let currentUser = null;
let activeTabId = '';
let cashFlowChartInstance = null;
let managerChartInstance = null;

// Page Route Guard & Initialization
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  
  // Verify User Session
  fetch('/api/auth/me')
    .then(res => {
      if (res.ok) return res.json();
      throw new Error('Not authenticated');
    })
    .then(user => {
      currentUser = user;
      
      // Redirect authenticated user if on index page
      if (path.endsWith('/') || path.endsWith('index.html')) {
        window.location.href = '/dashboard.html';
      } else {
        initDashboard();
      }
    })
    .catch(() => {
      // Redirect guest to index if on dashboard
      if (path.endsWith('dashboard.html')) {
        window.location.href = '/index.html';
      } else {
        initLandingPage();
      }
    });
});

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  container.appendChild(toast);

  // Automatically fade out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- LANDING PAGE LOGIC ---
function initLandingPage() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed.');

        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => window.location.href = '/dashboard.html', 800);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('register-username').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed.');

        showToast('Account created successfully! Redirecting...', 'success');
        setTimeout(() => window.location.href = '/dashboard.html', 800);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

// Modal Toggle Helpers
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function switchModal(closeId, openId) {
  closeModal(closeId);
  setTimeout(() => openModal(openId), 200);
}


// --- DASHBOARD LOGIC ---
function initDashboard() {
  if (!currentUser) return;

  // Render User details in sidebar
  document.getElementById('user-display-name').textContent = currentUser.username;
  document.getElementById('user-display-role').textContent = currentUser.role;
  document.getElementById('avatar-letters').textContent = currentUser.username.substring(0, 2).toUpperCase();

  // Setup sidebar based on Role
  if (currentUser.role === 'manager') {
    document.getElementById('manager-nav').style.display = 'flex';
    document.getElementById('customer-nav').style.display = 'none';
    switchTab('mgr-dash');
    
    // Poll approvals count periodically
    pollPendingApprovalsCount();
    setInterval(pollPendingApprovalsCount, 15000);
  } else {
    document.getElementById('customer-nav').style.display = 'flex';
    document.getElementById('manager-nav').style.display = 'none';
    document.getElementById('welcome-username').textContent = currentUser.username;
    switchTab('cust-dash');
  }

  // Setup customer specific form submissions
  setupCustomerForms();
}

// Tab Swapping Router
function switchTab(tabId) {
  activeTabId = tabId;

  // Update nav item highlighting
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(btn => {
    // Check if the onClick contains the tabId
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabId}'`)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Switch tab visibility
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => {
    if (tab.id === tabId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Fetch relevant content for active tab
  refreshTabContent(tabId);
}

function refreshTabContent(tabId) {
  switch (tabId) {
    case 'cust-dash':
      fetchBalances();
      fetchRecentTransactions();
      renderCustomerFlowChart();
      break;
    case 'cust-atm':
      fetchBalances(); // update current selections
      break;
    case 'cust-goals':
      fetchSavingsGoals();
      break;
    case 'cust-ledger':
      fetchLedger();
      break;
    case 'mgr-dash':
      fetchManagerAnalytics();
      break;
    case 'mgr-users':
      fetchManagerUsers();
      break;
    case 'mgr-approvals':
      fetchManagerApprovals();
      break;
    case 'mgr-audit':
      fetchManagerAuditLogs();
      break;
  }
}

// --- CUSTOMER CORE API INTEGRATIONS ---

async function fetchBalances() {
  try {
    const res = await fetch('/api/customer/profile');
    if (!res.ok) throw new Error();
    const user = await res.json();
    
    // Update headers and cards
    const accHeader = document.getElementById('account-info-header');
    if (accHeader) accHeader.textContent = `Checking Account Number: ${user.accountNumber}`;
    
    const checkingDisp = document.getElementById('checking-balance-display');
    if (checkingDisp) checkingDisp.textContent = `$${user.checkingBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    const savingsDisp = document.getElementById('savings-balance-display');
    if (savingsDisp) savingsDisp.textContent = `$${user.savingsBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    const totalDisp = document.getElementById('total-balance-display');
    if (totalDisp) {
      const total = user.checkingBalance + user.savingsBalance;
      totalDisp.textContent = `$${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
  } catch (err) {
    showToast('Failed to sync balances.', 'error');
  }
}

async function fetchRecentTransactions() {
  try {
    const res = await fetch('/api/customer/transactions?sort=newest');
    if (!res.ok) throw new Error();
    const list = await res.json();
    
    const container = document.getElementById('recent-transactions-list');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px 0;">No transaction history found.</p>`;
      return;
    }

    // Limit to latest 4
    const recent = list.slice(0, 4);
    container.innerHTML = recent.map(tx => renderTransactionRowHtml(tx)).join('');
  } catch (err) {
    console.error(err);
  }
}

async function fetchLedger() {
  const search = document.getElementById('ledger-search').value;
  const type = document.getElementById('ledger-type-filter').value;
  const sort = document.getElementById('ledger-sort-order').value;

  try {
    const res = await fetch(`/api/customer/transactions?search=${encodeURIComponent(search)}&type=${type}&sort=${sort}`);
    if (!res.ok) throw new Error();
    const list = await res.json();
    
    const container = document.getElementById('full-ledger-list');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 30px 0;">No matching transaction records.</p>`;
      return;
    }

    container.innerHTML = list.map(tx => renderTransactionRowHtml(tx)).join('');
  } catch (err) {
    showToast('Failed to fetch ledger.', 'error');
  }
}

function renderTransactionRowHtml(tx) {
  const isCredit = (tx.receiverId === currentUser.id && tx.type === 'transfer') || tx.type === 'deposit';
  const typeClass = tx.type;
  
  let sign = '-';
  let amtClass = 'debit';
  if (isCredit) {
    sign = '+';
    amtClass = 'credit';
  }

  // Icons SVG
  let iconSvg = '';
  if (tx.type === 'deposit') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;
  } else if (tx.type === 'withdraw') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
  } else {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="21" x2="17" y2="3"></line><polyline points="12 16 17 21 22 16"></polyline><line x1="7" y1="3" x2="7" y2="21"></line><polyline points="2 8 7 3 12 8"></polyline></svg>`;
  }

  // Label formatting
  let title = tx.description;
  let party = '';
  if (tx.type === 'transfer') {
    if (tx.senderId === currentUser.id) {
      party = `To: ${tx.receiverName} (${tx.receiverAccount})`;
    } else {
      party = `From: ${tx.senderName} (${tx.senderAccount})`;
    }
  } else {
    party = tx.senderName || 'ATM';
  }

  const dateString = new Date(tx.timestamp).toLocaleString();

  // Status Badge (only show pending or rejected, or completed for transfer)
  let badgeHtml = '';
  if (tx.status !== 'completed') {
    const statusText = tx.status.replace('_', ' ');
    badgeHtml = `<span class="tx-status-badge ${tx.status}">${statusText}</span>`;
  }

  return `
    <div class="transaction-row">
      <div class="tx-left">
        <div class="tx-icon-wrapper ${typeClass}">
          ${iconSvg}
        </div>
        <div class="tx-details">
          <span class="title">${title}</span>
          <span class="meta">${party} • ${dateString}</span>
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${amtClass}">${sign}$${tx.amount.toFixed(2)}</span>
        ${badgeHtml}
      </div>
    </div>
  `;
}

async function fetchSavingsGoals() {
  try {
    const res = await fetch('/api/customer/goals');
    if (!res.ok) throw new Error();
    const list = await res.json();
    
    const container = document.getElementById('savings-goals-list');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px 0;">No active savings goals. Plan a goal to build savings!</p>`;
      return;
    }

    container.innerHTML = list.map(goal => {
      const percentage = Math.min(100, Math.floor((goal.currentAmount / goal.targetAmount) * 100));
      return `
        <div class="glass-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="font-family: var(--font-display); font-size: 16px; font-weight: 600;">${goal.name}</h4>
            <button class="btn btn-primary" onclick="openAllocateModal('${goal.id}', '${goal.name}')" style="padding: 6px 12px; font-size: 12px; border-radius: 6px;" ${percentage >= 100 ? 'disabled' : ''}>
              ${percentage >= 100 ? 'Achieved' : 'Allocate Funds'}
            </button>
          </div>
          <div class="goal-progress-container">
            <div class="goal-progress-bar">
              <div class="goal-progress-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="goal-meta">
              <span>Saved: $${goal.currentAmount.toFixed(2)} of $${goal.targetAmount.toFixed(2)}</span>
              <span>${percentage}% Complete • Target: ${goal.deadline}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    showToast('Failed to load goals.', 'error');
  }
}

// Goal Allocation Modals
function openAllocateModal(goalId, goalName) {
  document.getElementById('allocate-goal-id').value = goalId;
  document.getElementById('allocate-goal-name').textContent = goalName;
  document.getElementById('allocate-amount').value = '';
  openModal('allocate-goal-modal');
}

// Setup Customer Form Handlers
function setupCustomerForms() {
  const depositForm = document.getElementById('atm-deposit-form');
  const withdrawForm = document.getElementById('atm-withdraw-form');
  const transferForm = document.getElementById('transfer-funds-form');
  const goalForm = document.getElementById('create-goal-form');
  const allocateForm = document.getElementById('allocate-goal-form');

  if (depositForm) {
    depositForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const accountType = document.getElementById('deposit-account').value;
      const amount = parseFloat(document.getElementById('deposit-amount').value);

      try {
        const res = await fetch('/api/customer/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, accountType })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`Successfully deposited $${amount.toFixed(2)} to ${accountType}.`, 'success');
        document.getElementById('deposit-amount').value = '';
        fetchBalances();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (withdrawForm) {
    withdrawForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const accountType = document.getElementById('withdraw-account').value;
      const amount = parseFloat(document.getElementById('withdraw-amount').value);

      try {
        const res = await fetch('/api/customer/withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, accountType })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`Successfully withdrew $${amount.toFixed(2)} from ${accountType}.`, 'success');
        document.getElementById('withdraw-amount').value = '';
        fetchBalances();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (transferForm) {
    transferForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const receiverAccountNumber = document.getElementById('transfer-recipient').value.trim();
      const amount = parseFloat(document.getElementById('transfer-amount').value);
      const description = document.getElementById('transfer-desc').value.trim();

      try {
        const res = await fetch('/api/customer/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiverAccountNumber, amount, description })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        if (data.transaction.status === 'pending_approval') {
          showToast(`Transfer of $${amount.toFixed(2)} is pending Manager Compliance Approval due to limit limits.`, 'info');
        } else {
          showToast(`Successfully transferred $${amount.toFixed(2)} to account ${receiverAccountNumber}.`, 'success');
        }
        
        document.getElementById('transfer-recipient').value = '';
        document.getElementById('transfer-amount').value = '';
        document.getElementById('transfer-desc').value = '';
        
        fetchBalances();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('goal-name').value.trim();
      const targetAmount = parseFloat(document.getElementById('goal-target').value);
      const deadline = document.getElementById('goal-deadline').value;

      try {
        const res = await fetch('/api/customer/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, targetAmount, deadline })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`Savings Goal "${name}" established.`, 'success');
        document.getElementById('goal-name').value = '';
        document.getElementById('goal-target').value = '';
        document.getElementById('goal-deadline').value = '';
        
        fetchSavingsGoals();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (allocateForm) {
    allocateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const goalId = document.getElementById('allocate-goal-id').value;
      const amount = parseFloat(document.getElementById('allocate-amount').value);

      try {
        const res = await fetch('/api/customer/goals/allocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goalId, amount })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`Allocated $${amount.toFixed(2)} to savings goal!`, 'success');
        closeModal('allocate-goal-modal');
        fetchSavingsGoals();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

// --- RENDER DYNAMIC CHART (CUSTOMER) ---
async function renderCustomerFlowChart() {
  try {
    const res = await fetch('/api/customer/transactions');
    if (!res.ok) throw new Error();
    const list = await res.json();

    // Sum Credits vs Debits of completed transactions
    let inflow = 0;
    let outflow = 0;

    list.filter(t => t.status === 'completed').forEach(t => {
      const isCredit = (t.receiverId === currentUser.id && t.type === 'transfer') || t.type === 'deposit';
      if (isCredit) {
        inflow += t.amount;
      } else {
        outflow += t.amount;
      }
    });

    const ctx = document.getElementById('customerCashFlowChart');
    if (!ctx) return;

    if (cashFlowChartInstance) {
      cashFlowChartInstance.destroy();
    }

    cashFlowChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Cash Inflow (Credits)', 'Cash Outflow (Debits)'],
        datasets: [{
          data: [inflow, outflow],
          backgroundColor: [
            'rgba(0, 245, 160, 0.4)',
            'rgba(255, 77, 109, 0.4)'
          ],
          borderColor: [
            '#00f5a0',
            '#ff4d6d'
          ],
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9499c3', font: { family: 'Inter' } }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#9499c3', font: { family: 'Inter' } }
          }
        }
      }
    });
  } catch (err) {
    console.error(err);
  }
}


// --- MANAGER CORE API INTEGRATIONS ---

async function fetchManagerAnalytics() {
  try {
    const res = await fetch('/api/manager/analytics');
    if (!res.ok) throw new Error();
    const data = await res.json();

    document.getElementById('mgr-total-assets').textContent = `$${data.totalAssets.toLocaleString()}`;
    document.getElementById('mgr-total-checking').textContent = `$${data.totalChecking.toLocaleString()}`;
    document.getElementById('mgr-total-savings').textContent = `$${data.totalSavings.toLocaleString()}`;
    document.getElementById('mgr-active-users').textContent = data.activeUsers;
    document.getElementById('mgr-total-users').textContent = data.activeUsers + data.frozenUsers;
    document.getElementById('mgr-frozen-users').textContent = data.frozenUsers;

    // Pending Alert Badge
    const alertBadge = document.getElementById('mgr-pending-alert-badge');
    if (alertBadge) {
      alertBadge.textContent = `${data.pendingApprovals} Pending`;
      if (data.pendingApprovals > 0) {
        alertBadge.style.background = 'var(--warning)';
        alertBadge.style.color = '#080811';
      } else {
        alertBadge.style.background = 'rgba(255,255,255,0.05)';
        alertBadge.style.color = 'var(--text-secondary)';
      }
    }

    // Populate alerts list briefly
    fetchManagerPendingAlerts();

    // Load Liquid chart
    renderManagerChart(data.totalChecking, data.totalSavings);
  } catch (err) {
    showToast('Failed to load system analytics.', 'error');
  }
}

async function fetchManagerPendingAlerts() {
  try {
    const res = await fetch('/api/manager/approvals');
    if (!res.ok) throw new Error();
    const pending = await res.json();

    const container = document.getElementById('mgr-pending-alerts-list');
    if (!container) return;

    if (pending.length === 0) {
      container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px 0;">All transactions cleared. No actions needed.</p>`;
      return;
    }

    container.innerHTML = pending.slice(0, 3).map(tx => `
      <div class="transaction-row" style="border-color: rgba(255, 209, 102, 0.2);">
        <div class="tx-left">
          <div class="tx-icon-wrapper" style="background: rgba(255, 209, 102, 0.1); color: var(--warning)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div class="tx-details">
            <span class="title">Verify Transfer: $${tx.amount.toLocaleString()}</span>
            <span class="meta">Sender: ${tx.senderName} &rarr; Recipient: ${tx.receiverName}</span>
          </div>
        </div>
        <button class="btn btn-primary" onclick="switchTab('mgr-approvals')" style="padding: 6px 12px; font-size:12px; border-radius:6px;">Resolve</button>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function pollPendingApprovalsCount() {
  try {
    const res = await fetch('/api/manager/approvals');
    if (!res.ok) throw new Error();
    const pending = await res.json();
    const badge = document.getElementById('nav-pending-count');
    if (badge) {
      badge.textContent = pending.length;
      badge.style.display = pending.length > 0 ? 'inline-flex' : 'none';
    }
  } catch (err) {
    console.error(err);
  }
}

async function fetchManagerUsers() {
  const search = document.getElementById('mgr-user-search').value;
  const status = document.getElementById('mgr-user-status-filter').value;

  try {
    const res = await fetch(`/api/manager/users?search=${encodeURIComponent(search)}&status=${status}`);
    if (!res.ok) throw new Error();
    const list = await res.json();

    const tbody = document.getElementById('mgr-users-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="color: var(--text-secondary); text-align: center; padding: 30px 0;">No matching customers found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(u => {
      const isFrozen = u.status === 'frozen';
      const actionBtn = isFrozen 
        ? `<button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px; border-radius: 6px;" onclick="changeUserStatus('${u.id}', 'active')">Unfreeze</button>`
        : `<button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px; border-radius: 6px;" onclick="changeUserStatus('${u.id}', 'frozen')">Freeze</button>`;

      return `
        <tr>
          <td style="font-family: var(--font-display); font-weight: 500;">${u.accountNumber}</td>
          <td style="font-weight:600;">${u.username}</td>
          <td>${u.email}</td>
          <td style="color: var(--success); font-weight:600;">$${u.checkingBalance.toFixed(2)}</td>
          <td style="color: var(--accent-secondary);">$${u.savingsBalance.toFixed(2)}</td>
          <td><span class="user-status-badge ${u.status}">${u.status}</span></td>
          <td>${actionBtn}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Failed to load user directory.', 'error');
  }
}

async function changeUserStatus(userId, newStatus) {
  try {
    const res = await fetch(`/api/manager/users/${userId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error();
    
    showToast(`User status updated to ${newStatus}.`, 'success');
    fetchManagerUsers();
  } catch (err) {
    showToast('Failed to update user status.', 'error');
  }
}

async function fetchManagerApprovals() {
  try {
    const res = await fetch('/api/manager/approvals');
    if (!res.ok) throw new Error();
    const list = await res.json();

    const tbody = document.getElementById('mgr-approvals-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="color: var(--text-secondary); text-align: center; padding: 30px 0;">No pending transactions compliance checks.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(tx => `
      <tr>
        <td style="font-size:11px; font-family: monospace;">${tx.id}</td>
        <td><strong>${tx.senderName}</strong><br><span style="font-size:11px; color:var(--text-secondary);">${tx.senderAccount}</span></td>
        <td><strong>${tx.receiverName}</strong><br><span style="font-size:11px; color:var(--text-secondary);">${tx.receiverAccount}</span></td>
        <td style="font-family: var(--font-display); font-weight:700; color:var(--warning);">$${tx.amount.toLocaleString()}</td>
        <td>${tx.description}</td>
        <td style="font-size: 12px; color:var(--text-secondary);">${new Date(tx.timestamp).toLocaleString()}</td>
        <td>
          <div style="display:flex; gap: 8px;">
            <button class="btn btn-primary" style="padding: 6px 12px; font-size: 11px; border-radius:6px;" onclick="resolveApproval('${tx.id}', 'approve')">Approve</button>
            <button class="btn btn-danger" style="padding: 6px 12px; font-size: 11px; border-radius:6px;" onclick="resolveApproval('${tx.id}', 'reject')">Reject</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load pending queue.', 'error');
  }
}

async function resolveApproval(txId, action) {
  try {
    const res = await fetch(`/api/manager/approvals/${txId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Transaction ${action === 'approve' ? 'Approved' : 'Rejected'} successfully.`, 'success');
    fetchManagerApprovals();
    pollPendingApprovalsCount();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function fetchManagerAuditLogs() {
  try {
    const res = await fetch('/api/manager/audit-logs');
    if (!res.ok) throw new Error();
    const logs = await res.json();

    const container = document.getElementById('mgr-audit-logs-list');
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px 0;">No system activities logged.</p>`;
      return;
    }

    container.innerHTML = logs.map(l => `
      <div class="audit-row">
        <span class="audit-action ${l.action}">${l.action.replace('_', ' ')}</span>
        <div class="audit-details">
          <strong>${l.username}</strong> - ${l.details}
        </div>
        <span class="audit-time">${new Date(l.timestamp).toLocaleString()}</span>
      </div>
    `).join('');
  } catch (err) {
    showToast('Failed to load audit logs.', 'error');
  }
}

// --- RENDER DYNAMIC CHART (MANAGER) ---
function renderManagerChart(checkingAssets, savingsAssets) {
  const ctx = document.getElementById('managerLiquidityChart');
  if (!ctx) return;

  if (managerChartInstance) {
    managerChartInstance.destroy();
  }

  managerChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Checking Capital', 'Savings Capital'],
      datasets: [{
        data: [checkingAssets, savingsAssets],
        backgroundColor: [
          'rgba(0, 245, 160, 0.45)',
          'rgba(125, 95, 255, 0.45)'
        ],
        borderColor: [
          '#00f5a0',
          '#7d5fff'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9499c3', font: { family: 'Inter', size: 11 } }
        }
      },
      cutout: '65%'
    }
  });
}

// --- LOGOUT API ---
async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    showToast('Logged out.', 'info');
    setTimeout(() => window.location.href = '/index.html', 500);
  } catch (err) {
    window.location.href = '/index.html';
  }
}
