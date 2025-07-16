const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = new Map();
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      // Verify connection
      await this.transporter.verify();
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  async loadTemplate(templateName) {
    if (this.templates.has(templateName)) {
      return this.templates.get(templateName);
    }

    try {
      const templatePath = path.join(__dirname, '../templates/email', `${templateName}.html`);
      const template = await fs.readFile(templatePath, 'utf-8');
      this.templates.set(templateName, template);
      return template;
    } catch (error) {
      logger.error(`Failed to load email template ${templateName}:`, error);
      return this.getDefaultTemplate();
    }
  }

  getDefaultTemplate() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>{{subject}}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
          .button { background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Radiology Platform</h1>
          </div>
          <div class="content">
            {{content}}
          </div>
          <div class="footer">
            <p>This email was sent from the Radiology Platform. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  renderTemplate(template, data) {
    let rendered = template;
    
    // Replace placeholders
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, data[key] || '');
    });

    return rendered;
  }

  async sendEmail({ to, subject, template, data, attachments = [] }) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    try {
      let html;
      
      if (template) {
        const templateContent = await this.loadTemplate(template);
        html = this.renderTemplate(templateContent, { ...data, subject });
      } else {
        const defaultTemplate = this.getDefaultTemplate();
        html = this.renderTemplate(defaultTemplate, { 
          subject, 
          content: data.content || data.message || ''
        });
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
        attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}`, { messageId: result.messageId });
      
      return result;
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendVerificationEmail(to, data) {
    return this.sendEmail({
      to,
      subject: 'Verify Your Account',
      template: 'verification',
      data
    });
  }

  async sendPasswordResetEmail(to, data) {
    return this.sendEmail({
      to,
      subject: 'Password Reset Request',
      template: 'password-reset',
      data
    });
  }

  async sendStudyAssignmentEmail(to, data) {
    return this.sendEmail({
      to,
      subject: 'New Study Assignment',
      template: 'study-assignment',
      data
    });
  }

  async sendStatOrderEmail(to, data) {
    return this.sendEmail({
      to,
      subject: 'URGENT: STAT Order Received',
      template: 'stat-order',
      data
    });
  }

  async sendSlaWarningEmail(to, data) {
    return this.sendEmail({
      to,
      subject: 'SLA Warning: Study Due Soon',
      template: 'sla-warning',
      data
    });
  }

  async sendReportFinalizedEmail(to, data) {
    return this.sendEmail({
      to,
      subject: 'Report Finalized',
      template: 'report-finalized',
      data
    });
  }

  async sendDisputeNotificationEmail(to, data) {
    return this.sendEmail({
      to,
      subject: 'Report Dispute Notification',
      template: 'dispute-notification',
      data
    });
  }

  async sendBulkEmails(emails) {
    const results = [];
    
    for (const email of emails) {
      try {
        const result = await this.sendEmail(email);
        results.push({ success: true, to: email.to, result });
      } catch (error) {
        results.push({ success: false, to: email.to, error: error.message });
      }
    }
    
    return results;
  }

  async sendScheduledEmails(emails, delay = 1000) {
    const results = [];
    
    for (const email of emails) {
      try {
        const result = await this.sendEmail(email);
        results.push({ success: true, to: email.to, result });
        
        // Add delay to prevent overwhelming the SMTP server
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        results.push({ success: false, to: email.to, error: error.message });
      }
    }
    
    return results;
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = {
  sendEmail: emailService.sendEmail.bind(emailService),
  sendVerificationEmail: emailService.sendVerificationEmail.bind(emailService),
  sendPasswordResetEmail: emailService.sendPasswordResetEmail.bind(emailService),
  sendStudyAssignmentEmail: emailService.sendStudyAssignmentEmail.bind(emailService),
  sendStatOrderEmail: emailService.sendStatOrderEmail.bind(emailService),
  sendSlaWarningEmail: emailService.sendSlaWarningEmail.bind(emailService),
  sendReportFinalizedEmail: emailService.sendReportFinalizedEmail.bind(emailService),
  sendDisputeNotificationEmail: emailService.sendDisputeNotificationEmail.bind(emailService),
  sendBulkEmails: emailService.sendBulkEmails.bind(emailService),
  sendScheduledEmails: emailService.sendScheduledEmails.bind(emailService)
};