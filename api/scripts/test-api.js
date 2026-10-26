const http = require('http');
const app = require('../src/app');

const server = http.createServer(app);

async function runTests() {
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[TEST SERVER] Running on ${baseUrl}\n`);

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

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`✔ PASS: ${name}`);
      passed++;
    } else {
      console.error(`✖ FAIL: ${name}. ${details}`);
      failed++;
    }
  }

  try {
    // 1. GET /api/dishes
    const r1 = await request('/api/dishes');
    assert(
      'GET /api/dishes trả status 200 và { ok: true } (không có success)',
      r1.status === 200 && r1.data.ok === true && r1.data.success === undefined && Array.isArray(r1.data.data),
      JSON.stringify(r1.data)
    );

    // 2. GET /api/dishes/999999 (NOT_FOUND)
    const r2 = await request('/api/dishes/999999');
    assert(
      'GET /api/dishes/999999 trả status 200 và error.code NOT_FOUND',
      r2.status === 200 && r2.data.ok === false && r2.data.error?.code === 'NOT_FOUND',
      JSON.stringify(r2.data)
    );

    // 3. POST /api/dishes thiếu dữ liệu (VALIDATION_FAILED)
    const r3 = await request('/api/dishes', {
      method: 'POST',
      body: JSON.stringify({ name: '', price: -100 }),
    });
    assert(
      'POST /api/dishes thiếu dữ liệu trả status 200 và error.code VALIDATION_FAILED kèm fields',
      r3.status === 200 && r3.data.ok === false && r3.data.error?.code === 'VALIDATION_FAILED' && !!r3.data.error?.fields?.name,
      JSON.stringify(r3.data)
    );

    // 4. POST /api/dishes với chefIds không tồn tại (RELATED_RESOURCE_NOT_FOUND)
    const r4 = await request('/api/dishes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Món Kiểm Tra Liên Kết',
        price: 88000,
        category: 'Món chính',
        chefIds: [999999],
      }),
    });
    assert(
      'POST /api/dishes với chefId sai trả status 200 và error.code RELATED_RESOURCE_NOT_FOUND kèm fields.chefIds',
      r4.status === 200 && r4.data.ok === false && r4.data.error?.code === 'RELATED_RESOURCE_NOT_FOUND' && !!r4.data.error?.fields?.chefIds,
      JSON.stringify(r4.data)
    );

    // 5. POST /api/dishes tạo thành công
    const uniqueTestCode = `TEST-${Date.now().toString().slice(-5)}`;
    const r5 = await request('/api/dishes', {
      method: 'POST',
      body: JSON.stringify({
        code: uniqueTestCode,
        name: 'Món Test Trùng Mã',
        price: 50000,
        category: 'Khai vị',
      }),
    });
    assert(
      'POST /api/dishes tạo thành công trả status 200 và { ok: true }',
      r5.status === 200 && r5.data.ok === true && r5.data.data?.code === uniqueTestCode,
      JSON.stringify(r5.data)
    );

    // 6. POST /api/dishes với code bị trùng (DUPLICATE_CODE)
    const r6 = await request('/api/dishes', {
      method: 'POST',
      body: JSON.stringify({
        code: uniqueTestCode,
        name: 'Món Test Lần 2',
        price: 60000,
        category: 'Khai vị',
      }),
    });
    assert(
      'POST /api/dishes trùng mã trả status 200 và error.code DUPLICATE_CODE kèm fields.code',
      r6.status === 200 && r6.data.ok === false && r6.data.error?.code === 'DUPLICATE_CODE' && !!r6.data.error?.fields?.code,
      JSON.stringify(r6.data)
    );

    // 7. GET /api/sai-url (Lỗi kỹ thuật 404 không theo response shape)
    const r7 = await request('/api/sai-url-endpoint');
    assert(
      'GET /api/sai-url trả status 404 và không có trường ok',
      r7.status === 404 && r7.data.ok === undefined,
      JSON.stringify(r7.data)
    );

    // 8. CORS Headers check
    const r8 = await request('/api/dishes', {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert(
      'CORS header Access-Control-Allow-Origin trả về đúng origin của SPA',
      r8.headers['access-control-allow-origin'] === 'http://localhost:5173',
      JSON.stringify(r8.headers)
    );

    console.log(`\n============================`);
    console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASSED, ${failed} FAILED`);
    console.log(`============================\n`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
