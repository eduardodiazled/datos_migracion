
import sqlite3

def check_txs():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    print("Sampling 2021 transactions...")
    cursor.execute("SELECT monto, fecha_inicio, id FROM 'Transaction' WHERE fecha_inicio >= 1609459200000 AND fecha_inicio < 1640995200000 LIMIT 20")
    rows = cursor.fetchall()
    
    # Wait, 'tipo' column doesn't exist in Prisma schema?
    # I didn't migrate 'tipo' to the schema? I mapped it in Python but didn't insert it?
    # Ah, `Transaction` model in `schema.prisma`:
    # id, clienteId, perfilId, estado_pago, fecha_inicio, fecha_vencimiento, monto, ...
    # NO 'tipo'.
    # But I used `tx_type` in python to decide the SIGN of `monto`.
    
    # So I can only see the amount.
    for r in rows:
        print(f"ID: {r[2]}, Date: {r[1]}, Amount: {r[0]}")

    print("\nCounting Positive vs Negative for 2021:")
    cursor.execute("SELECT COUNT(*), SUM(monto) FROM 'Transaction' WHERE fecha_inicio >= 1609459200000 AND fecha_inicio < 1640995200000 AND monto > 0")
    pos = cursor.fetchone()
    print(f"Positive: {pos[0]} rows, Sum: {pos[1]}")
    
    cursor.execute("SELECT COUNT(*), SUM(monto) FROM 'Transaction' WHERE fecha_inicio >= 1609459200000 AND fecha_inicio < 1640995200000 AND monto < 0")
    neg = cursor.fetchone()
    print(f"Negative: {neg[0]} rows, Sum: {neg[1]}")
    
    # Check total
    total = (pos[1] or 0) + (neg[1] or 0)
    print(f"Total Net: {total}")

    conn.close()

if __name__ == '__main__':
    check_txs()
