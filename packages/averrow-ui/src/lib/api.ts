const API_BASE = '';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
}

class ApiClient {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  setTokens(access: string, refresh: string) {
    this.token = access;
    this.refreshToken = refresh;
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
  }

  getToken() {
    return this.token;
  }

  onAuthError(callback: () => void) {
    this.onUnauthorized = callback;
  }

  async fetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Try refresh
      if (this.refreshToken) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.token}`;
          const retryResponse = await fetch(`${API_BASE}${path}`, { ...options, headers });
          return retryResponse.json() as Promise<ApiResponse<T>>;
        }
      }
      this.onUnauthorized?.();
      throw new Error('Unauthorized');
    }

    return response.json() as Promise<ApiResponse<T>>;
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.fetch<T>(path);
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, { method: 'DELETE' });
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      if (!response.ok) return false;
      const data = await response.json() as { access_token: string; refresh_token: string };
      this.token = data.access_token;
      this.refreshToken = data.refresh_token;
      return true;
    } catch {
      return false;
    }
  }
}

export const api = new ApiClient();
