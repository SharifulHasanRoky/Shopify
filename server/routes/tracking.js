/**
 * Tracking Routes - Serves the data layer JavaScript
 * This is the script injected into the storefront
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const storeDb = require('../utils/storeDb');

/**
 * GET /tracking/datalayer.js
 * Serves the dynamic data layer script
 */
router.get('/datalayer.js', (req, res) => {
  const { shop } = req.query;
  const gtmId = storeDb.getGtmId(shop) || req.query.gtm_id || '';
  const settings = storeDb.getSettings(shop);

  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'public, max-age=300');

  // Send the main data layer script with config
  res.sendFile(
    path.join(__dirname, '../../public/scripts/datalayer-core.js'),
    { headers: { 'Content-Type': 'application/javascript' } }
  );
});

/**
 * GET /tracking/config.js
 * Serves dynamic configuration
 */
router.get('/config.js', (req, res) => {
  const { shop } = req.query;
  const gtmId = storeDb.getGtmId(shop) || '';
  const settings = storeDb.getSettings(shop);

  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'no-cache');

  const configScript = `
window.__GTM_CONFIG__ = {
  containerId: "${gtmId}",
  enableDataLayer: ${settings?.enableDataLayer !== false},
  enableEnhancedEcommerce: ${settings?.enableEnhancedEcommerce !== false},
  trackCheckout: ${settings?.trackCheckout !== false},
  trackUserData: ${settings?.trackUserData !== false}
};
`;
  res.send(configScript);
});

module.exports = router;
