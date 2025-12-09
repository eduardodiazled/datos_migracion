import os
import re
import pandas as pd
from bs4 import BeautifulSoup
from datetime import datetime

# Configuration
DATA_DIR = r'C:\Users\Power\Desktop\datos_migracion\2021'

# Regex Pattern for Notion Lines
PATTERN = re.compile(
    r'^(?P<installment>\d+(?:/\d+)?)\s+'  # 1 or 2/3
    r'(?P<service>\w+)\s+'                # net, spoty
    r'(?P<price>\d+k?)\s+'                # 12k, 15000
    r'(?P<payment>\w+)\s+'                # Bank, Nequi
    r'(?P<name>.+?)'                      # Name (greedy)
    r'(?:\s+\((?P<screens>\d+)p\))?'      # (1p) Optional
    r'(?:\s+(?P<email>[\w\.\+\-]+@[\w\.\-]+\.\w+))?' # Email Optional
    r'$',
    re.IGNORECASE
)

def parse_notion_html(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
    
    transactions = []
    filename = os.path.basename(file_path)
    month_str = filename.split(' ')[0].lower() # "Abril ..." -> "abril"
    
    print(f"   Parsing {filename} (Month: {month_str})...")

    count = 0
    for text in soup.stripped_strings:
        match = PATTERN.match(text)
        if match:
            count += 1
            data = match.groupdict()
            # print(f"      Found: {data['name']} - {data['service']}") # Verbose
            transactions.append(data)
    
    print(f"      -> Extracted {count} records.")
    return transactions

def parse_treinta_excel(file_path):
    print(f"   Parsing Excel {os.path.basename(file_path)}...")
    try:
        df = pd.read_excel(file_path)
        print(f"      -> Found {len(df)} rows.")
        # Print first 3 rows to verify columns
        print("      First 3 rows preview:")
        print(df.head(3).to_string())
        return df
    except Exception as e:
        print(f"      ⚠️ Error: {e}")
        return []

def test_2021():
    print(f"Testing 2021 Data in: {DATA_DIR}")
    
    if not os.path.exists(DATA_DIR):
        print("Directory not found!")
        return

    files = os.listdir(DATA_DIR)
    total_html = 0
    total_excel = 0

    for file in files:
        path = os.path.join(DATA_DIR, file)
        
        if file.endswith('.html'):
            parse_notion_html(path)
            total_html += 1
        elif file.endswith('.xlsx'):
            parse_treinta_excel(path)
            total_excel += 1

    print("-" * 30)
    print(f"Processed {total_html} HTML files and {total_excel} Excel files.")

if __name__ == '__main__':
    test_2021()
