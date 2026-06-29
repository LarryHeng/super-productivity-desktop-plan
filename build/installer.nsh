!macro customRemoveFiles
  SetOutPath "$TEMP"
  System::Call "kernel32::GetCurrentProcessId() i .r0"
  StrCpy $R8 "$INSTDIR.__sp-user-data-$0"
  CreateDirectory "$R8"

  Rename "$INSTDIR\backups" "$R8\backups"
  Rename "$INSTDIR\bg-images" "$R8\bg-images"

  RMDir /r "$INSTDIR"
  CreateDirectory "$INSTDIR"

  Rename "$R8\backups" "$INSTDIR\backups"
  Rename "$R8\bg-images" "$INSTDIR\bg-images"
  RMDir "$R8"
!macroend
