# backend.spec
block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('config.json', '.'),
        ('mapping.json', '.'),
        ('*.csv', '.'),
        ('dist/**', 'dist'),  # frontend build
    ],
    hiddenimports=['asyncio', 'pymodbus', 'httpx'],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='cems-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # เปลี่ยนเป็น False ถ้าไม่อยากให้มีหน้าคอนโซล
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name='cems-backend'
)
