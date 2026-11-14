// electron-builder "afterPack" hook: stamps the application icon and version details into
// BloodCellVision.exe. Done here in pure JavaScript (resedit) instead of electron-builder's
// rcedit step, so the build needs no extra tools, no admin rights and no Wine.
const path = require('path');
const fs = require('fs');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = require('resedit');
  const info = context.packager.appInfo;
  const exePath = path.join(context.appOutDir, `${info.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  // icon
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length > 0 ? groups[0].id : 1;
  const lang = groups.length > 0 ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries, groupId, lang, iconFile.icons.map((item) => item.data)
  );

  // version details shown in Windows Explorer > Properties
  const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const vi = viList[0];
  const [major, minor, patch] = info.version.split('.').map((n) => parseInt(n, 10) || 0);
  vi.setFileVersion(major, minor, patch, 0, 1033);
  vi.setProductVersion(major, minor, patch, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: info.productName,
    ProductName: info.productName,
    CompanyName: info.companyName || 'BloodCellVision',
    LegalCopyright: info.copyright,
    OriginalFilename: `${info.productFilename}.exe`,
    InternalName: info.productFilename,
    FileVersion: info.version,
    ProductVersion: info.version,
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • icon and version info written to ${path.basename(exePath)}`);
};
