const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_BUCKET || 'restaurant-images';

// Kiểm tra xem đã cấu hình key thật của Supabase chưa
const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('your_project_ref') &&
  !supabaseKey.includes('your_supabase_anon_public_key')
);

let supabase = null;
if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

module.exports = {
  supabase,
  bucketName,
  isSupabaseConfigured,
};
