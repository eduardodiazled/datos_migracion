
import sqlite3
from datetime import datetime

def check_totals():
    try:
        conn = sqlite3.connect('prisma/dev.db')
        cursor = conn.cursor()
        
        print("\nFinancial Breakdown by Year (Ingresos | Egresos | Balance):")
        print(f"{'Year':<6} | {'Income (Ingresos)':<20} | {'Expenses (Egresos)':<20} | {'Balance (Utilidad)':<20} | {'Tx Count':<10}")
        print("-" * 100)

        for year in range(2021, 2026):
            start_ts = int(datetime(year, 1, 1).timestamp() * 1000)
            end_ts = int(datetime(year + 1, 1, 1).timestamp() * 1000)

            cursor.execute("""
                SELECT 
                    SUM(CASE WHEN monto > 0 THEN monto ELSE 0 END) as income,
                    SUM(CASE WHEN monto < 0 THEN monto ELSE 0 END) as expenses,
                    SUM(monto) as balance,
                    COUNT(*) as count
                FROM "Transaction" 
                WHERE fecha_inicio >= ? AND fecha_inicio < ?
            """, (start_ts, end_ts))
            
            row = cursor.fetchone()
            income = row[0] if row[0] else 0
            expenses = row[1] if row[1] else 0
            balance = row[2] if row[2] else 0
            count = row[3]

            print(f"{year:<6} | ${income:,.0f}".ljust(23) + f" | ${expenses:,.0f}".ljust(23) + f" | ${balance:,.0f}".ljust(23) + f" | {count:<10}")

        conn.close()
    except Exception as e:
        print(f"Error checking totals: {e}")

if __name__ == '__main__':
    check_totals()
