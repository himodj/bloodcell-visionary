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
                {/* Red bounding box - square and positioned on detected cell */}
                <div
                  className="absolute border-2 border-red-500 bg-red-500 bg-opacity-10"
                  style={{
                    left: primaryCell.coordinates ? `${primaryCell.coordinates.x}%` : '37.5%',
                    top: primaryCell.coordinates ? `${primaryCell.coordinates.y}%` : '37.5%',
                    width: primaryCell.coordinates ? `${primaryCell.coordinates.width}%` : '25%',
                    height: primaryCell.coordinates ? `${primaryCell.coordinates.height}%` : '25%',
                    aspectRatio: '1',
                  }}
                >
                  {/* Label positioned to stay within image bounds */}
                  <div className="absolute bg-red-500 text-white px-2 py-1 text-xs font-medium rounded shadow-lg whitespace-nowrap z-10"
                       style={{
                         top: primaryCell.coordinates && primaryCell.coordinates.y < 15 ? '100%' : '-25px',
                         left: '50%',
                         transform: 'translateX(-50%)',
                         marginTop: primaryCell.coordinates && primaryCell.coordinates.y < 15 ? '2px' : '0'
                       }}>
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