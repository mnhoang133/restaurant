/**
 * SCRIPT KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN (BRUNO CLI + KIỂM ĐỊNH YÊU CẦU SPA & UI)
 * Thực hiện:
 * 1. Khởi chạy REST API Server tại cổng 3099.
 * 2. Chạy tự động bộ sưu tập kiểm thử Bruno (`bru run --env local`) cho toàn bộ REST API.
 * 3. Kiểm tra tự động toàn bộ yêu cầu kiến trúc SPA & các chỉnh sửa UI/UX trên Frontend.
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const app = require('../src/app');

const PORT = 3099;
const server = http.createServer(app);

const webSrcDir = path.resolve(__dirname, '../../web/src');
const webPublicDir = path.resolve(__dirname, '../../web/public');
const brunoDir = path.resolve(__dirname, '../../bruno');

function readFile(relPath, baseDir = webSrcDir) {
  return fs.readFileSync(path.join(baseDir, relPath), 'utf8');
}

function getAllFiles(dir, ext = '.jsx', list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(full, ext, list);
    } else if (entry.name.endsWith(ext) || entry.name.endsWith('.js')) {
      list.push(full);
    }
  }
  return list;
}

async function main() {
  let passed = 0;
  let failed = 0;

  function check(title, condition, detail = '') {
    if (condition) {
      console.log(`  ✔ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${title}`);
      if (detail) console.error(`    -> Chi tiết: ${detail}`);
      failed++;
    }
  }

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`\n===========================================================================`);
  console.log(`🚀 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN (BRUNO CLI + SPA REQUIREMENTS AUDIT)`);
  console.log(`   API Server đang lắng nghe tại: http://localhost:${PORT}`);
  console.log(`===========================================================================\n`);

  try {
    // =========================================================================
    // PHẦN 1: CHẠY BRUNO CLI AUTOMATED API TESTS
    // =========================================================================
    console.log(`--- [PHẦN 1] CHẠY BRUNO CLI AUTOMATED TESTS (17 KỊCH BẢN REST API) ---\n`);

    const bruResult = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['--yes', '@usebruno/cli', 'run', '--env', 'local'],
      {
        cwd: brunoDir,
        encoding: 'utf8',
        stdio: 'pipe',
        shell: true,
      }
    );

    if (bruResult.stdout) {
      console.log(bruResult.stdout);
    }
    if (bruResult.stderr && bruResult.status !== 0) {
      console.error(bruResult.stderr);
    }

    check(
      'Bruno CLI: Toàn bộ 17 request & assertions trong bộ test Bruno chạy thành công (Exit code 0)',
      bruResult.status === 0,
      `Exit code: ${bruResult.status}`
    );

    // =========================================================================
    // PHẦN 2: KIỂM ĐỊNH YÊU CẦU KIẾN TRÚC SPA (BLOCK 6 & ĐỀ BÀI)
    // =========================================================================
    console.log(`\n--- [PHẦN 2] KIỂM ĐỊNH KIẾN TRÚC SPA (REACT + CLIENT-SIDE ROUTING + API LAYER) ---`);

    const appJsx = readFile('App.jsx');
    const apiClientJs = readFile('api/client.js');
    const layoutJsx = readFile('components/Layout.jsx');
    const appCss = readFile('css/app.css', webPublicDir);

    // 1. Nhiều trang giống SSR nhưng bản chất là SPA, dùng React Router với mode hash
    check(
      'SPA Routing: Sử dụng React Router với mode Hash (createHashRouter) và chia thành nhiều trang riêng biệt',
      appJsx.includes('createHashRouter') &&
        appJsx.includes("path: 'dishes'") &&
        appJsx.includes("path: 'dishes/:id'") &&
        appJsx.includes("path: 'admin/dishes'") &&
        appJsx.includes("path: 'admin/chefs'") &&
        appJsx.includes("path: 'admin/ingredients'")
    );

    // 2. Toàn bộ lời gọi API đặt ở một nơi duy nhất (src/api/client.js)
    const allSrcFiles = getAllFiles(webSrcDir);
    const filesCallingFetchDirectly = allSrcFiles.filter((filePath) => {
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized.endsWith('/api/client.js')) return false;
      const content = fs.readFileSync(filePath, 'utf8');
      return /\bfetch\s*\(/.test(content) || /\baxios\b/.test(content);
    });
    check(
      'Single API Layer: Toàn bộ lời gọi HTTP (fetch) chỉ nằm duy nhất tại src/api/client.js',
      apiClientJs.includes('fetch(') && filesCallingFetchDirectly.length === 0,
      filesCallingFetchDirectly.length > 0
        ? `Các file gọi fetch trực tiếp: ${filesCallingFetchDirectly.join(', ')}`
        : ''
    );

    // 3. Khi nhận response HTTP 200 nhưng ok === false thì báo error message chứ không đưa dữ liệu lên
    check(
      'Error Envelope (ok: false): apiClient kiểm tra json.ok === false và trả về nhánh lỗi kèm error.message',
      apiClientJs.includes('json.ok === false') &&
        apiClientJs.includes('ok: false') &&
        apiClientJs.includes('error:')
    );

    // 4. Loading indicator & vô hiệu hóa toàn bộ nút bấm khi đang chờ backend
    check(
      'Loading & Disable Buttons: Có loading indicator toàn cục và khóa toàn bộ button khi đang gọi API',
      apiClientJs.includes('is-api-loading') &&
        layoutJsx.includes('subscribeApiLoading') &&
        layoutJsx.includes('spa-loading-bar') &&
        appCss.includes('body.is-api-loading button') &&
        appCss.includes('pointer-events: none')
    );

    // 5. Mỗi trang chỉ lấy dữ liệu của chính trang đó và không chia sẻ state cho trang khác
    const usesGlobalStore = allSrcFiles.some((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      return /\bcreateContext\s*\(/.test(content) || /\bredux\b/i.test(content) || /\bzustand\b/i.test(content);
    });
    check(
      'Per-Page Isolated State: Không dùng Global Store/Context chia sẻ dữ liệu giữa các trang',
      !usesGlobalStore
    );

    // =========================================================================
    // PHẦN 3: KIỂM ĐỊNH CÁC YÊU CẦU CHỈNH SỬA UI QUẢN LÝ & MENU
    // =========================================================================
    console.log(`\n--- [PHẦN 3] KIỂM ĐỊNH CÁC YÊU CẦU GIAO DIỆN (UI/UX REQUIREMENTS) ---`);

    const chefFormJsx = readFile('pages/admin/AdminChefFormPage.jsx');
    const ingListJsx = readFile('pages/admin/AdminIngredientsListPage.jsx');
    const ingFormJsx = readFile('pages/admin/AdminIngredientFormPage.jsx');
    const dishesPageJsx = readFile('pages/client/DishesPage.jsx');
    const dishDetailJsx = readFile('pages/client/DishDetailPage.jsx');
    const adminNavJsx = readFile('components/AdminNav.jsx');
    const adminDishesJsx = readFile('pages/admin/AdminDishesListPage.jsx');
    const adminChefsJsx = readFile('pages/admin/AdminChefsListPage.jsx');
    const iconJsx = readFile('components/Icon.jsx');

    // 6. Trang quản lý Đầu bếp: 2 danh sách (món đầu bếp nấu ở trên, món không nấu ở dưới, thêm/xóa di chuyển giữa 2 list)
    check(
      'UI Đầu bếp: Hiển thị 2 danh sách (Món đầu bếp này nấu ở trên & Món đầu bếp này không nấu ở dưới) kèm thao tác chọn/xóa',
      chefFormJsx.includes('cookedDishes') &&
        chefFormJsx.includes('uncookedDishes') &&
        chefFormJsx.includes('handleAddDish') &&
        chefFormJsx.includes('handleRemoveDish') &&
        chefFormJsx.indexOf('Món đầu bếp này nấu') < chefFormJsx.indexOf('Món đầu bếp này không nấu')
    );

    // 7. Trang quản lý Nguyên liệu: Bỏ số lượng tồn kho, chỉ yêu cầu tên nguyên liệu
    check(
      'UI Nguyên liệu: Đã loại bỏ số lượng hàng tồn kho trong danh sách và biểu mẫu nguyên liệu',
      !ingListJsx.includes('Tồn kho') &&
        !ingFormJsx.includes('name="quantity"') &&
        !dishDetailJsx.includes('quantityUsed')
    );

    // 8. Loại bỏ tab Tổng quan trong trang quản lý
    check(
      'UI Quản lý: Đã loại bỏ tab Tổng quan khỏi AdminNav và chuyển hướng /admin thẳng về /admin/dishes',
      !adminNavJsx.includes('Tổng quan') &&
        appJsx.includes('<Navigate to="/admin/dishes" replace />')
    );

    // 9. Ẩn mã món ăn trong Menu và Chi tiết món ăn
    check(
      'UI Menu & Chi tiết món: Đã ẩn mã món ăn (#dish.code / MÃ: dish.code)',
      !dishesPageJsx.includes('#{dish.code}') &&
        !dishDetailJsx.includes('MÃ: {dish.code}')
    );

    // 10. Loại bỏ hiệu ứng khi di chuột vào các tab: Trang chủ, Menu, Quản lý
    check(
      'UI Thanh điều hướng: Đã loại bỏ hiệu ứng di chuột (mouseenter/hover) trên các tab Trang chủ, Menu, Quản lý',
      !layoutJsx.includes("addEventListener('mouseenter'") &&
        !appCss.includes('.nav-tabs a:hover')
    );

    // 11. Đổi logo thành hình chiếc chảo (sử dụng đúng SVG được cung cấp)
    check(
      'UI Logo: Đã đổi sang icon hình chiếc chảo (pan) với đúng thông số SVG được cung cấp',
      iconJsx.includes('M9.75 10a4.25 4.25 0 1 1 0 8.5') &&
        layoutJsx.includes('<Icon name="pan"')
    );

    // 12. Tạo bộ lọc dropdown theo danh mục bên cạnh thanh tìm kiếm
    check(
      'UI Bộ lọc danh mục: Có dropdown (<select name="category">) lọc danh mục cạnh thanh tìm kiếm',
      dishesPageJsx.includes('name="category"') &&
        dishesPageJsx.includes('Tất cả danh mục') &&
        adminDishesJsx.includes('name="category"')
    );

    // 13. Loại bỏ icon tìm kiếm hình kính lúp ở góc phải phía trên màn hình
    check(
      'UI Header: Đã loại bỏ icon tìm kiếm hình kính lúp (#header-search) ở góc phải phía trên',
      !layoutJsx.includes('id="header-search"')
    );

    // 14. Loại bỏ dòng "Hiển thị món 7 - 12 trên tổng số 12 món" trong trang Menu
    check(
      'UI Phân trang Menu: Đã loại bỏ dòng "Hiển thị món X - Y trên tổng số Z món"',
      !dishesPageJsx.includes('trên tổng số')
    );

    // 15. Loại bỏ tiêu đề đầu trang Menu & Quản lý và xếp nút Thêm cùng hàng với thanh tìm kiếm
    check(
      'UI Bố cục Tìm kiếm & Nút Thêm: Đã bỏ cụm tiêu đề đầu trang và xếp nút Thêm nằm cùng hàng với form tìm kiếm',
      !dishesPageJsx.includes('Danh Mục Thực Đơn') &&
        !adminDishesJsx.includes('Danh Sách Món Ăn') &&
        !adminChefsJsx.includes('Quản Lý Đầu Bếp') &&
        !ingListJsx.includes('Quản Lý Nguyên Liệu') &&
        adminDishesJsx.indexOf('<form') < adminDishesJsx.indexOf('Thêm Món Mới') &&
        adminDishesJsx.indexOf('Thêm Món Mới') < adminDishesJsx.indexOf('</form>') &&
        adminChefsJsx.indexOf('<form') < adminChefsJsx.indexOf('Thêm Đầu Bếp') &&
        adminChefsJsx.indexOf('Thêm Đầu Bếp') < adminChefsJsx.indexOf('</form>') &&
        ingListJsx.indexOf('<form') < ingListJsx.indexOf('Thêm Nguyên Liệu') &&
        ingListJsx.indexOf('Thêm Nguyên Liệu') < ingListJsx.indexOf('</form>')
    );

    console.log(`\n===========================================================================`);
    console.log(`📊 TỔNG KẾT KIỂM THỬ TOÀN DIỆN: ${passed}/${passed + failed} HẠNG MỤC ĐẠT YÊU CẦU`);
    if (failed === 0) {
      console.log(`🎉 TẤT CẢ CÁC YÊU CẦU ĐỀ BÀI (API BRUNO + SPA + UI/UX) ĐỀU ĐẠT 100%!`);
    } else {
      console.log(`⚠️ CÓ ${failed} HẠNG MỤC CHƯA ĐẠT.`);
    }
    console.log(`===========================================================================\n`);
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
