; BloodCellVision Windows installer (NSIS).
; Built by scripts/make-installer.mjs, which passes the /D defines and generates
; files-install.nsh / files-uninstall.nsh from the packaged application folder.
;
; Installs per user (no administrator rights needed), creates Start Menu and Desktop
; shortcuts, registers an uninstaller in "Apps & features".

Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

!define APP_NAME "BloodCellVision"
!define APP_EXE "BloodCellVision.exe"
!define APP_PUBLISHER "Ibrahim Ammar"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\BloodCellVision"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "Software\${APP_NAME}" "InstallDir"
RequestExecutionLevel user
BrandingText "${APP_NAME} ${APP_VERSION}"
ShowInstDetails nevershow
ShowUninstDetails nevershow

VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} Setup"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2025 ${APP_PUBLISHER}"

!define MUI_ICON "${ICON_FILE}"
!define MUI_UNICON "${ICON_FILE}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Start ${APP_NAME}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${LICENSE_FILE}"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; Waits until the application is closed (its .exe is locked while it runs).
!macro CheckAppNotRunning
  ${If} ${FileExists} "$INSTDIR\${APP_EXE}"
    retry_check:
    ClearErrors
    FileOpen $0 "$INSTDIR\${APP_EXE}" a
    ${If} ${Errors}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "${APP_NAME} is currently running.$\r$\n$\r$\nPlease close it, then click Retry." IDRETRY retry_check
      Abort
    ${Else}
      FileClose $0
    ${EndIf}
  ${EndIf}
!macroend

Function .onVerifyInstDir
  ; never install straight into a drive root
  StrLen $0 "$INSTDIR"
  ${If} $0 < 4
    Abort
  ${EndIf}
FunctionEnd

Section "Install"
  SetShellVarContext current
  !insertmacro CheckAppNotRunning

  ; Remove the files of BloodCellVision 1.x (bundled Python server) when upgrading in place.
  ${If} ${FileExists} "$INSTDIR\${APP_EXE}"
    RMDir /r "$INSTDIR\resources\python-server"
    RMDir /r "$INSTDIR\resources\dist"
    RMDir /r "$INSTDIR\resources\model"
    Delete "$INSTDIR\resources\model.h5"
    Delete "$INSTDIR\resources\app.asar"
  ${EndIf}

  SetOverwrite on
  !include "${FILES_INSTALL}"

  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall ${APP_NAME}.exe"

  CreateShortCut "$SMPROGRAMS\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  WriteRegStr HKCU "Software\${APP_NAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE},0"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall ${APP_NAME}.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall ${APP_NAME}.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  !insertmacro CheckAppNotRunning

  ; Only files that the installer put there are removed. Saved reports
  ; (Documents\BloodCellVision Reports) and settings are kept.
  !include "${FILES_UNINSTALL}"
  Delete "$INSTDIR\Uninstall ${APP_NAME}.exe"
  RMDir "$INSTDIR"

  Delete "$SMPROGRAMS\${APP_NAME}.lnk"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\${APP_NAME}"
SectionEnd
