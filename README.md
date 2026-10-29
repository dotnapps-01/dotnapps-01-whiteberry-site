# Whiteberry

Online store for **Whiteberry** — half sarees, pavadai sets, anarkalis with kalamkari dupattas and kurta sets.
*Elegance in every stitch.*

Static site (HTML + CSS + JS, no build step) with a working storefront: shop grid with type / colour / price filters,
quick-view with sizes and quantity, a bag drawer, checkout and an order confirmation.

## Files
| File | What it is |
|---|---|
| `index.html`, `style.css`, `app.js` | The brand site (hero, collections, weaves, atelier, FAQ, contact) |
| `shop.css`, `shop.js` | Storefront: grid, quick view, bag, checkout |
| `products.js` | **The catalogue — edit this to add or change pieces** |
| `config.js` | **Store settings — WhatsApp / email, shipping, payment methods, sizes** |
| `img/` | Photos |
| `vercel.json` | Vercel headers / caching |

## Before you go live
1. **`config.js`** — set `whatsapp` (digits with country code, e.g. `919876543210`) and/or `email`. Orders are delivered there.
   Set `shippingFlat` / `freeShippingOver`, and turn `cod` on or off.
2. **`products.js`** — the prices and “includes” lines are **placeholders**. Replace with real ones. Add new pieces by copying an entry.
3. Add your Instagram / address in `config.js` (they appear in the contact section).

## How ordering works
The shop has no server. At checkout the customer fills in delivery details; the order is saved in their browser and sent to you as a
formatted WhatsApp message (or email), then you reply with a payment link / UPI details and confirm measurements. Payment options:
- **Confirm on WhatsApp** (default) · **Cash on delivery** (`cod: true`)
- **Pay online (Razorpay)** — set `razorpayKey` in `config.js` (use a `rzp_test_…` key first).
  ⚠ This is the client-side Razorpay checkout. For production you should also create the order and **verify the payment signature on a
  server** (e.g. a Vercel serverless function) — without that, a payment can't be reliably tied to an order. Ask for this when you're ready.

Limits of a no-server shop: orders aren't stored centrally (you see them in WhatsApp/email), stock isn't tracked, and prices are
trusted from the browser. When you need order history, inventory, discounts or verified payments, add a backend (Shopify,
Medusa, or a small Vercel + database setup).

## Local preview
```bash
python3 -m http.server 8080   # open http://localhost:8080
```

## Deploy (Vercel)
Import the repo, Framework Preset **Other**, leave Root Directory / build / output empty. Pushes to `main` redeploy automatically.
