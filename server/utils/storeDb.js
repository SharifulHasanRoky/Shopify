/**
 * Simple In-Memory Store Database
 * In production, replace with Redis/PostgreSQL/MongoDB
 * 
 * Stores: shop domain -> { accessToken, gtmContainerId, settings }
 */

const stores = new Map();

const storeDb = {
  /**
   * Save or update store data
   */
  set(shop, data) {
    const existing = stores.get(shop) || {};
    stores.set(shop, { ...existing, ...data, updatedAt: new Date().toISOString() });
  },

  /**
   * Get store data
   */
  get(shop) {
    return stores.get(shop) || null;
  },

  /**
   * Get access token for a shop
   */
  getAccessToken(shop) {
    const store = stores.get(shop);
    return store ? store.accessToken : null;
  },

  /**
   * Get GTM Container ID for a shop
   */
  getGtmId(shop) {
    const store = stores.get(shop);
    return store?.gtmContainerId || process.env.DEFAULT_GTM_CONTAINER_ID || null;
  },

  /**
   * Update GTM Container ID
   */
  setGtmId(shop, gtmContainerId) {
    const existing = stores.get(shop) || {};
    stores.set(shop, { ...existing, gtmContainerId, updatedAt: new Date().toISOString() });
  },

  /**
   * Get tracking settings for a shop
   */
  getSettings(shop) {
    const store = stores.get(shop);
    return store?.settings || {
      enableServerSide: true,
      enableDataLayer: true,
      trackCheckout: true,
      trackUserData: true,
      enableEnhancedEcommerce: true,
      ga4MeasurementId: process.env.GA4_MEASUREMENT_ID || '',
      ga4ApiSecret: process.env.GA4_API_SECRET || ''
    };
  },

  /**
   * Update settings
   */
  setSettings(shop, settings) {
    const existing = stores.get(shop) || {};
    stores.set(shop, { ...existing, settings, updatedAt: new Date().toISOString() });
  },

  /**
   * Remove a store (uninstall)
   */
  remove(shop) {
    stores.delete(shop);
  },

  /**
   * List all stores
   */
  listAll() {
    return Array.from(stores.entries()).map(([shop, data]) => ({
      shop,
      gtmContainerId: data.gtmContainerId,
      installedAt: data.installedAt,
      updatedAt: data.updatedAt
    }));
  }
};

module.exports = storeDb;
