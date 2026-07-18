require('dotenv').config();
const twilio = require('twilio');

const sid = process.env.TWILIO_SID;
const auth = process.env.TWILIO_AUTH;
const from = process.env.TWILIO_FROM;
const to = '+919321832665'; // User's number from request

console.log(`Attempting to send SMS from ${from} to ${to}...`);

const client = twilio(sid, auth);

client.messages.create({
    body: 'Test Message from LifeDrop',
    from: from,
    to: to
})
.then(message => console.log('SUCCESS! SID:', message.sid))
.catch(error => {
    console.error('FAILED!');
    console.error('Error Code:', error.code);
    console.error('Error Msg:', error.message);
});
