const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initial Database Structure
const initialDb = {
  users: [],
  transactions: [],
  savingsGoals: [],
  auditLogs: []
};

// Write Lock Queue
let writeQueue = Promise.resolve();

function readDatabase() {
  try {
    if (!fs.existsSync(dbPath)) {
      writeDatabaseSync(initialDb);
      return initialDb;
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database, resetting to initial state:', err);
    return initialDb;
  }
}

function writeDatabaseSync(data) {
  const tempPath = `${dbPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, dbPath);
}

function queueWrite(data) {
  writeQueue = writeQueue.then(() => {
    return new Promise((resolve) => {
      try {
        writeDatabaseSync(data);
      } catch (err) {
        console.error('Error writing to database in queue:', err);
      }
      resolve();
    });
  });
  return writeQueue;
}

// Password Hashing Helper
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  const [salt, hash] = storedPassword.split(':');
  const checkHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === checkHash;
}

// Database Operations
const db = {
  // --- USER API ---
  async createUser(username, email, password, role = 'customer') {
    const data = readDatabase();
    
    // Check if user already exists
    const exists = data.users.some(u => 
      u.username.toLowerCase() === username.toLowerCase() || 
      u.email.toLowerCase() === email.toLowerCase()
    );
    if (exists) {
      throw new Error('Username or Email already registered.');
    }

    // Generate unique 10-digit account number starting with '10'
    let accountNumber;
    do {
      accountNumber = '10' + Math.floor(10000000 + Math.random() * 90000000).toString();
    } while (data.users.some(u => u.accountNumber === accountNumber));

    const id = 'u_' + crypto.randomBytes(8).toString('hex');
    const newUser = {
      id,
      username,
      email,
      passwordHash: hashPassword(password),
      role,
      checkingBalance: role === 'customer' ? 500.00 : 0.00, // $500 Sign-up bonus for testing
      savingsBalance: 0.00,
      status: 'active', // 'active' or 'frozen'
      accountNumber,
      createdAt: new Date().toISOString()
    };

    data.users.push(newUser);
    await queueWrite(data);

    // Log the user registration
    await this.logAction(id, username, 'register', `User registered successfully. Role: ${role}, Account: ${accountNumber}`);

    const { passwordHash, ...userResponse } = newUser;
    return userResponse;
  },

  getUserById(id) {
    const data = readDatabase();
    const user = data.users.find(u => u.id === id);
    if (!user) return null;
    const { passwordHash, ...userResponse } = user;
    return userResponse;
  },

  getUserByUsername(username) {
    const data = readDatabase();
    return data.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  },

  getUserByAccountNumber(accountNumber) {
    const data = readDatabase();
    const user = data.users.find(u => u.accountNumber === accountNumber);
    if (!user) return null;
    const { passwordHash, ...userResponse } = user;
    return userResponse;
  },

  async authenticateUser(username, password) {
    const user = this.getUserByUsername(username);
    if (!user) return null;
    if (user.status === 'frozen') {
      throw new Error('This account has been frozen. Please contact customer service.');
    }
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) return null;
    
    // Log the login action
    await this.logAction(user.id, user.username, 'login', 'User logged in.');
    
    const { passwordHash, ...userResponse } = user;
    return userResponse;
  },

  // --- CUSTOMER TRANSACTION OPERATIONS ---
  async deposit(userId, amount, accountType = 'checking') {
    if (amount <= 0) throw new Error('Deposit amount must be greater than zero.');
    const data = readDatabase();
    const user = data.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (user.status === 'frozen') throw new Error('Account is frozen.');

    const cleanAmount = parseFloat(amount.toFixed(2));
    if (accountType === 'savings') {
      user.savingsBalance = parseFloat((user.savingsBalance + cleanAmount).toFixed(2));
    } else {
      user.checkingBalance = parseFloat((user.checkingBalance + cleanAmount).toFixed(2));
    }

    const txId = 'tx_' + crypto.randomBytes(8).toString('hex');
    const transaction = {
      id: txId,
      senderId: 'system',
      senderName: 'ATM Deposit',
      receiverId: userId,
      receiverName: user.username,
      type: 'deposit',
      accountType,
      amount: cleanAmount,
      description: `Deposited $${cleanAmount.toFixed(2)} to ${accountType} account.`,
      status: 'completed',
      timestamp: new Date().toISOString()
    };

    data.transactions.push(transaction);
    await queueWrite(data);

    await this.logAction(userId, user.username, 'deposit', `Deposited $${cleanAmount.toFixed(2)} to ${accountType}`);
    return { balance: accountType === 'savings' ? user.savingsBalance : user.checkingBalance, transaction };
  },

  async withdraw(userId, amount, accountType = 'checking') {
    if (amount <= 0) throw new Error('Withdrawal amount must be greater than zero.');
    const data = readDatabase();
    const user = data.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (user.status === 'frozen') throw new Error('Account is frozen.');

    const cleanAmount = parseFloat(amount.toFixed(2));
    const currentBalance = accountType === 'savings' ? user.savingsBalance : user.checkingBalance;
    if (currentBalance < cleanAmount) {
      throw new Error('Insufficient funds.');
    }

    if (accountType === 'savings') {
      user.savingsBalance = parseFloat((user.savingsBalance - cleanAmount).toFixed(2));
    } else {
      user.checkingBalance = parseFloat((user.checkingBalance - cleanAmount).toFixed(2));
    }

    const txId = 'tx_' + crypto.randomBytes(8).toString('hex');
    const transaction = {
      id: txId,
      senderId: userId,
      senderName: user.username,
      receiverId: 'system',
      receiverName: 'ATM Withdrawal',
      type: 'withdraw',
      accountType,
      amount: cleanAmount,
      description: `Withdrew $${cleanAmount.toFixed(2)} from ${accountType} account.`,
      status: 'completed',
      timestamp: new Date().toISOString()
    };

    data.transactions.push(transaction);
    await queueWrite(data);

    await this.logAction(userId, user.username, 'withdraw', `Withdrew $${cleanAmount.toFixed(2)} from ${accountType}`);
    return { balance: accountType === 'savings' ? user.savingsBalance : user.checkingBalance, transaction };
  },

  async initiateTransfer(senderId, receiverAccountNumber, amount, description) {
    if (amount <= 0) throw new Error('Transfer amount must be greater than zero.');
    const data = readDatabase();
    const sender = data.users.find(u => u.id === senderId);
    if (!sender) throw new Error('Sender not found.');
    if (sender.status === 'frozen') throw new Error('Your account is frozen.');

    const receiver = data.users.find(u => u.accountNumber === receiverAccountNumber);
    if (!receiver) throw new Error('Recipient account number not found.');
    if (receiver.id === senderId) throw new Error('Cannot transfer to yourself.');
    if (receiver.status === 'frozen') throw new Error('Recipient account is frozen and cannot receive funds.');

    const cleanAmount = parseFloat(amount.toFixed(2));
    if (sender.checkingBalance < cleanAmount) {
      throw new Error('Insufficient funds in checking account.');
    }

    const txId = 'tx_' + crypto.randomBytes(8).toString('hex');
    const isHighValue = cleanAmount > 5000.00;
    const status = isHighValue ? 'pending_approval' : 'completed';

    // Deduct from sender's checking balance immediately
    sender.checkingBalance = parseFloat((sender.checkingBalance - cleanAmount).toFixed(2));

    if (status === 'completed') {
      // Add to receiver's checking balance immediately
      receiver.checkingBalance = parseFloat((receiver.checkingBalance + cleanAmount).toFixed(2));
    }

    const transaction = {
      id: txId,
      senderId: sender.id,
      senderName: sender.username,
      senderAccount: sender.accountNumber,
      receiverId: receiver.id,
      receiverName: receiver.username,
      receiverAccount: receiver.accountNumber,
      type: 'transfer',
      amount: cleanAmount,
      description: description || 'P2P Fund Transfer',
      status,
      timestamp: new Date().toISOString()
    };

    data.transactions.push(transaction);
    await queueWrite(data);

    if (isHighValue) {
      await this.logAction(sender.id, sender.username, 'transfer_pending', `Initiated high-value transfer of $${cleanAmount.toFixed(2)} to ${receiver.username}. Pending Manager Approval.`);
    } else {
      await this.logAction(sender.id, sender.username, 'transfer', `Transferred $${cleanAmount.toFixed(2)} to ${receiver.username}.`);
    }

    return { senderBalance: sender.checkingBalance, transaction };
  },

  async handlePendingApproval(txId, managerId, action) {
    // action: 'approve' or 'reject'
    const data = readDatabase();
    const txIndex = data.transactions.findIndex(t => t.id === txId && t.status === 'pending_approval');
    if (txIndex === -1) throw new Error('Pending transaction not found.');

    const tx = data.transactions[txIndex];
    const manager = data.users.find(u => u.id === managerId && u.role === 'manager');
    if (!manager) throw new Error('Unauthorized action.');

    const sender = data.users.find(u => u.id === tx.senderId);
    const receiver = data.users.find(u => u.id === tx.receiverId);

    if (action === 'approve') {
      tx.status = 'completed';
      if (receiver) {
        receiver.checkingBalance = parseFloat((receiver.checkingBalance + tx.amount).toFixed(2));
      } else {
        // Recipient account was somehow deleted, refund sender
        if (sender) {
          sender.checkingBalance = parseFloat((sender.checkingBalance + tx.amount).toFixed(2));
        }
        tx.status = 'rejected';
        tx.description += ' (Refunded - recipient account unavailable)';
      }
      await queueWrite(data);
      await this.logAction(managerId, manager.username, 'approve_transfer', `Approved high-value transfer ${txId} of $${tx.amount.toFixed(2)} from ${tx.senderName} to ${tx.receiverName}`);
    } else {
      tx.status = 'rejected';
      // Refund sender
      if (sender) {
        sender.checkingBalance = parseFloat((sender.checkingBalance + tx.amount).toFixed(2));
      }
      await queueWrite(data);
      await this.logAction(managerId, manager.username, 'reject_transfer', `Rejected high-value transfer ${txId} of $${tx.amount.toFixed(2)} from ${tx.senderName} to ${tx.receiverName}. Refunded.`);
    }

    return tx;
  },

  // --- SAVINGS GOALS ---
  async getSavingsGoals(userId) {
    const data = readDatabase();
    return data.savingsGoals.filter(g => g.userId === userId);
  },

  async createSavingsGoal(userId, name, targetAmount, deadline) {
    if (!name) throw new Error('Goal name is required.');
    if (targetAmount <= 0) throw new Error('Target amount must be greater than zero.');
    const data = readDatabase();
    
    const id = 'g_' + crypto.randomBytes(8).toString('hex');
    const newGoal = {
      id,
      userId,
      name,
      targetAmount: parseFloat(targetAmount.toFixed(2)),
      currentAmount: 0.00,
      deadline: deadline || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]
    };

    data.savingsGoals.push(newGoal);
    await queueWrite(data);

    const user = data.users.find(u => u.id === userId);
    await this.logAction(userId, user ? user.username : 'unknown', 'create_goal', `Created savings goal: ${name} (Target: $${targetAmount})`);
    return newGoal;
  },

  async allocateToGoal(userId, goalId, amount) {
    if (amount <= 0) throw new Error('Allocation amount must be greater than zero.');
    const data = readDatabase();

    const user = data.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (user.status === 'frozen') throw new Error('Account is frozen.');

    const goal = data.savingsGoals.find(g => g.id === goalId && g.userId === userId);
    if (!goal) throw new Error('Savings goal not found.');

    const cleanAmount = parseFloat(amount.toFixed(2));
    if (user.checkingBalance < cleanAmount) {
      throw new Error('Insufficient funds in checking account.');
    }

    // Deduct checking, transfer to savings, add to goal current amount
    user.checkingBalance = parseFloat((user.checkingBalance - cleanAmount).toFixed(2));
    user.savingsBalance = parseFloat((user.savingsBalance + cleanAmount).toFixed(2));
    goal.currentAmount = parseFloat((goal.currentAmount + cleanAmount).toFixed(2));

    const txId = 'tx_' + crypto.randomBytes(8).toString('hex');
    const transaction = {
      id: txId,
      senderId: userId,
      senderName: user.username,
      receiverId: 'system',
      receiverName: `Goal: ${goal.name}`,
      type: 'transfer',
      accountType: 'savings',
      amount: cleanAmount,
      description: `Allocated $${cleanAmount.toFixed(2)} to savings goal: ${goal.name}.`,
      status: 'completed',
      timestamp: new Date().toISOString()
    };

    data.transactions.push(transaction);
    await queueWrite(data);

    await this.logAction(userId, user.username, 'goal_allocated', `Allocated $${cleanAmount.toFixed(2)} to goal: ${goal.name}`);
    return { balance: user.checkingBalance, goal };
  },

  // --- MANAGEMENT / MANAGER FUNCTIONS ---
  getAllUsers(search = '', status = 'all') {
    const data = readDatabase();
    return data.users
      .filter(u => {
        const matchesSearch = u.username.toLowerCase().includes(search.toLowerCase()) || 
                              u.email.toLowerCase().includes(search.toLowerCase()) ||
                              u.accountNumber.includes(search);
        const matchesStatus = status === 'all' || u.status === status;
        return matchesSearch && matchesStatus;
      })
      .map(u => {
        const { passwordHash, ...userResponse } = u;
        return userResponse;
      });
  },

  async setUserStatus(userId, managerId, status) {
    if (!['active', 'frozen'].includes(status)) throw new Error('Invalid status.');
    const data = readDatabase();
    const user = data.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (user.role === 'manager') throw new Error('Cannot change status of managers.');

    const manager = data.users.find(u => u.id === managerId && u.role === 'manager');
    if (!manager) throw new Error('Unauthorized.');

    user.status = status;
    await queueWrite(data);

    await this.logAction(managerId, manager.username, `user_${status}`, `${status.toUpperCase()} account for user ${user.username} (ID: ${userId})`);
    return { userId, status };
  },

  getPendingApprovals() {
    const data = readDatabase();
    return data.transactions.filter(t => t.status === 'pending_approval');
  },

  getTransactionLedger(userId = null) {
    const data = readDatabase();
    if (userId) {
      return data.transactions.filter(t => t.senderId === userId || t.receiverId === userId);
    }
    return data.transactions;
  },

  getAuditLogs() {
    const data = readDatabase();
    return data.auditLogs.slice().reverse(); // Show latest logs first
  },

  getAnalytics() {
    const data = readDatabase();
    const customers = data.users.filter(u => u.role === 'customer');
    
    const totalChecking = customers.reduce((sum, u) => sum + u.checkingBalance, 0);
    const totalSavings = customers.reduce((sum, u) => sum + u.savingsBalance, 0);
    const totalActive = customers.filter(u => u.status === 'active').length;
    const totalFrozen = customers.filter(u => u.status === 'frozen').length;

    const completedTx = data.transactions.filter(t => t.status === 'completed');
    const totalTransferVol = completedTx
      .filter(t => t.type === 'transfer' && t.senderId !== 'system' && t.receiverId !== 'system')
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingApprovalsCount = data.transactions.filter(t => t.status === 'pending_approval').length;

    // Monthly analytics trends (group by last 6 months)
    const monthlyData = {};
    completedTx.forEach(t => {
      const date = new Date(t.timestamp);
      const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { deposits: 0, withdrawals: 0, transfers: 0 };
      }
      if (t.type === 'deposit') {
        monthlyData[monthKey].deposits += t.amount;
      } else if (t.type === 'withdraw') {
        monthlyData[monthKey].withdrawals += t.amount;
      } else if (t.type === 'transfer') {
        monthlyData[monthKey].transfers += t.amount;
      }
    });

    return {
      totalAssets: parseFloat((totalChecking + totalSavings).toFixed(2)),
      totalChecking: parseFloat(totalChecking.toFixed(2)),
      totalSavings: parseFloat(totalSavings.toFixed(2)),
      activeUsers: totalActive,
      frozenUsers: totalFrozen,
      transferVolume: parseFloat(totalTransferVol.toFixed(2)),
      pendingApprovals: pendingApprovalsCount,
      monthlyAnalytics: monthlyData
    };
  },

  // --- LOGGING ---
  async logAction(userId, username, action, details) {
    const data = readDatabase();
    const logId = 'log_' + crypto.randomBytes(8).toString('hex');
    const log = {
      id: logId,
      userId,
      username,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    data.auditLogs.push(log);
    await queueWrite(data);
    return log;
  }
};

module.exports = db;
