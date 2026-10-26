/**
 * KIỂM THỬ TÍCH HỢP FRONTEND - BACKEND (3 MODES PHÂN TRANG & 4 CHẾ ĐỘ TÌM KIẾM)
 * Mô phỏng chính xác các lời gọi API từ DishesPage.jsx
 */

require('dotenv').config();
const http = require('http');
const app = require('../src/app');

const server = http.createServer(app);

async function runFrontendIntegrationTest() {
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/dishes`;

  console.log(`\n======================================================================`);
  console.log(`🌐 KIỂM THỬ GHÉP NỐI FRONTEND - BACKEND CHO TRANG MENU DISHES`);
  console.log(`   Endpoint kiểm tra: ${baseUrl}`);
  console.log(`======================================================================\n`);

  async function callApi(queryObj = {}) {
    const sp = new URLSearchParams();
    Object.entries(queryObj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        sp.set(k, String(v).trim());
      }
    });
    const url = `${baseUrl}?${sp.toString()}`;
    const res = await fetch(url);
    const json = await res.json();
    return { status: res.status, json, url };
  }

  let passed = 0;
  let failed = 0;

  function assert(title, condition, detail = '') {
    if (condition) {
      console.log(`  ✔ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${title}`);
      if (detail) console.error(`    Chi tiết:`, detail);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: TẢI TRANG MENU BAN ĐẦU (PAGE NUMBERING - TRANG 1)
    // -------------------------------------------------------------------------
    console.log(`--- [KỊCH BẢN 1] GIAO DIỆN SỐ TRANG (PAGE NUMBERING) ---`);
    const res1 = await callApi({
      page: 1,
      pageSize: 9,
      mode: 'basic',
      sortBy: 'id',
      sortOrder: 'asc',
      paginationMode: 'numbers',
    });

    assert(
      'Trang 1 trả về HTTP 200, ok: true, đúng 9 món trên trang',
      res1.status === 200 &&
      res1.json.ok === true &&
      res1.json.data.items.length === 9 &&
      res1.json.data.page === 1 &&
      res1.json.data.pageSize === 9 &&
      res1.json.data.total >= 1000 &&
      res1.json.data.totalPages >= 112,
      res1.json
    );

    const page1Ids = res1.json.data.items.map((d) => d.id);

    // TEST 2: CHUYỂN SANG TRANG 2 TRONG NUMBERED PAGINATION
    const res2 = await callApi({
      page: 2,
      pageSize: 9,
      mode: 'basic',
      sortBy: 'id',
      sortOrder: 'asc',
      paginationMode: 'numbers',
    });

    const page2Ids = res2.json.data.items.map((d) => d.id);
    const hasOverlap = page1Ids.some((id) => page2Ids.includes(id));

    assert(
      'Trang 2 trả về 9 món tiếp theo, không trùng lặp bất kỳ món nào với Trang 1',
      res2.json.data.items.length === 9 && !hasOverlap,
      { page1Ids, page2Ids }
    );

    // -------------------------------------------------------------------------
    // TEST 3: GIAO DIỆN NÚT TẢI THÊM (LOAD MORE)
    // -------------------------------------------------------------------------
    console.log(`\n--- [KỊCH BẢN 2] GIAO DIỆN TẢI THÊM (LOAD MORE) ---`);
    // Lần 1: tải trang 1
    const lmPage1 = await callApi({ page: 1, pageSize: 9, mode: 'basic', paginationMode: 'loadmore' });
    // Lần 2: bấm "Tải thêm món" -> lấy trang 2 và nối vào
    const lmPage2 = await callApi({ page: 2, pageSize: 9, mode: 'basic', paginationMode: 'loadmore' });

    const accumulatedLoadMore = [...lmPage1.json.data.items, ...lmPage2.json.data.items];
    const uniqueIds = new Set(accumulatedLoadMore.map((d) => d.id));

    assert(
      'Load More tích lũy đủ 18 món khi tải trang 2 mà không bị trùng lặp ID',
      accumulatedLoadMore.length === 18 && uniqueIds.size === 18
    );

    // -------------------------------------------------------------------------
    // TEST 4: GIAO DIỆN CUỘN VÔ TẬN (INFINITE SCROLL)
    // -------------------------------------------------------------------------
    console.log(`\n--- [KỊCH BẢN 3] GIAO DIỆN CUỘN VÔ TẬN (INFINITE SCROLL) ---`);
    const infPage1 = await callApi({ page: 1, pageSize: 12, mode: 'basic', paginationMode: 'infinite' });
    const infPage2 = await callApi({ page: 2, pageSize: 12, mode: 'basic', paginationMode: 'infinite' });
    const infPage3 = await callApi({ page: 3, pageSize: 12, mode: 'basic', paginationMode: 'infinite' });

    const accumulatedInfinite = [
      ...infPage1.json.data.items,
      ...infPage2.json.data.items,
      ...infPage3.json.data.items,
    ];
    const infUniqueIds = new Set(accumulatedInfinite.map((d) => d.id));

    assert(
      'Infinite Scroll cuộn liên tục qua 3 trang nạp đủ 36 món mượt mà không lặp',
      accumulatedInfinite.length === 36 && infUniqueIds.size === 36
    );

    // -------------------------------------------------------------------------
    // TEST 5: TÌM KIẾM NÂNG CAO (ADVANCED SEARCH - AND CRITERIA)
    // -------------------------------------------------------------------------
    console.log(`\n--- [KỊCH BẢN 4] TÌM KIẾM NÂNG CAO (ADVANCED SEARCH) ---`);
    const advRes = await callApi({
      page: 1,
      pageSize: 10,
      mode: 'advanced',
      category: 'Gà Rán',
      minPrice: 0,
      maxPrice: 100000,
      available: 'true',
    });

    assert(
      'Advanced Search: minPrice=0, maxPrice=100000, category=Gà Rán, available=true',
      advRes.status === 200 && advRes.json.ok === true && advRes.json.data.items.length > 0,
      advRes.json
    );

    const allMatchAdv = advRes.json.data.items.every(
      (d) =>
        d.category.toLowerCase() === 'gà rán' &&
        d.price >= 0 &&
        d.price <= 100000 &&
        d.isAvailable === true
    );
    assert('Toàn bộ món trả về đều thỏa mãn đồng thời (AND) các tiêu chí', allMatchAdv);

    // Slide 27: available=false là điều kiện có nghĩa
    const notAvailRes = await callApi({
      page: 1,
      pageSize: 5,
      mode: 'advanced',
      available: 'false',
    });
    const allNotAvail = notAvailRes.json.data.items.every((d) => d.isAvailable === false);
    assert(
      'Slide 27: available=false lọc chính xác chỉ các món hết hàng (isAvailable = false)',
      notAvailRes.json.data.items.length > 0 && allNotAvail
    );

    // -------------------------------------------------------------------------
    // TEST 6: TÌM KIẾM TOÀN VĂN (FULL-TEXT SEARCH SIMPLE FTS)
    // -------------------------------------------------------------------------
    console.log(`\n--- [KỊCH BẢN 5] TÌM KIẾM TOÀN VĂN POSTGRESQL (FULL-TEXT SEARCH) ---`);
    const ftsRes = await callApi({
      page: 1,
      pageSize: 10,
      mode: 'fulltext',
      q: 'gà giòn',
      sortBy: 'rank',
      sortOrder: 'desc',
    });

    assert(
      'FTS tìm kiếm linh hoạt trên Tên và Mô tả, sắp xếp theo rank giảm dần',
      ftsRes.status === 200 && ftsRes.json.ok === true && ftsRes.json.data.items.length > 0
    );

    // -------------------------------------------------------------------------
    // TEST 7: TÌM KIẾM GẦN ĐÚNG (FUZZY SEARCH PG_TRGM)
    // -------------------------------------------------------------------------
    console.log(`\n--- [KỊCH BẢN 6] TÌM KIẾM GẦN ĐÚNG (FUZZY SEARCH PG_TRGM) ---`);
    const fuzzyRes = await callApi({
      page: 1,
      pageSize: 10,
      mode: 'fuzzy',
      q: 'Burgre', // Gõ sai chính tả của Burger
      sortBy: 'similarity',
      sortOrder: 'desc',
    });

    const hasBurger = fuzzyRes.json.data.items.some((d) =>
      d.name.toLowerCase().includes('burger')
    );
    assert(
      'Fuzzy Search: Gõ nhầm "Burgre" vẫn tìm ra các món Burger nhờ pg_trgm (similarity >= 0.3)',
      fuzzyRes.status === 200 && fuzzyRes.json.ok === true && hasBurger
    );

    // -------------------------------------------------------------------------
    // TEST 8: XỬ LÝ LỖI VALIDATION (SLIDE 10 & 27: VALIDATION_FAILED)
    // -------------------------------------------------------------------------
    console.log(`\n--- [KỊCH BẢN 7] XỬ LÝ LỖI HỢP LỆ HÓA THAM SỐ (VALIDATION_FAILED) ---`);
    const invalidPriceRes = await callApi({
      mode: 'advanced',
      minPrice: 150000,
      maxPrice: 50000, // minPrice > maxPrice
    });

    assert(
      'Slide 27: minPrice > maxPrice trả về HTTP 200, ok: false, error.code: VALIDATION_FAILED',
      invalidPriceRes.status === 200 &&
      invalidPriceRes.json.ok === false &&
      invalidPriceRes.json.error.code === 'VALIDATION_FAILED' &&
      !!invalidPriceRes.json.error.fields.minPrice
    );

    const ftsEmptyQ = await callApi({
      mode: 'fulltext',
      q: '   ', // Rỗng sau khi trim
    });

    assert(
      'Slide 21: Fulltext mode với q rỗng trả về VALIDATION_FAILED',
      ftsEmptyQ.status === 200 &&
      ftsEmptyQ.json.ok === false &&
      ftsEmptyQ.json.error.code === 'VALIDATION_FAILED'
    );

    console.log(`\n======================================================================`);
    console.log(`TỔNG KẾT KIỂM THỬ TÍCH HỢP FRONTEND: ${passed} PASS, ${failed} FAIL`);
    console.log(`======================================================================\n`);
  } catch (err) {
    console.error('Lỗi ngoại lệ trong quá trình chạy test:', err);
    failed++;
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runFrontendIntegrationTest();
