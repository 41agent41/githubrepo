import { dbService } from './database.js';
import { marketDataService } from './marketDataService.js';

interface CreateSetupParams {
  symbol: string;
  contractId?: string;
  timeframes: string[];
  indicators: string[];
  strategies: string[];
  secType: string;
  exchange: string;
  currency: string;
}

interface TradingSetup {
  id: number;
  symbol: string;
  contractId: number | null;
  timeframes: string[];
  indicators: string[];
  strategies: string[];
  port: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Port pool management
const PORT_POOL_START = 3001;
const PORT_POOL_END = 3100;
const allocatedPorts = new Set<number>();

async function allocatePort(): Promise<number> {
  // Get all ports currently in use from database
  const query = 'SELECT port FROM trading_setups WHERE port IS NOT NULL';
  const result = await dbService.query(query);
  const usedPorts = new Set(result.rows.map(row => row.port));
  
  // Find first available port
  for (let port = PORT_POOL_START; port <= PORT_POOL_END; port++) {
    if (!usedPorts.has(port) && !allocatedPorts.has(port)) {
      allocatedPorts.add(port);
      return port;
    }
  }
  throw new Error('No available ports in pool');
}

function releasePort(port: number): void {
  allocatedPorts.delete(port);
}

export const tradingSetupService = {
  async createSetup(params: CreateSetupParams): Promise<TradingSetup> {
    try {
      // Get or create contract
      const contractId = await marketDataService.getOrCreateContract({
        symbol: params.symbol,
        secType: params.secType,
        exchange: params.exchange,
        currency: params.currency,
        contractId: params.contractId ? parseInt(params.contractId) : undefined
      });

      // Allocate port
      const port = await allocatePort();

      // Create trading setup record
      const query = `
        INSERT INTO trading_setups (
          symbol, contract_id, timeframes, indicators, strategies, port, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, symbol, contract_id, timeframes, indicators, strategies, port, status, created_at, updated_at
      `;

      const result = await dbService.query(query, [
        params.symbol,
        contractId,
        params.timeframes,
        params.indicators,
        params.strategies,
        port,
        'active'
      ]);

      const row = result.rows[0];

      return {
        id: row.id,
        symbol: row.symbol,
        contractId: row.contract_id,
        timeframes: row.timeframes,
        indicators: row.indicators,
        strategies: row.strategies,
        port: row.port,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

    } catch (error) {
      console.error('Error creating trading setup:', error);
      throw error;
    }
  },

  async getSetup(setupId: number): Promise<TradingSetup | null> {
    try {
      const query = `
        SELECT id, symbol, contract_id, timeframes, indicators, strategies, port, status, created_at, updated_at
        FROM trading_setups
        WHERE id = $1
      `;

      const result = await dbService.query(query, [setupId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        id: row.id,
        symbol: row.symbol,
        contractId: row.contract_id,
        timeframes: row.timeframes,
        indicators: row.indicators,
        strategies: row.strategies,
        port: row.port,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

    } catch (error) {
      console.error('Error getting trading setup:', error);
      throw error;
    }
  },

  async listSetups(status?: string): Promise<TradingSetup[]> {
    try {
      let query = `
        SELECT id, symbol, contract_id, timeframes, indicators, strategies, port, status, created_at, updated_at
        FROM trading_setups
      `;
      const params: any[] = [];

      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC';

      const result = await dbService.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        contractId: row.contract_id,
        timeframes: row.timeframes,
        indicators: row.indicators,
        strategies: row.strategies,
        port: row.port,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

    } catch (error) {
      console.error('Error listing trading setups:', error);
      throw error;
    }
  },

  async updateSetup(setupId: number, updates: {
    timeframes?: string[];
    indicators?: string[];
    strategies?: string[];
    status?: string;
  }): Promise<TradingSetup | null> {
    try {
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.timeframes !== undefined) {
        updateFields.push(`timeframes = $${paramIndex}`);
        params.push(updates.timeframes);
        paramIndex++;
      }

      if (updates.indicators !== undefined) {
        updateFields.push(`indicators = $${paramIndex}`);
        params.push(updates.indicators);
        paramIndex++;
      }

      if (updates.strategies !== undefined) {
        updateFields.push(`strategies = $${paramIndex}`);
        params.push(updates.strategies);
        paramIndex++;
      }

      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramIndex}`);
        params.push(updates.status);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return this.getSetup(setupId);
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(setupId);

      const query = `
        UPDATE trading_setups
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, symbol, contract_id, timeframes, indicators, strategies, port, status, created_at, updated_at
      `;

      const result = await dbService.query(query, params);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        id: row.id,
        symbol: row.symbol,
        contractId: row.contract_id,
        timeframes: row.timeframes,
        indicators: row.indicators,
        strategies: row.strategies,
        port: row.port,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

    } catch (error) {
      console.error('Error updating trading setup:', error);
      throw error;
    }
  },

  async deleteSetup(setupId: number): Promise<boolean> {
    try {
      // Get setup to release port
      const setup = await this.getSetup(setupId);
      if (setup) {
        releasePort(setup.port);
      }

      const query = `
        DELETE FROM trading_setups
        WHERE id = $1
        RETURNING id
      `;

      const result = await dbService.query(query, [setupId]);

      return result.rows.length > 0;

    } catch (error) {
      console.error('Error deleting trading setup:', error);
      throw error;
    }
  }
};

