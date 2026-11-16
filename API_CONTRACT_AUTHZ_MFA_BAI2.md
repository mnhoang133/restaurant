# 📜 TÀI LIỆU HỢP ĐỒNG API & KẾ HOẠCH TÁC CHIẾN BÀI 2 (RBAC, ABAC & MFA)

> **Mục tiêu:** Tài liệu chuẩn hóa giao tiếp 100% giữa **Backend (`api/`)** và **Frontend (`web/`)** cho Bài 2 (Phân quyền RBAC, ABAC và Xác thực nhiều yếu tố MFA TOTP + Recovery Code), đảm bảo 2 thành viên code song song trong 90 phút **không xung đột Git (Zero Merge Conflict)** và khớp hoàn toàn với bộ `web/src/api/client.js` hiện có.

---

## PHẦN 1. PHÂN CHIA CÔNG VIỆC ĐỘC LẬP FILE (ZERO MERGE CONFLICT)

| Thành viên | Phạm vi thư mục | Danh sách file phụ trách cụ thể | Công việc chính |
| :--- | :--- | :--- | :--- |
| **TV 1: Backend Lead** | Chỉ sửa trong **`api/`** | • `api/prisma/schema.prisma`<br>• `api/scripts/sync-auth-db.js`<br>• `api/src/middlewares/auth.middleware.js`<br>• `api/src/services/auth.service.js`<br>• `api/src/controllers/auth.controller.js`<br>• `api/src/routes/auth.routes.js`<br>• `api/src/routes/api.routes.js`<br>• `api/src/controllers/dish.controller.js`<br>• `api/src/services/dish.service.js` | 1. Thêm cột DB (`User`, `Dish`, bảng `RecoveryCode`) + Seed 4 user & món `draft`/`published`.<br>2. Viết middleware `requireRole(...)` (Cổng 2 RBAC) và kiểm tra ABAC trong `dish.controller.js` (Cổng 4).<br>3. Viết luồng TOTP (AES-256 secret, QR URI, verify ±1 bước, chống replay `lastTotpStep`, Recovery Code, `mfaPending` challenge). |
| **TV 2: Frontend Lead** | Chỉ sửa trong **`web/`** | • `web/src/api/client.js`<br>• `web/src/context/AuthContext.jsx`<br>• `web/src/App.jsx`<br>• `web/src/components/AdminNav.jsx`<br>• `web/src/pages/auth/LoginPage.jsx`<br>• *(Tạo mới)* `web/src/pages/auth/MfaVerifyPage.jsx`<br>• *(Tạo mới)* `web/src/pages/admin/AdminMfaPage.jsx`<br>• `web/src/pages/admin/AdminDishesListPage.jsx`<br>• `web/src/pages/admin/AdminDishFormPage.jsx`<br>• `web/src/pages/admin/AdminChefsListPage.jsx`<br>• `web/src/pages/admin/AdminIngredientsListPage.jsx` | 1. Thêm hàm gọi API MFA vào `apiClient.auth`.<br>2. Xử lý khi `login` trả về `next: "mfa"` -> chuyển sang màn nhập OTP / Recovery Code.<br>3. Làm trang Cài đặt MFA (hiện QR, nhập 6 số bật MFA, hiện Recovery Code 1 lần, form tắt/đổi MFA).<br>4. Ẩn/hiện nút Thêm/Sửa/Xóa theo `user.role`, `user.chefId`, `dish.chefId`, `dish.status` và hiển thị báo lỗi khi bị `403 FORBIDDEN` (giữ nguyên đăng nhập, không xóa token). |
| **TV 3 (Nếu có 3 người)** | Chỉ sửa trong **`bruno/`** & **`api/scripts/`** | • *(Tạo mới)* `api/scripts/test-b2-authz-mfa.js`<br>• Thư mục `bruno/` + File báo cáo nghiệm thu | 1. Viết script tự động test toàn bộ bảng nghiệm thu bằng request trực tiếp (không qua UI).<br>2. Vẽ sơ đồ 4 cổng ABAC + State Machine MFA.<br>3. Chụp ảnh bằng chứng F12, Supabase, che token/hash. |

---

## PHẦN 2. QUY TẮC GIAO TIẾP CHUNG (GIỮ NGUYÊN TỪ BÀI 1)

* **Base URL:** `http://localhost:3000/api`
* **Header xác thực:** `Authorization: Bearer <accessToken>` (chỉ gắn khi đã qua hết MFA).
* **Cấu trúc phản hồi chuẩn (khớp 3 tầng lỗi trong `web/src/api/client.js`):**
  * **Thành công:** HTTP `200`, `{ "ok": true, "data": { ... } }`
  * **Lỗi nghiệp vụ (Nhập sai OTP/Password/Validation/NotFound):** HTTP `200`, `{ "ok": false, "error": { "code": "...", "message": "...", "fields": {} } }`
  * **Lỗi Chưa xác thực / Token sai / Gửi `challenge` vào API CRUD:** HTTP `401`, `{ "ok": false, "error": { "code": "UNAUTHENTICATED" | "TOKEN_EXPIRED", "message": "..." } }` -> `client.js` tự xóa token và đẩy về `/login`.
  * **Lỗi Không đủ quyền (RBAC / ABAC):** HTTP `403`, `{ "ok": false, "error": { "code": "FORBIDDEN", "message": "..." } }` -> **FE giữ nguyên đăng nhập (không xóa token)**, chỉ hiện thông báo lỗi không đủ quyền (`res.error.status === 403` hoặc `res.error.type === 'forbidden'`).
  * **Lỗi Quá giới hạn thử (Rate Limit / Khóa tạm):** HTTP `429`, `{ "ok": false, "error": { "code": "RATE_LIMITED", "message": "..." } }`

---

## PHẦN 3. CẤU TRÚC MODEL DỮ LIỆU CHUẨN (DATA SCHEMAS)

### 3.1. Database Contract (Các bảng/cột thêm mới ở Backend)
1. **Bảng `users` (`User`):**
   * `chefId` (`Int?`, FK -> `chefs.id` — `null` với `viewer`/`admin`, số nguyên với `editor`)
   * `mfaEnabled` (`Boolean`, default `false` — chỉ bật `true` sau khi xác nhận đúng mã 6 số lần đầu)
   * `mfaSecret` (`String?` — lưu mã hóa đối xứng AES-256, không băm 1 chiều, không lưu rõ)
   * `lastTotpStep` (`Int?` — lưu bước thời gian `floor(t / 30)` gần nhất để chống dùng lại mã TOTP trong cùng 30s)
2. **Bảng `dishes` (`Dish`):**
   * `chefId` (`Int?`, FK -> `chefs.id` — đầu bếp phụ trách chính của món ăn)
   * `status` (`String`, default `'draft'` — nhận `'draft'` hoặc `'published'`)
3. **Bảng mới `recovery_codes` (`RecoveryCode`):**
   * `id` (`Int`, PK), `userId` (`Int`, FK -> `users.id`), `codeHash` (`String`), `usedAt` (`DateTime?`), `createdAt` (`DateTime`)

### 3.2. Object `user` trả về cho Frontend (trong `login`, `mfa`, `me`)
```json
{
  "id": 2,
  "email": "editor1@restaurant.local",
  "rawEmail": "editor1@restaurant.local",
  "name": "Đầu bếp Trưởng A",
  "role": "editor",          // "viewer" | "editor" | "admin"
  "chefId": 1,               // Integer (nếu là editor) | null (nếu là viewer hoặc admin)
  "mfaEnabled": true,        // Boolean: Đã bật xác thực 2 lớp chưa
  "status": "active"
}
```

### 3.3. Object `dish` trả về cho Frontend (trong `GET /api/dishes`, `GET /api/dishes/:id`, `POST`, `PATCH`)
Giữ nguyên toàn bộ trường hiện tại (`id`, `code`, `name`, `price`, `category`, `description`, `isAvailable`, `images`, `chefs`, `ingredients`), **thêm 2 trường bắt buộc ở cấp ngoài cùng**:
```json
{
  "id": 15,
  "code": "DISH-015",
  "name": "Gà Rán Sốt Cay",
  "price": 65000,
  "category": "Gà Rán",
  "isAvailable": true,
  "chefId": 1,               // [MỚI - ABAC] ID đầu bếp phụ trách chính của món
  "chef": { "id": 1, "name": "Chef Gordon", "code": "CHEF-001" }, // [MỚI - Tiện cho FE hiển thị tên]
  "status": "draft",         // [MỚI - ABAC] "draft" (Nháp) | "published" (Đã xuất bản)
  "images": [],
  "chefs": [],
  "ingredients": []
}
```

### 3.4. Danh sách 4 Tài khoản Seed có sẵn để FE & BE test ngay
*(Mật khẩu chung mặc định: `Restaurant@2026`)*
1. **`viewer@restaurant.local`** — `role: "viewer"`, `chefId: null`, `mfaEnabled: false`
2. **`editor1@restaurant.local`** — `role: "editor"`, `chefId: 1`, `mfaEnabled: false`
3. **`editor2@restaurant.local`** — `role: "editor"`, `chefId: 2`, `mfaEnabled: false`
4. **`admin@restaurant.local`** — `role: "admin"`, `chefId: null`, `mfaEnabled: false`

---

## PHẦN 4. CHI TIẾT CÁC ENDPOINT MFA (`/api/auth/*`)

### 4.1. Bước 1 Đăng nhập: `POST /api/auth/login` (Cập nhật hành vi)
* **Request Body:**
  ```json
  {
    "email": "editor1@restaurant.local",
    "password": "Restaurant@2026",
    "captchaToken": "optional_token"
  }
  ```
* **Response TH1 — Tài khoản CHƯA bật MFA (`mfaEnabled === false`):** (HTTP `200`)
  ```json
  {
    "ok": true,
    "data": {
      "next": "done",
      "accessToken": "eyJhbGciOiJIUzI1Ni...",
      "expiresIn": 900,
      "user": {
        "id": 2,
        "email": "editor1@restaurant.local",
        "name": "Đầu bếp Trưởng A",
        "role": "editor",
        "chefId": 1,
        "mfaEnabled": false,
        "status": "active"
      }
    }
  }
  ```
* **Response TH2 — Tài khoản ĐÃ bật MFA (`mfaEnabled === true`):** (HTTP `200` — **CHƯA CẤP `accessToken`** theo đúng Slide 56 & Slide 17 Deck tương tác)
  ```json
  {
    "ok": true,
    "data": {
      "next": "mfa",
      "challenge": "c7f8a91b2e...",
      "mfaToken": "c7f8a91b2e...",
      "email": "editor1@restaurant.local",
      "message": "Mật khẩu hợp lệ. Vui lòng nhập mã xác thực 2 lớp (TOTP hoặc Recovery Code)."
    }
  }
  ```
  *(Lưu ý: BE trả về cả 2 trường `challenge` và `mfaToken` có cùng giá trị để FE gọi tên nào cũng chạy).*

---

### 4.2. Bước 2 Đăng nhập (Xác thực MFA): `POST /api/auth/mfa` *(Hỗ trợ cả alias `POST /api/auth/mfa/verify`)*
* **Auth Header:** Không cần `Bearer` (dùng `challenge` từ bước 1).
* **Request Body:**
  ```json
  {
    "challenge": "c7f8a91b2e...",
    "code": "123456"
  }
  ```
  *(Lưu ý: `code` có thể là mã 6 số từ Google Authenticator `123456` HOẶC mã dự phòng Recovery Code dạng `7KQ2-M9XD`. BE tự động nhận diện cả hai).*
* **Response Thành công:** (HTTP `200`)
  ```json
  {
    "ok": true,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1Ni...",
      "expiresIn": 900,
      "usedRecoveryCode": false,
      "user": {
        "id": 2,
        "email": "editor1@restaurant.local",
        "name": "Đầu bếp Trưởng A",
        "role": "editor",
        "chefId": 1,
        "mfaEnabled": true,
        "status": "active"
      }
    }
  }
  ```
* **Response Lỗi:**
  * Mã sai, dùng lại mã TOTP cũ trong cùng 30s, hoặc Recovery Code đã dùng rồi (HTTP `200`):
    ```json
    {
      "ok": false,
      "error": {
        "code": "INVALID_MFA_CODE",
        "message": "Mã xác thực không đúng hoặc đã được sử dụng."
      }
    }
    ```
  * Phiên chờ `challenge` hết hạn hoặc không hợp lệ (HTTP `200`):
    ```json
    {
      "ok": false,
      "error": {
        "code": "MFA_CHALLENGE_EXPIRED",
        "message": "Phiên chờ MFA đã hết hạn. Vui lòng đăng nhập lại từ đầu."
      }
    }
    ```
  * Nhập sai quá 5 lần -> Khóa tạm 5 phút (HTTP `429`):
    ```json
    {
      "ok": false,
      "error": {
        "code": "RATE_LIMITED",
        "message": "Bạn đã nhập sai mã MFA quá 5 lần. Tài khoản tạm khóa 5 phút."
      }
    }
    ```

---

### 4.3. Khởi tạo thiết lập MFA (Bước 1 & 2): `POST /api/auth/mfa/setup`
* **Auth Header:** Bắt buộc `Authorization: Bearer <accessToken>`
* **Request Body:** `{}` (Rỗng)
* **Hành vi BE:** Sinh `secret` mới, lưu mã hóa vào DB nhưng **giữ `mfaEnabled = false`** (nếu user bỏ dở chưa xác nhận thì lần sau đăng nhập vẫn không bị khóa).
* **Response Thành công:** (HTTP `200`)
  ```json
  {
    "ok": true,
    "data": {
      "secret": "JBSWY3DPEHPK3PXP",
      "otpauthUrl": "otpauth://totp/RestaurantApp:editor1@restaurant.local?secret=JBSWY3DPEHPK3PXP&issuer=RestaurantApp",
      "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
    }
  }
  ```
  *(FE chỉ cần gắn trực tiếp `<img src={data.qrCodeDataUrl} />` và hiển thị chuỗi `data.secret` để nhập tay).*
* **Response Lỗi (Nếu đã bật MFA rồi):** (HTTP `200`)
  ```json
  {
    "ok": false,
    "error": {
      "code": "MFA_ALREADY_ENABLED",
      "message": "Tài khoản đã bật MFA."
    }
  }
  ```

---

### 4.4. Xác nhận mã đầu tiên & Bật MFA (Bước 3 & 4): `POST /api/auth/mfa/enable`
* **Auth Header:** Bắt buộc `Authorization: Bearer <accessToken>`
* **Request Body:**
  ```json
  {
    "code": "123456"
  }
  ```
* **Hành vi BE:** Kiểm tra mã 6 số khớp với secret vừa tạo -> Đặt `mfaEnabled = true`, cập nhật `lastTotpStep`, sinh 8 mã `RecoveryCode` (lưu hash vào DB, trả bản rõ về FE **1 lần duy nhất**).
* **Response Thành công:** (HTTP `200`)
  ```json
  {
    "ok": true,
    "data": {
      "mfaEnabled": true,
      "recoveryCodes": [
        "7KQ2-M9XD", "P4TZ-8HWN", "J6RC-2VLB", "X3MF-Q7YA",
        "D9GS-5KEU", "H2NB-W8PR", "K8VW-3NTC", "R5LP-9YJM"
      ],
      "message": "Đã kích hoạt MFA thành công. Hãy lưu lại các mã dự phòng này ở nơi an toàn (chỉ hiển thị 1 lần duy nhất)."
    }
  }
  ```
* **Response Lỗi:**
  * Nhập sai mã 6 số (HTTP `200`, `mfaEnabled` vẫn giữ `false`):
    ```json
    {
      "ok": false,
      "error": {
        "code": "INVALID_MFA_CODE",
        "message": "Mã 6 số không khớp. MFA chưa được bật, vui lòng kiểm tra lại ứng dụng Authenticator."
      }
    }
    ```

---

### 4.5. Tắt MFA (Xác thực lại): `POST /api/auth/mfa/disable`
* **Auth Header:** Bắt buộc `Authorization: Bearer <accessToken>`
* **Request Body (Bắt buộc nhập lại Password + Mã TOTP hoặc Recovery Code theo Slide 55):**
  ```json
  {
    "password": "Restaurant@2026",
    "code": "123456"
  }
  ```
* **Response Thành công:** (HTTP `200`)
  ```json
  {
    "ok": true,
    "data": {
      "mfaEnabled": false,
      "message": "Đã tắt xác thực 2 lớp (MFA) thành công."
    }
  }
  ```
* **Response Lỗi:**
  * Sai mật khẩu: `{ "ok": false, "error": { "code": "INVALID_CREDENTIALS", "message": "Mật khẩu hiện tại không đúng." } }`
  * Sai mã TOTP/Recovery: `{ "ok": false, "error": { "code": "INVALID_MFA_CODE", "message": "Mã xác thực không hợp lệ." } }`

---

### 4.6. Tạo lại bộ Recovery Code mới: `POST /api/auth/mfa/recovery-codes` *(Alias: `/api/auth/mfa/recovery-codes/regenerate`)*
* **Auth Header:** Bắt buộc `Authorization: Bearer <accessToken>`
* **Request Body (Bắt buộc xác thực lại Password + Mã TOTP hoặc Recovery Code):**
  ```json
  {
    "password": "Restaurant@2026",
    "code": "123456"
  }
  ```
* **Hành vi BE:** Xóa sạch toàn bộ `RecoveryCode` cũ của user trong DB (nhóm cũ vô hiệu hoàn toàn), sinh 8 mã mới, lưu hash và trả bản rõ 1 lần.
* **Response Thành công:** (HTTP `200`)
  ```json
  {
    "ok": true,
    "data": {
      "recoveryCodes": [
        "A2BC-9DEF", "M4NP-7QRS", "T8UV-3WXY", "Z6KL-2HJM",
        "B9CD-4EFG", "N3PQ-8RST", "V7WX-5YZA", "C4DE-6FGH"
      ],
      "message": "Đã tạo bộ mã dự phòng mới. Toàn bộ mã dự phòng cũ đã bị vô hiệu hóa."
    }
  }
  ```

---

## PHẦN 5. MA TRẬN PHÂN QUYỀN CRUD TRÊN API & GIAO DIỆN (RBAC + ABAC)

### 5.1. Bảng Quy tắc 4 Cổng trên `/api/dishes`

| Thao tác | `viewer` | `editor` (`user.chefId = K`) | `admin` |
| :--- | :--- | :--- | :--- |
| **Xem (`GET /api/dishes`, `GET /api/dishes/:id`)** | ✅ Được phép | ✅ Được phép | ✅ Được phép |
| **Thêm (`POST /api/dishes`)** | ❌ Chặn Cổng 2 (`403 FORBIDDEN`) | ✅ Được phép.<br>• Server **tự động gán** `chefId = user.chefId` và `status = "draft"`.<br>• Mọi giá trị `chefId`, `status` gửi trong body đều bị **bỏ qua**. | ✅ Được phép.<br>• Được truyền `chefId` (số nguyên) và `status` (`"draft"` \| `"published"`). Mặc định nếu không truyền: `status = "draft"`. |
| **Sửa (`PATCH /api/dishes/:id`)** | ❌ Chặn Cổng 2 (`403 FORBIDDEN`) | ⚠️ **Xét Cổng 4 (ABAC) trên bản ghi DB:**<br>• ✅ Cho phép nếu **`dish.chefId === user.chefId`** VÀ **`dish.status === "draft"`**.<br>• ❌ Trả `403 FORBIDDEN` nếu món của đầu bếp khác (`dish.chefId !== user.chefId`) HOẶC món đã xuất bản (`dish.status === "published"`).<br>• Server **bỏ qua** `status` và `chefId` nếu `editor` gửi lên trong body. | ✅ Được phép sửa **mọi món ăn** (cả của đầu bếp khác lẫn món `published`).<br>• Được phép đổi `status` (`draft` <-> `published`) và đổi `chefId`. |
| **Xóa (`DELETE /api/dishes/:id` & xóa ảnh)** | ❌ Chặn Cổng 2 (`403 FORBIDDEN`) | ❌ Chặn Cổng 2 (`403 FORBIDDEN`) | ✅ Được phép |

### 5.2. Bảng Quy tắc trên `/api/chefs` và `/api/ingredients`
* **Xem (`GET`):** Cho phép tất cả.
* **Thêm / Sửa (`POST`, `PATCH`):** Chỉ `editor` và `admin` được phép (`viewer` bị chặn `403 FORBIDDEN`).
* **Xóa (`DELETE`):** Chỉ `admin` được phép (`viewer` và `editor` bị chặn `403 FORBIDDEN`).

### 5.3. Code mẫu cho Frontend (`web/src/api/client.js` & Helpers)

**1. Thêm vào `apiClient.auth` trong `web/src/api/client.js`:**
```js
verifyMfa: (body) => request('/auth/mfa', { method: 'POST', body }),
setupMfa: () => request('/auth/mfa/setup', { method: 'POST', body: {} }),
enableMfa: (body) => request('/auth/mfa/enable', { method: 'POST', body }),
disableMfa: (body) => request('/auth/mfa/disable', { method: 'POST', body }),
regenerateRecoveryCodes: (body) => request('/auth/mfa/recovery-codes', { method: 'POST', body }),
```

**2. Helper kiểm tra quyền trên giao diện:**
```js
export const canCreate = (user) =>
  Boolean(user && (user.role === 'admin' || user.role === 'editor'));

export const canDelete = (user) =>
  Boolean(user && user.role === 'admin');

export const canUpdateDish = (user, dish) => {
  if (!user || !dish) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'editor') {
    return Number(dish.chefId) === Number(user.chefId) && dish.status === 'draft';
  }
  return false;
};
```

---

## PHẦN 6. LƯU Ý KIẾN TRÚC ĐỂ DỄ SCALE & GỠ LỖI NHANH KHI CÓ SỰ CỐ (DEFENSIVE DESIGN)

1. **Chấp nhận đa tên trường ở Backend (Alias Tolerance):**
   * Ở bước MFA: Backend nhận cả `req.body.challenge` lẫn `req.body.mfaToken`, và nhận cả `req.body.code`, `req.body.otp`, `req.body.token`.
   * Ở route: Backend mở sẵn cả 2 đường dẫn `/api/auth/mfa` và `/api/auth/mfa/verify`, cả `/api/auth/mfa/recovery-codes` và `/api/auth/mfa/recovery-codes/regenerate`. Bên FE gọi đường nào cũng trúng, không bao giờ bị lỗi `404`.
2. **Backend trả sẵn ảnh QR dạng Base64 (`qrCodeDataUrl`) + chuỗi `otpauthUrl` + `secret`:**
   * FE **không cần cài thêm bất kỳ thư viện vẽ QR nào** trong `web/package.json` (tránh lỗi `npm install` hoặc lệch version React). FE chỉ cần `<img src={res.data.qrCodeDataUrl} />` là lên hình QR ngay lập tức!
3. **Cách xử lý `FormData` khi tạo/sửa món ăn (`POST / PATCH /api/dishes`):**
   * Hiện tại `AdminDishFormPage.jsx` gửi dữ liệu bằng `FormData` (để upload ảnh). Mọi giá trị trong `FormData` khi lên Backend đều là `string` (ví dụ `chefId: "1"`, `status: "published"`).
   * **Về phía BE:** Luôn ép kiểu `Number(req.body.chefId)` trước khi kiểm tra và lưu DB, đồng thời nếu `req.user.role === 'editor'` thì ghi đè trực tiếp từ `req.user.chefId` (bỏ qua `FormData`).
   * **Về phía FE:** Khi `user.role === 'admin'`, chỉ cần `formData.append('status', status)` và `formData.append('chefId', String(chefId))`.
4. **Cách FE xử lý khi mở trực tiếp URL `/admin/dishes/:id/edit` mà không đủ quyền:**
   * Khi trang `AdminDishFormPage.jsx` tải dữ liệu món ăn xong (`GET /api/dishes/:id`), nếu `!canUpdateDish(user, dish)` **HOẶC** khi người dùng bấm Lưu (`PATCH`) mà nhận về `res.error?.status === 403` (do Admin vừa đổi sang `published` ở tab khác):
   * Hiển thị ngay banner đỏ / giao diện **403 Không đủ quyền truy cập** ngay trên trang, **tuyệt đối không gọi `clearAuth()` hay đẩy về `/login`**.
5. **Chặn việc `challenge` bị gửi nhầm làm `Bearer` token (Bẫy nghiệm thu Slide 56):**
   * Bên BE ký `challenge` với claim `{ purpose: "mfa_challenge", sub: user.id }`.
   * Nếu kẻ tấn công (hoặc thầy giáo lúc chấm bài) lấy chuỗi `challenge` này gắn vào `Authorization: Bearer <challenge>` để gọi `POST /api/dishes`, middleware `requireAuth` kiểm tra thấy `payload.purpose === "mfa_challenge"` sẽ lập tức từ chối với **`401 UNAUTHENTICATED`**.
