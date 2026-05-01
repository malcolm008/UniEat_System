const API_BASE_URL = 'http://localhost:5001/api/super-admin';

const apiService = {
    getToken() {
        return localStorage.getItem('superAdminToken');
    },

    async authFetch(url, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };
        const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });
        return await response.json();
    },

    async login(email, password) {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return await response.json();
    },

    async getUniversities() {
        return await this.authFetch('/universities');
    },

    async addUniversity(data) {
        return await this.authFetch('/universities', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async activateSubscription(id, duration, amount) {
        return await this.authFetch('/universities/${id}/activate-subscription', {
            method: 'POST',
            body: JSON.stringify({ duration, amount })
        });
    },

    async suspendUniversity(id) {
        console.log('API call: Suspending university with ID:', id);
        const result = await this.authFetch(`/universities/${id}/suspend`, {
            method: 'POST'
        });
        console.log('API response:', result);
        return result;
    },

    async getUsers(universityId = null) {
        const url = universityId ? `/users?universityId=${universityId}` : '/users';
        return await this.authFetch(url);
    },

    async createUser(data) {
        return await this.authFetch('/users', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async deleteUser(id) {
        return await this.authFetch(`/users/${id}`, {
            method: 'DELETE',
        });
    },

    async updateUser(id, data) {
        return await this.authFetch(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async getSystemStats() {
        return await this.authFetch('/stats');
    },

    async getSubscriptions() {
        return await this.authFetch('/subscriptions');
    },

    async getSettings() {
        return await this.authFetch('/settings');
    },

    async updateSettings(settings) {
        return await this.authFetch('/settings', {
            method: 'PUT',
            body: JSON.stringify({ settings })
        });
    },
};

const checkSubscriptionStatus = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') {
            const result = await pool.query(
                `SELECT u.* FROM universities u
                 WHERE u.super_admin_id = $1 OR u.id = (
                     SELECT university_id FROM users WHERE id = $1
                 )`,
                [req.admin.id]
            );

            if (result.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'No university associated with your account. Contact system owner.'
                });
            }

            const university = result.rows[0];

            const isActive = university.subscription_status === 'active' && university.status === 'active' && (!university.subscription_end || new Date(university.subscription_end) > new Date());

            if (!isActive) {
                return res.status(403).json({
                    success: false,
                    message: 'Subscription has expired or is inactive. Please contact system administrator/owner to renew.',
                    subscription_expired: true
                });
            }

            req.university = university;
        }

        next();
    } catch (error) {
        console.error('Subscription check error:', error);
        next(error);
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const userRole = req.admin.role;

        if (userRole === 'system_owner') {
            return next();
        }

        if (roles.includes(userRole)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient permissions.'
        });
    };
};

const requireSupervisorAccess = requireRole(['super_admin', 'system_owner']);
