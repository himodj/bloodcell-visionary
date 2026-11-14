import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, User, Calendar, ArrowLeft, Filter, FolderOpen, Trash2, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAnalysis } from '../contexts/AnalysisContext';

const SearchPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [reports, setReports] = useState<BcvArchiveEntry[]>([]);
  const [archiveDir, setArchiveDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<BcvArchiveEntry | null>(null);
  const navigate = useNavigate();
  const { openArchivedReport, reportMeta, resetAnalysis } = useAnalysis();

  const loadReports = async () => {
    if (!window.electron) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await window.electron.archiveList();
      setReports(result.reports || []);
      setArchiveDir(result.archiveDir || '');
      if (!result.success && result.error) toast.error(`The archive could not be read: ${result.error}`);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('The archive could not be read');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  const openReport = async (report: BcvArchiveEntry) => {
    setOpening(report.id);
    const ok = await openArchivedReport(report.folderPath);
    setOpening(null);
    if (ok) {
      toast.success(`Report ${report.reportId} opened`);
      navigate('/analysis');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete || !window.electron) return;
    const report = toDelete;
    setToDelete(null);
    // a report that is open on the results page must not be re-saved after it is deleted
    if (reportMeta?.folderPath === report.folderPath) resetAnalysis();
    const result = await window.electron.archiveDelete(report.folderPath);
    if (result.success) {
      toast.success(`Report ${report.reportId} moved to the Recycle Bin`);
      setReports((list) => list.filter((r) => r.id !== report.id));
    } else {
      toast.error(`Could not delete the report: ${result.error}`);
    }
  };

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((report) => {
      const haystack = `${report.patientName} ${report.patientId} ${report.reportId} ${report.summary}`.toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesGender = genderFilter === 'all' || report.gender === genderFilter;
      const matchesDate = !dateFilter || format(new Date(report.createdAt), 'yyyy-MM-dd') === format(dateFilter, 'yyyy-MM-dd');
      return matchesSearch && matchesGender && matchesDate;
    });
  }, [reports, searchQuery, genderFilter, dateFilter]);

  const hasFilters = !!searchQuery || genderFilter !== 'all' || !!dateFilter;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl font-bold">
              <span className="text-gray-800">BloodCell</span>
              <span style={{ color: '#D21A1A' }}>Vision</span>
            </h1>
          </div>
          <p className="text-gray-600">Report Archive: search, reopen and edit saved analyses</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Analysis
              </Button>
            </Link>
            <Button variant="outline" className="flex items-center gap-2" onClick={() => window.electron?.openReportsDir()}>
              <FolderOpen className="h-4 w-4" />
              Open Archive Folder
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Find a Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Patient name, patient ID, report number or cell type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All genders</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('justify-start text-left font-normal', !dateFilter && 'text-muted-foreground')}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateFilter ? format(dateFilter, 'PPP') : 'Analysis date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={dateFilter} onSelect={setDateFilter} initialFocus />
                </PopoverContent>
              </Popover>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!hasFilters}
                  onClick={() => {
                    setSearchQuery('');
                    setGenderFilter('all');
                    setDateFilter(undefined);
                  }}
                >
                  Clear filters
                </Button>
                <Button variant="outline" onClick={() => void loadReports()} title="Reload the archive">
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                Reports ({filteredReports.length}
                {hasFilters ? ` of ${reports.length}` : ''})
              </span>
              {archiveDir && <span className="text-xs font-normal text-gray-500 break-all">{archiveDir}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Reading the archive…</div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {reports.length === 0 ? 'No reports yet. Every completed analysis is filed here automatically.' : 'No report matches these filters.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((report) => (
                  <div key={report.id} data-report={report.reportId} className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg bg-white hover:bg-gray-50">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 shrink-0 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate" dir="auto">{report.patientName || 'Unnamed patient'}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{report.reportId}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(report.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                          {report.patientId && <span>ID {report.patientId}</span>}
                          {report.age && <span>{report.age} y</span>}
                          {report.gender && <span>{report.gender}</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                          <Badge variant="outline">{report.cellCount > 1 ? `${report.cellCount} cells` : '1 cell'}</Badge>
                          <span className="truncate">{report.summary}</span>
                          {report.legacy && <Badge variant="outline" className="bg-amber-50 text-amber-700">saved by an older version</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => void openReport(report)} disabled={opening !== null}>
                        {opening === report.id ? 'Opening…' : 'Reopen Analysis'}
                      </Button>
                      <Button variant="outline" size="sm" title="Open the report folder" onClick={() => window.electron?.archiveOpenFolder(report.folderPath)}>
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" title="Delete this report" className="text-red-600 hover:text-red-700" onClick={() => setToDelete(report)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report {toDelete?.reportId}?</AlertDialogTitle>
            <AlertDialogDescription>
              The report of {toDelete?.patientName || 'this unnamed patient'} and its images are moved to the Recycle Bin. You can restore them from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SearchPage;
