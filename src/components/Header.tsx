import React from "react";
import { Link } from "react-router-dom";
import logoUrl from "@/assets/Sifter_logo.png";

type SifterLogoProps = {
  className?: string;
};

export const SifterLogo: React.FC<SifterLogoProps> = ({ className = "h-11 w-auto" }) => (
  <Link
    to="/"
    aria-label="Sifter home"
    className="inline-flex shrink-0 items-center transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  >
    <img src={logoUrl} alt="Sifter" className={`${className} object-contain contrast-125 saturate-150 drop-shadow-[0_1px_1px_hsl(var(--foreground)/0.35)]`} />
  </Link>
);

const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mb-6">
      <div className="container mx-auto flex items-center h-16 px-4">
        <SifterLogo />
      </div>
    </header>
  );
};

export default Header;
