import { Queue } from 'bullmq';
import { config } from '../config/index.js';

/**
 * Redis connection configuration.
 */
export const redisConnection = {
    url: config.REDIS_URL,
};

let queueInstance = null;

/**
 * Gets or initializes the deployment queue (Lazy Initialization).
 * 
 * @returns {Queue}
 */
export function getDeploymentQueue() {
    if (!queueInstance) {
        queueInstance = new Queue('deployment-queue', {
            connection: redisConnection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        });
    }
    return queueInstance;
}
