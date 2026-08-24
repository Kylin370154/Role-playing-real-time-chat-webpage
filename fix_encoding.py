#!/usr/bin/env python3
"""Convert files from GBK/GB18030 to UTF-8 (no BOM)."""
import os

files = [
    'js/config.js',
    'js/cloudbase.js',
    'js/loader.js',
    'js/app.js',
    'js/store.js',
    'js/data.js',
    'js/text-encoding-shim.js',
    'index.html',
    'css/style.css',
]

BOM = b'\xef\xbb\xbf'

for fpath in files:
    if not os.path.exists(fpath):
        print(f'SKIP (not found): {fpath}')
        continue

    with open(fpath, 'rb') as f:
        raw = f.read()

    # Strip BOM if present
    if raw[:3] == BOM:
        raw = raw[3:]

    # Try decoding
    text = None
    for enc in ('utf-8', 'gbk', 'gb18030', 'latin-1'):
        try:
            text = raw.decode(enc)
            used_enc = enc
            break
        except (UnicodeDecodeError, LookupError):
            continue

    if text is None:
        print(f'FAILED: {fpath}')
        continue

    # Write back as UTF-8 (no BOM)
    utf8_bytes = text.encode('utf-8')
    with open(fpath, 'wb') as f:
        f.write(utf8_bytes)

    # Verify
    try:
        utf8_bytes.decode('utf-8')
        print(f'OK: {fpath} ({used_enc} -> UTF-8, {len(utf8_bytes)} bytes)')
    except:
        print(f'ERROR: {fpath} verification failed')
