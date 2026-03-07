/**
 * cTrader Connection Service
 *
 * CRUD for cTrader connection profiles (OAuth-based).
 * Used by BrokerConnectionResolver for CTRADER broker type.
 */

import { dbService } from './database.js';

export interface CTraderConnectionProfile {
  id?: number;
  name: string;
  description?: string;
  account_mode: 'live' | 'paper';
  client_id: string;
  client_secret_encrypted?: string;
  redirect_uri?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
  ctrader_account_id?: number;
  is_active: boolean;
  is_default: boolean;
  last_connected_at?: Date;
  last_error?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

class CTraderConnectionService {
  async getAllProfiles(): Promise<CTraderConnectionProfile[]> {
    const result = await dbService.query(
      `SELECT * FROM ctrader_connection_profiles ORDER BY is_default DESC, name ASC`
    );
    return result.rows;
  }

  async getProfileById(id: number): Promise<CTraderConnectionProfile | null> {
    const result = await dbService.query(
      'SELECT * FROM ctrader_connection_profiles WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getActiveProfile(): Promise<CTraderConnectionProfile | null> {
    const result = await dbService.query(
      'SELECT * FROM ctrader_connection_profiles WHERE is_active = TRUE LIMIT 1'
    );
    return result.rows[0] || null;
  }

  async getDefaultProfile(): Promise<CTraderConnectionProfile | null> {
    const result = await dbService.query(
      'SELECT * FROM ctrader_connection_profiles WHERE is_default = TRUE LIMIT 1'
    );
    return result.rows[0] || null;
  }

  async createProfile(
    profile: Omit<CTraderConnectionProfile, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CTraderConnectionProfile> {
    const result = await dbService.query(
      `INSERT INTO ctrader_connection_profiles (
        name, description, account_mode, client_id, client_secret_encrypted,
        redirect_uri, access_token, refresh_token, token_expires_at, ctrader_account_id,
        is_active, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        profile.name,
        profile.description ?? null,
        profile.account_mode,
        profile.client_id,
        profile.client_secret_encrypted ?? null,
        profile.redirect_uri ?? null,
        profile.access_token ?? null,
        profile.refresh_token ?? null,
        profile.token_expires_at ?? null,
        profile.ctrader_account_id ?? null,
        profile.is_active ?? false,
        profile.is_default ?? false
      ]
    );
    return result.rows[0];
  }

  async updateProfile(
    id: number,
    updates: Partial<CTraderConnectionProfile>
  ): Promise<CTraderConnectionProfile | null> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      account_mode: 'account_mode',
      client_id: 'client_id',
      client_secret_encrypted: 'client_secret_encrypted',
      redirect_uri: 'redirect_uri',
      access_token: 'access_token',
      refresh_token: 'refresh_token',
      token_expires_at: 'token_expires_at',
      ctrader_account_id: 'ctrader_account_id',
      is_active: 'is_active',
      is_default: 'is_default',
      last_connected_at: 'last_connected_at',
      last_error: 'last_error'
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const col = fieldMap[key];
      if (col !== undefined && (value !== undefined || value === null)) {
        setClauses.push(`${col} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return this.getProfileById(id);

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const result = await dbService.query(
      `UPDATE ctrader_connection_profiles SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async deleteProfile(id: number): Promise<boolean> {
    const result = await dbService.query(
      'DELETE FROM ctrader_connection_profiles WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async setActiveProfile(id: number): Promise<void> {
    await dbService.query(
      'UPDATE ctrader_connection_profiles SET is_active = FALSE WHERE is_active = TRUE'
    );
    await dbService.query(
      'UPDATE ctrader_connection_profiles SET is_active = TRUE WHERE id = $1',
      [id]
    );
  }

  async setDefaultProfile(id: number): Promise<void> {
    await dbService.query(
      'UPDATE ctrader_connection_profiles SET is_default = FALSE WHERE is_default = TRUE'
    );
    await dbService.query(
      'UPDATE ctrader_connection_profiles SET is_default = TRUE WHERE id = $1',
      [id]
    );
  }
}

export const ctraderConnectionService = new CTraderConnectionService();
export default ctraderConnectionService;
