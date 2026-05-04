require('dotenv').config();
const { sendEmail, verifyTransporter } = require('./emailService');

async function testEmail() {
    console.log('Testing email configuration...');

    await verifyTransporter();

    const result = await sendEmail(
        'mackymusa1000@gmail.com',
        'UniEat Test Email',
        '<h1>Test Successful!</h1><p>Your email configuration is working correctly.</p>'
    );

    if (result.success) {
        console.log('Test email sent successfully');
    } else {
        console.error('Test email failed:', result.error);
    }
}

testEmail();