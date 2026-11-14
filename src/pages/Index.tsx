import React, { useEffect } from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ImageUploader from '../components/ImageUploader';
import ModelLoader from '../components/ModelLoader';
import PatientInfo from '../components/PatientInfoForm';
import { Button } from '@/components/ui/button';
import { Settings, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Index: React.FC = () => {
  const { isAnalyzing, patientInfo, updatePatientInfo, analysisResult } = useAnalysis();
  const navigate = useNavigate();
  
  // Automatically navigate to analysis page when analysis is completed
  useEffect(() => {
    if (analysisResult && !isAnalyzing) {
      navigate('/analysis');
    }
  }, [analysisResult, isAnalyzing, navigate]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center mb-12">
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
      </main>
      <Footer />
    </div>
  );
};

export default Index;