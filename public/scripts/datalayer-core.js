/**
 * Shopify Full Data Layer & GTM Integration
 * ==========================================
 * Dynamic ecommerce tracking - all pages including checkout
 * Just connect GTM Container ID and everything works automatically
 * 
 * Tracked Events:
 * - page_view (all pages)
 * - view_item (product pages)
 * - view_item_list (collection pages)
 * - add_to_cart
 * - remove_from_cart
 * - view_cart
 * - begin_checkout
 * - add_shipping_info
 * - add_payment_info
 * - purchase (thank you page)
 * - search
 * - sign_up / login
 * - select_item
 */

(function() {
  'use strict';

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];

  // ============================================
  // GTM CONTAINER LOADER
  // ============================================
  function loadGTM(containerId) {
    if (!containerId || containerId === '') return;

    // GTM Script injection
    (function(w,d,s,l,i){
      w[l]=w[l]||[];
      w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
      var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
      j.async=true;
      j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
      f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer', containerId);

    console.log('[GTM] Container loaded:', containerId);
  }


  // ============================================
  // SHOPIFY DATA EXTRACTION UTILITIES
  // ============================================
  var ShopifyDataExtractor = {
    // Get current page type from Shopify meta
    getPageType: function() {
      if (window.meta && window.meta.page) return window.meta.page.pageType;
      var path = window.location.pathname;
      if (path === '/') return 'home';
      if (path.includes('/products/')) return 'product';
      if (path.includes('/collections')) return 'collection';
      if (path.includes('/cart')) return 'cart';
      if (path.includes('/checkouts')) return 'checkout';
      if (path.includes('/orders/')) return 'order';
      if (path.includes('/account')) return 'account';
      if (path.includes('/search')) return 'search';
      if (path.includes('/pages/')) return 'page';
      if (path.includes('/blogs/')) return 'blog';
      if (path.includes('/thank_you') || path.includes('/thank-you')) return 'thank_you';
      return 'other';
    },

    // Get product data from Shopify product JSON
    getProductData: function() {
      var product = null;
      // Try meta tag
      var metaTag = document.querySelector('meta[property="og:type"][content="product"]');
      if (metaTag || this.getPageType() === 'product') {
        // Try to get from Shopify global product object
        if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
          product = window.ShopifyAnalytics.meta.product;
        }
        // Fallback: try product JSON in page
        if (!product) {
          var scripts = document.querySelectorAll('script[type="application/json"]');
          for (var i = 0; i < scripts.length; i++) {
            try {
              var data = JSON.parse(scripts[i].textContent);
              if (data.product) { product = data.product; break; }
              if (data.id && data.title && data.variants) { product = data; break; }
            } catch(e) {}
          }
        }
        // Fallback: meta tags
        if (!product) {
          product = {
            id: this.getMetaContent('product:id') || '',
            title: this.getMetaContent('og:title') || document.title,
            price: this.getMetaContent('product:price:amount') || '0',
            currency: this.getMetaContent('product:price:currency') || window.Shopify?.currency?.active || 'USD',
            vendor: this.getMetaContent('product:brand') || '',
            type: ''
          };
        }
      }
      return product;
    },

    // Get collection data
    getCollectionData: function() {
      if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.collection) {
        return window.ShopifyAnalytics.meta.collection;
      }
      return null;
    },

    // Get customer data from Shopify
    getCustomerData: function() {
      var customer = null;
      if (window.__st && window.__st.cid) {
        customer = { id: window.__st.cid };
      }
      if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.page) {
        var cData = window.ShopifyAnalytics.meta.page.customerId;
        if (cData) customer = { id: cData };
      }
      // Try meta customer
      if (window.meta && window.meta.customer) {
        customer = window.meta.customer;
      }
      return customer;
    },

    // Get cart data via AJAX
    getCartData: function(callback) {
      fetch('/cart.js')
        .then(function(r) { return r.json(); })
        .then(function(cart) { callback(cart); })
        .catch(function() { callback(null); });
    },

    // Utility: get meta content
    getMetaContent: function(property) {
      var el = document.querySelector('meta[property="' + property + '"]') ||
               document.querySelector('meta[name="' + property + '"]');
      return el ? el.getAttribute('content') : null;
    },

    // Get shop info
    getShopData: function() {
      return {
        domain: window.Shopify?.shop || window.location.hostname,
        currency: window.Shopify?.currency?.active || 'USD',
        locale: window.Shopify?.locale || navigator.language
      };
    }
  };


  // ============================================
  // DATA LAYER PUSH FUNCTIONS
  // ============================================
  var DataLayerPush = {
    // Push page view with all context
    pageView: function() {
      var pageType = ShopifyDataExtractor.getPageType();
      var shopData = ShopifyDataExtractor.getShopData();
      var customerData = ShopifyDataExtractor.getCustomerData();

      var data = {
        event: 'page_view',
        page_type: pageType,
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
        page_referrer: document.referrer,
        shop_domain: shopData.domain,
        shop_currency: shopData.currency,
        shop_locale: shopData.locale,
        timestamp: new Date().toISOString()
      };

      // Add user data if available
      if (customerData) {
        data.user_id = customerData.id;
        data.customer_logged_in = true;
        if (customerData.email) data.customer_email = customerData.email;
        if (customerData.firstName) data.customer_first_name = customerData.firstName;
        if (customerData.ordersCount) data.customer_orders_count = customerData.ordersCount;
        if (customerData.totalSpent) data.customer_total_spent = customerData.totalSpent;
      } else {
        data.customer_logged_in = false;
      }

      window.dataLayer.push(data);
      console.log('[DataLayer] page_view:', pageType);
    },

    // Push product view (view_item)
    viewItem: function(product) {
      if (!product) return;

      var variant = product.variants ? product.variants[0] : null;
      var price = variant ? variant.price : product.price;
      if (typeof price === 'number' && price > 100) price = price / 100; // Convert cents

      window.dataLayer.push({ ecommerce: null }); // Clear previous ecommerce
      window.dataLayer.push({
        event: 'view_item',
        ecommerce: {
          currency: product.currency || window.Shopify?.currency?.active || 'USD',
          value: parseFloat(price) || 0,
          items: [{
            item_id: (product.id || '').toString(),
            item_name: product.title || '',
            item_brand: product.vendor || '',
            item_category: product.type || product.product_type || '',
            item_variant: variant ? variant.title : '',
            price: parseFloat(price) || 0,
            quantity: 1
          }]
        }
      });
      console.log('[DataLayer] view_item:', product.title);
    },

    // Push collection view (view_item_list)
    viewItemList: function(collection) {
      if (!collection) return;

      var items = [];
      var productCards = document.querySelectorAll('[data-product-id], .product-card, .grid-product, .product-item');
      productCards.forEach(function(card, index) {
        var title = card.querySelector('.product-title, .product-card__title, h3, h2');
        var priceEl = card.querySelector('.price, .product-price, .money');
        items.push({
          item_id: card.getAttribute('data-product-id') || index.toString(),
          item_name: title ? title.textContent.trim() : '',
          item_list_name: collection.title || '',
          index: index,
          price: priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) || 0 : 0
        });
      });

      if (items.length > 0) {
        window.dataLayer.push({ ecommerce: null });
        window.dataLayer.push({
          event: 'view_item_list',
          ecommerce: {
            item_list_name: collection.title || '',
            item_list_id: (collection.id || '').toString(),
            items: items
          }
        });
        console.log('[DataLayer] view_item_list:', collection.title, items.length, 'items');
      }
    },

    // Push add to cart
    addToCart: function(item) {
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({
        event: 'add_to_cart',
        ecommerce: {
          currency: window.Shopify?.currency?.active || 'USD',
          value: parseFloat(item.price) * (item.quantity || 1),
          items: [{
            item_id: (item.product_id || item.id || '').toString(),
            item_name: item.title || item.product_title || '',
            item_variant: item.variant_title || '',
            price: parseFloat(item.price) || 0,
            quantity: item.quantity || 1
          }]
        }
      });
      console.log('[DataLayer] add_to_cart:', item.title || item.product_title);
    },

    // Push remove from cart
    removeFromCart: function(item) {
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({
        event: 'remove_from_cart',
        ecommerce: {
          currency: window.Shopify?.currency?.active || 'USD',
          value: parseFloat(item.price) * (item.quantity || 1),
          items: [{
            item_id: (item.product_id || item.id || '').toString(),
            item_name: item.title || item.product_title || '',
            item_variant: item.variant_title || '',
            price: parseFloat(item.price) || 0,
            quantity: item.quantity || 1
          }]
        }
      });
      console.log('[DataLayer] remove_from_cart:', item.title || item.product_title);
    },

    // Push view cart
    viewCart: function(cart) {
      if (!cart) return;

      var items = (cart.items || []).map(function(item, index) {
        return {
          item_id: (item.product_id || '').toString(),
          item_name: item.product_title || item.title || '',
          item_variant: item.variant_title || '',
          price: (item.final_price || item.price || 0) / 100,
          quantity: item.quantity || 1,
          index: index
        };
      });

      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({
        event: 'view_cart',
        ecommerce: {
          currency: cart.currency || window.Shopify?.currency?.active || 'USD',
          value: (cart.total_price || 0) / 100,
          items: items
        }
      });
      console.log('[DataLayer] view_cart:', items.length, 'items, total:', (cart.total_price || 0) / 100);
    },

    // Push search event
    search: function(query) {
      window.dataLayer.push({
        event: 'search',
        search_term: query
      });
      console.log('[DataLayer] search:', query);
    },

    // Push begin checkout
    beginCheckout: function(cart) {
      if (!cart) return;

      var items = (cart.items || []).map(function(item) {
        return {
          item_id: (item.product_id || '').toString(),
          item_name: item.product_title || item.title || '',
          item_variant: item.variant_title || '',
          price: (item.final_price || item.price || 0) / 100,
          quantity: item.quantity || 1
        };
      });

      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({
        event: 'begin_checkout',
        ecommerce: {
          currency: cart.currency || window.Shopify?.currency?.active || 'USD',
          value: (cart.total_price || 0) / 100,
          items: items
        }
      });
      console.log('[DataLayer] begin_checkout:', items.length, 'items');
    },

    // Push purchase (thank you page)
    purchase: function(orderData) {
      if (!orderData) return;

      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({
        event: 'purchase',
        ecommerce: {
          transaction_id: orderData.order_id || orderData.id || '',
          value: parseFloat(orderData.total_price) || 0,
          tax: parseFloat(orderData.tax) || 0,
          shipping: parseFloat(orderData.shipping) || 0,
          currency: orderData.currency || window.Shopify?.currency?.active || 'USD',
          coupon: orderData.discount_code || '',
          items: orderData.items || []
        }
      });
      console.log('[DataLayer] purchase:', orderData.order_id, '$' + orderData.total_price);
    }
  };


  // ============================================
  // CHECKOUT PAGE TRACKING
  // ============================================
  var CheckoutTracker = {
    init: function() {
      var pageType = ShopifyDataExtractor.getPageType();
      if (pageType !== 'checkout' && !window.location.pathname.includes('/checkouts')) return;

      // Detect checkout step from URL and page content
      var step = this.detectCheckoutStep();
      this.trackCheckoutStep(step);
      this.observeCheckoutChanges();
    },

    detectCheckoutStep: function() {
      var url = window.location.href;
      if (url.includes('step=contact_information') || url.includes('/contact_information')) return 'contact_information';
      if (url.includes('step=shipping_method') || url.includes('/shipping_method')) return 'shipping_method';
      if (url.includes('step=payment_method') || url.includes('/payment_method')) return 'payment_method';
      if (url.includes('step=review') || url.includes('/review')) return 'review';
      if (url.includes('step=processing') || url.includes('/processing')) return 'processing';
      if (url.includes('/thank_you') || url.includes('thank-you')) return 'thank_you';
      return 'contact_information'; // Default first step
    },

    trackCheckoutStep: function(step) {
      var eventMap = {
        'contact_information': 'checkout_contact_info',
        'shipping_method': 'add_shipping_info',
        'payment_method': 'add_payment_info',
        'review': 'checkout_review',
        'processing': 'checkout_processing',
        'thank_you': 'purchase_complete'
      };

      window.dataLayer.push({
        event: eventMap[step] || 'checkout_step',
        checkout_step: step,
        page_type: 'checkout'
      });

      // Track shipping info step
      if (step === 'shipping_method') {
        window.dataLayer.push({
          event: 'add_shipping_info',
          ecommerce: {
            shipping_tier: this.getSelectedShipping()
          }
        });
      }

      // Track payment info step
      if (step === 'payment_method') {
        window.dataLayer.push({
          event: 'add_payment_info',
          ecommerce: {
            payment_type: this.getSelectedPayment()
          }
        });
      }

      console.log('[DataLayer] checkout_step:', step);
    },

    getSelectedShipping: function() {
      var selected = document.querySelector('input[name="checkout[shipping_rate][id]"]:checked, .radio-wrapper--checked .radio__label__primary');
      return selected ? selected.textContent || selected.value || 'Standard' : 'unknown';
    },

    getSelectedPayment: function() {
      var selected = document.querySelector('input[name="checkout[payment_gateway]"]:checked, .radio-wrapper--checked .radio__label');
      return selected ? selected.textContent || selected.value || 'Credit Card' : 'unknown';
    },

    // Observe SPA-like checkout changes (Shopify uses turbolinks)
    observeCheckoutChanges: function() {
      var self = this;
      // Listen for page changes in checkout
      if (window.MutationObserver) {
        var observer = new MutationObserver(function(mutations) {
          var step = self.detectCheckoutStep();
          if (step !== self._lastStep) {
            self._lastStep = step;
            self.trackCheckoutStep(step);
          }
        });
        var target = document.querySelector('[data-step], .main, #checkout');
        if (target) {
          observer.observe(target, { childList: true, subtree: true });
        }
      }
      // Also listen for popstate (back/forward)
      window.addEventListener('popstate', function() {
        var step = self.detectCheckoutStep();
        self.trackCheckoutStep(step);
      });
    }
  };

  // ============================================
  // THANK YOU / ORDER CONFIRMATION TRACKING
  // ============================================
  var ThankYouTracker = {
    init: function() {
      if (!window.location.pathname.includes('/thank_you') && 
          !window.location.pathname.includes('/orders/') &&
          !window.Shopify?.checkout) return;

      this.trackPurchase();
    },

    trackPurchase: function() {
      // Try Shopify.checkout object (available on thank you page)
      if (window.Shopify && window.Shopify.checkout) {
        var checkout = window.Shopify.checkout;
        var items = (checkout.line_items || []).map(function(item) {
          return {
            item_id: (item.product_id || '').toString(),
            item_name: item.title || '',
            item_variant: item.variant_title || '',
            price: parseFloat(item.price) || 0,
            quantity: item.quantity || 1,
            sku: item.sku || ''
          };
        });

        DataLayerPush.purchase({
          order_id: checkout.order_id || checkout.id,
          total_price: checkout.total_price || checkout.payment_due,
          tax: checkout.total_tax || 0,
          shipping: checkout.shipping_rate ? checkout.shipping_rate.price : 0,
          currency: checkout.currency || 'USD',
          discount_code: checkout.discount ? checkout.discount.code : '',
          items: items
        });
      }
    }
  };


  // ============================================
  // ADD TO CART INTERCEPTOR
  // ============================================
  var CartInterceptor = {
    init: function() {
      this.interceptFetch();
      this.interceptXHR();
      this.interceptFormSubmit();
    },

    // Intercept fetch() calls to /cart/add.js
    interceptFetch: function() {
      var originalFetch = window.fetch;
      window.fetch = function(url, options) {
        var result = originalFetch.apply(this, arguments);
        
        if (typeof url === 'string') {
          // Add to cart
          if (url.includes('/cart/add')) {
            result.then(function(response) {
              return response.clone().json();
            }).then(function(data) {
              if (data.items) {
                data.items.forEach(function(item) {
                  DataLayerPush.addToCart({
                    product_id: item.product_id,
                    title: item.product_title || item.title,
                    variant_title: item.variant_title,
                    price: item.final_price ? item.final_price / 100 : item.price / 100,
                    quantity: item.quantity
                  });
                });
              } else if (data.product_id) {
                DataLayerPush.addToCart({
                  product_id: data.product_id,
                  title: data.product_title || data.title,
                  variant_title: data.variant_title,
                  price: data.final_price ? data.final_price / 100 : data.price / 100,
                  quantity: data.quantity
                });
              }
            }).catch(function() {});
          }

          // Cart update (could be remove)
          if (url.includes('/cart/change') || url.includes('/cart/update')) {
            result.then(function(response) {
              return response.clone().json();
            }).then(function(data) {
              window.dataLayer.push({
                event: 'cart_updated',
                cart_total: data.total_price ? data.total_price / 100 : 0,
                cart_items_count: data.item_count || 0
              });
            }).catch(function() {});
          }
        }

        return result;
      };
    },

    // Intercept XMLHttpRequest for older themes
    interceptXHR: function() {
      var originalOpen = XMLHttpRequest.prototype.open;
      var originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function(body) {
        var xhr = this;
        if (xhr._url && xhr._url.includes('/cart/add')) {
          xhr.addEventListener('load', function() {
            try {
              var data = JSON.parse(xhr.responseText);
              if (data.product_id) {
                DataLayerPush.addToCart({
                  product_id: data.product_id,
                  title: data.product_title || data.title,
                  variant_title: data.variant_title,
                  price: data.final_price ? data.final_price / 100 : data.price / 100,
                  quantity: data.quantity
                });
              }
            } catch(e) {}
          });
        }
        return originalSend.apply(this, arguments);
      };
    },

    // Intercept form submissions for add-to-cart
    interceptFormSubmit: function() {
      document.addEventListener('submit', function(e) {
        var form = e.target;
        if (form.action && form.action.includes('/cart/add')) {
          var formData = new FormData(form);
          var productTitle = '';
          var productEl = document.querySelector('.product-title, .product__title, h1');
          if (productEl) productTitle = productEl.textContent.trim();

          window.dataLayer.push({
            event: 'add_to_cart_form',
            product_title: productTitle,
            variant_id: formData.get('id'),
            quantity: formData.get('quantity') || 1
          });
        }
      });
    }
  };

  // ============================================
  // SEARCH TRACKER
  // ============================================
  var SearchTracker = {
    init: function() {
      var params = new URLSearchParams(window.location.search);
      var query = params.get('q') || params.get('query');
      if (query && (window.location.pathname.includes('/search') || ShopifyDataExtractor.getPageType() === 'search')) {
        DataLayerPush.search(query);

        // Also track search results count
        var resultsCount = document.querySelectorAll('.search-result, .search-item, .grid-product').length;
        window.dataLayer.push({
          event: 'view_search_results',
          search_term: query,
          search_results_count: resultsCount
        });
      }
    }
  };

  // ============================================
  // PRODUCT CLICK TRACKER (select_item)
  // ============================================
  var ProductClickTracker = {
    init: function() {
      document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href*="/products/"]');
        if (link) {
          var card = link.closest('[data-product-id], .product-card, .grid-product, .product-item');
          var title = link.querySelector('.product-title, h3, h2') || link;
          
          window.dataLayer.push({ ecommerce: null });
          window.dataLayer.push({
            event: 'select_item',
            ecommerce: {
              items: [{
                item_id: card ? card.getAttribute('data-product-id') || '' : '',
                item_name: title.textContent ? title.textContent.trim() : '',
                item_list_name: ShopifyDataExtractor.getCollectionData()?.title || 'Product List'
              }]
            }
          });
        }
      });
    }
  };


  // ============================================
  // USER / CUSTOMER TRACKING
  // ============================================
  var UserTracker = {
    init: function() {
      var customer = ShopifyDataExtractor.getCustomerData();
      if (customer && customer.id) {
        window.dataLayer.push({
          event: 'user_data',
          user_id: customer.id.toString(),
          customer_logged_in: true,
          customer_email_hash: customer.email ? this.hashEmail(customer.email) : '',
          customer_orders_count: customer.ordersCount || 0,
          customer_total_spent: customer.totalSpent || '0.00',
          customer_accepts_marketing: customer.acceptsMarketing || false,
          customer_tags: customer.tags || []
        });
      }
    },

    hashEmail: function(email) {
      // Simple hash for privacy - SHA256 should be used in production
      var hash = 0;
      for (var i = 0; i < email.length; i++) {
        var char = email.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16);
    }
  };

  // ============================================
  // MAIN INITIALIZATION
  // ============================================
  function init() {
    // Load GTM Container (fetched from config or hardcoded)
    var gtmId = '';
    
    // Try to get GTM ID from config endpoint
    if (window.__GTM_CONFIG__ && window.__GTM_CONFIG__.containerId) {
      gtmId = window.__GTM_CONFIG__.containerId;
    }
    // Fallback: check script tag src parameter
    if (!gtmId) {
      var scripts = document.querySelectorAll('script[src*="datalayer"]');
      scripts.forEach(function(script) {
        var src = script.src;
        var match = src.match(/gtm_id=([^&]+)/);
        if (match) gtmId = match[1];
      });
    }
    // Fallback: check meta tag
    if (!gtmId) {
      var metaGtm = document.querySelector('meta[name="gtm-container-id"]');
      if (metaGtm) gtmId = metaGtm.getAttribute('content');
    }

    // Load GTM
    loadGTM(gtmId);

    // Track page view (always)
    DataLayerPush.pageView();

    // Track user data
    UserTracker.init();

    // Page-specific tracking
    var pageType = ShopifyDataExtractor.getPageType();

    switch(pageType) {
      case 'product':
        var product = ShopifyDataExtractor.getProductData();
        DataLayerPush.viewItem(product);
        break;

      case 'collection':
        var collection = ShopifyDataExtractor.getCollectionData();
        DataLayerPush.viewItemList(collection);
        break;

      case 'cart':
        ShopifyDataExtractor.getCartData(function(cart) {
          DataLayerPush.viewCart(cart);
        });
        break;

      case 'checkout':
        // Get cart data and push begin_checkout
        ShopifyDataExtractor.getCartData(function(cart) {
          DataLayerPush.beginCheckout(cart);
        });
        CheckoutTracker.init();
        break;

      case 'search':
        SearchTracker.init();
        break;

      case 'thank_you':
      case 'order':
        ThankYouTracker.init();
        break;
    }

    // Always active trackers
    CartInterceptor.init();
    ProductClickTracker.init();

    console.log('[Shopify DataLayer] ✅ Initialized | Page:', pageType, '| GTM:', gtmId || 'not set');
  }

  // ============================================
  // BOOTSTRAP - Wait for DOM and Shopify
  // ============================================
  function bootstrap() {
    // Load config first
    var configScript = document.createElement('script');
    var currentScript = document.currentScript || document.querySelector('script[src*="datalayer-core"]');
    var shopParam = '';
    
    if (currentScript && currentScript.src) {
      var srcUrl = new URL(currentScript.src);
      shopParam = srcUrl.searchParams.get('shop') || '';
    }

    var configUrl = (currentScript ? new URL(currentScript.src).origin : '') + '/tracking/config.js?shop=' + shopParam;
    
    configScript.src = configUrl;
    configScript.onload = function() {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
      } else {
        document.addEventListener('DOMContentLoaded', init);
      }
    };
    configScript.onerror = function() {
      // Config failed to load, initialize anyway
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
      } else {
        document.addEventListener('DOMContentLoaded', init);
      }
    };
    document.head.appendChild(configScript);
  }

  bootstrap();

})();
