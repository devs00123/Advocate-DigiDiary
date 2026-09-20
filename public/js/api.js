/**
 * Advocate DigiDiary — Centralized API Client
 * Enforces secure credentials, uniform JSON error handling, and 401 handling.
 */

const API_BASE = '/api';

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'same-origin', // Passes HTTP-only cookie automatically
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        const isAuthPage = window.location.pathname.includes('login.html') ||
          window.location.pathname.includes('register.html') ||
          window.location.pathname.includes('forgot-password.html') ||
          window.location.pathname.includes('reset-password.html') ||
          window.location.pathname === '/' ||
          window.location.pathname.endsWith('index.html');

        if (!isAuthPage) {
          window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || (data.errors && data.errors.join(', ')) || `HTTP ${response.status}`);
        }
        return data;
      }

      // For binary streams (PDF, Excel, CSV)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response;
    } catch (err) {
      console.error(`[API ERROR] ${options.method || 'GET'} ${endpoint}:`, err.message);
      throw err;
    }
  }

  get(endpoint, queryParams = {}) {
    let url = endpoint;
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, val);
      }
    });
    const queryString = params.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, body = {}) {
    return this.request(endpoint, { method: 'POST', body });
  }

  put(endpoint, body = {}) {
    return this.request(endpoint, { method: 'PUT', body });
  }

  patch(endpoint, body = {}) {
    return this.request(endpoint, { method: 'PATCH', body });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

const api = new ApiClient();
window.api = api;

const API = {
  client: api,
  request: (endpoint, options) => api.request(endpoint, options),
  get: (endpoint, params) => api.get(endpoint, params),
  post: (endpoint, body) => api.post(endpoint, body),
  put: (endpoint, body) => api.put(endpoint, body),
  delete: (endpoint) => api.delete(endpoint),
  auth: {
    login: (email, password) => api.post('/auth/login', { email, password }),
    register: (data) => api.post('/auth/register', data),
    logout: () => api.post('/auth/logout'),
    me: () => api.get('/auth/me'),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (resetToken, newPassword) => api.post('/auth/reset-password', { resetToken, newPassword }),
    updateProfile: (data) => api.put('/auth/profile', data)
  },
  cases: {
    getAll: (params) => api.get('/cases', params),
    getById: (id) => api.get(`/cases/${id}`),
    create: (data) => api.post('/cases', data),
    update: (id, data) => api.put(`/cases/${id}`, data),
    delete: (id) => api.delete(`/cases/${id}`),
    getTimeline: (id) => api.get(`/cases/${id}/timeline`)
  },
  hearings: {
    getAll: (params) => api.get('/hearings', params),
    getDailyCauseList: (params) => api.get('/hearings/cause-list', params),
    getById: (id) => api.get(`/hearings/${id}`),
    create: (data) => api.post('/hearings', data),
    update: (id, data) => api.put(`/hearings/${id}`, data),
    recordOutcome: (id, data) => api.post(`/hearings/${id}/outcome`, data),
    delete: (id) => api.delete(`/hearings/${id}`)
  },
  calendar: {
    getEvents: (params) => api.get('/calendar', params)
  },
  tasks: {
    getAll: (params) => api.get('/tasks', params),
    getById: (id) => api.get(`/tasks/${id}`),
    create: (data) => api.post('/tasks', data),
    update: (id, data) => api.put(`/tasks/${id}`, data),
    delete: (id) => api.delete(`/tasks/${id}`)
  },
  notes: {
    getAll: (params) => api.get('/notes', params),
    getById: (id) => api.get(`/notes/${id}`),
    create: (data) => api.post('/notes', data),
    update: (id, data) => api.put(`/notes/${id}`, data),
    delete: (id) => api.delete(`/notes/${id}`)
  },
  clients: {
    getAll: (params) => api.get('/clients', params),
    getById: (id) => api.get(`/clients/${id}`),
    create: (data) => api.post('/clients', data),
    update: (id, data) => api.put(`/clients/${id}`, data),
    delete: (id) => api.delete(`/clients/${id}`)
  },
  financial: {
    getOverview: () => api.get('/financial/overview'),
    getPayments: (params) => api.get('/financial/payments', params),
    createPayment: (data) => api.post('/financial/payments', data),
    deletePayment: (id) => api.delete(`/financial/payments/${id}`),
    getExpenses: (params) => api.get('/financial/expenses', params),
    createExpense: (data) => api.post('/financial/expenses', data),
    deleteExpense: (id) => api.delete(`/financial/expenses/${id}`)
  },
  reminders: {
    getAll: (params) => api.get('/reminders', params),
    create: (data) => api.post('/reminders', data),
    update: (id, data) => api.put(`/reminders/${id}`, data),
    toggle: (id, data) => api.patch(`/reminders/${id}/toggle`, data),
    dismiss: (id) => api.patch(`/reminders/${id}/dismiss`),
    delete: (id) => api.delete(`/reminders/${id}`)
  },
  analytics: {
    getSummary: () => api.get('/analytics/summary'),
    getCaseDistribution: () => api.get('/analytics/case-distribution'),
    getHearingOutcomes: () => api.get('/analytics/hearing-outcomes'),
    getMonthlyRevenue: () => api.get('/analytics/monthly-revenue')
  },
  team: {
    getAll: (params) => api.get('/team', params),
    getById: (id) => api.get(`/team/${id}`),
    create: (data) => api.post('/team', data),
    update: (id, data) => api.put(`/team/${id}`, data),
    delete: (id) => api.delete(`/team/${id}`)
  },
  audit: {
    getAll: (params) => api.get('/audit-logs', params)
  },
  search: {
    global: (query) => api.get('/search', { q: query })
  },
  health: {
    check: () => api.get('/health')
  }
};
window.API = API;

