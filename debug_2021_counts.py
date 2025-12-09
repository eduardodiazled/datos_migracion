
import sqlite3
import pandas as pd

DB_PATH = 'prisma/dev.db'

def check_2021():
    print("Checking 2021 Data in DB...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Count all transactions
    cursor.execute("SELECT COUNT(*) FROM 'Transaction'")
    total = cursor.fetchone()[0]
    print(f"Total Transactions: {total}")

    # Count 2021 transactions (string comparison on ISO date)
    cursor.execute("SELECT COUNT(*) FROM 'Transaction' WHERE fecha_inicio LIKE '2021%'")
    count_2021 = cursor.fetchone()[0]
    print(f"Transactions in 2021: {count_2021}")
    
    # Sample some 2021 dates
    if count_2021 > 0:
        print("Sample 2021 Dates:")
        cursor.execute("SELECT fecha_inicio FROM 'Transaction' WHERE fecha_inicio LIKE '2021%' LIMIT 5")
        for row in cursor.fetchall():
            print(row[0])
    
    conn.close()

if __name__ == '__main__':
    check_2021()
