const cron = require('node-cron');
const database = require('../database');
const logger = require('../utils/logger');
const { sendSlaWarningEmail } = require('./emailService');
const { notifySlaWarning } = require('./socketService');
const moment = require('moment');

class CronService {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized) {
      return;
    }

    this.setupJobs();
    this.isInitialized = true;
    logger.info('Cron service initialized');
  }

  setupJobs() {
    // SLA monitoring - runs every 5 minutes
    this.addJob('sla-monitoring', '*/5 * * * *', this.checkSlaBreaches.bind(this));

    // Daily cleanup - runs at 2 AM
    this.addJob('daily-cleanup', '0 2 * * *', this.dailyCleanup.bind(this));

    // Monthly billing - runs on 1st of each month at 3 AM
    this.addJob('monthly-billing', '0 3 1 * *', this.generateMonthlyBilling.bind(this));

    // Study assignments - runs every 10 minutes
    this.addJob('study-assignments', '*/10 * * * *', this.processStudyAssignments.bind(this));

    // Notification cleanup - runs daily at 1 AM
    this.addJob('notification-cleanup', '0 1 * * *', this.cleanupNotifications.bind(this));

    // Rating calculations - runs daily at 4 AM
    this.addJob('rating-calculations', '0 4 * * *', this.updateRatingCalculations.bind(this));

    // Audit log cleanup - runs weekly on Sunday at 3 AM
    this.addJob('audit-cleanup', '0 3 * * 0', this.cleanupAuditLogs.bind(this));
  }

  addJob(name, schedule, task) {
    if (this.jobs.has(name)) {
      this.jobs.get(name).destroy();
    }

    const job = cron.schedule(schedule, async () => {
      try {
        logger.info(`Running cron job: ${name}`);
        await task();
        logger.info(`Completed cron job: ${name}`);
      } catch (error) {
        logger.error(`Error in cron job ${name}:`, error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.jobs.set(name, job);
    logger.info(`Scheduled cron job: ${name} (${schedule})`);
  }

  async checkSlaBreaches() {
    try {
      const now = new Date();
      const warningThreshold = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

      // Find studies approaching SLA breach
      const studies = await database('studies')
        .select('studies.*', 'users.email', 'users.first_name', 'users.last_name')
        .leftJoin('users', 'studies.assigned_radiologist_id', 'users.id')
        .where('studies.status', 'in', ['assigned', 'in_progress'])
        .where('studies.sla_due_date', '<=', warningThreshold)
        .where('studies.sla_due_date', '>', now);

      for (const study of studies) {
        const minutesRemaining = Math.floor((new Date(study.sla_due_date) - now) / (1000 * 60));
        
        if (minutesRemaining <= 30 && minutesRemaining > 0) {
          // Send notification
          await notifySlaWarning(study.id, minutesRemaining);
          
          // Send email if user has email
          if (study.email) {
            await sendSlaWarningEmail(study.email, {
              name: `${study.first_name} ${study.last_name}`,
              patientName: study.patient_name,
              studyDescription: study.study_description,
              modality: study.modality,
              minutesRemaining: minutesRemaining,
              dueDate: moment(study.sla_due_date).format('YYYY-MM-DD HH:mm:ss')
            });
          }
        }
      }

      // Find studies that have already breached SLA
      const breachedStudies = await database('studies')
        .where('status', 'in', ['assigned', 'in_progress'])
        .where('sla_due_date', '<', now)
        .whereNull('sla_breached_at');

      for (const study of breachedStudies) {
        // Mark as breached
        await database('studies')
          .where('id', study.id)
          .update({
            sla_breached_at: now,
            status: 'sla_breached'
          });

        logger.warn(`SLA breached for study ${study.id}`);
      }

      if (studies.length > 0 || breachedStudies.length > 0) {
        logger.info(`SLA check completed: ${studies.length} warnings, ${breachedStudies.length} breaches`);
      }
    } catch (error) {
      logger.error('Error checking SLA breaches:', error);
    }
  }

  async dailyCleanup() {
    try {
      // Clean up expired tokens
      const expiredTokens = await database('users')
        .where('reset_token_expires', '<', new Date())
        .whereNotNull('reset_token')
        .update({
          reset_token: null,
          reset_token_expires: null
        });

      // Clean up expired verification tokens
      const expiredVerifications = await database('users')
        .where('verification_token_expires', '<', new Date())
        .whereNotNull('verification_token')
        .update({
          verification_token: null,
          verification_token_expires: null
        });

      // Clean up old sessions (if storing in database)
      // This would depend on your session storage implementation

      logger.info(`Daily cleanup completed: ${expiredTokens} expired tokens, ${expiredVerifications} expired verifications`);
    } catch (error) {
      logger.error('Error in daily cleanup:', error);
    }
  }

  async generateMonthlyBilling() {
    try {
      const lastMonth = moment().subtract(1, 'month');
      const startDate = lastMonth.startOf('month').toDate();
      const endDate = lastMonth.endOf('month').toDate();

      const organizations = await database('organizations')
        .where('is_active', true)
        .select('*');

      for (const org of organizations) {
        // Get usage statistics for the organization
        const studyCount = await database('studies')
          .where('organization_id', org.id)
          .whereBetween('created_at', [startDate, endDate])
          .count('id as count')
          .first();

        const reportCount = await database('reports')
          .join('studies', 'reports.study_id', 'studies.id')
          .where('studies.organization_id', org.id)
          .whereBetween('reports.created_at', [startDate, endDate])
          .count('reports.id as count')
          .first();

        // Calculate billing amount (example pricing)
        const studyPrice = 25.00; // $25 per study
        const reportPrice = 50.00; // $50 per report
        const totalAmount = (studyCount.count * studyPrice) + (reportCount.count * reportPrice);

        // Generate invoice
        const invoiceNumber = `INV-${org.code}-${lastMonth.format('YYYYMM')}`;
        
        await database('billing').insert({
          organization_id: org.id,
          invoice_number: invoiceNumber,
          billing_period: 'monthly',
          period_start: startDate,
          period_end: endDate,
          amount_due: totalAmount,
          currency: 'USD',
          status: 'pending',
          line_items: JSON.stringify([
            {
              description: 'Studies processed',
              quantity: studyCount.count,
              unit_price: studyPrice,
              total: studyCount.count * studyPrice
            },
            {
              description: 'Reports generated',
              quantity: reportCount.count,
              unit_price: reportPrice,
              total: reportCount.count * reportPrice
            }
          ]),
          usage_summary: JSON.stringify({
            studies: studyCount.count,
            reports: reportCount.count,
            period: lastMonth.format('YYYY-MM')
          }),
          due_date: moment().add(30, 'days').toDate()
        });

        logger.info(`Generated billing for ${org.name}: ${invoiceNumber} - $${totalAmount}`);
      }
    } catch (error) {
      logger.error('Error generating monthly billing:', error);
    }
  }

  async processStudyAssignments() {
    try {
      // Find unassigned studies
      const unassignedStudies = await database('studies')
        .where('status', 'unread')
        .whereNull('assigned_radiologist_id')
        .select('*');

      for (const study of unassignedStudies) {
        // Find available radiologists for this organization and modality
        const radiologists = await database('users')
          .where('organization_id', study.organization_id)
          .where('role', 'radiologist')
          .where('is_active', true)
          .select('*');

        if (radiologists.length === 0) {
          continue;
        }

        // Simple round-robin assignment (you can implement more complex logic)
        const assignedRadiologist = radiologists[Math.floor(Math.random() * radiologists.length)];

        // Calculate SLA due date
        const slaMinutes = study.is_stat ? 60 : 1440; // 1 hour for STAT, 24 hours for normal
        const slaDueDate = new Date(Date.now() + slaMinutes * 60 * 1000);

        // Assign the study
        await database('studies')
          .where('id', study.id)
          .update({
            assigned_radiologist_id: assignedRadiologist.id,
            assigned_at: new Date(),
            status: 'assigned',
            sla_due_date: slaDueDate
          });

        logger.info(`Assigned study ${study.id} to radiologist ${assignedRadiologist.id}`);
      }
    } catch (error) {
      logger.error('Error processing study assignments:', error);
    }
  }

  async cleanupNotifications() {
    try {
      // Delete read notifications older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const deletedCount = await database('notifications')
        .where('is_read', true)
        .where('created_at', '<', thirtyDaysAgo)
        .delete();

      logger.info(`Cleaned up ${deletedCount} old notifications`);
    } catch (error) {
      logger.error('Error cleaning up notifications:', error);
    }
  }

  async updateRatingCalculations() {
    try {
      // Recalculate average ratings for all radiologists
      const radiologists = await database('users')
        .where('role', 'radiologist')
        .select('id');

      for (const radiologist of radiologists) {
        const ratingStats = await database('ratings')
          .where('radiologist_id', radiologist.id)
          .select(
            database.raw('AVG(rating) as avg_rating'),
            database.raw('COUNT(*) as rating_count')
          )
          .first();

        await database('users')
          .where('id', radiologist.id)
          .update({
            rating_average: ratingStats.avg_rating || 0,
            rating_count: ratingStats.rating_count || 0
          });
      }

      logger.info(`Updated rating calculations for ${radiologists.length} radiologists`);
    } catch (error) {
      logger.error('Error updating rating calculations:', error);
    }
  }

  async cleanupAuditLogs() {
    try {
      // Delete audit logs older than 1 year
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      
      const deletedCount = await database('audit_logs')
        .where('created_at', '<', oneYearAgo)
        .delete();

      logger.info(`Cleaned up ${deletedCount} old audit logs`);
    } catch (error) {
      logger.error('Error cleaning up audit logs:', error);
    }
  }

  // Manual job execution
  async runJob(jobName) {
    if (!this.jobs.has(jobName)) {
      throw new Error(`Job ${jobName} not found`);
    }

    const jobMethods = {
      'sla-monitoring': this.checkSlaBreaches.bind(this),
      'daily-cleanup': this.dailyCleanup.bind(this),
      'monthly-billing': this.generateMonthlyBilling.bind(this),
      'study-assignments': this.processStudyAssignments.bind(this),
      'notification-cleanup': this.cleanupNotifications.bind(this),
      'rating-calculations': this.updateRatingCalculations.bind(this),
      'audit-cleanup': this.cleanupAuditLogs.bind(this)
    };

    const method = jobMethods[jobName];
    if (method) {
      logger.info(`Manually running job: ${jobName}`);
      await method();
      logger.info(`Manually completed job: ${jobName}`);
    }
  }

  // Job management
  startJob(jobName) {
    if (this.jobs.has(jobName)) {
      this.jobs.get(jobName).start();
      logger.info(`Started job: ${jobName}`);
    }
  }

  stopJob(jobName) {
    if (this.jobs.has(jobName)) {
      this.jobs.get(jobName).stop();
      logger.info(`Stopped job: ${jobName}`);
    }
  }

  removeJob(jobName) {
    if (this.jobs.has(jobName)) {
      this.jobs.get(jobName).destroy();
      this.jobs.delete(jobName);
      logger.info(`Removed job: ${jobName}`);
    }
  }

  getJobStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running
      };
    }
    return status;
  }

  shutdown() {
    for (const [name, job] of this.jobs) {
      job.destroy();
    }
    this.jobs.clear();
    logger.info('Cron service shutdown');
  }
}

// Create singleton instance
const cronService = new CronService();

const setupCronJobs = () => {
  cronService.initialize();
};

module.exports = {
  setupCronJobs,
  cronService,
  runJob: cronService.runJob.bind(cronService),
  startJob: cronService.startJob.bind(cronService),
  stopJob: cronService.stopJob.bind(cronService),
  removeJob: cronService.removeJob.bind(cronService),
  getJobStatus: cronService.getJobStatus.bind(cronService),
  shutdown: cronService.shutdown.bind(cronService)
};