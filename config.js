/* Whiteberry — store settings. Edit this file; no build step.
   ─────────────────────────────────────────────────────────── */
window.WB_CONFIG = {
  /* How orders reach you. Fill at least whatsapp or email. */
  whatsapp: '',        // country code + number, digits only, e.g. '919876543210'
  instagram: '',       // handle without @
  email: '',           // e.g. 'hello@whiteberry.in'
  address: '',         // studio / shop address

  /* Money */
  currency: 'INR',
  locale: 'en-IN',
  shippingFlat: 99,        // shipping charge below the free-shipping threshold (0 = always free)
  freeShippingOver: 4999,  // free shipping when the bag total reaches this

  /* Payment methods shown at checkout */
  payWhatsApp: true,   // "Confirm on WhatsApp" — you reply with a payment link / UPI details
  cod: true,           // cash on delivery
  razorpayKey: '',     // Razorpay Key ID (rzp_test_… / rzp_live_…). Leave empty to hide online payment.

  /* Sizes offered on every piece. "Custom" = made to measure. */
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom']
};
