
import pandas as pd
import os

file_path = r'c:/Users/Power/Desktop/datos_migracion/DATOS/2025/balance-1764983362.xlsx'

try:
    # Read first few rows to find header
    df = pd.read_excel(file_path, header=16, nrows=5)
    print("Columns:", df.columns.tolist())
    print(df.head())
except Exception as e:
    print(f"Error reading file: {e}")
