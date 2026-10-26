require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Nhà Hàng Việt Nam - Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`Thực đơn khách hàng (Client): http://localhost:${PORT}/dishes`);
  console.log(`Quản trị món ăn (Admin):      http://localhost:${PORT}/admin/dishes`);
  console.log(`Quản trị đầu bếp:             http://localhost:${PORT}/admin/chefs`);
  console.log(`Quản lý nguyên liệu:          http://localhost:${PORT}/admin/ingredients`);
  console.log(`====================================================`);
});
