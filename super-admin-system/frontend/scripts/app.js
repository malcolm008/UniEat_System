const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;

// ========== API SERVICE ==========
const API_BASE_URL = 'http://localhost:5001/api/super-admin';

const apiService = {
    getToken() { return localStorage.getItem('superAdminToken'); },
    async authFetch(url, options = {}) {
        const token = this.getToken();
        const headers = { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }), ...options.headers };
        const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });
        return await response.json();
    },
    async login(email, password) {
        const response = await fetch(`${API_BASE_URL}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        return await response.json();
    },
    async getUniversities() { return await this.authFetch('/universities'); },
    async addUniversity(data) { return await this.authFetch('/universities', { method: 'POST', body: JSON.stringify(data) }); },
    async activateSubscription(id, duration, amount) { return await this.authFetch(`/universities/${id}/activate-subscription`, { method: 'POST', body: JSON.stringify({ duration, amount }) }); },
    async suspendUniversity(id) { return await this.authFetch(`/universities/${id}/suspend`, { method: 'POST' }); },
    async getUsers(universityId = null) { return await this.authFetch(universityId ? `/users?universityId=${universityId}` : '/users'); },
    async createUser(data) { return await this.authFetch('/users', { method: 'POST', body: JSON.stringify(data) }); },
    async updateUser(id, data) { return await this.authFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    async deleteUser(id) { return await this.authFetch(`/users/${id}`, { method: 'DELETE' }); },
    async getSystemStats() { return await this.authFetch('/stats'); },
    async getSubscriptions() { return await this.authFetch('/subscriptions'); }
};

// ========== UI COMPONENTS ==========
function Toast({ toast }) {
    if (!toast) return null;
    return <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#1a1a1a', color: '#fff', padding: '12px 20px', borderRadius: 8, zIndex: 10000 }}>{toast}</div>;
}

function Modal({ open, onClose, children, title }) {
    if (!open) return null;
    return (
        <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
            <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
                {title && <h2 style={{ marginBottom: 16, fontSize: 18 }}>{title}</h2>}
                {children}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color }) {
    const colors = { blue: { bg: '#1e3a5f' }, green: { bg: '#1a4a3a' }, orange: { bg: '#5a3a1a' }, purple: { bg: '#3a1a5a' } };
    const col = colors[color] || colors.blue;
    return (
        <div style={{ background: col.bg, borderRadius: 12, padding: 16, transition: 'transform 0.2s' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>{title}</div>
        </div>
    );
}

function Badge({ children, type }) {
    const colors = {
        active: { bg: '#1a5a3a', color: '#8bc34a' }, inactive: { bg: '#5a1a1a', color: '#ef5350' },
        pending: { bg: '#5a4a1a', color: '#ffc107' }, admin: { bg: '#3a1a5a', color: '#ce93d8' },
        staff: { bg: '#1a3a5a', color: '#64b5f6' }, student: { bg: '#1a5a4a', color: '#4db6ac' }
    };
    const style = colors[type] || colors.inactive;
    return <span style={{ background: style.bg, color: style.color, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'inline-block' }}>{children}</span>;
}

function Btn({ children, onClick, variant = 'primary', fullWidth = false, disabled = false }) {
    const variants = { primary: { bg: '#2563eb', hover: '#1d4ed8' }, success: { bg: '#16a34a', hover: '#15803d' }, danger: { bg: '#dc2626', hover: '#b91c1c' }, warning: { bg: '#d97706', hover: '#b45309' }, secondary: { bg: '#4b5563', hover: '#374151' } };
    const style = variants[variant] || variants.primary;
    return (
        <button onClick={onClick} disabled={disabled} style={{
            width: fullWidth ? '100%' : 'auto', background: style.bg, color: '#fff', border: 'none',
            padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13,
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background 0.2s'
        }} onMouseEnter={e => !disabled && (e.currentTarget.style.background = style.hover)} onMouseLeave={e => !disabled && (e.currentTarget.style.background = style.bg)}>
            {children}
        </button>
    );
}

const inputStyle = { width: '100%', padding: '10px 12px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: 8, color: '#fff', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' };

// ========== LOGIN SCREEN ==========
function LoginScreen({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) { setError('Please enter email and password'); return; }
        setLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:5001/api/super-admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success && data.token) {
                localStorage.setItem('superAdminToken', data.token);
                localStorage.setItem('superAdmin', JSON.stringify(data.admin));
                onLogin(data.admin);
            } else {
                setError(data.message || 'Invalid credentials');
                setLoading(false);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Network error. Please make sure the backend server is running on port 5001.');
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'rgba(26, 26, 26, 0.95)', borderRadius: 20, padding: 40, width: '100%', maxWidth: 420 }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>👑</div>
                    <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>UniEat</div>
                    <div style={{ fontSize: 13, color: '#888' }}>Super Admin Portal</div>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, color: '#aaa', marginBottom: 6, display: 'block' }}>Email Address</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="superadmin@unieat.com" />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: 12, color: '#aaa', marginBottom: 6, display: 'block' }}>Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />
                    </div>
                    {error && <div style={{ background: '#5a1a1a', color: '#ef5350', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 16 }}>{error}</div>}
                    <Btn type="submit" fullWidth disabled={loading}>{loading ? 'Logging in...' : 'Access Portal →'}</Btn>
                    <div style={{ fontSize: 11, color: '#555', textAlign: 'center', marginTop: 16 }}></div>
                </form>
            </div>
        </div>
    );
}

// ========== DASHBOARD ==========
function Dashboard({ stats }) {
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div>
            <h1 style={{ fontSize: 'clamp(20px, 5vw, 24px)', marginBottom: 8 }}>Dashboard</h1>
            <p style={{ color: '#aaa', marginBottom: 24, fontSize: 'clamp(12px, 4vw, 14px)' }}>
                System Overview & Analytics
            </p>

            {/* Main Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 24
            }}>
                <StatCard
                    title="Total Universities"
                    value={stats.totalUniversities || 0}
                    icon="🏛️"
                    color="blue"
                />
                <StatCard
                    title="Active Subscriptions"
                    value={stats.activeSubscriptions || 0}
                    icon="✅"
                    color="green"
                />
                <StatCard
                    title="Total Users"
                    value={stats.totalUsers || 0}
                    icon="👥"
                    color="orange"
                />
                <StatCard
                    title="Monthly Revenue"
                    value={formatCurrency(stats.monthlyRevenue || 0)}
                    icon="💰"
                    color="purple"
                />
            </div>

            {/* Revenue Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
                marginBottom: 24
            }}>
                <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 20, border: '1px solid #2a2a2a' }}>
                    <h3 style={{ marginBottom: 16, fontSize: 'clamp(14px, 4vw, 16px)' }}>Revenue Overview</h3>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Annual Revenue</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#4caf50' }}>
                            {formatCurrency(stats.annualRevenue || 0)}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Total Revenue (All Time)</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#2196f3' }}>
                            {formatCurrency(stats.totalRevenue || 0)}
                        </div>
                    </div>
                </div>

                <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 20, border: '1px solid #2a2a2a' }}>
                    <h3 style={{ marginBottom: 16, fontSize: 'clamp(14px, 4vw, 16px)' }}>Subscription Status</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span>Active:</span>
                        <Badge type="active">{stats.activeSubscriptions || 0}</Badge>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span>Pending/Inactive:</span>
                        <Badge type="pending">{stats.pendingSubscriptions || 0}</Badge>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Expired:</span>
                        <Badge type="inactive">{stats.expiredSubscriptions || 0}</Badge>
                    </div>
                </div>
            </div>

            {/* Recent Activities */}
            <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 20, border: '1px solid #2a2a2a' }}>
                <h3 style={{ marginBottom: 16, fontSize: 'clamp(14px, 4vw, 16px)' }}>Recent Activities</h3>
                {stats.recentActivities && stats.recentActivities.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                                    <th style={{ padding: '8px', textAlign: 'left', fontSize: 12 }}>University</th>
                                    <th style={{ padding: '8px', textAlign: 'left', fontSize: 12 }}>Amount</th>
                                    <th style={{ padding: '8px', textAlign: 'left', fontSize: 12 }}>Cycle</th>
                                    <th style={{ padding: '8px', textAlign: 'left', fontSize: 12 }}>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recentActivities.map((activity, index) => (
                                    <tr key={index} style={{ borderBottom: index === stats.recentActivities.length - 1 ? 'none' : '1px solid #2a2a2a' }}>
                                        <td style={{ padding: '8px', fontSize: 13 }}>{activity.university_name}</td>
                                        <td style={{ padding: '8px', fontSize: 13 }}>{formatCurrency(activity.amount)}</td>
                                        <td style={{ padding: '8px', fontSize: 13 }}>
                                            <Badge type={activity.billing_cycle === 'annual' ? 'active' : 'pending'}>
                                                {activity.billing_cycle}
                                            </Badge>
                                        </td>
                                        <td style={{ padding: '8px', fontSize: 12, color: '#aaa' }}>
                                            {new Date(activity.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
                        No recent activities
                    </div>
                )}
            </div>
        </div>
    );
}

// ========== UNIVERSITY MANAGEMENT ==========
function UniversityManagement() {
    const [universities, setUniversities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [selectedUni, setSelectedUni] = useState(null);
    const [extendDays, setExtendDays] = useState(365);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', city: '', country: 'Tanzania' });

    const loadUniversities = async () => {
        setLoading(true);
        try {
            const result = await apiService.getUniversities();
            if (result.success && result.universities) {
                setUniversities(result.universities);
            } else {
                console.error('Failed to load universities:', result);
                setUniversities([]);
            }
        } catch (error) {
            console.error('Error loading universities:', error);
            setUniversities([]);
        }
        setLoading(false);
    };

    useEffect(() => { loadUniversities(); }, []);

    const addUniversity = async () => {
        if (!formData.name || !formData.email) {
            alert('Please fill required fields (Name and Email)');
            return;
        }

        try {
            const result = await apiService.addUniversity(formData);
            if (result.success) {
                await loadUniversities();
                setShowAddModal(false);
                setFormData({ name: '', email: '', phone: '', address: '', city: '', country: 'Tanzania' });
                alert('University added successfully!');
            } else {
                alert('Error: ' + (result.message || 'Failed to add university'));
            }
        } catch (error) {
            console.error('Error adding university:', error);
            alert('Network error. Please try again.');
        }
    };

    const updateUniversity = async () => {
        if (!selectedUni) return;

        try {
            const result = await apiService.updateUniversity(selectedUni.id, formData);

            if (result.success) {
                await loadUniversities();
                setShowEditModal(false);
                setSelectedUni(null);
                ({ name: '', email: '', phone: '', address: '', city: '', country: 'Tanzania' });
                alert('University updated successfully!');
            } else {
                alert('Error: ' + (result.message || 'Failed to update university'));
            }
        } catch (error) {
            console.error('Error updating university:', error);
            alert('Network error. Please try again.');
        }
    };

    const editUniversity = (uni) => {
        setSelectedUni(uni);
        setFormData({
            name: uni.name,
            email: uni.email,
            phone: uni.phone || '',
            address: uni.address || '',
            city: uni.city || '',
            country: uni.country || 'Tanzania'
        });
        setShowEditModal(true);
    };

    const activateSubscription = (uni) => {
        setSelectedUni(uni);
        setShowExtendModal(true);
    };

    const extendSubscription = async () => {
        const amount = extendDays === 365 ? 1200 : 100;

        try {
            const result = await apiService.activateSubscription(selectedUni.id, extendDays, amount);
            if (result.success) {
                await loadUniversities();
                setShowExtendModal(false);
                setSelectedUni(null);
                setExtendDays(365);

                // Show detailed success message
                const message = result.data?.isExtension
                    ? `✅ Subscription extended for ${selectedUni.name}!\n\nAmount: $${amount}\nNew expiry date: ${new Date(result.data.endDate).toLocaleDateString()}\n\nOriginal start date: ${new Date(result.data.startDate).toLocaleDateString()}`
                    : `✅ Subscription activated for ${selectedUni.name}!\n\nAmount: $${amount}\nValid from: ${new Date(result.data.startDate).toLocaleDateString()}\nValid until: ${new Date(result.data.endDate).toLocaleDateString()}`;

                alert(message);
            } else {
                alert('Error: ' + (result.message || 'Failed to activate subscription'));
            }
        } catch (error) {
            console.error('Error activating subscription:', error);
            alert('Network error. Please try again.');
        }
    };

    const suspendUniversity = async (uni) => {
        if (!confirm(`Are you sure you want to suspend ${uni.name}?\n\nThis will:\n- Block all users from accessing the system\n- Deactivate their subscription\n- Prevent new logins\n\nThis action can be reversed by activating the subscription again.`)) return;

        console.log('Suspended university:', uni.id, uni.name);

        try {
            const result = await apiService.suspendUniversity(uni.id);
            console.log('Suspended response:', result);

            if (result.success) {
                await loadUniversities();
                alert(`${uni.name} has been suspended successfully.\n\nAll users from this university have been blocked.`);
            } else {
                console.error('Suspend failed:', result);
                alert(`Failed to suspend: ${result.message || 'Unknown error'}\n\nCheck console for details.`);
            }
        } catch (error) {
            console.error('Error suspending university:', error);
            alert(`Network error: ${error.message}\n\nPlease check if the backend is running.`);
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 40 }}>Loading universities...</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <div><h1 style={{ fontSize: 24, marginBottom: 4 }}>University Management</h1><p style={{ color: '#aaa' }}>Manage all registered universities</p></div>
                <Btn onClick={() => setShowAddModal(true)}>+ Add University</Btn>
            </div>
            <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                    <thead><tr style={{ borderBottom: '1px solid #2a2a2a', textAlign: 'left' }}>
                        <th style={{ padding: '12px' }}>University</th><th style={{ padding: '12px' }}>Contact</th><th style={{ padding: '12px' }}>Status</th><th style={{ padding: '12px' }}>Subscription</th><th style={{ padding: '12px' }}>Valid Until</th><th style={{ padding: '12px' }}>Users</th><th style={{ padding: '12px' }}>Actions</th>
                    </tr></thead>
                    <tbody>{universities.map(uni => (
                        <tr key={uni.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                            <td style={{ padding: '12px' }}><div style={{ fontWeight: 600 }}>{uni.name}</div><div style={{ fontSize: 11, color: '#aaa' }}>{uni.city}</div></td>
                            <td style={{ padding: '12px', fontSize: 13 }}>{uni.email}<br /><span style={{ fontSize: 11, color: '#aaa' }}>{uni.phone}</span></td>
                            <td style={{ padding: '12px' }}><Badge type={uni.status === 'active' ? 'active' : uni.status === 'pending' ? 'pending' : 'inactive'}>{uni.status}</Badge></td>
                            <td style={{ padding: '12px' }}><Badge type={uni.subscription_status === 'active' ? 'active' : 'inactive'}>{uni.subscription_status}</Badge></td>
                            <td style={{ padding: '12px', fontSize: 13 }}>{uni.subscription_end ? new Date(uni.subscription_end).toLocaleDateString() : '—'}</td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>{uni.users_count}</td>
                            <td style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {uni.subscription_status !== 'active' ? <Btn variant="success" onClick={() => activateSubscription(uni)}>Activate</Btn> : <Btn variant="warning" onClick={() => activateSubscription(uni)}>Extend</Btn>}
                                    <Btn variant="danger" onClick={() => suspendUniversity(uni)}>Suspend</Btn>
                                </div>
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add New University">
                <input type="text" placeholder="University Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} />
                <input type="email" placeholder="Admin Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} />
                <input type="text" placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} />
                <input type="text" placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={inputStyle} />
                <input type="text" placeholder="City" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} style={inputStyle} />
                <select value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} style={inputStyle}>
                    <option value="Tanzania">Tanzania</option><option value="Kenya">Kenya</option><option value="Uganda">Uganda</option><option value="Rwanda">Rwanda</option>
                </select>
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}><Btn variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Btn><Btn onClick={addUniversity}>Add University</Btn></div>
            </Modal>
            <Modal open={showExtendModal} onClose={() => setShowExtendModal(false)} title="Activate Subscription">
                <p style={{ marginBottom: 16, color: '#aaa' }}>University: <strong>{selectedUni?.name}</strong></p>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    <button onClick={() => setExtendDays(365)} style={{ flex: 1, padding: 12, background: extendDays === 365 ? '#2563eb' : '#2a2a2a', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>Annual<br />$1,200</button>
                    <button onClick={() => setExtendDays(30)} style={{ flex: 1, padding: 12, background: extendDays === 30 ? '#2563eb' : '#2a2a2a', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>Monthly<br />$100</button>
                </div>
                <div style={{ display: 'flex', gap: 12 }}><Btn variant="secondary" onClick={() => setShowExtendModal(false)}>Cancel</Btn><Btn onClick={extendSubscription}>Confirm Payment</Btn></div>
            </Modal>
        </div>
    );
}

// ========== USER MANAGEMENT ==========
function UserManagement() {
    const inputStyle = {
        width: '100%',
        padding: 'clamp(8px, 3vw, 12px)',
        background: '#2a2a2a',
        border: '1px solid #3a3a3a',
        borderRadius: 8,
        color: '#fff',
        fontSize: 'clamp(12px, 4vw, 14px)',
        marginBottom: 12,
        boxSizing: 'border-box'
    };

    const selectStyle = {
        width: '100%',
        padding: 'clamp(8px, 3vw, 12px)',
        background: '#2a2a2a',
        border: '1px solid #3a3a3a',
        borderRadius: 8,
        color: '#fff',
        fontSize: 'clamp(12px, 4vw, 14px)',
        marginBottom: 12,
        cursor: 'pointer',
        boxSizing: 'border-box'
    };
    const [users, setUsers] = useState([]);
    const [universities, setUniversities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [filterRole, setFilterRole] = useState('all');
    const [filterUniversity, setFilterUniversity] = useState('all');
    const [formData, setFormData] = useState({ name: '', email: '', reg_number: '', role: 'student', university_id: '' });

    const loadData = async () => {
        setLoading(true);
        try {
            // Load universities first (important for dropdown)
            const uniResult = await apiService.getUniversities();
            console.log('Universities loaded:', uniResult);

            if (uniResult.success && uniResult.universities) {
                setUniversities(uniResult.universities);
            } else if (uniResult.universities) {
                setUniversities(uniResult.universities);
            }

            // Load users
            const usersResult = await apiService.getUsers();
            console.log('Users loaded:', usersResult);

            if (usersResult.success && usersResult.users) {
                setUsers(usersResult.users);
            } else if (usersResult.users) {
                setUsers(usersResult.users);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const generatePassword = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
        let p = '';
        for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
        return p;
    };

    const addUser = async () => {
        if (!formData.name || !formData.email || !formData.reg_number) {
            alert('Please fill required fields');
            return;
        }

        if (!formData.university_id) {
            alert('Please select a university');
            return;
        }

        const newPassword = generatePassword();
        const userData = {
            name: formData.name,
            email: formData.email,
            reg_number: formData.reg_number,
            password: newPassword,
            role: formData.role,
            university_id: formData.university_id
        };

        console.log('Creating user:', userData);

        try {
            const result = await apiService.createUser(userData);
            console.log('Create user result:', result);

            if (result.success) {
                await loadData();
                setShowAddModal(false);
                setFormData({ name: '', email: '', reg_number: '', role: 'student', university_id: '' });
                alert(`User created successfully!\n\nUsername: ${formData.reg_number}\nPassword: ${newPassword}\n\nPlease share these credentials with the user.`);
            } else {
                alert('Error: ' + (result.message || 'Failed to create user'));
            }
        } catch (error) {
            console.error('Error adding user:', error);
            alert('Network error. Please try again.');
        }
    };

    const editUser = async () => {
        if (!selectedUser) return;

        const updateData = {
            name: formData.name,
            email: formData.email,
            reg_number: formData.reg_number,
            role: formData.role,
            university_id: formData.university_id
        };

        console.log('Updating user:', selectedUser.id, updateData);

        try {
            const result = await apiService.updateUser(selectedUser.id, updateData);
            console.log('Update user result:', result);

            if (result.success) {
                await loadData();
                setShowEditModal(false);
                setSelectedUser(null);
                setFormData({ name: '', email: '', reg_number: '', role: 'student', university_id: '' });
                alert('User updated successfully!');
            } else {
                alert('Error: ' + (result.message || 'Failed to update user'));
            }
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Network error. Please try again.');
        }
    };

    const deleteUser = async (user) => {
        if (!confirm(`⚠️ Are you sure you want to delete ${user.name}?\n\nThis action cannot be undone.`)) return;

        try {
            const result = await apiService.deleteUser(user.id);
            console.log('Delete user result:', result);

            if (result.success) {
                await loadData();
                alert(`✅ ${user.name} has been deleted.`);
            } else {
                alert('❌ Error: ' + (result.message || 'Failed to delete user'));
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Network error. Please try again.');
        }
    };

    const filteredUsers = users.filter(u => {
        if (filterRole !== 'all' && u.role !== filterRole) return false;
        if (filterUniversity !== 'all' && u.university_id !== parseInt(filterUniversity)) return false;
        return true;
    });

    console.log('Universities available for dropdown:', universities);

    if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading users...</div>;

    return (

        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 24, marginBottom: 4 }}>User Management</h1>
                    <p style={{ color: '#aaa' }}>Manage all users across all universities</p>
                </div>
                <Btn onClick={() => setShowAddModal(true)}>+ Add User</Btn>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ ...inputStyle, width: 150 }}>
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="student">Student</option>
                </select>
                <select value={filterUniversity} onChange={e => setFilterUniversity(e.target.value)} style={{ ...inputStyle, width: 200 }}>
                    <option value="all">All Universities</option>
                    {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            </div>

            {/* Users Table */}
            <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #2a2a2a', textAlign: 'left' }}>
                            <th style={{ padding: '12px' }}>Name</th>
                            <th style={{ padding: '12px' }}>Email</th>
                            <th style={{ padding: '12px' }}>ID/Reg</th>
                            <th style={{ padding: '12px' }}>Role</th>
                            <th style={{ padding: '12px' }}>University</th>
                            <th style={{ padding: '12px' }}>Status</th>
                            <th style={{ padding: '12px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
                                    No users found. Click "Add User" to create one.
                                 </td>
                             </tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                                    <td style={{ padding: '12px', fontWeight: 500 }}>{user.name}</td>
                                    <td style={{ padding: '12px', fontSize: 13 }}>{user.email}</td>
                                    <td style={{ padding: '12px', fontSize: 13 }}>{user.reg_number}</td>
                                    <td style={{ padding: '12px' }}>
                                        <Badge type={user.role === 'admin' ? 'admin' : user.role === 'staff' ? 'staff' : 'student'}>
                                            {user.role}
                                        </Badge>
                                    </td>
                                    <td style={{ padding: '12px', fontSize: 13 }}>
                                        {universities.find(u => u.id === user.university_id)?.name || '—'}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <Badge type={user.is_active ? 'active' : 'inactive'}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <Btn variant="secondary" onClick={() => {
                                                setSelectedUser(user);
                                                setFormData({
                                                    name: user.name,
                                                    email: user.email,
                                                    reg_number: user.reg_number,
                                                    role: user.role,
                                                    university_id: user.university_id || ''
                                                });
                                                setShowEditModal(true);
                                            }}>Edit</Btn>
                                            <Btn variant="danger" onClick={() => deleteUser(user)}>Delete</Btn>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add User Modal */}
            <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add New User">
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    width: '100%'
                }}>
                    <input
                        type="text"
                        placeholder="Full Name *"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        style={inputStyle}
                    />
                    <input
                        type="email"
                        placeholder="Email *"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        style={inputStyle}
                    />
                    <input
                        type="text"
                        placeholder="ID/Registration Number *"
                        value={formData.reg_number}
                        onChange={e => setFormData({...formData, reg_number: e.target.value})}
                        style={inputStyle}
                    />

                    <select
                        value={formData.role}
                        onChange={e => setFormData({...formData, role: e.target.value})}
                        style={selectStyle}
                    >
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                    </select>

                    <select
                        value={formData.university_id}
                        onChange={e => setFormData({...formData, university_id: e.target.value})}
                        style={selectStyle}
                    >
                        <option value="">Select University *</option>
                        {universities.length === 0 ? (
                            <option value="" disabled>No universities available. Please add a university first.</option>
                        ) : (
                            universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)
                        )}
                    </select>

                    {universities.length === 0 && (
                        <div style={{
                            padding: 'clamp(10px, 4vw, 12px)',
                            background: '#5a1a1a',
                            borderRadius: 8,
                            marginBottom: 12,
                            color: '#ef5350',
                            fontSize: 'clamp(11px, 3vw, 12px)'
                        }}>
                            ⚠️ No universities found. Please add a university first in the Universities tab.
                        </div>
                    )}

                    <div style={{
                        padding: 'clamp(10px, 4vw, 12px)',
                        background: '#1a3a5a',
                        borderRadius: 8,
                        marginBottom: 12
                    }}>
                        <div style={{ fontSize: 'clamp(11px, 3.5vw, 12px)', color: '#64b5f6', marginBottom: 4 }}>🔐 Password</div>
                        <div style={{ fontSize: 'clamp(10px, 3vw, 11px)', color: '#aaa' }}>A secure password will be generated automatically. You'll be able to share it with the user after creation.</div>
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: 12,
                        flexDirection: window.innerWidth <= 480 ? 'column' : 'row',
                        marginTop: 8
                    }}>
                        <Btn variant="secondary" onClick={() => setShowAddModal(false)} fullWidth={window.innerWidth <= 480}>Cancel</Btn>
                        <Btn onClick={addUser} fullWidth={window.innerWidth <= 480}>Create User</Btn>
                    </div>
                </div>
            </Modal>

            {/* Edit User Modal */}
            <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit User">
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    width: '100%'
                }}>
                    <input
                        type="text"
                        placeholder="Full Name"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        style={inputStyle}
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        style={inputStyle}
                    />
                    <input
                        type="text"
                        placeholder="ID/Registration Number"
                        value={formData.reg_number}
                        onChange={e => setFormData({...formData, reg_number: e.target.value})}
                        style={inputStyle}
                    />

                    <select
                        value={formData.role}
                        onChange={e => setFormData({...formData, role: e.target.value})}
                        style={selectStyle}
                    >
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                    </select>

                    <select
                        value={formData.university_id}
                        onChange={e => setFormData({...formData, university_id: e.target.value})}
                        style={selectStyle}
                    >
                        <option value="">Select University</option>
                        {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>

                    <div style={{
                        display: 'flex',
                        gap: 12,
                        flexDirection: window.innerWidth <= 480 ? 'column' : 'row',
                        marginTop: 8
                    }}>
                        <Btn variant="secondary" onClick={() => setShowEditModal(false)} fullWidth={window.innerWidth <= 480}>Cancel</Btn>
                        <Btn onClick={editUser} fullWidth={window.innerWidth <= 480}>Save Changes</Btn>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// ========== SUBSCRIPTION MANAGEMENT ==========
function SubscriptionManagement() {
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load subscription history from API
    const loadSubscriptions = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await apiService.getSubscriptions();
            console.log('Subscriptions loaded:', result);

            if (result.success && result.subscriptions) {
                setSubscriptions(result.subscriptions);
            } else if (result.subscriptions) {
                setSubscriptions(result.subscriptions);
            } else {
                setSubscriptions([]);
            }
        } catch (error) {
            console.error('Error loading subscriptions:', error);
            setError('Failed to load subscription history. Please try again.');
            setSubscriptions([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadSubscriptions();
    }, []);

    // Format currency
    const formatCurrency = (amount, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0
        }).format(amount);
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{
                    width: 40,
                    height: 40,
                    border: '3px solid #2a2a2a',
                    borderTopColor: '#2563eb',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'spin 0.7s linear infinite'
                }} />
                <div>Loading subscription history...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                <div style={{ color: '#ef5350', marginBottom: 16 }}>{error}</div>
                <Btn onClick={loadSubscriptions}>Try Again</Btn>
            </div>
        );
    }

    return (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
                flexWrap: 'wrap',
                gap: 16
            }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(20px, 5vw, 24px)', marginBottom: 4 }}>Subscription History</h1>
                    <p style={{ color: '#aaa', fontSize: 'clamp(12px, 4vw, 14px)' }}>
                        View all subscription payments and history
                    </p>
                </div>
                <Btn variant="secondary" onClick={loadSubscriptions} small>⟳ Refresh</Btn>
            </div>

            {/* Statistics Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 16,
                marginBottom: 24
            }}>
                <StatCard
                    title="Total Payments"
                    value={subscriptions.length}
                    icon="💰"
                    color="blue"
                />
                <StatCard
                    title="Total Revenue"
                    value={formatCurrency(subscriptions.reduce((sum, s) => sum + (s.amount || 0), 0))}
                    icon="📊"
                    color="green"
                />
                <StatCard
                    title="Active Subscriptions"
                    value={subscriptions.filter(s => s.status === 'active').length}
                    icon="✅"
                    color="purple"
                />
            </div>

            {/* Subscriptions Table */}
            {subscriptions.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: 60,
                    background: '#1a1a1a',
                    borderRadius: 12,
                    border: '1px solid #2a2a2a'
                }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                    <div style={{ fontSize: 16, marginBottom: 8 }}>No subscription records found</div>
                    <div style={{ color: '#aaa', fontSize: 13 }}>
                        When you activate a subscription for a university, it will appear here.
                    </div>
                </div>
            ) : (
                <div style={{ overflowX: 'auto', width: '100%', borderRadius: 12, border: '1px solid #2a2a2a' }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        minWidth: 700,
                        fontSize: 'clamp(12px, 3vw, 14px)'
                    }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #2a2a2a', background: '#1a1a1a' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>University</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Amount</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Cycle</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Start Date</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>End Date</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Payment Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subscriptions.map((sub, index) => (
                                <tr key={sub.id} style={{
                                    borderBottom: index === subscriptions.length - 1 ? 'none' : '1px solid #2a2a2a'
                                }}>
                                    <td style={{ padding: '12px', fontWeight: 500 }}>
                                        {sub.university_name || sub.university}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {formatCurrency(sub.amount, sub.currency || 'USD')}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <Badge type={sub.billing_cycle === 'annual' ? 'active' : 'pending'}>
                                            {sub.billing_cycle === 'annual' ? 'Annual' : 'Monthly'}
                                        </Badge>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <Badge type={sub.status === 'active' ? 'active' : 'inactive'}>
                                            {sub.status}
                                        </Badge>
                                    </td>
                                    <td style={{ padding: '12px', fontSize: 'clamp(11px, 3vw, 13px)' }}>
                                        {sub.start_date ? new Date(sub.start_date).toLocaleDateString() : '—'}
                                    </td>
                                    <td style={{ padding: '12px', fontSize: 'clamp(11px, 3vw, 13px)' }}>
                                        {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : '—'}
                                    </td>
                                    <td style={{ padding: '12px', fontSize: 'clamp(11px, 3vw, 13px)' }}>
                                        {sub.payment_method || 'Bank Transfer'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// Subscription Expired Warning Component
function SubscriptionWarning({ onLogout }) {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: '#dc2626',
            color: '#fff',
            padding: '12px 20px',
            textAlign: 'center',
            zIndex: 10000,
            animation: 'slideDown 0.3s ease'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span>⚠️ Your subscription has expired. Please contact the system administrator to renew.</span>
                <button
                    onClick={onLogout}
                    style={{
                        background: '#fff',
                        color: '#dc2626',
                        border: 'none',
                        padding: '6px 16px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    Logout
                </button>
                <button
                    onClick={() => setDismissed(true)}
                    style={{
                        background: 'transparent',
                        color: '#fff',
                        border: '1px solid #fff',
                        padding: '6px 16px',
                        borderRadius: 6,
                        cursor: 'pointer'
                    }}
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
}

// ========== SETTINGS ==========
function Settings() {
    const [settings, setSettings] = useState({
        systemName: 'UniEat',
        supportEmail: 'support@unieat.com',
        annualPrice: 1200,
        monthlyPrice: 100,
        currency: 'USD',
        timezone: 'Africa/Dar_es_Salaam'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const selectStyle = {
        width: '100%',
        padding: 'clamp(8px, 3vw, 12px)',
        background: '#2a2a2a',
        border: '1px solid #3a3a3a',
        borderRadius: 8,
        color: '#fff',
        fontSize: 'clamp(12px, 4vw, 14px)',
        cursor: 'pointer',
        boxSizing: 'border-box'
    };

    // Load settings from API
    const loadSettings = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await apiService.getSettings();
            if (result.success && result.settings) {
                setSettings({
                    systemName: result.settings.system_name || 'UniEat',
                    supportEmail: result.settings.support_email || 'support@unieat.com',
                    annualPrice: result.settings.annual_price || 1200,
                    monthlyPrice: result.settings.monthly_price || 100,
                    currency: result.settings.currency || 'USD',
                    timezone: result.settings.timezone || 'Africa/Dar_es_Salaam'
                });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            setError('Failed to load settings. Using defaults.');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadSettings();
    }, []);

    // Save settings to API
    const saveSettings = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const settingsToSave = {
                system_name: settings.systemName,
                support_email: settings.supportEmail,
                annual_price: settings.annualPrice,
                monthly_price: settings.monthlyPrice,
                currency: settings.currency,
                timezone: settings.timezone
            };

            const result = await apiService.updateSettings(settingsToSave);

            if (result.success) {
                setSuccess('Settings saved successfully!');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(result.message || 'Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            setError('Network error. Please try again.');
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{
                    width: 40,
                    height: 40,
                    border: '3px solid #2a2a2a',
                    borderTopColor: '#2563eb',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'spin 0.7s linear infinite'
                }} />
                <div>Loading settings...</div>
            </div>
        );
    }

    return (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
                flexWrap: 'wrap',
                gap: 16
            }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(20px, 5vw, 24px)', marginBottom: 4 }}>System Settings</h1>
                    <p style={{ color: '#aaa', fontSize: 'clamp(12px, 4vw, 14px)' }}>
                        Configure system-wide settings
                    </p>
                </div>
                <Btn variant="secondary" onClick={loadSettings} small>⟳ Refresh</Btn>
            </div>

            {error && (
                <div style={{
                    background: '#5a1a1a',
                    color: '#ef5350',
                    padding: '12px 16px',
                    borderRadius: 8,
                    marginBottom: 20,
                    fontSize: 13
                }}>
                    ⚠️ {error}
                </div>
            )}

            {success && (
                <div style={{
                    background: '#1a5a3a',
                    color: '#8bc34a',
                    padding: '12px 16px',
                    borderRadius: 8,
                    marginBottom: 20,
                    fontSize: 13
                }}>
                    ✅ {success}
                </div>
            )}

            <div style={{
                maxWidth: '100%',
                width: 600,
                background: '#1a1a1a',
                borderRadius: 12,
                padding: 24,
                border: '1px solid #2a2a2a'
            }}>
                {/* General Settings */}
                <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #2a2a2a' }}>
                    <h3 style={{ marginBottom: 16, fontSize: 16 }}>General Settings</h3>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }}>
                            System Name
                        </label>
                        <input
                            type="text"
                            value={settings.systemName}
                            onChange={e => setSettings({...settings, systemName: e.target.value})}
                            style={inputStyle}
                            placeholder="Enter system name"
                        />
                        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                            Name displayed throughout the application
                        </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }}>
                            Support Email
                        </label>
                        <input
                            type="email"
                            value={settings.supportEmail}
                            onChange={e => setSettings({...settings, supportEmail: e.target.value})}
                            style={inputStyle}
                            placeholder="support@example.com"
                        />
                        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                            Email address for user support inquiries
                        </div>
                    </div>
                </div>

                {/* Pricing Settings */}
                <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #2a2a2a' }}>
                    <h3 style={{ marginBottom: 16, fontSize: 16 }}>Pricing Settings</h3>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: window.innerWidth <= 560 ? '1fr' : '1fr 1fr',
                        gap: 16,
                        marginBottom: 20
                    }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }}>
                                Annual Price (USD)
                            </label>
                            <input
                                type="number"
                                value={settings.annualPrice}
                                onChange={e => setSettings({...settings, annualPrice: parseInt(e.target.value)})}
                                style={inputStyle}
                                min="0"
                                step="100"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }}>
                                Monthly Price (USD)
                            </label>
                            <input
                                type="number"
                                value={settings.monthlyPrice}
                                onChange={e => setSettings({...settings, monthlyPrice: parseInt(e.target.value)})}
                                style={inputStyle}
                                min="0"
                                step="10"
                            />
                        </div>
                    </div>
                </div>

                {/* Regional Settings */}
                <div style={{ marginBottom: 20 }}>
                    <h3 style={{ marginBottom: 16, fontSize: 16 }}>Regional Settings</h3>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: window.innerWidth <= 560 ? '1fr' : '1fr 1fr',
                        gap: 16,
                        marginBottom: 20
                    }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }}>
                                Currency
                            </label>
                            <select
                                value={settings.currency}
                                onChange={e => setSettings({...settings, currency: e.target.value})}
                                style={selectStyle}
                            >
                                <option value="USD">USD - US Dollar</option>
                                <option value="TZS">TZS - Tanzanian Shilling</option>
                                <option value="KES">KES - Kenyan Shilling</option>
                                <option value="UGX">UGX - Ugandan Shilling</option>
                                <option value="RWF">RWF - Rwandan Franc</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }}>
                                Timezone
                            </label>
                            <select
                                value={settings.timezone}
                                onChange={e => setSettings({...settings, timezone: e.target.value})}
                                style={selectStyle}
                            >
                                <option value="Africa/Dar_es_Salaam">Dar es Salaam (EAT)</option>
                                <option value="Africa/Nairobi">Nairobi (EAT)</option>
                                <option value="Africa/Kampala">Kampala (EAT)</option>
                                <option value="Africa/Kigali">Kigali (CAT)</option>
                                <option value="Africa/Johannesburg">Johannesburg (SAST)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    gap: 12,
                    marginTop: 24,
                    flexDirection: window.innerWidth <= 480 ? 'column' : 'row'
                }}>
                    <Btn
                        onClick={saveSettings}
                        disabled={saving}
                        fullWidth={window.innerWidth <= 480}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Btn>
                    <Btn
                        variant="secondary"
                        onClick={loadSettings}
                        disabled={loading}
                        fullWidth={window.innerWidth <= 480}
                    >
                        Reset
                    </Btn>
                </div>

                <div style={{
                    marginTop: 20,
                    padding: 12,
                    background: '#2a2a2a',
                    borderRadius: 8,
                    fontSize: 11,
                    color: '#666',
                    textAlign: 'center'
                }}>
                    Settings are saved to the database and persist across system restarts
                </div>
            </div>
        </div>
    );
}

// ========== MAIN APP ==========
function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [admin, setAdmin] = useState(null);
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [toast, setToast] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [subscriptionExpired, setSubscriptionExpired] = useState(false);
    const [stats, setStats] = useState({
        totalUniversities: 0,
        activeSubscriptions: 0,
        totalUsers: 0,
        monthlyRevenue: 0,
        annualRevenue: 0,
        totalRevenue: 0,
        pendingSubscriptions: 0,
        expiredSubscriptions: 0,
        recentActivities: []
    });

    const checkSubscriptionStatus = async () => {
        const token = localStorage.getItem('superAdminToken');
        const savedAdmin = localStorage.getItem('superAdmin');

        if (token && savedAdmin) {
            const adminDate = JSON.parse(savedAdmin);
            if (adminDate.role === 'super_admin') {
                try {
                    const response = await fetch('http://localhost:5001/api/super-admin/subscription-status', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await response.json();

                    if (result.success && !result.active) {
                        setSubscriptionExpired(true);
                    } else {
                        setSubscriptionExpired(false);
                    }
                } catch (error) {
                    console.error('Failed to check subscription:', error);
                }
            }
        }
    };

    const loadStats = async () => {
        try {
            const result = await apiService.getSystemStats();
            if (result.success && result.stats) {
                setStats(result.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('superAdminToken');
        const savedAdmin = localStorage.getItem('superAdmin');
        if (token && savedAdmin) {
            setIsAuthenticated(true);
            setAdmin(JSON.parse(savedAdmin));
            loadStats();
            checkSubscriptionStatus();

            const interval = setInterval(checkSubscriptionStatus, 5 * 60 * 1000);
            return () => clearInterval(interval);
        }

        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile) setIsMobileMenuOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showToast = (message) => { setToast(message); setTimeout(() => setToast(null), 3000); };
    const handleLogout = () => { localStorage.removeItem('superAdminToken'); localStorage.removeItem('superAdmin'); setIsAuthenticated(false); setAdmin(null); setSubscriptionExpired(false); showToast('Logged out successfully'); };

    if (!isAuthenticated) return <LoginScreen onLogin={(adminData) => { setIsAuthenticated(true); setAdmin(adminData); checkSubscriptionStatus(); showToast(`Welcome back, ${adminData.name}`); }} />;

    const menuItems = [];

    if (admin?.role === 'system_owner') {
        menuItems.push(
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'universities', label: 'Universities', icon: '🏛️' },
            { id: 'users', label: 'Users', icon: '👥' },
            { id: 'subscriptions', label: 'Subscriptions', icon: '💰' },
            { id: 'settings', label: 'Settings', icon: '⚙️' }
        );
    } else if (admin?.role === 'super_admin') {
        menuItems.push(
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'users', label: 'User Management', icon: '👥' }
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>

            {subscriptionExpired && admin?.role === 'super_admin' && (
                <SubscriptionWarning onLogout={handleLogout} />
            )}

            {/* Mobile Menu Toggle */}
            {isMobile && (
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{
                    position: 'fixed', top: 16, left: 16, zIndex: 1001,
                    background: '#2563eb', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                    fontSize: 14, display: 'flex', alignItems: 'center', gap: 8
                }}>
                    {isMobileMenuOpen ? '✕' : '☰'} Menu
                </button>
            )}

            {/* Sidebar */}
            <div style={{
                width: isMobile ? (isMobileMenuOpen ? 260 : 0) : 260,
                background: '#111',
                borderRight: '1px solid #2a2a2a',
                padding: isMobile ? (isMobileMenuOpen ? '24px 16px' : '0') : '24px 16px',
                position: isMobile ? 'fixed' : 'relative',
                top: 0, left: 0, height: '100vh', overflowY: 'auto', zIndex: 1000,
                transition: 'width 0.3s ease, padding 0.3s ease',
                flexShrink: 0
            }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👑</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>UniEat</div>
                    <div style={{ fontSize: 11, color: '#666' }}>Super Admin</div>
                </div>
                <nav>
                    {menuItems.map(item => (
                        <button key={item.id} onClick={() => { setCurrentPage(item.id); if (isMobile) setIsMobileMenuOpen(false); }} style={{
                            width: '100%', padding: '12px 16px', marginBottom: 4,
                            background: currentPage === item.id ? '#2563eb' : 'transparent',
                            border: 'none', borderRadius: 8, color: currentPage === item.id ? '#fff' : '#aaa',
                            fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                            transition: 'all 0.2s'
                        }}>
                            <span style={{ fontSize: 20 }}>{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div style={{ marginTop: 'auto', paddingTop: 32 }}>
                    <div style={{ padding: 12, background: '#1a1a1a', borderRadius: 8, marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{admin?.name}</div>
                        <div style={{ fontSize: 10, color: '#666' }}>{admin?.email}</div>
                    </div>
                    <Btn variant="danger" onClick={handleLogout} fullWidth>Logout</Btn>
                </div>
            </div>

            {/* Overlay for mobile */}
            {isMobile && isMobileMenuOpen && (
                <div onClick={() => setIsMobileMenuOpen(false)} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 999
                }} />
            )}

            {/* Main Content */}
            <div style={{
                flex: 1,
                padding: isMobile ? '70px 16px 16px' : 24,
                width: isMobile ? '100%' : 'auto',
                overflowX: 'auto',
                minWidth: 0
            }}>
                {currentPage === 'dashboard' && <Dashboard stats={stats} />}
                {currentPage === 'universities' && <UniversityManagement />}
                {currentPage === 'users' && <UserManagement />}
                {currentPage === 'subscriptions' && <SubscriptionManagement />}
                {currentPage === 'settings' && <Settings />}
            </div>

            <Toast toast={toast} />
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);