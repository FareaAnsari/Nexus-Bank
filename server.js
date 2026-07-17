require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// --- AUTH MIDDLEWARE ---
const requireAuth = (req, res, next) => {
  const userId = req.cookies.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  const user = db.getUserById(userId);
  if (!user) {
    res.clearCookie('userId');
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  if (user.status === 'frozen') {
    return res.status(403).json({ error: 'Your account is frozen. Transactions and dashboard access are restricted.' });
  }
  req.user = user;
  next();
};

const requireManager = (req, res, next) => {
  const userId = req.cookies.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  const user = db.getUserById(userId);
  if (!user || user.role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden. Manager privileges required.' });
  }
  req.user = user;
  next();
};

// --- AUTH ENDPOINTS ---
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const newUser = await db.createUser(username, email, password, 'customer');
    res.cookie('userId', newUser.id, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const user = await db.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    res.cookie('userId', user.id, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json(user);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('userId');
  res.json({ message: 'Logged out successfully.' });
});

app.get('/api/auth/me', (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const user = db.getUserById(userId);
  if (!user) {
    res.clearCookie('userId');
    return res.status(401).json({ error: 'Session expired.' });
  }
  res.json(user);
});

// --- CUSTOMER ENDPOINTS ---
app.get('/api/customer/profile', requireAuth, (req, res) => {
  res.json(req.user);
});

app.post('/api/customer/deposit', requireAuth, async (req, res) => {
  const { amount, accountType } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid deposit amount required.' });
  }
  try {
    const result = await db.deposit(req.user.id, numAmount, accountType || 'checking');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/customer/withdraw', requireAuth, async (req, res) => {
  const { amount, accountType } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid withdrawal amount required.' });
  }
  try {
    const result = await db.withdraw(req.user.id, numAmount, accountType || 'checking');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/customer/transfer', requireAuth, async (req, res) => {
  const { receiverAccountNumber, amount, description } = req.body;
  const numAmount = parseFloat(amount);
  if (!receiverAccountNumber || isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid recipient account and transfer amount required.' });
  }
  try {
    const result = await db.initiateTransfer(req.user.id, receiverAccountNumber, numAmount, description);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/customer/transactions', requireAuth, (req, res) => {
  try {
    const { search = '', type = 'all', sort = 'newest' } = req.query;
    let list = db.getTransactionLedger(req.user.id);

    // Apply Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => 
        t.description.toLowerCase().includes(q) ||
        t.senderName.toLowerCase().includes(q) ||
        t.receiverName.toLowerCase().includes(q) ||
        (t.senderAccount && t.senderAccount.includes(q)) ||
        (t.receiverAccount && t.receiverAccount.includes(q))
      );
    }

    // Apply Type Filter
    if (type !== 'all') {
      list = list.filter(t => t.type === type);
    }

    // Apply Sorting
    if (sort === 'oldest') {
      list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else {
      list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customer/goals', requireAuth, async (req, res) => {
  try {
    const goals = await db.getSavingsGoals(req.user.id);
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customer/goals', requireAuth, async (req, res) => {
  const { name, targetAmount, deadline } = req.body;
  const numTarget = parseFloat(targetAmount);
  if (!name || isNaN(numTarget) || numTarget <= 0) {
    return res.status(400).json({ error: 'Goal name and target amount are required.' });
  }
  try {
    const goal = await db.createSavingsGoal(req.user.id, name, numTarget, deadline);
    res.status(201).json(goal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/customer/goals/allocate', requireAuth, async (req, res) => {
  const { goalId, amount } = req.body;
  const numAmount = parseFloat(amount);
  if (!goalId || isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Goal ID and allocation amount are required.' });
  }
  try {
    const result = await db.allocateToGoal(req.user.id, goalId, numAmount);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- MANAGER ENDPOINTS ---
app.get('/api/manager/analytics', requireManager, (req, res) => {
  try {
    const stats = db.getAnalytics();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/manager/users', requireManager, (req, res) => {
  const { search = '', status = 'all' } = req.query;
  try {
    const users = db.getAllUsers(search, status);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/manager/users/:id/status', requireManager, async (req, res) => {
  const { status } = req.body;
  const userId = req.params.id;
  try {
    const result = await db.setUserStatus(userId, req.user.id, status);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/manager/approvals', requireManager, (req, res) => {
  try {
    const pending = db.getPendingApprovals();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/manager/approvals/:id', requireManager, async (req, res) => {
  const txId = req.params.id;
  const { action } = req.body; // 'approve' or 'reject'
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject.' });
  }
  try {
    const result = await db.handlePendingApproval(txId, req.user.id, action);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/manager/audit-logs', requireManager, (req, res) => {
  try {
    const logs = db.getAuditLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Wildcard routing to send HTML dashboard/landing pages
app.get('*', (req, res) => {
  // Let the client static middleware handle actual static files first
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Nexus Bank Server running on http://localhost:${PORT}`);
});
