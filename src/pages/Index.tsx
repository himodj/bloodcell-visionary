import React from 'react';
import { AnalysisProvider, useAnalysis } from '../contexts/AnalysisContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ImageUploader from '../components/ImageUploader';
import ModelLoader from '../components/ModelLoader';
import AnalysisResults from '../components/AnalysisResults';
import PatientInfo from '../components/PatientInfoForm';
import FormalReportGeneratorNew from '../components/FormalReportGeneratorNew';
import { Button } from '@/components/ui/button';
import { Settings, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

const AnalysisWorkflow: React.FC = () => {
  const { analysisResult, isAnalyzing, patientInfo, updatePatientInfo } = useAnalysis();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img 
              src="/lovable-uploads/623308ff-1ed1-4208-9ef4-41e4d60d733d.png" 
              alt="BloodCellVision Logo" 
              className="h-12 w-12"
            />
            <h1 className="text-4xl font-bold">
              <span className="text-gray-800">BloodCell</span>
              <span style={{ color: '#D21A1A' }}>Vision</span>
            </h1>
          </div>
          <div className="mt-4 flex gap-4 justify-center">
            <Link to="/management">
              <Button variant="outline" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Lab Management
              </Button>
            </Link>
            <Link to="/search">
              <Button variant="outline" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Search Reports
              </Button>
            </Link>
          </div>
        </div>

        <ModelLoader />
        
        <PatientInfo 
          patientInfo={patientInfo} 
          onPatientInfoChange={updatePatientInfo} 
        />
        
        <ImageUploader />
        
        {isAnalyzing && (
          <div className="w-full max-w-xl mx-auto text-center py-10 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-opacity-20"></div>
              <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-l-transparent animate-spin"></div>
            </div>
            <h3 className="text-xl font-semibold mb-2">Analyzing Blood Sample</h3>
            <p className="text-gray-600">
              Detecting and classifying blood cells...
            </p>
          </div>
        )}
        
        {analysisResult && (
          <div className="space-y-8">
            <AnalysisResults />
            <FormalReportGeneratorNew />
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