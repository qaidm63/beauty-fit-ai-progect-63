import { api } from '../lib/httpClient';

export interface EnvVariable {
  key: string;
  value: string;
  description: string;
}

export interface EnvConfig {
  backend_vars: Record<string, EnvVariable>;
  frontend_vars: Record<string, EnvVariable>;
}

export interface EnvVariableUpdate {
  value: string;
}

async function settingsError(err: unknown, fallback: string): Promise<never> {
  const message = err instanceof Error ? err.message : fallback;
  throw new Error(message || fallback);
}

export const settingsApi = {
  // Fetch all configurations
  async getConfig(): Promise<EnvConfig> {
    try {
      return await api.get<EnvConfig>('/api/v1/admin/settings/');
    } catch (err) {
      return settingsError(err, 'Failed to fetch configuration');
    }
  },

  // Update backend configuration
  async updateBackendConfig(
    key: string,
    value: string
  ): Promise<{ message: string }> {
    try {
      return await api.put<{ message: string }>(
        `/api/v1/admin/settings/backend/${key}`,
        { value }
      );
    } catch (err) {
      return settingsError(err, 'Failed to update backend configuration');
    }
  },

  // Update frontend configuration
  async updateFrontendConfig(
    key: string,
    value: string
  ): Promise<{ message: string }> {
    try {
      return await api.put<{ message: string }>(
        `/api/v1/admin/settings/frontend/${key}`,
        { value }
      );
    } catch (err) {
      return settingsError(err, 'Failed to update frontend configuration');
    }
  },

  // Add backend configuration
  async addBackendConfig(
    key: string,
    value: string
  ): Promise<{ message: string }> {
    try {
      return await api.post<{ message: string }>(
        `/api/v1/admin/settings/backend/${key}`,
        { value }
      );
    } catch (err) {
      return settingsError(err, 'Failed to add backend configuration');
    }
  },

  // Add frontend configuration
  async addFrontendConfig(
    key: string,
    value: string
  ): Promise<{ message: string }> {
    try {
      return await api.post<{ message: string }>(
        `/api/v1/admin/settings/frontend/${key}`,
        { value }
      );
    } catch (err) {
      return settingsError(err, 'Failed to add frontend configuration');
    }
  },

  // Delete backend configuration
  async deleteBackendConfig(key: string): Promise<{ message: string }> {
    try {
      return await api.delete<{ message: string }>(
        `/api/v1/admin/settings/backend/${key}`
      );
    } catch (err) {
      return settingsError(err, 'Failed to delete backend configuration');
    }
  },

  // Delete frontend configuration
  async deleteFrontendConfig(key: string): Promise<{ message: string }> {
    try {
      return await api.delete<{ message: string }>(
        `/api/v1/admin/settings/frontend/${key}`
      );
    } catch (err) {
      return settingsError(err, 'Failed to delete frontend configuration');
    }
  },
};