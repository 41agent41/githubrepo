/**
 * Broker Selection Middleware
 *
 * Parses broker type from request (query param or header) for multi-broker support.
 * Used by account and market data routes to route requests through BrokerFactory.
 */

import type { Request, Response, NextFunction } from 'express';
import { BrokerType } from '../types/broker.js';

declare global {
  namespace Express {
    interface Request {
      brokerType?: BrokerType;
    }
  }
}

const VALID_BROKERS: BrokerType[] = ['IB', 'MT5', 'CTRADER'];

/**
 * Get broker type from request.
 * Checks query param `broker`, then header `X-Broker`, then defaults to 'IB'.
 *
 * @param req Express request
 * @returns BrokerType - validated broker type
 */
export function getBrokerFromRequest(req: Request): BrokerType {
  const fromQuery = req.query.broker;
  const fromHeader = req.headers['x-broker'];

  const raw =
    (typeof fromQuery === 'string' ? fromQuery : Array.isArray(fromQuery) ? fromQuery[0] : undefined) ??
    (typeof fromHeader === 'string' ? fromHeader : Array.isArray(fromHeader) ? fromHeader[0] : undefined);

  const normalized = raw?.toUpperCase()?.trim();
  if (normalized && VALID_BROKERS.includes(normalized as BrokerType)) {
    return normalized as BrokerType;
  }

  return 'IB';
}

/**
 * Express middleware that attaches req.brokerType from query/header.
 * Apply to routes that need broker selection (e.g. account, market-data).
 */
export function brokerSelectionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.brokerType = getBrokerFromRequest(req);
  next();
}
