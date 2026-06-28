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
 * Schema for metadata of the store landing page.
 */
const MetaSchema = z.object({
    title: z.string().min(3).max(80).describe('Page browser tab title'),
    theme: z.enum(['light', 'dark', 'corporate', 'retro', 'cyberpunk']).describe('DaisyUI theme name'),
    template_type: z.literal('store').default('store'),
});

/**
 * Zod schema for the store template landing page JSON.
 */
const StorePageSchema = z.object({
    meta: MetaSchema,
    content: ContentSchema,
    features: z
        .array(FeatureSchema)
        .min(2)
        .max(6)
        .describe('List of 2-6 feature highlights'),
});

/**
 * Zod schema for the wedding template landing page JSON.
 */
const WeddingPageSchema = z.object({
    meta: z.object({
        title: z.string().min(3).max(80).describe('Page browser tab title'),
        theme: z.enum(['sage-green', 'rose-gold', 'elegant-navy', 'classic-gold', 'rustic-brown', 'floral-pink']).describe('Wedding color theme name'),
        template_type: z.literal('wedding'),
        design_key: z.enum(['sage-green', 'floral-pink']).default('sage-green'),
    }),
    content: z.object({
        groom: z.object({
            name: z.string().min(2).max(100),
            nickname: z.string().min(1).max(50),
            father: z.string().min(2).max(100),
            mother: z.string().min(2).max(100),
            image_url: z.string().optional().nullable(),
        }),
        bride: z.object({
            name: z.string().min(2).max(100),
            nickname: z.string().min(1).max(50),
            father: z.string().min(2).max(100),
            mother: z.string().min(2).max(100),
            image_url: z.string().optional().nullable(),
        }),
        story: z.array(z.object({
            title: z.string().min(1).max(100),
            date: z.string().min(1).max(50),
            desc: z.string().min(1).max(500),
            image_url: z.string().optional().nullable(),
        })).optional().nullable(),
        akad: z.object({
            date: z.string(),
            time: z.string(),
            location: z.string().min(3).max(200),
            maps_url: z.string().optional().nullable(),
        }),
        resepsi: z.object({
            date: z.string(),
            time: z.string(),
            location: z.string().min(3).max(200),
            maps_url: z.string().optional().nullable(),
        }),
        gift: z.object({
            bank_name: z.string().max(50).optional().nullable(),
            account_number: z.string().max(50).optional().nullable(),
            account_holder: z.string().max(100).optional().nullable(),
        }).optional().nullable(),
        quote: z.string().min(10).max(500).describe('AI-generated romantic quote or prayer'),
    }),
});

/**
 * Zod schema for the birthday template landing page JSON.
 */
const BirthdayPageSchema = z.object({
    meta: z.object({
        title: z.string().min(3).max(80).describe('Page browser tab title'),
        theme: z.enum(['cute-balloon', 'elegant-gold']).describe('Birthday color theme name'),
        template_type: z.literal('birthday'),
        design_key: z.enum(['cute-balloon', 'elegant-gold']).default('cute-balloon'),
    }),
    content: z.object({
        celebrant: z.object({
            name: z.string().min(2).max(100),
            nickname: z.string().min(1).max(50),
            age: z.string().min(1).max(50).describe('e.g. "5th" or "17th" or "Sweet Seventeen"'),
            parent_name: z.string().max(100).optional().nullable(),
            image_url: z.string().optional().nullable(),
            gender: z.enum(['male', 'female']).optional().nullable(),
        }),
        event: z.object({
            date: z.string(),
            time: z.string(),
            location: z.string().min(3).max(200),
            maps_url: z.string().optional().nullable(),
        }),
        gift: z.object({
            bank_name: z.string().max(50).optional().nullable(),
            account_number: z.string().max(50).optional().nullable(),
            account_holder: z.string().max(100).optional().nullable(),
        }).optional().nullable(),
        quote: z.string().min(10).max(500).describe('Birthday wishes or quote'),
    }),
});

/**
 * Master Zod union schema. Automatically detects store vs wedding vs birthday based on template_type.
 */
export const PageSchema = z.union([StorePageSchema, WeddingPageSchema, BirthdayPageSchema]);
