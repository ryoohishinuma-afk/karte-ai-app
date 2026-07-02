-- Phase A: 原文カルテの保存（癖再現のためのfew-shot用）
-- Supabase SQL Editor で実行してください

ALTER TABLE learning_files
  ADD COLUMN IF NOT EXISTS content text,            -- マスキング済みカルテ原文
  ADD COLUMN IF NOT EXISTS visit_type text,          -- '初診' | '再診' | '不明'
  ADD COLUMN IF NOT EXISTS chief_complaint text;     -- 主訴（AI自動タグ付け）

CREATE INDEX IF NOT EXISTS learning_files_doctor_visit_idx
  ON learning_files(doctor_id, visit_type);

-- consultationsにvisit_typeを追加（コードはinsertしているがスキーマに未定義だったため）
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS visit_type text;
