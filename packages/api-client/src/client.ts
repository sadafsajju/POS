import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@pos/types';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  getToken?: () => string | null;
  asyncGetToken?: () => Promise<string | null>;
  onUnauthorized?: () => void;
}

export class ApiClient {
  private client: AxiosInstance;
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth token (supports both sync and async getToken)
    this.client.interceptors.request.use(
      async (requestConfig: InternalAxiosRequestConfig) => {
        // Try async getToken first (Supabase), then sync getToken (internal JWT)
        let token: string | null = null;
        if (this.config.asyncGetToken) {
          try {
            token = await this.config.asyncGetToken();
          } catch {
            // Fall through to sync getToken
          }
        }
        if (!token && this.config.getToken) {
          token = this.config.getToken();
        }
        if (token) {
          requestConfig.headers.Authorization = `Bearer ${token}`;
        }
        return requestConfig;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.config.onUnauthorized?.();
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: object): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<ApiResponse<T>>(url, { params });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.patch<ApiResponse<T>>(url, data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async postForm<T>(url: string, formData: FormData): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  private handleError<T>(error: unknown): ApiResponse<T> {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiResponse<T>>;
      return {
        success: false,
        error: axiosError.response?.data?.error || axiosError.message,
        message: axiosError.response?.data?.message || 'An error occurred',
      };
    }

    return {
      success: false,
      error: 'Unknown error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }

  setBaseURL(url: string): void {
    this.client.defaults.baseURL = url;
  }
}

// Default client instance (configured at app startup)
let defaultClient: ApiClient | null = null;

export function initApiClient(config: ApiClientConfig): ApiClient {
  defaultClient = new ApiClient(config);
  return defaultClient;
}

export function getApiClient(): ApiClient {
  if (!defaultClient) {
    throw new Error('API client not initialized. Call initApiClient first.');
  }
  return defaultClient;
}
