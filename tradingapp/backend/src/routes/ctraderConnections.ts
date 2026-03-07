/**
 * cTrader Connection Routes
 *
 * API for managing cTrader OAuth connection profiles.
 * C2: OAuth callback endpoint exchanges auth code for tokens and persists to profile.
 */

import express from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
import { ctraderConnectionService } from '../services/ctraderConnectionService.js';
import { getBrokerServiceUrl } from '../config/runtimeConfig.js';

const router = express.Router();

/** Omit client_secret_encrypted from profile when sending to client */
function toSafeProfile<T extends { client_secret_encrypted?: string | null }>(p: T): Omit<T, 'client_secret_encrypted'> {
  const { client_secret_encrypted: _, ...rest } = p;
  return rest;
}

// Get all cTrader profiles (client_secret_encrypted omitted)
router.get('/profiles', async (req: Request, res: Response) => {
  try {
    const profiles = await ctraderConnectionService.getAllProfiles();
    res.json({
      profiles: profiles.map(toSafeProfile),
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

    res.json({ profile: toSafeProfile(profile), timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Error fetching cTrader profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Create profile (accepts client_secret; stored in client_secret_encrypted)
router.post('/profiles', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      account_mode,
      client_id,
      client_secret,
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

    const secretToStore = client_secret ?? client_secret_encrypted ?? undefined;

    const profile = await ctraderConnectionService.createProfile({
      name,
      description: description || undefined,
      account_mode: account_mode === 'live' ? 'live' : 'paper',
      client_id,
      client_secret_encrypted: secretToStore || undefined,
      redirect_uri: redirect_uri || undefined,
      is_active: !!is_active,
      is_default: !!is_default
    });

    res.status(201).json({
      profile: toSafeProfile(profile),
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

// Update profile (accepts client_secret; only update client_secret_encrypted if provided)
router.put('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile ID' });

    const body = { ...req.body };
    if (body.client_secret !== undefined) {
      body.client_secret_encrypted = body.client_secret;
      delete body.client_secret;
    }
    const profile = await ctraderConnectionService.updateProfile(id, body);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    res.json({
      profile: toSafeProfile(profile),
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
      profile: profile ? toSafeProfile(profile) : undefined,
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
      profile: profile ? toSafeProfile(profile) : undefined,
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

// C2: OAuth callback – exchange authorization code for tokens and persist to profile
router.post('/profiles/:id/oauth-callback', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile ID' });

    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid authorization code' });
    }

    const profile = await ctraderConnectionService.getProfileById(id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const clientSecret = profile.client_secret_encrypted;
    const redirectUri = profile.redirect_uri?.trim();
    if (!clientSecret) {
      return res.status(400).json({
        error: 'Profile has no client secret. Add Client Secret in the profile (edit) and try again.'
      });
    }
    if (!redirectUri) {
      return res.status(400).json({
        error: 'Profile has no redirect URI. Set Redirect URI to your callback URL (e.g. http://localhost:3000/connections/ctrader/callback).'
      });
    }

    const ctraderServiceUrl = getBrokerServiceUrl('CTRADER');
    const response = await axios.post(
      `${ctraderServiceUrl}/connection/connect`,
      {
        client_id: profile.client_id,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        auth_code: code,
        account_mode: profile.account_mode || 'paper'
      },
      { timeout: 15000 }
    );

    const data = response.data;
    if (!data?.success || !data.access_token) {
      return res.status(400).json({
        error: data?.detail || data?.message || 'Token exchange failed',
        detail: data
      });
    }

    const tokenExpiresAt = data.token_expires_at
      ? new Date(data.token_expires_at)
      : undefined;

    await ctraderConnectionService.updateProfile(id, {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? undefined,
      token_expires_at: tokenExpiresAt,
      last_connected_at: new Date(),
      last_error: null
    });

    const updated = await ctraderConnectionService.getProfileById(id);
    res.json({
      success: true,
      message: 'Connected. Tokens stored.',
      profile: updated ? toSafeProfile(updated) : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
    console.error('cTrader OAuth callback error:', detail, error.response?.data);
    res.status(status && status >= 400 && status < 600 ? status : 500).json({
      error: 'OAuth callback failed',
      message: detail,
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
