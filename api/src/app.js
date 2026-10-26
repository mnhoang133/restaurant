const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Import REST API routes
const apiRoutes = require('./routes/api.routes');

// Import technical error handlers (Slide 51)
const { notFoundHandler, globalErrorHandler } = require('./middlewares/error-handler.middleware');

const app = express();

// ==========================================
// 1. CORS CONFIGURATION (Slide 26, 45, 51)
// ==========================================
// Đọc origin của SPA từ biến môi trường, không dùng '*'
const allowedOrigin = (process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');

const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép requests không có origin (như Postman, mobile app hoặc curl)
    if (!origin) return callback(null, true);

    // Nếu khớp với allowedOrigin hoặc cùng host localhost (trong quá trình dev)
    if (
      origin === allowedOrigin ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Xử lý preflight OPTIONS với cùng cấu hình corsOptions (không dùng '*')
app.options('*', cors(corsOptions));

// ==========================================
// 2. BODY PARSING MIDDLEWARES
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 3. STATIC FILES & UPLOADS
// ==========================================
app.use(express.static(path.join(__dirname, '../public')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ==========================================
// 4. REST API ROUTES (Mount tại /api)
// ==========================================
app.use('/api', apiRoutes);

// ==========================================
// 5. SPA FALLBACK ROUTING (Slide 36, 40)
// ==========================================
const spaDistPath = path.join(__dirname, '../../web/dist/index.html');
const altSpaDistPath = path.join(__dirname, '../frontend/dist/index.html');
const publicIndexPath = path.join(__dirname, '../public/index.html');

app.get('*', (req, res, next) => {
  // Bỏ qua nếu là request API
  if (req.path.startsWith('/api')) {
    return next();
  }

  if (fs.existsSync(spaDistPath)) {
    return res.sendFile(spaDistPath);
  }
  if (fs.existsSync(altSpaDistPath)) {
    return res.sendFile(altSpaDistPath);
  }
  if (fs.existsSync(publicIndexPath)) {
    return res.sendFile(publicIndexPath);
  }

  // Nếu chưa có bundle Frontend, trả về thông tin chỉ dẫn hữu ích
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head><meta charset="UTF-8"><title>Restaurant REST API & SPA</title></head>
    <body style="font-family: sans-serif; padding: 40px; line-height: 1.6;">
      <h2>Restaurant REST API Server đang chạy thành công</h2>
      <p>Origin Frontend được cấu hình: <code>${allowedOrigin}</code></p>
      <p>Endpoints API sẵn sàng:</p>
      <ul>
        <li><a href="/api/dishes">GET /api/dishes</a></li>
        <li><a href="/api/chefs">GET /api/chefs</a></li>
        <li><a href="/api/ingredients">GET /api/ingredients</a></li>
      </ul>
      <p>Mở ứng dụng SPA tại <code>${allowedOrigin}</code> để kết nối và tương tác.</p>
    </body>
    </html>
  `);
});

// ==========================================
// 6. TECHNICAL ERROR HANDLERS (Slide 51)
// ==========================================
app.use(notFoundHandler); // Bắt lỗi 404 khi sai URL /api/...
app.use(globalErrorHandler); // Bắt lỗi 500 khi server/database crash

module.exports = app;
