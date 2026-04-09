const API_BASE_URL = window.CONFIG?.API_URL || 'http://localhost:5000/api';

const apiService = {
    async login(credentials) {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        return response.json();
    },

    async getMe(token) {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.json();
    },

    async getUsers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `/users?${queryString}` : '/users';
        const response = await fetch(`${API_BASE_URL}${url}`, {
            headers: { 'Authorization': `Bearer ${this.getToken()}` }
        });
        return response.json();
    },

    async createUser(userData) {
        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getToken()}`
            },
            body: JSON.stringify(userData)
        });
        return response.json();
    },

    async updateUser(id, userData) {
        const response = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getToken()}`
            },
            body: JSON.stringify(userData)
        });
        return response.json();
    },

    async deleteUser(id) {
        const response = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.getToken()}` }
        });
        return response.json();
    },

    async resetPassword(id, newPassword) {
        const response = await fetch(`${API_BASE_URL}/users/${id}/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getToken()}`
            },
            body: JSON.stringify({ newPassword })
        });
        return response.json();
    },

    async toggleUserStatus(id, isActive) {
        const response = await fetch(`${API_BASE_URL}/users/${id}/toggle-status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getToken()}`
            },
            body: JSON.stringify({ is_active: isActive })
        });
        return response.json();
    },

    getToken() {
        return localStorage.getItem('access_token');
    }

    async getMenu() {
        const response = await fetch(`${API_BASE_URL}/menu`);
        return response.json();
    },

    async createMenuItem(itemData, token) {
        const response = await fetch(`${API_BASE_URL}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(itemData)
        });
        return response.json();
    },

    async updateMenuItem(id, itemData, token) {
        const response = await fetch(`${API_BASE_URL}/menu/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(itemData)
        });
        return response.json();
    },

    async deleteMenuItem(id, token) {
        const response = await fetch(`${API_BASE_URL}/menu/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.json();
    },

    async createOrder(orderData, token) {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderData)
        });
        return response.json();
    },

    async getOrders(token) {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.json();
    },

    async updateOrderStatus(id, status, token) {
        const response = await fetch(`${API_BASE_URL}/orders/${id}/status`,{
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        return response.json();
    },

    async initiatePayment(paymentData, token) {
        const response = await fetch(`${API_BASE_URL}/payments/initiate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(paymentData)
        });
        return response.json();
    },

    async getReports(token, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${API_BASE_URL}/reports?${queryString}` : `${API_BASE_URL}/reports`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.json();
    },

    async healthCheck() {
        const response = await fetch('http://localhost:5000/health');
        return response.json();
    }
};

window.apiService = apiService;