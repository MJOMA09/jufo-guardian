import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Mail, KeyRound, ArrowLeft, Loader2 } from "lucide-react";
import { setAuthenticated, isAuthenticated } from "@/utils/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/admin");
    }
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOTP = async () => {
    if (!email.trim()) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-otp", {
        body: { action: "send-otp", email: email.trim().toLowerCase() },
      });

      if (error || data?.error) {
        toast({
          title: "Error",
          description: data?.error || "This is not an admin email",
          variant: "destructive",
        });
      } else {
        setStep("otp");
        setCooldown(60);
        toast({
          title: "Code sent",
          description: "Check your email for the login code",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send login code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-otp", {
        body: { action: "verify-otp", email: email.trim().toLowerCase(), otp },
      });

      if (error || data?.error) {
        toast({
          title: "Invalid code",
          description: data?.error || "The code is invalid or expired",
          variant: "destructive",
        });
      } else {
        setAuthenticated(true, data.sessionToken);
        toast({ title: "Welcome", description: "Logged in successfully" });
        navigate("/admin");
      }
    } catch {
      toast({
        title: "Error",
        description: "Verification failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen px-4">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Shield className="h-12 w-12 text-purple-600" />
            </div>
            <CardTitle className="text-2xl">SciFilter Admin</CardTitle>
            <CardDescription>
              {step === "email"
                ? "Enter your admin email to receive a login code"
                : "Enter the 6-digit code sent to your email"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === "email" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="admin-email">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="Enter admin email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                    className="pl-10"
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setOtp(""); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="otp-input">
                    Login Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="otp-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
                      className="pl-10 text-center text-xl tracking-[0.5em] font-mono"
                      autoFocus
                    />
                  </div>
                </div>

                {cooldown > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Resend code in {cooldown}s
                  </p>
                )}
                {cooldown === 0 && (
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    className="text-xs text-primary hover:underline w-full text-center"
                  >
                    Resend code
                  </button>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button
              className="w-full"
              disabled={isLoading || (step === "email" ? !email.trim() : otp.length !== 6)}
              onClick={step === "email" ? handleSendOTP : handleVerifyOTP}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait...</>
              ) : step === "email" ? (
                <><Mail className="mr-2 h-4 w-4" /> Send Login Code</>
              ) : (
                <><KeyRound className="mr-2 h-4 w-4" /> Verify & Login</>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Login;
