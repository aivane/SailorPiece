import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import verifySlipHandler from './api/verify-slip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request body (up to 10MB to accommodate base64 image data)
app.use(express.json({ limit: '10mb' }));

// Route for verifying slip
app.post('/api/verify-slip', verifySlipHandler);

// Serve static assets from Vite's built client
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for Vue Router (Single Page Application routing)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
