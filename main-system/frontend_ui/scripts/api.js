const API_BASE_URL = window.CONFIG?.API_URL || 'http://localhost:5000/api';

const apiService = {

    getToken() {
        return localStorage.getItem('access_token') || localStorage.getItem('token');
    },

    async authFetch(url, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };

        try {
            const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });

            const data = await response.json();

            if (response.status === 403 && data.code === 'SUBSCRIPTION_INACTIVE') {
                localStorage.setItem('subscription_error', JSON.stringify({
                    message: data.message,
                    status: data.subscription_status
                }));

                window.dispatchEvent(new CustomEvent('subscription:inactive', {
                    detail: {
                        message: data.message,
                        status: data.subscription_status
                    }
                }));
                throw new Error('SUBSCRIPTION_INACTIVE');
            }

            if (response.status === 401) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('user');
                window.location.href = '/';
                return { success: false, message: 'Session expired. Please login again.' };
            }

            return data;
        } catch (error) {
            if (error.message === 'SUBSCRIPTION_INACTIVE') {
                throw error;
            }
            console.error('Fetch error:', error);
            throw error;
        }
    },

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
        try {
            return await this.authFetch(url);
        } catch (error) {
            if (error.message === 'SUBSCRIPTION_INACTIVE') throw error;
            return { users: [] };
        }
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

    async getMenu() {
        try {
            return await this.authFetch('/menu');
        } catch (error) {
            if (error.message === 'SUBSCRIPTION_INACTIVE') throw error;
            return { items: [] };
        }
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

    const handleUpdateProfile = async (e) => {
        e.preventDefault();

        if (formData.display_name.trim() === '') {
            showToast('Display name cannot be empty', 'error');
            return;
        }

        setIsLoading(true);

        try {
            const token = localStorage.getItem('access_token') || localStorage.getItem('token');
            const userId = user.id; // This should be the UUID (ece71f41-2dc9-4484-97a0-d9e8f4ba187e)

            console.log('Updating display name for user:', userId);
            console.log('New display name:', formData.display_name);

            const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    display_name: formData.display_name
                })
            });

            const data = await response.json();
            console.log('Update response:', data);

            if (data.success) {
                // Update local user data
                const updatedUser = {
                    ...user,
                    display_name: formData.display_name
                };
                onUpdateUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                showToast('Display name updated successfully!', 'success');
            } else {
                showToast(data.message || 'Failed to update display name', 'error');
            }
        } catch (error) {
            console.error('Update profile error:', error);
            showToast('Network error. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    async changePassword(userId, passwordData) {
        const response = await fetch(`{API_BASE_URL}/users/${userId}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getToken()}`
            },
            body: JSON.stringify(passwordData)
        });
        return response.json();
    }
};

window.apiService = apiService;