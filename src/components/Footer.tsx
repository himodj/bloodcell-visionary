
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full py-4 px-6 text-center text-sm text-medical-dark text-opacity-60 mt-auto">
      <div className="container mx-auto">
        <p>
          BloodCellVision &copy; {new Date().getFullYear()} &middot; Advanced blood cell analysis platform
        </p>
      </div>
    </footer>
  );
};

export default Footer;
