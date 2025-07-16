import axios from 'axios';
import { User } from '@/types/user';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface LoginResponse {
  token: string;
  user: User;
  requires2FA?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  organization_code?: string;
}

export const authService = {
  // Login
  async login(email: string, password: string, twoFactorCode?: string): Promise<LoginResponse> {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
      two_factor_code: twoFactorCode,
    });
    return response.data;
  },

  // Register
  async register(data: RegisterData): Promise<LoginResponse> {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  // Logout
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  // Get user profile
  async getProfile(): Promise<User> {
    const response = await apiClient.get('/auth/profile');
    return response.data.user;
  },

  // Refresh token
  async refreshToken(): Promise<LoginResponse> {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },

  // Forgot password
  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  // Reset password
  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password });
  },

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.put('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  // Verify email
  async verifyEmail(token: string): Promise<void> {
    await apiClient.post('/auth/verify-email', { token });
  },

  // Resend verification email
  async resendVerification(): Promise<void> {
    await apiClient.post('/auth/resend-verification');
  },

  // Enable 2FA
  async enable2FA(): Promise<{
    secret: string;
    qrCode: string;
    manualEntryKey: string;
  }> {
    const response = await apiClient.post('/auth/2fa/enable');
    return response.data;
  },

  // Confirm 2FA setup
  async confirm2FA(token: string): Promise<void> {
    await apiClient.post('/auth/2fa/confirm', { token });
  },

  // Disable 2FA
  async disable2FA(token: string): Promise<void> {
    await apiClient.post('/auth/2fa/disable', { token });
  },

  // Generate backup codes
  async generateBackupCodes(): Promise<string[]> {
    const response = await apiClient.post('/auth/2fa/backup-codes');
    return response.data.codes;
  },

  // Update profile
  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiClient.put('/auth/profile', data);
    return response.data.user;
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },

  // Get stored token
  getToken(): string | null {
    return localStorage.getItem('token');
  },

  // Clear authentication
  clearAuth(): void {
    localStorage.removeItem('token');
  },
};

export default authService;