import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './src/config/index.js';
import { errorMiddleware } from './src/middleware/errorMiddleware.js';
import generatorRoute from './src/routes/generator.route.js';
import deployRoute from './src/routes/deploy.route.js';
import projectRoute from './src/routes/project.route.js';
import paymentRoute from './src/routes/payment.route.js';
import { startDeployWorker } from './src/queues/deployWorker.js';

const app = express();

// Start background worker
startDeployWorker();

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
app.use('/api', generatorRoute);
app.use('/api', deployRoute);
app.use('/api', projectRoute);
app.use('/api', paymentRoute);

// Error handling
app.use(errorMiddleware);

const PORT = config.PORT || 3000;

// Export app for testing
export { app };

// Only listen if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    app.listen(PORT, () => {
        console.log(`🚀 WuzzKang API running on port ${PORT} in ${config.NODE_ENV} mode`);
    });
}
