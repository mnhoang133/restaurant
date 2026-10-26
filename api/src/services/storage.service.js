const path = require('path');
const fs = require('fs');
const { supabase, bucketName, isSupabaseConfigured } = require('../config/supabase');

/**
 * Service quản lý upload và lưu trữ hình ảnh
 * Quy tắc đặt tên file: <MÃ_UNIQUE>-<SỐ_THỨ_TỰ_ẢNH>.<phần_mở_rộng>
 * Ví dụ: DISH001-1.jpg, DISH001-2.png, CHEF01-1.jpg
 */
class StorageService {
  /**
   * Upload danh sách file ảnh cho một đối tượng (Món ăn hoặc Đầu bếp)
   * @param {Array<Express.Multer.File>} files Danh sách file từ multer
   * @param {string} entityCode Mã unique của thực thể (ví dụ: DISH001, CHEF01)
   * @param {number} startIndex Thứ tự bắt đầu của ảnh mới (mặc định 1)
   * @returns {Promise<Array<{imageUrl: string, orderIndex: number}>>}
   */
  async uploadMultipleImages(files, entityCode, startIndex = 1) {
    if (!files || files.length === 0) return [];

    const uploadedResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const orderIndex = startIndex + i;
      const fileExt = path.extname(file.originalname) || '.jpg';
      const cleanEntityCode = entityCode.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${cleanEntityCode}-${orderIndex}${fileExt}`;

      let imageUrl = '';

      if (isSupabaseConfigured) {
        // Upload lên Supabase Storage Bucket
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: true, // Cho phép ghi đè nếu trùng tên
          });

        if (error) {
          console.error(`[Supabase Storage Error] Lỗi upload ${fileName}:`, error.message);
          // Fallback sang local disk nếu upload Supabase gặp sự cố mạng
          imageUrl = await this._saveToLocalDisk(file.buffer, fileName);
        } else {
          // Lấy Public URL từ Supabase
          const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);
          imageUrl = publicUrlData.publicUrl;
        }
      } else {
        // Fallback lưu cục bộ trong public/uploads khi chưa cấu hình Supabase Keys
        imageUrl = await this._saveToLocalDisk(file.buffer, fileName);
      }

      uploadedResults.push({
        imageUrl,
        orderIndex,
      });
    }

    return uploadedResults;
  }

  /**
   * Lưu buffer ảnh vào thư mục public/uploads trên ổ cứng
   * @private
   */
  async _saveToLocalDisk(buffer, fileName) {
    const uploadDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(filePath, buffer);
    return `/uploads/${fileName}`;
  }

  /**
   * Xóa file ảnh vật lý nếu được lưu trong thư mục uploads
   * @param {string} imageUrl Đường dẫn ảnh
   */
  async deleteFile(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return;
    try {
      if (imageUrl.startsWith('/uploads/')) {
        const fileName = path.basename(imageUrl);
        const filePath = path.join(__dirname, '../../public/uploads', fileName);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } else if (isSupabaseConfigured && imageUrl.includes(bucketName)) {
        const parts = imageUrl.split('/');
        const fileName = parts[parts.length - 1];
        if (fileName) {
          await supabase.storage.from(bucketName).remove([fileName]);
        }
      }
    } catch (e) {
      console.warn('[StorageService] Không thể xóa file vật lý:', e.message);
    }
  }
}

module.exports = new StorageService();
