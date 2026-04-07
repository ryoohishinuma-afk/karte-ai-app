-- ============================================================
-- カルテAI データベーススキーマ
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 医師テーブル
CREATE TABLE IF NOT EXISTS doctors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  specialty     text,
  style_profile text,  -- AIが生成した書き癖サマリー
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 診察履歴テーブル
CREATE TABLE IF NOT EXISTS consultations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id        uuid REFERENCES doctors(id) ON DELETE SET NULL,
  patient_age      int,
  patient_gender   text,
  chief_complaint  text,
  transcript       text,
  generated_karte  text,
  final_karte      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS（anon全許可）
ALTER TABLE doctors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON doctors       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON consultations FOR ALL TO anon USING (true) WITH CHECK (true);
