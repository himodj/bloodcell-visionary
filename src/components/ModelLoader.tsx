import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, Check, Database, FileText, FolderOpen, RefreshCw, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getModelStatus,
  loadModel,
  runSelfTest,
  subscribeModelStatus,
  type SelfTestResult,
} from '../inference/engine';

type AppInfo = Awaited<ReturnType<NonNullable<Window['electron']>['getAppInfo']>>;

const ModelLoader: React.FC = () => {
  const status = useSyncExternalStore(subscribeModelStatus, getModelStatus);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [selfTest, setSelfTest] = useState<SelfTestResult | null>(null);
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const electronAvailable = !!window.electron?.isElectron;

  useEffect(() => {
    window.electron?.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
  }, []);

  const isLoading = status.state === 'loading';

  const handleReload = async () => {
    setSelfTest(null);
    const result = await loadModel(true);
    if (result.loaded) toast.success('Model loaded and ready for analysis');
    else toast.error(`Model could not be loaded: ${result.error}`);
  };

  const handleBrowse = async () => {
    if (!window.electron) return;
    const picked = await window.electron.browseForModel();
    if (picked.canceled) return;
    if (!picked.success) {
      toast.error(picked.error || 'That file cannot be used as a model');
      return;
    }
    await handleReload();
  };

  const handleUseBuiltIn = async () => {
    if (!window.electron) return;
    await window.electron.resetModel();
    await handleReload();
  };

  const handleSelfTest = async () => {
    setSelfTestRunning(true);
    const result = await runSelfTest();
    setSelfTest(result);
    setSelfTestRunning(false);
    if (result.error) toast.error(`Self-test failed: ${result.error}`);
    else if (result.passed) toast.success(`Self-test passed (${result.correct}/${result.total})`);
    else toast.error(`Self-test: only ${result.correct}/${result.total} reference images matched`);
  };

  const badge = () => {
    if (!electronAvailable) return <Badge variant="outline" className="bg-amber-50 text-amber-700">Desktop app required</Badge>;
    if (status.state === 'ready') return <Badge className="bg-green-500 hover:bg-green-500 text-white"><Check size={12} className="mr-1" />Model ready</Badge>;
    if (status.state === 'loading') return <Badge variant="outline" className="bg-blue-50 text-blue-700">Loading model…</Badge>;
    if (status.state === 'error') return <Badge variant="destructive"><X size={12} className="mr-1" />Model not loaded</Badge>;
    return <Badge variant="outline">Model not loaded</Badge>;
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Button
          onClick={handleReload}
          disabled={isLoading || !electronAvailable}
          className={`${status.loaded ? 'bg-green-500' : 'bg-medical-blue'} text-white hover:opacity-90 transition-all`}
        >
          {isLoading ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Loading Model...
            </>
          ) : status.loaded ? (
            <>
              <RefreshCw size={16} className="mr-2" />
              Reload Model
            </>
          ) : (
            <>
              <Database size={16} className="mr-2" />
              Load Model
            </>
          )}
        </Button>

        <Button variant="outline" size="sm" className="h-10" onClick={handleSelfTest} disabled={!status.loaded || selfTestRunning}>
          <ShieldCheck size={16} className={selfTestRunning ? 'animate-pulse mr-2' : 'mr-2'} />
          {selfTestRunning ? 'Testing…' : 'Self-test'}
        </Button>

        {badge()}
      </div>

      {status.state === 'error' && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle className="flex items-center">
            <AlertTriangle size={16} className="mr-2" />
            The model could not be loaded
          </AlertTitle>
          <AlertDescription>
            <p className="mt-1 whitespace-pre-wrap break-words">{status.error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleReload}>Try again</Button>
              <Button variant="outline" size="sm" onClick={handleUseBuiltIn}>Use built-in model</Button>
              <Button variant="outline" size="sm" onClick={() => window.electron?.openLogFile()}>Open log file</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {selfTest && !selfTest.error && (
        <Alert className={`mb-4 ${selfTest.passed ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
          <AlertTitle className="flex items-center">
            <ShieldCheck size={16} className="mr-2" />
            Self-test {selfTest.passed ? 'passed' : 'failed'}: {selfTest.correct} of {selfTest.total} reference images classified correctly
          </AlertTitle>
          <AlertDescription>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1 pr-2 font-medium">Expected</th>
                  <th className="py-1 pr-2 font-medium">Model result</th>
                  <th className="py-1 font-medium text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {selfTest.rows.map((row) => (
                  <tr key={row.name} className={row.ok ? '' : 'text-red-700 font-medium'}>
                    <td className="py-0.5 pr-2">{row.expected}</td>
                    <td className="py-0.5 pr-2">{row.ok ? '✓ ' : '✗ '}{row.predicted}</td>
                    <td className="py-0.5 text-right">{(row.confidence * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AlertDescription>
        </Alert>
      )}

      {electronAvailable && (
        <Accordion type="single" collapsible className="mb-6">
          <AccordionItem value="model">
            <AccordionTrigger className="text-sm font-medium">Model details</AccordionTrigger>
            <AccordionContent>
              <div className="text-sm bg-gray-50 p-3 rounded-md space-y-1">
                {status.loaded && status.meta ? (
                  <>
                    <div><span className="font-semibold">Model:</span> {status.meta.name}{status.meta.version ? ` (v${status.meta.version})` : ''}</div>
                    <div><span className="font-semibold">Source:</span> {status.isDefault ? 'Built-in model' : 'Custom model'} — <span className="break-all">{status.fileName}</span></div>
                    <div><span className="font-semibold">Input:</span> {status.meta.inputSize} × {status.meta.inputSize} px, RGB</div>
                    <div>
                      <span className="font-semibold">Classes ({status.meta.labels.length}):</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {status.meta.labels.map((label) => (
                          <Badge key={label} variant="outline" className="bg-white">{label}</Badge>
                        ))}
                      </div>
                    </div>
                    <div><span className="font-semibold">Engine:</span> ONNX Runtime {status.runtimeVersion} (on-device, {status.threads} thread{status.threads === 1 ? '' : 's'})</div>
                    <div><span className="font-semibold">Load time:</span> {Math.round(status.loadMs ?? 0)} ms · <span className="font-semibold">Per image:</span> ~{Math.round(status.warmupMs ?? 0)} ms</div>
                    <div className="text-xs text-gray-500 break-all">File size {((status.sizeBytes ?? 0) / 1048576).toFixed(1)} MB · SHA-256 {status.sha256}</div>
                  </>
                ) : (
                  <div className="text-gray-600">{isLoading ? 'Loading…' : 'No model is loaded.'}</div>
                )}
                {appInfo && (
                  <div className="text-xs text-gray-500 pt-1">
                    BloodCellVision {appInfo.version} · Electron {appInfo.electron} · {appInfo.platform} {appInfo.arch} {appInfo.osVersion}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleBrowse} disabled={isLoading}>
                    <FolderOpen size={14} className="mr-1" />
                    Use another model (.onnx)…
                  </Button>
                  {status.loaded && status.isDefault === false && (
                    <Button variant="outline" size="sm" onClick={handleUseBuiltIn} disabled={isLoading}>
                      <RotateCcw size={14} className="mr-1" />
                      Back to built-in model
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => window.electron?.openLogFile()}>
                    <FileText size={14} className="mr-1" />
                    Open log file
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

export default ModelLoader;
