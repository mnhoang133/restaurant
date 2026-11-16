const authService = require('../services/auth.service');

/**
 * Middleware Gate 1: Kiểm tra xác thực Bearer JWT cho REST API (Slide 11, 36, 44, 62)
 * - Không chặn request OPTIONS (CORS Preflight)
 * - Đọc header Authorization: Bearer <token>
 * - Trả HTTP 401 UNAUTHENTICATED khi thiếu token, sai định dạng, sai chữ ký, hoặc token đã bị thu hồi
 * - Trả HTTP 401 TOKEN_EXPIRED khi token hết hạn (exp)
 */
async function requireAuth(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Vui lòng đăng nhập để thực hiện thao tác này.'
        }
      });
    }

    const rawToken = authHeader.slice(7).trim();
    const verifyResult = await authService.verifyAccessToken(rawToken);

    if (!verifyResult.valid) {
      return res.status(verifyResult.status || 401).json({
        ok: false,
        error: {
          code: verifyResult.code || 'UNAUTHENTICATED',
          message: verifyResult.message || 'Phiên đăng nhập không hợp lệ.'
        }
      });
    }

    req.user = verifyResult.user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Middleware Gate 2 (RBAC): Kiểm tra quyền theo Role của User đã đọc từ Database (Slide 37, 38, 43, 62)
 * - Viewer: chỉ đọc (chặn mọi thao tác ghi với 403 FORBIDDEN)
 * - Editor: đọc, thêm, sửa (chặn xóa với 403 FORBIDDEN)
 * - Admin: đọc, thêm, sửa, xóa
 */
function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => String(r).toLowerCase().trim());

  return (req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }

    if (!req.user || !req.user.role) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Vui lòng đăng nhập để thực hiện thao tác này.'
        }
      });
    }

    const userRole = String(req.user.role).toLowerCase().trim();
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: `Tài khoản có vai trò '${req.user.role}' không đủ quyền thực hiện thao tác này.`
        }
      });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
