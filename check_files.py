import os

DATA_DIR = r'C:\Users\Power\Desktop\datos_migracion'

print(f"Checking {DATA_DIR}...")
if not os.path.exists(DATA_DIR):
    print("❌ Directory not found!")
else:
    for root, dirs, files in os.walk(DATA_DIR):
        level = root.replace(DATA_DIR, '').count(os.sep)
        indent = ' ' * 4 * (level)
        print(f"{indent}{os.path.basename(root)}/")
        subindent = ' ' * 4 * (level + 1)
        for f in files:
            print(f"{subindent}{f}")
