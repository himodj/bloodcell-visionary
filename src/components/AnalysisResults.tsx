
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
                <span className="text-sm text-medical-dark text-opacity-70">Cell detected:</span>
                <span className="font-medium text-medical-dark">{detectedCells.length > 0 ? detectedCells[0].type : "None"}</span>
              </div>
              
              <div className="py-3 flex justify-between items-center">
                <span className="text-sm text-medical-dark text-opacity-70">Confidence:</span>
                <span className="font-medium text-medical-dark">
                  {detectedCells.length > 0 ? `${(detectedCells[0].confidence * 100).toFixed(1)}%` : "N/A"}
                </span>
              </div>
              
              <div className="py-3 flex justify-between items-center">
                <span className="text-sm text-medical-dark text-opacity-70">Analysis Date:</span>
                <span className="font-medium text-medical-dark">
                  {analysisResult.analysisDate.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="medical-card overflow-hidden">
          <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10">
            <h3 className="font-display font-medium flex items-center text-medical-dark">
              <Circle size={16} className="text-medical-blue mr-2" />
              Cell Classification
            </h3>
          </div>
          <CardContent className="p-4 h-[300px]">
            {detectedCells.length > 0 ? (
              <div className="flex flex-col h-full justify-center items-center">
                <div 
                  className="w-24 h-24 rounded-full mb-4 flex items-center justify-center text-white text-lg font-bold"
                  style={{ backgroundColor: getCellTypeColor(detectedCells[0].type) }}
                >
                  {detectedCells[0].type.charAt(0)}
                </div>
                <h3 className="text-xl font-medium mb-2">{detectedCells[0].type}</h3>
                <p className="text-medical-dark text-opacity-70">
                  Confidence: {(detectedCells[0].confidence * 100).toFixed(1)}%
                </p>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-medical-dark text-opacity-70">No cell detected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {detectedCells.length > 0 && (
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
      
      {detectedCells.length > 0 && (
        <Card className="medical-card overflow-hidden mb-6">
          <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10 flex items-center justify-between">
            <h3 className="font-display font-medium flex items-center text-medical-dark">
              <Circle size={16} className="text-medical-blue mr-2" />
              Recommendations
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
      )}
    </div>
  );
};

export default AnalysisResults;
