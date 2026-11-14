import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Circle } from 'lucide-react';
import { AnalyzedCell } from '../contexts/AnalysisContext';
import { getCellTypeColor, shortCellName } from '../utils/analysisUtils';

interface ImageWithDetectionProps {
  imageUrl: string;
  detectedCells: AnalyzedCell[];
  title: string;
  selectedCellId?: number | null;
  onSelectCell?: (cellId: number) => void;
}

const ImageWithDetection: React.FC<ImageWithDetectionProps> = ({
  imageUrl,
  detectedCells,
  title,
  selectedCellId,
  onSelectCell,
}) => {
  const many = detectedCells.length > 1;

  return (
    <div className="mb-6">
      <Card className="medical-card overflow-hidden">
        <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10 flex items-center justify-between">
          <h3 className="font-display font-medium flex items-center text-medical-dark">
            <Circle size={16} className="text-medical-blue mr-2" />
            {title}
          </h3>
          {many && <span className="text-xs text-medical-dark text-opacity-60">{detectedCells.length} cells · click a box to see its details</span>}
        </div>
        <CardContent className="p-3 text-center bg-gray-900">
          {/* the wrapper is exactly as large as the picture, so the boxes line up with the cells */}
          <div className="relative inline-block align-top max-w-full">
            <img src={imageUrl} alt="Blood film" className="block max-w-full h-auto max-h-[640px]" />
            {detectedCells.map((cell, index) => {
              const c = cell.coordinates;
              if (!c || !(c.width > 0) || c.width > 100 || c.height > 100) return null;
              const color = getCellTypeColor(cell.type);
              const selected = selectedCellId === cell.id;
              const labelBelow = c.y < 9;
              return (
                <button
                  key={cell.id}
                  type="button"
                  data-cell-box={cell.id}
                  onClick={() => onSelectCell?.(cell.id)}
                  className="absolute p-0 bg-transparent cursor-pointer"
                  style={{
                    left: `${c.x}%`,
                    top: `${c.y}%`,
                    width: `${c.width}%`,
                    height: `${c.height}%`,
                    border: `${selected ? 3 : 2}px solid ${color}`,
                    boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${color}` : '0 0 0 1px rgba(255,255,255,0.85)',
                    zIndex: selected ? 20 : 10,
                  }}
                  title={`${many ? `#${index + 1} ` : ''}${cell.type} — ${(cell.confidence * 100).toFixed(1)}%`}
                >
                  <span
                    className="absolute left-[-2px] whitespace-nowrap rounded-sm px-1 text-[11px] font-semibold leading-[16px] text-white"
                    style={{ backgroundColor: color, ...(labelBelow ? { top: '100%' } : { bottom: '100%' }) }}
                  >
                    {many ? `${index + 1} ${shortCellName(cell.type)} ${(cell.confidence * 100).toFixed(0)}%` : `${cell.type} ${(cell.confidence * 100).toFixed(1)}%`}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImageWithDetection;
