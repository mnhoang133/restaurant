# TÀI LIỆU HỢP ĐỒNG API TÌM KIẾM & PHÂN TRANG (API CONTRACT)
## Dành cho đội ngũ phát triển Frontend (SPA) — Block 7

Tài liệu này đặc tả toàn bộ quy chuẩn giao tiếp HTTP giữa **Frontend SPA** và **Backend REST API** cho tính năng **Tìm kiếm & Phân trang Thực đơn món ăn**.

---

## 1. Endpoint Tổng Quan

* **Đường dẫn**: `GET /api/dishes`
* **Môi trường cục bộ**: `http://localhost:3000/api/dishes`
* **Content-Type**: `application/json`
* **Phương thức**: `GET`
* **Mã trạng thái phản hồi**: Luôn là `HTTP 200 OK` đối với các phản hồi nghiệp vụ (kể cả khi rỗng hoặc lỗi validation).

---

## 2. Bảng Tham Số Truy Vấn (Query Parameters)

| Tên tham số | Kiểu dữ liệu | Mặc định | Ý nghĩa & Quy chuẩn xử lý |
| :--- | :--- | :--- | :--- |
| `page` | Integer | `1` | Số trang cần lấy. Phải là số nguyên `>= 1`. Nếu `<= 0`, chữ hoặc số thập phân -> Lỗi `VALIDATION_FAILED`. |
| `pageSize` | Integer | `10` | Số món trên mỗi trang (từ `1` đến `100`). Nếu vượt 100 hoặc `<= 0` -> Lỗi `VALIDATION_FAILED`. |
| `mode` | String | `basic` | Chế độ tìm kiếm. Chấp nhận 1 trong 4 giá trị: `basic`, `advanced`, `fulltext`, `fuzzy`. |
| `q` | String | `null` | Từ khóa tìm kiếm. Quy chuẩn chi tiết theo từng `mode` bên dưới. |
| `category` | String | `null` | *(Chỉ áp dụng ở mode `advanced`)* Lọc chính xác theo danh mục món ăn (ví dụ: `Gà Rán`, `Burger`, `Ăn Kèm`...). |
| `minPrice` | Integer | `null` | *(Chỉ áp dụng ở mode `advanced`)* Giá thấp nhất. `minPrice=0` là giá trị hợp lệ (không phải rỗng). |
| `maxPrice` | Integer | `null` | *(Chỉ áp dụng ở mode `advanced`)* Giá cao nhất. Nếu `minPrice > maxPrice` -> Lỗi `VALIDATION_FAILED`. |
| `available` | Boolean | `null` | *(Chỉ áp dụng ở mode `advanced`)* Trạng thái phục vụ: `true` (còn bán) hoặc `false` (hết hàng). **Lưu ý: `available=false` là điều kiện lọc có nghĩa, không được bỏ qua!** |
| `sortBy` | String | `id` | Trường sắp xếp: `id`, `name`, `price`, `createdAt`, `rank` (cho fulltext), `similarity` (cho fuzzy). |
| `sortOrder` | String | `asc` | Chiều sắp xếp: `asc` (tăng dần) hoặc `desc` (giảm dần). |
| `all` | Boolean | `false` | *(Dành riêng cho Admin CRUD)* Nếu truyền `all=true`, Backend trả về mảng danh sách toàn bộ món để phân trang ở Client. |

---

## 3. Đặc Tả 4 Chế Độ Tìm Kiếm (`mode`)

### 3.1. Mode `basic` (Tìm kiếm cơ bản)
* **Mục đích**: Tìm kiếm theo một phần tên món (`name`), không phân biệt hoa thường.
* **Xử lý từ khóa `q`**:
  * Tự động escape các ký tự đặc biệt LIKE của SQL (`!`, `%`, `_`). Nhập chuỗi đặc biệt không khớp sẽ trả danh sách rỗng, không bung lỗi SQL.
  * Nếu `q` để trống hoặc không truyền: Bỏ qua điều kiện tên, trả danh sách toàn bộ theo phân trang.
* **Sắp xếp mặc định**: `id ASC` (hoặc theo `sortBy`/`sortOrder` do client truyền).

### 3.2. Mode `advanced` (Tìm kiếm nâng cao kết hợp AND)
* **Mục đích**: Kết hợp nhiều tiêu chí: `q`, `category`, `minPrice`, `maxPrice`, `available`.
* **Quy tắc**:
  * Tất cả các tiêu chí đang bật được kết hợp bằng phép logic `AND`.
  * Nếu chỉ truyền duy nhất tham số `q` (các trường khác bỏ trống), kết quả trả về **hoàn toàn đồng nhất với mode `basic`**.
  * Bỏ trống trường nào thì bỏ qua điều kiện lọc trường đó.

### 3.3. Mode `fulltext` (Tìm kiếm toàn văn PostgreSQL FTS)
* **Mục đích**: Tìm kiếm linh hoạt trên cả **Tên món (`name`)** và **Mô tả (`description`)**.
* **Quy tắc bắt buộc**:
  * Tham số `q` sau khi cắt khoảng trắng (trim) **không được để trống**. Nếu `q` rỗng -> Backend trả lỗi `VALIDATION_FAILED`.
* **Sắp xếp mặc định**: Tự động sắp xếp theo điểm phù hợp giảm dần (`ts_rank DESC`), sau đó phụ thuộc vào `id ASC` làm tie-breaker.

### 3.4. Mode `fuzzy` (Tìm kiếm gần đúng với `pg_trgm`)
* **Mục đích**: Bắt lỗi chính tả, gõ nhầm ký tự trên tên món ăn (ví dụ gõ `Burgre` vẫn tìm ra `Burger`).
* **Quy tắc bắt buộc**:
  * Tham số `q` sau khi trim **không được để trống**. Nếu `q` rỗng -> Backend trả lỗi `VALIDATION_FAILED`.
  * Áp dụng ngưỡng tương đồng `similarity >= 0.3`.
* **Sắp xếp mặc định**: Tự động sắp xếp theo độ tương đồng giảm dần (`similarity DESC`), sau đó `id ASC` làm tie-breaker.

---

## 4. Định Dạng Phản Hồi JSON (Response Envelope)

Toàn bộ phản hồi API luôn tuân thủ cấu trúc phong bì (Envelope) nhất quán:

### 4.1. Phản hồi thành công (`ok: true`)
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": 1,
        "code": "DISH001",
        "name": "Burger Bò Nướng Phô Mai Lava",
        "description": "Bánh mì brioche kẹp thịt bò nướng than hoa...",
        "price": 89000,
        "category": "Burger",
        "isAvailable": true,
        "images": [
          {
            "id": 101,
            "imageUrl": "https://wbledkjzvhpxndcnalxh.supabase.co/storage/v1/object/public/restaurant-images/DISH001-1.jpg",
            "orderIndex": 1
          }
        ]
      }
    ],
    "total": 125,
    "page": 1,
    "pageSize": 10,
    "totalPages": 13
  },
  "error": null
}
```

* **Trường hợp không có món nào khớp**: `items: []`, `total: 0`, `totalPages: 0`.
* **Trường hợp client yêu cầu `page` vượt quá `totalPages` (ví dụ `page=9999`)**: `items: []`, `total: 125`, `page: 9999`. Vẫn trả `ok: true` và `HTTP 200`, tuyệt đối không trả 404!

### 4.2. Phản hồi lỗi hợp lệ hóa tham số (`VALIDATION_FAILED`)
```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Tham số tìm kiếm hoặc phân trang không hợp lệ.",
    "fields": {
      "minPrice": "Giá tối thiểu (minPrice) không được lớn hơn giá tối đa (maxPrice).",
      "page": "Số trang (page) phải là số nguyên dương lớn hơn hoặc bằng 1."
    }
  }
}
```

---

## 5. Hướng Dẫn Frontend Tích Hợp 3 Kiểu Hiển Thị Phân Trang

Frontend chỉ cần gọi cùng 1 API `GET /api/dishes` để phục vụ cả 3 kiểu giao diện:

### 5.1. Phân trang dạng số (Numbered Pagination)
* **Thao tác**: Người dùng bấm chọn số trang (1, 2, 3...) hoặc nút Next/Prev.
* **Hành vi**: Thay thế toàn bộ danh sách hiện tại bằng danh sách món của trang mới.
* **URL**: Cập nhật query string trên trình duyệt: `?page=2&pageSize=10&mode=...&q=...`.
* **Reload / Chia sẻ link**: Khôi phục lại đúng trang và đúng bộ điều kiện lọc.

### 5.2. Nút Tải thêm (Load More)
* **Thao tác**: Người dùng nhấn nút "Tải thêm món".
* **Hành vi**:
  1. Đặt cờ `pending = true`, vô hiệu hóa nút bấm và hiển thị trạng thái "Đang tải...".
  2. Gửi request lấy `nextPage = currentPage + 1`.
  3. Khi có kết quả: Nối mảng `newItems` vào đuôi mảng `items` cũ (`[...oldItems, ...newItems]`).
  4. Nếu `page >= totalPages` hoặc `items.length === 0`: Ẩn nút "Tải thêm" và hiện thông báo "Đã hiển thị toàn bộ món".
* **Đổi điều kiện tìm kiếm**: Reset danh sách về rỗng, `page = 1` và tải lại từ đầu (không nối vào danh sách cũ).

### 5.3. Cuộn vô tận (Infinite Scroll)
* **Thao tác**: Người dùng cuộn trang xuống gần cuối danh sách.
* **Kỹ thuật**: Sử dụng `IntersectionObserver` theo dõi phần tử đánh dấu chân trang (`sentinel`).
* **Hành vi**:
  * Khi `sentinel` xuất hiện trong khung nhìn: Kiểm tra nếu `!pending && !end` thì tự động kích hoạt tải trang kế tiếp (`nextPage`).
  * Tránh gọi trùng: Đặt `pending = true` đồng bộ ngay trước khi gọi `fetch`.
  * Khi hết dữ liệu (`page >= totalPages`): Ngắt theo dõi `observer.unobserve(sentinel)`.
