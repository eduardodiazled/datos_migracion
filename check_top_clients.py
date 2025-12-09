
import sqlite3

def check_top_clients():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    print("Top 20 Clients by Transaction Count:")
    cursor.execute("""
        SELECT c.nombre, COUNT(*) as tx_count 
        FROM "Transaction" t
        JOIN Client c ON t.clienteId = c.celular
        GROUP BY c.nombre
        ORDER BY tx_count DESC
        LIMIT 20
    """)
    rows = cursor.fetchall()
    for r in rows:
        print(f"{r[0]}: {r[1]}")
        
    conn.close()

if __name__ == '__main__':
    check_top_clients()
