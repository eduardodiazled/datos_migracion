
import os
import pandas as pd
from openpyxl import load_workbook

def inspect_2021_headers():
    target_file = None
    for root, dirs, files in os.walk(r'c:\Users\Power\Desktop\datos_migracion'):
        for f in files:
            if '041225222810' in f: # 2021 ID
                target_file = os.path.join(root, f)
                break
    
    if target_file:
        print(f"Inspecting 2021 File: {target_file}")
        df = pd.read_excel(target_file, sheet_name='Table 7', header=None, nrows=5)
        print(df.to_string())
    else:
        print("2021 File not found")

if __name__ == '__main__':
    inspect_2021_headers()
