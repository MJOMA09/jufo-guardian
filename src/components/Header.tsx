import React from "react";
import { Link } from "react-router-dom";

const LOGO_URL = "https://i.postimg.cc/brfdbfVz/Screenshot-2026-02-02-214153.png";

const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mb-6">
      <div className="container mx-auto flex items-center h-14 px-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img
            src={LOGO_URL}
            alt="Sifter Logo"
            className="h-8 w-auto object-contain"
          />
        </Link>
      </div>
    </header>
  );
};

export default Header;
