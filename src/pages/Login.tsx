import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, LogIn, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { setAuthenticated, isAuthenticated } from "@/utils/auth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

type Step = "email" | "otp";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/admin");
    }
  }, [navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = async () => {
    setError("");
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ email: trimmedEmail }),
        }
      );
      const data = await res.json();

      if (!res.ok || data?.error) {
        setError(data?.error || "Failed to send code");
        return;
      }

      setStep("otp");
      setCountdown(60);
      toast({
        title: "Code sent",
        description: "Check your email for the login code.",
      });
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
        }
      );
      const data = await res.json();

      if (!res.ok || data?.error) {
        setError(data?.error || "Verification failed");
        return;
      }

      setAuthenticated(true);
      toast({
        title: "Login successful",
        description: "Welcome to the admin panel",
      });
      navigate("/admin");
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setOtp("");
    setError("");
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen px-4">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Shield className="h-12 w-12 text-purple-600" />
            </div>
            <CardTitle className="text-2xl">SciFilter Admin Login</CardTitle>
            <CardDescription>
              {step === "email"
                ? "Enter your admin email to receive a login code"
                : "Enter the 6-digit code sent to your email"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === "email" ? (
              <div className="space-y-2">
                <Label htmlFor="email">Admin Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter admin email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    disabled={isLoading}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={handleBack}
                  className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Change email
                </button>

                <p className="text-sm text-muted-foreground">
                  Code sent to <strong>{email}</strong>
                </p>

                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => {
                      setOtp(value);
                      setError("");
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {countdown > 0 ? (
                  <p className="text-xs text-center text-muted-foreground">
                    Resend code in {countdown}s
                  </p>
                ) : (
                  <button
                    onClick={handleSendOtp}
                    className="text-xs text-primary hover:underline w-full text-center"
                    disabled={isLoading}
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
              onClick={step === "email" ? handleSendOtp : handleVerifyOtp}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {step === "email" ? "Sending..." : "Verifying..."}
                </>
              ) : step === "email" ? (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Login Code
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Verify & Login
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Login;
