import { generateLandingPage } from '../src/services/ai.service.js';
import { config } from '../src/config/index.js';

/**
 * Phase 1 Test for Groq AI Integration.
 * Prompt: 'Jasa cuci sepatu premium di Surabaya'
 */
async function runTest() {
    console.log('🚀 [PHASE 1 TEST] Starting Groq AI Integration Test...');
    console.log(`🔍 [CONFIG] AI_PROVIDER: ${config.AI_PROVIDER}`);

    if (config.AI_PROVIDER !== 'groq') {
        console.error('❌ ERROR: AI_PROVIDER must be set to "groq" in .env for this test.');
        process.exit(1);
    }

    const prompt = 'Jasa cuci sepatu premium di Surabaya';
    console.log(`📝 [PROMPT] "${prompt}"\n`);

    try {
        const result = await generateLandingPage(prompt);
        console.log('✅ [SUCCESS] Groq generated a valid landing page JSON:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ [FAILED] Test failed with error:');
        console.error(error.message);

        // Self-correction logic hints
        if (error.message.includes('404') || error.message.includes('baseURL')) {
            console.log('\n💡 [HINT] Check baseURL in src/services/ai.service.js for Groq.');
        }
        if (error.message.includes('JSON')) {
            console.log('\n💡 [HINT] Groq might be returning malformed JSON or extra text.');
        }

        process.exit(1);
    }
}

runTest();
