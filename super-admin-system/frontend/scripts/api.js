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

    async suspendedUniversity(id) {
        return await this.authFetch('/universities/${id}/suspend', {
            method: 'POST',
        });
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
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async updateUser(id) {
        return await this.authFetch(`/users/${id}`, {
            method: 'DELETE'
        });
    },

    async getSystemStats() {
        return await this.authFetch('/stats');
    },

    async getSubscriptions() {
        return await this.authFetch('/subscriptions');
    },
};

