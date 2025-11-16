import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Settings, ArrowLeft, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface PatientReport {
  id: string;
  patientName: string;
  cellType: string;
  reportDate: string;
  folderPath: string;
}

interface LabInfo {
  labName: string;
  address: string;
  phone: string;
  hematologyDoctorName: string;
  licenseNumber: string;
  logo: string;
}

const Management: React.FC = () => {
  const [labInfo, setLabInfo] = useState<LabInfo>({
    labName: '',
    address: '',
    phone: '',
    hematologyDoctorName: '',
    licenseNumber: '',
    logo: ''
  });

  useEffect(() => {
    loadLabInfo();
  }, []);


  const loadLabInfo = () => {
    const savedLabInfo = localStorage.getItem('labConfiguration');
    if (savedLabInfo) {
      setLabInfo(JSON.parse(savedLabInfo));
    }
  };

  const saveLabInfo = () => {
    localStorage.setItem('labConfiguration', JSON.stringify(labInfo));
    toast.success('Lab information saved successfully');
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setLabInfo({ ...labInfo, logo: result });
      };
      reader.readAsDataURL(file);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl font-bold">
              <span className="text-gray-800">BloodCell</span>
              <span style={{ color: '#D21A1A' }}>Vision</span>
            </h1>
          </div>
          <p className="text-gray-600">Laboratory Management System</p>
          <div className="mt-4">
            <Link to="/">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Analysis
              </Button>
            </Link>
          </div>
        </div>

        {/* Lab Information Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Lab Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="labName">Laboratory Name</Label>
                <Input
                  id="labName"
                  value={labInfo.labName}
                  onChange={(e) => setLabInfo({ ...labInfo, labName: e.target.value })}
                  placeholder="Enter laboratory name"
                />
              </div>
              <div>
                <Label htmlFor="doctorName">Hematology Doctor</Label>
                <Input
                  id="doctorName"
                  value={labInfo.hematologyDoctorName}
                  onChange={(e) => setLabInfo({ ...labInfo, hematologyDoctorName: e.target.value })}
                  placeholder="Enter doctor name"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={labInfo.phone}
                  onChange={(e) => setLabInfo({ ...labInfo, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="license">License Number</Label>
                <Input
                  id="license"
                  value={labInfo.licenseNumber}
                  onChange={(e) => setLabInfo({ ...labInfo, licenseNumber: e.target.value })}
                  placeholder="Enter license number"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={labInfo.address}
                onChange={(e) => setLabInfo({ ...labInfo, address: e.target.value })}
                placeholder="Enter laboratory address"
                rows={3}
              />
            </div>
            
            {/* Lab Logo Upload */}
            <div>
              <Label htmlFor="logo">Lab Logo</Label>
              <div className="flex items-center gap-4 mt-2">
                {labInfo.logo && (
                  <img 
                    src={labInfo.logo} 
                    alt="Lab Logo" 
                    className="h-16 w-16 object-contain border rounded"
                  />
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload">
                    <Button variant="outline" className="cursor-pointer" asChild>
                      <span className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload Logo
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>

            <Button onClick={saveLabInfo} className="mt-4">
              Save Lab Information
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Management;