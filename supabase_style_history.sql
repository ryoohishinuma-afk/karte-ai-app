-- スタイルプロファイル履歴カラムを追加
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS style_profile_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 例: 各バージョンの構造
-- [
--   {
--     "id": "uuid-v4",
--     "created_at": "2026-04-10T10:00:00Z",
--     "profile": "プロファイルテキスト...",
--     "label": "2026-04-10 学習",
--     "saved": false
--   }
-- ]
