---
marp: true
theme: default
paginate: true
header: "Nhà Hàng Việt Nam - Báo Cáo SSR, Database & ORM"
footer: "Phát Triển Ứng Dụng Web"
---

# Nhà Hàng Việt Nam
### Báo Cáo Kiến Trúc SSR, Database & ORM

* **Môn học**: Phát triển ứng dụng Web
* **Mô hình**: Server-Side Rendering (SSR) Monolith
* **Cơ sở dữ liệu**: PostgreSQL (Supabase Cloud) qua Prisma ORM

---

# 1. Cơ Chế Database & Thành Phần Cloud

* **Cơ sở dữ liệu đám mây (Cloud)**:
  * Sử dụng PostgreSQL lưu trữ trực tiếp trên nền tảng Supabase.
* **Cơ chế 2 chuỗi kết nối (Connection Pooling)**:
  * **Cổng 6543 (`DATABASE_URL`)**: Kết nối qua PgBouncer (Pooler) để gom kết nối. Dùng cho web chạy thường ngày, đảm bảo nhiều người truy cập cùng lúc không làm nghẽn hay tràn RAM database.
  * **Cổng 5432 (`DIRECT_URL`)**: Kết nối trực tiếp vào Postgres, chỉ dùng khi chạy lệnh `prisma db push` để tạo hoặc thay đổi cấu trúc bảng.
* **Mẫu thiết kế Singleton**:
  * Chỉ khởi tạo 1 đối tượng `PrismaClient` duy nhất trong toàn bộ server, tránh rò rỉ kết nối khi nodemon reload.
* **Lưu trữ ảnh (Cloud Storage)**:
  * Tải ảnh lên Supabase Storage bucket `restaurant-images`, lấy Public URL lưu vào DB.
  * Tự động rẽ nhánh (fallback) lưu vào thư mục `public/uploads/` trên máy nếu mất mạng.

---

# 2. Toàn Bộ Tech Stack Dự Án

* **Môi trường**: Node.js (v18+)
* **Framework Backend**: Express.js (v4.21.2)
* **Template Engine (SSR)**: EJS (v3.1.10)
* **Giao diện**: Tailwind CSS
* **ORM**: Prisma ORM (v5.22.0)
* **Cơ sở dữ liệu**: PostgreSQL (Supabase Cloud)
* **Cloud Storage SDK**: @supabase/supabase-js (v2.48.1)
* **Xử lý Upload**: Multer (v1.4.5-lts.1)
* **HTTP Method Override**: method-override (v3.0.0)
* **Bảo mật & Biến môi trường**: dotenv (v16.4.7), cors (v2.8.5)
* **Dev Tools**: nodemon (v3.1.9), Prisma Studio

---

# 3. Cấu Trúc Mã Nguồn & Cách SSR Hoạt Động

* **Cấu trúc phân tầng rõ ràng**:
  * `prisma/`: Định nghĩa 3 model (Dish, Chef, Ingredient) và script seed dữ liệu.
  * `src/config/`: Cấu hình Prisma singleton và Supabase client.
  * `src/middlewares/`: id-parser (chặn ID sai), upload (Multer), error-handler (404/500).
  * `src/routes/`: Phân chia route Client (`/dishes`) và Admin (`/admin/...`).
  * `src/controllers/`: Xử lý logic, validate dữ liệu (lỗi trả 400), điều hướng PRG (mã 303).
  * `src/services/`: Nơi duy nhất gọi Prisma để truy vấn cơ sở dữ liệu.
  * `src/views/`: 18 template EJS render giao diện.
* **Cách SSR hoạt động**:
  * Server làm toàn bộ: Nhận request -> lấy dữ liệu DB -> nhồi vào EJS -> nặn ra file HTML hoàn chỉnh gửi về trình duyệt.
  * Trình duyệt chỉ việc hiển thị HTML, hoàn toàn không dùng `fetch` hay `AJAX` để lấy dữ liệu.

---

# 4. Luồng Xử Lý (Flow) & Kiến Trúc PRG

* **Luồng Đọc (GET)**:
  * Browser gửi `GET /dishes?q=...` -> Controller gọi Service -> Prisma truy vấn Postgres -> Render file EJS trả về HTML (mã 200). ID sai hoặc không tồn tại trả mã 404.
* **Luồng Ghi (POST / PATCH / DELETE) & Mô hình Post/Redirect/Get**:
  * Browser gửi Form -> Server kiểm tra dữ liệu: Nếu thiếu hoặc sai -> Trả mã **HTTP 400** và giữ nguyên dữ liệu trên form.
  * Nếu hợp lệ -> Ghi vào database Supabase.
  * **Chống trùng lặp (PRG)**: Server trả mã **HTTP 303 Redirect** sang trang kết quả. Browser tự động gửi `GET` để mở trang mới. Bấm F5 chỉ tải lại trang GET, không bao giờ bị gửi lại lệnh POST.
* **Xác nhận xóa (DELETE)**:
  * Bắt buộc qua trang xác nhận `GET /admin/:resource/:id/delete` trước khi gửi `?_method=DELETE`.
  * Áp dụng Xóa Mềm (Soft Delete: `isDeleted = true`) để bảo toàn dữ liệu lịch sử.

---

# 5. Quyết Định Thiết Kế (Bố Cục, Màu Sắc, Hiệu Ứng)

* **Bố cục**:
  * 3 phân hệ: Trang chủ, Thực đơn và Quản trị.
  * Menu dạng lưới thẻ bo góc, phân trang phía server.
  * Quản trị: Sidebar riêng biệt, bảng dữ liệu và form trực quan.
* **Màu sắc**:
  * Theme Trắng: Nền sáng sạch sẽ, tối giản cho ẩm thực hiện đại.
  * Đỏ chủ đạo: Nhận diện thức ăn nhanh, kích thích vị giác.
  * Gam ấm phối hợp: Nền kem sáng, viền mờ tinh tế chống chói mắt.
* **Hiệu ứng**:
  * Hiệu ứng xoay đĩa gà ở trang chủ.
  * Slide toàn bộ trang: Trượt từ trái sang phải sau khi tải trang.
  * Phản hồi tương tác: Thẻ hover nổi nhẹ, nút bấm đàn hồi khi nhấn.

