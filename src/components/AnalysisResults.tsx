
import React from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatNumber, determineSeverity, getCellTypeColor } from '../utils/analysisUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AlertTriangle, Droplet, Circle, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const AnalysisResults: React.FC = () => {
  const { analysisResult, updateRecommendations, updatePossibleConditions } = useAnalysis();
  
  if (!analysisResult) return null;

  const { cellCounts, abnormalityRate, possibleConditions, detectedCells, processedImage } = analysisResult;
  const severity = determineSeverity(abnormalityRate);
  
  // Prepare data for pie chart - using detected cell types
  const pieData = Object.entries(cellCounts.detectedCells).map(([type, count]) => ({
    name: type,
    value: count,
    color: getCellTypeColor(type)
  })).filter(item => item.value > 0);
  
  // Calculate average confidence level
  const avgConfidence = detectedCells.length > 0
    ? (detectedCells.reduce((sum, cell) => sum + cell.confidence, 0) / detectedCells.length * 100).toFixed(1)
    : "N/A";
  
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      normal: '#34C759',
      mild: '#FFCC00',
      moderate: '#FF9500',
      severe: '#FF3B30'
    };
    return colors[severity] || colors.normal;
  };

  const handleEditRecommendations = () => {
    // Simple prompt for editing recommendations
    const currentRecs = analysisResult.recommendations.join('\n');
    const newRecs = prompt('Edit recommendations (one per line):', currentRecs);
    
    if (newRecs !== null) {
      const recArray = newRecs.split('\n').filter(rec => rec.trim() !== '');
      updateRecommendations(recArray);
      toast.success('Recommendations updated');
    }
  };

  const handleEditConditions = () => {
    // Simple prompt for editing conditions
    const currentConditions = analysisResult.possibleConditions.join('\n');
    const newConditions = prompt('Edit possible conditions (one per line):', currentConditions);
    
    if (newConditions !== null) {
      const conditionArray = newConditions.split('\n').filter(cond => cond.trim() !== '');
      updatePossibleConditions(conditionArray);
      toast.success('Conditions updated');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Card className="medical-card overflow-hidden">
          <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10">
            <h3 className="font-display font-medium flex items-center text-medical-dark">
              <Circle size={16} className="text-medical-blue mr-2" />
              Processed Image with Cell Detection
            </h3>
          </div>
          <CardContent className="p-0">
            {processedImage && (
              <img 
                src={processedImage} 
                alt="Processed Blood Sample" 
                className="w-full h-auto object-contain"
              />
            )}
          </CardContent>
        </Card>
      </div>
      
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
              
              {/* Display all detected cell types */}
              {Object.entries(cellCounts.detectedCells)
                .filter(([_, count]) => count > 0)
                .sort(([_, countA], [__, countB]) => countB - countA)
                .map(([cellType, count], index) => (
                  <div key={index} className="py-3 flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: getCellTypeColor(cellType) }}></div>
                      <span className="text-sm text-medical-dark text-opacity-70">{cellType}:</span>
                    </div>
                    <span className="font-medium text-medical-dark">{formatNumber(count)}</span>
                  </div>
                ))
              }
              
              <div className="py-3 flex justify-between items-center">
                <span className="text-sm text-medical-dark text-opacity-70">Analysis Confidence:</span>
                <span className="font-medium text-medical-dark">{avgConfidence}%</span>
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
      
      <Card className="medical-card overflow-hidden mb-6 border-l-4" style={{ borderLeftColor: getSeverityColor(severity) }}>
        <div className="p-4 bg-opacity-5 flex items-center justify-between" style={{ backgroundColor: `${getSeverityColor(severity)}20` }}>
          <div className="flex items-center">
            <AlertTriangle size={18} style={{ color: getSeverityColor(severity) }} className="mr-2" />
            <h3 className="font-display font-medium text-medical-dark">Detected Cell Types</h3>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {detectedCells.length > 0 ? (
              detectedCells
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 10)
                .map((cell, index) => (
                  <div key={index} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: getCellTypeColor(cell.type) }}
                    ></div>
                    <span className="text-medical-dark">
                      {cell.type} - {(cell.confidence * 100).toFixed(1)}% confidence
                    </span>
                  </div>
                ))
            ) : (
              <p className="text-medical-dark text-opacity-70">No specific cells detected</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {abnormalityRate > 0 && (
        <Card className="medical-card overflow-hidden mb-6 border-l-4" style={{ borderLeftColor: getSeverityColor(severity) }}>
          <div className="p-4 bg-opacity-5 flex items-center justify-between" style={{ backgroundColor: `${getSeverityColor(severity)}20` }}>
            <div className="flex items-center">
              <AlertTriangle size={18} style={{ color: getSeverityColor(severity) }} className="mr-2" />
              <h3 className="font-display font-medium text-medical-dark">Possible Conditions</h3>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleEditConditions}
              className="text-xs"
            >
              <Edit3 size={14} className="mr-1" />
              Edit
            </Button>
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
      
      <Card className="medical-card overflow-hidden mb-6">
        <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10 flex items-center justify-between">
          <h3 className="font-display font-medium flex items-center text-medical-dark">
            <Circle size={16} className="text-medical-blue mr-2" />
            Cell-Specific Recommendations
          </h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleEditRecommendations}
            className="text-xs"
          >
            <Edit3 size={14} className="mr-1" />
            Edit
          </Button>
        </div>
        <CardContent className="p-4">
          <ul className="list-disc pl-6 space-y-2">
            {analysisResult.recommendations.map((recommendation, index) => (
              <li key={index} className="text-medical-dark">
                {recommendation}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalysisResults;
