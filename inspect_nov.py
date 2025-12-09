import pandas as pd

file_path = r'C:\Users\Power\Desktop\datos_migracion\DATOS\2025\balance-1764983362.xlsx'

try:
    df = pd.read_excel(file_path, sheet_name='Hoja1', header=None)
    
    print("--- Row 12 (Headers) ---")
    headers = df.iloc[12]
    for i, val in enumerate(headers):
        print(f"Col {i}: {val}")

    print("\n--- Row 13 (Data) ---")
    data_row = df.iloc[13]
    for i, val in enumerate(data_row):
        print(f"Col {i}: {val}")

    print("\n--- Row 162 (Problematic) ---")
    # Check if row 162 exists
    if len(df) > 162:
        prob_row = df.iloc[162]
        for i, val in enumerate(prob_row):
            print(f"Col {i}: {val}")
    else:
        print("Row 162 does not exist.")
        
except Exception as e:
    print("Error:", e)
