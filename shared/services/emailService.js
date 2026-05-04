const nodemailer = require('nodemailer');

const createTransporter = () => {
    const config = {
        host: 'mail.mecs.co.tz',
        port: 465,
        secure: true,
        auth: {
            user: 'uni-eat@mecs.co.tz',
            pass: process.env.SMTP_PASS || 'your-actual-password-here'
        },
        tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        debug: true
    };

    return nodemailer.createTransport(config);
};

let transporter = null;

const getTransporter = () => {
    if (!transporter) {
        transporter = createTransporter();
    }

    return transporter;
};

const verifyTransporter = async () => {
    try {
        const transport = getTransporter();
        await transport.verify();
        console.log('Email service configured successfully');
        console.log(`   SMTP Host: mail.mecs.co.tz`);
        console.log(`   SMTP User: uni-eat@mecs.co.tz`);
        return true;
    } catch (error) {
        console.error('Email service configuration error:', error.message);
        return false;
    }
};

verifyTransporter();

const sendEmail = async (to, subject, html, text = null) => {
    try {
        const transport = getTransporter();

        const mailOptions = {
            from: '"UniEat System" <uni-eat@mecs.co.tz>',
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '')
        };

        const info = await transport.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${to}`);
        console.log(`   Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`❌ Email sending error to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
};

const testConnection = async () => {
    console.log('Testing SMTP connection...');
    const transport = getTransporter();

    try {
        await transport.verify();
        console.log('✅ SMTP connection verified!');

        const result = await sendEmail(
            'mackymusa1000@gmail.com',
            'UniEat SMTP Test',
            '<h1>Connection Successful!</h1><p>Your SMTP is working correctly.</p><p>Time: ' + new Date().toLocaleString() + '</p>'
        );

        if (result.success) {
            console.log('✅ Test email sent! Check your inbox.');
        } else {
            console.log('❌ Test email failed:', result.error);
        }
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
};

const getAdminEmails = async (universityId, pool) => {
    const adminEmails = [];

    const systemOwners = await pool.query(
        `SELECT email, name FROM super_admins WHERE role = 'system_owner' AND is_active = true`
    );
    systemOwners.rows.forEach(admin => {
        adminEmails.push({ email: admin.email, name: admin.name, type: 'system_owner' });
    });

    const superAdmins = await pool.query(
        `SELECT sa.email, sa.name
         FROM super_admins sa
         JOIN universities u ON u.super_admin_id = sa.id
         WHERE u.id = $1 AND sa.is_active = true`,
        [universityId]
    );
    superAdmins.rows.forEach(admin => {
        adminEmails.push({ email: admin.email, name: admin.name, type: 'super_admin' });
    });

    return adminEmails;
};

const getUserCreationEmail = (userDetails, password) => {
    return {
        subject: 'Welcome to UniEat - Your Account Has Been Created',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #C4522A;">
                    <h1 style="color: #C4522A; margin: 0;">🍽️ UniEat</h1>
                    <p style="color: #666; margin: 5px 0 0;">University Meal System</p>
                </div>

                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
                    <h2 style="color: #333; margin: 0;">Welcome to UniEat!</h2>
                </div>

                <p style="color: #333; font-size: 14px; line-height: 1.5;">Dear <strong>${userDetails.name}</strong>,</p>
                <p style="color: #333; font-size: 14px; line-height: 1.5;">Your account has been successfully created in the UniEat system. Below are your login credentials:</p>

                <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C4522A;">
                    <p style="margin: 8px 0; font-size: 14px;"><strong>📋 Registration Number:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px;">${userDetails.reg_number}</code></p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>📧 Email:</strong> ${userDetails.email}</p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>👤 Role:</strong> ${userDetails.role.charAt(0).toUpperCase() + userDetails.role.slice(1)}</p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>🔐 Temporary Password:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px; font-size: 16px; font-weight: bold;">${password}</code></p>
                </div>

                <div style="background: #FFF3E0; padding: 12px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #E65100; font-size: 13px; margin: 0;"><strong>⚠️ Important Security Notice:</strong></p>
                    <p style="color: #E65100; font-size: 13px; margin: 5px 0 0;">Please change your password immediately after your first login to secure your account.</p>
                </div>

                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
                    <p>Need help? Contact your system administrator.</p>
                    <p>© ${new Date().getFullYear()} UniEat. All rights reserved.</p>
                </div>
            </div>
        `
    };
};

const getAdminNotificationEmail = (userDetails, password, action, adminName) => {
    let actionText = '';
    let color = '';
    let icon = '';

    switch(action) {
        case 'created':
            actionText = 'Created';
            color = '#4A6741';
            icon = '✅';
            break;
        case 'password_reset':
            actionText = 'Password Reset';
            color = '#C4522A';
            icon = '🔄';
            break;
        case 'deleted':
            actionText = 'Deleted';
            color = '#dc2626';
            icon = '🗑️';
            break;
        default:
            actionText = 'Updated';
            color = '#2563eb';
            icon = '📝';
    }

    return {
        subject: `[Admin Notification] User ${actionText} - ${userDetails.name}`,
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid ${color};">
                    <h1 style="color: ${color}; margin: 0;">${icon} User ${actionText}</h1>
                </div>

                <p style="color: #333; font-size: 14px; line-height: 1.5;">Dear <strong>${adminName}</strong>,</p>
                <p style="color: #333; font-size: 14px; line-height: 1.5;">A user account has been <strong style="color: ${color};">${actionText.toLowerCase()}</strong> in your university system.</p>

                <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
                    <p style="margin: 8px 0; font-size: 14px;"><strong>👤 Name:</strong> ${userDetails.name}</p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>📋 Registration Number:</strong> ${userDetails.reg_number}</p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>📧 Email:</strong> ${userDetails.email}</p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>👤 Role:</strong> ${userDetails.role.charAt(0).toUpperCase() + userDetails.role.slice(1)}</p>
                    ${password ? `<p style="margin: 8px 0; font-size: 14px;"><strong>🔐 Temporary Password:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px;">${password}</code></p>` : ''}
                    <p style="margin: 8px 0; font-size: 14px;"><strong>📅 Created At:</strong> ${new Date(userDetails.created_at).toLocaleString()}</p>
                </div>

                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
                    <p>This is an automated notification from the UniEat System.</p>
                    <p>© ${new Date().getFullYear()} UniEat. All rights reserved.</p>
                </div>
            </div>
        `
    };
};

const getPasswordResetEmail = (userDetails, newPassword) => {
    return {
        subject: 'UniEat - Your Password Has Been Reset',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #C4522A;">
                    <h1 style="color: #C4522A; margin: 0;">🔄 Password Reset</h1>
                </div>

                <p style="color: #333; font-size: 14px; line-height: 1.5;">Dear <strong>${userDetails.name}</strong>,</p>
                <p style="color: #333; font-size: 14px; line-height: 1.5;">Your password has been reset by an administrator. Here are your new login credentials:</p>

                <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C4522A;">
                    <p style="margin: 8px 0; font-size: 14px;"><strong>📋 Registration Number:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px;">${userDetails.reg_number}</code></p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>📧 Email:</strong> ${userDetails.email}</p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>🔐 New Password:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px; font-size: 16px; font-weight: bold;">${newPassword}</code></p>
                </div>

                <div style="background: #FFF3E0; padding: 12px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #E65100; font-size: 13px; margin: 0;"><strong>⚠️ Security Notice:</strong> Please change your password immediately after logging in.</p>
                </div>

                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
                    <p>If you didn't request this change, please contact your system administrator immediately.</p>
                    <p>© ${new Date().getFullYear()} UniEat. All rights reserved.</p>
                </div>
            </div>
        `
    };
};

const getUserDeletionEmail = (userDetails) => {
    return {
        subject: 'UniEat - Your Account Has Been Deleted',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #dc2626;">
                    <h1 style="color: #dc2626; margin: 0;">🗑️ Account Deleted</h1>
                </div>

                <p style="color: #333; font-size: 14px; line-height: 1.5;">Dear <strong>${userDetails.name}</strong>,</p>
                <p style="color: #333; font-size: 14px; line-height: 1.5;">Your account has been permanently deleted from the UniEat system.</p>

                <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                    <p style="margin: 8px 0; font-size: 14px;"><strong>📋 Registration Number:</strong> ${userDetails.reg_number}</p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>📧 Email:</strong> ${userDetails.email}</p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>👤 Role:</strong> ${userDetails.role.charAt(0).toUpperCase() + userDetails.role.slice(1)}</p>
                    <p style="margin: 8px 0; font-size: 14px;"><strong>⏰ Deleted At:</strong> ${new Date().toLocaleString()}</p>
                </div>

                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
                    <p>If you believe this was a mistake, please contact your system administrator.</p>
                    <p>© ${new Date().getFullYear()} UniEat. All rights reserved.</p>
                </div>
            </div>
        `
    };
};

module.exports = {
    sendEmail,
    getAdminEmails,
    getUserCreationEmail,
    getAdminNotificationEmail,
    getPasswordResetEmail,
    getUserDeletionEmail,
    verifyTransporter
};
