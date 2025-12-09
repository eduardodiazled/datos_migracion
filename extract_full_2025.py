import pandas as pd
import json
import os
import glob

directory = r'C:\Users\Power\Desktop\datos_migracion\DATOS\2025'
nov_file = 'balance-1764983362.xlsx'

def parse_spanish_date(date_str):
    months = {
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
        'jan': '01', 'apr': '04', 'aug': '08', 'dec': '12'
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
    return None

all_data = []
files = glob.glob(os.path.join(directory, '*.xlsx'))

print(f"Found {len(files)} files.")

for file_path in files:
    filename = os.path.basename(file_path)
    if filename == nov_file:
        print(f"Skipping {filename} (Already imported)")
        continue
        
    print(f"Processing {filename}...")
    try:
        df = pd.read_excel(file_path, sheet_name='Hoja1', header=None)
        
        extracted_count = 0
        for i, row in df.iterrows():
            if i < 14: continue 
            
            if pd.isna(row[1]) or str(row[1]).strip() == '': continue
            
            try:
                amount_val = row[9]
                if isinstance(amount_val, str):
                    amount_val = amount_val.replace('$', '').replace(',', '').strip()
                amount = float(amount_val)
            except:
                continue

            date_parsed = parse_spanish_date(row[1])
            if not date_parsed: continue # Skip invalid dates

            record = {
                'date': date_parsed,
                'type': str(row[2]).strip(),
                'client': str(row[6]).strip() if not pd.isna(row[6]) else 'Cliente General',
                'description': str(row[4]).strip() if not pd.isna(row[4]) else '-',
                'method': str(row[8]).strip() if not pd.isna(row[8]) else 'EFECTIVO',
                'amount': amount,
                'status': str(row[7]).strip() if not pd.isna(row[7]) else 'Pagado'
            }
            
            method_map = {'transferencia bancaria': 'BANCOLOMBIA', 'nequi': 'NEQUI', 'efectivo': 'EFECTIVO'}
            for k, v in method_map.items():
                if k in record['method'].lower():
                    record['method'] = v
                    break
                    
            all_data.append(record)
            extracted_count += 1
            
        print(f"  -> Extracted {extracted_count} records.")
        
    except Exception as e:
        print(f"  -> Error processing {filename}: {e}")

print(f"Total extracted records: {len(all_data)}")

with open('full_2025_data.json', 'w', encoding='utf-8') as f:
    json.dump(all_data, f, indent=2, ensure_ascii=False)
