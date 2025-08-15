import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Edit3, Save, X } from 'lucide-react';
import { CellType } from '../contexts/AnalysisContext';
import { toast } from 'sonner';

interface EditableCellTypeProps {
  cellType: CellType;
  confidence: number;
  onCellTypeChange: (newType: CellType) => void;
}

const CELL_TYPES: CellType[] = [
  'IG Immature White Cell',
  'Basophil',
  'Eosinophil',
  'Erythroblast',
  'Lymphocyte',
  'Monocyte',
  'Neutrophil',
  'Platelet'
];

const EditableCellType: React.FC<EditableCellTypeProps> = ({
  cellType,
  confidence,
  onCellTypeChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempCellType, setTempCellType] = useState<CellType>(cellType);
  const [showSubtype, setShowSubtype] = useState(false);
  const [subtype, setSubtype] = useState('');

  const handleSave = () => {
    onCellTypeChange(tempCellType);
    setIsEditing(false);
    toast.success('Cell type updated');
  };

  const handleCancel = () => {
    setTempCellType(cellType);
    setShowSubtype(false);
    setSubtype('');
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="py-3 flex justify-between items-center">
        <span className="text-sm text-medical-dark text-opacity-70">Cell Type:</span>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <span className="font-medium text-medical-dark">{cellType}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="text-xs h-6 w-6 p-0"
              >
                <Edit3 size={12} />
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={tempCellType}
                onChange={(e) => setTempCellType(e.target.value as CellType)}
                className="text-sm border rounded px-2 py-1 min-w-[150px]"
              >
                {CELL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSave}
                className="text-xs text-green-600 h-6 w-6 p-0"
              >
                <Save size={12} />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCancel}
                className="text-xs text-red-600 h-6 w-6 p-0"
              >
                <X size={12} />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="py-3 flex justify-between items-center">
        <span className="text-sm text-medical-dark text-opacity-70">Confidence:</span>
        <span className="font-medium text-medical-dark">
          {(confidence * 100).toFixed(1)}%
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="subtype-checkbox"
            checked={showSubtype}
            onCheckedChange={(checked) => setShowSubtype(!!checked)}
          />
          <Label htmlFor="subtype-checkbox" className="text-sm">
            Add subtype specification
          </Label>
        </div>
        
        {showSubtype && (
          <div>
            <Label htmlFor="subtype-input" className="text-sm text-medical-dark text-opacity-70">
              Subtype:
            </Label>
            <Input
              id="subtype-input"
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              placeholder="Enter cell subtype..."
              className="mt-1"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableCellType;