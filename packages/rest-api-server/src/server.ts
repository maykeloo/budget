// @ts-nocheck
import * as api from '@actual-app/api';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

// Load environment variables
dotenv.config({ path: '.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API initialization state
let isInitialized = false;
let actualAPI = null;

async function initializeAPI() {
  if (!isInitialized) {
    try {
      console.log('🔧 Initializing Actual API...');

      // Dynamically import the API to avoid TypeScript issues
      actualAPI = await import('@actual-app/api');

      const config: any = {
        dataDir: process.env.ACTUAL_DATA_DIR || './actual-data',
      };

      // Add server URL if provided
      if (process.env.ACTUAL_SERVER_URL) {
        config.serverURL = process.env.ACTUAL_SERVER_URL;
      }

      // Add password if provided
      if (process.env.ACTUAL_PASSWORD) {
        config.password = process.env.ACTUAL_PASSWORD;
      }

      await actualAPI.init(config);
      isInitialized = true;
      console.log('✅ Actual API initialized successfully');
      
      // Auto-load budget if BUDGET_ID is provided
      if (process.env.BUDGET_ID) {
        try {
          console.log(`🔄 Loading budget: ${process.env.BUDGET_ID}`);
          await actualAPI.loadBudget(process.env.BUDGET_ID);
          console.log('✅ Budget loaded successfully');
        } catch (budgetError) {
          console.log('⚠️ Could not load specified budget, checking available budgets...');
          try {
            const budgets = await actualAPI.getBudgets();
            if (budgets.length > 0) {
              console.log(`🔄 Loading first available budget: ${budgets[0].name}`);
              await actualAPI.loadBudget(budgets[0].id);
              console.log('✅ Budget loaded successfully');
            } else {
              console.log('⚠️ No budgets available');
            }
          } catch (listError) {
            console.log('⚠️ Could not list or load budgets:', listError.message);
          }
        }
      } else {
        // Try to load first available budget
        try {
          const budgets = await actualAPI.getBudgets();
          if (budgets.length > 0) {
            console.log(`🔄 Loading first available budget: ${budgets[0].name}`);
            await actualAPI.loadBudget(budgets[0].id);
            console.log('✅ Budget loaded successfully');
          } else {
            console.log('⚠️ No budgets available');
          }
        } catch (listError) {
          console.log('⚠️ Could not list or load budgets:', listError.message);
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize Actual API:', error);
      throw error;
    }
  }
}

// Helper function to handle errors
function handleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Health check endpoint (no API initialization required)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Actual Budget REST API Server is running',
    initialized: isInitialized,
  });
});

// Middleware to ensure API is initialized (only for API endpoints)
app.use('/api', async (req, res, next) => {
  try {
    console.log(`🔍 API call: ${req.method} ${req.path}`);
    await initializeAPI();
    next();
  } catch (error: any) {
    console.error('❌ Failed to initialize API:', error);
    res.status(500).json({
      error: 'Failed to initialize API',
      details: error?.message || String(error),
    });
  }
});

// =============================================================================
// BUDGET ENDPOINTS
// =============================================================================

app.get('/api/budget/months', async (req: Request, res: Response) => {
  try {
    const months = await api.getBudgetMonths();
    res.json(months);
  } catch (error) {
    console.error('Error getting budget months:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.get('/api/budget/month/:month', async (req: Request, res: Response) => {
  try {
    const { month } = req.params;
    const budgetMonth = await api.getBudgetMonth(month);
    res.json(budgetMonth);
  } catch (error) {
    console.error('Error getting budget month:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/budget/amount', async (req: Request, res: Response) => {
  try {
    const { month, categoryId, amount } = req.body;
    await api.setBudgetAmount(month, categoryId, amount);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting budget amount:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/budget/carryover', async (req: Request, res: Response) => {
  try {
    const { month, categoryId, flag } = req.body;
    await api.setBudgetCarryover(month, categoryId, flag);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting budget carryover:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/budget/hold', async (req: Request, res: Response) => {
  try {
    const { month, amount } = req.body;
    await api.holdBudgetForNextMonth(month, amount);
    res.json({ success: true });
  } catch (error) {
    console.error('Error holding budget:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/budget/reset-hold', async (req: Request, res: Response) => {
  try {
    const { month } = req.body;
    await api.resetBudgetHold(month);
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting budget hold:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// =============================================================================
// ACCOUNT ENDPOINTS
// =============================================================================

app.get('/api/accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await api.getAccounts();
    res.json(accounts);
  } catch (error) {
    console.error('Error getting accounts:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/accounts', async (req: Request, res: Response) => {
  try {
    const { account, initialBalance = 0 } = req.body;
    const id = await api.createAccount(account, initialBalance);
    res.json({ id });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.put('/api/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.updateAccount(id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/accounts/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { transferAccountId, transferCategoryId } = req.body;
    await api.closeAccount(id, transferAccountId, transferCategoryId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error closing account:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/accounts/:id/reopen', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.reopenAccount(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reopening account:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.delete('/api/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.deleteAccount(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.get('/api/accounts/:id/balance', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { cutoff } = req.query;
    const balance = await api.getAccountBalance(id, cutoff as string);
    res.json({ balance });
  } catch (error) {
    console.error('Error getting account balance:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// =============================================================================
// TRANSACTION ENDPOINTS
// =============================================================================

app.get('/api/transactions', async (req: Request, res: Response) => {
  try {
    const { accountId, startDate, endDate } = req.query;

    if (!accountId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters: accountId, startDate, endDate',
      });
    }

    const transactions = await api.getTransactions(
      accountId as string,
      startDate as string,
      endDate as string,
    );
    res.json(transactions);
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/transactions', async (req: Request, res: Response) => {
  try {
    const {
      accountId,
      transactions,
      runTransfers = false,
      learnCategories = false,
    } = req.body;

    if (!accountId || !transactions) {
      return res.status(400).json({
        error: 'Missing required parameters: accountId, transactions',
      });
    }

    const ids = await api.addTransactions(accountId, transactions, {
      runTransfers,
      learnCategories,
    });
    res.json({ success: true, ids });
  } catch (error) {
    console.error('Error adding transactions:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/transactions/import', async (req: Request, res: Response) => {
  try {
    const { accountId, transactions } = req.body;

    if (!accountId || !transactions) {
      return res.status(400).json({
        error: 'Missing required parameters: accountId, transactions',
      });
    }

    const result = await api.importTransactions(accountId, transactions);
    res.json(result);
  } catch (error) {
    console.error('Error importing transactions:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.put('/api/transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.updateTransaction(id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.delete('/api/transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.deleteTransaction(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// =============================================================================
// CATEGORY ENDPOINTS
// =============================================================================

app.get('/api/categories', async (req: Request, res: Response) => {
  try {
    const categories = await api.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/categories', async (req: Request, res: Response) => {
  try {
    const id = await api.createCategory(req.body);
    res.json({ id });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.put('/api/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.updateCategory(id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.delete('/api/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { transferCategoryId } = req.body;
    await api.deleteCategory(id, transferCategoryId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// =============================================================================
// CATEGORY GROUP ENDPOINTS
// =============================================================================

app.get('/api/category-groups', async (req: Request, res: Response) => {
  try {
    const groups = await api.getCategoryGroups();
    res.json(groups);
  } catch (error) {
    console.error('Error getting category groups:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/category-groups', async (req: Request, res: Response) => {
  try {
    const id = await api.createCategoryGroup(req.body);
    res.json({ id });
  } catch (error) {
    console.error('Error creating category group:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.put('/api/category-groups/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.updateCategoryGroup(id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating category group:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.delete('/api/category-groups/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { transferCategoryId } = req.body;
    await api.deleteCategoryGroup(id, transferCategoryId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category group:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// =============================================================================
// PAYEE ENDPOINTS
// =============================================================================

app.get('/api/payees', async (req: Request, res: Response) => {
  try {
    const payees = await api.getPayees();
    res.json(payees);
  } catch (error) {
    console.error('Error getting payees:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/payees', async (req: Request, res: Response) => {
  try {
    const id = await api.createPayee(req.body);
    res.json({ id });
  } catch (error) {
    console.error('Error creating payee:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.put('/api/payees/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.updatePayee(id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating payee:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.delete('/api/payees/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.deletePayee(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting payee:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/payees/merge', async (req: Request, res: Response) => {
  try {
    const { targetId, mergeIds } = req.body;

    if (!targetId || !mergeIds) {
      return res.status(400).json({
        error: 'Missing required parameters: targetId, mergeIds',
      });
    }

    await api.mergePayees(targetId, mergeIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Error merging payees:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// =============================================================================
// RULES ENDPOINTS
// =============================================================================

app.get('/api/rules', async (req: Request, res: Response) => {
  try {
    const rules = await api.getRules();
    res.json(rules);
  } catch (error) {
    console.error('Error getting rules:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.get('/api/payees/:id/rules', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rules = await api.getPayeeRules(id);
    res.json(rules);
  } catch (error) {
    console.error('Error getting payee rules:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/rules', async (req: Request, res: Response) => {
  try {
    const rule = await api.createRule(req.body);
    res.json(rule);
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.put('/api/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await api.updateRule({ id, ...req.body });
    res.json(rule);
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.delete('/api/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.deleteRule(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// =============================================================================
// MISC ENDPOINTS
// =============================================================================

app.get('/api/budgets', async (req: Request, res: Response) => {
  try {
    const budgets = await api.getBudgets();
    res.json(budgets);
  } catch (error) {
    console.error('Error getting budgets:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/budgets/:id/load', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await api.loadBudget(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error loading budget:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.get(
  '/api/budgets/:cloudFileId/download',
  async (req: Request, res: Response) => {
    try {
      const { cloudFileId } = req.params;
      const { password } = req.query;

      const options = password ? { password: password as string } : {};
      await api.downloadBudget(cloudFileId, options);
      res.json({ success: true });
    } catch (error) {
      console.error('Error downloading budget:', error);
      res.status(500).json({ error: handleError(error) });
    }
  },
);

app.post('/api/sync', async (req: Request, res: Response) => {
  try {
    await api.sync();
    res.json({ success: true });
  } catch (error) {
    console.error('Error syncing:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/bank-sync', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({
        error: 'Missing required parameter: accountId',
      });
    }

    await api.runBankSync({ accountId });
    res.json({ success: true });
  } catch (error) {
    console.error('Error running bank sync:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/query', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Missing required parameter: query',
      });
    }

    const result = await api.runQuery(query);
    res.json(result);
  } catch (error) {
    console.error('Error running query:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/batch', async (req: Request, res: Response) => {
  try {
    const { func } = req.body;

    if (!func) {
      return res.status(400).json({
        error: 'Missing required parameter: func',
      });
    }

    const result = await api.batchBudgetUpdates(func);
    res.json(result);
  } catch (error) {
    console.error('Error running batch operations:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// =============================================================================
// UTILITY ENDPOINTS
// =============================================================================

app.post('/api/utils/amount-to-integer', (req: Request, res: Response) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== 'number') {
      return res.status(400).json({
        error: 'Invalid amount: must be a number',
      });
    }

    const integerAmount = api.utils.amountToInteger(amount);
    res.json({ amount: integerAmount });
  } catch (error) {
    console.error('Error converting amount to integer:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

app.post('/api/utils/integer-to-amount', (req: Request, res: Response) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== 'number') {
      return res.status(400).json({
        error: 'Invalid amount: must be a number',
      });
    }

    const floatAmount = api.utils.integerToAmount(amount);
    res.json({ amount: floatAmount });
  } catch (error) {
    console.error('Error converting integer to amount:', error);
    res.status(500).json({ error: handleError(error) });
  }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
  });
});

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

process.on('SIGINT', async () => {
  console.log('\n� Gracefully shutting down...');
  try {
    if (isInitialized) {
      await api.shutdown();
      console.log('✅ API shutdown complete');
    }
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  try {
    if (isInitialized) {
      await api.shutdown();
      console.log('✅ API shutdown complete');
    }
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  process.exit(0);
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, () => {
  console.log('🚀 Actual Budget REST API Server starting...');
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API documentation: http://localhost:${PORT}/api/*`);
  console.log(`🌍 Server running on port ${PORT}`);
  console.log(
    `📁 Data directory: ${process.env.ACTUAL_DATA_DIR || './actual-data'}`,
  );

  if (process.env.ACTUAL_SERVER_URL) {
    console.log(`🔗 Server URL: ${process.env.ACTUAL_SERVER_URL}`);
  }

  console.log('⏳ Waiting for first API call to initialize...\n');
});

export default app;
