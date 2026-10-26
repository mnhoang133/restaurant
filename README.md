# CRISPY HOUSE — Ứng Dụng Quản Lý Thực Đơn & Nhà Hàng (REST API & SPA)

Dự án được xây dựng theo kiến trúc tách rời hoàn toàn giữa **REST API Backend** và **Single-Page Application (SPA) Frontend**, chạy độc lập trên hai origin khác nhau và giao tiếp thuần túy bằng JSON qua HTTP.

---

## 1. Cấu Trúc Thư Mục Dự Án

```text
restaurant/
├── api/                        # Backend REST API (Node.js, Express, Prisma, PostgreSQL, Supabase)
│   ├── prisma/
│   │   ├── schema.prisma       # Mô hình CSDL (Dish, Chef, Ingredient & các bảng trung gian N-N)
│   │   └── seed.js             # Dữ liệu khởi tạo thực đơn CRISPY HOUSE
│   ├── scripts/
│   │   ├── test-all-requirements.js  # Script chạy Bruno CLI + kiểm định toàn bộ yêu cầu SPA/UI
│   │   └── test-comprehensive.js     # Bộ kiểm thử tích hợp (Integration Test Suite)
│   └── src/
│       ├── config/             # Kết nối Prisma & Supabase Storage
│       ├── controllers/        # Xử lý HTTP Request/Response chuẩn envelope { ok, data / error }
│       ├── middlewares/        # Kiểm tra ID nguyên dương, Upload ảnh (Multer), Error Handlers
│       ├── routes/             # Định tuyến REST API (/api/dishes, /api/chefs, /api/ingredients)
│       ├── services/           # Nghiệp vụ CRUD, Soft Delete & kiểm tra toàn vẹn khóa ngoại
│       ├── utils/              # Chuẩn hóa cấu trúc JSON trả về (response.helper.js)
│       ├── app.js              # Cấu hình Express & CORS
│       └── server.js           # Entry point khởi chạy cổng 3000
│
├── web/                        # Frontend SPA (React 18, Vite, React Router v6 Hash Mode)
│   ├── public/
│   │   ├── css/app.css         # Thiết kế giao diện & hiệu ứng trang
│   │   └── images/             # Favicon hình chiếc chảo & hình ảnh tĩnh
│   └── src/
│       ├── api/
│       │   └── client.js       # Lớp gọi API duy nhất (Single API Client Layer)
│       ├── components/         # Layout, AdminNav, Icon (SVG), StateViews (Loading/Error/404)
│       ├── pages/
│       │   ├── client/         # HomePage, DishesPage (Menu), DishDetailPage
│       │   └── admin/          # Quản lý Món ăn, Đầu bếp, Nguyên liệu (List, Form, Delete)
│       ├── App.jsx             # Cấu hình Client-Side Routing với createHashRouter
│       └── main.jsx            # Khởi tạo React DOM
│
└── bruno/                      # Bộ kiểm thử tự động REST API bằng Bruno CLI (.bru)
    ├── bruno.json
    ├── environments/local.bru
    └── 01..17-*.bru            # 17 kịch bản kiểm thử tự động (CRUD, Validation, Soft Delete, CORS)
```

---

## 2. Điểm Nổi Bật Về Kiến Trúc & Nghiệp Vụ

### 2.1. Backend REST API (`api/`)
- **Hợp đồng dữ liệu (Response Envelope) nhất quán**:
  - **Thành công (`HTTP 200 OK`)**:
    ```json
    { "ok": true, "data": { ... } }
    ```
    *(Đối với thao tác xóa `DELETE`, trả về `{ "ok": true, "data": null }`)*.
  - **Lỗi nghiệp vụ (`HTTP 200 OK`)**:
    ```json
    {
      "ok": false,
      "error": {
        "code": "NOT_FOUND | VALIDATION_FAILED | DUPLICATE_CODE | RELATED_RESOURCE_NOT_FOUND",
        "message": "Thông báo lỗi chi tiết bằng tiếng Việt",
        "fields": { "name": "...", "price": "..." }
      }
    }
    ```
  - **Lỗi kỹ thuật**: Sai đường dẫn API trả `HTTP 404`, lỗi cú pháp JSON trả `HTTP 400`, lỗi hệ thống trả `HTTP 500` *(không chứa trường `ok` để phân biệt rõ với kết quả xử lý nghiệp vụ)*.
- **Bảo mật CORS chuẩn**: Chỉ cấp quyền truy cập (`Access-Control-Allow-Origin`) cho đúng Origin của SPA (`http://localhost:5173`), hỗ trợ đầy đủ `Preflight Request (OPTIONS)` cho các phương thức `GET, POST, PATCH, PUT, DELETE`.
- **Xóa mềm (Soft Delete)**: Mọi thao tác xóa trên Món ăn, Đầu bếp và Nguyên liệu đều cập nhật `isDeleted = true` thay vì xóa vật lý nhằm bảo toàn lịch sử dữ liệu.

### 2.2. Frontend Single-Page Application (`web/`)
- **Client-Side Routing (Hash Mode)**: Sử dụng `createHashRouter` của `react-router-dom`. Ứng dụng được tổ chức thành nhiều trang độc lập tương tự SSR nhưng chuyển trang mượt mà ngay trên trình duyệt mà không tải lại tài liệu HTML.
- **Một lớp gọi API duy nhất (`src/api/client.js`)**: Toàn bộ các lời gọi `fetch` đến Backend đều đi qua `apiClient`. Các component/page không gọi `fetch` trực tiếp.
- **Xử lý chặt chẽ phản hồi `ok: false`**: Khi nhận `HTTP 200` nhưng `ok === false`, ứng dụng hiển thị thông báo lỗi (`error.message` và lỗi từng trường `error.fields`) thay vì render dữ liệu lỗi.
- **Trạng thái độc lập theo từng trang (Per-Page Isolated State)**: Mỗi trang chỉ tự tải dữ liệu của riêng trang đó khi truy cập, kèm `AbortController` hủy request cũ khi rời trang và **không chia sẻ dữ liệu** sang trang khác.
- **Loading Indicator & Khóa nút bấm**: Khi đang chờ phản hồi từ Backend, thanh trạng thái tải (`spa-loading-bar` & `spa-loading-badge`) sẽ xuất hiện và toàn bộ nút bấm (`<button>`) được vô hiệu hóa để tránh thao tác trùng lặp.
- **Giao diện Quản trị & Thực đơn trực quan**:
  - **Menu (`/dishes`) & Chi tiết món (`/dishes/:id`)**: Hỗ trợ tìm kiếm theo từ khóa kết hợp **bộ lọc dropdown theo danh mục** (`Gà Rán`, `Burger`, `Ăn Kèm`, `Combo`, `Nước Uống`), ẩn mã món ăn nội bộ để giao diện khách hàng gọn gàng.
  - **Quản lý Đầu bếp (`/admin/chefs`)**: Giao diện phân tách trực quan thành **2 danh sách**: *Món đầu bếp này nấu* (ở trên) và *Món đầu bếp này không nấu* (ở dưới). Khi chọn thêm món mới, món ăn lập tức chuyển lên danh sách trên; khi gỡ bỏ, món ăn di chuyển xuống danh sách dưới.
  - **Quản lý Nguyên liệu (`/admin/ingredients`)**: Tinh giản chỉ quản lý tên và mã nguyên liệu (đã lược bỏ số lượng tồn kho).
  - **Điều hướng Quản lý (`/admin`)**: Loại bỏ tab Tổng quan, tự động dẫn thẳng vào trang Quản lý Món ăn (`/admin/dishes`). Nút **Thêm mới** trên tất cả các trang quản lý được bố trí gọn trên cùng một hàng với thanh tìm kiếm.

---

## 3. Hướng Dẫn Cài Đặt & Khởi Chạy

### Bước 1: Khởi chạy Backend REST API (`http://localhost:3000`)

```bash
cd api
npm install

# Khởi tạo Prisma Client & đẩy schema lên cơ sở dữ liệu (nếu cần)
npm run prisma:generate
npm run prisma:push
npm run prisma:seed

# Chạy server ở chế độ phát triển
npm run dev
```

### Bước 2: Khởi chạy Frontend SPA (`http://localhost:5173`)

Mở một cửa sổ terminal mới:

```bash
cd web
npm install
npm run dev
```

Truy cập ứng dụng tại: **`http://localhost:5173`**

---

## 4. Danh Sách Đường Dẫn (Client-Side Routes)

| Phân hệ | Đường dẫn (Hash URL) | Mô tả |
| :--- | :--- | :--- |
| **Khách hàng** | `/#/` | Trang chủ CRISPY HOUSE |
| **Khách hàng** | `/#/dishes?q=...&category=...` | Thực đơn, tìm kiếm theo tên & lọc dropdown theo danh mục |
| **Khách hàng** | `/#/dishes/:id` | Chi tiết món ăn, hình ảnh, đầu bếp phụ trách & nguyên liệu |
| **Quản trị** | `/#/admin` | Tự động chuyển hướng về `/#/admin/dishes` |
| **Quản trị** | `/#/admin/dishes` | Danh sách món ăn, lọc danh mục, tìm kiếm & nút Thêm món mới |
| **Quản trị** | `/#/admin/dishes/new` | Thêm món ăn mới |
| **Quản trị** | `/#/admin/dishes/:id/edit` | Chỉnh sửa món ăn |
| **Quản trị** | `/#/admin/dishes/:id/delete` | Xác nhận xóa món ăn |
| **Quản trị** | `/#/admin/chefs` | Danh sách đầu bếp, tìm kiếm & nút Thêm đầu bếp |
| **Quản trị** | `/#/admin/chefs/new` | Thêm đầu bếp mới (chọn món nấu / không nấu) |
| **Quản trị** | `/#/admin/chefs/:id/edit` | Chỉnh sửa đầu bếp & cập nhật 2 danh sách món ăn |
| **Quản trị** | `/#/admin/chefs/:id/delete` | Xác nhận xóa đầu bếp |
| **Quản trị** | `/#/admin/ingredients` | Danh sách nguyên liệu (chỉ tên & mã) & nút Thêm nguyên liệu |
| **Quản trị** | `/#/admin/ingredients/new` | Thêm nguyên liệu mới |
| **Quản trị** | `/#/admin/ingredients/:id/edit` | Chỉnh sửa tên/mã nguyên liệu |
| **Quản trị** | `/#/admin/ingredients/:id/delete` | Xác nhận xóa nguyên liệu |

---

## 5. Danh Sách REST API Endpoints

| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/dishes` | Lấy danh sách món ăn (hỗ trợ `?q=`, `?category=`, `?isAvailable=`) |
| `GET` | `/api/dishes/:id` | Lấy chi tiết một món ăn theo ID |
| `POST` | `/api/dishes` | Tạo món ăn mới (hỗ trợ `application/json` và `multipart/form-data`) |
| `PATCH` / `PUT` | `/api/dishes/:id` | Cập nhật thông tin món ăn, danh sách đầu bếp, nguyên liệu & hình ảnh |
| `DELETE` | `/api/dishes/:id` | Xóa mềm món ăn |
| `DELETE` | `/api/dishes/:id/images/:imageId` | Xóa một ảnh phụ của món ăn |
| `GET` | `/api/chefs` | Lấy danh sách đầu bếp kèm các món ăn phụ trách (`?q=`) |
| `GET` | `/api/chefs/:id` | Lấy chi tiết đầu bếp theo ID |
| `POST` | `/api/chefs` | Tạo đầu bếp mới kèm danh sách `dishIds` |
| `PATCH` / `PUT` | `/api/chefs/:id` | Cập nhật thông tin đầu bếp & danh sách món ăn đầu bếp nấu (`dishIds`) |
| `DELETE` | `/api/chefs/:id` | Xóa mềm đầu bếp |
| `GET` | `/api/ingredients` | Lấy danh sách nguyên liệu (`?q=`) |
| `GET` | `/api/ingredients/:id` | Lấy chi tiết nguyên liệu theo ID |
| `POST` | `/api/ingredients` | Tạo nguyên liệu mới (`code`, `name`) |
| `PATCH` / `PUT` | `/api/ingredients/:id` | Cập nhật nguyên liệu |
| `DELETE` | `/api/ingredients/:id` | Xóa mềm nguyên liệu |

---

## 6. Kiểm Thử Tự Động (Automated Testing với Bruno & Integration Scripts)

Dự án đi kèm bộ sưu tập kiểm thử **Bruno** tại thư mục `bruno/` và các script kiểm thử tự động trong `api/scripts/`.

### Cách 1: Chạy kiểm thử toàn diện (Bruno CLI + Kiểm định SPA/UI)
```bash
cd api
npm test
```

### Cách 2: Chạy bộ kiểm thử tích hợp REST API (33 test cases)
```bash
cd api
npm run test:integration
```

### Cách 3: Chạy trực tiếp Bruno CLI hoặc mở bằng ứng dụng Bruno Desktop
- **Bằng Bruno Desktop**: Mở ứng dụng **Bruno** $\rightarrow$ chọn **Open Collection** $\rightarrow$ trỏ tới thư mục `restaurant/bruno` $\rightarrow$ chọn môi trường `local` và nhấn **Run Collection**.
- **Bằng Bruno CLI** *(khi server đang chạy tại cổng `3099` hoặc chỉnh `baseUrl` trong `bruno/environments/local.bru`)*:
  ```bash
  cd api
  npm run test:bruno
  ```
