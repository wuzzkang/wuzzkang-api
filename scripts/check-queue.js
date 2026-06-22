import { Queue } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();

const redisConnection = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
};

async function checkQueue() {
    const queue = new Queue('deployment-queue', { connection: redisConnection });

    const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
    ]);

    console.log('Queue Status:');
    console.log('- Waiting:', waiting);
    console.log('- Active:', active);
    console.log('- Completed:', completed);
    console.log('- Failed:', failed);

    if (failed > 0) {
        const failedJobs = await queue.getFailed();
        console.log('\nLatest Failed Job Error:');
        console.log(failedJobs[failedJobs.length - 1]?.failedReason);
    }

    process.exit(0);
}

checkQueue();
