-- doctorsテーブルにroleカラムを追加
-- 'doctor'（医師）または 'pt'（理学療法士）
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'doctor';

-- 既存レコードはすべて 'doctor' として扱う
UPDATE doctors SET role = 'doctor' WHERE role IS NULL OR role = '';
