-- 学習ファイル履歴テーブル
-- Supabase SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS learning_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid REFERENCES doctors(id) ON DELETE CASCADE,
  filename    text NOT NULL,
  file_type   text NOT NULL,  -- 'pdf' | 'txt' | 'md' | 'csv' | 'docx'
  file_size   bigint,         -- bytes
  learned_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE learning_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON learning_files FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS learning_files_doctor_id_idx ON learning_files(doctor_id);
