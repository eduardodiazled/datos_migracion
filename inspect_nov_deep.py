import pandas as pd

file_path = r'C:\Users\Power\Desktop\datos_migracion\DATOS\2025\balance-1764983362.xlsx'

try:
    df = pd.read_excel(file_path, sheet_name='Hoja1', header=None)
    print("Rows 5-25:")
    print(df.iloc[5:25].to_string())
except Exception as e:
    print("Error:", e)
