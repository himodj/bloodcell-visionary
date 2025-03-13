
import React from 'react';
import { AnalysisProvider, useAnalysis } from '../contexts/AnalysisContext';
import Header from '../components/Header';
import ImageUploader from '../components/ImageUploader';
import AnalysisResults from '../components/AnalysisResults';
import ReportGenerator from '../components/ReportGenerator';
import Footer from '../components/Footer';

const AnalysisWorkflow: React.FC = () => {
  const { analysisResult, isAnalyzing } = useAnalysis();
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-medical-neutral to-white">
      <Header />
      
      <main className="container mx-auto px-4 flex-1 max-w-6xl">
        {!analysisResult && <ImageUploader />}
        
        {isAnalyzing && (
          <div className="w-full max-w-xl mx-auto text-center py-10 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-2 border-medical-blue border-opacity-20"></div>
              <div className="absolute inset-0 rounded-full border-2 border-medical-blue border-l-transparent animate-spin"></div>
            </div>
            <h3 className="text-xl font-display font-medium mb-2">Analyzing Blood Sample</h3>
            <p className="text-medical-dark text-opacity-70">
              Our CNN model is processing the image to identify and classify blood cells...
            </p>
          </div>
        )}
        
        {analysisResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="medical-card overflow-hidden mb-6 animate-slide-up">
                <img
                  src={analysisResult.image || ''}
                  alt="Blood Sample"
                  className="w-full h-auto object-contain bg-black"
                />
              </div>
              <AnalysisResults />
            </div>
            <div>
              <ReportGenerator />
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

const Index: React.FC = () => {
  return (
    <AnalysisProvider>
      <AnalysisWorkflow />
    </AnalysisProvider>
  );
};

export default Index;
