import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

/**
 * Supabase client instance.
 * Initialized with URL and Service Key for backend operations.
 */
const supabase = createClient(
    config.SUPABASE_URL || '',
    config.SUPABASE_SERVICE_KEY || ''
);

/**
 * Service for managing projects in Supabase.
 */
export const supabaseService = {
    /**
     * Saves a new project to the database.
     * 
     * @param {string} userId - The ID of the user owning the project.
     * @param {Object} projectData - The project details (name, pageData, etc.).
     * @returns {Promise<Object>} The saved project data.
     */
    async saveProject(userId, projectData) {
        const { data, error } = await supabase
            .from('projects')
            .insert([
                {
                    user_id: userId,
                    name: projectData.name,
                    page_data: projectData.pageData,
                    repo_url: projectData.repoUrl || null,
                    status: 'draft',
                },
            ])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Retrieves a project by ID.
     * 
     * @param {string} projectId - The ID of the project.
     * @returns {Promise<Object>} The project data.
     */
    async getProject(projectId) {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Lists all projects for a specific user.
     * 
     * @param {string} userId - The ID of the user.
     * @returns {Promise<Array>} List of projects.
     */
    async listProjects(userId) {
        const { data, error } = await supabase
            .from('projects')
            .select('id, user_id, name, repo_url, live_url, status, created_at, updated_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Updates the status of a project.
     * 
     * @param {string} projectId - The ID of the project.
     * @param {string} status - The new status (e.g., 'deployed', 'failed').
     * @returns {Promise<Object>} The updated project data.
     */
    async updateProjectStatus(projectId, status) {
        const { data, error } = await supabase
            .from('projects')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Updates the repository URL of a project.
     * 
     * @param {string} projectId - The ID of the project.
     * @param {string} repoUrl - The URL of the GitHub repository.
     * @returns {Promise<Object>} The updated project data.
     */
    async updateProjectRepoUrl(projectId, repoUrl) {
        const { data, error } = await supabase
            .from('projects')
            .update({ repo_url: repoUrl, updated_at: new Date().toISOString() })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Updates the live URL of a project.
     * 
     * @param {string} projectId - The ID of the project.
     * @param {string} liveUrl - The live URL of the published project.
     * @returns {Promise<Object>} The updated project data.
     */
    async updateProjectLiveUrl(projectId, liveUrl) {
        const { data, error } = await supabase
            .from('projects')
            .update({ live_url: liveUrl, updated_at: new Date().toISOString() })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Checks if a transaction with the given orderId already exists.
     * 
     * @param {string} orderId - The unique order identifier.
     * @returns {Promise<boolean>} True if it exists, false otherwise.
     */
    async checkTransactionExists(orderId) {
        if (!orderId) return false;

        const { data, error } = await supabase
            .from('transactions')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle();

        if (error) throw error;
        return !!data;
    },

    /**
     * Retrieves a user profile by ID.
     * 
     * @param {string} userId - The ID of the user.
     * @returns {Promise<Object>} The profile data.
     */
    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, balance, email, full_name, avatar_url, updated_at')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Retrieves a project by its slug.
     * 
     * @param {string} slug - The slug of the project.
     * @returns {Promise<Object|null>} The project data or null.
     */
    async getProjectBySlug(slug) {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Deploys a project directly by updating status, slug, and live_url.
     * 
     * @param {string} projectId - The ID of the project.
     * @param {string} slug - The deployment slug.
     * @param {string} liveUrl - The URL of the live landing page.
     * @returns {Promise<Object>} The updated project data.
     */
    async deployProject(projectId, slug, liveUrl) {
        const { data, error } = await supabase
            .from('projects')
            .update({
                slug,
                status: 'deployed',
                live_url: liveUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },
};

