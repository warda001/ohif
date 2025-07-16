const database = require('../database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Skip audit logging for certain paths
const skipPaths = [
  '/health',
  '/api/auth/refresh',
  '/api/notifications',
  '/socket.io'
];

const auditLogger = async (req, res, next) => {
  // Skip if audit logging is disabled
  if (process.env.ENABLE_AUDIT_LOG !== 'true') {
    return next();
  }
  
  // Skip certain paths
  if (skipPaths.some(path => req.originalUrl.startsWith(path))) {
    return next();
  }
  
  // Skip GET requests to reduce noise (optional)
  if (req.method === 'GET' && !req.originalUrl.includes('/admin/')) {
    return next();
  }
  
  const startTime = Date.now();
  const requestId = uuidv4();
  
  // Add request ID to request object
  req.requestId = requestId;
  
  // Capture original res.end to log when response is sent
  const originalEnd = res.end;
  
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log the audit entry
    logAuditEntry({
      requestId,
      organizationId: req.user?.organization_id,
      userId: req.user?.id,
      action: `${req.method} ${req.originalUrl}`,
      resourceType: extractResourceType(req.originalUrl),
      resourceId: extractResourceId(req.originalUrl, req.params),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration,
      requestBody: sanitizeRequestBody(req.body),
      sessionId: req.sessionID,
      metadata: {
        method: req.method,
        url: req.originalUrl,
        params: req.params,
        query: req.query,
        headers: sanitizeHeaders(req.headers)
      }
    });
    
    // Call original end
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

const extractResourceType = (url) => {
  const segments = url.split('/').filter(Boolean);
  if (segments.length >= 2 && segments[0] === 'api') {
    return segments[1]; // e.g., 'studies', 'users', 'reports'
  }
  return 'unknown';
};

const extractResourceId = (url, params) => {
  // Try to find ID in params first
  if (params.id) return params.id;
  if (params.studyId) return params.studyId;
  if (params.reportId) return params.reportId;
  
  // Try to extract from URL
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = url.match(uuidRegex);
  return match ? match[0] : null;
};

const sanitizeRequestBody = (body) => {
  if (!body) return {};
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

const sanitizeHeaders = (headers) => {
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

const logAuditEntry = async (auditData) => {
  try {
    await database('audit_logs').insert({
      organization_id: auditData.organizationId,
      user_id: auditData.userId,
      action: auditData.action,
      resource_type: auditData.resourceType,
      resource_id: auditData.resourceId,
      ip_address: auditData.ipAddress,
      user_agent: auditData.userAgent,
      session_id: auditData.sessionId,
      request_id: auditData.requestId,
      metadata: {
        ...auditData.metadata,
        statusCode: auditData.statusCode,
        duration: auditData.duration,
        requestBody: auditData.requestBody
      }
    });
  } catch (error) {
    logger.error('Failed to log audit entry:', error);
  }
};

module.exports = auditLogger;