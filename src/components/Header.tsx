
import React, { useState } from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Header: React.FC = () => {
  const { analysisResult, resetAnalysis } = useAnalysis();
  const [helpOpen, setHelpOpen] = useState(false);
  
  return (
    <header className="w-full py-4 px-6 glass-morphism mb-6 animate-slide-down">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <img 
              src="/lovable-uploads/623308ff-1ed1-4208-9ef4-41e4d60d733d.png" 
              alt="BloodCellVision Logo" 
              className="h-10 w-10 mr-3"
            />
            <h1 className="text-2xl font-display font-semibold text-medical-dark">
              BloodCell<span style={{ color: '#D21A1A' }}>Vision</span>
            </h1>
          </div>
          {analysisResult && (
            <Button 
              variant="ghost" 
              onClick={resetAnalysis}
              className="group ml-6"
            >
              <ArrowLeft size={18} className="mr-2 transition-transform group-hover:-translate-x-1" />
              <span>New Analysis</span>
            </Button>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <HelpCircle size={16} className="mr-1" />
                <span>Help</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Need Assistance?</DialogTitle>
                <DialogDescription>
                  If you need help with BloodCellVision or have any questions about the analysis, please reach out.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p>Contact us at: <a href="mailto:himodj7@gmail.com" className="text-medical-red hover:underline font-medium">himodj7@gmail.com</a></p>
                <p className="text-sm text-muted-foreground">
                  We're happy to assist with any technical issues or questions about blood cell analysis results.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
};

export default Header;
