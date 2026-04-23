-- Mevcut DB: user_a < user_b (string) sırası + UNIQUE (user_a, user_b)
-- Aynı çifte tekrarlayan satır varsa bu migration öncesi manuel veya ayrı temizlik gerekir.

UPDATE public.conversations
SET
  user_a = (CASE WHEN user_a::text < user_b::text THEN user_a ELSE user_b END),
  user_b = (CASE WHEN user_a::text < user_b::text THEN user_b ELSE user_a END)
WHERE true;

DO $$
BEGIN
  ALTER TABLE public.conversations
    ADD CONSTRAINT uq_conversations_user_pair UNIQUE (user_a, user_b);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN
    RAISE EXCEPTION
      'conversations: aynı kullanıcı çifti birden çok kez; tekrarları kaldırdıktan sonra tekrar deneyin: %', SQLERRM
      USING ERRCODE = '23505';
END $$;
