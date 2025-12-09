import sqlite3
from datetime import datetime, timezone

DB_PATH = 'prisma/dev.db'

def check_analytics_query():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("--- Checking Analytics Query Logic (ISO Dates) ---")
    
    # Simulate Year=2021, Month=0 (All Year)
    # Start: 2021-01-01T00:00:00.000Z
    # End: 2021-12-31T23:59:59.999Z
    
    start_date_iso = "2021-01-01T00:00:00.000Z"
    end_date_iso = "2021-12-31T23:59:59.999Z"
    
    print(f"Querying between {start_date_iso} and {end_date_iso}")
    
    cursor.execute('''
        SELECT COUNT(*), SUM(monto) 
        FROM 'Transaction' 
        WHERE fecha_inicio >= ? AND fecha_inicio <= ?
    ''', (start_date_iso, end_date_iso))
    
    count, total_sales = cursor.fetchone()
    print(f"Count: {count}")
    print(f"Total Sales: {total_sales}")
    
    # Simulate Year=2021, Month=1 (January)
    # Start: 2021-01-01T00:00:00.000Z
    # End: 2021-01-31T23:59:59.999Z
    
    start_jan_iso = "2021-01-01T00:00:00.000Z"
    end_jan_iso = "2021-01-31T23:59:59.999Z"
    
    print(f"\nQuerying January between {start_jan_iso} and {end_jan_iso}")
    
    cursor.execute('''
        SELECT COUNT(*), SUM(monto) 
        FROM 'Transaction' 
        WHERE fecha_inicio >= ? AND fecha_inicio <= ?
    ''', (start_jan_iso, end_jan_iso))
    
    count_jan, total_sales_jan = cursor.fetchone()
    print(f"Count (Jan): {count_jan}")
    print(f"Total Sales (Jan): {total_sales_jan}")

    conn.close()

if __name__ == '__main__':
    check_analytics_query()
