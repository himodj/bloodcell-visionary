import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Search, Settings, FileText, User, Calendar, ArrowLeft, Upload, Image } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [labInfo, setLabInfo] = useState<LabInfo>({
    labName: '',
    address: '',
    phone: '',
    hematologyDoctorName: '',
    licenseNumber: '',
    logo: '/lovable-uploads/623308ff-1ed1-4208-9ef4-41e4d60d733d.png'
  });

  useEffect(() => {
    loadReports();
    loadLabInfo();
  }, []);

  const loadReports = async () => {
    if (!window.electron) return;
    
    try {
      const result = await window.electron.getPatientReports();
      if (result.success) {
        setReports(result.reports);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

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

  const openReport = async (report: PatientReport) => {
    if (!window.electron) return;
    
    try {
      await window.electron.openReportFolder(report.folderPath);
    } catch (error) {
      console.error('Error opening report:', error);
      toast.error('Failed to open report folder');
    }
  };

  const filteredReports = reports.filter(report =>
    report.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.cellType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img 
              src="/lovable-uploads/623308ff-1ed1-4208-9ef4-41e4d60d733d.png" 
              alt="BloodCellVision Logo" 
              className="h-12 w-12"
            />
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

        {/* Patient Reports Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Patient Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by patient name or cell type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredReports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {reports.length === 0 ? 'No reports found' : 'No reports match your search'}
                </div>
              ) : (
                filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => openReport(report)}
                  >
                    <div className="flex items-center gap-4">
                      <User className="h-8 w-8 text-gray-400" />
                      <div>
                        <h3 className="font-medium">{report.patientName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{report.cellType}</Badge>
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {report.reportDate}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Open Report
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Management;