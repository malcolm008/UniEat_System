const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendEmail = async (to, subject, html, text = null) => {
    try {
        const mailOptions = {
            from: `"UniEat System" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '')
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { sucess: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
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
        `SELECT sa.email, sa.name FROM super_admins sa JOIN universities u ON u.super_admin_id = sa.id WHERE u.id = $1 AND sa.is_active = true`,
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
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #C4522A;">Welcome to UniEat!</h1>
                </div>
                <p>Dear ${userDetails.name},</p>
                <p>Your account has been successfully created in the UniEat system. Below are your login credentials:</p>

                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Registration Number:</strong> ${userDetails.reg_number}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${userDetails.email}</p>
                    <p style="margin: 5px 0;"><strong>Role:</strong> ${userDetails.role}</p>
                    <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <span style="background: #fff; padding: 3px 8px; border-radius: 4px; font-family: monospace;">${password}</span></p>
                </div>

                <p><strong>Important:</strong> Please change your password after your first login for security reasons.</p>

                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">
                    <p>If you have any questions, please contact your system administrator.</p>
                    <p>© ${new Date().getFullYear()} UniEat. All rights reserved.</p>
                </div>
            </div>
        `
    };
};

const getAdminNotificationEmail = (userDetails, password, action, adminName) => {
    let actionText = '';
    let color = '';

    switch(action) {
        case 'created':
            actionText = 'Created';
            color = '#4A5741';
            break;
        case 'password_reset':
            actionText = 'Password Reset';
            color = '#C4522A';
            break;
        case 'deleted':
            actionText = 'Deleted';
            color = '#dc2626';
            break;
        default:
            actionText = 'Updated';
            color = '#2563eb';
    }

    return {
        subject: `[Admin Notification] User ${actionText} - ${userDetails.name}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: ${color};">User ${actionText}</h1>
                </div>
                <p>Dear ${adminName},</p>
                <p>A user account has been <strong>${actionText.toLowerCase()}</strong> in your university system.</p>

                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${userDetails.name}</p>
                    <p style="margin: 5px 0;"><strong>Registration Number:</strong> ${userDetails.reg_number}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${userDetails.email}</p>
                    <p style="margin: 5px 0;"><strong>Role:</strong> ${userDetails.role}</p>
                    ${password ? `<p style="margin: 5px 0;"><strong>Temporary Password:</strong> <span style="background: #fff; padding: 3px 8px; border-radius: 4px; font-family: monospace;">${password}</span></p>` : ''}
                    <p style="margin: 5px 0;"><strong>Created At:</strong> ${new Date(userDetails.created_at).toLocaleString()}</p>
                </div>

                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">
                    <p>This is an automated notification from the UniEat System.</p>
                </div>
            </div>
        `
    };
};

const getPasswordResetEmail = (userDetails, newPassword) => {
    return {
        subject: 'UniEat - Your Password Has Been Reset',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #C4522A;">Password Reset</h1>
                </div>
                <p>Dear ${userDetails.name},</p>
                <p>Your password has been reset by an administrator. Here are your new login credentials:</p>

                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Registration Number:</strong> ${userDetails.reg_number}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${userDetails.email}</p>
                    <p style="margin: 5px 0;"><strong>New Password:</strong> <span style="background: #fff; padding: 3px 8px; border-radius: 4px; font-family: monospace;">${newPassword}</span></p>
                </div>

                <p><strong>Important:</strong> Please change your password immediately after logging in.</p>

                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">
                    <p>If you didn't request this change, please contact your system administrator immediately.</p>
                </div>
            </div>
        `
    };
};

const getUserDeletionEmail = (userDetails) => {
    return {
        subject: 'UniEat - Your Account Has Been Deleted',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #dc2626;">Account Deleted</h1>
                </div>
                <p>Dear ${userDetails.name},</p>
                <p>Your account has been permanently deleted from the UniEat system.</p>

                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Registration Number:</strong> ${userDetails.reg_number}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${userDetails.email}</p>
                    <p style="margin: 5px 0;"><strong>Role:</strong> ${userDetails.role}</p>
                    <p style="margin: 5px 0;"><strong>Deleted At:</strong> ${new Date().toLocaleString()}</p>
                </div>

                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">
                    <p>If you believe this was a mistake, please contact your system administrator.</p>
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
    getUserDeletionEmail
};
