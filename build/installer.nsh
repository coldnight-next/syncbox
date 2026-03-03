!macro customInit
  ; Kill any running Syncbox process so the installer is never blocked
  nsExec::ExecToLog 'taskkill /f /im Syncbox.exe'
!macroend
