const authRoutes = require('./auth');
const userRoutes = require('./users');
const studyRoutes = require('./studies');
const reportRoutes = require('./reports');
const organizationRoutes = require('./organizations');
const billingRoutes = require('./billing');
const notificationRoutes = require('./notifications');
const analyticsRoutes = require('./analytics');
const dicomRoutes = require('./dicom');
const slaRoutes = require('./slas');
const ratingRoutes = require('./ratings');
const disputeRoutes = require('./disputes');
const templateRoutes = require('./templates');

const setupRoutes = (app) => {
  // Authentication routes
  app.use('/api/auth', authRoutes);
  
  // Resource routes
  app.use('/api/users', userRoutes);
  app.use('/api/studies', studyRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/dicom', dicomRoutes);
  app.use('/api/slas', slaRoutes);
  app.use('/api/ratings', ratingRoutes);
  app.use('/api/disputes', disputeRoutes);
  app.use('/api/templates', templateRoutes);
  
  // API documentation
  app.get('/api', (req, res) => {
    res.json({
      name: 'Radiology Platform API',
      version: '1.0.0',
      description: 'API for comprehensive radiology imaging platform',
      endpoints: {
        auth: '/api/auth',
        users: '/api/users',
        studies: '/api/studies',
        reports: '/api/reports',
        organizations: '/api/organizations',
        billing: '/api/billing',
        notifications: '/api/notifications',
        analytics: '/api/analytics',
        dicom: '/api/dicom',
        slas: '/api/slas',
        ratings: '/api/ratings',
        disputes: '/api/disputes',
        templates: '/api/templates'
      }
    });
  });
};

module.exports = { setupRoutes };