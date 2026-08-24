#!/usr/bin/env python3
import os
import sys

TEXT_EXTS = {'.html', '.htm', '.css', '.js', '.json', '.txt', '.svg', '.xml', '.md'}
EXCLUDE_DIRS = {'.git', 'node_modules', '__pycache__', '.idea', '.vscode'}

def convert_file(filepath):
    with open(filepath, 'rb') as f:
        raw = f.read()
    
    try:
        raw.decode('utf-8')
        return None
    except UnicodeDecodeError:
        pass
    
    try:
        text = raw.decode('gbk')
    except UnicodeDecodeError:
        try:
            text = raw.decode('gb18030')
        except UnicodeDecodeError:
            text = raw.decode('utf-8', errors='replace')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
    return True

def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    if not os.path.isdir(target_dir):
        print("Error: Directory not found -", target_dir)
        sys.exit(1)
    
    print("Converting directory:", os.path.abspath(target_dir))
    print("-" * 50)
    
    converted = 0
    skipped = 0
    
    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for filename in files:
            ext = os.path.splitext(filename)[1].lower()
            if ext in TEXT_EXTS:
                filepath = os.path.join(root, filename)
                try:
                    result = convert_file(filepath)
                    if result:
                        print("  Converted:", filepath)
                        converted += 1
                    else:
                        skipped += 1
                except Exception as e:
                    print("  Failed:", filepath, "-", e)
    
    print("-" * 50)
    print("Done! Converted:", converted, "| Skipped (already UTF-8):", skipped)

if __name__ == '__main__':
    main()
