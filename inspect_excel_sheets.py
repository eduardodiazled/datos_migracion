
import pandas as pd
import glob

files = glob.glob('DATOS/2024/*.xlsx')
if files:
    f = files[0]
    print(f"Inspecting {f}...")
    xl = pd.ExcelFile(f)
    print(f"Sheet Names: {xl.sheet_names}")
    
    for sheet in xl.sheet_names:
        print(f"\n--- Sheet: {sheet} ---")
        df = pd.read_excel(f, sheet_name=sheet, header=None, nrows=10)
        print(f"Shape: {df.shape}")
        print(df.to_string())
else:
    print("No 2024 file found")
