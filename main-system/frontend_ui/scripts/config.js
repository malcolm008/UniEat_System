const CONFIG = {
    API_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:5000/api'
        : 'https://your-production-api.com/api',
    DEMO_MODE: true,  // Set to false when backend is ready
    APP_NAME: 'UniEat',
    VERSION: '1.0.0'
};

// Make it available globally
window.CONFIG = CONFIG;