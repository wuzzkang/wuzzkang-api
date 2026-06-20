import { getDeploymentQueue } from '../src/queues/queue.js';
import { startDeployWorker } from '../src/queues/deployWorker.js';
import { supabaseService } from '../src/services/supabase.service.js';
import { githubService } from '../src/services/github.service.js';
import { config } from '../src/config/index.js';
import { Octokit } from 'octokit';

const octokit = new Octokit({ auth: config.GITHUB_TOKEN });

/**
 * E2E Test for Phase 2: GitHub Orchestration.
 */
async function runE2ETest() {
    console.log('🚀 [E2E TEST] Starting Phase 2 GitHub Orchestration Test...');

    // Start worker
    const worker = startDeployWorker();
    console.log('👷 [WORKER] Worker started.');

    const testRepoName = `test-wuzzkang-project-${Math.floor(Math.random() * 10000)}`;
    const dummyUserId = '00000000-0000-0000-0000-000000000000'; // Dummy UUID
    const dummyPageData = {
        meta: { title: 'Test Project', theme: 'light' },
        content: { hero: { heading: 'Hello World', subheading: 'Test Subheading', cta_text: 'Click Me' } },
        features: [{ icon: '🚀', title: 'Fast', desc: 'Very fast' }]
    };

    let projectId;

    try {
        // 1. Setup Supabase Dummy Project
        console.log('📦 [STEP 1] Creating dummy project in Supabase...');
        const project = await supabaseService.saveProject(dummyUserId, {
            name: testRepoName,
            pageData: dummyPageData
        });
        projectId = project.id;
        console.log(`✅ Project created with ID: ${projectId}`);

        // 2. Trigger Queue
        console.log('📨 [STEP 2] Adding job to deployment-queue...');
        const queue = getDeploymentQueue();
        await queue.add('deploy-job', {
            projectId,
            pageData: dummyPageData,
            repoName: testRepoName
        });
        console.log('✅ Job added to queue.');

        // 3. Wait for processing (Polling Supabase status)
        console.log('⏳ [STEP 3] Waiting for worker to process (polling Supabase)...');
        let status = 'draft';
        let attempts = 0;
        while (status === 'draft' && attempts < 12) { // Wait up to 60 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedProject = await supabaseService.getProject(projectId);
            status = updatedProject.status;
            attempts++;
            console.log(`... attempt ${attempts}: status is '${status}'`);
        }

        if (status !== 'deployed') {
            throw new Error(`Deployment failed or timed out. Final status: ${status}`);
        }
        console.log('✅ Supabase status updated to "deployed".');

        // 4. Verify GitHub Repo
        console.log(`🔍 [STEP 4] Verifying GitHub repo ${config.GITHUB_ORG_NAME}/${testRepoName}...`);
        const { data: repoData } = await octokit.rest.repos.get({
            owner: config.GITHUB_ORG_NAME,
            repo: testRepoName
        });
        console.log(`✅ Repo exists: ${repoData.html_url}`);

        // 5. Verify content.json
        console.log('📄 [STEP 5] Verifying content.json in repo...');
        const { data: fileData } = await octokit.rest.repos.getContent({
            owner: config.GITHUB_ORG_NAME,
            repo: testRepoName,
            path: 'content.json'
        });
        const content = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
        if (content.meta.title !== dummyPageData.meta.title) {
            throw new Error('content.json title mismatch!');
        }
        console.log('✅ content.json is valid.');

        console.log('\n✨ [RESULT] Test Result: PASSED');

    } catch (error) {
        console.error(`\n❌ [RESULT] Test Result: FAILED - ${error.message}`);
    } finally {
        // 6. Cleanup
        if (testRepoName) {
            console.log(`\n🧹 [CLEANUP] Deleting test repo ${testRepoName}...`);
            try {
                await githubService.deleteRepo(testRepoName);
                console.log('✅ Repo deleted.');
            } catch (e) {
                console.error(`⚠️ Cleanup failed: ${e.message}`);
            }
        }

        if (worker) {
            console.log('🛑 [WORKER] Stopping worker...');
            await worker.close();
        }

        process.exit(0);
    }
}

runE2ETest();
