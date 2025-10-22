import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, RotateCcw, Eye, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export interface ReportTemplateConfig {
  // Page Settings
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  
  // Typography
  fontFamily: string;
  baseFontSize: number;
  headerFontSize: number;
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  
  // Section Visibility
  showLogo: boolean;
  showReportInfo: boolean;
  showPatientBox: boolean;
  showImage: boolean;
  showClinicalFindings: boolean;
  showDoctorNotes: boolean;
  showSignatures: boolean;
  
  // Section Spacing
  sectionGap: number;
  
  // Border Styles
  borderStyle: 'solid' | 'double' | 'dashed';
  borderWidth: number;
}

interface ReportTemplateDesignerProps {
  onTemplateChange?: (config: ReportTemplateConfig) => void;
}

const defaultConfig: ReportTemplateConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
  marginTop: 10,
  marginBottom: 10,
  marginLeft: 10,
  marginRight: 10,
  fontFamily: 'Times New Roman',
  baseFontSize: 10,
  headerFontSize: 16,
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  accentColor: '#3b82f6',
  textColor: '#000000',
  showLogo: true,
  showReportInfo: true,
  showPatientBox: true,
  showImage: true,
  showClinicalFindings: true,
  showDoctorNotes: true,
  showSignatures: true,
  sectionGap: 3,
  borderStyle: 'solid',
  borderWidth: 2,
};

const ReportTemplateDesigner: React.FC<ReportTemplateDesignerProps> = ({ onTemplateChange }) => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ReportTemplateConfig>(defaultConfig);

  useEffect(() => {
    const savedConfig = localStorage.getItem('reportTemplateConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
        onTemplateChange?.(parsed);
      } catch (e) {
        console.error('Failed to parse saved config', e);
      }
    }
  }, [onTemplateChange]);

  const handleSave = () => {
    localStorage.setItem('reportTemplateConfig', JSON.stringify(config));
    onTemplateChange?.(config);
    toast.success('Report template saved successfully');
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    localStorage.removeItem('reportTemplateConfig');
    toast.info('Template reset to defaults');
  };

  const updateConfig = (key: keyof ReportTemplateConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handlePreview = () => {
    // Save current config and navigate to preview
    localStorage.setItem('reportTemplateConfig', JSON.stringify(config));
    toast.info('Template saved. Open a report to see the preview.');
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-4">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back
        </Button>
      </div>
      
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-medical-dark">Report Template Designer</h1>
          <p className="text-sm text-gray-600 mt-2">Customize your lab report print layout and save for future use</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw size={16} className="mr-2" />
            Reset to Default
          </Button>
          <Button variant="default" onClick={handlePreview}>
            <Eye size={16} className="mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave}>
            <Save size={16} className="mr-2" />
            Save Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="page" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="page">Page Layout</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="borders">Borders</TabsTrigger>
        </TabsList>

        <TabsContent value="page" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Page Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Page Size</Label>
                  <Select value={config.pageSize} onValueChange={(value: any) => updateConfig('pageSize', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 (210mm × 297mm)</SelectItem>
                      <SelectItem value="Letter">Letter (8.5" × 11")</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Orientation</Label>
                  <Select value={config.orientation} onValueChange={(value: any) => updateConfig('orientation', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Top Margin: {config.marginTop}mm</Label>
                  <Slider
                    value={[config.marginTop]}
                    onValueChange={([value]) => updateConfig('marginTop', value)}
                    min={5}
                    max={30}
                    step={1}
                  />
                </div>
                <div>
                  <Label>Bottom Margin: {config.marginBottom}mm</Label>
                  <Slider
                    value={[config.marginBottom]}
                    onValueChange={([value]) => updateConfig('marginBottom', value)}
                    min={5}
                    max={30}
                    step={1}
                  />
                </div>
                <div>
                  <Label>Left Margin: {config.marginLeft}mm</Label>
                  <Slider
                    value={[config.marginLeft]}
                    onValueChange={([value]) => updateConfig('marginLeft', value)}
                    min={5}
                    max={30}
                    step={1}
                  />
                </div>
                <div>
                  <Label>Right Margin: {config.marginRight}mm</Label>
                  <Slider
                    value={[config.marginRight]}
                    onValueChange={([value]) => updateConfig('marginRight', value)}
                    min={5}
                    max={30}
                    step={1}
                  />
                </div>
                <div>
                  <Label>Section Gap: {config.sectionGap}mm</Label>
                  <Slider
                    value={[config.sectionGap]}
                    onValueChange={([value]) => updateConfig('sectionGap', value)}
                    min={1}
                    max={10}
                    step={0.5}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="typography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Typography Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Font Family</Label>
                <Select value={config.fontFamily} onValueChange={(value) => updateConfig('fontFamily', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Helvetica">Helvetica</SelectItem>
                    <SelectItem value="Georgia">Georgia</SelectItem>
                    <SelectItem value="Calibri">Calibri</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Base Font Size: {config.baseFontSize}pt</Label>
                <Slider
                  value={[config.baseFontSize]}
                  onValueChange={([value]) => updateConfig('baseFontSize', value)}
                  min={8}
                  max={14}
                  step={0.5}
                />
              </div>

              <div>
                <Label>Header Font Size: {config.headerFontSize}pt</Label>
                <Slider
                  value={[config.headerFontSize]}
                  onValueChange={([value]) => updateConfig('headerFontSize', value)}
                  min={12}
                  max={24}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Color Scheme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Primary Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => updateConfig('primaryColor', e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={config.primaryColor}
                      onChange={(e) => updateConfig('primaryColor', e.target.value)}
                      placeholder="#2563eb"
                    />
                  </div>
                </div>
                <div>
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={config.secondaryColor}
                      onChange={(e) => updateConfig('secondaryColor', e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={config.secondaryColor}
                      onChange={(e) => updateConfig('secondaryColor', e.target.value)}
                      placeholder="#1e40af"
                    />
                  </div>
                </div>
                <div>
                  <Label>Accent Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => updateConfig('accentColor', e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={config.accentColor}
                      onChange={(e) => updateConfig('accentColor', e.target.value)}
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>
                <div>
                  <Label>Text Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={config.textColor}
                      onChange={(e) => updateConfig('textColor', e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={config.textColor}
                      onChange={(e) => updateConfig('textColor', e.target.value)}
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Section Visibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-logo">Show Laboratory Logo</Label>
                <Switch
                  id="show-logo"
                  checked={config.showLogo}
                  onCheckedChange={(checked) => updateConfig('showLogo', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-report-info">Show Report Information Banner</Label>
                <Switch
                  id="show-report-info"
                  checked={config.showReportInfo}
                  onCheckedChange={(checked) => updateConfig('showReportInfo', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-patient-box">Show Patient Information Box</Label>
                <Switch
                  id="show-patient-box"
                  checked={config.showPatientBox}
                  onCheckedChange={(checked) => updateConfig('showPatientBox', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-image">Show Analysis Image</Label>
                <Switch
                  id="show-image"
                  checked={config.showImage}
                  onCheckedChange={(checked) => updateConfig('showImage', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-clinical-findings">Show Clinical Findings</Label>
                <Switch
                  id="show-clinical-findings"
                  checked={config.showClinicalFindings}
                  onCheckedChange={(checked) => updateConfig('showClinicalFindings', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-doctor-notes">Show Doctor Notes</Label>
                <Switch
                  id="show-doctor-notes"
                  checked={config.showDoctorNotes}
                  onCheckedChange={(checked) => updateConfig('showDoctorNotes', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-signatures">Show Signature Section</Label>
                <Switch
                  id="show-signatures"
                  checked={config.showSignatures}
                  onCheckedChange={(checked) => updateConfig('showSignatures', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="borders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Border Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Border Style</Label>
                <Select value={config.borderStyle} onValueChange={(value: any) => updateConfig('borderStyle', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                    <SelectItem value="dashed">Dashed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Border Width: {config.borderWidth}px</Label>
                <Slider
                  value={[config.borderWidth]}
                  onValueChange={([value]) => updateConfig('borderWidth', value)}
                  min={1}
                  max={5}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportTemplateDesigner;
