/**
 * API Routes - App Configuration & Management
 */

const express = require('express');
const router = express.Router();
const storeDb = require('../utils/storeDb');
const { shopifyApiRequest, registerWebhooks, installScriptTag } = require('../utils/shopifyAuth');
const config = require('../config/shopify');

/**
 * GET /api/settings
 * Get current app settings for a shop
 */
router.get('/settings', (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: 'Shop parameter required' });
  }

  const storeData = storeDb.get(shop);
  if (!storeData) {
    return res.status(404).json({ error: 'Shop not found. Please install the app first.' });
  }

  res.json({
    shop,
    gtmContainerId: storeData.gtmContainerId || '',
    settings: storeDb.getSettings(shop),
    installedAt: storeData.installedAt,
    updatedAt: storeData.updatedAt
  });
});

/**
 * POST /api/settings
 * Update app settings (GTM ID, tracking options)
 */
router.post('/settings', (req, res) => {
  const { shop, gtmContainerId, settings } = req.body;

  if (!shop) {
    return res.status(400).json({ error: 'Shop parameter required' });
  }

  const storeData = storeDb.get(shop);
  if (!storeData) {
    return res.status(404).json({ error: 'Shop not found' });
  }

  if (gtmContainerId) {
    storeDb.setGtmId(shop, gtmContainerId);
  }

  if (settings) {
    storeDb.setSettings(shop, { ...storeDb.getSettings(shop), ...settings });
  }

  res.json({ success: true, message: 'Settings updated successfully' });
});

/**
 * POST /api/reinstall-scripts
 * Re-install script tags and webhooks
 */
router.post('/reinstall-scripts', async (req, res) => {
  const { shop } = req.body;

  if (!shop) {
    return res.status(400).json({ error: 'Shop parameter required' });
  }

  const storeData = storeDb.get(shop);
  if (!storeData || !storeData.accessToken) {
    return res.status(404).json({ error: 'Shop not found or not authenticated' });
  }

  try {
    // Re-register webhooks
    const webhookResults = await registerWebhooks(shop, storeData.accessToken, config.appUrl);
    
    // Re-install script tag
    const scriptResult = await installScriptTag(shop, storeData.accessToken, config.appUrl);

    res.json({
      success: true,
      webhooks: webhookResults,
      scriptTag: scriptResult
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reinstall', details: error.message });
  }
});

/**
 * GET /api/status
 * Get tracking status for a shop
 */
router.get('/status', async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: 'Shop parameter required' });
  }

  const storeData = storeDb.get(shop);
  if (!storeData) {
    return res.status(404).json({ error: 'Shop not found' });
  }

  let webhookCount = 0;
  let scriptTagInstalled = false;

  if (storeData.accessToken) {
    try {
      const webhooks = await shopifyApiRequest(shop, storeData.accessToken, 'webhooks.json');
      webhookCount = webhooks.webhooks?.length || 0;

      const scripts = await shopifyApiRequest(shop, storeData.accessToken, 'script_tags.json');
      scriptTagInstalled = scripts.script_tags?.some(tag => tag.src.includes('/tracking/datalayer.js')) || false;
    } catch (e) {
      // API error - still return what we have
    }
  }

  res.json({
    shop,
    status: 'active',
    gtmContainerId: storeData.gtmContainerId || 'Not configured',
    dataLayerActive: scriptTagInstalled,
    serverSideActive: webhookCount > 0,
    webhookCount,
    settings: storeDb.getSettings(shop)
  });
});

module.exports = router;
