import { create } from 'zustand';
import { post, setAccessToken, get } from './api';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string, totp?: string) => Promise<void>;
  signup: (email: string, password: string, name: string, orgName?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const INTERNAL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'DESIGNER', 'SUPPORT'];

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (email, password, totp) => {
    const data = await post<{ accessToken: string }>('/auth/login', { email, password, totp });
    setAccessToken(data.accessToken);
    const me = await get<SessionUser & { organizations: { type: string }[] }>('/users/me');
    set({ user: me });
  },

  signup: async (email, password, name, orgName) => {
    const data = await post<{ accessToken: string }>('/auth/signup', { email, password, name, orgName });
    setAccessToken(data.accessToken);
    const me = await get<SessionUser>('/users/me');
    set({ user: me });
  },

  logout: async () => {
    await post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    set({ user: null });
  },

  loadSession: async () => {
    set({ loading: true });
    try {
      const data = await post<{ accessToken: string }>('/auth/refresh');
      setAccessToken(data.accessToken);
      const me = await get<SessionUser>('/users/me');
      set({ user: me });
    } catch {
      setAccessToken(null);
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },
}));

export const isInternal = (user: SessionUser | null) =>
  user !== null && INTERNAL_ROLES.includes(user.role);
