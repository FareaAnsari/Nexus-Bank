const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.all("SELECT * FROM patient_account", (err, patients) => {
    console.log("Patients:", patients);
    db.all("SELECT * FROM blood_request", (err, requests) => {
        console.log("Requests:", requests);
        db.close();
    });
});
