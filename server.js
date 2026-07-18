const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const db = require('./database');
require('dotenv').config();

const app = express();

// --- Nodemailer Transporter Setup ---
// --- Nodemailer Transporter Setup ---
let transporter;

async function initTransporter() {
    const isPlaceholder = (val) => !val || val.includes('your_email_here') || val.includes('16_digit_app_password');
    
    if (!isPlaceholder(process.env.EMAIL_USER) && !isPlaceholder(process.env.EMAIL_PASS)) {
        // Real SMTP Transporter (e.g. Gmail/Outlook)
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        console.log("\x1b[32m>>> [PRODUCTION] Real SMTP Transporter Active! Using:", process.env.EMAIL_USER, "\x1b[0m");
    } else {
        // Fallback to Ethereal Testing (Simulated)
        try {
            const account = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: account.smtp.host,
                port: account.smtp.port,
                secure: account.smtp.secure,
                auth: { user: account.user, pass: account.pass }
            });
            console.log(">>> [SIMULATION] Placeholder .env found. Using Ethereal Account for testing.");
            console.log(">>> [SIMULATION] Tokens will appear in terminal and in 'Dev Mode' UI.");
        } catch (err) {
            console.error(">>> [ERROR] Failed to initialize fallback mailer:", err);
        }
    }
}
initTransporter();

// --- SMS Configuration (Hybrid Implementation) ---
const smsHistory = []; // Store last 10 messages for developer visibility
const SMS_CONFIG = {
    // If TWILIO_SID is provided in .env, use 'twilio', otherwise use 'console' (Simulation)
    provider: (process.env.TWILIO_SID && !process.env.TWILIO_SID.includes('ACXXXXXXXXXXX')) ? 'twilio' : 'console',
    twilio: {
        accountSid: process.env.TWILIO_SID || 'ACXXXXXXXXXXX',
        authToken: process.env.TWILIO_AUTH || 'XXXXXXXXXXXXX',
        fromNumber: process.env.TWILIO_FROM || '+1234567890'
    }
};

async function sendSMS(to, message, emailTo = null, emailStatus = 'Not Provided') {
    if (!to) return;
    
    // Normalize Indian numbers: if 10 digits, add +91 prefix
    let formattedTo = to.trim();
    if (formattedTo.length === 10 && /^\d+$/.test(formattedTo)) {
        formattedTo = `+91${formattedTo}`;
        console.log(`\x1b[36m[INDIAN CITIZEN DETECTED] Auto-applying +91 prefix for national mobile delivery to: ${formattedTo}\x1b[0m`);
    }
    
    // Simulate real SMS sending with a slight delay
    console.log(`\x1b[33m[SMS SYSTEM-OUT] Sending to ${formattedTo}: "${message}"\x1b[0m`);
    
    // Store in history
    const normalizedFrom = (SMS_CONFIG.twilio.fromNumber || '').trim();
    const isSelfTest = (formattedTo === normalizedFrom || formattedTo.includes(normalizedFrom.replace('+', '')));
    
    smsHistory.unshift({ 
        to: formattedTo, 
        message, 
        timestamp: new Date().toISOString(),
        status: isSelfTest ? 'Simulated (Self-Test)' : 'Real Delivery Attempt',
        emailTo: emailTo || 'No Backup Email',
        emailStatus: emailStatus
    });
    if (smsHistory.length > 20) smsHistory.pop();

    // Safety check: Twilio prevents sending to yourself (Error 21266)
    if (isSelfTest) {
        console.log(`\x1b[35m[SMS SELF-TEST] Detected same 'To' and 'From' numbers. Skipping real Twilio call to prevent error 21266... (Mock Success)\x1b[0m`);
        return true;
    }

    if (SMS_CONFIG.provider === 'twilio' && SMS_CONFIG.twilio.accountSid !== 'ACXXXXXXXXXXX') {
        try {
            const client = twilio(SMS_CONFIG.twilio.accountSid, SMS_CONFIG.twilio.authToken);
            await client.messages.create({
                body: message,
                from: SMS_CONFIG.twilio.fromNumber,
                to: formattedTo
            });
            console.log(`\x1b[32m[SMS SUCCESS] Mobile Global Delivery: Message successfully dispatched to cellular network for ${formattedTo}\x1b[0m`);
        } catch (err) {
            console.error(`\x1b[31m[SMS ERROR] Delivery Failure: Failed to reach mobile SMS application for ${formattedTo}: ${err.message}\x1b[0m`);
            
            if (err.message.includes('is not a Twilio phone number')) {
                console.log(`\x1b[33m--- URGENT FIX: Your TWILIO_FROM (+91932183...) is a PERSONAL number! ---\x1b[0m`);
                console.log(`\x1b[33m1. Log in to https://console.twilio.com\x1b[0m`);
                console.log(`\x1b[33m2. Click 'Get a Twilio Phone Number'\x1b[0m`);
                console.log(`\x1b[33m3. Copy that number (starts with +1) into your .env file as TWILIO_FROM.\x1b[0m`);
            } else if (err.message.includes('is unverified')) {
                console.log(`\x1b[31m[TRIAL ALERT] Unverified Patient Number: ${formattedTo}\x1b[0m`);
                console.log(`\x1b[33m--- FALLBACK: Switching to Clinical Simulation for this patient only ---\x1b[0m`);
                
                // Update the last history entry to show it was simulated
                if (smsHistory.length > 0 && smsHistory[0].to === formattedTo) {
                    smsHistory[0].status = 'Simulated (Trial Lock)';
                }
            } else if (err.code === 21266) {
                console.log(`\x1b[33m--- FIX: Your 'From' number and 'To' number cannot be the same. Use a Twilio number as the 'From' sender! ---\x1b[0m`);
            }
        }
    }
    
    return true;
}

app.use(cors());
app.use(express.json());

// Serve static files from current directory
app.use(express.static(__dirname));

// --- Authentication Endpoints ---


// Register Doctor (Using Email)
app.get('/api/sms-logs', (req, res) => res.json({ logs: smsHistory }));
app.post('/api/auth/register-doctor', (req, res) => {
    const { hospitalId, doctorName, doctorId, password, isNewHospital, hospitalData } = req.body;

    if (!hospitalId || !doctorName || !doctorId || !password) {
        return res.status(400).json({ error: 'Missing registration details' });
    }

    if (!/^\S+@\S+\.\S+$/.test(doctorId)) {
        return res.status(400).json({ error: 'Doctor ID must be a valid email address.' });
    }

    // Admin flow for creating a new hospital profile
    if (isNewHospital && hospitalData) {
        // Generate a unique, human-readable ID for the new hospital
        const newHospitalId = 'hosp-' + Date.now().toString().slice(-8);
        const hospitalName = hospitalData.name.trim();
        const hospitalArea = hospitalData.region || hospitalData.area || 'Unknown'; // Normalize across labels
        const hospitalAddress = hospitalData.address.trim();
        const hospitalDomain = hospitalName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';

        db.run(
            "INSERT INTO hospital (id, name, area, address, domain_id) VALUES (?, ?, ?, ?, ?)",
            [newHospitalId, hospitalName, hospitalArea, hospitalAddress, hospitalDomain],
            (err) => {
                if (err) {
                    console.error("New hospital creation error:", err.message);
                    if (err.message.includes('UNIQUE constraint failed: hospital.address')) {
                        return res.status(409).json({ error: 'A hospital is already registered at this address.' });
                    }
                    if (err.message.includes('UNIQUE constraint failed: hospital.name')) {
                        return res.status(409).json({ error: 'A hospital with this name already exists.' });
                    }
                    return res.status(500).json({ error: 'Failed to create hospital profile. ' + err.message });
                }
                
                db.run(
                    "INSERT INTO doctor_account (hospital_id, doctor_name, doctor_id, password) VALUES (?, ?, ?, ?)",
                    [newHospitalId, doctorName, doctorId, password],
                    function (err) {
                        if (err) {
                            console.error("New doctor account creation error:", err.message);
                            return res.status(500).json({ error: 'Account creation failed: ' + err.message });
                        }
                        res.status(201).json({ message: 'Hospital and Doctor registered successfully' });
                    }
                );
            }
        );
        return;
    }

    // Standard flow (Email-based registration)
    db.run(
        "INSERT INTO doctor_account (hospital_id, doctor_name, doctor_id, password) VALUES (?, ?, ?, ?)",
        [hospitalId, doctorName, doctorId, password],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Doctor ID already registered.' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'Doctor registered successfully' });
        }
    );
});

// Login Doctor (Using Email)
app.post('/api/auth/login', (req, res) => {
    const { hospitalId, doctorId, password } = req.body;

    db.get(
        "SELECT * FROM doctor_account WHERE hospital_id = ? AND doctor_id = ? AND password = ?",
        [hospitalId, doctorId, password],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            if (row) {
                // Success
                res.json({ message: 'Login successful', doctorId: row.doctor_id, doctorName: row.doctor_name, hospitalId: row.hospital_id });
            } else {
                // Fail
                res.status(401).json({ error: 'Invalid Email ID or password.' });
            }
        }
    );
});

// Auth Route: Forgot Password (Doctor Email OTP)
app.post('/api/auth/forgot-password', (req, res) => {
    const { doctorId } = req.body;
    if (!doctorId) return res.status(400).json({ error: 'Email ID is required.' });

    db.get('SELECT id FROM doctor_account WHERE LOWER(doctor_id) = LOWER(?)', [doctorId], (err, user) => {
        if (err) {
            console.error("Forgot password query error:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Return success even if not found to prevent user enumeration
        if (!user) return res.json({ message: 'If that email is registered, a recovery code has been sent.' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

        db.run('DELETE FROM password_resets WHERE doctor_id = ?', [doctorId], () => {
            db.run(
                'INSERT INTO password_resets (doctor_id, otp, expires_at) VALUES (?, ?, ?)',
                [doctorId, otp, expiresAt],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Failed to generate token' });
                    
                    console.log(`\n>>> [DOCTOR] SIMULATED EMAIL SENT TO ${doctorId} | CODE: ${otp}\n`);
                    
                    res.json({ 
                        message: 'Recovery code dispatched!',
                        otp: otp 
                    });
                }
            );
        });
    });
});

// Auth Route: Reset Password (Using Email & OTP)
app.post('/api/auth/reset-password', (req, res) => {
    const { doctorId, otp, newPassword } = req.body;

    if (!doctorId || !otp || !newPassword) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    db.get('SELECT * FROM password_resets WHERE doctor_id = ? AND otp = ? AND expires_at > datetime("now")',
        [doctorId, otp],
        (err, record) => {
            if (err) return res.status(500).json({ error: 'Database check failed.' });
            if (!record) return res.status(400).json({ error: 'Invalid or expired code.' });

            db.run('UPDATE doctor_account SET password = ? WHERE doctor_id = ?',
                [newPassword, doctorId],
                function(updateErr) {
                    if (updateErr) return res.status(500).json({ error: 'Failed to update password.' });

                    db.run('DELETE FROM password_resets WHERE doctor_id = ?', [doctorId]);
                    res.json({ message: 'Password updated successfully!' });
                }
            );
        }
    );
});

// --- API Endpoints ---

// 1. Get all hospitals
app.get('/api/hospitals', (req, res) => {
    db.all('SELECT * FROM hospital', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ hospitals: rows });
    });
});

// 2. Get blood stock for a specific hospital
app.get('/api/stock/:hospitalId', (req, res) => {
    db.all('SELECT * FROM blood_stock WHERE hospital_id = ?', [req.params.hospitalId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Format to map: { "A+": 5, "B-": 2 }
        const stockMap = {};
        rows.forEach(r => stockMap[r.blood_group] = r.quantity);
        res.json({ stock: stockMap });
    });
});

// 3. Update blood availability stock
app.post('/api/stock/update', (req, res) => {
    const { hospitalId, bloodGroup, quantity } = req.body;

    // Check if row exists first for this hospital + blood group combo
    db.get('SELECT id FROM blood_stock WHERE hospital_id = ? AND blood_group = ?', [hospitalId, bloodGroup], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            // Update existing row
            db.run(
                'UPDATE blood_stock SET quantity = ? WHERE hospital_id = ? AND blood_group = ?',
                [quantity, hospitalId, bloodGroup],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Stock updated successfully', changes: this.changes });
                }
            );
        } else {
            // Insert new row if hospital didn't previously stock this blood group
            db.run(
                'INSERT INTO blood_stock (hospital_id, blood_group, quantity) VALUES (?, ?, ?)',
                [hospitalId, bloodGroup, quantity],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Stock initialized successfully', changes: this.changes });
                }
            );
        }
    });
});

app.post('/api/requests', (req, res) => {
    const { hospitalId, patientId, patientName, patientContact, patientEmail, patientAddress, bloodGroup, unitsRequired, isDonor, donorEmail } = req.body;
    
    if (!hospitalId || !patientName || !patientContact || !patientAddress || !bloodGroup || !unitsRequired) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.run(
        'INSERT INTO blood_request (hospital_id, patient_id, patient_name, patient_contact, patient_email, patient_address, blood_group, units_required, is_donor, donor_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [hospitalId, patientId || null, patientName, patientContact, patientEmail, patientAddress, bloodGroup, unitsRequired, isDonor ? 1 : 0, donorEmail || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Request submitted successfully', id: this.lastID });
        }
    );
});

// 4b. Get Requests for a hospital
app.get('/api/requests/:hospitalId', (req, res) => {
    db.all(
        "SELECT br.*, da.points as donor_points FROM blood_request br LEFT JOIN donor_account da ON br.donor_email = da.email WHERE br.hospital_id = ? ORDER BY br.timestamp DESC",
        [req.params.hospitalId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ requests: rows });
        }
    );
});

// 6. Approve Request & Deduct Stock
app.post('/api/requests/:requestId/approve', (req, res) => {
    const { requestId } = req.params;
    const { hospitalId, bloodGroup } = req.body;

    // Join with hospital table to get the REAL name for the SMS
    const query = `
        SELECT br.*, h.name as hospital_name 
        FROM blood_request br 
        JOIN hospital h ON br.hospital_id = h.id 
        WHERE br.id = ?`;

    db.get(query, [requestId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Request not found' });

        const unitsToDeduct = row.units_required;
        const patientName = row.patient_name;
        const patientContact = row.patient_contact;
        const hospitalName = row.hospital_name;
        const isDonor = row.is_donor;
        const donorEmail = row.donor_email;

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.run('UPDATE blood_request SET status = ? WHERE id = ?', ['approved', requestId]);

            db.run(
                'UPDATE blood_stock SET quantity = quantity - ? WHERE hospital_id = ? AND blood_group = ? AND quantity >= ?',
                [unitsToDeduct, hospitalId, bloodGroup, unitsToDeduct],
                function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }
                    if (this.changes === 0) {
                        db.run('ROLLBACK');
                        return res.status(400).json({ error: 'Insufficient stock or invalid request' });
                    }

                    if (isDonor && donorEmail) {
                        db.run('UPDATE donor_account SET points = MAX(0, points - ?) WHERE email = ?', [unitsToDeduct * 40, donorEmail]);
                    }

                    db.run('COMMIT', async () => {
                        const msg = `LifeDrop Alert: Your request for ${bloodGroup} at ${hospitalName} has been APPROVED. Please visit the hospital immediately.`;
                        const patientEmail = row.patient_email;
                        
                        console.log(`\x1b[36m[PRECISION TRIGGER] Successfully retrieved patient contact [${patientContact}] for Request #${requestId}\x1b[0m`);
                        
                        // Send SMS with Email Info for History Tracking
                        await sendSMS(patientContact, msg, patientEmail, patientEmail ? 'Backup Alert Queued' : 'No Email Provided');

                        // Fallback: Send Email if patientEmail exists
                        if (patientEmail && transporter) {
                            const mailOptions = {
                                from: `"LifeDrop Clinical Alerts" <${process.env.EMAIL_USER}>`,
                                to: patientEmail,
                                subject: `LifeDrop: Blood Request APPROVED for ${bloodGroup}`,
                                html: `
                                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f9f9f9; padding: 20px;">
                                        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #eee;">
                                            <div style="background: #ff2a4b; color: white; padding: 30px; text-align: center;">
                                                <h1 style="margin: 0; font-size: 24px;">Blood Request Approved</h1>
                                            </div>
                                            <div style="padding: 30px; color: #333;">
                                                <p>Dear <strong>${patientName}</strong>,</p>
                                                <p>We are pleased to inform you that your emergency request for <strong>${bloodGroup}</strong> blood has been <strong>APPROVED</strong> by <strong>${hospitalName}</strong>.</p>
                                                <div style="background: #fff5f6; border-left: 4px solid #ff2a4b; padding: 15px; margin: 20px 0;">
                                                    <p style="margin: 0;"><strong>Action Required:</strong> Please visit the hospital's blood bank department immediately with your identification documents.</p>
                                                </div>
                                                <p style="font-size: 0.9rem; color: #666;">Hospital Address: ${hospitalName}</p>
                                                <p style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; font-size: 0.8rem; color: #999;">
                                                    This is an automated clinical alert from the LifeDrop Emergency Network.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                `
                            };
                            transporter.sendMail(mailOptions, (error, info) => {
                                if (error) {
                                    console.error("Email Fallback Error:", error);
                                } else {
                                    console.log(`\x1b[32m[EMAIL SUCCESS] Backup alert sent to ${patientEmail}\x1b[0m`);
                                    if (smsHistory.length > 0 && smsHistory[0].to.includes(patientContact)) {
                                        smsHistory[0].emailStatus = 'Backup Alert Delivered';
                                    }
                                }
                            });
                        }

                        res.json({ message: 'Request allowed', patientName, patientContact });
                    });
                }
            );
        });
    });
});

// 7. Delete/Dismiss Request
app.delete('/api/requests/:requestId', (req, res) => {
    const { requestId } = req.params;

    db.run('DELETE FROM blood_request WHERE id = ?', [requestId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Request not found' });
        res.json({ message: 'Request deleted successfully' });
    });
});

// 8. Deny Request
app.post('/api/requests/:requestId/deny', (req, res) => {
    const { requestId } = req.params;

    // Join with hospital table for REAL name
    const query = `
        SELECT br.*, h.name as hospital_name 
        FROM blood_request br 
        JOIN hospital h ON br.hospital_id = h.id 
        WHERE br.id = ?`;

    db.get(query, [requestId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Request not found' });

        const patientName = row.patient_name;
        const patientContact = row.patient_contact;
        const hospitalName = row.hospital_name;

        db.run(
            'UPDATE blood_request SET status = ? WHERE id = ?',
            ['denied', requestId],
            async function (err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Request not found' });
                
                // Notify via SMS
                const msg = `LifeDrop Alert: Your blood request for the required group has been DENIED by ${hospitalName}. Please check nearby facilities.`;
                const patientEmail = row.patient_email;
                
                console.log(`\x1b[36m[PRECISION TRIGGER] Successfully retrieved patient contact [${patientContact}] for Request #${requestId}\x1b[0m`);
                
                // Send SMS with Email Info for History Tracking
                await sendSMS(patientContact, msg, patientEmail, patientEmail ? 'Backup Denial Queued' : 'No Email Provided');

                // Fallback: Send Email if patientEmail exists
                if (patientEmail && transporter) {
                    const mailOptions = {
                        from: `"LifeDrop Clinical Alerts" <${process.env.EMAIL_USER}>`,
                        to: patientEmail,
                        subject: `LifeDrop Update: Blood Request Denied`,
                        html: `
                            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f9f9f9; padding: 20px;">
                                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #eee;">
                                    <div style="background: #333; color: white; padding: 30px; text-align: center;">
                                        <h1 style="margin: 0; font-size: 24px;">Blood Request Update</h1>
                                    </div>
                                    <div style="padding: 30px; color: #333;">
                                        <p>Dear <strong>${patientName}</strong>,</p>
                                        <p>This is to inform you that your blood request at <strong>${hospitalName}</strong> could not be fulfilled at this time.</p>
                                        <div style="background: #fff8f8; border-left: 4px solid #666; padding: 15px; margin: 20px 0;">
                                            <p style="margin: 0;"><strong>Next Steps:</strong> We recommend checking other nearby hospitals in the LifeDrop network or contacting central diagnostics.</p>
                                        </div>
                                        <p style="font-size: 0.9rem; color: #666;">Hospital: ${hospitalName}</p>
                                        <p style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; font-size: 0.8rem; color: #999;">
                                            This is an automated clinical alert from the LifeDrop Emergency Network.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        `
                    };
                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error("Email Fallback Error:", error);
                        } else {
                            console.log(`\x1b[32m[EMAIL SUCCESS] Backup denial alert sent to ${patientEmail}\x1b[0m`);
                            if (smsHistory.length > 0 && smsHistory[0].to.includes(patientContact)) {
                                smsHistory[0].emailStatus = 'Backup Alert Delivered';
                            }
                        }
                    });
                }

                res.json({ message: 'Request denied', patientName, patientContact });
            }
        );
    });
});

// 5. Find nearest blood stock (matching algorithm using SQLite)
app.get('/api/search', (req, res) => {
    const { bloodGroup, location } = req.query;

    const query = `
        SELECT h.id as hospitalId, h.name as hospitalName, h.area, h.address, bs.quantity
        FROM hospital h
        JOIN blood_stock bs ON h.id = bs.hospital_id
        WHERE bs.blood_group = ? AND h.area = ? AND bs.quantity > 0
    `;

    db.all(query, [bloodGroup, location], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Approximate Travel times 
        const distances = {
            "South Mumbai": { "South Mumbai": 15, "Western Suburbs": 45, "Eastern Suburbs": 55, "Navi Mumbai": 75, "Thane": 65, "Pune": 160 },
            "Western Suburbs": { "South Mumbai": 45, "Western Suburbs": 20, "Eastern Suburbs": 40, "Navi Mumbai": 60, "Thane": 50, "Pune": 150 },
            "Eastern Suburbs": { "South Mumbai": 55, "Western Suburbs": 40, "Eastern Suburbs": 20, "Navi Mumbai": 35, "Thane": 30, "Pune": 140 },
            "Navi Mumbai": { "South Mumbai": 75, "Western Suburbs": 60, "Eastern Suburbs": 35, "Navi Mumbai": 25, "Thane": 40, "Pune": 120 },
            "Thane": { "South Mumbai": 65, "Western Suburbs": 50, "Eastern Suburbs": 30, "Navi Mumbai": 40, "Thane": 20, "Pune": 145 },
            "Pune": { "Pune": 15, "South Mumbai": 160, "Navi Mumbai": 120, "Chhatrapati Sambhajinagar": 230, "Nashik": 200, "Nagpur": 700 },
            "Nagpur": { "Nagpur": 15, "Pune": 700, "Nashik": 600, "Chhatrapati Sambhajinagar": 380 },
            "Nashik": { "Nashik": 15, "Pune": 200, "Nagpur": 600, "Chhatrapati Sambhajinagar": 180 },
            "Chhatrapati Sambhajinagar": { "Chhatrapati Sambhajinagar": 15, "Pune": 230, "Nagpur": 380, "Nashik": 180 }
        };

        const matches = rows.map(r => ({
            hospital: { id: r.hospitalId, name: r.hospitalName, area: r.area, address: r.address },
            qty: r.quantity,
            // Fallback to heavy cross-state transit if missing
            time: distances[location]?.[r.area] || 450
        }));

        matches.sort((a, b) => a.time - b.time);

        res.json({ matches });
    });
});

/* ==============================================================
   DONOR PORTAL & REWARDS API ROUTES
   ============================================================== */

// 9. Donor Registration (Using Email)
app.post('/api/donor/register', (req, res) => {
    const { name, email, password, bloodGroup } = req.body;
    if (!name || !email || !password || !bloodGroup) {
        return res.status(400).json({ error: 'Missing registration details' });
    }

    db.run(
        'INSERT INTO donor_account (name, email, password, blood_group) VALUES (?, ?, ?, ?)',
        [name, email, password, bloodGroup],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Email already registered' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Donor registered successfully!', id: this.lastID });
        }
    );
});

// 10. Donor Login (Using Email)
app.post('/api/donor/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM donor_account WHERE email = ? AND password = ?', [email, password], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(401).json({ error: 'Invalid email or password' });
        
        // Exclude password from response
        const { password, ...safeUser } = row;
        res.json({ message: 'Login successful', donor: safeUser });
    });
});

// Donor Dashboard (Get History & Points)
app.get('/api/donor/:id/dashboard', (req, res) => {
    const donorId = req.params.id;
    
    db.get('SELECT id, name, email, blood_group, points FROM donor_account WHERE id = ?', [donorId], (err, donor) => {
        if (err || !donor) return res.status(404).json({ error: 'Donor not found' });
        
        const query = `
            SELECT dh.id, dh.units, dh.timestamp, h.name as hospitalName, h.area 
            FROM donation_history dh
            JOIN hospital h ON dh.hospital_id = h.id
            WHERE dh.donor_id = ?
            ORDER BY dh.timestamp DESC
        `;
        db.all(query, [donorId], (err, history) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch history' });
            res.json({ donor, history });
        });
    });
});

// Formal Donation Logging (By Doctor) - Using Donor Email
app.post('/api/hospital/:id/log-donation', (req, res) => {
    const hospitalId = req.params.id;
    const { donorEmail, bloodGroup, units } = req.body;
    
    if (!donorEmail || !bloodGroup || !units) {
        return res.status(400).json({ error: 'Missing required logging fields.' });
    }
    
    // 1. Find the donor by email
    db.get('SELECT id FROM donor_account WHERE email = ?', [donorEmail], (err, donor) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!donor) return res.status(404).json({ error: 'Donor email not found. They must register via the Donor Portal first.' });
        
        const pointsEarned = parseInt(units) * 50; // 50 points per unit
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // 2. Add to donation_history
            db.run('INSERT INTO donation_history (donor_id, hospital_id, units) VALUES (?, ?, ?)', [donor.id, hospitalId, units]);
            
            // 3. Increment donor points
            db.run('UPDATE donor_account SET points = points + ? WHERE id = ?', [pointsEarned, donor.id]);
            
            // 4. Update hospital blood_stock (Create it if it doesn't exist, or increment it)
            db.get('SELECT id FROM blood_stock WHERE hospital_id = ? AND blood_group = ?', [hospitalId, bloodGroup], (err, stock) => {
                if (stock) {
                    db.run('UPDATE blood_stock SET quantity = quantity + ? WHERE id = ?', [units, stock.id]);
                } else {
                    db.run('INSERT INTO blood_stock (hospital_id, blood_group, quantity) VALUES (?, ?, ?)', [hospitalId, bloodGroup, units]);
                }
                
                db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Transaction failed' });
                    }
                    res.json({ message: `Success! Donated ${units} units. Donor earned ${pointsEarned} Points!` });
                });
            });
        });
    });
});

// --- Patient Accounts Portal Routes ---

// Patient Registration
app.post('/api/patient/register', (req, res) => {
    const { name, phone, state, country, password } = req.body;
    if (!name || !phone || !state || !country || !password) {
        return res.status(400).json({ error: 'All fields (Name, Phone, State, Country, Password) are required.' });
    }

    db.run(
        'INSERT INTO patient_account (name, phone, state, country, password) VALUES (?, ?, ?, ?, ?)',
        [name, phone, state, country, password],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'This phone number is already registered.' });
                }
                return res.status(500).json({ error: err.message });
            }
            const newPatientId = this.lastID;
            
            // Retroactively link orphan requests from this phone number
            db.run(
                'UPDATE blood_request SET patient_id = ? WHERE patient_contact = ? AND patient_id IS NULL',
                [newPatientId, phone],
                (updErr) => {
                    if (updErr) {
                        console.error('Failed to link legacy requests:', updErr);
                    }
                    res.status(201).json({ 
                        message: 'Patient account created successfully! Any previous requests linked.', 
                        id: newPatientId 
                    });
                }
            );
        }
    );
});

// Patient Login
app.post('/api/patient/login', (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Phone and Password required.' });

    db.get('SELECT * FROM patient_account WHERE phone = ?', [phone], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row || row.password !== password) {
            return res.status(401).json({ error: 'Invalid phone number or password.' });
        }
        res.json({ message: 'Login successful!', patient: row });
    });
});

// Patient Dashboard: Profile + Recent Requests
app.get('/api/patient/dashboard/:patientId', (req, res) => {
    const { patientId } = req.params;

    db.get('SELECT id, name, phone, state, country, created_at FROM patient_account WHERE id = ?', [patientId], (err, profile) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch profile' });
        if (!profile) return res.status(404).json({ error: 'Patient not found' });

        const requestQuery = `
            SELECT br.*, h.name as hospital_name, h.area 
            FROM blood_request br
            JOIN hospital h ON br.hospital_id = h.id
            WHERE br.patient_id = ?
            ORDER BY br.timestamp DESC
        `;
        db.all(requestQuery, [patientId], (err, requests) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch history' });
            res.json({ profile, requests });
        });
    });
});

// Get Site-wide Macro Statistics
app.get('/api/stats', (req, res) => {
    db.all('SELECT patient_name, blood_group, units_required FROM blood_request ORDER BY timestamp DESC', (err, requests) => {
        db.all('SELECT email, blood_group, points FROM donor_account ORDER BY id DESC', (err, donors) => {
            res.json({ 
                totalRequests: requests.length, 
                totalDonors: donors.length,
                detailedRequests: requests,
                detailedDonors: donors
            });
        });
    });
});

// --- Donor Password Recovery Routes (Phone-Based) ---

// Auth Route: Donor Forgot Password (Email OTP generation)
app.post('/api/donor/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Donor Email Address is required.' });

    db.get('SELECT id FROM donor_account WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        // Return success even if not found to prevent user enumeration
        if (!user) return res.json({ message: 'If that email is registered, a recovery code has been generated.' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60000).toISOString(); // 15 mins

        // Clean old and save new
        db.run('DELETE FROM donor_password_resets WHERE email = ?', [email], () => {
            db.run(
                'INSERT INTO donor_password_resets (email, otp, expires_at) VALUES (?, ?, ?)',
                [email, otp, expiresAt],
                async function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    console.log(`\n>>> [DONOR] SIMULATED EMAIL SENT TO ${email} | CODE: ${otp}\n`);
                    
                    res.json({ 
                        message: `A recovery code has been generated for ${email}.`,
                        otp: otp 
                    });
                }
            );
        });
    });
});

// Auth Route: Donor Reset Password (Using Email)
app.post('/api/donor/reset-password', (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields required.' });

    db.get(
        'SELECT * FROM donor_password_resets WHERE email = ? AND otp = ? AND expires_at > CURRENT_TIMESTAMP',
        [email, otp],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!row) return res.status(400).json({ error: 'Invalid or expired code.' });

            db.run('UPDATE donor_account SET password = ? WHERE email = ?', [newPassword, email], (err) => {
                if (err) return res.status(500).json({ error: 'Update failed' });
                db.run('DELETE FROM donor_password_resets WHERE email = ?', [email]);
                res.json({ message: 'Password reset successfully!' });
            });
        }
    );
});

// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
