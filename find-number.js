const twilio = require('twilio');
require('dotenv').config({ path: 'c:/Users/FAREA/Downloads/Website/.env' });

const sid = process.env.TWILIO_SID;
const auth = process.env.TWILIO_AUTH;

if (!sid || !auth || sid.includes('ACXXXXXXXXXXX')) {
    console.log("ERROR: Invalid Twilio credentials in .env");
    process.exit(1);
}

const client = twilio(sid, auth);

async function findNumbers() {
    try {
        console.log("--- SCANNING FOR TWILIO VIRTUAL NUMBERS ---");
        const numbers = await client.incomingPhoneNumbers.list({ limit: 5 });
        
        if (numbers.length > 0) {
            console.log(`✅ FOUND_ACTIVE_NUMBER: ${numbers[0].phoneNumber}`);
            console.log(`Friendly Name: ${numbers[0].friendlyName}`);
            console.log(`SID: ${numbers[0].sid}`);
        } else {
            console.log("❌ NO ACTIVE VIRTUAL NUMBER FOUND.");
            console.log("Checking for available numbers to claim...");
            
            const available = await client.availablePhoneNumbers('US').local.list({ limit: 1 });
            if (available.length > 0) {
                console.log(`AVAILABLE_FOR_CLAIM: ${available[0].phoneNumber}`);
            }
        }
    } catch (err) {
        console.error("TWILIO_API_ERROR:", err.message);
    }
}

findNumbers();
