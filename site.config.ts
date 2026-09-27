/**
 * SITE KIT CONFIG — everything about the website that is NOT the content
 * engine: navigation, hours, pricing table, PushPress links, social links,
 * analytics IDs, and the old-site redirects.
 *
 * The /setup wizard fills the `SETUP:` items with the owner. Pages read from
 * here so there is one place to change a phone number or a price.
 */
// Plain data only — no imports. This file is bundled into the contact-form
// Worker, so it must stay free of Node-only code. Keep brand name/URL/phone in
// sync with jeldon.config.ts (the wizard edits both).

export const site = {
  name: 'Helix Training',
  url: 'https://helixtrain.com',
  tagline: 'Training with a plan. Expert coaching. Way more fun than it should be.',
  shortPitch:
    'Small-group strength training and personal coaching in Corvallis, Oregon — run by a Doctor of Physical Therapy.',
  phone: '+1-541-286-7850',
  phoneDisplay: '(541) 286-7850',
  email: 'kathy@helixtrain.com', // SETUP: confirm — this address is on the old Strong Foundations page
  address: {
    street: '2323 NW 9th St',
    city: 'Corvallis',
    region: 'OR',
    postalCode: '97330',
    landmark: 'Same building as ToGo\'s Sandwich Shop',
    mapsUrl: 'https://maps.app.goo.gl/R4w2bNmB9JrxtCnt9',
    mapsEmbedUrl:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2841.268310037433!2d-123.25507732377324!3d44.59153737107317!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x54c03f7da42cefdd%3A0x6d13b9098c4ed448!2sHelix%20Training!5e0!3m2!1sen!2sus',
  },

  /** Home-page hero photo. /photos fills this in; blank = text-only hero. */
  heroPhoto: { src: '', alt: '' },

  /** SETUP: the wizard asks for these. Day keys are Mon–Sun; "" = not set / closed.
   *  Pages only show hours once `hoursConfirmed` is true. Until then they say
   *  "See the schedule for class times." */
  hours: {
    Mon: '',
    Tue: '',
    Wed: '',
    Thu: '',
    Fri: '',
    Sat: '',
    Sun: '',
  } as Record<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun', string>,
  hoursConfirmed: false, // SETUP: wizard flips to true once the owner confirms

  social: {
    facebook: 'https://www.facebook.com/HelixTrain',
    instagram: 'https://instagram.com/helixtrain',
    tiktok: '', // SETUP
    youtube: '', // SETUP
  },

  /**
   * PushPress — the gym's member system. The subdomain is the part before
   * ".pushpress.com" in the owner's PushPress control panel URL.
   */
  pushpress: {
    subdomain: 'helixtraining',
    calendarUrl: 'https://helixtraining.pushpress.com/landing/calendar',
    /** Hosted checkout/landing pages. SETUP: wizard confirms each link still works. */
    plans: {
      freeClass: 'https://helixtraining.pushpress.com/landing/plans/plan_d7ccd73b1f383d/login',
      dropIn: 'https://helixtraining.pushpress.com/landing/plans/plan_bc2a61d8f9f416/login',
      strongFoundations: 'https://helixtraining.pushpress.com/landing/plans/plan_b62b58963b934d/login',
      // Taken from the old pricing page's Sign up buttons (verified 2026-09-27). SETUP: wizard re-confirms.
      membership8: 'https://helixtraining.pushpress.com/landing/plans/plan_6818a1e44aa4d9/login',
      membership12: 'https://helixtraining.pushpress.com/landing/plans/plan_271e4c8f922601/login',
      punch10: 'https://helixtraining.pushpress.com/landing/plans/plan_0b7bf9f0d39cf4/login',
      punch5: 'https://helixtraining.pushpress.com/landing/plans/plan_fbbf9779e98911/login',
    },
    /** PushPress Grow (GoHighLevel) embeds already in use on the old site. */
    grow: {
      pricingFormUrl: 'https://api.grow.pushpress.com/widget/form/PMWi0VNx9tRtBrdJnh2g',
      reviewWidgetUrl: 'https://services.leadconnectorhq.com/reputation/widgets/review_widget/jcnFmvd88Eo5g4I7lrAq',
    },
    memberApp: {
      ios: '', // SETUP: App Store link for the PushPress members app
      android: '',
    },
  },

  /** Displayed on /pricing. SETUP: wizard confirms prices with the owner. */
  pricing: [
    { name: '12 Classes / Month', price: '$130', period: 'per month', note: 'Most popular', planKey: 'membership12', featured: true },
    { name: '8 Classes / Month', price: '$110', period: 'per month', note: '', planKey: 'membership8', featured: false },
    { name: '10-Class Punch Card', price: '$170', period: 'one time', note: '', planKey: 'punch10', featured: false },
    { name: '5-Class Punch Card', price: '$90', period: 'one time', note: '', planKey: 'punch5', featured: false },
    { name: 'Drop-In', price: '$20', period: 'per class', note: 'Visiting Corvallis? Come train.', planKey: 'dropIn', featured: false },
  ],

  /** Main navigation. Keep to 6 items or fewer. */
  nav: [
    { label: 'Programs', href: '/programs/' },
    { label: 'Schedule', href: '/schedule/' },
    { label: 'Pricing', href: '/pricing/' },
    { label: 'Coaches', href: '/coaches/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Contact', href: '/contact/' },
  ],
  primaryCta: { label: 'Try a Free Class', href: '/free-class/' },

  analytics: {
    /** Cloudflare Web Analytics token (Cloudflare dashboard → Web Analytics). SETUP */
    cloudflareToken: '',
    /** Google Search Console HTML-tag verification code (carried over from the old site). */
    googleSiteVerification: 'm2wdbUiRutZnfy3ReZSnrslbF9bPEQH5p7sH0Jw1eSo',
    /** Optional GA4 measurement ID (G-XXXX). Leave blank to skip GA entirely. */
    ga4MeasurementId: '',
  },

  contactForm: {
    /** Where the form posts. Cloudflare Turnstile is optional spam protection. */
    turnstileSiteKey: '', // SETUP (optional)
    subjects: ['Free class', 'Personal training', 'Strength+ (over 50)', 'Strong Foundations', 'Membership question', 'Something else'],
  },
} as const;

export type Site = typeof site;
