
import pandas as pd
import glob
import os

def sum_excel(year):
    files = glob.glob(f'DATOS/{year}/*.xlsx')
    if not files:
        print(f"No files found for {year}")
        return

    total_income = 0
    total_expense = 0
    
    # We need to correctly identify columns. 
    # Based on previous knowledge/inspection, Treinta usually has 'Tipo', 'Monto' 
    # But headers might be on row 1 (index 0) or row 4.
    # We'll try to guess based on 'Ingreso'/'Gasto' strings.
    
    for f in files:
        print(f"Processing {f}...")
        try:
            # Load with no header initially to find the real header
            df_raw = pd.read_excel(f, header=None)
            
            # Find the row that contains 'Fecha' or 'Tipo'
            header_row = -1
            for i, row in df_raw.head(10).iterrows():
                row_str = row.astype(str).str.lower().tolist()
                if 'fecha' in row_str or 'tipo' in row_str:
                    header_row = i
                    break
            
            if header_row == -1:
                print(f"Could not find header in {f}")
                continue

            # Reload with correct header
            df = pd.read_excel(f, header=header_row)
            
            # Normalize column names
            df.columns = df.columns.str.lower().str.strip()
            
            # Find relevant columns
            # 'tipo' (Ingreso/Gasto), 'monto' (Amount)
            tipo_col = next((c for c in df.columns if 'tipo' in c), None)
            monto_col = next((c for c in df.columns if 'monto' in c or 'valor' in c or 'precio' in c), None)
            
            if not tipo_col or not monto_col:
                print(f"Missing columns in {f}. Found: {df.columns.tolist()}")
                continue
                
            # Clean numeric data (remove non-numeric chars if any, though excel usually parses numbers)
            # Treinta exports sometimes use strings for numbers?
            
            for idx, row in df.iterrows():
                try:
                    tipo = str(row[tipo_col]).lower()
                    monto = row[monto_col]
                    
                    if isinstance(monto, str):
                         monto = float(monto.replace('$','').replace('.','').replace(',','.')) # Adjust based on locale
                    
                    if pd.isna(monto): continue

                    if 'ingreso' in tipo or 'venta' in tipo:
                        total_income += float(monto)
                    elif 'gasto' in tipo or 'egreso' in tipo or 'compra' in tipo:
                        total_expense += float(monto)
                        
                except Exception as e:
                    pass # Ignore parse errors rows

        except Exception as e:
            print(f"Error reading {f}: {e}")

    print(f"\n--- {year} EXCEL RAW TOTALS ---")
    print(f"Total Income: ${total_income:,.2f}")
    print(f"Total Expense: ${total_expense:,.2f}")
    print(f"Balance: ${(total_income - total_expense):,.2f}")

if __name__ == "__main__":
    sum_excel('2024')
