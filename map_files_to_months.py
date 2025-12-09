import pandas as pd
import glob
import os

directory = r'C:\Users\Power\Desktop\datos_migracion\DATOS\2025'
files = glob.glob(os.path.join(directory, '*.xlsx'))

print("--- File to Month Mapping ---")

for file_path in files:
    try:
        df = pd.read_excel(file_path, sheet_name='Hoja1', header=None)
        # Check row 14, col 1 for date
        if len(df) > 14:
            first_date = str(df.iloc[14, 1])
            count = len(df) - 14
            print(f"{os.path.basename(file_path)}: First Date = {first_date}, Total Rows = {count}")
    except Exception as e:
        print(f"{os.path.basename(file_path)}: Error {e}")
