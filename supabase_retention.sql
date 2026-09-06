-- 生成カルテの自動削除（データ保持ポリシー）
-- Supabase SQL Editor で実行してください

-- クリニック全体で共通の設定（1行のみ）
CREATE TABLE IF NOT EXISTS app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),  -- 単一行を強制
  retention_hours integer NOT NULL DEFAULT 24,             -- 1 | 6 | 12 | 24 のいずれか
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_settings (id, retention_hours) VALUES (true, 24) ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON app_settings;
CREATE POLICY "anon_all" ON app_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- consultationsに有効期限カラムを追加
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 識別用メモ（本物の患者ID・氏名は入れない。院内カルテ番号・診察順・イニシャル等、医師の裁量。保存期間切れで一緒に削除される）
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS patient_label text;

-- 期限切れレコードを削除する関数（transcript・generated_karte・final_karte含め行ごと削除）
CREATE OR REPLACE FUNCTION delete_expired_consultations()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM consultations WHERE expires_at IS NOT NULL AND expires_at < now();
$$;

-- 15分ごとに実行（1時間設定でも削除の遅延を最大15分程度に抑える）
SELECT cron.unschedule('delete-expired-consultations')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-expired-consultations');

SELECT cron.schedule(
  'delete-expired-consultations',
  '*/15 * * * *',
  $$SELECT delete_expired_consultations();$$
);
