const db = require('./database.js');

async function seed() {
  console.log('Starting database seeding...');
  try {
    // 1. Create Manager Account
    const manager = await db.createUser('admin', 'admin@nexusbank.com', 'admin123', 'manager');
    console.log('Created Manager Account:', manager.username);

    // 2. Create Customers
    const customer1 = await db.createUser('john_doe', 'john@gmail.com', 'password123', 'customer');
    console.log('Created Customer 1:', customer1.username, 'Account:', customer1.accountNumber);

    const customer2 = await db.createUser('jane_smith', 'jane@gmail.com', 'password123', 'customer');
    console.log('Created Customer 2:', customer2.username, 'Account:', customer2.accountNumber);

    // 3. Let's perform some transactions to populate history and charts
    console.log('Generating seed transactions...');
    
    // Deposit money for john_doe
    await db.deposit(customer1.id, 12000, 'checking');
    await db.deposit(customer1.id, 4000, 'savings');
    
    // Deposit money for jane_smith
    await db.deposit(customer2.id, 300, 'checking');
    await db.deposit(customer2.id, 1200, 'savings');

    // Withdrawals
    await db.withdraw(customer1.id, 500, 'checking');
    await db.withdraw(customer2.id, 50, 'checking');

    // Transfers
    await db.initiateTransfer(customer1.id, customer2.accountNumber, 350.00, 'Dinner split');
    await db.initiateTransfer(customer1.id, customer2.accountNumber, 120.50, 'Gas share');
    await db.initiateTransfer(customer2.id, customer1.accountNumber, 50.00, 'Refund');

    // Create a high-value transfer that remains PENDING for user to test admin approvals
    await db.initiateTransfer(customer1.id, customer2.accountNumber, 6500.00, 'Buying second-hand car');

    // Create a Savings Goal for john_doe
    const goal = await db.createSavingsGoal(customer1.id, 'New Macbook Pro', 2500.00, '2026-12-31');
    await db.allocateToGoal(customer1.id, goal.id, 1000.00);

    console.log('Database seeded successfully!');
  } catch (err) {
    console.error('Seeding failed:', err);
  }
}

seed();
