/**
 * Shared route utilities for account and market data routes.
 * Reduces duplication of isDataQueryEnabled, handleDisabledDataQuery, and error handling.
 */

import type { Request, Response } from 'express';
import { BrokerError } from '../types/broker.js';

export function isDataQueryEnabled(req: Request): boolean {
  const enabled = req.headers['x-data-query-enabled'];
  if (typeof enabled === 'string') {
    return enabled.toLowerCase() === 'true';
  }
  if (Array.isArray(enabled)) {
    return enabled[0]?.toLowerCase() === 'true';
  }
  return false;
}

export function handleDisabledDataQuery(res: Response, message: string): Response {
  return res.status(200).json({
    disabled: true,
    message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Format broker/HTTP errors for API response.
 * Returns { statusCode, errorMessage } for consistent error handling.
 */
export function getBrokerErrorResponse(error: unknown, fallbackMessage: string): {
  statusCode: number;
  errorMessage: string;
} {
  if (error instanceof BrokerError) {
    if (error.code === 'NOT_IMPLEMENTED') {
      return { statusCode: 501, errorMessage: error.message };
    }
    return { statusCode: 500, errorMessage: error.message };
  }

  const err = error as { code?: string; message?: string; response?: { data?: { detail?: string }; status?: number } };
  let errorMessage = fallbackMessage;
  let statusCode = 500;

  if (err.code === 'ECONNREFUSED') {
    errorMessage = 'Broker service connection refused - service may be starting up';
    statusCode = 503;
  } else if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    errorMessage = 'Broker service timeout - service may be busy';
    statusCode = 504;
  } else if (err.response) {
    errorMessage =
      err.response.data?.detail || (err.response.data as { error?: string })?.error || err.message || fallbackMessage;
    statusCode = err.response.status ?? 500;
  } else if (err.message) {
    errorMessage = err.message;
  }

  return { statusCode, errorMessage };
}
