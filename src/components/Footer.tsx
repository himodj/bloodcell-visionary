
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full py-4 px-6 text-center text-sm text-medical-dark text-opacity-60 mt-auto">
      <div className="container mx-auto flex items-center justify-center gap-2">
        <img src="./logo.png" alt="BloodCellVision Logo" className="h-5 w-5" />
        <p>
          BloodCellVision &copy; {new Date().getFullYear()} &middot; AI-Powered Blood Cell Analysis System
        </p>
      </div>
    </footer>
  );
};

export default Footer;
