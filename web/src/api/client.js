/**
 * ==========================================================================
 * LỚP GỌI API DUY NHẤT CỦA SPA (Single API Client Layer)
 * ==========================================================================
 * Tuân thủ nghiêm ngặt quy tắc trong bài học:
 * 1. Một chỗ duy nhất đặt URL gốc (BASE_URL) và cấu hình header.
 * 2. Một chỗ duy nhất kiểm tra 3 tầng lỗi:
 *    - Tầng 1: Không nhận được response (Lỗi mạng, API tắt, hoặc bị chặn CORS) -> Lỗi kỹ thuật (type: 'technical')
 *    - Tầng 2: HTTP status không phải 2xx (404 sai URL, 500 lỗi hệ thống, 400 bad JSON) -> Lỗi kỹ thuật (type: 'technical')
 *    - Tầng 3: HTTP status 200 nhưng body.ok === false -> Lỗi nghiệp vụ (type: 'business', kèm code, message, fields)
 *      Khi ok === false, tuyệt đối không trả dữ liệu lên mà trả về lỗi để trang báo error message!
 * 3. Không đặt Content-Type cho GET để tránh preflight không cần thiết.
 * 4. Quản lý bộ đếm active requests để hiển thị loading indicator và vô hiệu hóa toàn bộ nút bấm khi đang chờ backend.
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const BACKEND_ORIGIN = (import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');

// Quản lý trạng thái loading của các request API đang chạy (chỉ chứa số đếm, tuyệt đối không lưu trữ dữ liệu nghiệp vụ)
let activeRequestCount = 0;
const loadingListeners = new Set();

function notifyLoadingChange() {
  const isLoading = activeRequestCount > 0;
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('is-api-loading', isLoading);
    // Vô hiệu hóa trực tiếp thuộc tính disabled trên tất cả các thẻ <button> trên trang khi đang loading
    const buttons = document.querySelectorAll('button');
    buttons.forEach((btn) => {
      if (isLoading) {
        if (!btn.disabled) {
          btn.dataset.spaTempDisabled = 'true';
          btn.disabled = true;
        }
      } else {
        if (btn.dataset.spaTempDisabled === 'true') {
          delete btn.dataset.spaTempDisabled;
          btn.disabled = false;
        }
      }
    });
  }
  loadingListeners.forEach((listener) => listener(isLoading));
}

export function subscribeApiLoading(listener) {
  loadingListeners.add(listener);
  listener(activeRequestCount > 0);
  return () => loadingListeners.delete(listener);
}

export function getApiLoadingState() {
  return activeRequestCount > 0;
}

/**
 * Chuẩn hóa đường dẫn ảnh trả về từ Backend (nếu là đường dẫn tương đối /uploads/... thì nối với BACKEND_ORIGIN)
 */
export function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  if (imageUrl.startsWith('/uploads/')) {
    return `${BACKEND_ORIGIN}${imageUrl}`;
  }
  return imageUrl;
}

/**
 * Hàm gọi HTTP trung tâm kiểm tra đủ 3 tầng lỗi
 * @returns {Promise<{ ok: true, data: any } | { ok: false, isAborted?: boolean, error: { type: 'technical' | 'business', code: string, message: string, fields?: Record<string, string> } }>}
 */
async function request(endpoint, { method = 'GET', body = undefined, signal = undefined } = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const options = {
    method,
    signal,
  };

  // Chỉ đặt Content-Type khi có body dạng JSON; nếu là FormData (upload ảnh) thì để trình duyệt tự gắn boundary; GET không gắn Content-Type
  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.headers = {
        'Content-Type': 'application/json',
      };
      options.body = JSON.stringify(body);
    }
  }

  activeRequestCount += 1;
  notifyLoadingChange();

  try {
    // TẦNG 1: Gọi mạng (Fetch). Nếu API tắt, mất mạng hoặc lỗi CORS -> rơi vào catch
    let response;
    try {
      response = await fetch(url, options);
    } catch (networkErr) {
      if (networkErr && networkErr.name === 'AbortError') {
        return {
          ok: false,
          isAborted: true,
          error: {
            type: 'aborted',
            code: 'ABORTED',
            message: 'Yêu cầu đã được hủy.',
          },
        };
      }
      return {
        ok: false,
        error: {
          type: 'technical',
          code: 'NETWORK_OR_CORS_ERROR',
          message:
            'Không thể kết nối tới máy chủ API (Máy chủ đang tắt, lỗi mạng hoặc bị chặn bởi CORS). Vui lòng kiểm tra lại kết nối và thử lại.',
        },
      };
    }

    // TẦNG 2: Kiểm tra HTTP Status (404 sai URL, 500 lỗi hệ thống, 400 lỗi cú pháp body)
    if (!response.ok) {
      return {
        ok: false,
        error: {
          type: 'technical',
          code: `HTTP_${response.status}`,
          message:
            response.status === 404
              ? `Lỗi kỹ thuật (404): Đường dẫn API '${endpoint}' không tồn tại.`
              : `Lỗi kỹ thuật từ máy chủ (HTTP ${response.status}). Hệ thống không thể xử lý yêu cầu lúc này.`,
        },
      };
    }

    // Kiểm tra xem body trả về có phải JSON hợp lệ và có trường 'ok' theo đúng response shape hay không
    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      return {
        ok: false,
        error: {
          type: 'technical',
          code: 'INVALID_JSON',
          message: 'Phản hồi từ máy chủ không đúng định dạng JSON.',
        },
      };
    }

    if (!payload || typeof payload.ok !== 'boolean') {
      return {
        ok: false,
        error: {
          type: 'technical',
          code: 'INVALID_RESPONSE_SHAPE',
          message: 'Phản hồi từ máy chủ không tuân thủ cấu trúc chuẩn (thiếu trường ok).',
        },
      };
    }

    // TẦNG 3: Kiểm tra kết quả nghiệp vụ (status 200 nhưng payload.ok === false)
    if (payload.ok === false) {
      const errInfo = payload.error || {};
      return {
        ok: false,
        error: {
          type: 'business',
          code: errInfo.code || 'BUSINESS_ERROR',
          message: errInfo.message || 'Yêu cầu không hợp lệ theo quy tắc nghiệp vụ.',
          fields: errInfo.fields || {},
        },
      };
    }

    // Thành công cả 3 tầng: trả về data
    return {
      ok: true,
      data: payload.data,
    };
  } finally {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    notifyLoadingChange();
  }
}

/**
 * Xây dựng query string từ object
 */
function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      searchParams.set(key, String(val).trim());
    }
  });
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

/**
 * Đối tượng API duy nhất cung cấp toàn bộ các lời gọi tới Backend
 */
export const apiClient = {
  // 1. MÓN ĂN (/api/dishes)
  dishes: {
    list: (params = {}, signal) => request(`/dishes${buildQuery(params)}`, { method: 'GET', signal }),
    getCategories: (signal) => request('/dishes/categories', { method: 'GET', signal }),
    getById: (id, signal) => request(`/dishes/${encodeURIComponent(id)}`, { method: 'GET', signal }),
    create: (formDataOrJson) => request('/dishes', { method: 'POST', body: formDataOrJson }),
    update: (id, formDataOrJson) =>
      request(`/dishes/${encodeURIComponent(id)}`, { method: 'PATCH', body: formDataOrJson }),
    remove: (id) => request(`/dishes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    removeImage: (dishId, imageId) =>
      request(`/dishes/${encodeURIComponent(dishId)}/images/${encodeURIComponent(imageId)}`, {
        method: 'DELETE',
      }),
  },

  // 2. ĐẦU BẾP (/api/chefs)
  chefs: {
    list: (params = {}, signal) => request(`/chefs${buildQuery(params)}`, { method: 'GET', signal }),
    getById: (id, signal) => request(`/chefs/${encodeURIComponent(id)}`, { method: 'GET', signal }),
    create: (formDataOrJson) => request('/chefs', { method: 'POST', body: formDataOrJson }),
    update: (id, formDataOrJson) =>
      request(`/chefs/${encodeURIComponent(id)}`, { method: 'PATCH', body: formDataOrJson }),
    remove: (id) => request(`/chefs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },

  // 3. NGUYÊN LIỆU (/api/ingredients)
  ingredients: {
    list: (params = {}, signal) => request(`/ingredients${buildQuery(params)}`, { method: 'GET', signal }),
    getById: (id, signal) => request(`/ingredients/${encodeURIComponent(id)}`, { method: 'GET', signal }),
    create: (payload) => request('/ingredients', { method: 'POST', body: payload }),
    update: (id, payload) =>
      request(`/ingredients/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
    remove: (id) => request(`/ingredients/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
};
