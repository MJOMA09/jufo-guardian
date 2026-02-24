import { Link } from "react-router-dom";

const AppHeader = () => {
  return (
    <header className="flex items-center justify-between mb-6">
      <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <img src="https://i.postimg.cc/brfdbfVz/Screenshot-2026-02-02-214153.png" alt="SciFilter Logo" className="h-10 w-10 rounded" />
        <span className="text-xl font-bold text-primary">SciFilter</span>
      </Link>
    </header>
  );
};

export default AppHeader;
