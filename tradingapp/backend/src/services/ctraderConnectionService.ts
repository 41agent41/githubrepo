/**
 * cTrader Connection Service
 *
 * CRUD for cTrader connection profiles (OAuth-based).
 * Used by BrokerConnectionResolver for CTRADER broker type.
 * C3: Token refresh (on-demand and background).
 */

import axios from 'axios';
import { dbService } from './database.js';
import { getBrokerServiceUrl } from '../config/runtimeConfig.js';

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
    const check = await dbService.query(
      'SELECT id FROM ctrader_connection_profiles WHERE id = $1',
      [id]
    );
    if (!check.rows.length) {
      throw new Error(`Profile ${id} not found`);
    }
    await dbService.query(
      `UPDATE ctrader_connection_profiles
       SET is_active = CASE WHEN id = $1 THEN TRUE ELSE FALSE END,
           updated_at = NOW()
       WHERE is_active = TRUE OR id = $1`,
      [id]
    );
  }

  async setDefaultProfile(id: number): Promise<void> {
    const check = await dbService.query(
      'SELECT id FROM ctrader_connection_profiles WHERE id = $1',
      [id]
    );
    if (!check.rows.length) {
      throw new Error(`Profile ${id} not found`);
    }
    await dbService.query(
      `UPDATE ctrader_connection_profiles
       SET is_default = CASE WHEN id = $1 THEN TRUE ELSE FALSE END,
           updated_at = NOW()
       WHERE is_default = TRUE OR id = $1`,
      [id]
    );
  }

  /**
   * C3: Refresh tokens for a profile. Calls ctrader_service /connection/refresh
   * and updates the profile in DB. Returns updated profile or null on failure.
   */
  async refreshTokens(id: number): Promise<CTraderConnectionProfile | null> {
    const profile = await this.getProfileById(id);
    if (!profile) return null;
    if (!profile.refresh_token || !profile.client_secret_encrypted) {
      return null;
    }

    const ctraderServiceUrl = getBrokerServiceUrl('CTRADER');
    try {
      const response = await axios.post(
        `${ctraderServiceUrl}/connection/refresh`,
        {
          client_id: profile.client_id,
          client_secret: profile.client_secret_encrypted,
          refresh_token: profile.refresh_token
        },
        { timeout: 15000 }
      );

      const data = response.data;
      if (!data?.success || !data.access_token) {
        await this.updateProfile(id, {
          last_error: data?.detail || data?.message || 'Token refresh failed'
        });
        return null;
      }

      const tokenExpiresAt = data.token_expires_at
        ? new Date(data.token_expires_at)
        : undefined;

      await this.updateProfile(id, {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? profile.refresh_token,
        token_expires_at: tokenExpiresAt,
        last_connected_at: new Date(),
        last_error: null
      });

      return this.getProfileById(id);
    } catch (error: any) {
      const message = error.response?.data?.detail || error.response?.data?.message || error.message;
      await this.updateProfile(id, {
        last_error: message
      });
      return null;
    }
  }

  /**
   * C3: Refresh tokens if expired or within bufferMinutes of expiry.
   * Returns updated profile (or original if no refresh needed).
   */
  async refreshTokensIfNeeded(
    profile: CTraderConnectionProfile,
    bufferMinutes: number = 5
  ): Promise<CTraderConnectionProfile> {
    if (!profile.token_expires_at || !profile.refresh_token || !profile.client_secret_encrypted) {
      return profile;
    }

    const bufferMs = bufferMinutes * 60 * 1000;
    const now = Date.now();
    const expiresAt = profile.token_expires_at.getTime();
    if (expiresAt - now > bufferMs) {
      return profile; // Token still valid
    }

    const refreshed = await this.refreshTokens(profile.id!);
    return refreshed ?? profile;
  }
}

export const ctraderConnectionService = new CTraderConnectionService();
export default ctraderConnectionService;
