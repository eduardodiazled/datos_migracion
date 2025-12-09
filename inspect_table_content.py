
import pandas as pd
import os

FILE_PATH = r'c:/Users/Power/Desktop/datos_migracion/DATOS/2021/a0c2bff7-95d3-4d30-900a-4e7f231383fa-041225222810.xlsx'

def inspect_content():
    try:
        # 2024 File ID from logs: a0c2...05122501533.xlsx
        # Find the 2024 file
        target_file = None
        for root, dirs, files in os.walk(r'c:\Users\Power\Desktop\datos_migracion'):
            for f in files:
                if '05122501533' in f:
                    target_file = os.path.join(root, f)
                    break
        
        if target_file:
            print(f"Inspecting 2024 File: {target_file}")
            xl = pd.ExcelFile(target_file)
            df = pd.read_excel(xl, sheet_name='Table 31', header=None)
            print(f"\n--- Table 31 Content ---")
            print(df.head(10).to_string())
            
            df_5 = pd.read_excel(xl, sheet_name='Table 5', header=None)
            print(f"\n--- Table 5 Content ---")
            print(df_5.head(10).to_string())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    inspect_content()
