// test-email.js
require('dotenv').config({ path: '../../main-system/backend/.env' });
const { testConnection, verifyTransporter } = require('./emailService');

async function runTest() {
    console.log('=== UniEat Email Service Test ===\n');
    console.log('Configuration:');
    console.log(`   SMTP Host: mail.mecs.co.tz:465`);
    console.log(`   SMTP User: uni-eat@mecs.co.tz`);
    console.log(`   SMTP Pass: ${process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : 'NOT SET'}`);
    console.log('');

    const result = await testConnection();

    if (result) {
        console.log('\n✅ Email service is working correctly!');
    } else {
        console.log('\n❌ Email service test failed.');
        console.log('\nTroubleshooting tips:');
        console.log('1. Verify the email password is correct');
        console.log('2. Check if SMTP is enabled in your hosting control panel');
        console.log('3. Try using port 587 instead of 465');
        console.log('4. Contact your hosting provider to confirm SMTP settings');
    }
}

runTest();