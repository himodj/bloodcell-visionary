import React, { useEffect, useRef } from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AnalysisResults from '../components/AnalysisResults';
import ReportPanel from '../components/ReportPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useReportActions } from '../report/useReportActions';

const Analysis: React.FC = () => {
  const { analysisResult } = useAnalysis();
  const actions = useReportActions();

  // Ctrl+P prints the report, Ctrl+Shift+P saves it as PDF, Ctrl+S saves it (also in the File menu).
  const latest = useRef(actions);
  latest.current = actions;
  useEffect(() => {
    if (!window.electron) return;
    return window.electron.onMenuCommand((command) => {
      const a = latest.current;
      if (!a.available) {
        toast.info('Open an analysis first');
        return;
      }
      if (command === 'print') void a.print();
      else if (command === 'pdf') void a.exportPdf();
      else if (command === 'save') void a.save();
    });
  }, []);

  if (!analysisResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">No Analysis Available</h2>
            <p className="text-gray-600 mb-8">Start a new analysis, or open a saved one from Search Reports.</p>
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
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Analysis Results</h1>
        <AnalysisResults />
        <ReportPanel />
      </main>
      <Footer />
    </div>
  );
};

export default Analysis;
