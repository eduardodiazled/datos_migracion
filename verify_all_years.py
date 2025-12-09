
import sqlite3

DB_PATH = 'prisma/dev.db'

def check_years():
    print("Checking Data Distribution via SQL...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    years = ['2021', '2022', '2023', '2024', '2025']
    
    for y in years:
        cursor.execute(f"SELECT COUNT(*) FROM 'Transaction' WHERE fecha_inicio LIKE '{y}%'")
        count = cursor.fetchone()[0]
        print(f"Year {y}: {count} transactions")

    conn.close()

if __name__ == '__main__':
    check_years()
