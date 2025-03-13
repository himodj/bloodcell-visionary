
import React from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, HelpCircle } from 'lucide-react';

const Header: React.FC = () => {
  const { analysisResult, resetAnalysis } = useAnalysis();
  
  return (
    <header className="w-full py-4 px-6 glass-morphism mb-6 animate-slide-down">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {analysisResult && (
            <Button 
              variant="ghost" 
              onClick={resetAnalysis}
              className="group"
            >
              <ArrowLeft size={18} className="mr-2 transition-transform group-hover:-translate-x-1" />
              <span>New Analysis</span>
            </Button>
          )}
          {!analysisResult && (
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-medical-red flex items-center justify-center mr-3">
                <div className="w-6 h-6 rounded-full bg-white"></div>
              </div>
              <h1 className="text-2xl font-display font-semibold text-medical-dark">
                BloodCell<span className="text-medical-red">Vision</span>
              </h1>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <HelpCircle size={16} className="mr-1" />
            <span>Help</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
