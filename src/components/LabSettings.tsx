import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Building2, Edit3, Save, X, Upload } from 'lucide-react';
import { toast } from 'sonner';

export interface LabConfiguration {
  labName: string;
  address: string;
  phone: string;
  hematologyDoctorName: string;
  licenseNumber: string;
  logo: string | null;
}

interface LabSettingsProps {
  onConfigurationChange: (config: LabConfiguration) => void;
}

const LabSettings: React.FC<LabSettingsProps> = ({ onConfigurationChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [config, setConfig] = useState<LabConfiguration>({
    labName: '',
    address: '',
    phone: '',
    hematologyDoctorName: '',
    licenseNumber: '',
    logo: null
  });

  // Load configuration from localStorage on component mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('labConfiguration');
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      setConfig(parsedConfig);
      onConfigurationChange(parsedConfig);
    }
  }, [onConfigurationChange]);

  const handleInputChange = (field: keyof LabConfiguration, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const logoDataUrl = e.target?.result as string;
        setConfig(prev => ({
          ...prev,
          logo: logoDataUrl
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('labConfiguration', JSON.stringify(config));
    onConfigurationChange(config);
    setIsEditing(false);
    toast.success('Lab configuration saved');
  };

  const handleCancel = () => {
    const savedConfig = localStorage.getItem('labConfiguration');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
    setIsEditing(false);
  };

  return (
    <Card className="medical-card overflow-hidden mb-6">
      <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10 flex items-center justify-between">
        <h3 className="font-display font-medium flex items-center text-medical-dark">
          <Building2 size={16} className="text-medical-blue mr-2" />
          Laboratory Configuration
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
            <Label htmlFor="lab-name">Laboratory Name</Label>
            {isEditing ? (
              <Input
                id="lab-name"
                value={config.labName}
                onChange={(e) => handleInputChange('labName', e.target.value)}
                placeholder="Enter laboratory name"
              />
            ) : (
              <div className="p-2 bg-gray-50 rounded min-h-[40px] flex items-center">
                {config.labName || 'Not configured'}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="hematology-doctor">Hematology Doctor</Label>
            {isEditing ? (
              <Input
                id="hematology-doctor"
                value={config.hematologyDoctorName}
                onChange={(e) => handleInputChange('hematologyDoctorName', e.target.value)}
                placeholder="Enter doctor name"
              />
            ) : (
              <div className="p-2 bg-gray-50 rounded min-h-[40px] flex items-center">
                {config.hematologyDoctorName || 'Not configured'}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            {isEditing ? (
              <Input
                id="address"
                value={config.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Enter lab address"
              />
            ) : (
              <div className="p-2 bg-gray-50 rounded min-h-[40px] flex items-center">
                {config.address || 'Not configured'}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            {isEditing ? (
              <Input
                id="phone"
                value={config.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter phone number"
              />
            ) : (
              <div className="p-2 bg-gray-50 rounded min-h-[40px] flex items-center">
                {config.phone || 'Not configured'}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="license-number">License Number</Label>
            {isEditing ? (
              <Input
                id="license-number"
                value={config.licenseNumber}
                onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                placeholder="Enter license number"
              />
            ) : (
              <div className="p-2 bg-gray-50 rounded min-h-[40px] flex items-center">
                {config.licenseNumber || 'Not configured'}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="lab-logo">Laboratory Logo</Label>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  id="lab-logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('lab-logo')?.click()}
                  className="w-full"
                >
                  <Upload size={14} className="mr-2" />
                  Upload Logo
                </Button>
                {config.logo && (
                  <div className="mt-2">
                    <img src={config.logo} alt="Lab Logo" className="h-12 object-contain" />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2 bg-gray-50 rounded min-h-[40px] flex items-center">
                {config.logo ? (
                  <img src={config.logo} alt="Lab Logo" className="h-8 object-contain" />
                ) : (
                  'No logo uploaded'
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LabSettings;