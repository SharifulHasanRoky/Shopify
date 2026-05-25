/**
 * Shopify App Configuration
 * Handles API credentials and scopes
 */

const config = {
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecret: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SHOPIFY_SCOPES || 'read_products,read_orders,read_customers,read_checkouts,write_script_tags,read_analytics').split(','),
  appUrl: process.env.SHOPIFY_APP_URL || 'http://localhost:3000',
  webhookSecret: process.env.WEBHOOK_SECRET,

  // OAuth redirect URI
  get redirectUri() {
    return `${this.appUrl}/auth/callback`;
  },

  // Required webhook topics for server-side tracking
  webhookTopics: [
    'orders/create',
    'orders/updated',
    'orders/paid',
    'checkouts/create',
    'checkouts/update',
    'carts/create',
    'carts/update',
    'customers/create',
    'customers/update',
    'products/update',
    'refunds/create',
    'app/uninstalled'
  ]
};

module.exports = config;
