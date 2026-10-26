const { sendNotFound } = require('../utils/response');

/**
 * Middleware xử lý ép kiểu ID từ URL (chuỗi -> số nguyên dương)
 * Quy tắc Slide 18: "Id sai kiểu xử lý như không có bản ghi, cần kiểm tra trước khi truy cập database"
 */
function parseIntegerId(paramName = 'id') {
  return (req, res, next) => {
    const rawId = req.params[paramName];
    const parsed = parseInt(rawId, 10);

    // Kiểm tra tính hợp lệ: phải là số nguyên dương hợp lệ
    if (!rawId || isNaN(parsed) || parsed <= 0 || String(parsed) !== rawId.trim()) {
      return sendNotFound(res, `Bản ghi với ID '${rawId}' không tồn tại.`);
    }

    // Gắn ID đã parse vào req để các controller phía sau sử dụng an toàn
    req.parsedId = parsed;
    next();
  };
}

module.exports = {
  parseIntegerId,
};
