# 🩸 LifeDrop - Full-Stack Emergency Blood Portal

LifeDrop is a secure, feature-rich, full-stack banking-style portal for emergency blood stock management and donor rewards. The application is built with **Node.js, Express, and SQLite3**, providing dual-channel notifications (SMS via Twilio and email via SMTP/Nodemailer) to alert patients of blood request approvals or denials in real time.

---

## 🚀 Key Features

* **🏥 Hospital Dashboard**: Secure doctor authentication, real-time blood stock adjustment (A+, A-, B+, B-, AB+, AB-, O+, O-), and incoming request management (approve/deny requests).
* **🩸 Donor Portal**: Donor registration/login, points tracker (rewards system), and donation history.
* **👤 Patient Portal**: Register or login to view request status (pending, approved, denied) and auto-link legacy requests based on contact number.
* **⚡ Dual-Channel Alert System**: Dual notifications utilizing Twilio SMS as the primary channel and Nodemailer SMTP as the secure email backup.
* **📈 Self-Seeding Database**: SQLite3 database auto-initializes and self-seeds with Mumbai/Maharashtra hospitals and stock records on first launch.

---

## 🛠️ Technology Stack

* **Backend**: Node.js, Express
* **Database**: SQLite3 (relational, file-based)
* **API Integrations**: Twilio SMS API, Nodemailer (SMTP)
* **Frontend**: HTML5, Vanilla CSS3 (glassmorphic theme), JavaScript

---

## 📋 Pre-requisites

* [Node.js](https://nodejs.org/) (v16+ recommended)
* A [Twilio Account](https://www.twilio.com/) (optional, for real SMS)
* A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) (optional, for real email alerts)

---

## ⚙️ Setup & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/FareaAnsari/farea-ansari.git
cd Website
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the environment template file:
```bash
cp .env.example .env
```
Open the newly created `.env` file and input your credentials:
```env
# SMTP Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# Twilio Configuration
TWILIO_SID=your_twilio_sid
TWILIO_AUTH=your_twilio_auth_token
TWILIO_FROM=your_twilio_phone_number
```
> **Note**: If you leave the credentials as placeholders, the server will fall back to **clinical simulation mode** (using Ethereal email simulation and terminal logging for SMS).

### 4. Run the Application
Start the Node.js server:
```bash
node server.js
```
The server will start on `http://localhost:3000` (or `http://localhost:5000` / dynamic port if defined). You will see the database auto-connection and hospital seeding console messages.

---

## 🗃️ Database Schema & Seeding
On the first application run, the SQLite database (`database.sqlite`) is created in the root folder. It initializes the following tables:
* `hospital`: Hospital registry profiles
* `blood_stock`: Dynamic units count for each blood group per hospital
* `doctor_account`: Medical staff credentials
* `donor_account`: Registered donors and point metrics
* `patient_account`: Patient authentication and metadata
* `blood_request`: Transaction requests from patients to hospitals
* `donation_history`: Logged donor units and hospital credits

---

## 🧰 Diagnostics & Utility Scripts

Several helper scripts are included to test integrations and verify the database:

* **`diagnose-notifications.js`**: Runs diagnostic checks on your `.env` configuration, Twilio credentials, SMTP credentials, and SQLite table schema.
  ```bash
  node diagnose-notifications.js
  ```
* **`test-sms.js`**: Test dispatching a physical SMS to your registered Twilio number.
  ```bash
  node test-sms.js
  ```
* **`check_db.js`**: Quick script to list all registered patient accounts and active blood requests in the SQLite database.
  ```bash
  node check_db.js
  ```
* **`find-number.js`**: Scans your Twilio account to list active virtual phone numbers.
  ```bash
  node find-number.js
  ```
* **`verify-caller-id.js`**: Triggers Twilio validation calls to register personal numbers for testing on Twilio trial accounts.
  ```bash
  node verify-caller-id.js
  ```

---

## 🔒 Deployment Configuration

The repository is configured to exclude local environment configuration, dependency directories, and dynamic SQLite database files to ensure clean and secure deployments:
* **`.gitignore`** is configured to ignore `node_modules/`, `.env`, and all SQLite `.db`/`.sqlite` files.
* **`.env.example`** is provided to safely demonstrate variable requirements to deployment environments.
