/**
 * KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN: TÌM KIẾM & PHÂN TRANG BACKEND
 * Theo đúng Slide 8, 9, 10, 22, 24, 25, 27, 28, 29, 30 & Yêu cầu đề bài
 */

require('dotenv').config();
const http = require('http');
const app = require('../src/app');

const server = http.createServer(app);

async function runTestSuite() {
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`\n======================================================================`);
  console.log(`🚀 BẮT ĐẦU KIỂM THỬ BACKEND: TÌM KIẾM, PHÂN TRANG & SEED 1.000 DISHES`);
  console.log(`   Server chạy tại: ${baseUrl}`);
  console.log(`======================================================================\n`);

  async function req(url) {
    const res = await fetch(`${baseUrl}${url}`);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, data: json };
  }

  let passed = 0;
  let failed = 0;

  function assert(title, cond, detail = '') {
    if (cond) {
      console.log(`  ✔ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${title}`);
      if (detail) console.error(`    -> Chi tiết:`, typeof detail === 'object' ? JSON.stringify(detail) : detail);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // NHÓM 1: CLIENT-SIDE PAGING CHO ADMIN CRUD & TƯƠNG THÍCH NGƯỢC
    // -------------------------------------------------------------------------
    console.log(`--- [NHÓM 1] CLIENT PAGING CHO ADMIN CRUD (TẢI TOÀN BỘ 1.000 MÓN) ---`);

    const r1 = await req('/api/dishes');
    assert(
      'Admin CRUD: GET /api/dishes không truyền page -> HTTP 200, ok: true và data là MẢNG',
      r1.status === 200 && r1.data.ok === true && Array.isArray(r1.data.data),
      r1.data
    );

    assert(
      'Database đã seed đủ 1.000 món ăn trong Supabase',
      Array.isArray(r1.data.data) && r1.data.data.length >= 1000,
      `Số lượng thực tế: ${r1.data.data?.length}`
    );

    const rAll = await req('/api/dishes?all=true');
    assert(
      'Admin CRUD: GET /api/dishes?all=true -> HTTP 200, data là Mảng toàn bộ',
      rAll.status === 200 && rAll.data.ok === true && Array.isArray(rAll.data.data) && rAll.data.data.length >= 1000
    );

    const rCats = await req('/api/dishes/categories');
    assert(
      'GET /api/dishes/categories -> Trả về danh sách danh mục',
      rCats.status === 200 && rCats.data.ok === true && Array.isArray(rCats.data.data) && rCats.data.data.length >= 6,
      rCats.data
    );

    // -------------------------------------------------------------------------
    // NHÓM 2: SERVER-SIDE PAGINATION ENVELOPE (SLIDE 8, 9, 10)
    // -------------------------------------------------------------------------
    console.log(`\n--- [NHÓM 2] SERVER PAGINATION ENVELOPE & HIỆU NĂNG (SLIDE 8, 9, 10) ---`);

    const p1 = await req('/api/dishes?page=1&pageSize=10');
    assert(
      'Envelope Slide 9: data có items, total, page, pageSize, totalPages',
      p1.status === 200 &&
      p1.data.ok === true &&
      Array.isArray(p1.data.data.items) &&
      p1.data.data.items.length === 10 &&
      p1.data.data.total >= 1000 &&
      p1.data.data.page === 1 &&
      p1.data.data.pageSize === 10 &&
      p1.data.data.totalPages >= 100,
      p1.data
    );

    const p2 = await req('/api/dishes?page=2&pageSize=10');
    assert(
      'Trang 2: trả đúng 10 món tiếp theo',
      p2.status === 200 && p2.data.data.items.length === 10 && p2.data.data.page === 2
    );

    // Kiểm tra không trùng lặp giữa trang 1 và trang 2
    const idsP1 = new Set(p1.data.data.items.map((i) => i.id));
    const idsP2 = new Set(p2.data.data.items.map((i) => i.id));
    const overlap = [...idsP2].filter((id) => idsP1.has(id));
    assert(
      'Phân trang nhất quán: Không trùng lặp món giữa trang 1 và trang 2',
      overlap.length === 0,
      `Trùng: ${overlap.join(', ')}`
    );

    // Slide 10: Trang vượt quá phạm vi trả items: [] kèm total hợp lệ
    const pOverflow = await req('/api/dishes?page=9999&pageSize=10');
    assert(
      'Slide 10: Trang vượt quá phạm vi (page=9999) -> items: [], total vẫn giữ nguyên',
      pOverflow.status === 200 &&
      pOverflow.data.ok === true &&
      Array.isArray(pOverflow.data.data.items) &&
      pOverflow.data.data.items.length === 0 &&
      pOverflow.data.data.total >= 1000 &&
      pOverflow.data.data.page === 9999,
      pOverflow.data
    );

    // -------------------------------------------------------------------------
    // NHÓM 3: XỬ LÝ LỖI VALIDATION (SLIDE 10 & 27: STATUS 200, VALIDATION_FAILED)
    // -------------------------------------------------------------------------
    console.log(`\n--- [NHÓM 3] VALIDATION PARAMS (STATUS 200, VALIDATION_FAILED - SLIDE 10, 27) ---`);

    const v1 = await req('/api/dishes?page=0&pageSize=10');
    assert(
      'Slide 10: page=0 (không dương) -> HTTP 200, ok: false, error.code: VALIDATION_FAILED',
      v1.status === 200 && v1.data.ok === false && v1.data.error.code === 'VALIDATION_FAILED' && v1.data.error.fields?.page,
      v1.data
    );

    const v2 = await req('/api/dishes?page=abc&pageSize=10');
    assert(
      'Slide 10: page=abc (chữ) -> VALIDATION_FAILED',
      v2.status === 200 && v2.data.ok === false && v2.data.error.code === 'VALIDATION_FAILED'
    );

    const v3 = await req('/api/dishes?page=1&pageSize=101');
    assert(
      'Slide 10: pageSize > 100 -> VALIDATION_FAILED kèm fields.pageSize',
      v3.status === 200 && v3.data.ok === false && v3.data.error.code === 'VALIDATION_FAILED' && v3.data.error.fields?.pageSize,
      v3.data
    );

    const v4 = await req('/api/dishes?mode=advanced&minPrice=200000&maxPrice=50000');
    assert(
      'Slide 27: minPrice > maxPrice -> VALIDATION_FAILED kèm fields.minPrice',
      v4.status === 200 && v4.data.ok === false && v4.data.error.code === 'VALIDATION_FAILED' && v4.data.error.fields?.minPrice,
      v4.data
    );

    const v5 = await req('/api/dishes?mode=advanced&available=khong_ro');
    assert(
      'Slide 27: available không hợp lệ -> VALIDATION_FAILED kèm fields.available',
      v5.status === 200 && v5.data.ok === false && v5.data.error.code === 'VALIDATION_FAILED' && v5.data.error.fields?.available,
      v5.data
    );

    const v6 = await req('/api/dishes?mode=unknown_mode');
    assert(
      'mode sai giá trị -> VALIDATION_FAILED kèm fields.mode',
      v6.status === 200 && v6.data.ok === false && v6.data.error.code === 'VALIDATION_FAILED' && v6.data.error.fields?.mode,
      v6.data
    );

    const v7 = await req('/api/dishes?mode=fulltext');
    assert(
      'Slide 21: mode=fulltext thiếu q -> VALIDATION_FAILED',
      v7.status === 200 && v7.data.ok === false && v7.data.error.code === 'VALIDATION_FAILED' && v7.data.error.fields?.q,
      v7.data
    );

    const v8 = await req('/api/dishes?mode=fuzzy');
    assert(
      'Slide 21: mode=fuzzy thiếu q -> VALIDATION_FAILED',
      v8.status === 200 && v8.data.ok === false && v8.data.error.code === 'VALIDATION_FAILED' && v8.data.error.fields?.q,
      v8.data
    );

    // -------------------------------------------------------------------------
    // NHÓM 4: 4 CHẾ ĐỘ TÌM KIẾM THEO SLIDE 37 (BASIC, ADVANCED, FULLTEXT, FUZZY)
    // -------------------------------------------------------------------------
    console.log(`\n--- [NHÓM 4] 4 CHẾ ĐỘ TÌM KIẾM THEO SLIDE 37 (BASIC, ADVANCED, FULLTEXT, FUZZY) ---`);

    // 1. Basic search với ILIKE và escape ký tự đặc biệt
    const s1 = await req('/api/dishes?mode=basic&q=gà&page=1&pageSize=10');
    assert(
      'Mode Basic: Tìm từ khóa "gà" -> Trả kết quả món ăn, total > 0',
      s1.status === 200 && s1.data.ok === true && s1.data.data.total > 0 && s1.data.data.items.length > 0
    );

    const s2 = await req('/api/dishes?mode=basic&q=!%_&page=1&pageSize=10');
    assert(
      'Slide 25: Ký tự đặc biệt "!%_" với ILIKE -> Không khớp, trả items: [], total: 0, không bung SQL',
      s2.status === 200 && s2.data.ok === true && s2.data.data.items.length === 0 && s2.data.data.total === 0,
      s2.data
    );

    // 2. Full-Text Search với tsvector & tsquery (ăn GIN index idx_dishes_fts_gin)
    const sFts = await req('/api/dishes?mode=fulltext&q=gà giòn&page=1&pageSize=10');
    assert(
      'Mode Fulltext: Tìm FTS "gà giòn" trên name và description -> total > 0',
      sFts.status === 200 && sFts.data.ok === true && sFts.data.data.total > 0 && sFts.data.data.items.length > 0,
      sFts.data
    );

    // 3. Fuzzy Search với pg_trgm similarity >= 0.3 (ăn GIN index idx_dishes_name_trgm_gin)
    const sFuzzy = await req('/api/dishes?mode=fuzzy&q=Burgre&page=1&pageSize=10');
    assert(
      'Mode Fuzzy: Gõ nhầm "Burgre" -> Bắt được món "Burger..." nhờ pg_trgm similarity >= 0.3',
      sFuzzy.status === 200 && sFuzzy.data.ok === true && sFuzzy.data.data.total > 0 && sFuzzy.data.data.items.length > 0,
      sFuzzy.data
    );

    // -------------------------------------------------------------------------
    // NHÓM 5: ADVANCED SEARCH & ĐỒNG NHẤT VỚI BASIC KHI CHỈ CÓ Q (SLIDE 27, 28, 29)
    // -------------------------------------------------------------------------
    console.log(`\n--- [NHÓM 5] ADVANCED SEARCH & ĐỒNG NHẤT (SLIDE 27, 28, 29) ---`);

    // Slide 29: Basic và advanced phải cho cùng kết quả khi chỉ có cùng q
    const advQ = await req('/api/dishes?mode=advanced&q=Burger&page=1&pageSize=10');
    const basicQ = await req('/api/dishes?mode=basic&q=Burger&page=1&pageSize=10');
    assert(
      'Slide 29: Basic và Advanced cho CÙNG total và CÙNG danh sách ID khi chỉ có q',
      advQ.data.data.total === basicQ.data.data.total &&
      JSON.stringify(advQ.data.data.items.map((i) => i.id)) === JSON.stringify(basicQ.data.data.items.map((i) => i.id)),
      `Adv total: ${advQ.data.data.total}, Basic total: ${basicQ.data.data.total}`
    );

    // Slide 27: minPrice=0 là cận giá hợp lệ, không bị bỏ qua
    const advZero = await req('/api/dishes?mode=advanced&minPrice=0&page=1&pageSize=10');
    assert(
      'Slide 27: minPrice=0 là cận giá hợp lệ, không bị coi là rỗng',
      advZero.status === 200 && advZero.data.ok === true && advZero.data.data.total >= 1000
    );

    // Slide 27: available=false là chỉ lọc món không có sẵn, không được bỏ điều kiện
    const advUnavail = await req('/api/dishes?mode=advanced&available=false&page=1&pageSize=10');
    assert(
      'Slide 27: available=false -> Chỉ lọc món không có sẵn (isAvailable = false)',
      advUnavail.status === 200 &&
      advUnavail.data.ok === true &&
      advUnavail.data.data.items.every((i) => i.isAvailable === false),
      advUnavail.data.data.items
    );

    // Advanced search kết hợp nhiều tiêu chí AND
    const advMulti = await req('/api/dishes?mode=advanced&category=Gà Rán&minPrice=40000&maxPrice=100000&available=true&page=1&pageSize=10');
    assert(
      'Advanced Multi-Criteria: Lọc Gà Rán [40k - 100k], Available=true',
      advMulti.status === 200 &&
      advMulti.data.ok === true &&
      advMulti.data.data.total > 0 &&
      advMulti.data.data.items.every((i) => i.category === 'Gà Rán' && i.price >= 40000 && i.price <= 100000 && i.isAvailable === true)
    );

    // -------------------------------------------------------------------------
    // NHÓM 6: SẮP XẾP (SORTING) & TIE-BREAKER CỐ ĐỊNH THỨ TỰ
    // -------------------------------------------------------------------------
    console.log(`\n--- [NHÓM 6] SẮP XẾP THEO TÊN, GIÁ (ASC / DESC) & TIE-BREAKER ---`);

    const sortPriceAsc = await req('/api/dishes?page=1&pageSize=10&sortBy=price&sortOrder=asc');
    const pricesAsc = sortPriceAsc.data.data.items.map((i) => i.price);
    const isSortedAsc = pricesAsc.every((val, i, arr) => !i || arr[i - 1] <= val);
    assert(
      'Sắp xếp giá tăng dần (sortBy=price&sortOrder=asc)',
      isSortedAsc,
      pricesAsc
    );

    const sortPriceDesc = await req('/api/dishes?page=1&pageSize=10&sortBy=price&sortOrder=desc');
    const pricesDesc = sortPriceDesc.data.data.items.map((i) => i.price);
    const isSortedDesc = pricesDesc.every((val, i, arr) => !i || arr[i - 1] >= val);
    assert(
      'Sắp xếp giá giảm dần (sortBy=price&sortOrder=desc)',
      isSortedDesc,
      pricesDesc
    );

    const sortNameAsc = await req('/api/dishes?page=1&pageSize=10&sortBy=name&sortOrder=asc');
    const names = sortNameAsc.data.data.items.map((i) => i.name);
    const isNameAsc = names.every((val, i, arr) => !i || arr[i - 1].localeCompare(val) <= 0);
    assert(
      'Sắp xếp tên A-Z (sortBy=name&sortOrder=asc)',
      isNameAsc,
      names.slice(0, 3)
    );

  } catch (err) {
    console.error('❌ Lỗi ngoại lệ trong quá trình chạy test:', err);
    failed++;
  } finally {
    server.close();
    console.log(`\n======================================================================`);
    console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
    console.log(`======================================================================\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTestSuite();
