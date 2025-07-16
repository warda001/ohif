const jwt = require('jsonwebtoken');
const database = require('../database');
const logger = require('../utils/logger');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socket info
    this.organizationRooms = new Map(); // organizationId -> Set of socket IDs
  }

  initialize(io) {
    this.io = io;
    this.setupSocketHandlers();
    logger.info('Socket.IO service initialized');
  }

  setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await database('users')
          .select('users.*', 'organizations.name as organization_name')
          .leftJoin('organizations', 'users.organization_id', 'organizations.id')
          .where('users.id', decoded.id)
          .where('users.is_active', true)
          .first();

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.userRole = user.role;
        socket.organizationId = user.organization_id;
        socket.user = user;
        
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    const userId = socket.userId;
    const organizationId = socket.organizationId;
    
    logger.info(`User ${userId} connected via socket ${socket.id}`);

    // Store user connection
    this.connectedUsers.set(userId, {
      socketId: socket.id,
      socket: socket,
      organizationId: organizationId,
      connectedAt: new Date()
    });

    // Join organization room
    socket.join(`org_${organizationId}`);
    
    // Add to organization rooms map
    if (!this.organizationRooms.has(organizationId)) {
      this.organizationRooms.set(organizationId, new Set());
    }
    this.organizationRooms.get(organizationId).add(socket.id);

    // Join user-specific room
    socket.join(`user_${userId}`);

    // Join role-specific room
    socket.join(`role_${socket.userRole}`);

    // Handle user status update
    socket.on('user_status', (status) => {
      this.broadcastToOrganization(organizationId, 'user_status_update', {
        userId: userId,
        status: status,
        timestamp: new Date()
      });
    });

    // Handle study viewing
    socket.on('study_viewing', (data) => {
      this.broadcastToOrganization(organizationId, 'study_viewing', {
        userId: userId,
        studyId: data.studyId,
        timestamp: new Date()
      });
    });

    // Handle typing in reports
    socket.on('report_typing', (data) => {
      socket.to(`org_${organizationId}`).emit('report_typing', {
        userId: userId,
        reportId: data.reportId,
        isTyping: data.isTyping,
        timestamp: new Date()
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Send connection confirmation
    socket.emit('connected', {
      userId: userId,
      organizationId: organizationId,
      timestamp: new Date()
    });
  }

  handleDisconnection(socket) {
    const userId = socket.userId;
    const organizationId = socket.organizationId;
    
    logger.info(`User ${userId} disconnected from socket ${socket.id}`);

    // Remove from connected users
    this.connectedUsers.delete(userId);

    // Remove from organization rooms
    if (this.organizationRooms.has(organizationId)) {
      this.organizationRooms.get(organizationId).delete(socket.id);
      if (this.organizationRooms.get(organizationId).size === 0) {
        this.organizationRooms.delete(organizationId);
      }
    }

    // Broadcast user offline status
    this.broadcastToOrganization(organizationId, 'user_status_update', {
      userId: userId,
      status: 'offline',
      timestamp: new Date()
    });
  }

  // Notification methods
  async sendNotificationToUser(userId, notification) {
    try {
      // Save notification to database
      await database('notifications').insert({
        user_id: userId,
        organization_id: notification.organizationId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        priority: notification.priority || 'normal'
      });

      // Send real-time notification if user is connected
      const userConnection = this.connectedUsers.get(userId);
      if (userConnection) {
        userConnection.socket.emit('notification', notification);
      }

      logger.info(`Notification sent to user ${userId}:`, notification.type);
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  async sendNotificationToRole(organizationId, role, notification) {
    try {
      // Get users with specific role in organization
      const users = await database('users')
        .where('organization_id', organizationId)
        .where('role', role)
        .where('is_active', true)
        .select('id');

      // Send to each user
      for (const user of users) {
        await this.sendNotificationToUser(user.id, {
          ...notification,
          organizationId
        });
      }

      // Also broadcast to connected users with this role
      this.io.to(`role_${role}`).emit('notification', notification);
    } catch (error) {
      logger.error('Failed to send role notification:', error);
    }
  }

  broadcastToOrganization(organizationId, event, data) {
    this.io.to(`org_${organizationId}`).emit(event, data);
  }

  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  // Study-specific notifications
  async notifyStudyAssigned(studyId, radiologistId) {
    try {
      const study = await database('studies')
        .select('studies.*', 'users.first_name', 'users.last_name', 'users.email')
        .leftJoin('users', 'studies.assigned_radiologist_id', 'users.id')
        .where('studies.id', studyId)
        .first();

      if (!study) return;

      await this.sendNotificationToUser(radiologistId, {
        type: 'study_assigned',
        title: 'New Study Assignment',
        message: `You have been assigned a new ${study.modality} study`,
        data: {
          studyId: studyId,
          patientName: study.patient_name,
          studyDescription: study.study_description,
          modality: study.modality,
          priority: study.priority
        },
        priority: study.is_stat ? 'urgent' : 'normal',
        organizationId: study.organization_id
      });
    } catch (error) {
      logger.error('Failed to notify study assignment:', error);
    }
  }

  async notifyStatOrder(studyId) {
    try {
      const study = await database('studies')
        .where('id', studyId)
        .first();

      if (!study) return;

      // Notify all radiologists in the organization
      await this.sendNotificationToRole(study.organization_id, 'radiologist', {
        type: 'stat_order',
        title: 'URGENT: STAT Order',
        message: `STAT order received for ${study.modality} study`,
        data: {
          studyId: studyId,
          patientName: study.patient_name,
          studyDescription: study.study_description,
          modality: study.modality
        },
        priority: 'urgent'
      });
    } catch (error) {
      logger.error('Failed to notify STAT order:', error);
    }
  }

  async notifySlaWarning(studyId, minutesRemaining) {
    try {
      const study = await database('studies')
        .select('studies.*', 'users.first_name', 'users.last_name', 'users.email')
        .leftJoin('users', 'studies.assigned_radiologist_id', 'users.id')
        .where('studies.id', studyId)
        .first();

      if (!study || !study.assigned_radiologist_id) return;

      await this.sendNotificationToUser(study.assigned_radiologist_id, {
        type: 'sla_warning',
        title: 'SLA Warning',
        message: `Study due in ${minutesRemaining} minutes`,
        data: {
          studyId: studyId,
          patientName: study.patient_name,
          studyDescription: study.study_description,
          modality: study.modality,
          dueDate: study.sla_due_date,
          minutesRemaining: minutesRemaining
        },
        priority: 'high',
        organizationId: study.organization_id
      });
    } catch (error) {
      logger.error('Failed to notify SLA warning:', error);
    }
  }

  async notifyReportFinalized(reportId) {
    try {
      const report = await database('reports')
        .select('reports.*', 'studies.patient_name', 'studies.study_description', 'studies.modality', 'studies.organization_id')
        .join('studies', 'reports.study_id', 'studies.id')
        .where('reports.id', reportId)
        .first();

      if (!report) return;

      // Notify managers and admins
      await this.sendNotificationToRole(report.organization_id, 'manager', {
        type: 'report_finalized',
        title: 'Report Finalized',
        message: `Report completed for ${report.modality} study`,
        data: {
          reportId: reportId,
          studyId: report.study_id,
          patientName: report.patient_name,
          studyDescription: report.study_description,
          modality: report.modality
        },
        priority: 'normal'
      });

      await this.sendNotificationToRole(report.organization_id, 'admin', {
        type: 'report_finalized',
        title: 'Report Finalized',
        message: `Report completed for ${report.modality} study`,
        data: {
          reportId: reportId,
          studyId: report.study_id,
          patientName: report.patient_name,
          studyDescription: report.study_description,
          modality: report.modality
        },
        priority: 'normal'
      });
    } catch (error) {
      logger.error('Failed to notify report finalized:', error);
    }
  }

  async notifyDispute(disputeId) {
    try {
      const dispute = await database('disputes')
        .select('disputes.*', 'studies.patient_name', 'studies.study_description', 'studies.modality', 'studies.organization_id')
        .join('studies', 'disputes.study_id', 'studies.id')
        .where('disputes.id', disputeId)
        .first();

      if (!dispute) return;

      // Notify assigned user if any
      if (dispute.assigned_to) {
        await this.sendNotificationToUser(dispute.assigned_to, {
          type: 'dispute_assigned',
          title: 'Report Dispute Assigned',
          message: `You have been assigned to resolve a report dispute`,
          data: {
            disputeId: disputeId,
            disputeNumber: dispute.dispute_number,
            studyId: dispute.study_id,
            patientName: dispute.patient_name,
            studyDescription: dispute.study_description,
            modality: dispute.modality
          },
          priority: 'high',
          organizationId: dispute.organization_id
        });
      }

      // Notify managers and admins
      await this.sendNotificationToRole(dispute.organization_id, 'manager', {
        type: 'dispute_created',
        title: 'New Report Dispute',
        message: `A new report dispute has been created`,
        data: {
          disputeId: disputeId,
          disputeNumber: dispute.dispute_number,
          studyId: dispute.study_id,
          patientName: dispute.patient_name,
          studyDescription: dispute.study_description,
          modality: dispute.modality
        },
        priority: 'high'
      });
    } catch (error) {
      logger.error('Failed to notify dispute:', error);
    }
  }

  // Utility methods
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  getOrganizationConnectedUsers(organizationId) {
    const users = [];
    for (const [userId, info] of this.connectedUsers) {
      if (info.organizationId === organizationId) {
        users.push(userId);
      }
    }
    return users;
  }

  disconnectUser(userId) {
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection) {
      userConnection.socket.disconnect();
    }
  }
}

// Create singleton instance
const socketService = new SocketService();

const setupSocket = (io) => {
  socketService.initialize(io);
};

module.exports = {
  setupSocket,
  socketService,
  sendNotificationToUser: socketService.sendNotificationToUser.bind(socketService),
  sendNotificationToRole: socketService.sendNotificationToRole.bind(socketService),
  broadcastToOrganization: socketService.broadcastToOrganization.bind(socketService),
  broadcastToAll: socketService.broadcastToAll.bind(socketService),
  notifyStudyAssigned: socketService.notifyStudyAssigned.bind(socketService),
  notifyStatOrder: socketService.notifyStatOrder.bind(socketService),
  notifySlaWarning: socketService.notifySlaWarning.bind(socketService),
  notifyReportFinalized: socketService.notifyReportFinalized.bind(socketService),
  notifyDispute: socketService.notifyDispute.bind(socketService),
  isUserConnected: socketService.isUserConnected.bind(socketService),
  getConnectedUsers: socketService.getConnectedUsers.bind(socketService),
  getOrganizationConnectedUsers: socketService.getOrganizationConnectedUsers.bind(socketService),
  disconnectUser: socketService.disconnectUser.bind(socketService)
};