export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'radiologist' | 'manager' | 'technician' | 'viewer';
  organization_id: string;
  organization_name?: string;
  phone?: string;
  specialization?: string;
  is_active: boolean;
  is_verified: boolean;
  two_factor_enabled: boolean;
  rating_average?: number;
  rating_count?: number;
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    notifications?: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    language?: string;
    timezone?: string;
  };
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  website?: string;
  is_active: boolean;
  settings?: {
    timezone?: string;
    default_language?: string;
    sla_settings?: {
      normal_hours: number;
      stat_hours: number;
      urgent_hours: number;
    };
  };
  created_at: string;
  updated_at: string;
}