import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Shield, LogIn, AlertTriangle, Clock } from "lucide-react";
import { validateCredentials, setAuthenticated, initializeDefaultAdmin, isAuthenticated, getRemainingLockoutTime } from "@/utils/auth";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as z from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  useEffect(() => {
    // Initialize default admin on first load
    const init = async () => {
      const result = await initializeDefaultAdmin();
      if (result.isFirstTime) {
        setShowFirstTimeSetup(true);
        toast({
          title: "First Time Setup",
          description: "Check the browser console for your admin credentials.",
          duration: 10000,
        });
      }
    };
    init();
    
    // If already authenticated, redirect to admin
    if (isAuthenticated()) {
      navigate('/admin');
    }
    
    // Check for existing lockout
    const remaining = getRemainingLockoutTime();
    if (remaining > 0) {
      setLockoutTime(remaining);
      const timer = setInterval(() => {
        const newRemaining = getRemainingLockoutTime();
        setLockoutTime(newRemaining);
        if (newRemaining <= 0) {
          clearInterval(timer);
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [navigate, toast]);

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);

    try {
      const result = await validateCredentials(values.username, values.password);
      
      if (result.isLocked) {
        setLockoutTime(result.lockoutTime! - Date.now());
        toast({
          title: "Account Locked",
          description: "Too many failed attempts. Please try again later.",
          variant: "destructive"
        });
      } else if (result.isValid) {
        setAuthenticated(true);
        
        if (result.requiresPasswordChange) {
          toast({
            title: "Password Change Required",
            description: "Please change your password for security.",
          });
        } else {
          toast({
            title: "Login successful",
            description: "Welcome to the admin panel",
          });
        }
        
        navigate('/admin');
      } else {
        toast({
          title: "Authentication failed",
          description: "Invalid username or password",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Login error",
        description: "An error occurred during login",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatLockoutTime = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Shield className="h-12 w-12 text-purple-600" />
            </div>
            <CardTitle className="text-2xl">SciFilter Admin Login</CardTitle>
            <CardDescription>
              Login to manage the JUFO reference database
            </CardDescription>
          </CardHeader>
          
          {showFirstTimeSetup && (
            <CardContent>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>First Time Setup:</strong> Your admin credentials have been generated. 
                  Please check the browser console (F12 → Console tab) for your login details.
                </AlertDescription>
              </Alert>
            </CardContent>
          )}
          
          {lockoutTime > 0 && (
            <CardContent>
              <Alert variant="destructive">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Account is temporarily locked due to too many failed attempts. 
                  Try again in: <strong>{formatLockoutTime(lockoutTime)}</strong>
                </AlertDescription>
              </Alert>
            </CardContent>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter username" 
                          {...field} 
                          disabled={lockoutTime > 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter password" 
                          {...field}
                          disabled={lockoutTime > 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || lockoutTime > 0}
                >
                  {isLoading ? (
                    "Authenticating..."
                  ) : lockoutTime > 0 ? (
                    "Account Locked"
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Login
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
        
        {process.env.NODE_ENV === 'development' && showFirstTimeSetup && (
          <div className="mt-4 text-center text-xs text-muted-foreground">
            <p>Development mode - Check console for credentials (F12)</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
