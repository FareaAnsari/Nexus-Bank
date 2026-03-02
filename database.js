const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to SQLite Database.');
        initializeTables();
    }
});

function initializeTables() {
    db.serialize(() => {
        // 1. Hospital Table
        db.run(`CREATE TABLE IF NOT EXISTS hospital (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            area TEXT NOT NULL,
            address TEXT NOT NULL
        )`);

        // 2. Blood-stock Table
        db.run(`CREATE TABLE IF NOT EXISTS blood_stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hospital_id TEXT,
            blood_group TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            FOREIGN KEY(hospital_id) REFERENCES hospital(id)
        )`);

        // 3. Recipient Table
        db.run(`CREATE TABLE IF NOT EXISTS recipient (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            contact_number TEXT,
            blood_group TEXT
        )`);

        // 4. Blood Request Table (From user to a specific hospital)
        db.run(`CREATE TABLE IF NOT EXISTS blood_request (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hospital_id TEXT NOT NULL,
            patient_name TEXT NOT NULL,
            patient_address TEXT NOT NULL,
            blood_group TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(hospital_id) REFERENCES hospital(id)
        )`);

        // 5. Transaction Table
        db.run(`CREATE TABLE IF NOT EXISTS "transaction" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER,
            hospital_id TEXT, -- The hospital fulfilling it
            blood_group TEXT,
            quantity INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(request_id) REFERENCES blood_request(id),
            FOREIGN KEY(hospital_id) REFERENCES hospital(id)
        )`);

        // 6. Doctor Accounts for Authentication
        db.run(`CREATE TABLE IF NOT EXISTS doctor_account (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hospital_id TEXT NOT NULL,
            doctor_name TEXT NOT NULL,
            doctor_id TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(hospital_id) REFERENCES hospital(id)
        )`);

        // Seed Initial Data if hospital table is empty
        db.get('SELECT count(*) as count FROM hospital', (err, row) => {
            if (!err && row.count === 0) {
                seedData();
            }
        });
    });
}

function seedData() {
    console.log('Seeding initial hospital data...');

    let idCounter = 1;

    const hospitals = [
        // South Mumbai
        { id: `h${idCounter++}`, name: 'Breach Candy Hospital', area: 'South Mumbai', address: '60 A, Bhulabhai Desai Marg, Breach Candy, Mumbai, Maharashtra 400026' },
        { id: `h${idCounter++}`, name: 'Sir H. N. Reliance Foundation', area: 'South Mumbai', address: 'Prarthana Samaj, Raja Rammohan Roy Rd, Girgaon, Mumbai, Maharashtra 400004' },
        { id: `h${idCounter++}`, name: 'Bombay Hospital', area: 'South Mumbai', address: '12, New Marine Lines, Marine Lines, Mumbai, Maharashtra 400020' },
        { id: `h${idCounter++}`, name: 'Jaslok Hospital & Research Centre', area: 'South Mumbai', address: '15, Dr G.Deshmukh Marg, Pedder Road, Mumbai, Maharashtra 400026' },

        // Western Suburbs
        { id: `h${idCounter++}`, name: 'Kokilaben Dhirubhai Ambani Hosp.', area: 'Western Suburbs', address: 'Rao Saheb, Achutrao Patwardhan Marg, Four Bungalows, Andheri West, Mumbai, Maharashtra 400053' },
        { id: `h${idCounter++}`, name: 'Lilavati Hospital & Research Centre', area: 'Western Suburbs', address: 'A-791, Bandra Reclamation, Bandra West, Mumbai, Maharashtra 400050' },
        { id: `h${idCounter++}`, name: 'Nanavati Max Super Speciality', area: 'Western Suburbs', address: 'SV Rd, LIC Colony, Suresh Colony, Vile Parle West, Mumbai, Maharashtra 400056' },
        { id: `h${idCounter++}`, name: 'Holy Family Hospital', area: 'Western Suburbs', address: 'St Andrews Rd, Bandra West, Mumbai, Maharashtra 400050' },

        // Eastern Suburbs
        { id: `h${idCounter++}`, name: 'Fortis Hospital Mulund', area: 'Eastern Suburbs', address: 'Mulund Goregaon Link Rd, Industrial Area, Mulund West, Mumbai, Maharashtra 400078' },
        { id: `h${idCounter++}`, name: 'Godrej Memorial Hospital', area: 'Eastern Suburbs', address: 'Pirojshanagar, Vikhroli East, Mumbai, Maharashtra 400079' },
        { id: `h${idCounter++}`, name: 'LH Hiranandani Hospital', area: 'Eastern Suburbs', address: 'Hillside Rd, Hiranandani Gardens, Powai, Mumbai, Maharashtra 400076' },
        { id: `h${idCounter++}`, name: 'Rajawadi Hospital', area: 'Eastern Suburbs', address: 'Rajawadi Marg, Ghatkopar East, Mumbai, Maharashtra 400077' },

        // Navi Mumbai
        { id: `h${idCounter++}`, name: 'Apollo Hospitals Belapur', area: 'Navi Mumbai', address: 'Plot 13, Parsik Hill Rd, Sector 23, CBD Belapur, Navi Mumbai, Maharashtra 400614' },
        { id: `h${idCounter++}`, name: 'Fortis Hospital Vashi', area: 'Navi Mumbai', address: 'Mini Sea Shore Road, Sector 10, Vashi, Navi Mumbai, Maharashtra 400703' },
        { id: `h${idCounter++}`, name: 'MGM New Bombay Hospital', area: 'Navi Mumbai', address: 'Sector 3, Vashi, Navi Mumbai, Maharashtra 400703' },
        { id: `h${idCounter++}`, name: 'D Y Patil Hospital', area: 'Navi Mumbai', address: 'Sector 5, Nerul, Navi Mumbai, Maharashtra 400706' },

        // Thane
        { id: `h${idCounter++}`, name: 'Jupiter Hospital', area: 'Thane', address: 'Eastern Express Hwy, Service Rd, Thane West, Thane, Maharashtra 400601' },
        { id: `h${idCounter++}`, name: 'Bethany Hospital', area: 'Thane', address: 'Pokharan Rd Number 2, Vartak Nagar, Thane West, Thane, Maharashtra 400606' },
        { id: `h${idCounter++}`, name: 'Kaushalya Medical Foundation', area: 'Thane', address: 'Panch Pakhdi, Thane West, Thane, Maharashtra 400602' },
        { id: `h${idCounter++}`, name: 'Horizon Hospital', area: 'Thane', address: 'Majiwada, Thane West, Thane, Maharashtra 400608' },

        // Pune
        { id: `h${idCounter++}`, name: 'Ruby Hall Clinic', area: 'Pune', address: '40, Sassoon Rd, Sangamvadi, Pune, Maharashtra 411001' },
        { id: `h${idCounter++}`, name: 'Deenanath Mangeshkar Hospital', area: 'Pune', address: 'Erandwane, Pune, Maharashtra 411004' },
        { id: `h${idCounter++}`, name: 'Jehangir Hospital', area: 'Pune', address: '32, Sassoon Rd, Sangamvadi, Pune, Maharashtra 411001' },
        { id: `h${idCounter++}`, name: 'Sassoon General Hospital', area: 'Pune', address: 'Jai Prakash Narayan Road, Pune, Maharashtra 411001' },

        // Nagpur
        { id: `h${idCounter++}`, name: 'Wockhardt Hospital', area: 'Nagpur', address: '1643, North Ambazari Road, Nagpur, Maharashtra 440033' },
        { id: `h${idCounter++}`, name: 'Kingsway Hospitals', area: 'Nagpur', address: 'Near Kasturchand Park, Nagpur, Maharashtra 440001' },
        { id: `h${idCounter++}`, name: 'Orange City Hospital', area: 'Nagpur', address: 'Khamla Rd, Veer Sawarkar Nagar, Nagpur, Maharashtra 440015' },
        { id: `h${idCounter++}`, name: 'Alexis Multispeciality Hospital', area: 'Nagpur', address: 'By-Pass Road, Mankapur, Nagpur, Maharashtra 440030' },

        // Nashik
        { id: `h${idCounter++}`, name: 'Ashoka Medicover Hospitals', area: 'Nashik', address: 'Indira Nagar, Wadala - Pathardi Rd, Nashik, Maharashtra 422009' },
        { id: `h${idCounter++}`, name: 'Sahyadri Super Speciality Hospital', area: 'Nashik', address: 'Mumbai Naka, Shivaji Nagar, Nashik, Maharashtra 422002' },
        { id: `h${idCounter++}`, name: 'Wockhardt Hospitals', area: 'Nashik', address: 'Wani House, Mumbai Naka, Nashik, Maharashtra 422001' },
        { id: `h${idCounter++}`, name: 'Shatabdi Hospital', area: 'Nashik', address: 'Mahatma Nagar, Nashik, Maharashtra 422007' },

        // Chhatrapati Sambhajinagar (Aurangabad)
        { id: `h${idCounter++}`, name: 'Kamalnayan Bajaj Hospital', area: 'Chhatrapati Sambhajinagar', address: 'Gut No. 43, Beed Bypass Road, Aurangabad, Maharashtra 431005' },
        { id: `h${idCounter++}`, name: 'Medicover Hospitals', area: 'Chhatrapati Sambhajinagar', address: 'CIDCO, Jalgaon Road, Aurangabad, Maharashtra 431003' },
        { id: `h${idCounter++}`, name: 'Seth Nandlal Dhoot Hospital', area: 'Chhatrapati Sambhajinagar', address: 'A-1, MIDC, Chikalthana, Aurangabad, Maharashtra 431210' },
        { id: `h${idCounter++}`, name: 'MGM Medical College & Hospital', area: 'Chhatrapati Sambhajinagar', address: 'N-6 CIDCO, Aurangabad, Maharashtra 431003' }
    ];

    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

    const insertHospital = db.prepare('INSERT INTO hospital (id, name, area, address) VALUES (?, ?, ?, ?)');
    const insertStock = db.prepare('INSERT INTO blood_stock (hospital_id, blood_group, quantity) VALUES (?, ?, ?)');

    hospitals.forEach(h => {
        insertHospital.run(h.id, h.name, h.area, h.address);

        // Randomly stock blood groups
        bloodGroups.forEach(bg => {
            const qty = Math.floor(Math.random() * 6);
            insertStock.run(h.id, bg, qty);
        });
    });

    insertHospital.finalize();
    insertStock.finalize();
    console.log('Seeding completed.');
}

module.exports = db;
