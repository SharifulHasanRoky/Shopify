/**
 * Server-Side Tracking Service
 * Sends events to GA4 Measurement Protocol & GTM Server Container
 */

const fetch = require('node-fetch');
const storeDb = require('../utils/storeDb');

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

const serverTracker = {
  /**
   * Track a purchase event (server-side)
   */
  async trackPurchase(shop, data) {
    const settings = storeDb.getSettings(shop);
    if (!settings.enableServerSide) return;

    const event = {
      name: 'purchase',
      params: {
        transaction_id: data.transaction_id,
        value: data.value,
        currency: data.currency,
        tax: data.tax,
        shipping: data.shipping,
        items: data.items,
        coupon: data.discount > 0 ? 'discount_applied' : undefined
      }
    };

    // Send to GA4 Measurement Protocol
    await this.sendToGA4(shop, event, data.customer);

    // Log for debugging
    console.log(`📊 [Server] Purchase tracked: ${data.transaction_id} - $${data.value} ${data.currency}`);
  },

  /**
   * Track begin_checkout event
   */
  async trackBeginCheckout(shop, data) {
    const settings = storeDb.getSettings(shop);
    if (!settings.enableServerSide) return;

    const event = {
      name: 'begin_checkout',
      params: {
        value: data.value,
        currency: data.currency,
        items: data.items,
        checkout_token: data.checkout_token
      }
    };

    await this.sendToGA4(shop, event);
    console.log(`📊 [Server] Checkout started: ${data.checkout_token}`);
  },

  /**
   * Track checkout step progression
   */
  async trackCheckoutStep(shop, data) {
    const settings = storeDb.getSettings(shop);
    if (!settings.enableServerSide) return;

    const event = {
      name: 'checkout_progress',
      params: {
        value: data.value,
        currency: data.currency,
        checkout_token: data.checkout_token,
        shipping_tier: data.shipping_rate?.title,
        payment_due: data.payment_due
      }
    };

    await this.sendToGA4(shop, event);
  },

  /**
   * Track a generic event
   */
  async trackEvent(shop, eventName, data) {
    const settings = storeDb.getSettings(shop);
    if (!settings.enableServerSide) return;

    const event = {
      name: eventName,
      params: { ...data }
    };

    await this.sendToGA4(shop, event);
    console.log(`📊 [Server] Event tracked: ${eventName}`);
  },

  /**
   * Send event to GA4 via Measurement Protocol
   */
  async sendToGA4(shop, event, customer = null) {
    const settings = storeDb.getSettings(shop);
    const measurementId = settings.ga4MeasurementId;
    const apiSecret = settings.ga4ApiSecret;

    if (!measurementId || !apiSecret) {
      console.log(`⚠️ [${shop}] GA4 not configured, skipping MP send`);
      return;
    }

    try {
      const payload = {
        client_id: customer?.id?.toString() || `server_${shop}`,
        events: [event]
      };

      // Add user properties if customer data available
      if (customer) {
        payload.user_properties = {
          customer_id: { value: customer.id?.toString() },
          lifetime_value: { value: customer.total_spent },
          order_count: { value: customer.orders_count?.toString() }
        };
      }

      const url = `${GA4_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`❌ GA4 MP Error [${shop}]:`, response.status, await response.text());
      }
    } catch (error) {
      console.error(`❌ GA4 MP Send Failed [${shop}]:`, error.message);
    }
  }
};

module.exports = serverTracker;
