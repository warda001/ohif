const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all billing records (admin only)
router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, period } = req.query;
    const offset = (page - 1) * limit;

    let query = database('billing')
      .where('organization_id', req.user.organization_id);

    if (status) {
      query = query.where('status', status);
    }

    if (period) {
      query = query.where('billing_period', period);
    }

    const [{ count }] = await query.clone().count('* as count');

    const billingRecords = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      billing: billingRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get billing record by ID
router.get('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const billing = await database('billing')
      .where('id', req.params.id)
      .where('organization_id', req.user.organization_id)
      .first();

    if (!billing) {
      return next(new AppError('Billing record not found', 404));
    }

    res.json({ billing });
  } catch (error) {
    next(error);
  }
});

// Mark billing as paid
router.put('/:id/pay', authorize('admin'), async (req, res, next) => {
  try {
    const billingId = req.params.id;

    await database('billing')
      .where('id', billingId)
      .where('organization_id', req.user.organization_id)
      .update({
        status: 'paid',
        paid_at: new Date()
      });

    res.json({ message: 'Billing marked as paid' });
  } catch (error) {
    next(error);
  }
});

// Get billing summary
router.get('/summary', authorize('admin'), async (req, res, next) => {
  try {
    const summary = await database('billing')
      .where('organization_id', req.user.organization_id)
      .select(
        database.raw('COUNT(*) as total_invoices'),
        database.raw('SUM(amount_due) as total_amount_due'),
        database.raw('SUM(CASE WHEN status = ? THEN amount_due ELSE 0 END) as pending_amount', ['pending']),
        database.raw('SUM(CASE WHEN status = ? THEN amount_due ELSE 0 END) as paid_amount', ['paid']),
        database.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending_invoices', ['pending']),
        database.raw('COUNT(CASE WHEN status = ? THEN 1 END) as paid_invoices', ['paid'])
      )
      .first();

    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

module.exports = router;