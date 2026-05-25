# Shopify GTM Data Layer & Server-Side Tracking App

Full ecommerce data layer and server-side tracking for Shopify stores. Just connect your GTM Container ID and everything works automatically — all pages including checkout.

## Features

### 🏷️ Data Layer (Client-Side)
- **Dynamic tracking** — automatically detects page type and pushes relevant events
- **All ecommerce events**: page_view, view_item, view_item_list, select_item, add_to_cart, remove_from_cart, view_cart, begin_checkout, add_shipping_info, add_payment_info, purchase, search
- **User data tracking** — customer ID, login status, order history, marketing consent
- **Cart interception** — intercepts fetch/XHR/form submissions for real-time cart events
- **Checkout page tracking** — step-by-step tracking through entire checkout flow
- **GTM auto-loader** — just provide Container ID, GTM loads automatically

### 📡 Server-Side Tracking
- **Webhook-based** — captures events even when client JS is blocked
- **GA4 Measurement Protocol** — sends events directly to GA4
- **All critical events**: orders/create, orders/paid, checkouts/create, checkouts/update, carts/update, customers/create, refunds/create
- **Always running** — works 24/7 via Shopify webhooks

### ⚡ Always On
- Script tag installed on storefront (all pages)
- Webhooks registered for server-side events
- No user action needed after initial setup
- Self-healing: reinstall button if anything goes wrong

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Shopify App credentials
```

### 3. Start the App
```bash
npm start
```

### 4. Install on Shopify Store
1. Go to `https://your-app-url.com/auth?shop=your-store.myshopify.com`
2. Approve the app permissions
3. Enter your GTM Container ID in the settings panel
4. Done! All tracking is now live.

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    SHOPIFY STORE                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Storefront Pages]                                      │
│       │                                                  │
│       ▼                                                  │
│  ┌──────────────────┐     ┌──────────────────┐          │
│  │  datalayer-core.js│────▶│  window.dataLayer │         │
│  │  (Script Tag)     │     │  (GTM reads this) │         │
│  └──────────────────┘     └──────────────────┘          │
│       │                          │                       │
│       │ Intercepts:              │ Pushes:               │
│       │ • fetch /cart/add        │ • page_view           │
│       │ • XHR /cart/add          │ • view_item           │
│       │ • form submits           │ • add_to_cart         │
│       │ • checkout steps         │ • purchase            │
│       │                          │ • all GA4 events      │
│       │                          ▼                       │
│       │                   ┌──────────────┐               │
│       │                   │   GTM Container│              │
│       │                   │   (Auto-loaded)│              │
│       │                   └──────────────┘               │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Shopify Backend - Webhooks]                            │
│       │                                                  │
│       ▼                                                  │
│  ┌──────────────────┐     ┌──────────────────┐          │
│  │  Webhook Handler  │────▶│  GA4 Measurement │          │
│  │  (Server-Side)    │     │  Protocol API    │          │
│  └──────────────────┘     └──────────────────┘          │
│       │                                                  │
│       │ Captures:                                        │
│       │ • orders/create (purchase)                       │
│       │ • orders/paid (payment confirmed)                │
│       │ • checkouts/create (begin_checkout)              │
│       │ • checkouts/update (checkout steps)              │
│       │ • carts/update (add/remove items)                │
│       │ • customers/create (sign_up)                     │
│       │ • refunds/create (refund)                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Data Layer Events Reference

| Event | Trigger | Data Included |
|-------|---------|---------------|
| `page_view` | Every page load | page_type, title, path, shop info, user data |
| `view_item` | Product page | product id, name, price, brand, category, variant |
| `view_item_list` | Collection page | list name, items with prices |
| `select_item` | Click product link | item name, id, list name |
| `add_to_cart` | Add item to cart | item id, name, price, quantity, variant |
| `remove_from_cart` | Remove item | item id, name, price, quantity |
| `view_cart` | Cart page | all items, total value |
| `begin_checkout` | Checkout initiated | all items, total value |
| `add_shipping_info` | Shipping step | shipping tier selected |
| `add_payment_info` | Payment step | payment method |
| `purchase` | Thank you page | transaction_id, value, tax, shipping, all items |
| `search` | Search results | search_term, results_count |
| `user_data` | Logged-in user | user_id, orders_count, total_spent |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth?shop=` | GET | Start OAuth installation |
| `/auth/callback` | GET | OAuth callback |
| `/api/settings` | GET/POST | Get/update settings |
| `/api/status` | GET | Check tracking status |
| `/api/reinstall-scripts` | POST | Reinstall scripts & webhooks |
| `/tracking/datalayer.js` | GET | Serve data layer script |
| `/tracking/config.js` | GET | Serve dynamic config |
| `/webhooks/*` | POST | Shopify webhook endpoints |
| `/health` | GET | App health check |

## Tech Stack
- **Backend**: Node.js + Express
- **Tracking**: Google Tag Manager + GA4 Measurement Protocol
- **Auth**: Shopify OAuth 2.0
- **Webhooks**: All major ecommerce events
- **Frontend**: Vanilla HTML/CSS/JS (no framework needed)

## License
MIT
