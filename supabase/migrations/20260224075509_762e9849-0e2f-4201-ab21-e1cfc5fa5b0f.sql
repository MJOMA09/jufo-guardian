
DROP TABLE IF EXISTS public.admin_otp;

CREATE TABLE public.admin_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_otp ENABLE ROW LEVEL SECURITY;
