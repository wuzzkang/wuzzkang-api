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

const WEDDING_SYSTEM_PROMPT = `You are a creative copywriter and UI theme designer for WuzzKang wedding invitations.

Your task is to output a SINGLE valid JSON object based on the user's prompt (which describes theme/color preferences or quotes).
Do not include any markdown, code blocks, or extra text.

The JSON object MUST strictly follow this structure:
{
  "theme": "sage-green | rose-gold | elegant-navy | classic-gold | rustic-brown",
  "quote": "string (a beautiful romantic or religious marriage quote/prayer, 30-250 characters)"
}

Rules:
- Keep the quote concise, meaningful, and romantic.
- Choose the theme that matches the user's color or stylistic request. If none matches, default to "classic-gold".
- Output ONLY the raw JSON object.`;

/**
 * Generates a complete landing page JSON object using the Sumopod AI API.
 * The response is validated against the PageSchema before being returned.
 *
 * @param {string} prompt - The user-provided description or niche for the landing page.
 * @param {string} [templateType='store'] - The type of template: 'store' or 'wedding'.
 * @param {object} [weddingDetails=null] - Pre-structured wedding info (names, dates, locations) to merge with AI output.
 * @returns {Promise<import('../utils/schema.js').PageSchema>} Validated landing page data.
 * @throws {Error} If the API call fails, JSON parsing fails, or schema validation fails.
 */
export async function generateLandingPage(prompt, templateType = 'store', weddingDetails = null) {
  const client = getAIClient();
  let rawContent;

  if (templateType === 'wedding') {
    if (!weddingDetails) {
      throw new Error('weddingDetails is required for wedding template type.');
    }

    // Bypass LLM completely if prompt is empty
    if (!prompt || !prompt.trim()) {
      const designKey = weddingDetails.design_key || 'sage-green';
      const theme = weddingDetails.theme || designKey;
      const finalData = {
        meta: {
          title: `Undangan Pernikahan ${weddingDetails.groom?.nickname || 'Groom'} & ${weddingDetails.bride?.nickname || 'Bride'}`,
          theme: theme,
          template_type: 'wedding',
          design_key: designKey,
        },
        content: {
          ...weddingDetails,
          quote: weddingDetails.quote || 'Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu isteri-isteri dari jenismu sendiri, supaya kamu cenderung dan merasa tenteram kepadanya, dan dijadikan-Nya diantaramu rasa kasih dan sayang. (Ar-Rum: 21)',
        },
      };

      const validation = PageSchema.safeParse(finalData);
      if (!validation.success) {
        const issues = validation.error.flatten();
        console.error('[ai.service] PageSchema validation failed (no-prompt):', JSON.stringify(issues, null, 2));
        throw new Error(
          `AI output failed schema validation: ${JSON.stringify(issues.fieldErrors)}`
        );
      }
      return validation.data;
    }
  }

  try {
    const activeSystemPrompt = templateType === 'wedding' ? WEDDING_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const userPrompt = templateType === 'wedding'
      ? `Generate wedding theme and quote for preference: ${prompt}`
      : `Generate a landing page for: ${prompt}`;

    const completion = await client.chat.completions.create({
      model: config.AI_PROVIDER === 'groq' ? 'llama-3.3-70b-versatile' : 'meta-llama/llama-4-maverick:free',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: activeSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    rawContent = completion.choices[0]?.message?.content;

    if (!rawContent) {
      throw new Error('AI returned an empty response.');
    }
  } catch (err) {
    console.error('[ai.service] AI call failed:', { message: err.message });
    throw new Error(`AI API call failed: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    console.error('[ai.service] Failed to parse AI JSON response:', rawContent);
    throw new Error('AI returned malformed JSON that could not be parsed.');
  }

  // Construct and validate final object depending on template type
  let finalData;
  if (templateType === 'wedding') {
    const designKey = weddingDetails.design_key || (parsed.theme === 'floral-pink' ? 'floral-pink' : 'sage-green');
    finalData = {
      meta: {
        title: `Undangan Pernikahan ${weddingDetails.groom?.nickname || 'Groom'} & ${weddingDetails.bride?.nickname || 'Bride'}`,
        theme: parsed.theme || designKey,
        template_type: 'wedding',
        design_key: designKey,
      },
      content: {
        ...weddingDetails,
        quote: parsed.quote || 'Semoga menjadi keluarga yang sakinah, mawaddah, warahmah.',
      },
    };
  } else {
    finalData = parsed;
    // ensure template_type is set for consistency
    if (finalData.meta) {
      finalData.meta.template_type = 'store';
    }
  }

  const validation = PageSchema.safeParse(finalData);
  if (!validation.success) {
    const issues = validation.error.flatten();
    console.error('[ai.service] PageSchema validation failed:', JSON.stringify(issues, null, 2));
    throw new Error(
      `AI output failed schema validation: ${JSON.stringify(issues.fieldErrors)}`
    );
  }

  return validation.data;
}

/**
 * Named service object export for consistency with other services (e.g., walletService, supabaseService).
 * Allows `import { aiService } from './ai.service.js'` and `aiService.generateLandingPage(...)`.
 */
export const aiService = {
  generateLandingPage,
};
