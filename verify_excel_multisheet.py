
import pandas as pd
import glob
import os

def sum_excel_multisheet(year):
    files = glob.glob(f'DATOS/{year}/*.xlsx')
    if not files:
        print(f"No files found for {year}")
        return

    grand_total_income = 0
    grand_total_expense = 0
    
    file_path = files[0]
    print(f"Processing Multi-sheet Excel: {file_path}")
    
    try:
        xl = pd.ExcelFile(file_path)
        print(f"Total Sheets: {len(xl.sheet_names)}")
        
        for idx, sheet in enumerate(xl.sheet_names):
            if idx % 100 == 0:
                print(f"Scanning sheet {idx}/{len(xl.sheet_names)}...", end='\r')
                
            # Read sheet (no header initially to sniff)
            try:
                # Read specific columns if possible or all
                df_raw = pd.read_excel(xl, sheet_name=sheet, header=None, nrows=20)
                
                # Sniff Header
                header_idx = -1
                for i, row in df_raw.iterrows():
                    row_str = " ".join([str(x).lower() for x in row if pd.notna(x)])
                    if 'fecha' in row_str and 'tipo' in row_str:
                        header_idx = i
                        break
                
                if header_idx != -1:
                    # Reload with header
                    df = pd.read_excel(xl, sheet_name=sheet, header=header_idx)
                    df.columns = df.columns.str.lower().str.strip()
                    
                    # Columns
                    tipo_col = next((c for c in df.columns if 'tipo' in c), None)
                    monto_col = next((c for c in df.columns if 'monto' in c or 'valor' in c), None)
                    
                    if tipo_col and monto_col:
                        for _, row in df.iterrows():
                            try:
                                tipo = str(row[tipo_col]).lower()
                                monto = row[monto_col]
                                if pd.isna(monto): continue
                                
                                # Convert string currency if needed
                                if isinstance(monto, str):
                                    monto = float(monto.replace('$','').replace('.','').replace(',','.'))
                                else:
                                    monto = float(monto)
                                    
                                if 'ingreso' in tipo or 'venta' in tipo:
                                    grand_total_income += monto
                                elif 'gasto' in tipo or 'egreso' in tipo or 'compra' in tipo:
                                    grand_total_expense += monto
                            except: pass
                
                # No header logic omitted for speed, assuming simple structure or empty sheets
            except Exception as e:
                pass

        print(f"\n\n--- {year} RAW EXCEL (ALL SHEETS) ---")
        print(f"Income:   ${grand_total_income:,.2f}")
        print(f"Expenses: ${grand_total_expense:,.2f}")
        print(f"Balance:  ${(grand_total_income - grand_total_expense):,.2f}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    for year in ['2021', '2022', '2023', '2024', '2025']:
        print(f"\nScanning Year {year}...")
        sum_excel_multisheet(year)
