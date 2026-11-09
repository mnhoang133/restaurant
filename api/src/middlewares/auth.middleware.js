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

module.exports = {
  requireAuth
};
