import express from 'express';
import cors from 'cors';
import path from 'path';
import apiRoutes from './routes/api';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', apiRoutes);

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Bitcoin Price Gauge server running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api/summary`);
  console.log(`🌐 UI available at http://localhost:${PORT}`);
});

export default app;
