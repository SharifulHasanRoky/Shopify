/**
 * Shopify OAuth Authentication Routes
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { generateAuthUrl, verifyHmac, getAccessToken, registerWebhooks, installScriptTag } = require('../utils/shopifyAuth');
const storeDb = require('../utils/storeDb');
const config = require('../config/shopify');

/**
 * GET /auth
 * Start OAuth flow - redirects to Shopify permission screen
 */
router.get('/', (req, res) => {
  const { shop } = req.query;

  if (!shop || !shop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
    return res.status(400).json({ error: 'Invalid shop parameter. Format: your-store.myshopify.com' });
  }

  // Generate nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString('hex');
  req.session.nonce = nonce;
  req.session.shop = shop;

  const authUrl = generateAuthUrl(shop, nonce);
  res.redirect(authUrl);
});

/**
 * GET /auth/callback
 * OAuth callback - exchange code for access token
 */
router.get('/callback', async (req, res) => {
  try {
    const { shop, code, state, hmac } = req.query;

    // Verify state/nonce
    if (state !== req.session.nonce) {
      return res.status(403).json({ error: 'Invalid state parameter - CSRF check failed' });
    }

    // Verify HMAC
    if (!verifyHmac(req.query)) {
      return res.status(403).json({ error: 'HMAC verification failed' });
    }

    // Exchange code for access token
    const accessToken = await getAccessToken(shop, code);

    if (!accessToken) {
      return res.status(500).json({ error: 'Failed to get access token' });
    }

    // Store the access token
    storeDb.set(shop, {
      accessToken,
      installedAt: new Date().toISOString(),
      gtmContainerId: process.env.DEFAULT_GTM_CONTAINER_ID || ''
    });

    // Register webhooks for server-side tracking
    const webhookResults = await registerWebhooks(shop, accessToken, config.appUrl);
    console.log(`📡 Webhooks registered for ${shop}:`, webhookResults.filter(r => r.success).length, 'success');

    // Install the data layer script tag on storefront
    const scriptResult = await installScriptTag(shop, accessToken, config.appUrl);
    console.log(`📜 Script tag installed for ${shop}`);

    // Redirect to app settings page
    res.redirect(`/app?shop=${shop}&installed=true`);

  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

/**
 * GET /auth/verify
 * Verify if a shop is authenticated
 */
router.get('/verify', (req, res) => {
  const { shop } = req.query;
  const storeData = storeDb.get(shop);
  
  if (storeData && storeData.accessToken) {
    res.json({ authenticated: true, shop });
  } else {
    res.json({ authenticated: false, shop });
  }
});

module.exports = router;
