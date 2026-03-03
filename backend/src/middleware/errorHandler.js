function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    error: {
      message: error.message || "Unexpected server error.",
      code: error.code || "INTERNAL_ERROR"
    }
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
