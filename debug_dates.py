import sqlite3
from datetime import datetime

DB_PATH = 'prisma/dev.db'

def check_dates(db_path):
    print(f"\n--- Checking {db_path} ---")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Sample some 2021 dates
        print("Sample 2021 Transactions (createdAt):")
        cursor.execute("SELECT id, createdAt FROM 'Transaction' LIMIT 5")
        for row in cursor.fetchall():
            print(row)

        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    check_dates('dev.db')
    check_dates('prisma/dev.db')
