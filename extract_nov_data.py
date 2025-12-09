import pandas as pd
import json
import re

file_path = r'C:\Users\Power\Desktop\datos_migracion\DATOS\2025\balance-1764983362.xlsx'

def parse_spanish_date(date_str):
    # Expected format: "01 Nov 2025" or similar
    months = {
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    }
    try:
        if isinstance(date_str, pd.Timestamp):
            return date_str.strftime('%Y-%m-%d')
            
        parts = str(date_str).lower().replace('.', '').split()
        if len(parts) >= 3:
            day = parts[0].zfill(2)
            month = months.get(parts[1][:3], '01')
            year = parts[2]
            return f"{year}-{month}-{day}"
    except:
        pass
    return "2025-11-01" # Fallback

try:
    # Read ignoring header
    df = pd.read_excel(file_path, sheet_name='Hoja1', header=None)
    
    # Data starts at row 13 (index 13), headers at row 12 (index 12)
    # Based on inspection:
    # 1: Date, 2: Type, 3: Client, 4: Desc, 5: Method, 6: Amount
    
    data = []
    
    for i, row in df.iterrows():
        if i < 14: continue # Skip headers (Row 13 is header, so data starts at 14)
        
        # Validation: Column 1 (Date) must be non-empty
        if pd.isna(row[1]) or str(row[1]).strip() == '': continue
        
        # Validation: Column 9 (Amount/Valor) must be numeric
        try:
            amount_val = row[9]
            if isinstance(amount_val, str):
                amount_val = amount_val.replace('$', '').replace(',', '').strip()
            amount = float(amount_val)
        except:
            print(f"Skipping row {i}: Invalid amount '{row[9]}'")
            continue

        record = {
            'date': parse_spanish_date(row[1]),
            'type': str(row[2]).strip(), # Venta / Gasto
            'client': str(row[6]).strip() if not pd.isna(row[6]) else 'Cliente General', # Contacto = Cliente
            'description': str(row[4]).strip() if not pd.isna(row[4]) else '-',
            'method': str(row[8]).strip() if not pd.isna(row[8]) else 'EFECTIVO',
            'amount': amount,
            'status': str(row[7]).strip() if not pd.isna(row[7]) else 'Pagado'
        }
        
        # Normalize Method
        method_map = {
            'transferencia bancaria': 'BANCOLOMBIA',
            'nequi': 'NEQUI',
            'efectivo': 'EFECTIVO'
        }
        for k, v in method_map.items():
            if k in record['method'].lower():
                record['method'] = v
                break
                
        data.append(record)
        
    print(f"Extracted {len(data)} records.")
    
    with open('november_data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
except Exception as e:
    print(f"Error: {e}")
