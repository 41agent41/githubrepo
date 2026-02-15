import { dbService } from './database.js';
import { getIBServiceUrl } from '../config/runtimeConfig.js';
import axios from 'axios';

// IB Connection Profile interface
export interface IBConnectionProfile {
  id?: number;
  name: string;
  description?: string;
  connection_type: 'gateway' | 'tws';
  account_mode: 'live' | 'paper';
  host: string;
  port: number;
  client_id: number;
  timeout_seconds: number;
  auto_reconnect: boolean;
  max_retry_attempts: number;
  keep_alive_interval_minutes: number;
  timezone: string;
  date_format: string;
  time_format: string;
  is_active: boolean;
  is_default: boolean;
  last_connected_at?: Date;
  last_error?: string;
  connection_count: number;
  created_at?: Date;
  updated_at?: Date;
}

// Connection event types
export type ConnectionEventType = 
  | 'connect_attempt'
  | 'connect_success'
  | 'connect_failure'
  | 'disconnect'
  | 'reconnect'
  | 'timeout'
  | 'error'
  | 'keep_alive'
  | 'keep_alive_reconnect';

// Connection history entry
export interface ConnectionHistoryEntry {
  id?: number;
  profile_id: number;
  event_type: ConnectionEventType;
  details?: Record<string, any>;
  error_message?: string;
  error_code?: number;
  event_timestamp?: Date;
  duration_ms?: number;
}

// Connection status response
export interface ConnectionStatus {
  connected: boolean;
  profile: IBConnectionProfile | null;
  ib_gateway: {
    connected: boolean;
    host: string;
    port: number;
    client_id: number;
    account_mode: string;
    last_error?: string;
  } | null;
  last_check: string;
}

class IBConnectionService {
  private currentProfileId: number | null = null;
  
  // Get the IB service URL based on active profile or default
  getIBServiceUrl(): string {
    return getIBServiceUrl();
  }

  // Get all connection profiles
  async getAllProfiles(): Promise<IBConnectionProfile[]> {
    const result = await dbService.query(`
      SELECT * FROM ib_connection_profiles 
      ORDER BY is_default DESC, name ASC
    `);
    return result.rows;
  }

  // Get a specific profile by ID
  async getProfileById(id: number): Promise<IBConnectionProfile | null> {
    const result = await dbService.query(
      'SELECT * FROM ib_connection_profiles WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // Get the active profile
  async getActiveProfile(): Promise<IBConnectionProfile | null> {
    const result = await dbService.query(
      'SELECT * FROM ib_connection_profiles WHERE is_active = TRUE LIMIT 1'
    );
    return result.rows[0] || null;
  }

  // Get the default profile
  async getDefaultProfile(): Promise<IBConnectionProfile | null> {
    const result = await dbService.query(
      'SELECT * FROM ib_connection_profiles WHERE is_default = TRUE LIMIT 1'
    );
    return result.rows[0] || null;
  }

  // Create a new profile
  async createProfile(profile: Omit<IBConnectionProfile, 'id' | 'created_at' | 'updated_at' | 'connection_count'>): Promise<IBConnectionProfile> {
    const result = await dbService.query(`
      INSERT INTO ib_connection_profiles (
        name, description, connection_type, account_mode, host, port, client_id,
        timeout_seconds, auto_reconnect, max_retry_attempts, keep_alive_interval_minutes,
        timezone, date_format, time_format, is_active, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      profile.name,
      profile.description || null,
      profile.connection_type,
      profile.account_mode,
      profile.host,
      profile.port,
      profile.client_id,
      profile.timeout_seconds || 15,
      profile.auto_reconnect !== false,
      profile.max_retry_attempts || 3,
      profile.keep_alive_interval_minutes ?? 15,
      profile.timezone || 'UTC',
      profile.date_format || 'YYYYMMDD',
      profile.time_format || 'HHMMSS',
      profile.is_active || false,
      profile.is_default || false
    ]);
    return result.rows[0];
  }

  // Update a profile
  async updateProfile(id: number, updates: Partial<IBConnectionProfile>): Promise<IBConnectionProfile | null> {
    const allowedFields = [
      'name', 'description', 'connection_type', 'account_mode', 'host', 'port',
      'client_id', 'timeout_seconds', 'auto_reconnect', 'max_retry_attempts',
      'keep_alive_interval_minutes', 'timezone', 'date_format', 'time_format', 
      'is_active', 'is_default'
    ];

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (field in updates) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push((updates as any)[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return this.getProfileById(id);
    }

    values.push(id);
    const result = await dbService.query(`
      UPDATE ib_connection_profiles 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    return result.rows[0] || null;
  }

  // Delete a profile
  async deleteProfile(id: number): Promise<boolean> {
    // Don't allow deleting the default profile
    const profile = await this.getProfileById(id);
    if (profile?.is_default) {
      throw new Error('Cannot delete the default profile');
    }
    
    // If deleting active profile, deactivate first
    if (profile?.is_active) {
      await this.deactivateProfile(id);
    }

    const result = await dbService.query(
      'DELETE FROM ib_connection_profiles WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // Activate a profile (connects to it)
  async activateProfile(id: number): Promise<IBConnectionProfile | null> {
    // First, deactivate any currently active profile
    await dbService.query(
      'UPDATE ib_connection_profiles SET is_active = FALSE WHERE is_active = TRUE'
    );

    // Activate the new profile
    const result = await dbService.query(`
      UPDATE ib_connection_profiles 
      SET is_active = TRUE
      WHERE id = $1
      RETURNING *
    `, [id]);

    const profile = result.rows[0];
    if (profile) {
      this.currentProfileId = id;
      
      // Log the activation attempt
      await this.logConnectionEvent(id, 'connect_attempt', {
        host: profile.host,
        port: profile.port,
        client_id: profile.client_id
      });

      // Try to connect via IB service
      try {
        await this.connectToIBService(profile);
        
        // Update last connected timestamp
        await dbService.query(`
          UPDATE ib_connection_profiles 
          SET last_connected_at = NOW(), 
              last_error = NULL,
              connection_count = connection_count + 1
          WHERE id = $1
        `, [id]);

        await this.logConnectionEvent(id, 'connect_success');
      } catch (error: any) {
        // Update with error
        await dbService.query(`
          UPDATE ib_connection_profiles 
          SET last_error = $1
          WHERE id = $2
        `, [error.message, id]);

        await this.logConnectionEvent(id, 'connect_failure', undefined, error.message);
      }
    }

    return profile;
  }

  // Deactivate a profile (disconnects)
  async deactivateProfile(id: number): Promise<boolean> {
    const result = await dbService.query(`
      UPDATE ib_connection_profiles 
      SET is_active = FALSE
      WHERE id = $1
    `, [id]);

    if ((result.rowCount ?? 0) > 0) {
      this.currentProfileId = null;
      await this.logConnectionEvent(id, 'disconnect');
      
      // Disconnect via IB service
      try {
        await this.disconnectFromIBService();
      } catch (error) {
        console.error('Error disconnecting from IB service:', error);
      }
    }

    return (result.rowCount ?? 0) > 0;
  }

  // Set a profile as default
  async setDefaultProfile(id: number): Promise<boolean> {
    // Remove default from all profiles
    await dbService.query(
      'UPDATE ib_connection_profiles SET is_default = FALSE WHERE is_default = TRUE'
    );

    // Set the new default
    const result = await dbService.query(
      'UPDATE ib_connection_profiles SET is_default = TRUE WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Connect to IB service with profile settings
  async connectToIBService(profile: IBConnectionProfile): Promise<any> {
    const ibServiceUrl = this.getIBServiceUrl();
    
    const response = await axios.post(`${ibServiceUrl}/connection/connect`, {
      host: profile.host,
      port: profile.port,
      client_id: profile.client_id,
      timeout: profile.timeout_seconds,
      connection_type: profile.connection_type,
      account_mode: profile.account_mode
    }, {
      timeout: (profile.timeout_seconds + 10) * 1000 // Add buffer to timeout
    });

    return response.data;
  }

  // Disconnect from IB service
  async disconnectFromIBService(): Promise<any> {
    const ibServiceUrl = this.getIBServiceUrl();
    
    const response = await axios.post(`${ibServiceUrl}/connection/disconnect`, {}, {
      timeout: 10000
    });

    return response.data;
  }

  // Get current connection status
  async getConnectionStatus(): Promise<ConnectionStatus> {
    const activeProfile = await this.getActiveProfile();
    const ibServiceUrl = this.getIBServiceUrl();
    
    let ibStatus = null;
    let connected = false;

    try {
      const response = await axios.get(`${ibServiceUrl}/health`, {
        timeout: 5000
      });
      
      connected = response.data?.connection?.ib_gateway?.connected || false;
      ibStatus = {
        connected: connected,
        host: response.data?.connection?.ib_gateway?.host || 'unknown',
        port: response.data?.connection?.ib_gateway?.port || 0,
        client_id: response.data?.connection?.ib_gateway?.client_id || 0,
        account_mode: response.data?.connection?.ib_gateway?.account_mode || 'unknown',
        last_error: response.data?.connection?.ib_gateway?.last_error
      };
    } catch (error: any) {
      ibStatus = {
        connected: false,
        host: activeProfile?.host || 'unknown',
        port: activeProfile?.port || 0,
        client_id: activeProfile?.client_id || 0,
        account_mode: activeProfile?.account_mode || 'unknown',
        last_error: error.message
      };
    }

    return {
      connected: connected,
      profile: activeProfile,
      ib_gateway: ibStatus,
      last_check: new Date().toISOString()
    };
  }

  // Test a connection profile without activating it
  async testConnection(profile: IBConnectionProfile): Promise<{ success: boolean; message: string; details?: any }> {
    const ibServiceUrl = this.getIBServiceUrl();
    
    try {
      const response = await axios.post(`${ibServiceUrl}/connection/test`, {
        host: profile.host,
        port: profile.port,
        client_id: profile.client_id + 100, // Use different client ID for testing
        timeout: profile.timeout_seconds,
        connection_type: profile.connection_type,
        account_mode: profile.account_mode
      }, {
        timeout: (profile.timeout_seconds + 10) * 1000
      });

      return {
        success: response.data?.success || false,
        message: response.data?.message || 'Connection test completed',
        details: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Connection test failed',
        details: { error: error.message }
      };
    }
  }

  // Log a connection event
  async logConnectionEvent(
    profileId: number, 
    eventType: ConnectionEventType, 
    details?: Record<string, any>,
    errorMessage?: string,
    errorCode?: number,
    durationMs?: number
  ): Promise<void> {
    try {
      await dbService.query(`
        INSERT INTO ib_connection_history (
          profile_id, event_type, details, error_message, error_code, duration_ms
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        profileId,
        eventType,
        details ? JSON.stringify(details) : null,
        errorMessage || null,
        errorCode || null,
        durationMs || null
      ]);
    } catch (error) {
      console.error('Failed to log connection event:', error);
    }
  }

  // Get connection history for a profile
  async getConnectionHistory(profileId: number, limit: number = 100): Promise<ConnectionHistoryEntry[]> {
    const result = await dbService.query(`
      SELECT * FROM ib_connection_history 
      WHERE profile_id = $1 
      ORDER BY event_timestamp DESC 
      LIMIT $2
    `, [profileId, limit]);
    return result.rows;
  }

  // Get connection statistics
  async getConnectionStats(profileId?: number): Promise<any[]> {
    let query = 'SELECT * FROM v_ib_connection_stats';
    const params: any[] = [];
    
    if (profileId) {
      query += ' WHERE id = $1';
      params.push(profileId);
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await dbService.query(query, params);
    return result.rows;
  }

  // Clear connection history for a profile
  async clearConnectionHistory(profileId: number): Promise<number> {
    const result = await dbService.query(
      'DELETE FROM ib_connection_history WHERE profile_id = $1',
      [profileId]
    );
    return result.rowCount ?? 0;
  }

  // Keep-alive: Check and maintain connection health
  async performKeepAlive(): Promise<{
    checked: boolean;
    wasConnected: boolean;
    isConnected: boolean;
    reconnectAttempted: boolean;
    reconnectSucceeded: boolean;
    profile: IBConnectionProfile | null;
    message: string;
  }> {
    const result = {
      checked: false,
      wasConnected: false,
      isConnected: false,
      reconnectAttempted: false,
      reconnectSucceeded: false,
      profile: null as IBConnectionProfile | null,
      message: ''
    };

    try {
      // Get active profile
      const activeProfile = await this.getActiveProfile();
      
      if (!activeProfile) {
        result.message = 'No active profile to keep alive';
        return result;
      }

      result.profile = activeProfile;
      result.checked = true;

      // Check if keep-alive is enabled for this profile
      if (activeProfile.keep_alive_interval_minutes <= 0) {
        result.message = 'Keep-alive disabled for this profile';
        return result;
      }

      // Get current connection status
      const status = await this.getConnectionStatus();
      result.wasConnected = status.connected;
      result.isConnected = status.connected;

      if (status.connected) {
        // Connection is healthy, log keep-alive success
        await this.logConnectionEvent(activeProfile.id!, 'keep_alive', {
          status: 'healthy',
          host: status.ib_gateway?.host,
          port: status.ib_gateway?.port
        });
        result.message = 'Connection is healthy';
        return result;
      }

      // Connection is down - check if auto_reconnect is enabled
      if (!activeProfile.auto_reconnect) {
        await this.logConnectionEvent(activeProfile.id!, 'keep_alive', {
          status: 'disconnected',
          auto_reconnect: false
        });
        result.message = 'Connection is down, auto-reconnect disabled';
        return result;
      }

      // Attempt to reconnect
      console.log(`[Keep-Alive] Connection lost, attempting reconnect for profile: ${activeProfile.name}`);
      result.reconnectAttempted = true;

      await this.logConnectionEvent(activeProfile.id!, 'keep_alive_reconnect', {
        status: 'reconnect_attempt',
        reason: 'connection_lost'
      });

      try {
        await this.connectToIBService(activeProfile);
        
        // Update last connected timestamp
        await dbService.query(`
          UPDATE ib_connection_profiles 
          SET last_connected_at = NOW(), 
              last_error = NULL,
              connection_count = connection_count + 1
          WHERE id = $1
        `, [activeProfile.id]);

        await this.logConnectionEvent(activeProfile.id!, 'reconnect', {
          status: 'success',
          triggered_by: 'keep_alive'
        });

        result.reconnectSucceeded = true;
        result.isConnected = true;
        result.message = 'Successfully reconnected';
        console.log(`[Keep-Alive] Reconnect successful for profile: ${activeProfile.name}`);
      } catch (reconnectError: any) {
        // Update with error
        await dbService.query(`
          UPDATE ib_connection_profiles 
          SET last_error = $1
          WHERE id = $2
        `, [reconnectError.message, activeProfile.id]);

        await this.logConnectionEvent(
          activeProfile.id!, 
          'connect_failure', 
          { triggered_by: 'keep_alive' },
          reconnectError.message
        );

        result.message = `Reconnect failed: ${reconnectError.message}`;
        console.error(`[Keep-Alive] Reconnect failed for profile ${activeProfile.name}:`, reconnectError.message);
      }

      return result;
    } catch (error: any) {
      result.message = `Keep-alive error: ${error.message}`;
      console.error('[Keep-Alive] Error:', error);
      return result;
    }
  }

  // Get the keep-alive interval for the active profile (in milliseconds)
  async getKeepAliveIntervalMs(): Promise<number> {
    const activeProfile = await this.getActiveProfile();
    if (!activeProfile || activeProfile.keep_alive_interval_minutes <= 0) {
      return 0; // Disabled
    }
    return activeProfile.keep_alive_interval_minutes * 60 * 1000;
  }
}

// Export singleton instance
export const ibConnectionService = new IBConnectionService();
export default ibConnectionService;

