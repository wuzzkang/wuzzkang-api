import OpenAI from 'openai';
import { config } from '../config/index.js';
import { PageSchema } from '../utils/schema.js';

/**
 * Factory function to initialize the AI client based on the configured provider.
 * 
 * @returns {OpenAI} An instance of the OpenAI SDK client.
 * @throws {Error} If the provider is unknown or required keys are missing.
 */
function getAIClient() {
  const { AI_PROVIDER, SUMOPOD_API_KEY, GROQ_API_KEY } = config;

  if (AI_PROVIDER === 'sumopod') {
    return new OpenAI({
      apiKey: SUMOPOD_API_KEY,
      baseURL: 'https://ai.sumopod.com/v1',
    });
  }

  if (AI_PROVIDER === 'groq') {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is required when AI_PROVIDER is set to "groq"');
    }
    return new OpenAI({
      apiKey: GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  throw new Error(`Unknown AI_PROVIDER: ${AI_PROVIDER}`);
}

const SYSTEM_PROMPT = `You are a landing page content generator for a SaaS platform called WuzzKang.

Your task is to output a SINGLE valid JSON object — no markdown, no code blocks, no extra text.

The JSON object MUST strictly follow this structure:
{
  "meta": {
    "title": "string (3-80 chars)",
    "theme": "light | dark | corporate | retro | cyberpunk"
  },
  "content": {
    "hero": {
      "heading": "string (5-100 chars)",
      "subheading": "string (10-200 chars)",
      "cta_text": "string (2-50 chars)"
    }
  },
  "features": [
    {
      "icon": "string (emoji)",
      "title": "string (3-60 chars)",
      "desc": "string (10-200 chars)"
    }
  ]
}

Rules:
- features array must have 3-5 items.
- All strings must obey the character limits.
- Output ONLY the raw JSON object.`;

/**
 * Generates a complete landing page JSON object using the Sumopod AI API.
 * The response is validated against the PageSchema before being returned.
 *
 * @param {string} prompt - The user-provided description or niche for the landing page.
 * @returns {Promise<import('../utils/schema.js').PageSchema>} Validated landing page data.
 * @throws {Error} If the API call fails, JSON parsing fails, or schema validation fails.
 */
export async function generateLandingPage(prompt) {
  const client = getAIClient();
  let rawContent;

  try {
    const completion = await client.chat.completions.create({
      model: config.AI_PROVIDER === 'groq' ? 'llama-3.3-70b-versatile' : 'meta-llama/llama-4-maverick:free',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Generate a landing page for: ${prompt}` },
      ],
    });

    rawContent = completion.choices[0]?.message?.content;

    if (!rawContent) {
      throw new Error('AI returned an empty response.');
    }
  } catch (err) {
    console.error('[ai.service] Sumopod API call failed:', { message: err.message });
    throw new Error(`AI API call failed: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    console.error('[ai.service] Failed to parse AI JSON response:', rawContent);
    throw new Error('AI returned malformed JSON that could not be parsed.');
  }

  const validation = PageSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.flatten();
    console.error('[ai.service] PageSchema validation failed:', JSON.stringify(issues, null, 2));
    throw new Error(
      `AI output failed schema validation: ${JSON.stringify(issues.fieldErrors)}`
    );
  }

  return validation.data;
}
