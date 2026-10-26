/**
 * Helper chuẩn hóa phản hồi REST API theo tiêu chuẩn Block 6 (REST API và SPA):
 * - Thành công: HTTP 200, { ok: true, data: ... }
 * - Lỗi nghiệp vụ: BẮT BUỘC HTTP 200, { ok: false, error: { code, message, fields? } }
 * - Lỗi kỹ thuật: HTTP 404 (sai URL) hoặc HTTP 500 (crash server/DB), KHÔNG có trường 'ok'.
 */

/**
 * Trả về kết quả thành công
 */
function sendSuccess(res, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    ok: true,
    data,
  });
}

/**
 * Lỗi nghiệp vụ: Không tìm thấy tài nguyên hoặc đã bị soft-delete
 * Mã lỗi: NOT_FOUND (Slide 16, 44)
 */
function sendNotFound(res, message = 'Bản ghi không tồn tại hoặc đã bị xóa.') {
  return res.status(200).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message,
    },
  });
}

/**
 * Lỗi nghiệp vụ: Dữ liệu không hợp lệ hoặc thiếu trường bắt buộc
 * Mã lỗi: VALIDATION_FAILED (Slide 14, 16)
 */
function sendValidationFailed(res, fields = {}, message = 'Dữ liệu không hợp lệ hoặc thiếu trường bắt buộc.') {
  return res.status(200).json({
    ok: false,
    error: {
      code: 'VALIDATION_FAILED',
      message,
      fields,
    },
  });
}

/**
 * Lỗi nghiệp vụ: Trùng mã code (@unique trong schema)
 * Mã lỗi: DUPLICATE_CODE
 */
function sendDuplicateCode(res, codeValue, fieldName = 'code', message = null) {
  const msg = message || `Mã '${codeValue}' đã tồn tại trong hệ thống.`;
  return res.status(200).json({
    ok: false,
    error: {
      code: 'DUPLICATE_CODE',
      message: msg,
      fields: {
        [fieldName]: msg,
      },
    },
  });
}

/**
 * Lỗi nghiệp vụ: ID tài nguyên liên kết (Chef/Ingredient/Dish) không tồn tại hoặc đã bị xóa
 * Mã lỗi: RELATED_RESOURCE_NOT_FOUND
 */
function sendRelatedNotFound(res, fields = {}, message = 'Tài nguyên liên kết không tồn tại hoặc đã bị xóa.') {
  return res.status(200).json({
    ok: false,
    error: {
      code: 'RELATED_RESOURCE_NOT_FOUND',
      message,
      fields,
    },
  });
}

/**
 * Lỗi nghiệp vụ chung / tùy biến (FILE_TOO_LARGE, INVALID_FILE_TYPE, IMAGE_LIMIT_EXCEEDED, ...)
 */
function sendBusinessError(res, code, message, fields = undefined) {
  const errorObj = { code, message };
  if (fields && Object.keys(fields).length > 0) {
    errorObj.fields = fields;
  }
  return res.status(200).json({
    ok: false,
    error: errorObj,
  });
}

/**
 * Chuẩn hóa danh sách ID gửi từ JSON array hoặc FormData (chuỗi JSON '[1,2]' hoặc chuỗi phân cách dấu phẩy)
 */
function parseIdArray(raw) {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((v) => Number(v)).filter((n) => !isNaN(n) && n > 0);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '[]') return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => Number(v)).filter((n) => !isNaN(n) && n > 0);
        }
      } catch (_) {
        // ignore JSON parse error
      }
    }
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((n) => !isNaN(n) && n > 0);
    }
    const single = Number(trimmed);
    return !isNaN(single) && single > 0 ? [single] : [];
  }
  const num = Number(raw);
  return !isNaN(num) && num > 0 ? [num] : [];
}

module.exports = {
  sendSuccess,
  sendNotFound,
  sendValidationFailed,
  sendDuplicateCode,
  sendRelatedNotFound,
  sendBusinessError,
  parseIdArray,
};
