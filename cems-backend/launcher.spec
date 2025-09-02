# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=[('config.json', '.'), ('mapping.json', '.'), ('blowback_settings.json', '.'), ('CEMS_DataLog.csv', '.')],
    hiddenimports=['asyncio', 'sqlite3', 'fastapi', 'uvicorn', 'websockets', 'pymodbus', 'httpx', 'struct', 'csv', 'json', 'datetime', 'contextlib', 'subprocess', 'threading', 'webbrowser', 'pathlib'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='launcher',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
