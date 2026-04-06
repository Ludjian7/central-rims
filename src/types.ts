// ─── User Roles ────────────────────────────────────────
export type Role = 'owner' | 'manager' | 'kasir';

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  isActive: boolean;
}

// ─── API Response ──────────────────────────────────────
export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  code?: string;
}
