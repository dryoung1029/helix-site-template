/**
 * HELIX TRAINING — DOMAIN PACK
 *
 * This is the one file that tells the Jeldon content engine who Helix Training
 * is: brand, author, voice, scoring, citation policy, and competitors. Every
 * article the site publishes is scored and validated against what's in here.
 *
 * Values marked `// SETUP:` are placeholders the /setup wizard fills in with
 * the owner. Everything else is a working default for a Corvallis gym owned by
 * a Doctor of Physical Therapy. Field-by-field guide: docs/JELDON.md.
 */
import { defineDomainPack, defaultScoringConfig } from '@jeldon/config';

const SITE_URL = 'https://helixtrain.com';

export default defineDomainPack({
  brand: {
    name: 'Helix Training',
    siteUrl: SITE_URL,
    tagline: 'Training with a plan. Expert coaching. Way more fun than it should be.',
    geoFraming: 'Corvallis, Oregon and the mid-Willamette Valley',
    nap: {
      address: '2323 NW 9th St',
      city: 'Corvallis',
      region: 'OR',
      postalCode: '97330',
      phone: '+1-541-286-7850',
      placeId: '', // SETUP: Google Business Profile place ID (wizard finds it)
    },
    logoUrl: '/brand/logo-horizontal.webp',
    brandColors: {
      blue: '#008abd',
      red: '#ec222d',
      charcoal: '#333537',
      salmon: '#f08a7a',
    },
  },

  authors: [
    {
      slug: 'kathy-lynch',
      name: 'Dr. Kathy Lynch, PT, DPT',
      title: 'Owner, Doctor of Physical Therapy',
      schemaId: `${SITE_URL}/coaches/#kathy-lynch`,
      isPrimary: true,
      profile: {
        name: 'Kathy Lynch',
        jobTitle: 'Doctor of Physical Therapy, Owner of Helix Training',
        url: `${SITE_URL}/coaches/`,
        credential: 'PT, DPT',
        knowsAbout: [
          'strength training',
          'strength and conditioning',
          'physical therapy',
          'training after 50',
          'injury prevention',
          'movement assessment',
          'small group training',
        ],
        alumniOf: [], // SETUP: DPT program
        memberOf: [], // SETUP: e.g. APTA
        sameAs: [
          'https://www.facebook.com/HelixTrain',
          'https://instagram.com/helixtrain',
        ],
      },
    },
  ],

  voice: {
    persona:
      'Dr. Kathy Lynch, a Doctor of Physical Therapy who owns a small strength gym in Corvallis. ' +
      'Warm, direct, and a little funny. Speaks from the gym floor in the first person ("when I coach", ' +
      '"in our gym", "our members"). Explains the why behind training in plain words a smart 9th grader ' +
      'would follow. Evidence-informed without sounding like a journal. Never preachy, never a hype machine.',
    bannedTopics: [
      'diagnosing a reader\'s injury or condition',
      'promising specific weight-loss numbers or timelines',
      'supplement selling',
      'body shaming or "beach body" framing',
      'criticizing a named competitor gym by name',
    ],
    bannedPhrasings: [
      'studies have shown',
      'unlock your potential',
      'crush your goals',
      'no pain no gain',
      'it\'s that simple',
      'game-changer',
      'in today\'s fast-paced world',
    ],
    rules: [
      'Lead with the reader\'s question and answer it in the first two sentences.',
      'Use "I" and "we" — this is a coach talking, not a brochure.',
      'When a claim rests on research, link the actual source in a References section. Never invent a citation.',
      'If a section would only hit a score check by flattening the voice, cut the claim instead.',
      'General education only: no individualized medical advice. Point people to their doctor or PT for pain, injury, or medical conditions.',
      'Mention Corvallis naturally when it fits; never stuff it.',
      'Every article ends with one plain next step (try a free class, book a chat, read a related post).',
    ],
    voiceAnchorUrls: [], // SETUP: add 1–2 published articles once Kathy approves them
    readingGradeBand: [6, 9],
  },

  content: {
    categories: ['guide', 'evidence', 'training', 'nutrition', 'community'],
    categoryTargets: { guide: 80, evidence: 85, training: 80, nutrition: 80, community: 70 },
    tags: [
      'beginners',
      'strength-training',
      'over-50',
      'personal-training',
      'group-classes',
      'mobility',
      'balance',
      'bone-density',
      'back-pain',
      'knee-pain',
      'shoulder-health',
      'recovery',
      'nutrition',
      'protein',
      'consistency',
      'motivation',
      'corvallis',
      'women-strength',
      'menopause',
      'aging-well',
      'injury-prevention',
      'physical-therapy',
      'kettlebells',
      'deadlift',
      'squat',
    ],
    defaultAuthorSlug: 'kathy-lynch',
    timezone: 'America/Los_Angeles',
  },

  scoring: {
    ...defaultScoringConfig,
    geo: {
      ...defaultScoringConfig.geo,
      floor: 70,
      checks: defaultScoringConfig.geo.checks.map((check) => {
        if (check.id === 'citation') {
          return {
            ...check,
            // Primary sources a strength/rehab article would actually cite.
            patterns: [
              'pubmed\\.ncbi\\.nlm\\.nih\\.gov|doi\\.org\\/|pmid[:\\s]*\\d|PMC\\d{5,}|acsm\\.org|nsca\\.com|' +
                'cdc\\.gov|who\\.int|health\\.gov|nih\\.gov|apta\\.org|bjsm\\.bmj\\.com|journals\\.lww\\.com|' +
                'sciencedirect\\.com|springer\\.com|wiley\\.com|cochranelibrary\\.com',
            ],
          };
        }
        if (check.id === 'firstPerson') {
          return {
            ...check,
            patterns: [
              '\\bwhen I\\b|\\bI (?:see|find|coach|tell|recommend|use|program|watch|hear|ask|start|teach)\\b|' +
                '\\bin our (?:gym|classes|programs)\\b|\\bour members\\b|\\bat Helix\\b|' +
                '\\bwe (?:see|coach|find|use|recommend|program|start|teach|scale)\\b',
            ],
          };
        }
        return check;
      }),
    },
    seo: {
      ...defaultScoringConfig.seo,
      internalLinkPrefixes: ['blog', 'programs', 'coaches', 'pricing', 'schedule', 'faq', 'free-class'],
      reading: { good: [6, 9], mehMax: 11 },
      wordCount: { good: [800, 1800], mehMin: 500 },
    },
  },

  citation: {
    policy: 'direct-source-urls',
    forbiddenPatterns: [],
    referenceFormat: 'Author or organization, year. Short description. [link](URL)',
    verifier: { kind: 'none' }, // Claude Code opens every reference link before publishing (see .claude/commands/article.md)
  },

  aeo: {
    brandMentions: ['helix training', 'helixtrain', 'helix gym'],
    localSearchLocation: 'Corvallis, Oregon',
    querySet: [
      { id: 'q1', query: 'best gym in Corvallis Oregon for beginners', tags: ['discovery', 'local'] },
      { id: 'q2', query: 'strength training for people over 50 in Corvallis', tags: ['discovery', 'over-50'] },
      { id: 'q3', query: 'small group strength training Corvallis OR', tags: ['discovery', 'local'] },
      { id: 'q4', query: 'personal trainer Corvallis Oregon', tags: ['discovery', 'local'] },
      { id: 'q5', query: 'is strength training safe after 50', tags: ['education', 'over-50'] },
      { id: 'q6', query: 'CrossFit vs small group strength training which is better for beginners', tags: ['comparison'] },
      { id: 'q7', query: 'how many days a week should a beginner lift weights', tags: ['education'] },
      { id: 'q8', query: 'strength training for bone density women', tags: ['education', 'women-strength'] },
    ],
    engines: ['perplexity', 'anthropic'],
    highPriorityTags: ['discovery', 'local'],
  },

  competitors: {
    ourName: 'Helix Training',
    ourPlaceId: '', // SETUP: same as brand.nap.placeId
    localPackLocation: 'Corvallis, OR',
    roster: [
      { id: 'crossfit-train-97333', name: 'CrossFit Train 97333', url: 'https://crossfittrain97333.com/' },
      { id: 'corvallis-athletics', name: 'Corvallis Athletics CrossFit', url: 'https://corvallisathletics.com/' },
      { id: 'burn-boot-camp-corvallis', name: 'Burn Boot Camp Corvallis', url: 'https://locations.burnbootcamp.com/locations/corvallis-or/' },
      // /competitors discovers and adds more (Orangetheory, F45, boutique studios, Timberhill, etc.)
    ],
    targetKeywords: [
      'gym corvallis',
      'gym corvallis oregon',
      'personal trainer corvallis',
      'strength training corvallis',
      'group fitness classes corvallis',
      'crossfit corvallis',
      'boot camp corvallis',
      'fitness classes for seniors corvallis',
      'beginner gym corvallis',
    ],
    highValuePatterns: ['/blog', '/pricing', '/membership', '/schedule', '/free', '/trial', '/about'],
    skipPatterns: ['/wp-admin', '/cart', '/login', '/privacy', '/terms'],
    templateVendors: [
      { name: 'PushPress', fingerprints: ['pushpress.com', 'Site by PushPress'] },
      { name: 'Webflow', fingerprints: ['website-files.com', 'data-wf-page'] },
      { name: 'Wix', fingerprints: ['wixstatic.com', 'wix-code'] },
      { name: 'Squarespace', fingerprints: ['squarespace.com', 'static1.squarespace'] },
      { name: 'WordPress', fingerprints: ['wp-content', 'wp-includes'] },
      { name: 'Mindbody', fingerprints: ['mindbodyonline.com'] },
      { name: 'Zen Planner', fingerprints: ['zenplanner.com'] },
      { name: 'Wodify', fingerprints: ['wodify.com'] },
    ],
  },

  schema: {
    orgType: ['Organization', 'LocalBusiness', 'HealthClub'],
    org: {
      name: 'Helix Training',
      url: SITE_URL,
      logoUrl: `${SITE_URL}/brand/logo-horizontal.webp`,
      sameAs: [
        'https://www.facebook.com/HelixTrain',
        'https://instagram.com/helixtrain',
      ],
      // Address and phone come from brand.nap above. `extra` is merged verbatim
      // into the LocalBusiness node.
      extra: {
        priceRange: '$$',
        geo: { '@type': 'GeoCoordinates', latitude: 44.591537, longitude: -123.255077 }, // from the Google Maps embed
        // Opening hours are added at build time from site.config.ts once hoursConfirmed is true.
      },
    },
    articleTypes: ['Article'],
    emitLlmsTxt: true,
    llmsTxt: {
      summary: 'Helix Training is a small-group strength and personal training gym in Corvallis, Oregon, owned by a Doctor of Physical Therapy.',
      intro:
        'Programs: personal training, community strength classes, Strength+ (over 50), Strong Foundations (6-week beginner course), and drop-ins. ' +
        'Articles are written by the owner and coaches and cite primary sources.',
      sections: [
        {
          heading: 'Key pages',
          items: [
            { label: 'Programs', url: `${SITE_URL}/programs/` },
            { label: 'Pricing', url: `${SITE_URL}/pricing/` },
            { label: 'Free class', url: `${SITE_URL}/free-class/` },
            { label: 'Coaches', url: `${SITE_URL}/coaches/` },
            { label: 'Blog', url: `${SITE_URL}/blog/` },
          ],
        },
      ],
    },
  },

  compliance: {
    pack: 'none',
    requireHumanReviewTags: ['back-pain', 'knee-pain', 'shoulder-health', 'menopause', 'bone-density'],
  },

  capabilities: {
    drafting: false, // Drafting happens in Claude Code (/article), not through the API pipeline.
    amplify: false,
    audio: false,
    heroImages: false,
    competitiveIntel: true,
    engagementAnalytics: false,
    entityPresence: false,
  },

  services: {
    store: 'fs',
    contentDir: 'src/content/articles',
    analytics: 'none',
    requiredEnv: [], // The site kit's secrets are checked by `npm run check:site`, not by jeldon doctor.
  },
});
