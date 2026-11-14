import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, Save, X, FileText } from 'lucide-react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { toast } from 'sonner';

const DoctorNotes: React.FC = () => {
  const { analysisResult, updateDoctorNotes } = useAnalysis();
  const [isEditing, setIsEditing] = useState(false);
  const [tempNotes, setTempNotes] = useState('');

  if (!analysisResult) return null;

  const handleEdit = () => {
    setTempNotes(analysisResult.doctorNotes || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    updateDoctorNotes(tempNotes);
    setIsEditing(false);
    toast.success('Doctor notes updated');
  };

  const handleCancel = () => {
    setTempNotes('');
    setIsEditing(false);
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Doctor Notes
          </CardTitle>
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={handleEdit}>
              <Edit3 size={14} className="mr-1" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleSave} className="text-green-600">
                <Save size={14} className="mr-1" />
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancel} className="text-red-600">
                <X size={14} className="mr-1" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={tempNotes}
            onChange={(e) => setTempNotes(e.target.value)}
            placeholder="Enter doctor notes, observations, or additional comments for this analysis..."
            rows={4}
            className="w-full"
          />
        ) : (
          <div className="min-h-[100px] p-3 border rounded-md bg-gray-50">
            {analysisResult.doctorNotes ? (
              <p className="text-gray-800 whitespace-pre-wrap">{analysisResult.doctorNotes}</p>
            ) : (
              <p className="text-gray-500 italic">No doctor notes added yet. Click edit to add notes.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DoctorNotes;