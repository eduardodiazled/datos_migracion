
import sqlite3

def inspect_2025_expenses():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    # 2025 Timestamp: > 1735689600000 (approx)
    # Actually just order by date desc
    
    print("Top Negative Amounts in 2025:")
    cursor.execute("SELECT id, monto, fecha_inicio FROM 'Transaction' WHERE monto < 0 AND fecha_inicio > 1735689600000 ORDER BY monto ASC LIMIT 20")
    rows = cursor.fetchall()
    for r in rows:
        print(f"ID: {r[0]}, Amount: {r[1]}, Date: {r[2]}")

    conn.close()

if __name__ == '__main__':
    inspect_2025_expenses()
