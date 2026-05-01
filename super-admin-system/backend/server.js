require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('../../shared/db/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:63342', 'http://127.0.0.1:63342'],
    credentials: true
}));
app.use(express.json());

// ========== HELPER: Verify JWT Token ==========
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-admin-secret-key');
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

// ========== SUBSCRIPTION STATUS CHECK MIDDLEWARE ==========
const checkSubscriptionStatus = async (req, res, next) => {
    try {
        // Only check for super_admin role (not system_owner)
        if (req.admin.role === 'super_admin') {
            // Find the university this super_admin manages
            const result = await pool.query(
                `SELECT u.* FROM universities u
                 WHERE u.super_admin_id = $1`,
                [req.admin.id]
            );

            if (result.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'No university associated with your account. Contact system owner.'
                });
            }

            const university = result.rows[0];

            // Check if subscription is active
            const isActive = university.subscription_status === 'active' &&
                            university.status === 'active' &&
                            (!university.subscription_end || new Date(university.subscription_end) > new Date());

            if (!isActive) {
                return res.status(403).json({
                    success: false,
                    message: 'Subscription has expired or is inactive. Please contact system administrator to renew.',
                    subscription_expired: true
                });
            }

            // Attach university info to request
            req.university = university;
        }
        next();
    } catch (error) {
        console.error('Subscription check error:', error);
        next(error);
    }
};

// ========== ROLE-BASED ACCESS CONTROL ==========
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const userRole = req.admin.role;

        // system_owner has access to everything
        if (userRole === 'system_owner') {
            return next();
        }

        // Check if user's role is allowed
        if (roles.includes(userRole)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient permissions.'
        });
    };
};

// ========== SUPER ADMIN LOGIN ==========
app.post('/api/super-admin/login', async (req, res) => {
    const { email, password } = req.body;

    console.log('Login attempt:', { email });

    try {
        // Check super_admins table
        const result = await pool.query(
            'SELECT * FROM super_admins WHERE email = $1 AND is_active = true',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials. Super admin not found.'
            });
        }

        const admin = result.rows[0];
        const validPassword = (password === 'SuperAdmin123!' || password === 'Admin123!');

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials. Wrong password.'
            });
        }

        // For super_admin role, check subscription status of their university
        let subscriptionWarning = null;
        if (admin.role === 'super_admin') {
            // Find the university this super_admin manages
            const uniResult = await pool.query(
                `SELECT u.* FROM universities u
                 WHERE u.super_admin_id = $1`,
                [admin.id]
            );

            if (uniResult.rows.length > 0) {
                const university = uniResult.rows[0];
                const isSubscriptionActive = university.subscription_status === 'active' &&
                                            university.status === 'active' &&
                                            (!university.subscription_end || new Date(university.subscription_end) > new Date());

                if (!isSubscriptionActive) {
                    subscriptionWarning = {
                        message: 'Your university subscription has expired. Please contact system administrator to renew.',
                        expired: true
                    };
                }
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: admin.id, email: admin.email, role: admin.role },
            process.env.JWT_SECRET || 'super-admin-secret-key',
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            subscriptionWarning,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ========== CHECK SUBSCRIPTION STATUS ENDPOINT ==========
app.get('/api/super-admin/subscription-status', verifyToken, async (req, res) => {
    try {
        if (req.admin.role === 'super_admin') {
            const uniResult = await pool.query(
                `SELECT subscription_status, status, subscription_end FROM universities
                 WHERE super_admin_id = $1`,
                [req.admin.id]
            );

            if (uniResult.rows.length > 0) {
                const uni = uniResult.rows[0];
                const isActive = uni.subscription_status === 'active' &&
                                uni.status === 'active' &&
                                (!uni.subscription_end || new Date(uni.subscription_end) > new Date());

                return res.json({
                    success: true,
                    active: isActive,
                    expiryDate: uni.subscription_end,
                    status: uni.subscription_status
                });
            }
        }
        res.json({ success: true, active: true });
    } catch (error) {
        console.error('Subscription status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== GET STATISTICS ==========
// system_owner sees global stats, super_admin sees only their university stats
app.get('/api/super-admin/stats', verifyToken, checkSubscriptionStatus, async (req, res) => {
    try {
        if (req.admin.role === 'system_owner') {
            // Global stats for system_owner
            const universities = await pool.query('SELECT COUNT(*) FROM universities');
            const activeSubscriptions = await pool.query(
                'SELECT COUNT(*) FROM universities WHERE subscription_status = $1',
                ['active']
            );
            const totalUsers = await pool.query('SELECT COUNT(*) FROM users');

            // Revenue calculations (global)
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

            const monthlyRevenueResult = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total
                 FROM subscriptions
                 WHERE status = 'active'
                   AND start_date <= $1
                   AND end_date >= $2
                   AND billing_cycle = 'monthly'`,
                [endOfMonth, startOfMonth]
            );

            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const endOfYear = new Date(now.getFullYear(), 11, 31);

            const annualRevenueResult = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) as total
                 FROM subscriptions
                 WHERE status = 'active'
                   AND start_date <= $1
                   AND end_date >= $2
                   AND billing_cycle = 'annual'`,
                [endOfYear, startOfYear]
            );

            const monthlyFromAnnual = annualRevenueResult.rows[0].total / 12;
            const totalMonthlyRevenue = Math.round(monthlyRevenueResult.rows[0].total + monthlyFromAnnual);

            const totalRevenueResult = await pool.query(
                'SELECT COALESCE(SUM(amount), 0) as total FROM subscriptions WHERE status = $1',
                ['active']
            );

            const pendingSubscriptions = await pool.query(
                'SELECT COUNT(*) FROM universities WHERE subscription_status = $1',
                ['inactive']
            );

            const expiredSubscriptions = await pool.query(
                'SELECT COUNT(*) FROM universities WHERE subscription_status = $1 AND subscription_end < NOW()',
                ['active']
            );

            const recentActivities = await pool.query(
                `SELECT s.*, u.name as university_name
                 FROM subscriptions s
                 JOIN universities u ON s.university_id = u.id
                 ORDER BY s.created_at DESC
                 LIMIT 5`
            );

            res.json({
                success: true,
                stats: {
                    totalUniversities: parseInt(universities.rows[0].count),
                    activeSubscriptions: parseInt(activeSubscriptions.rows[0].count),
                    totalUsers: parseInt(totalUsers.rows[0].count),
                    monthlyRevenue: totalMonthlyRevenue,
                    annualRevenue: annualRevenueResult.rows[0].total,
                    totalRevenue: totalRevenueResult.rows[0].total,
                    pendingSubscriptions: parseInt(pendingSubscriptions.rows[0].count),
                    expiredSubscriptions: parseInt(expiredSubscriptions.rows[0].count),
                    recentActivities: recentActivities.rows
                }
            });
        } else {
            // Limited stats for super_admin (only their university)
            const university = req.university;

            const usersCount = await pool.query(
                'SELECT COUNT(*) FROM users WHERE university_id = $1',
                [university.id]
            );

            const ordersStats = await pool.query(
                `SELECT
                    COUNT(*) as total_orders,
                    COALESCE(SUM(total), 0) as total_revenue,
                    COUNT(*) FILTER (WHERE status = 'pending_verification') as pending_orders,
                    COUNT(*) FILTER (WHERE status = 'served') as served_orders
                 FROM orders
                 WHERE university_id = $1`,
                [university.id]
            );

            res.json({
                success: true,
                stats: {
                    universityName: university.name,
                    totalUsers: parseInt(usersCount.rows[0].count),
                    totalOrders: parseInt(ordersStats.rows[0].total_orders),
                    totalRevenue: parseInt(ordersStats.rows[0].total_revenue),
                    pendingOrders: parseInt(ordersStats.rows[0].pending_orders),
                    servedOrders: parseInt(ordersStats.rows[0].served_orders),
                    subscriptionStatus: university.subscription_status,
                    subscriptionEnd: university.subscription_end
                }
            });
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ========== GET ALL UNIVERSITIES ==========
// Only system_owner can access this
app.get('/api/super-admin/universities', verifyToken, checkSubscriptionStatus, requireRole(['system_owner']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.*, COUNT(us.id) as users_count
            FROM universities u
            LEFT JOIN users us ON u.id = us.university_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        res.json({ success: true, universities: result.rows });
    } catch (error) {
        console.error('Error fetching universities:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== ADD NEW UNIVERSITY ==========
// Only system_owner can access this
app.post('/api/super-admin/universities', verifyToken, checkSubscriptionStatus, requireRole(['system_owner']), async (req, res) => {
    const { name, email, phone, address, city, country } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO universities (id, name, email, phone, address, city, country, status, subscription_status)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [name, email, phone || null, address || null, city || null, country || 'Tanzania', 'pending', 'inactive']
        );
        res.json({ success: true, university: result.rows[0] });
    } catch (error) {
        console.error('Error adding university:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== ACTIVATE/EXTEND SUBSCRIPTION ==========
// Only system_owner can access this
app.post('/api/super-admin/universities/:id/activate-subscription', verifyToken, checkSubscriptionStatus, requireRole(['system_owner']), async (req, res) => {
    const { id } = req.params;
    const { duration, amount } = req.body;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    try {
        const currentUni = await pool.query(
            'SELECT subscription_start, subscription_end, subscription_status FROM universities WHERE id = $1',
            [id]
        );

        if (currentUni.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'University not found' });
        }

        const uni = currentUni.rows[0];

        let subscriptionStart = startDate;
        if (uni.subscription_start && uni.subscription_status === 'active' && uni.subscription_end > new Date()) {
            subscriptionStart = uni.subscription_start;
        }

        await pool.query(
            `UPDATE universities
             SET subscription_status = 'active',
                 status = 'active',
                 subscription_start = $1,
                 subscription_end = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [subscriptionStart, endDate, id]
        );

        try {
            await pool.query(
                `INSERT INTO subscriptions (id, university_id, amount, currency, billing_cycle, status, start_date, end_date, payment_method, created_by)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [id, amount, 'USD', duration === 365 ? 'annual' : 'monthly', 'active', subscriptionStart, endDate, 'Bank Transfer', req.admin?.id]
            );
        } catch (historyError) {
            console.log('Note: subscriptions table not found or error inserting history:', historyError.message);
        }

        try {
            await pool.query(
                `INSERT INTO subscription_logs (university_id, action, details, created_by)
                 VALUES ($1, $2, $3, $4)`,
                [id, 'subscription_activated', JSON.stringify({
                    duration,
                    amount,
                    startDate: subscriptionStart.toISOString(),
                    endDate: endDate.toISOString(),
                    isExtension: subscriptionStart !== startDate
                }), req.admin?.id]
            );
        } catch (logError) {
            console.log('Note: subscription_logs table not found, skipping log entry');
        }

        res.json({
            success: true,
            message: `Subscription ${subscriptionStart !== startDate ? 'extended' : 'activated'} successfully from ${subscriptionStart.toLocaleDateString()} until ${endDate.toLocaleDateString()}`,
            data: {
                startDate: subscriptionStart,
                endDate: endDate,
                isExtension: subscriptionStart !== startDate
            }
        });
    } catch (error) {
        console.error('Error activating subscription:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== SUSPEND UNIVERSITY ==========
// Only system_owner can access this
app.post('/api/super-admin/universities/:id/suspend', verifyToken, checkSubscriptionStatus, requireRole(['system_owner']), async (req, res) => {
    const { id } = req.params;

    console.log('Suspend request for university ID:', id);

    try {
        const checkResult = await pool.query(
            'SELECT id, name, status FROM universities WHERE id = $1',
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'University not found'
            });
        }

        console.log('Found university:', checkResult.rows[0].name);

        const result = await pool.query(
            `UPDATE universities
             SET status = 'suspended',
                 subscription_status = 'inactive',
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, name, status, subscription_status`,
            [id]
        );

        console.log('Update successful:', result.rows[0]);

        res.json({
            success: true,
            message: 'University suspended successfully',
            university: result.rows[0]
        });

    } catch (error) {
        console.error('Error suspending university:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// ========== GET ALL USERS ==========
// super_admin can only see users from their university
app.get('/api/super-admin/users', verifyToken, checkSubscriptionStatus, async (req, res) => {
    const { universityId, role } = req.query;

    let query = `
        SELECT u.id, u.name, u.email, u.reg_number, u.role, u.is_active, u.university_id, un.name as university_name
        FROM users u
        LEFT JOIN universities un ON u.university_id = un.id
        WHERE 1=1
    `;
    const params = [];

    // If user is super_admin (not system_owner), filter by their university
    if (req.admin.role === 'super_admin' && req.university) {
        params.push(req.university.id);
        query += ` AND u.university_id = $${params.length}`;
    } else if (universityId && req.admin.role === 'system_owner') {
        params.push(universityId);
        query += ` AND u.university_id = $${params.length}`;
    }

    if (role && role !== 'all') {
        params.push(role);
        query += ` AND u.role = $${params.length}`;
    }

    query += ` ORDER BY u.created_at DESC`;

    try {
        const result = await pool.query(query, params);
        res.json({ success: true, users: result.rows });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== CREATE NEW USER ==========
// super_admin can only create users for their university and cannot create admins
app.post('/api/super-admin/users', verifyToken, checkSubscriptionStatus, async (req, res) => {
    const { name, email, reg_number, password, role, university_id } = req.body;

    // For super_admin, force restrictions
    let targetUniversityId = university_id;
    let targetRole = role;

    if (req.admin.role === 'super_admin' && req.university) {
        targetUniversityId = req.university.id;

        // Super admins cannot create other admin users
        if (role === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Super admins cannot create other admin users.'
            });
        }
    }

    try {
        const existing = await pool.query(
            'SELECT id FROM users WHERE reg_number = $1 OR email = $2',
            [reg_number, email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User with this registration number or email already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (id, name, email, reg_number, password, role, university_id, is_active)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true)
             RETURNING id, name, email, reg_number, role, university_id`,
            [name, email, reg_number, hashedPassword, targetRole, targetUniversityId]
        );

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== UPDATE USER ==========
// super_admin can only update users from their university
app.put('/api/super-admin/users/:id', verifyToken, checkSubscriptionStatus, async (req, res) => {
    const { id } = req.params;
    const { name, email, reg_number, role, university_id } = req.body;

    // Verify super_admin can only update users from their university
    if (req.admin.role === 'super_admin' && req.university) {
        const userCheck = await pool.query(
            'SELECT university_id FROM users WHERE id = $1',
            [id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (userCheck.rows[0].university_id !== req.university.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only update users from your own university.'
            });
        }

        // Super admins cannot change a user to admin role
        if (role === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Super admins cannot promote users to admin role.'
            });
        }
    }

    try {
        await pool.query(
            `UPDATE users
             SET name = $1, email = $2, reg_number = $3, role = $4, university_id = $5, updated_at = NOW()
             WHERE id = $6`,
            [name, email, reg_number, role, university_id, id]
        );
        res.json({ success: true, message: 'User updated' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== DELETE USER ==========
// super_admin can only delete users from their university
app.delete('/api/super-admin/users/:id', verifyToken, checkSubscriptionStatus, async (req, res) => {
    const { id } = req.params;

    // Verify super_admin can only delete users from their university
    if (req.admin.role === 'super_admin' && req.university) {
        const userCheck = await pool.query(
            'SELECT university_id FROM users WHERE id = $1',
            [id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (userCheck.rows[0].university_id !== req.university.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete users from your own university.'
            });
        }
    }

    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== GET SUBSCRIPTIONS HISTORY ==========
// Only system_owner can view all subscriptions
app.get('/api/super-admin/subscriptions', verifyToken, checkSubscriptionStatus, requireRole(['system_owner']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.*, u.name as university_name
            FROM subscriptions s
            JOIN universities u ON s.university_id = u.id
            ORDER BY s.created_at DESC
        `);
        res.json({ success: true, subscriptions: result.rows });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.json({ success: true, subscriptions: [] });
    }
});

// ========== GET SYSTEM SETTINGS ==========
// Only system_owner can view settings
app.get('/api/super-admin/settings', verifyToken, checkSubscriptionStatus, requireRole(['system_owner']), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT setting_key, setting_value, setting_type FROM system_settings'
        );

        const settings = {};
        result.rows.forEach(row => {
            let value = row.setting_value;
            if (row.setting_type === 'number') {
                value = parseInt(value);
            } else if (row.setting_type === 'boolean') {
                value = value === 'true';
            }
            settings[row.setting_key] = value;
        });

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.json({
            success: true,
            settings: {
                system_name: 'UniEat',
                support_email: 'support@unieat.com',
                annual_price: 1200,
                monthly_price: 100,
                currency: 'USD',
                timezone: 'Africa/Dar_es_Salaam'
            }
        });
    }
});

// ========== UPDATE SYSTEM SETTINGS ==========
// Only system_owner can update settings
app.put('/api/super-admin/settings', verifyToken, checkSubscriptionStatus, requireRole(['system_owner']), async (req, res) => {
    const { settings } = req.body;

    try {
        for (const [key, value] of Object.entries(settings)) {
            let settingValue = String(value);
            let settingType = typeof value;

            await pool.query(
                `INSERT INTO system_settings (setting_key, setting_value, setting_type, updated_at, updated_by)
                 VALUES ($1, $2, $3, NOW(), $4)
                 ON CONFLICT (setting_key)
                 DO UPDATE SET setting_value = $2, setting_type = $3, updated_at = NOW(), updated_by = $4`,
                [key, settingValue, settingType, req.admin?.id]
            );
        }

        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Super Admin API',
        timestamp: new Date().toISOString(),
        database: pool._connected ? 'connected' : 'checking'
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`👑 Super Admin API running on http://localhost:${PORT}`);
    console.log(`📊 Frontend should be at: http://localhost:3001`);
    console.log(`🔐 Login with: superadmin@unieat.com / SuperAdmin123!`);
});

module.exports = app;