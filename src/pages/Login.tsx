
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Shield, LogIn } from "lucide-react";
import { validateCredentials, setAuthenticated, initializeDefaultAdmin, isAuthenticated } from "@/utils/auth";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  useEffect(() => {
    // Initialize default admin on first load
    initializeDefaultAdmin();
    
    // If already authenticated, redirect to admin
    if (isAuthenticated()) {
      navigate('/admin');
    }
  }, [navigate]);

  const onSubmit = (values: LoginFormValues) => {
    setIsLoading(true);

    setTimeout(() => {
      const isValid = validateCredentials(values.username, values.password);
      
      if (isValid) {
        setAuthenticated(true);
        toast({
          title: "Login successful",
          description: "Welcome to the admin panel",
        });
        navigate('/admin');
      } else {
        toast({
          title: "Authentication failed",
          description: "Invalid username or password",
          variant: "destructive"
        });
      }
      
      setIsLoading(false);
    }, 500); // Small delay to simulate authentication process
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
                        <Input placeholder="admin" {...field} />
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
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    "Authenticating..."
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
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>Default credentials: username "admin" and password "scifilter2024"</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
