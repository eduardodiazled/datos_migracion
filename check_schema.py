import sqlite3

DB_PATH = 'prisma/dev.db'

def check_schema():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("--- Checking Transaction Table Schema ---")
    cursor.execute("PRAGMA table_info('Transaction')")
    for col in cursor.fetchall():
        print(col)

    conn.close()

if __name__ == '__main__':
    check_schema()
