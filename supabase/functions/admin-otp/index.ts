import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "ayofolaposy@gmail.com";

function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + "scifilter-otp-salt-2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, email, otp } = await req.json();

    if (action === "send-otp") {
      // Only allow the admin email
      if (email?.toLowerCase().trim() !== ADMIN_EMAIL) {
        return new Response(
          JSON.stringify({ error: "This is not an admin email" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invalidate any existing OTPs
      await supabase
        .from("admin_otp")
        .update({ used: true })
        .eq("email", ADMIN_EMAIL)
        .eq("used", false);

      // Generate and store OTP
      const otpCode = generateOTP();
      const otpHash = await hashOTP(otpCode);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const { error: insertError } = await supabase.from("admin_otp").insert({
        email: ADMIN_EMAIL,
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString(),
      });

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to generate OTP" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send email via Resend
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SciFilter Admin <onboarding@resend.dev>",
          to: [ADMIN_EMAIL],
          subject: "Your SciFilter Admin Login Code",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #7c3aed; margin-bottom: 8px;">SciFilter Admin Login</h2>
              <p style="color: #555; margin-bottom: 24px;">Use the code below to sign in. It expires in 10 minutes.</p>
              <div style="background: #f4f0ff; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #7c3aed;">${otpCode}</span>
              </div>
              <p style="color: #999; font-size: 13px;">If you didn't request this code, please ignore this email.</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error("Resend error:", errText);
        return new Response(
          JSON.stringify({ error: "Failed to send email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "OTP sent to email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify-otp") {
      if (email?.toLowerCase().trim() !== ADMIN_EMAIL) {
        return new Response(
          JSON.stringify({ error: "Invalid email" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!otp || otp.length !== 6) {
        return new Response(
          JSON.stringify({ error: "Invalid OTP format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const otpHash = await hashOTP(otp);

      const { data, error } = await supabase
        .from("admin_otp")
        .select("*")
        .eq("email", ADMIN_EMAIL)
        .eq("otp_hash", otpHash)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired code" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark OTP as used
      await supabase
        .from("admin_otp")
        .update({ used: true })
        .eq("id", data.id);

      // Generate a session token
      const sessionToken = crypto.randomUUID();

      return new Response(
        JSON.stringify({ success: true, sessionToken }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
