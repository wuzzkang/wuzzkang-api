import { z } from 'zod';

/**
 * Schema for a single feature item in the landing page.
 */
const FeatureSchema = z.object({
    icon: z.string().max(10).describe('Emoji or short icon string, e.g. "🚀"'),
    title: z.string().min(3).max(60).describe('Feature title'),
    desc: z.string().min(10).max(200).describe('Feature description'),
});

/**
 * Schema for the content section of the landing page.
 */
const ContentSchema = z.object({
    hero: z.object({
        heading: z.string().min(5).max(100).describe('Main hero heading'),
        subheading: z.string().min(10).max(200).describe('Supporting sub-headline'),
        cta_text: z.string().min(2).max(50).describe('Call-to-action button text'),
    }),
});

/**
 * Schema for metadata of the landing page.
 */
const MetaSchema = z.object({
    title: z.string().min(3).max(80).describe('Page browser tab title'),
    theme: z.enum(['light', 'dark', 'corporate', 'retro', 'cyberpunk']).describe('DaisyUI theme name'),
});

/**
 * Master Zod schema for the AI-generated landing page JSON.
 * This is the source of truth for what the AI must produce.
 */
export const PageSchema = z.object({
    meta: MetaSchema,
    content: ContentSchema,
    features: z
        .array(FeatureSchema)
        .min(2)
        .max(6)
        .describe('List of 2-6 feature highlights'),
});
