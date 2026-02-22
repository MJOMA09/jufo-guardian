
-- Table to store admin OTP codes
CREATE TABLE public.admin_otp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.admin_otp ENABLE ROW LEVEL SECURITY;

-- No public access - only edge functions with service role can access
-- No RLS policies needed since we use service_role key in edge function

-- Index for quick lookups
CREATE INDEX idx_admin_otp_email_expires ON public.admin_otp (email, expires_at);

-- Auto-cleanup old OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.admin_otp WHERE expires_at < now() OR used = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_cleanup_otps
AFTER INSERT ON public.admin_otp
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_otps();
