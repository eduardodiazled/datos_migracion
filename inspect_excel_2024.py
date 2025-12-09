
import pandas as pd

FILE_PATH = r'c:/Users/Power/Desktop/datos_migracion/DATOS/2024/a0c2bff7-95d3-4d30-900a-4e7f231383fa-05122501533.xlsx'






def inspect_excel():
    print(f"Reading {FILE_PATH}...")
    try:
        # Check Table 5 structure
        df = pd.read_excel(FILE_PATH, sheet_name='Table 5', header=None)
        print("\nSheet: Table 5")
        print(df.head())
        print("\nRow 0 values:")
        print(df.iloc[0].values)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    inspect_excel()
