
import React from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatNumber, determineSeverity, getCellTypeColor } from '../utils/analysisUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AlertTriangle, Droplet, Circle } from 'lucide-react';

const AnalysisResults: React.FC = () => {
  const { analysisResult } = useAnalysis();
  
  if (!analysisResult) return null;

  const { cellCounts, abnormalityRate, possibleConditions } = analysisResult;
  const severity = determineSeverity(abnormalityRate);
  
  const pieData = [
    { name: 'Normal RBC', value: cellCounts.normal.rbc, color: getCellTypeColor('RBC') },
    { name: 'Normal Platelets', value: cellCounts.normal.platelets, color: getCellTypeColor('Platelet') },
    { name: 'Abnormal RBC', value: cellCounts.abnormal.rbc, color: getCellTypeColor('Abnormal') },
    { name: 'Abnormal Platelets', value: cellCounts.abnormal.platelets, color: '#FF9500' }
  ];
  
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      normal: '#34C759',
      mild: '#FFCC00',
      moderate: '#FF9500',
      severe: '#FF3B30'
    };
    return colors[severity] || colors.normal;
  };

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="medical-card overflow-hidden">
          <div className="p-4 bg-medical-red bg-opacity-5 border-b border-medical-red border-opacity-10">
            <h3 className="font-display font-medium flex items-center text-medical-dark">
              <Droplet size={16} className="text-medical-red mr-2" />
              Blood Cell Analysis
            </h3>
          </div>
          <CardContent className="p-4">
            <div className="flex flex-col divide-y">
              <div className="py-3 flex justify-between items-center">
                <span className="text-sm text-medical-dark text-opacity-70">Total cells analyzed:</span>
                <span className="font-medium text-medical-dark">{formatNumber(cellCounts.total)}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-sm text-medical-dark text-opacity-70">Normal RBCs:</span>
                <span className="font-medium text-medical-dark">{formatNumber(cellCounts.normal.rbc)}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-sm text-medical-dark text-opacity-70">Normal Platelets:</span>
                <span className="font-medium text-medical-dark">{formatNumber(cellCounts.normal.platelets)}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-sm text-medical-dark text-opacity-70">Abnormal RBCs:</span>
                <span className="font-medium text-medical-red">{formatNumber(cellCounts.abnormal.rbc)}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-sm text-medical-dark text-opacity-70">Abnormal Platelets:</span>
                <span className="font-medium text-medical-red">{formatNumber(cellCounts.abnormal.platelets)}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-sm text-medical-dark text-opacity-70">Abnormality rate:</span>
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: getSeverityColor(severity) }} 
                  ></div>
                  <span 
                    className="font-medium"
                    style={{ color: getSeverityColor(severity) }}
                  >
                    {abnormalityRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="medical-card overflow-hidden">
          <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10">
            <h3 className="font-display font-medium flex items-center text-medical-dark">
              <Circle size={16} className="text-medical-blue mr-2" />
              Cell Distribution
            </h3>
          </div>
          <CardContent className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={1}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [formatNumber(value), 'Count']}
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    backgroundColor: 'white',
                    padding: '8px 12px'
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center" 
                  layout="horizontal"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingTop: '20px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {abnormalityRate > 5 && (
        <Card className="medical-card overflow-hidden mb-6 border-l-4" style={{ borderLeftColor: getSeverityColor(severity) }}>
          <div className="p-4 bg-opacity-5 flex items-center" style={{ backgroundColor: `${getSeverityColor(severity)}20` }}>
            <AlertTriangle size={18} style={{ color: getSeverityColor(severity) }} className="mr-2" />
            <h3 className="font-display font-medium text-medical-dark">Possible Conditions</h3>
          </div>
          <CardContent className="p-4">
            <ul className="list-disc pl-6 space-y-2">
              {possibleConditions.map((condition, index) => (
                <li key={index} className="text-medical-dark">
                  {condition}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalysisResults;
