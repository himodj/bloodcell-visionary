import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Calendar, FileText, Edit3, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export interface PatientInfo {
  name: string;
  age: string;
  gender: string;
  sampleType: string;
  clinicalNotes: string;
}

interface PatientInfoFormProps {
  patientInfo: PatientInfo;
  onPatientInfoChange: (info: PatientInfo) => void;
}

const PatientInfoForm: React.FC<PatientInfoFormProps> = ({
  patientInfo,
  onPatientInfoChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(patientInfo);

  const handleInputChange = (field: keyof PatientInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onPatientInfoChange(formData);
    setIsEditing(false);
    toast.success('Patient information updated');
  };

  const handleCancel = () => {
    setFormData(patientInfo);
    setIsEditing(false);
  };

  return (
    <Card className="medical-card overflow-hidden mb-6">
      <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10 flex items-center justify-between">
        <h3 className="font-display font-medium flex items-center text-medical-dark">
          <User size={16} className="text-medical-blue mr-2" />
          Patient Information
        </h3>
        {!isEditing ? (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(true)}
            className="text-xs"
          >
            <Edit3 size={14} className="mr-1" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSave}
              className="text-xs text-green-600"
            >
              <Save size={14} className="mr-1" />
              Save
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleCancel}
              className="text-xs text-red-600"
            >
              <X size={14} className="mr-1" />
              Cancel
            </Button>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="patient-name">Patient Name</Label>
            {isEditing ? (
              <Input
                id="patient-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter patient name"
              />
            ) : (
              <div className="p-2 bg-gray-50 rounded min-h-[40px] flex items-center">
                {patientInfo.name || 'Not specified'}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="patient-age">Age</Label>
            {isEditing ? (
              <Input
                id="patient-age"
                value={formData.age}
                onChange={(e) => handleInputChange('age', e.target.value)}
                placeholder="Enter age"
              />
            ) : (
              <div className="p-2 bg-gray-50 rounded min-h-[40px] flex items-center">
                {patientInfo.age || 'Not specified'}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="patient-gender">Gender</Label>
            {isEditing ? (
              <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2 bg-gray-50 rounded min-h-[40px] flex items-center">
                {patientInfo.gender || 'Not specified'}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="sample-type">Sample Type</Label>
            {isEditing ? (
              <Select value={formData.sampleType} onValueChange={(value) => handleInputChange('sampleType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sample type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Blood Sample">Blood Sample</SelectItem>
                  <SelectItem value="Bone Marrow">Bone Marrow</SelectItem>
                  <SelectItem value="Peripheral Blood">Peripheral Blood</SelectItem>
                  <SelectItem value="CSF">CSF</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2 bg-gray-50 rounded min-h-[40px] flex items-center">
                {patientInfo.sampleType || 'Blood Sample'}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="clinical-notes">Clinical Notes</Label>
          {isEditing ? (
            <Textarea
              id="clinical-notes"
              value={formData.clinicalNotes}
              onChange={(e) => handleInputChange('clinicalNotes', e.target.value)}
              placeholder="Enter any relevant clinical notes..."
              className="mt-1"
              rows={3}
            />
          ) : (
            <div className="p-2 bg-gray-50 rounded min-h-[60px] mt-1">
              {patientInfo.clinicalNotes || 'No clinical notes provided'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PatientInfoForm;