import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SifterLogo } from "@/components/Header";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <div className="text-center">
        <div className="mb-8 flex justify-center"><SifterLogo className="h-40 w-auto max-w-[600px]" /></div>
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Oops! Page not found</p>
        <a href="/" className="text-primary hover:opacity-80 underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
