const multer = require('multer');
const { sendBusinessError } = require('../utils/response');

// Lưu trữ ảnh trong RAM (Buffer) trước khi chuyển lên Supabase / Disk
const storage = multer.memoryStorage();

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('INVALID_FILE_TYPE');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn 5MB mỗi ảnh (FILE_TOO_LARGE)
    files: 5, // Tối đa 5 ảnh một lần upload (IMAGE_LIMIT_EXCEEDED)
  },
});

/**
 * Middleware bọc xử lý upload và bắt lỗi nghiệp vụ trả HTTP 200:
 * - FILE_TOO_LARGE: Ảnh vượt quá 5MB
 * - IMAGE_LIMIT_EXCEEDED: Quá 5 ảnh
 * - INVALID_FILE_TYPE: Sai định dạng file
 */
function handleUpload(fieldName = 'images', maxCount = 5) {
  const uploadMiddleware = upload.array(fieldName, maxCount);

  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendBusinessError(
            res,
            'FILE_TOO_LARGE',
            'Ảnh vượt quá giới hạn 5 MB mỗi file.',
            { [fieldName]: 'Ảnh vượt quá dung lượng tối đa cho phép (5 MB).' }
          );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
          return sendBusinessError(
            res,
            'IMAGE_LIMIT_EXCEEDED',
            'Người dùng tải lên quá 5 ảnh trong một lần hoặc vượt giới hạn.',
            { [fieldName]: 'Chỉ được phép tải lên tối đa 5 ảnh trong một lần.' }
          );
        }
        return sendBusinessError(
          res,
          'VALIDATION_FAILED',
          err.message || 'Lỗi kiểm tra file tải lên.',
          { [fieldName]: err.message }
        );
      }

      if (err.code === 'INVALID_FILE_TYPE' || err.message === 'INVALID_FILE_TYPE') {
        return sendBusinessError(
          res,
          'INVALID_FILE_TYPE',
          'File tải lên không thuộc định dạng được cho phép (chỉ hỗ trợ JPEG, PNG, WEBP, GIF).',
          { [fieldName]: 'Định dạng file không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP, GIF.' }
        );
      }

      return sendBusinessError(
        res,
        'INVALID_FILE_TYPE',
        err.message || 'Lỗi định dạng file tải lên.',
        { [fieldName]: err.message }
      );
    });
  };
}

module.exports = {
  upload,
  handleUpload,
};
