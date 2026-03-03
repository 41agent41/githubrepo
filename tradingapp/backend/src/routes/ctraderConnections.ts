/**
 * cTrader Connection Routes
 *
 * API for managing cTrader OAuth connection profiles.
 */

import express from 'express';
import type { Request, Response } from 'express';
import { ctraderConnectionService } from '../services/ctraderConnectionService.js';

const router = express.Router();

// Get all cTrader profiles
router.get('/profiles', async (req: Request, res: Response) => {
  try {
    const profiles = await ctraderConnectionService.getAllProfiles();
    res.json({
      profiles,
      count: profiles.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching cTrader profiles:', error);
    res.status(500).json({
      error: 'Failed to fetch cTrader connection profiles',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get profile by ID
router.get('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile ID' });

    const profile = await ctraderConnectionService.getProfileById(id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    res.json({ profile, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Error fetching cTrader profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Create profile
router.post('/profiles', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      account_mode,
      client_id,
      client_secret_encrypted,
      redirect_uri,
      is_active,
      is_default
    } = req.body;

    if (!name || !account_mode || !client_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'account_mode', 'client_id'],
        received: { name, account_mode, client_id }
      });
    }

    const profile = await ctraderConnectionService.createProfile({
      name,
      description: description || undefined,
      account_mode: account_mode === 'live' ? 'live' : 'paper',
      client_id,
      client_secret_encrypted: client_secret_encrypted || undefined,
      redirect_uri: redirect_uri || undefined,
      is_active: !!is_active,
      is_default: !!is_default
    });

    res.status(201).json({
      profile,
      message: 'Profile created. Complete OAuth flow to obtain access tokens.',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error creating cTrader profile:', error);
    res.status(500).json({
      error: 'Failed to create profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update profile
router.put('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile ID' });

    const profile = await ctraderConnectionService.updateProfile(id, req.body);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    res.json({
      profile,
      message: 'Profile updated',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error updating cTrader profile:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Delete profile
router.delete('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile ID' });

    const deleted = await ctraderConnectionService.deleteProfile(id);
    if (!deleted) return res.status(404).json({ error: 'Profile not found' });

    res.json({
      message: 'Profile deleted',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error deleting cTrader profile:', error);
    res.status(500).json({
      error: 'Failed to delete profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Set active profile
router.post('/profiles/:id/activate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile ID' });

    await ctraderConnectionService.setActiveProfile(id);
    const profile = await ctraderConnectionService.getProfileById(id);

    res.json({
      message: 'Profile activated',
      profile,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error activating cTrader profile:', error);
    res.status(500).json({
      error: 'Failed to activate profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Set default profile
router.post('/profiles/:id/set-default', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile ID' });

    await ctraderConnectionService.setDefaultProfile(id);
    const profile = await ctraderConnectionService.getProfileById(id);

    res.json({
      message: 'Default profile set',
      profile,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error setting default cTrader profile:', error);
    res.status(500).json({
      error: 'Failed to set default profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get connection status (via broker-connections for consistency)
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { brokerConnectionResolver } = await import('../services/brokerConnectionResolver.js');
    const status = await brokerConnectionResolver.getConnectionStatus('CTRADER');
    res.json({
      connected: status?.connected ?? false,
      profile: status ? { id: status.profileId, name: status.profileName } : null,
      ctrader: status?.details ?? {},
      last_check: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching cTrader status:', error);
    res.status(500).json({
      error: 'Failed to fetch connection status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
