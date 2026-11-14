import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ReportTemplateDesigner from '../components/ReportTemplateDesigner';

const ReportTemplate: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-medical-light">
      <Header />
      <main className="flex-1">
        <ReportTemplateDesigner />
      </main>
      <Footer />
    </div>
  );
};

export default ReportTemplate;
