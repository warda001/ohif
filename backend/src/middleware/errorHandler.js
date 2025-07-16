const logger = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle different error types
const handleDatabaseError = (error) => {
  let message = 'Database error occurred';
  let statusCode = 500;
  
  if (error.code === '23505') { // Unique constraint violation
    message = 'Duplicate entry found';
    statusCode = 409;
  } else if (error.code === '23503') { // Foreign key constraint violation
    message = 'Referenced record not found';
    statusCode = 400;
  } else if (error.code === '23502') { // Not null constraint violation
    message = 'Required field is missing';
    statusCode = 400;
  }
  
  return new AppError(message, statusCode);
};

const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again', 401);
};

const handleJWTExpiredError = () => {
  return new AppError('Token has expired. Please log in again', 401);
};

const handleValidationError = (error) => {
  const message = error.details?.map(detail => detail.message).join(', ') || 'Validation error';
  return new AppError(message, 400);
};

// Send error response
const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  // Operational errors: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    // Programming errors: log and send generic message
    logger.error('ERROR:', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!'
    });
  }
};

// Main error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user: req.user?.id
  });
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = handleValidationError(error);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  } else if (err.code && err.code.startsWith('23')) {
    error = handleDatabaseError(err);
  }
  
  // Set default values
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';
  
  // Send error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

module.exports = {
  AppError,
  errorHandler
};