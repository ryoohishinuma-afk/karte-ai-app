-- 略語・定型文辞書
CREATE TABLE IF NOT EXISTS phrases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid REFERENCES doctors(id) ON DELETE CASCADE,
  trigger     text NOT NULL,   -- 略語・トリガー（例: ROM）
  expansion   text NOT NULL,   -- 展開テキスト（例: ROM制限なし）
  category    text DEFAULT 'その他',  -- 所見/診断/処方/指示/その他
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 症状別テンプレート
CREATE TABLE IF NOT EXISTS templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     uuid REFERENCES doctors(id) ON DELETE CASCADE,
  symptom       text NOT NULL,   -- 症状キーワード（例: 膝関節痛）
  age_group     text,            -- 年齢層（例: 60代）
  gender        text,            -- 性別（男性/女性/問わず）
  template_text text NOT NULL,   -- テンプレート本文
  use_count     int DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE phrases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON phrases   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON templates FOR ALL TO anon USING (true) WITH CHECK (true);
