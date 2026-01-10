import express from 'express';
import type { Request, Response } from 'express';
import { systemSettingsService, type SystemSetting } from '../services/systemSettingsService.js';

const router = express.Router();

// Get all setting categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await systemSettingsService.getCategories();
    
    res.json({
      categories,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching setting categories:', error);
    res.status(500).json({
      error: 'Failed to fetch setting categories',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get all settings (grouped by category)
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeSensitive = req.query.include_sensitive === 'true';
    const allSettings = await systemSettingsService.getAllSettings(includeSensitive);
    
    // Group by category
    const grouped: Record<string, SystemSetting[]> = {};
    for (const setting of allSettings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = [];
      }
      grouped[setting.category].push(setting);
    }
    
    res.json({
      settings: grouped,
      total_count: allSettings.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      error: 'Failed to fetch settings',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get settings for a specific category
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const settings = await systemSettingsService.getSettingsByCategory(category);
    
    // Mask sensitive values
    const maskedSettings = settings.map(s => ({
      ...s,
      value: s.is_sensitive ? (s.value ? '********' : '') : s.value
    }));
    
    res.json({
      category,
      settings: maskedSettings,
      count: settings.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching category settings:', error);
    res.status(500).json({
      error: 'Failed to fetch category settings',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get a single setting
router.get('/:category/:key', async (req: Request, res: Response) => {
  try {
    const { category, key } = req.params;
    const value = await systemSettingsService.getSetting(category, key);
    
    res.json({
      category,
      key,
      value,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching setting:', error);
    res.status(500).json({
      error: 'Failed to fetch setting',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update a single setting
router.put('/:category/:key', async (req: Request, res: Response) => {
  try {
    const { category, key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({
        error: 'Missing required field: value',
        timestamp: new Date().toISOString()
      });
    }
    
    const success = await systemSettingsService.updateSetting(category, key, String(value));
    
    if (!success) {
      return res.status(404).json({
        error: 'Setting not found or is readonly',
        category,
        key,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      message: 'Setting updated successfully',
      category,
      key,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error updating setting:', error);
    res.status(500).json({
      error: 'Failed to update setting',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update multiple settings at once
router.put('/', async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    
    if (!Array.isArray(settings)) {
      return res.status(400).json({
        error: 'Settings must be an array',
        timestamp: new Date().toISOString()
      });
    }
    
    const updated = await systemSettingsService.updateSettings(settings);
    
    res.json({
      message: 'Settings updated',
      updated_count: updated,
      total_count: settings.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      error: 'Failed to update settings',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Create a new custom setting
router.post('/', async (req: Request, res: Response) => {
  try {
    const setting = req.body;
    
    if (!setting.category || !setting.key) {
      return res.status(400).json({
        error: 'Missing required fields: category, key',
        timestamp: new Date().toISOString()
      });
    }
    
    const created = await systemSettingsService.createSetting({
      category: setting.category,
      key: setting.key,
      value: setting.value || '',
      value_type: setting.value_type || 'string',
      description: setting.description,
      is_sensitive: setting.is_sensitive || false,
      is_readonly: setting.is_readonly || false,
      display_order: setting.display_order || 0
    });
    
    res.status(201).json({
      message: 'Setting created',
      setting: created,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error creating setting:', error);
    res.status(500).json({
      error: 'Failed to create setting',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Delete a custom setting
router.delete('/:category/:key', async (req: Request, res: Response) => {
  try {
    const { category, key } = req.params;
    
    const deleted = await systemSettingsService.deleteSetting(category, key);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Setting not found or is readonly',
        category,
        key,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      message: 'Setting deleted',
      category,
      key,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error deleting setting:', error);
    res.status(500).json({
      error: 'Failed to delete setting',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Export all settings as JSON
router.get('/export', async (req: Request, res: Response) => {
  try {
    const exported = await systemSettingsService.exportSettings();
    
    res.json({
      settings: exported,
      exported_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error exporting settings:', error);
    res.status(500).json({
      error: 'Failed to export settings',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Import settings from JSON
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        error: 'Invalid settings format',
        timestamp: new Date().toISOString()
      });
    }
    
    const imported = await systemSettingsService.importSettings(settings);
    
    res.json({
      message: 'Settings imported',
      imported_count: imported,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error importing settings:', error);
    res.status(500).json({
      error: 'Failed to import settings',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clear settings cache
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    systemSettingsService.clearCache();
    
    res.json({
      message: 'Settings cache cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Regenerate security secrets
router.post('/security/regenerate', async (req: Request, res: Response) => {
  try {
    const { secret_type } = req.body;
    
    if (secret_type === 'jwt' || secret_type === 'all') {
      const crypto = await import('crypto');
      const newSecret = crypto.randomBytes(64).toString('hex');
      await systemSettingsService.updateSetting('security', 'jwt_secret', newSecret);
    }
    
    if (secret_type === 'session' || secret_type === 'all') {
      const crypto = await import('crypto');
      const newSecret = crypto.randomBytes(64).toString('hex');
      await systemSettingsService.updateSetting('security', 'session_secret', newSecret);
    }
    
    res.json({
      message: 'Security secrets regenerated',
      regenerated: secret_type || 'none',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error regenerating secrets:', error);
    res.status(500).json({
      error: 'Failed to regenerate secrets',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

