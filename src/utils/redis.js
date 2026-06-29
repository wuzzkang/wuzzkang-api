import Redis from 'ioredis';
import { config } from '../config/index.js';

let redisClient = null;

/**
 * Gets or initializes the Redis client instance.
 * @returns {Redis}
 */
export function getRedisClient() {
    if (!redisClient) {
        redisClient = new Redis(config.REDIS_URL, {
            maxRetriesPerRequest: null,
        });
        redisClient.on('error', (err) => {
            console.error('[Redis] Connection error:', err.message);
        });
    }
    return redisClient;
}
