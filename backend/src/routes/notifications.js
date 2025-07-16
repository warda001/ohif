const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all notifications for current user
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, priority, is_read } = req.query;
    const offset = (page - 1) * limit;

    let query = database('notifications')
      .where('user_id', req.user.id);

    if (type) {
      query = query.where('type', type);
    }

    if (priority) {
      query = query.where('priority', priority);
    }

    if (is_read !== undefined) {
      query = query.where('is_read', is_read === 'true');
    }

    const [{ count }] = await query.clone().count('* as count');

    const notifications = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      notifications,
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

// Get notification by ID
router.get('/:id', async (req, res, next) => {
  try {
    const notification = await database('notifications')
      .where('id', req.params.id)
      .where('user_id', req.user.id)
      .first();

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res, next) => {
  try {
    const notificationId = req.params.id;

    await database('notifications')
      .where('id', notificationId)
      .where('user_id', req.user.id)
      .update({
        is_read: true,
        read_at: new Date()
      });

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
router.put('/read-all', async (req, res, next) => {
  try {
    await database('notifications')
      .where('user_id', req.user.id)
      .where('is_read', false)
      .update({
        is_read: true,
        read_at: new Date()
      });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// Get unread notification count
router.get('/unread/count', async (req, res, next) => {
  try {
    const [{ count }] = await database('notifications')
      .where('user_id', req.user.id)
      .where('is_read', false)
      .count('* as count');

    res.json({ unread_count: parseInt(count) });
  } catch (error) {
    next(error);
  }
});

// Delete notification
router.delete('/:id', async (req, res, next) => {
  try {
    const notificationId = req.params.id;

    await database('notifications')
      .where('id', notificationId)
      .where('user_id', req.user.id)
      .delete();

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;