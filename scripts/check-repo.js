import { Octokit } from 'octokit';
import { config } from '../src/config/index.js';

const octokit = new Octokit({ auth: config.GITHUB_TOKEN });

async function checkRepo() {
    const org = config.GITHUB_ORG_NAME;
    const repo = config.GITHUB_TEMPLATE_REPO;
    console.log(`Checking access to ${org}/${repo}...`);
    try {
        const { data } = await octokit.rest.repos.get({
            owner: org,
            repo: repo
        });
        console.log(`✅ Success! Repo found: ${data.full_name}`);
        console.log(`Is template: ${data.is_template}`);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
}

checkRepo();
