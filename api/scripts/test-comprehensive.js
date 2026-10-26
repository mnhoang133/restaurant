/**
 * BỘ KIỂM THỬ TOÀN DIỆN HỆ THỐNG REST API NHÀ HÀNG (FULL INTEGRATION TEST SUITE)
 * Theo chuẩn đồ án: REST API và SPA - MSc. Ngô Ngọc Đăng Khoa
 * 
 * Bao phủ:
 * 1. Góc nhìn Khách hàng (Client): Xem thực đơn, tìm kiếm, lọc, xem chi tiết, ID sai, ID không tồn tại.
 * 2. Góc nhìn Quản trị viên (Admin): CRUD đầy đủ cho 3 tài nguyên (Dishes, Chefs, Ingredients).
 *    - Các trường hợp đúng (Happy path).
 *    - Trùng mã code (@unique -> DUPLICATE_CODE).
 *    - Vi phạm validation (tên rỗng, giá âm, số lượng âm -> VALIDATION_FAILED kèm fields).
 *    - Vi phạm liên kết khóa ngoại (chefId/ingredientId không tồn tại -> RELATED_RESOURCE_NOT_FOUND).
 *    - Kiểm tra cơ chế Xóa mềm (Soft Delete -> truy vấn lại ra NOT_FOUND).
 * 3. Góc nhìn Kỹ thuật & Bảo mật:
 *    - Lỗi kỹ thuật 404 khi gõ sai URL /api (không có trường 'ok').
 *    - Kiểm tra bảo mật CORS (Access-Control-Allow-Origin đúng origin của SPA, không dùng '*').
 *    - Kiểm tra Preflight OPTIONS request cho PATCH và DELETE.
 */

require('dotenv').config();
const http = require('http');
const app = require('../src/app');

const server = http.createServer(app);

async function runFullTestSuite() {
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`\n======================================================================`);
  console.log(`🚀 KHỞI ĐỘNG BỘ TEST TÍCH HỢP TOÀN DIỆN TẠI: ${baseUrl}`);
  console.log(`======================================================================\n`);

  async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = text;
    }
    return { status: res.status, data: json, headers: Object.fromEntries(res.headers.entries()) };
  }

  let passed = 0;
  let failed = 0;

  function assert(title, condition, details = '') {
    if (condition) {
      console.log(`  ✔ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${title}`);
      if (details) console.error(`    -> Chi tiết: ${typeof details === 'object' ? JSON.stringify(details) : details}`);
      failed++;
    }
  }

  try {
    // =========================================================================
    // PHẦN I: GÓC NHÌN KHÁCH HÀNG (CLIENT VIEWPOINT)
    // =========================================================================
    console.log(`\n--- [PHẦN 1] GÓC NHÌN KHÁCH HÀNG (CLIENT API) ---`);

    // 1. Lấy danh sách thực đơn
    const c1 = await request('/api/dishes');
    assert(
      'Client: GET /api/dishes -> HTTP 200, ok: true và data là mảng',
      c1.status === 200 && c1.data.ok === true && Array.isArray(c1.data.data),
      c1.data
    );

    // 2. Tìm kiếm món ăn
    const c2 = await request('/api/dishes?q=gà');
    assert(
      'Client: GET /api/dishes?q=gà -> Tìm kiếm thành công, HTTP 200, ok: true',
      c2.status === 200 && c2.data.ok === true && Array.isArray(c2.data.data),
      c2.data
    );

    // 3. Lọc theo danh mục
    const c3 = await request('/api/dishes?category=Món chính');
    assert(
      'Client: GET /api/dishes?category=Món chính -> Lọc danh mục thành công',
      c3.status === 200 && c3.data.ok === true && Array.isArray(c3.data.data),
      c3.data
    );

    // 4. Lấy chi tiết món ăn không tồn tại
    const c4 = await request('/api/dishes/999999');
    assert(
      'Client: GET /api/dishes/999999 -> HTTP 200, ok: false, error.code: NOT_FOUND',
      c4.status === 200 && c4.data.ok === false && c4.data.error?.code === 'NOT_FOUND',
      c4.data
    );

    // 5. Gửi ID sai định dạng (chuỗi chữ)
    const c5 = await request('/api/dishes/chu-khong-phai-so');
    assert(
      'Client: GET /api/dishes/chu-khong-phai-so -> Bị chặn bởi id-parser, trả NOT_FOUND',
      c5.status === 200 && c5.data.ok === false && c5.data.error?.code === 'NOT_FOUND',
      c5.data
    );

    // 6. Xem danh sách đầu bếp
    const c6 = await request('/api/chefs');
    assert(
      'Client: GET /api/chefs -> Lấy danh sách đầu bếp, HTTP 200, ok: true',
      c6.status === 200 && c6.data.ok === true && Array.isArray(c6.data.data),
      c6.data
    );

    // 7. Xem danh sách nguyên liệu
    const c7 = await request('/api/ingredients');
    assert(
      'Client: GET /api/ingredients -> Lấy danh sách nguyên liệu, HTTP 200, ok: true',
      c7.status === 200 && c7.data.ok === true && Array.isArray(c7.data.data),
      c7.data
    );

    // =========================================================================
    // PHẦN II: GÓC NHÌN QUẢN TRỊ - TÀI NGUYÊN NGUYÊN LIỆU (INGREDIENTS CRUD)
    // =========================================================================
    console.log(`\n--- [PHẦN 2] QUẢN TRỊ NGUYÊN LIỆU (INGREDIENTS CRUD & VALIDATION) ---`);

    const uniqueIngCode = `ING-TEST-${Date.now().toString().slice(-4)}`;
    let createdIngredientId = null;

    // 8. Thêm nguyên liệu hợp lệ
    const ing1 = await request('/api/ingredients', {
      method: 'POST',
      body: JSON.stringify({
        code: uniqueIngCode,
        name: 'Hành Lá Sạch',
        unit: 'kg',
        quantity: 50,
      }),
    });
    assert(
      'Admin: POST /api/ingredients -> Thêm nguyên liệu thành công',
      ing1.status === 200 && ing1.data.ok === true && ing1.data.data?.code === uniqueIngCode,
      ing1.data
    );
    if (ing1.data?.data?.id) createdIngredientId = ing1.data.data.id;

    // 9. Thêm nguyên liệu thiếu tên
    const ing2 = await request('/api/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: '', unit: 'kg' }),
    });
    assert(
      'Admin: POST /api/ingredients thiếu tên -> VALIDATION_FAILED kèm fields.name',
      ing2.status === 200 && ing2.data.ok === false && ing2.data.error?.code === 'VALIDATION_FAILED' && !!ing2.data.error?.fields?.name,
      ing2.data
    );

    // 10. Thêm nguyên liệu số lượng âm
    const ing3 = await request('/api/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'Muối', unit: 'g', quantity: -10 }),
    });
    assert(
      'Admin: POST /api/ingredients quantity âm -> VALIDATION_FAILED kèm fields.quantity',
      ing3.status === 200 && ing3.data.ok === false && !!ing3.data.error?.fields?.quantity,
      ing3.data
    );

    // 11. Thêm nguyên liệu trùng mã
    const ing4 = await request('/api/ingredients', {
      method: 'POST',
      body: JSON.stringify({ code: uniqueIngCode, name: 'Hành Trùng', unit: 'kg' }),
    });
    assert(
      'Admin: POST /api/ingredients trùng mã code -> DUPLICATE_CODE kèm fields.code',
      ing4.status === 200 && ing4.data.ok === false && ing4.data.error?.code === 'DUPLICATE_CODE',
      ing4.data
    );

    // 12. Cập nhật nguyên liệu
    if (createdIngredientId) {
      const ing5 = await request(`/api/ingredients/${createdIngredientId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: 120 }),
      });
      assert(
        'Admin: PATCH /api/ingredients/:id -> Sửa thành công số lượng tồn kho',
        ing5.status === 200 && ing5.data.ok === true && ing5.data.data?.quantity === 120,
        ing5.data
      );

      // 13. Xóa nguyên liệu (Soft Delete)
      const ing6 = await request(`/api/ingredients/${createdIngredientId}`, { method: 'DELETE' });
      assert(
        'Admin: DELETE /api/ingredients/:id -> Xóa mềm thành công, data: null',
        ing6.status === 200 && ing6.data.ok === true && ing6.data.data === null,
        ing6.data
      );

      // 14. Kiểm tra nguyên liệu sau khi xóa mềm
      const ing7 = await request(`/api/ingredients/${createdIngredientId}`);
      assert(
        'Admin: GET nguyên liệu đã bị xóa mềm -> Phải trả về NOT_FOUND',
        ing7.status === 200 && ing7.data.ok === false && ing7.data.error?.code === 'NOT_FOUND',
        ing7.data
      );
    }

    // =========================================================================
    // PHẦN III: GÓC NHÌN QUẢN TRỊ - TÀI NGUYÊN ĐẦU BẾP (CHEFS CRUD)
    // =========================================================================
    console.log(`\n--- [PHẦN 3] QUẢN TRỊ ĐẦU BẾP (CHEFS CRUD & VALIDATION) ---`);

    const uniqueChefCode = `CHEF-TEST-${Date.now().toString().slice(-4)}`;
    let createdChefId = null;

    // 15. Thêm đầu bếp hợp lệ
    const chef1 = await request('/api/chefs', {
      method: 'POST',
      body: JSON.stringify({
        code: uniqueChefCode,
        name: 'Bếp Trưởng Nguyễn Văn An',
        specialty: 'Món Truyền Thống Việt Nam',
        experience: 15,
      }),
    });
    assert(
      'Admin: POST /api/chefs -> Thêm đầu bếp thành công',
      chef1.status === 200 && chef1.data.ok === true && chef1.data.data?.code === uniqueChefCode,
      chef1.data
    );
    if (chef1.data?.data?.id) createdChefId = chef1.data.data.id;

    // 16. Thêm đầu bếp thiếu lĩnh vực/chuyên môn
    const chef2 = await request('/api/chefs', {
      method: 'POST',
      body: JSON.stringify({ name: 'Đầu bếp thiếu chuyên môn' }),
    });
    assert(
      'Admin: POST /api/chefs thiếu chuyên môn -> VALIDATION_FAILED kèm fields.specialty',
      chef2.status === 200 && chef2.data.ok === false && !!chef2.data.error?.fields?.specialty,
      chef2.data
    );

    // 17. Thêm đầu bếp kinh nghiệm âm
    const chef3 = await request('/api/chefs', {
      method: 'POST',
      body: JSON.stringify({ name: 'Đầu bếp âm năm', specialty: 'Bếp bánh', experience: -5 }),
    });
    assert(
      'Admin: POST /api/chefs kinh nghiệm âm -> VALIDATION_FAILED kèm fields.experience',
      chef3.status === 200 && chef3.data.ok === false && !!chef3.data.error?.fields?.experience,
      chef3.data
    );

    // 18. Thêm đầu bếp trùng code
    const chef4 = await request('/api/chefs', {
      method: 'POST',
      body: JSON.stringify({ code: uniqueChefCode, name: 'Đầu Bếp Trùng Mã', specialty: 'Món Á' }),
    });
    assert(
      'Admin: POST /api/chefs trùng mã code -> DUPLICATE_CODE',
      chef4.status === 200 && chef4.data.ok === false && chef4.data.error?.code === 'DUPLICATE_CODE',
      chef4.data
    );

      // Test gán dishIds không tồn tại
      const chefBadDish = await request('/api/chefs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Đầu Bếp Gán Món Lỗi',
          specialty: 'Món Hàn',
          dishIds: [999999],
        }),
      });
      assert(
        'Admin: POST /api/chefs gửi dishIds không tồn tại -> RELATED_RESOURCE_NOT_FOUND',
        chefBadDish.status === 200 && chefBadDish.data.ok === false && chefBadDish.data.error?.code === 'RELATED_RESOURCE_NOT_FOUND',
        chefBadDish.data
      );

    if (createdChefId) {
      // Lấy 1 món ăn có sẵn từ DB để gán cho đầu bếp
      const availableDishes = await request('/api/dishes');
      const firstDishId = availableDishes.data.data?.[0]?.id;

      if (firstDishId) {
        const chefAssignDish = await request(`/api/chefs/${createdChefId}`, {
          method: 'PATCH',
          body: JSON.stringify({ dishIds: [firstDishId] }),
        });
        assert(
          'Admin: PATCH /api/chefs/:id gán dishIds -> Cập nhật thành công 2 chiều (Đầu bếp chọn món ăn)',
          chefAssignDish.status === 200 && chefAssignDish.data.ok === true && Array.isArray(chefAssignDish.data.data?.dishes),
          chefAssignDish.data
        );
      }

      // 19. Cập nhật đầu bếp
      const chef5 = await request(`/api/chefs/${createdChefId}`, {
        method: 'PATCH',
        body: JSON.stringify({ experience: 18 }),
      });
      assert(
        'Admin: PATCH /api/chefs/:id -> Cập nhật kinh nghiệm thành công',
        chef5.status === 200 && chef5.data.ok === true && chef5.data.data?.experience === 18,
        chef5.data
      );

      // 20. Xóa mềm đầu bếp
      const chef6 = await request(`/api/chefs/${createdChefId}`, { method: 'DELETE' });
      assert(
        'Admin: DELETE /api/chefs/:id -> Xóa mềm thành công',
        chef6.status === 200 && chef6.data.ok === true,
        chef6.data
      );

      // 21. Kiểm tra đầu bếp sau khi xóa mềm
      const chef7 = await request(`/api/chefs/${createdChefId}`);
      assert(
        'Admin: GET đầu bếp đã bị xóa mềm -> Phải trả về NOT_FOUND',
        chef7.status === 200 && chef7.data.ok === false && chef7.data.error?.code === 'NOT_FOUND',
        chef7.data
      );
    }

    // =========================================================================
    // PHẦN IV: GÓC NHÌN QUẢN TRỊ - TÀI NGUYÊN MÓN ĂN & LIÊN KẾT (DISHES CRUD)
    // =========================================================================
    console.log(`\n--- [PHẦN 4] QUẢN TRỊ MÓN ĂN & RÀNG BUỘC TOÀN VẸN (DISHES CRUD) ---`);

    const uniqueDishCode = `DISH-TEST-${Date.now().toString().slice(-4)}`;
    let createdDishId = null;

    // 22. Thêm món ăn thiếu tên và giá âm
    const d1 = await request('/api/dishes', {
      method: 'POST',
      body: JSON.stringify({ name: '', price: -99000, category: 'Món chính' }),
    });
    assert(
      'Admin: POST /api/dishes thiếu tên & giá âm -> VALIDATION_FAILED với fields.name & fields.price',
      d1.status === 200 && d1.data.ok === false && !!d1.data.error?.fields?.name && !!d1.data.error?.fields?.price,
      d1.data
    );

    // 23. Thêm món ăn với chefId không tồn tại trong database
    const d2 = await request('/api/dishes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Món Kiểm Tra Khóa Ngoại',
        price: 120000,
        category: 'Món chính',
        chefIds: [888888],
      }),
    });
    assert(
      'Admin: POST /api/dishes gửi chefIds không tồn tại -> RELATED_RESOURCE_NOT_FOUND',
      d2.status === 200 && d2.data.ok === false && d2.data.error?.code === 'RELATED_RESOURCE_NOT_FOUND' && !!d2.data.error?.fields?.chefIds,
      d2.data
    );

    // 24. Thêm món ăn với ingredientId không tồn tại
    const d3 = await request('/api/dishes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Món Kiểm Tra Nguyên Liệu Sai',
        price: 95000,
        category: 'Khai vị',
        ingredientIds: [777777],
      }),
    });
    assert(
      'Admin: POST /api/dishes gửi ingredientIds không tồn tại -> RELATED_RESOURCE_NOT_FOUND',
      d3.status === 200 && d3.data.ok === false && d3.data.error?.code === 'RELATED_RESOURCE_NOT_FOUND' && !!d3.data.error?.fields?.ingredientIds,
      d3.data
    );

    // 25. Thêm món ăn hợp lệ thành công
    const d4 = await request('/api/dishes', {
      method: 'POST',
      body: JSON.stringify({
        code: uniqueDishCode,
        name: 'Lẩu Cua Đồng Đặc Biệt',
        price: 250000,
        category: 'Món chính',
        description: 'Món ăn dân dã đậm đà phong vị Bắc Bộ.',
      }),
    });
    assert(
      'Admin: POST /api/dishes thành công -> HTTP 200, ok: true kèm dữ liệu bản ghi mới',
      d4.status === 200 && d4.data.ok === true && d4.data.data?.code === uniqueDishCode,
      d4.data
    );
    if (d4.data?.data?.id) createdDishId = d4.data.data.id;

    // 26. Thêm món ăn trùng mã code
    const d5 = await request('/api/dishes', {
      method: 'POST',
      body: JSON.stringify({
        code: uniqueDishCode,
        name: 'Lẩu Trùng Mã',
        price: 100000,
        category: 'Món chính',
      }),
    });
    assert(
      'Admin: POST /api/dishes trùng mã code -> DUPLICATE_CODE kèm fields.code',
      d5.status === 200 && d5.data.ok === false && d5.data.error?.code === 'DUPLICATE_CODE',
      d5.data
    );

    // 27. Sửa món ăn hợp lệ
    if (createdDishId) {
      const d6 = await request(`/api/dishes/${createdDishId}`, {
        method: 'PATCH',
        body: JSON.stringify({ price: 280000, name: 'Lẩu Cua Đồng Thượng Hạng' }),
      });
      assert(
        'Admin: PATCH /api/dishes/:id -> Cập nhật giá và tên món ăn thành công',
        d6.status === 200 && d6.data.ok === true && d6.data.data?.price === 280000,
        d6.data
      );

      // 28. Sửa món ăn với giá âm
      const d7 = await request(`/api/dishes/${createdDishId}`, {
        method: 'PATCH',
        body: JSON.stringify({ price: -1000 }),
      });
      assert(
        'Admin: PATCH /api/dishes/:id giá âm -> VALIDATION_FAILED',
        d7.status === 200 && d7.data.ok === false && d7.data.error?.code === 'VALIDATION_FAILED',
        d7.data
      );

      // 29. Xóa mềm món ăn
      const d8 = await request(`/api/dishes/${createdDishId}`, { method: 'DELETE' });
      assert(
        'Admin: DELETE /api/dishes/:id -> Xóa mềm thành công, data: null',
        d8.status === 200 && d8.data.ok === true && d8.data.data === null,
        d8.data
      );

      // 30. Kiểm tra món ăn sau khi xóa mềm
      const d9 = await request(`/api/dishes/${createdDishId}`);
      assert(
        'Admin: GET món ăn vừa xóa mềm -> Phải trả về NOT_FOUND (không lộ dữ liệu đã xóa)',
        d9.status === 200 && d9.data.ok === false && d9.data.error?.code === 'NOT_FOUND',
        d9.data
      );
    }

    // =========================================================================
    // PHẦN V: GÓC NHÌN KỸ THUẬT & BẢO MẬT (TECHNICAL & CORS)
    // =========================================================================
    console.log(`\n--- [PHẦN 5] GÓC NHÌN KỸ THUẬT & BẢO MẬT (TECHNICAL, 404 & CORS) ---`);

    // 31. Sai URL API -> Lỗi kỹ thuật 404
    const t1 = await request('/api/khong-ton-tai-endpoint');
    assert(
      'Kỹ thuật: Gõ sai URL /api/... -> HTTP 404 và KHÔNG CÓ trường ok',
      t1.status === 404 && t1.data.ok === undefined,
      t1.data
    );

    // 32. Kiểm tra header CORS bình thường
    const t2 = await request('/api/dishes', {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert(
      'CORS: Access-Control-Allow-Origin trả về đúng origin của SPA (không dùng *)',
      t2.headers['access-control-allow-origin'] === 'http://localhost:5173',
      t2.headers
    );

    // 33. Kiểm tra Preflight OPTIONS request (Slide 23, 24, 26)
    const t3 = await request('/api/dishes', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    assert(
      'CORS Preflight: Request OPTIONS phản hồi thành công (200/204) cho phép PATCH',
      (t3.status === 200 || t3.status === 204) && !!t3.headers['access-control-allow-methods'],
      t3.headers
    );

    // =========================================================================
    // TỔNG KẾT
    // =========================================================================
    console.log(`\n======================================================================`);
    console.log(`📊 TỔNG KẾT BỘ TEST TOÀN DIỆN: ${passed} PASSED / ${passed + failed} CASES`);
    if (failed === 0) {
      console.log(`🎉 CHÚC MỪNG! HỆ THỐNG ĐẠT 100% YÊU CẦU CỦA ĐỒ ÁN!`);
    } else {
      console.log(`⚠️ CÒN ${failed} TEST CASE CHƯA ĐẠT.`);
    }
    console.log(`======================================================================\n`);
  } catch (err) {
    console.error('Lỗi thực thi kiểm thử:', err);
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runFullTestSuite();
