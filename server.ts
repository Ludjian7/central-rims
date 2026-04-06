import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { authRouter } from './src/routes/auth.js';
import { usersRouter } from './src/routes/users.js';
import { categoriesRouter } from './src/routes/categories.js';
import { productsRouter } from './src/routes/products.js';
import { suppliersRouter } from './src/routes/suppliers.js';
import { customersRouter } from './src/routes/customers.js';
import { techniciansRouter } from './src/routes/technicians.js';
import { agentsRouter } from './src/routes/agents.js';
import { inventoryRouter } from './src/routes/inventory.js';
import { purchaseOrdersRouter } from './src/routes/purchaseOrders.js';
import { transactionsRouter } from './src/routes/transactions.js';
import { shiftsRouter } from './src/routes/shifts.js';
import { expensesRouter } from './src/routes/expenses.js';
import { receivablesRouter } from './src/routes/receivables.js';
import { commissionsRouter } from './src/routes/commissions.js';
import { workOrdersRouter } from './src/routes/workOrders.js';
import { reportsRouter } from './src/routes/reports.js';
import { settingsRouter } from './src/routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json());

// ─── API Routes ────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/technicians', techniciansRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/purchase-orders', purchaseOrdersRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/receivables', receivablesRouter);
app.use('/api/commissions', commissionsRouter);
app.use('/api/work-orders', workOrdersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global API Error Handler
app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Error]:', err);
  res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' });
});

// ─── Production: Serve Vite static build ───────────────────
if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));

  // SPA fallback — all non-API routes serve index.html
  app.get('/:path*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── Start Server (Only if not in Vercel) ──────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🖥️  Central Computer RIMS — Server`);
    console.log(`   Mode:  ${isProduction ? 'Production' : 'Development'}`);
    console.log(`   Port:  ${PORT}`);
    if (!isProduction) {
      console.log(`   API:   http://localhost:${PORT}/api`);
      console.log(`   UI:    Run "npm run dev:client" for Vite dev server\n`);
    } else {
      console.log(`   URL:   http://localhost:${PORT}\n`);
    }
  });
}

export { app };
export default app;
