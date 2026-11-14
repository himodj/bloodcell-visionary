// Lab details and report template. Kept in localStorage for instant access and mirrored
// to a settings file on disk (through the main process) so they survive reinstalling.
import type { LabConfiguration } from '../components/LabSettings';
import type { ReportTemplateConfig } from '../components/ReportTemplateDesigner';

const LAB_KEY = 'labConfiguration';
const TEMPLATE_KEY = 'reportTemplateConfig';

export const emptyLabConfig: LabConfiguration = {
  labName: '',
  address: '',
  phone: '',
  hematologyDoctorName: '',
  licenseNumber: '',
  logo: null,
};

export const defaultTemplateConfig: ReportTemplateConfig = {
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

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function getLabConfig(): LabConfiguration {
  return { ...emptyLabConfig, ...(read<LabConfiguration>(LAB_KEY) ?? {}) };
}

export function getTemplateConfig(): ReportTemplateConfig {
  return { ...defaultTemplateConfig, ...(read<ReportTemplateConfig>(TEMPLATE_KEY) ?? {}) };
}

/** Saves a setting locally and on disk. Pass null to remove it. */
export function persistSetting(key: typeof LAB_KEY | typeof TEMPLATE_KEY, value: unknown | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: the disk copy below still holds it */
  }
  void window.electron?.setSetting(key, value);
}

/** At start-up: restore settings from disk when this browser profile has none, and back up the ones it has. */
export async function syncSettingsWithDisk(): Promise<void> {
  if (!window.electron) return;
  for (const key of [LAB_KEY, TEMPLATE_KEY] as const) {
    try {
      const local = localStorage.getItem(key);
      const disk = await window.electron.getSetting(key);
      if (!local && disk) localStorage.setItem(key, JSON.stringify(disk));
      else if (local && !disk) await window.electron.setSetting(key, JSON.parse(local));
    } catch {
      /* ignore */
    }
  }
}
