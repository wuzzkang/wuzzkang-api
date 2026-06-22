import { Octokit } from 'octokit';
import { config } from '../config/index.js';

const octokit = new Octokit({
    auth: config.GITHUB_TOKEN,
});

/**
 * Service for managing GitHub repositories and deployments.
 */
export const githubService = {
    /**
   * Creates a new repository from a template in the configured organization.
   * 
   * @param {string} templateRepo - The name of the template repository.
   * @param {string} newRepoName - The name of the new repository to create.
   * @returns {Promise<Object>} The created repository data.
   */
    async createRepoFromTemplate(templateRepo, newRepoName) {
        const org = config.GITHUB_ORG_NAME;
        try {
            const response = await octokit.rest.repos.createUsingTemplate({
                template_owner: org,
                template_repo: templateRepo,
                name: newRepoName,
                owner: org,
                private: false,
            });
            return response.data;
        } catch (error) {
            console.error(`[GitHubService] Error creating repo from template: ${error.message}`);
            throw error;
        }
    },

    /**
     * Checks if a repository already exists.
     * 
     * @param {string} repo - The name of the repository.
     * @returns {Promise<boolean>} True if it exists, false otherwise.
     */
    async checkRepoExists(repo) {
        const owner = config.GITHUB_ORG_NAME;
        try {
            await octokit.rest.repos.get({
                owner,
                repo,
            });
            return true;
        } catch (error) {
            if (error.status === 404) return false;
            throw error;
        }
    },

    /**
     * Updates content.json in the repository with new data.
     * 
     * @param {string} repo - The name of the repository.
     * @param {Object} data - The JSON data to update.
     * @param {string} message - The commit message.
     */
    async updateFileInRepo(repo, data, message = 'Update content.json') {
        const owner = config.GITHUB_ORG_NAME;
        const path = 'content.json';

        try {
            // Get the file SHA if it exists
            let sha;
            try {
                const { data: fileData } = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path,
                });
                sha = fileData.sha;
            } catch (e) {
                // File doesn't exist yet
            }

            await octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path,
                message,
                content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
                sha,
            });
        } catch (error) {
            console.error(`[GitHubService] Error updating content.json: ${error.message}`);
            throw error;
        }
    },

    /**
   * Deletes a repository.
   * 
   * @param {string} repo - The name of the repository to delete.
   */
    async deleteRepo(repo) {
        const owner = config.GITHUB_ORG_NAME;
        try {
            await octokit.rest.repos.delete({
                owner,
                repo,
            });
        } catch (error) {
            console.error(`[GitHubService] Error deleting repo: ${error.message}`);
            throw error;
        }
    },

    /**
     * Enables GitHub Pages for a repository.
     * 
     * @param {string} owner - The owner of the repository.
     * @param {string} repo - The name of the repository.
     * @param {string} branch - The branch to use for Pages (default: 'main').
     */
    async enablePages(owner, repo, branch = 'main') {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Wait a bit before trying to enable Pages, as repo creation from template takes a moment
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                await octokit.rest.repos.createPagesSite({
                    owner,
                    repo,
                    source: {
                        branch,
                        path: '/',
                    },
                });
                console.log(`[GitHubService] Pages enabled successfully for ${repo}`);
                return;
            } catch (error) {
                console.warn(`[GitHubService] Attempt ${attempt} enabling Pages failed: ${error.message}`);
                if (attempt === maxRetries) {
                    // It might already be enabled or fail for other reasons
                }
            }
        }
    },

    /**
     * Gets the authenticated user's login.
     * 
     * @returns {Promise<string>} The login name.
     */
    async getAuthenticatedUser() {
        const { data } = await octokit.rest.users.getAuthenticated();
        return data.login;
    }
};
