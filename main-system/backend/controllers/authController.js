const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../../shared/db/db');
const { success, error, unauthorized, created } = require('../../../shared/utils/response');
const { logger } = require('../../../shared/utils/logger');
const crypto = require('crypto');
const otpStore = new Map();
const { sendEmailAsync } = require('../../../shared/services/emailService')

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of otpStore.entries()) {
        if (value.expiresAt < now) {
            otpStore.delete(key);
        }
    }
}, 60000);

const forgotPassword = async (req, res, next) => {
    try {
        const { reg_number } = req.body;

        const userResult = await query(
            `SELECT id, reg_number, name, email, role, university_id
             FROM users
             WHERE reg_number = $1 AND is_active = true`,
            [reg_number]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this registration number'
            });
        }

        const user = userResult.rows[0];

        if (!user.email) {
            return res.status(400).json({
                success: false,
                message: 'No email address associated with this account. Please contact your administrator.'
            });
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;

        otpStore.set(reg_number, {
            otp,
            expiresAt,
            email: user.email,
            userId: user.id,
            name: user.name
        });

        const maskedEmail = user.email.replace(/(.{2})(.*)(?=@)/, (match, p1, p2) => {
            return p1 + '*'.repeat(Math.min(p2.length, 4));
        });

        const emailTemplate = {
            subject: 'UniEat - Password Reset OTP',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background: #ffffff;">
                    <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #C4522A;">
                        <h1 style="color: #C4522A; margin: 0;">🔐 Password Reset</h1>
                    </div>

                    <p style="color: #333; font-size: 14px; line-height: 1.5;">Dear <strong>${user.name}</strong>,</p>
                    <p style="color: #333; font-size: 14px; line-height: 1.5;">You requested to reset your password. Use the following One-Time Password (OTP) to verify your identity:</p>

                    <div style="background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border-left: 4px solid #C4522A;">
                        <div style="font-size: 11px; color: #666; letter-spacing: 2px; margin-bottom: 8px;">YOUR OTP CODE</div>
                        <div style="font-size: 36px; font-weight: 800; color: #C4522A; letter-spacing: 8px; font-family: monospace;">${otp}</div>
                        <div style="font-size: 11px; color: #666; margin-top: 8px;">Valid for 10 minutes</div>
                    </div>

                    <p style="color: #333; font-size: 14px; line-height: 1.5;">If you didn't request this password reset, please ignore this email or contact support.</p>

                    <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
                        <p>Need help? Contact support at support@unieat.com</p>
                        <p>© ${new Date().getFullYear()} UniEat. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        sendEmailAsync(user.email, emailTemplate.subject, emailTemplate.html);

        res.json({
            success: true,
            message: 'OTP sent to your registered email address',
            data: {
                masked_email: maskedEmail,
                reg_number: reg_number
            }
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        next(error);
    }
};

const verifyOTP = async (req, res, next) => {
    try {
        const { reg_number, otp } = req.body;
        const storedData = otpStore.get(reg_number);

        if (!storedData) {
            return res.status(400).json({
                success: false,
                message: 'No OTP request found. Please request a new OTP.'
            });
        }

        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(reg_number);
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        if (storedData.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please try again.'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');

        otpStore.set(`reset_${resetToken}`, {
            userId: storedData.userId,
            reg_number: reg_number,
            expiresAt: Date.now() + 15 * 60 * 1000
        });

        res.json({
            success: true,
            message: 'OTP verified successfully',
            data: {
                reset_token: resetToken
            }
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        next(error);
    }
};

const resendOTP = async (req, res, next) => {
    try {
        const { reg_number } = await req.body;

        const userResult = await query(
            `SELECT id, reg_number, name, email FROM users WHERE reg_number = $1 AND is_active = true`,
            [reg_number]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this registration number'
            });
        }

        const user = userResult.rows[0];

        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;

        otpStore.set(reg_number, {
            otp,
            expiresAt,
            email: user.email,
            userId: user.id,
            name: user.name
        });

        const maskedEmail = user.email.replace(/(.{2})(.*)(?=@)/, (match, p1, p2) => {
            return p1 + '*'.repeat(Math.min(p2.length, 4));
        });

        const emailTemplate = {
            subject: 'UniEat - New Password Reset OTP',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background: #ffffff;">
                    <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #C4522A;">
                        <h1 style="color: #C4522A; margin: 0;">🔄 New OTP Request</h1>
                    </div>

                    <p style="color: #333; font-size: 14px; line-height: 1.5;">Dear <strong>${user.name}</strong>,</p>
                    <p style="color: #333; font-size: 14px; line-height: 1.5;">You requested a new OTP. Here is your new One-Time Password:</p>

                    <div style="background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border-left: 4px solid #C4522A;">
                        <div style="font-size: 36px; font-weight: 800; color: #C4522A; letter-spacing: 8px; font-family: monospace;">${otp}</div>
                        <div style="font-size: 11px; color: #666; margin-top: 8px;">Valid for 10 minutes</div>
                    </div>

                    <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
                        <p>© ${new Date().getFullYear()} UniEat. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        sendEmailAsync(user.email, emailTemplate.subject, emailTemplate.html);

        res.json({
            success: true,
            message: 'New OTP sent to your email',
            data: {
                masked_email: maskedEmail
            }
        });
    } catch (error) {
        console.error('Resend OTP error:', error);
        next(error);
    }
};

const resetForgotPassword = async (req, res, next) => {
    try {
        const { token, new_password } = req.body;

        const resetData = otpStore.get(`reset_${token}`);

        if (!resetData) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token. Please request a new OTP.'
            });
        }

        if (Date.now() > resetData.expiresAt) {
            otpStore.delete(`reset_${token}`);
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired. Please request a new OTP.'
            });
        }

        const hashedPassword = await bcrypt.hash(new_password, 12);

        await query(
            `UPDATE users
             SET password = $1, updated_at = NOW()
             WHERE id = $2`,
            [hashedPassword, resetData.userId]
        );

        otpStore.delete(resetData.reg_number);
        otpStore.delete(`reset_${token}`);

        const userResult = await query(
            `SELECT name, email, reg_number FROM users WHERE id = $1`,
            [resetData.userId]
        );

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            const emailTemplate = {
                subject: 'UniEat - Password Changed Successfully',
                html: `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background: #ffffff;">
                        <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #4A6741;">
                            <h1 style="color: #4A6741; margin: 0;">✅ Password Changed</h1>
                        </div>

                        <p style="color: #333; font-size: 14px; line-height: 1.5;">Dear <strong>${user.name}</strong>,</p>
                        <p style="color: #333; font-size: 14px; line-height: 1.5;">Your password has been successfully changed.</p>

                        <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Registration Number:</strong> ${user.reg_number}</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
                        </div>

                        <p style="color: #333; font-size: 14px; line-height: 1.5;">If you did not make this change, please contact support immediately.</p>

                        <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
                            <p>© ${new Date().getFullYear()} UniEat. All rights reserved.</p>
                        </div>
                    </div>
                `
            };

            sendEmailAsync(user.email, emailTemplate.subject, emailTemplate.html);
        }

        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        console.error('Password reset error:', error);
        next(error);
    }
};

const signTokens = (userId) => {
  const access = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refresh = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { access, refresh };
};

// POST /auth/login
const login = async (req, res, next) => {
  try {
    const { reg_number, password } = req.body;

    const { rows } = await query(
      'SELECT id, name, email, reg_number, password, role, is_active, display_name, university_id FROM users WHERE reg_number = $1',
      [reg_number?.trim()]
    );

    const user = rows[0];
    if (!user) return unauthorized(res, 'Invalid credentials');
    if (!user.is_active) return unauthorized(res, 'Account has been deactivated');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return unauthorized(res, 'Invalid credentials');

    const { access, refresh } = signTokens(user.id);

    const displayName = user.display_name || user.name;

    return success(res, {
      access_token: access,
      refresh_token: refresh,
      user: {
        id: user.id,
        name: user.name,
        display_name: displayName,
        email: user.email,
        reg_number: user.reg_number,
        role: user.role,
        university_id: user.university_id  // This will now have a value
      },
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

// POST /auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return error(res, 'Refresh token required');

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const { rows } = await query(
      'SELECT id, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (!rows[0] || !rows[0].is_active) return unauthorized(res);

    const { access, refresh: newRefresh } = signTokens(rows[0].id);
    return success(res, { access_token: access, refresh_token: newRefresh }, 'Token refreshed');
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Invalid or expired refresh token');
    }
    next(err);
  }
};

const me = async (req, res) => {
  const { id, name, email, reg_number, role, display_name, university_id } = req.user;
  return success(res, {
    id,
    name,
    display_name: display_name || name,
    email,
    reg_number,
    role,
    university_id  // Add this line
  });
};

// POST /auth/register  (admin only — creates staff/student accounts)
const register = async (req, res, next) => {
  try {
    const { name, email, reg_number, password, role = 'student' } = req.body;

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO users (name, email, reg_number, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, reg_number, role, created_at`,
      [name, email || null, reg_number, hash, role]
    );

    logger.info(`New user registered: ${reg_number} (${role}) by ${req.user?.reg_number}`);
    return created(res, rows[0], 'User created');
  } catch (err) {
    next(err);
  }
};

module.exports = { login, refresh, me, register, forgotPassword, verifyOTP, resendOTP, resetForgotPassword };