import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
    PORT: z.string().default('3000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    // AI Configuration
    AI_PROVIDER: z.enum(['sumopod', 'groq']).default('sumopod'),
    SUMOPOD_API_KEY: z.string(),
    GROQ_API_KEY: z.string().optional(),
    // Required for Supabase (will be enforced once supabase.service.js is added)
    // Can be a local path or URL
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_KEY: z.string().optional(),
    // Optional for now - will be enforced once OpenAI direct integration is added
    OPENAI_API_KEY: z.string().optional(),
    // Required for GitHub deployment service
    GITHUB_TOKEN: z.string().optional(),
    GITHUB_TEMPLATE_REPO: z.string(),
    GITHUB_ORG_NAME: z.string().default('wuzzkang'),
    // Queue - has a default
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    // Payment Configuration
    PAYMENT_PROVIDER: z.enum(['winpay', 'dummy']).default('dummy'),
    // Winpay Configuration
    WINPAY_PARTNER_ID: z.string().optional(),
    WINPAY_BASE_URL: z.string().url().optional(),
    WINPAY_PUBLIC_KEY: z.string().optional(),
    BYPASS_PAYMENT_SIGNATURE: z.string().optional(),
});

const parsedConfig = configSchema.safeParse(process.env);

if (!parsedConfig.success) {
    console.error('❌ Invalid environment variables:', parsedConfig.error.format());
    process.exit(1);
}

export const config = parsedConfig.data;
