const jwt = require('jsonwebtoken');
const database = require('../database');
const { AppError } = require('./errorHandler');

// Authenticate user using JWT
const authenticate = async (req, res, next) => {
  try {
    let token;
    
    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return next(new AppError('No token provided', 401));
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    const user = await database('users')
      .select('users.*', 'organizations.name as organization_name')
      .leftJoin('organizations', 'users.organization_id', 'organizations.id')
      .where('users.id', decoded.id)
      .where('users.is_active', true)
      .first();
    
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }
    
    // Check if user changed password after token was issued
    if (user.password_changed_at && decoded.iat < user.password_changed_at.getTime() / 1000) {
      return next(new AppError('Password recently changed. Please log in again.', 401));
    }
    
    // Grant access to protected route
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401));
    }
    next(error);
  }
};

// Authorize user based on roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

// Check if user belongs to the same organization
const checkOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    
    if (organizationId && req.user.organization_id !== organizationId) {
      return next(new AppError('Access denied to this organization', 403));
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Check if user can access specific resource
const checkResourceAccess = (resourceType) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      const organizationId = req.user.organization_id;
      
      let hasAccess = false;
      
      switch (resourceType) {
        case 'study':
          // Check if study belongs to user's organization
          const study = await database('studies')
            .where('id', id)
            .where('organization_id', organizationId)
            .first();
          
          if (study) {
            // Admin and managers can access all studies in their organization
            if (['admin', 'manager'].includes(userRole)) {
              hasAccess = true;
            }
            // Radiologists can access assigned studies
            else if (userRole === 'radiologist' && study.assigned_radiologist_id === userId) {
              hasAccess = true;
            }
            // Viewers can access studies in their organization
            else if (userRole === 'viewer') {
              hasAccess = true;
            }
          }
          break;
          
        case 'report':
          // Check if report belongs to user's organization
          const report = await database('reports')
            .join('studies', 'reports.study_id', 'studies.id')
            .where('reports.id', id)
            .where('studies.organization_id', organizationId)
            .first();
          
          if (report) {
            // Admin and managers can access all reports
            if (['admin', 'manager'].includes(userRole)) {
              hasAccess = true;
            }
            // Radiologists can access their own reports
            else if (userRole === 'radiologist' && report.radiologist_id === userId) {
              hasAccess = true;
            }
            // Viewers can access finalized reports
            else if (userRole === 'viewer' && report.status === 'finalized') {
              hasAccess = true;
            }
          }
          break;
          
        case 'user':
          // Check if user belongs to the same organization
          const targetUser = await database('users')
            .where('id', id)
            .where('organization_id', organizationId)
            .first();
          
          if (targetUser) {
            // Admin can access all users in their organization
            if (userRole === 'admin') {
              hasAccess = true;
            }
            // Managers can access non-admin users
            else if (userRole === 'manager' && targetUser.role !== 'admin') {
              hasAccess = true;
            }
            // Users can access their own profile
            else if (userId === id) {
              hasAccess = true;
            }
          }
          break;
          
        default:
          // Default to organization-level access
          hasAccess = true;
      }
      
      if (!hasAccess) {
        return next(new AppError('Access denied to this resource', 403));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Optional authentication (for public endpoints that benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await database('users')
        .select('users.*', 'organizations.name as organization_name')
        .leftJoin('organizations', 'users.organization_id', 'organizations.id')
        .where('users.id', decoded.id)
        .where('users.is_active', true)
        .first();
      
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

// Check if user has specific permission
const checkPermission = (permission) => {
  return (req, res, next) => {
    const userPermissions = req.user.permissions || {};
    
    if (!userPermissions[permission]) {
      return next(new AppError('Insufficient permissions', 403));
    }
    
    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  checkOrganization,
  checkResourceAccess,
  optionalAuth,
  checkPermission
};