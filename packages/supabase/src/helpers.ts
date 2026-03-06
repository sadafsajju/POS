/**
 * Response helpers for wrapping Supabase PostgREST results
 * into the existing ApiResponse<T> format used by the frontend.
 */

import type { PostgrestError } from '@supabase/supabase-js'

export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  error?: string
  meta?: {
    pagination?: {
      page: number
      per_page: number
      total: number
      total_pages: number
    }
  }
}

/**
 * Wrap a Supabase PostgREST single-row result into ApiResponse
 */
export function wrapOne<T>(
  data: T | null,
  error: PostgrestError | null,
  entityName = 'Record'
): ApiResponse<T> {
  if (error) {
    return {
      success: false,
      message: error.message,
      error: error.code,
    }
  }
  if (!data) {
    return {
      success: false,
      message: `${entityName} not found`,
      error: 'NOT_FOUND',
    }
  }
  return {
    success: true,
    message: 'Success',
    data,
  }
}

/**
 * Wrap a Supabase PostgREST array result into ApiResponse
 */
export function wrapMany<T>(
  data: T[] | null,
  error: PostgrestError | null,
  count?: number | null,
  page?: number,
  perPage?: number
): ApiResponse<T[]> {
  if (error) {
    return {
      success: false,
      message: error.message,
      error: error.code,
    }
  }
  const result: ApiResponse<T[]> = {
    success: true,
    message: 'Success',
    data: data ?? [],
  }
  if (count != null && page != null && perPage != null) {
    result.meta = {
      pagination: {
        page,
        per_page: perPage,
        total: count,
        total_pages: Math.ceil(count / perPage),
      },
    }
  }
  return result
}

/**
 * Wrap a Supabase RPC result into ApiResponse
 */
export function wrapRpc<T>(
  data: T | null,
  error: PostgrestError | null
): ApiResponse<T> {
  if (error) {
    return {
      success: false,
      message: error.message,
      error: error.code,
    }
  }
  return {
    success: true,
    message: 'Success',
    data: data as T,
  }
}

/**
 * Helper to calculate pagination range for Supabase .range()
 */
export function paginationRange(page = 1, perPage = 20): { from: number; to: number } {
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  return { from, to }
}
