const twilio = require('twilio');
require('dotenv').config({ path: 'c:/Users/FAREA/Downloads/Website/.env' });

const sid = process.env.TWILIO_SID;
const auth = process.env.TWILIO_AUTH;
const userPhone = '+919321832665';

const client = twilio(sid, auth);

async function checkAndVerify() {
    try {
        console.log("--- CHECKING TWILIO VERIFIED CALLER IDs ---");
        const callerIds = await client.outgoingPhoneNumbers.list();
        
        const isVerified = callerIds.some(c => c.phoneNumber.includes(userPhone.replace('+', '')));
        
        if (isVerified) {
            console.log(`STATUS: Your number ${userPhone} is ALREADY VERIFIED!`);
        } else {
            console.log(`STATUS: Your number ${userPhone} is NOT verified.`);
            console.log(`ACTION: Triggering verification for ${userPhone}...`);
            
            // This will trigger a call or SMS to the user
            const verification = await client.validationRequests.create({
                friendlyName: 'User Personal Number',
                phoneNumber: userPhone
            });
            
            console.log(`SUCCESS: Verification triggered!`);
            console.log(`CODE_REQUIRED: You will receive a call/SMS from Twilio. Please listen/look for a 6-digit validation code.`);
            console.log(`CALL_SID: ${verification.callSid || 'N/A'}`);
            console.log(`VALIDATION_CODE: ${verification.validationCode}`);
        }
    } catch (err) {
        console.error("TWILIO_VERIFY_ERROR:", err.message);
    }
}

checkAndVerify();
