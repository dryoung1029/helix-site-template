/**
 * Content collections. Articles use the schema derived from jeldon.config.ts
 * (add a category there and it flows here). Programs, coaches and FAQs are
 * the site kit's own collections.
 */
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { buildArticleSchema } from '@jeldon/content-model';
import { pack } from './lib/pack';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: buildArticleSchema(pack),
});

const programs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/programs' }),
  schema: z.object({
    name: z.string(),
    /** One line under the name on listings. */
    tagline: z.string(),
    /** Who this is for, in a few words. Shown on listings. */
    audience: z.string(),
    /** Ordering on the programs page (lower first). */
    order: z.number().default(50),
    /** Key in site.config pushpress.plans, or a full URL. Blank = contact form. */
    signupPlanKey: z.string().optional(),
    signupUrl: z.string().url().optional(),
    signupLabel: z.string().default('Try a free class'),
    price: z.string().optional(),
    duration: z.string().optional(),
    format: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    draft: z.boolean().default(false),
  }),
});

const coaches = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coaches' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    credentials: z.string().optional(),
    order: z.number().default(50),
    photo: z.string().optional(),
    photoAlt: z.string().optional(),
    specialties: z.array(z.string()).default([]),
    /** Link to a personal page, Instagram, etc. */
    links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    draft: z.boolean().default(false),
  }),
});

const faqs = defineCollection({
  loader: file('./src/content/faqs.json'),
  schema: z.object({
    /** Which page(s) show this FAQ: home, faq, free-class, pricing, or a program slug. */
    pages: z.array(z.string()),
    order: z.number().default(50),
    question: z.string(),
    answer: z.string(),
  }),
});

export const collections = { articles, programs, coaches, faqs };
