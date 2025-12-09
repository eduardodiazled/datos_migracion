
import sqlite3

def inspect_2024_sales():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    # 2024 Timestamp range: 1704067200000 to 1735689600000
    
    print("Top POSITIVE Amounts in 2024:")
    cursor.execute("SELECT id, monto, fecha_inicio FROM 'Transaction' WHERE monto > 0 AND fecha_inicio >= 1704067200000 AND fecha_inicio < 1735689600000 ORDER BY monto DESC LIMIT 20")
    rows = cursor.fetchall()
    for r in rows:
        print(f"ID: {r[0]}, Amount: {r[1]}, Date: {r[2]}")

    conn.close()

if __name__ == '__main__':
    inspect_2024_sales()
