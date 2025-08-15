import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Circle } from 'lucide-react';
import { AnalyzedCell } from '../contexts/AnalysisContext';

interface ImageWithDetectionProps {
  imageUrl: string;
  detectedCells: AnalyzedCell[];
  title: string;
}

const ImageWithDetection: React.FC<ImageWithDetectionProps> = ({
  imageUrl,
  detectedCells,
  title,
}) => {
  const primaryCell = detectedCells.length > 0 ? detectedCells[0] : null;

  return (
    <div className="mb-6">
      <Card className="medical-card overflow-hidden">
        <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10">
          <h3 className="font-display font-medium flex items-center text-medical-dark">
            <Circle size={16} className="text-medical-blue mr-2" />
            {title}
          </h3>
        </div>
        <CardContent className="p-0 relative">
          <div className="relative inline-block w-full">
            <img 
              src={imageUrl} 
              alt="Blood Sample Analysis" 
              className="w-full h-auto object-contain max-h-96"
            />
            
            {/* Detection overlay */}
            {primaryCell && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Red bounding box - centered with proper positioning */}
                <div
                  className="absolute border-2 border-red-500 bg-red-500 bg-opacity-10"
                  style={{
                    left: '35%',
                    top: '35%',
                    width: '30%',
                    height: '30%',
                  }}
                >
                  {/* Label on top of the box - positioned to stay within image */}
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-2 py-1 text-xs font-medium rounded shadow-lg whitespace-nowrap z-10">
                    {primaryCell.type}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImageWithDetection;