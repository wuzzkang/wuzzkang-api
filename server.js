import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './src/config/index.js';
import { errorMiddleware } from './src/middleware/errorMiddleware.js';
import { authMiddleware } from './src/middleware/auth.middleware.js';
import generatorRoute from './src/routes/generator.route.js';
import deployRoute from './src/routes/deploy.route.js';
import projectRoute from './src/routes/project.route.js';
import paymentRoute from './src/routes/payment.route.js';
import profileRoute from './src/routes/profile.route.js';
import imageRoute from './src/routes/image.route.js';
import productRoute from './src/routes/product.route.js';
import { startDeployWorker } from './src/queues/deployWorker.js';

const app = express();

// Start background worker (disabled by default as deployment is now direct/db-driven)
if (process.env.ENABLE_BG_WORKER === 'true') {
    startDeployWorker();
}

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', paymentRoute); // Payment route (create protected inside router, webhook uses RSA)
app.use('/api', authMiddleware, generatorRoute);
app.use('/api', authMiddleware, deployRoute);
app.use('/api', authMiddleware, projectRoute);
app.use('/api', authMiddleware, profileRoute);
app.use('/api', authMiddleware, imageRoute);
app.use('/api', authMiddleware, productRoute);

// Error handling
app.use(errorMiddleware);

const PORT = config.PORT || 3000;

// Export app for testing
export { app };

// Only listen if not in test environment or run directly
import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    app.listen(PORT, () => {
        console.log(`🚀 Siluet API running on port ${PORT} in ${config.NODE_ENV} mode`);
    });
}
