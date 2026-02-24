import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <div className="container mx-auto py-8">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity w-fit">
          <img src="/logo.png" alt="SciFilter Logo" className="h-10 w-10 rounded" />
          <span className="text-xl font-bold text-primary">SciFilter</span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
          <Link to="/" className="text-primary hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
