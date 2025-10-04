import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import api from '@actual-app/api';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

let isInitialized = false;

async function initializeAPI() {
  if (!isInitialized) {
    await api.init({
      dataDir: process.env.ACTUAL_DATA_DIR || './actual-data',
      serverURL: process.env.ACTUAL_SERVER_URL,
      password: process.env.ACTUAL_PASSWORD
    });
    isInitialized = true;
    console.log('Actual API initialized');
  }
}

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware to ensure API is initialized
app.use(async (req, res, next) => {
  try {
    await initializeAPI();
    next();
  } catch (error) {
    console.error('Failed to initialize API:', error);
    res.status(500).json({ error: 'Failed to initialize API' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Helper function to handle API errors
function handleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Account endpoints
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await api.getAccounts();
    res.json(accounts);
  } catch (error) {
    console.error('Error getting accounts:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const { account, initialBalance } = req.body;
    const id = await api.createAccount(account, initialBalance);
    res.json({ id });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    await api.updateAccount(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    await api.deleteAccount(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.get('/api/accounts/:id/balance', async (req, res) => {
  try {
    const { cutoff } = req.query;
    const balance = await api.getAccountBalance(req.params.id, cutoff as string);
    res.json({ balance });
  } catch (error) {
    console.error('Error getting account balance:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// Transaction endpoints
app.get('/api/transactions', async (req, res) => {
  try {
    const { accountId, startDate, endDate } = req.query;
    const transactions = await api.getTransactions(accountId as string, startDate as string, endDate as string);
    res.json(transactions);
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { accountId, transactions, options = {} } = req.body;
    await api.addTransactions(accountId, transactions, options);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding transactions:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const result = await api.updateTransaction(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const result = await api.deleteTransaction(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// Category endpoints
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await api.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const id = await api.createCategory(req.body);
    res.json({ id });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// Payee endpoints
app.get('/api/payees', async (req, res) => {
  try {
    const payees = await api.getPayees();
    res.json(payees);
  } catch (error) {
    console.error('Error getting payees:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/payees', async (req, res) => {
  try {
    const id = await api.createPayee(req.body);
    res.json({ id });
  } catch (error) {
    console.error('Error creating payee:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// Budget endpoints
app.get('/api/budget/months', async (req, res) => {
  try {
    const months = await api.getBudgetMonths();
    res.json(months);
  } catch (error) {
    console.error('Error getting budget months:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.get('/api/budget/month/:month', async (req, res) => {
  try {
    const month = await api.getBudgetMonth(req.params.month);
    res.json(month);
  } catch (error) {
    console.error('Error getting budget month:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  try {
    if (isInitialized) {
      await api.shutdown();
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  try {
    if (isInitialized) {
      await api.shutdown();
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Actual Budget API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API endpoints: http://localhost:${PORT}/api/*`);
});

export default app;
