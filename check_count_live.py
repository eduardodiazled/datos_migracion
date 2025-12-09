
import sqlite3
import time

def check_count():
    try:
        conn = sqlite3.connect('prisma/dev.db')
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM 'Transaction'")
        count = cursor.fetchone()[0]
        print(f"Current Transaction Count: {count}")
        conn.close()
    except Exception as e:
        print(f"Error checking count: {e}")

if __name__ == '__main__':
    check_count()
