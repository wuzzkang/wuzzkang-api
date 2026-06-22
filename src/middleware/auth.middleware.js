import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY || config.SUPABASE_SERVICE_KEY);

/**
 * Middleware to authenticate requests using Supabase JWT.
 * It expects the token in the `Authorization: Bearer <TOKEN>` header.
 */
export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Missing or invalid Authorization header'
            });
        }

        const token = authHeader.split(' ')[1];
        
        // Verify token with Supabase GoTrue
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.error(`[AuthMiddleware] Token verification failed: ${error?.message}`);
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Invalid token'
            });
        }

        // Attach user to request object
        req.user = { id: user.id };
        next();
    } catch (err) {
        console.error(`[AuthMiddleware] Unexpected error: ${err.message}`);
        return res.status(500).json({
            success: false,
            error: 'Internal server error during authentication'
        });
    }
};
