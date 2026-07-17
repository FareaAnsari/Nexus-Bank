# Nexus Bank

A premium, full-stack banking application with a glassmorphic user dashboard and management controls.

## 🚀 Getting Started

### 📋 Prerequisites

- **Node.js** (v14 or higher recommended)
- **npm** (comes with Node.js)

### ⚙️ Installation

1. Clone this repository to your local machine:
   ```bash
   git clone <your-repository-url>
   cd nexus-bank
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy the `.env.example` file to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Customize the variables in `.env` if needed (e.g., change `PORT`).

### 🗄️ Database Seeding

To seed the local file-based database with testing accounts, transactions, and audit logs:
```bash
node seed.js
```

Seeding creates the following test accounts:
* **Manager**: `admin` / `admin123`
* **Customer 1**: `john_doe` / `password123`
* **Customer 2**: `jane_smith` / `password123`

### 💻 Running the Server

Start the application locally:
```bash
npm start
```
The server will start, and the application will be accessible at `http://localhost:3000` (or whatever `PORT` you configured in your `.env` file).

---

## 🛠️ GitHub & Deployment Guidelines

### 🔒 Files Excluded from Version Control
The following files are excluded via `.gitignore` and **must not** be committed to GitHub:
- `node_modules/`: Local packages.
- `data/database.json`: Local database instances (each instance maintains its own data state).
- `.env`: Contains local configurations and secrets.

### 🌐 Deploying to Hosting Services (e.g. Render, Heroku)
1. Commit all files (excluding ignored files) and push to GitHub.
2. Connect your repository to your hosting provider.
3. Configure Environment Variables in the provider's settings panel matching the keys in `.env.example` (like `PORT`).
