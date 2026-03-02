const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from current directory
app.use(express.static(__dirname));

// --- Authentication Endpoints ---

// Register Doctor
app.post('/api/auth/register', (req, res) => {
    const { hospitalId, doctorName, doctorId, password } = req.body;

    if (!hospitalId || !doctorName || !doctorId || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    db.run(
        "INSERT INTO doctor_account (hospital_id, doctor_name, doctor_id, password) VALUES (?, ?, ?, ?)",
        [hospitalId, doctorName, doctorId, password], // In a real app, hash this password
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Doctor ID already exists.' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'Doctor registered successfully' });
        }
    );
});

// Login Doctor
app.post('/api/auth/login', (req, res) => {
    const { hospitalId, doctorId, password } = req.body;

    db.get(
        "SELECT * FROM doctor_account WHERE hospital_id = ? AND doctor_id = ? AND password = ?",
        [hospitalId, doctorId, password], // In a real app, compare hashed passwords
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            if (row) {
                // Success
                res.json({ message: 'Login successful', doctorId: row.doctor_id, doctorName: row.doctor_name, hospitalId: row.hospital_id });
            } else {
                // Fail
                res.status(401).json({ error: 'Invalid credentials or wrong hospital selected.' });
            }
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

    db.run(
        'UPDATE blood_stock SET quantity = ? WHERE hospital_id = ? AND blood_group = ?',
        [quantity, hospitalId, bloodGroup],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Stock updated successfully', changes: this.changes });
        }
    );
});

// 4. Create Emergency Blood Request
app.post('/api/requests', (req, res) => {
    const { hospitalId, patientName, patientAddress, bloodGroup } = req.body;
    db.run(
        "INSERT INTO blood_request (hospital_id, patient_name, patient_address, blood_group) VALUES (?, ?, ?, ?)",
        [hospitalId, patientName, patientAddress, bloodGroup],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ requestId: this.lastID, message: 'Request recorded' });
        }
    );
});

// 4b. Get Requests for a hospital
app.get('/api/requests/:hospitalId', (req, res) => {
    db.all(
        "SELECT * FROM blood_request WHERE hospital_id = ? ORDER BY timestamp DESC",
        [req.params.hospitalId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ requests: rows });
        }
    );
});

// 4c. Approve Request
app.post('/api/requests/:requestId/approve', (req, res) => {
    const { hospitalId, bloodGroup } = req.body;
    const reqId = req.params.requestId;

    db.serialize(() => {
        db.run("UPDATE blood_request SET status = 'approved' WHERE id = ?", [reqId]);
        db.run("UPDATE blood_stock SET quantity = quantity - 1 WHERE hospital_id = ? AND blood_group = ? AND quantity > 0", [hospitalId, bloodGroup]);
        res.json({ message: 'Request approved and stock updated' });
    });
});

// 5. Find nearest blood stock (matching algorithm using SQLite)
app.get('/api/search', (req, res) => {
    const { bloodGroup, location } = req.query;

    const query = `
        SELECT h.id as hospitalId, h.name as hospitalName, h.area, h.address, bs.quantity
        FROM hospital h
        JOIN blood_stock bs ON h.id = bs.hospital_id
        WHERE bs.blood_group = ? AND bs.quantity > 0
    `;

    db.all(query, [bloodGroup], (err, rows) => {
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

// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
