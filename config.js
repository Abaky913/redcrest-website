// Redcrest Foods v6 — Configuration
'use strict';

const CONFIG = {
  supabase: {
    url:     'https://zrlykipnfyqkdfsuduur.supabase.co',
    anonKey: 'sb_publishable_S4bLMvw3rVPohfY8kr-Nxw_14K7-UXW',
  },
  payment: {
    bank: {
      name:    'Meezan Bank',
      title:   'Abdullah',
      account: '03810108364902',
      iban:    'PK64MEZN0003810108364902',
    },
    easypaisa: {
      name:   'Abdullah Abdullah',
      number: '03189384265',
    },
    jazzcash: {
      name:   'Abdullah',
      number: '03258498579',
    },
  },
  storage: {
    bucket:     'payment-proofs',
    pathPrefix: 'proofs',
  },
  site: {
    name:     'Redcrest Foods',
    tagline:  'Artisan Achaar — Hand-crafted in Punjab',
    url:      'https://redcrestfoods.com',
    whatsapp: '923001234567',
    ogImage:  'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=1200&q=80',
  },
  delivery: {
    rawalpindi: { label: 'Rawalpindi / Islamabad', fee: 200 },
    lahore:     { label: 'Lahore',                 fee: 250 },
    karachi:    { label: 'Karachi',                fee: 350 },
    other:      { label: 'Other City',             fee: 300 },
  },
  pricing: {
    single: 2500,
    triple: 7000,
  },
  rateLimits: {
    order:  45000,
    resend: 60000,
  },
  loyalty: {
    freeJarThreshold: 3,
  },
};
