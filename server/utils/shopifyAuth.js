/**
 * Shopify OAuth & HMAC Verification Utilities
 */

const crypto = require('crypto');
const fetch = require('node-fetch');
const config = require('../config/shopify');

/**
 * Generate OAuth authorization URL
 */
function generateAuthUrl(shop, nonce) {
  const scopes = config.scopes.join(',');
  const redirectUri = config.redirectUri;
  return `https://${shop}/admin/oauth/authorize?client_id=${config.apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;
}

/**
 * Verify HMAC from Shopify OAuth callback
 */
function verifyHmac(query) {
  const { hmac, ...params } = query;
  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const generatedHmac = crypto
    .createHmac('sha256', config.apiSecret)
    .update(message)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(hmac, 'hex'),
    Buffer.from(generatedHmac, 'hex')
  );
}

/**
 * Exchange authorization code for access token
 */
async function getAccessToken(shop, code) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      code
    })
  });

  const data = await response.json();
  return data.access_token;
}

/**
 * Verify webhook HMAC signature
 */
function verifyWebhookHmac(rawBody, hmacHeader) {
  const generatedHmac = crypto
    .createHmac('sha256', config.apiSecret)
    .update(rawBody)
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader),
    Buffer.from(generatedHmac)
  );
}

/**
 * Make authenticated Shopify Admin API request
 */
async function shopifyApiRequest(shop, accessToken, endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`https://${shop}/admin/api/2024-01/${endpoint}`, options);
  return response.json();
}

/**
 * Register all webhooks for a shop
 */
async function registerWebhooks(shop, accessToken, appUrl) {
  const results = [];

  for (const topic of config.webhookTopics) {
    try {
      const result = await shopifyApiRequest(shop, accessToken, 'webhooks.json', 'POST', {
        webhook: {
          topic,
          address: `${appUrl}/webhooks/${topic.replace('/', '-')}`,
          format: 'json'
        }
      });
      results.push({ topic, success: true, id: result.webhook?.id });
    } catch (error) {
      results.push({ topic, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Install script tag for data layer on the storefront
 */
async function installScriptTag(shop, accessToken, appUrl) {
  const scriptTagUrl = `${appUrl}/tracking/datalayer.js?shop=${shop}`;
  
  // Check if script already exists
  const existing = await shopifyApiRequest(shop, accessToken, 'script_tags.json');
  const alreadyInstalled = existing.script_tags?.some(tag => tag.src.includes('/tracking/datalayer.js'));

  if (!alreadyInstalled) {
    return shopifyApiRequest(shop, accessToken, 'script_tags.json', 'POST', {
      script_tag: {
        event: 'onload',
        src: scriptTagUrl,
        display_scope: 'all'
      }
    });
  }

  return { message: 'Script tag already installed' };
}

module.exports = {
  generateAuthUrl,
  verifyHmac,
  getAccessToken,
  verifyWebhookHmac,
  shopifyApiRequest,
  registerWebhooks,
  installScriptTag
};
