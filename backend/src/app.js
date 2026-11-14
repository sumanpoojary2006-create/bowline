import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import listingRoutes from './routes/listingRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import syncRoutes from './routes/syncRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import { errorHandler, notFound } from './middleware/error.js';
import { createOriginChecker } from './utils/cors.js';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isAllowedOrigin = createOriginChecker(process.env.CLIENT_URL);

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (_, res) => {
  res.json({ message: 'Bowline API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/employee', employeeRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
