import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import uploadsRoutes from './routes/uploads.routes.js';
import mappingsRoutes from './routes/mappings.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// User routes (protected)
app.use('/api/users', usersRoutes);

// Upload routes (protected)
app.use('/api/uploads', uploadsRoutes);

// Mapping template routes (protected)
app.use('/api/mappings', mappingsRoutes);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
