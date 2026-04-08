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

        // Verify password (for demo, accept plain password)
        const validPassword = (password === 'SuperAdmin123!' || password === 'Admin123!');

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials. Wrong password.'
            });
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

// ========== GET STATISTICS ==========
app.get('/api/super-admin/stats', verifyToken, async (req, res) => {
    try {
        const universities = await pool.query('SELECT COUNT(*) FROM universities');
        const activeSubscriptions = await pool.query('SELECT COUNT(*) FROM universities WHERE subscription_status = $1', ['active']);
        const totalUsers = await pool.query('SELECT COUNT(*) FROM users');

        res.json({
            success: true,
            stats: {
                totalUniversities: parseInt(universities.rows[0].count),
                activeSubscriptions: parseInt(activeSubscriptions.rows[0].count),
                totalUsers: parseInt(totalUsers.rows[0].count),
                monthlyRevenue: 1200
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== GET ALL UNIVERSITIES ==========
app.get('/api/super-admin/universities', verifyToken, async (req, res) => {
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
app.post('/api/super-admin/universities', verifyToken, async (req, res) => {
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
app.post('/api/super-admin/universities/:id/activate-subscription', verifyToken, async (req, res) => {
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
            return res.status(404).json({success: false, message: 'University not found'});
        }

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
app.post('/api/super-admin/universities/:id/suspend', verifyToken, async (req, res) => {
    const { id } = req.params;

    console.log('Suspend request for university ID:', id);

    try {
        // Check if university exists first
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

        // Update university status - FIXED: using 'result' instead of 'updatedResult'
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
app.get('/api/super-admin/users', verifyToken, async (req, res) => {
    const { universityId, role } = req.query;

    let query = `
        SELECT u.id, u.name, u.email, u.reg_number, u.role, u.is_active, u.university_id, un.name as university_name
        FROM users u
        LEFT JOIN universities un ON u.university_id = un.id
        WHERE 1=1
    `;
    const params = [];

    if (universityId) {
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

// ========== CREATE NEW USER (via Super Admin) ==========
app.post('/api/super-admin/users', verifyToken, async (req, res) => {
    const { name, email, reg_number, password, role, university_id } = req.body;

    try {
        // Check if user already exists
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

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (id, name, email, reg_number, password, role, university_id, is_active)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true)
             RETURNING id, name, email, reg_number, role, university_id`,
            [name, email, reg_number, hashedPassword, role, university_id]
        );

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== UPDATE USER ==========
app.put('/api/super-admin/users/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { name, email, reg_number, role, university_id } = req.body;

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
app.delete('/api/super-admin/users/:id', verifyToken, async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== GET SUBSCRIPTIONS HISTORY ==========
app.get('/api/super-admin/subscriptions', verifyToken, async (req, res) => {
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