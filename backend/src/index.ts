import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';

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

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
