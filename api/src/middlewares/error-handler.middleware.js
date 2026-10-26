/**
 * Middleware bắt lỗi 404 Not Found (Lỗi kỹ thuật do sai URL)
 * Slide 51: "URL /api sai trả 404; hai loại này không theo response shape"
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not Found',
    message: `Đường dẫn '${req.originalUrl}' không tồn tại trên hệ thống.`,
  });
}

/**
 * Middleware bắt lỗi tập trung 500 Server Error (Lỗi kỹ thuật hệ thống / database)
 * Slide 51: "lỗi hệ thống trả 500; hai loại này không theo response shape"
 */
function globalErrorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]:', err);

  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: err.message || 'Lỗi hệ thống nội bộ.',
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};
