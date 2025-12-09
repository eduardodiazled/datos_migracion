
import pandas as pd
import glob

files = glob.glob('DATOS/2024/*.xlsx')
if files:
    f = files[0]
    print(f"Inspecting {f}...")
    # Load first 20 rows
    df = pd.read_excel(f, header=None, nrows=20)
    
    print(f"Shape: {df.shape}")
    print("--- First 15 Rows ---")
    for i, row in df.head(15).iterrows():
        print(f"Row {i}: {row.tolist()}")
else:
    print("No 2024 file found")
