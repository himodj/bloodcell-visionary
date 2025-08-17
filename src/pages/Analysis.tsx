import React from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AnalysisResults from '../components/AnalysisResults';
import FormalReportGeneratorNew from '../components/FormalReportGeneratorNew';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Analysis: React.FC = () => {
  const { analysisResult } = useAnalysis();
  
  if (!analysisResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">No Analysis Available</h2>
            <p className="text-gray-600 mb-8">Please start a new analysis to view results.</p>
            <Link to="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Analysis
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Analysis
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">Analysis Results</h1>
        </div>
        
        <AnalysisResults />
        <FormalReportGeneratorNew />
      </main>
      <Footer />
    </div>
  );
};

export default Analysis;