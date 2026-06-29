import { aiService } from './ai.service.js';
import { supabaseService } from './supabase.service.js';
import { walletService } from './wallet.service.js';
import { getDeploymentQueue } from '../queues/queue.js';
import { githubService } from './github.service.js';
import { config } from '../config/index.js';
import { couponService } from './coupon.service.js';

/**
 * Orchestrator service for project-related operations.
 */
export const projectService = {
    /**
     * Deploys a draft project: deducts balance, verifies draft, and marks it as deployed with a slug.
     * 
     * @param {string} userId - The ID of the user.
     * @param {string} projectId - The ID of the draft project.
     * @param {string} slug - The target slug for the landing page.
     * @param {string|null} couponCode - Optional coupon code for discounts.
     */
    async deployDraftProject(userId, projectId, slug, couponCode = null) {
        console.log(`[ProjectService] Starting deployment for draft project ${projectId} by user ${userId} (Kupon: ${couponCode || 'tidak ada'})...`);

        // 1. Verify project
        const project = await supabaseService.getProject(projectId);
        if (!project) throw new Error('Proyek tidak ditemukan.');
        if (project.user_id !== userId) throw new Error('Anda tidak memiliki akses ke proyek ini.');
        if (project.status !== 'draft' && project.status !== 'failed') {
            throw new Error('Proyek sudah dideploy atau sedang dalam proses.');
        }

        // 2. Generate a globally unique final slug by appending a short random suffix.
        const generateFinalSlug = async (baseSlug, attempts = 0) => {
            if (attempts >= 5) {
                throw new Error('Gagal membuat slug unik setelah beberapa percobaan. Silakan coba lagi.');
            }
            const suffix = Math.random().toString(36).substring(2, 6); // e.g. "x7k2"
            const candidate = `${baseSlug}-${suffix}`;
            const existing = await supabaseService.getProjectBySlug(candidate);
            if (existing) {
                return generateFinalSlug(baseSlug, attempts + 1);
            }
            return candidate;
        };

        const finalSlug = await generateFinalSlug(slug);
        console.log(`[ProjectService] Generated unique slug: '${finalSlug}' (from user input: '${slug}')`);

        // Get template type from project data to determine cost dynamically
        let pageConfig = project.page_data;
        if (typeof pageConfig === 'string') {
            try {
                pageConfig = JSON.parse(pageConfig);
            } catch (e) {
                console.error('[ProjectService] Failed to parse page_data JSON:', e);
            }
        }
        const templateType = pageConfig?.meta?.template_type || 'store';

        // Fetch dynamic product cost and status from database
        const product = await supabaseService.getProduct(templateType);
        if (!product) {
            throw new Error(`Tipe template '${templateType}' tidak valid atau belum terdaftar.`);
        }
        if (!product.is_active) {
            throw new Error(`Layanan pembuatan '${product.name}' saat ini sedang dinonaktifkan sementara.`);
        }

        const dynamicCost = product.cost ?? 10000;
        let finalCost = dynamicCost;
        let couponInfo = null;

        // Validate and apply coupon if provided
        if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
            console.log(`[ProjectService] Applying coupon: '${couponCode}'`);
            couponInfo = await couponService.validateCoupon(couponCode, userId);
            
            if (couponInfo.discount_type === 'percentage') {
                const discount = Math.round((dynamicCost * couponInfo.discount_value) / 100);
                finalCost = Math.max(0, dynamicCost - discount);
            } else if (couponInfo.discount_type === 'fixed_amount') {
                finalCost = Math.max(0, dynamicCost - couponInfo.discount_value);
            }
            console.log(`[ProjectService] Coupon applied. Original cost: ${dynamicCost}, Discount: ${dynamicCost - finalCost}, Final cost: ${finalCost}`);
        }

        // 3. Deduct balance first (Fail fast if insufficient funds)
        let transactionId;
        if (finalCost > 0) {
            try {
                const deduction = await walletService.deductBalance(
                    userId,
                    finalCost,
                    'deployment',
                    projectId,
                    `Deployment cost for project: ${project.name}${couponInfo ? ` (Kupon: ${couponInfo.code})` : ''}`
                );
                transactionId = deduction.transactionId;
                console.log(`[ProjectService] Balance deducted: ${finalCost}, Transaction ID: ${transactionId}`);
            } catch (error) {
                if (error.message === 'INSUFFICIENT_FUNDS') {
                    throw new Error(`Saldo tidak cukup untuk mendeploy proyek. Biaya: Rp ${finalCost.toLocaleString('id-ID')}`);
                }
                throw error;
            }
        } else {
            console.log('[ProjectService] Final cost is 0 (100% discounted). Bypassing balance deduction.');
            try {
                const freeTx = await walletService.addTransaction(
                    userId,
                    0,
                    'deployment',
                    `Free deployment (Kupon: ${couponInfo?.code}) for project: ${project.name}`,
                    projectId
                );
                transactionId = freeTx.id;
            } catch (freeErr) {
                console.error('[ProjectService] Failed to record free transaction log:', freeErr.message);
            }
        }

        try {
            // 4. Directly mark as deployed and set slug + live URL
            const templateBaseUrl = process.env.LANDING_PAGE_TEMPLATE_URL || 'http://localhost:5000/?slug=';
            const liveUrl = `${templateBaseUrl}${finalSlug}`;
            
            console.log(`[ProjectService] Marking project ${projectId} as deployed with slug ${finalSlug}...`);
            await supabaseService.deployProject(projectId, finalSlug, liveUrl);

            // 5. Mark transaction as PAID after successful deployment
            if (finalCost > 0 && transactionId) {
                try {
                    await walletService.updateTransactionStatus(transactionId, 'PAID');
                    console.log(`[ProjectService] Transaction ${transactionId} marked as PAID.`);
                } catch (txErr) {
                    console.error(`[ProjectService] Warning: could not update transaction status: ${txErr.message}`);
                }
            }

            // 6. Record coupon usage if applied
            if (couponInfo) {
                try {
                    await couponService.recordUsage(couponInfo.id, userId);
                    console.log(`[ProjectService] Coupon usage recorded for coupon ID ${couponInfo.id}, User ID ${userId}`);
                } catch (couponErr) {
                    console.error(`[ProjectService] Failed to record coupon usage: ${couponErr.message}`);
                }
            }

            return {
                success: true,
                projectId,
                liveUrl,
                finalSlug,
                message: 'Proyek berhasil dideploy.',
            };
        } catch (error) {
            console.error(`[ProjectService] Error during direct deployment: ${error.message}`);

            // Rollback: Refund balance if execution fails
            if (finalCost > 0) {
                try {
                    console.log(`[ProjectService] Attempting to refund ${finalCost} credits to user ${userId}...`);
                    await walletService.addTransaction(
                        userId,
                        finalCost,
                        'refund',
                        `Refund for failed deployment: ${project.name}`
                    );
                    console.log(`[ProjectService] Refund successful.`);
                } catch (refundError) {
                    console.error(`[ProjectService] CRITICAL: Refund failed for user ${userId}: ${refundError.message}`);
                }
            }

            // Re-throw original error
            throw error;
        }
    },

    /**
     * Retries enabling GitHub Pages for an existing project.
     * 
     * @param {string} userId - The ID of the user.
     * @param {string} projectId - The ID of the project.
     */
    async retryGitHubPages(userId, projectId) {
        console.log(`[ProjectService] Retrying GitHub Pages for project ${projectId}...`);

        const project = await supabaseService.getProject(projectId);
        if (!project) throw new Error('Proyek tidak ditemukan.');
        if (project.user_id !== userId) throw new Error('Anda tidak memiliki akses ke proyek ini.');
        
        if (!project.repo_url) {
            throw new Error('Repository belum dibuat. Tidak bisa mengaktifkan Pages.');
        }

        const parts = project.repo_url.split('/');
        const repoName = parts[parts.length - 1];

        await githubService.enablePages(config.GITHUB_ORG_NAME, repoName);

        return {
            success: true,
            message: 'Aktivasi GitHub Pages sedang diulang.',
        };
    },

    /**
     * Updates an already deployed project (Specifically for wedding templates).
     * Has a strict edit limit of 3 edits.
     * 
     * @param {string} userId - The ID of the user requesting edit.
     * @param {string} projectId - The ID of the project to update.
     * @param {Object} pageData - The new page content JSON data.
     */
    async editDeployedProject(userId, projectId, pageData) {
        console.log(`[ProjectService] User ${userId} editing deployed project ${projectId}...`);

        // 1. Fetch project
        const project = await supabaseService.getProject(projectId);
        if (!project) throw new Error('Proyek tidak ditemukan.');
        if (project.user_id !== userId) throw new Error('Anda tidak memiliki akses ke proyek ini.');
        
        // 2. Validate status
        if (project.status !== 'deployed') {
            throw new Error('Hanya proyek yang sudah dipublikasikan yang dapat diedit di sini.');
        }

        // 3. Validate template type
        let currentConfig = project.page_data;
        if (typeof currentConfig === 'string') {
            try {
                currentConfig = JSON.parse(currentConfig);
            } catch (e) {
                console.error('[ProjectService] Failed to parse page_data JSON:', e);
            }
        }
        const templateType = currentConfig?.meta?.template_type || 'store';
        if (templateType !== 'wedding' && templateType !== 'birthday' && templateType !== 'toko-online' && templateType !== 'campaign') {
            throw new Error('Hanya tipe undangan pernikahan, ulang tahun, toko online, dan campaign yang diizinkan untuk diedit pasca-publikasi.');
        }

        // 4. Check edit quota limit
        const currentEdits = project.edit_count || 0;
        if (currentEdits >= 3) {
            throw new Error('Batas maksimal edit (3x) telah tercapai. Silakan hubungi admin untuk melakukan perubahan.');
        }

        // 5. Build dynamic names update based on wedding/birthday/toko-online/campaign details name fields
        const newEditCount = currentEdits + 1;
        let newProjectName = project.name;
        if (templateType === 'wedding' && pageData?.content?.groom?.nickname && pageData?.content?.bride?.nickname) {
            newProjectName = `Undangan ${pageData.content.groom.nickname} & ${pageData.content.bride.nickname}`;
        } else if (templateType === 'birthday' && pageData?.content?.celebrant?.nickname) {
            newProjectName = `Undangan Ulang Tahun ${pageData.content.celebrant.nickname}`;
        } else if (templateType === 'toko-online' && pageData?.content?.store?.name) {
            newProjectName = `Toko ${pageData.content.store.name}`;
        } else if (templateType === 'campaign' && pageData?.content?.hero?.headline) {
            newProjectName = `Campaign ${pageData.content.hero.headline.substring(0, 30)}`;
        }

        // 6. Update database
        const updatedProject = await supabaseService.updateDeployedProject(projectId, userId, {
            name: newProjectName,
            pageData: pageData,
            editCount: newEditCount
        });

        console.log(`[ProjectService] Deployed project ${projectId} updated. New edit_count: ${newEditCount}`);

        return {
            success: true,
            projectId,
            editCount: newEditCount,
            message: 'Perubahan berhasil disimpan.',
            data: updatedProject
        };
    },
};
