/**
 * Shopify Webhook Routes - Server-Side Tracking
 * All ecommerce events are captured here and forwarded to GA4/GTM Server
 */

const express = require('express');
const router = express.Router();
const { verifyWebhookHmac } = require('../utils/shopifyAuth');
const serverTracker = require('../services/serverTracker');
const storeDb = require('../utils/storeDb');

/**
 * Verify webhook authenticity middleware
 */
function verifyWebhook(req, res, next) {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const shop = req.headers['x-shopify-shop-domain'];
  const topic = req.headers['x-shopify-topic'];

  if (!hmac || !shop) {
    return res.status(401).json({ error: 'Missing webhook headers' });
  }

  try {
    const isValid = verifyWebhookHmac(req.body, hmac);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } catch (e) {
    // In development, allow unverified webhooks
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Webhook verification failed' });
    }
  }

  req.shopDomain = shop;
  req.webhookTopic = topic;
  req.webhookData = JSON.parse(req.body);
  next();
}

// Apply verification to all webhook routes
router.use(verifyWebhook);

/**
 * POST /webhooks/orders-create
 * Fires when a new order is created (PURCHASE event)
 */
router.post('/orders-create', async (req, res) => {
  res.status(200).send('OK');

  const order = req.webhookData;
  const shop = req.shopDomain;

  console.log(`🛒 [${shop}] Order Created: #${order.order_number} - $${order.total_price}`);

  await serverTracker.trackPurchase(shop, {
    transaction_id: order.id.toString(),
    order_number: order.order_number,
    value: parseFloat(order.total_price),
    currency: order.currency,
    tax: parseFloat(order.total_tax || 0),
    shipping: parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0),
    discount: parseFloat(order.total_discounts || 0),
    items: (order.line_items || []).map(item => ({
      item_id: item.product_id?.toString(),
      item_name: item.title,
      item_variant: item.variant_title,
      quantity: item.quantity,
      price: parseFloat(item.price),
      sku: item.sku
    })),
    customer: order.customer ? {
      id: order.customer.id,
      email: order.customer.email,
      first_name: order.customer.first_name,
      last_name: order.customer.last_name,
      orders_count: order.customer.orders_count,
      total_spent: order.customer.total_spent
    } : null,
    shipping_address: order.shipping_address,
    billing_address: order.billing_address,
    payment_gateway: order.gateway,
    fulfillment_status: order.fulfillment_status,
    financial_status: order.financial_status
  });
});

/**
 * POST /webhooks/orders-paid
 * Fires when payment is confirmed
 */
router.post('/orders-paid', async (req, res) => {
  res.status(200).send('OK');

  const order = req.webhookData;
  const shop = req.shopDomain;

  console.log(`💰 [${shop}] Order Paid: #${order.order_number}`);

  await serverTracker.trackEvent(shop, 'payment_confirmed', {
    transaction_id: order.id.toString(),
    order_number: order.order_number,
    value: parseFloat(order.total_price),
    currency: order.currency,
    payment_gateway: order.gateway
  });
});

/**
 * POST /webhooks/orders-updated
 * Fires when an order is updated
 */
router.post('/orders-updated', async (req, res) => {
  res.status(200).send('OK');

  const order = req.webhookData;
  const shop = req.shopDomain;

  await serverTracker.trackEvent(shop, 'order_updated', {
    transaction_id: order.id.toString(),
    order_number: order.order_number,
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status
  });
});

/**
 * POST /webhooks/checkouts-create
 * Fires when checkout is initiated
 */
router.post('/checkouts-create', async (req, res) => {
  res.status(200).send('OK');

  const checkout = req.webhookData;
  const shop = req.shopDomain;

  console.log(`🛍️ [${shop}] Checkout Started: ${checkout.token}`);

  await serverTracker.trackBeginCheckout(shop, {
    checkout_token: checkout.token,
    value: parseFloat(checkout.total_price || 0),
    currency: checkout.currency,
    items: (checkout.line_items || []).map(item => ({
      item_id: item.product_id?.toString(),
      item_name: item.title,
      item_variant: item.variant_title,
      quantity: item.quantity,
      price: parseFloat(item.price)
    })),
    customer_email: checkout.email,
    shipping_address: checkout.shipping_address
  });
});

/**
 * POST /webhooks/checkouts-update
 * Fires when checkout is updated (shipping info added, payment step, etc.)
 */
router.post('/checkouts-update', async (req, res) => {
  res.status(200).send('OK');

  const checkout = req.webhookData;
  const shop = req.shopDomain;

  console.log(`📝 [${shop}] Checkout Updated: ${checkout.token}`);

  await serverTracker.trackCheckoutStep(shop, {
    checkout_token: checkout.token,
    value: parseFloat(checkout.total_price || 0),
    currency: checkout.currency,
    shipping_rate: checkout.shipping_rate,
    payment_due: checkout.payment_due,
    items_count: checkout.line_items?.length || 0
  });
});

/**
 * POST /webhooks/carts-create
 * Fires when a cart is created
 */
router.post('/carts-create', async (req, res) => {
  res.status(200).send('OK');

  const cart = req.webhookData;
  const shop = req.shopDomain;

  await serverTracker.trackEvent(shop, 'cart_created', {
    cart_token: cart.token,
    items_count: cart.line_items?.length || 0
  });
});

/**
 * POST /webhooks/carts-update
 * Fires when cart is updated (add/remove items)
 */
router.post('/carts-update', async (req, res) => {
  res.status(200).send('OK');

  const cart = req.webhookData;
  const shop = req.shopDomain;

  console.log(`🛒 [${shop}] Cart Updated: ${cart.line_items?.length || 0} items`);

  await serverTracker.trackEvent(shop, 'cart_updated', {
    cart_token: cart.token,
    value: parseFloat(cart.total_price || 0) / 100,
    currency: cart.currency,
    items: (cart.line_items || []).map(item => ({
      item_id: item.product_id?.toString(),
      item_name: item.title,
      quantity: item.quantity,
      price: parseFloat(item.price) / 100
    }))
  });
});

/**
 * POST /webhooks/customers-create
 * Fires when a new customer registers
 */
router.post('/customers-create', async (req, res) => {
  res.status(200).send('OK');

  const customer = req.webhookData;
  const shop = req.shopDomain;

  console.log(`👤 [${shop}] New Customer: ${customer.email}`);

  await serverTracker.trackEvent(shop, 'sign_up', {
    customer_id: customer.id,
    email: customer.email,
    first_name: customer.first_name,
    accepts_marketing: customer.accepts_marketing
  });
});

/**
 * POST /webhooks/customers-update
 * Fires when customer data is updated
 */
router.post('/customers-update', async (req, res) => {
  res.status(200).send('OK');

  const customer = req.webhookData;
  const shop = req.shopDomain;

  await serverTracker.trackEvent(shop, 'customer_updated', {
    customer_id: customer.id,
    orders_count: customer.orders_count,
    total_spent: customer.total_spent
  });
});

/**
 * POST /webhooks/refunds-create
 * Fires when a refund is created
 */
router.post('/refunds-create', async (req, res) => {
  res.status(200).send('OK');

  const refund = req.webhookData;
  const shop = req.shopDomain;

  console.log(`💸 [${shop}] Refund Created: Order #${refund.order_id}`);

  await serverTracker.trackEvent(shop, 'refund', {
    transaction_id: refund.order_id?.toString(),
    value: refund.transactions?.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0,
    items: (refund.refund_line_items || []).map(item => ({
      item_id: item.line_item?.product_id?.toString(),
      item_name: item.line_item?.title,
      quantity: item.quantity
    }))
  });
});

/**
 * POST /webhooks/app-uninstalled
 * Fires when the app is uninstalled
 */
router.post('/app-uninstalled', async (req, res) => {
  res.status(200).send('OK');

  const shop = req.shopDomain;
  console.log(`❌ [${shop}] App Uninstalled`);

  // Clean up store data
  storeDb.remove(shop);
});

module.exports = router;
