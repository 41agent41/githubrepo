import express from 'express';
import type { Request, Response } from 'express';
import { ibConnectionService, type IBConnectionProfile } from '../services/ibConnectionService.js';

const router = express.Router();

// Get all connection profiles
router.get('/profiles', async (req: Request, res: Response) => {
  try {
    const profiles = await ibConnectionService.getAllProfiles();
    
    res.json({
      profiles: profiles,
      count: profiles.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching connection profiles:', error);
    res.status(500).json({
      error: 'Failed to fetch connection profiles',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get a specific profile by ID
router.get('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const profile = await ibConnectionService.getProfileById(id);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      profile: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get the currently active profile
router.get('/active', async (req: Request, res: Response) => {
  try {
    const profile = await ibConnectionService.getActiveProfile();
    
    res.json({
      active: profile !== null,
      profile: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching active profile:', error);
    res.status(500).json({
      error: 'Failed to fetch active profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get current connection status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await ibConnectionService.getConnectionStatus();
    
    res.json(status);
  } catch (error: any) {
    console.error('Error fetching connection status:', error);
    res.status(500).json({
      error: 'Failed to fetch connection status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Create a new connection profile
router.post('/profiles', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      connection_type,
      account_mode,
      host,
      port,
      client_id,
      timeout_seconds,
      auto_reconnect,
      max_retry_attempts,
      timezone,
      date_format,
      time_format,
      is_active,
      is_default
    } = req.body;

    // Validate required fields
    if (!name || !connection_type || !account_mode || !host || !port) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'connection_type', 'account_mode', 'host', 'port'],
        received: { name, connection_type, account_mode, host, port }
      });
    }

    // Validate connection_type
    if (!['gateway', 'tws'].includes(connection_type)) {
      return res.status(400).json({
        error: 'Invalid connection_type',
        valid_values: ['gateway', 'tws'],
        received: connection_type
      });
    }

    // Validate account_mode
    if (!['live', 'paper'].includes(account_mode)) {
      return res.status(400).json({
        error: 'Invalid account_mode',
        valid_values: ['live', 'paper'],
        received: account_mode
      });
    }

    // Validate port
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({
        error: 'Invalid port number',
        message: 'Port must be between 1 and 65535',
        received: port
      });
    }

    const profile = await ibConnectionService.createProfile({
      name,
      description,
      connection_type,
      account_mode,
      host,
      port: portNum,
      client_id: client_id || 1,
      timeout_seconds: timeout_seconds || 15,
      auto_reconnect: auto_reconnect !== false,
      max_retry_attempts: max_retry_attempts || 3,
      timezone: timezone || 'UTC',
      date_format: date_format || 'YYYYMMDD',
      time_format: time_format || 'HHMMSS',
      is_active: is_active || false,
      is_default: is_default || false,
      last_error: undefined,
      last_connected_at: undefined
    });

    res.status(201).json({
      message: 'Profile created successfully',
      profile: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error creating profile:', error);
    
    // Check for duplicate name error
    if (error.message?.includes('duplicate') || error.code === '23505') {
      return res.status(409).json({
        error: 'A profile with this name already exists',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to create profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update a connection profile
router.put('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const updates = req.body;

    // Validate connection_type if provided
    if (updates.connection_type && !['gateway', 'tws'].includes(updates.connection_type)) {
      return res.status(400).json({
        error: 'Invalid connection_type',
        valid_values: ['gateway', 'tws'],
        received: updates.connection_type
      });
    }

    // Validate account_mode if provided
    if (updates.account_mode && !['live', 'paper'].includes(updates.account_mode)) {
      return res.status(400).json({
        error: 'Invalid account_mode',
        valid_values: ['live', 'paper'],
        received: updates.account_mode
      });
    }

    // Validate port if provided
    if (updates.port) {
      const portNum = parseInt(updates.port, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return res.status(400).json({
          error: 'Invalid port number',
          message: 'Port must be between 1 and 65535',
          received: updates.port
        });
      }
      updates.port = portNum;
    }

    const profile = await ibConnectionService.updateProfile(id, updates);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      profile: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Delete a connection profile
router.delete('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const deleted = await ibConnectionService.deleteProfile(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      message: 'Profile deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error deleting profile:', error);
    
    if (error.message?.includes('default')) {
      return res.status(400).json({
        error: 'Cannot delete the default profile',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to delete profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Activate a connection profile (connect to it)
router.post('/profiles/:id/activate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const profile = await ibConnectionService.activateProfile(id);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get the updated status
    const status = await ibConnectionService.getConnectionStatus();

    res.json({
      message: 'Profile activated',
      profile: profile,
      connection_status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error activating profile:', error);
    res.status(500).json({
      error: 'Failed to activate profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Deactivate the currently active profile (disconnect)
router.post('/profiles/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const deactivated = await ibConnectionService.deactivateProfile(id);
    
    if (!deactivated) {
      return res.status(404).json({ error: 'Profile not found or not active' });
    }

    res.json({
      message: 'Profile deactivated',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error deactivating profile:', error);
    res.status(500).json({
      error: 'Failed to deactivate profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Set a profile as default
router.post('/profiles/:id/set-default', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const success = await ibConnectionService.setDefaultProfile(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      message: 'Default profile set successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error setting default profile:', error);
    res.status(500).json({
      error: 'Failed to set default profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test a connection profile without activating it
router.post('/profiles/:id/test', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const profile = await ibConnectionService.getProfileById(id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const result = await ibConnectionService.testConnection(profile);

    res.json({
      profile_id: id,
      profile_name: profile.name,
      test_result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      error: 'Failed to test connection',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test connection with custom parameters (without saving)
router.post('/test', async (req: Request, res: Response) => {
  try {
    const {
      host,
      port,
      client_id,
      timeout_seconds,
      connection_type,
      account_mode
    } = req.body;

    // Validate required fields
    if (!host || !port) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['host', 'port'],
        received: { host, port }
      });
    }

    const testProfile: IBConnectionProfile = {
      name: 'Test Connection',
      connection_type: connection_type || 'gateway',
      account_mode: account_mode || 'paper',
      host: host,
      port: parseInt(port, 10),
      client_id: (client_id || 1) + 100, // Use different client ID for testing
      timeout_seconds: timeout_seconds || 15,
      auto_reconnect: false,
      max_retry_attempts: 1,
      timezone: 'UTC',
      date_format: 'YYYYMMDD',
      time_format: 'HHMMSS',
      is_active: false,
      is_default: false,
      connection_count: 0
    };

    const result = await ibConnectionService.testConnection(testProfile);

    res.json({
      test_result: result,
      tested_config: {
        host,
        port,
        client_id: testProfile.client_id,
        connection_type: testProfile.connection_type,
        account_mode: testProfile.account_mode
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      error: 'Failed to test connection',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get connection history for a profile
router.get('/profiles/:id/history', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const limit = parseInt(req.query.limit as string, 10) || 100;
    const history = await ibConnectionService.getConnectionHistory(id, limit);

    res.json({
      profile_id: id,
      history: history,
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching connection history:', error);
    res.status(500).json({
      error: 'Failed to fetch connection history',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get connection statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profile_id ? parseInt(req.query.profile_id as string, 10) : undefined;
    const stats = await ibConnectionService.getConnectionStats(profileId);

    res.json({
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching connection stats:', error);
    res.status(500).json({
      error: 'Failed to fetch connection statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clear connection history for a profile
router.delete('/profiles/:id/history', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const deletedCount = await ibConnectionService.clearConnectionHistory(id);

    res.json({
      message: 'Connection history cleared',
      deleted_count: deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error clearing connection history:', error);
    res.status(500).json({
      error: 'Failed to clear connection history',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Quick connect endpoint - uses default profile if no active connection
router.post('/quick-connect', async (req: Request, res: Response) => {
  try {
    // Check if already connected
    const status = await ibConnectionService.getConnectionStatus();
    if (status.connected) {
      return res.json({
        message: 'Already connected',
        status: status,
        timestamp: new Date().toISOString()
      });
    }

    // Get active profile or default profile
    let profile = await ibConnectionService.getActiveProfile();
    if (!profile) {
      profile = await ibConnectionService.getDefaultProfile();
    }

    if (!profile) {
      return res.status(404).json({
        error: 'No active or default profile found',
        message: 'Please create a connection profile first',
        timestamp: new Date().toISOString()
      });
    }

    // Activate the profile
    await ibConnectionService.activateProfile(profile.id!);

    // Get updated status
    const newStatus = await ibConnectionService.getConnectionStatus();

    res.json({
      message: 'Connection initiated',
      profile: profile,
      status: newStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in quick connect:', error);
    res.status(500).json({
      error: 'Failed to establish connection',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Disconnect endpoint
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const activeProfile = await ibConnectionService.getActiveProfile();
    
    if (!activeProfile) {
      return res.json({
        message: 'No active connection to disconnect',
        timestamp: new Date().toISOString()
      });
    }

    await ibConnectionService.deactivateProfile(activeProfile.id!);

    res.json({
      message: 'Disconnected successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error disconnecting:', error);
    res.status(500).json({
      error: 'Failed to disconnect',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Trigger keep-alive check manually
router.post('/keep-alive', async (req: Request, res: Response) => {
  try {
    const result = await ibConnectionService.performKeepAlive();

    res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error running keep-alive:', error);
    res.status(500).json({
      error: 'Failed to run keep-alive check',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get keep-alive status for active profile
router.get('/keep-alive/status', async (req: Request, res: Response) => {
  try {
    const activeProfile = await ibConnectionService.getActiveProfile();
    
    if (!activeProfile) {
      return res.json({
        enabled: false,
        profile: null,
        interval_minutes: 0,
        message: 'No active profile',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      enabled: activeProfile.keep_alive_interval_minutes > 0,
      profile_id: activeProfile.id,
      profile_name: activeProfile.name,
      interval_minutes: activeProfile.keep_alive_interval_minutes,
      auto_reconnect: activeProfile.auto_reconnect,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error getting keep-alive status:', error);
    res.status(500).json({
      error: 'Failed to get keep-alive status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

