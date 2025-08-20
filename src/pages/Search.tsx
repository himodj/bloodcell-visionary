import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, Calendar, ArrowLeft, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';

interface PatientReport {
  id: string;
  patientName: string;
  cellType: string;
  reportDate: string;
  folderPath: string;
  age?: string;
  gender?: string;
}

const SearchPage: React.FC = () => {
  console.log('SearchPage component rendering...');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [ageFilter, setAgeFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    console.log('SearchPage useEffect running...');
    loadReports();
  }, []);

  const loadReports = async () => {
    console.log('loadReports called, window.electron:', !!window.electron);
    
    if (!window.electron) {
      console.log('No electron API, using mock data');
      setReports([
        {
          id: '1',
          patientName: 'John Doe',
          cellType: 'Red Blood Cell',
          reportDate: '2024-01-15',
          folderPath: '/mock/path',
          age: '35',
          gender: 'Male'
        }
      ]);
      return;
    }
    
    try {
      console.log('Calling electron.getPatientReports...');
      const result = await window.electron.getPatientReports();
      console.log('Reports result:', result);
      if (result.success) {
        setReports(result.reports);
        console.log('Reports set:', result.reports.length);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  const openReport = async (report: PatientReport) => {
    if (!window.electron) return;
    
    try {
      const result = await window.electron.loadAnalysisFromReport(report.folderPath);
      if (result.success) {
        // Navigate to analysis page with the loaded analysis
        navigate('/analysis', { state: { loadedAnalysis: result.analysis } });
        toast.success('Analysis loaded successfully');
      } else {
        toast.error('Failed to load analysis data');
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
      toast.error('Failed to load analysis');
    }
  };

  const viewReport = async (report: PatientReport) => {
    if (!window.electron) return;
    
    try {
      await window.electron.openReportFolder(report.folderPath);
    } catch (error) {
      console.error('Error opening report:', error);
      toast.error('Failed to open report folder');
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.cellType.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAge = !ageFilter || (report.age && report.age.includes(ageFilter));
    const matchesGender = !genderFilter || report.gender === genderFilter;
    const matchesDate = !dateFilter || report.reportDate.includes(dateFilter);
    
    return matchesSearch && matchesAge && matchesGender && matchesDate;
  });

  console.log('About to render SearchPage, reports count:', reports.length);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
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
          <p className="text-gray-600">Search & Reopen Analysis Reports</p>
          <div className="mt-4">
            <Link to="/">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Analysis
              </Button>
            </Link>
          </div>
        </div>

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Patient Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by patient name or cell type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Filters */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Filters:</span>
                </div>
                <Select value={genderFilter} onValueChange={setGenderFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Genders</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Age"
                  value={ageFilter}
                  onChange={(e) => setAgeFilter(e.target.value)}
                  className="w-24"
                />
                <Input
                  placeholder="Date (YYYY-MM-DD)"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-40"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setAgeFilter('');
                    setGenderFilter('');
                    setDateFilter('');
                    setSearchQuery('');
                  }}
                >
                  Clear Filters
                </Button>
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
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <User className="h-8 w-8 text-gray-400" />
                      <div>
                        <h3 className="font-medium">{report.patientName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{report.cellType}</Badge>
                          {report.age && <Badge variant="secondary">Age: {report.age}</Badge>}
                          {report.gender && <Badge variant="secondary">{report.gender}</Badge>}
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {report.reportDate}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        onClick={() => openReport(report)}
                        style={{ backgroundColor: '#D21A1A', color: 'white' }}
                        className="hover:opacity-90"
                      >
                        Reopen Analysis
                      </Button>
                    </div>
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

export default SearchPage;