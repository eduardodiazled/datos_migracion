
import sqlite3

def find_outlier():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    print("Searching for massive outliers...")
    cursor.execute("SELECT id, monto, fecha_inicio, clienteId FROM 'Transaction' ORDER BY monto ASC LIMIT 5")
    rows = cursor.fetchall()
    
    for r in rows:
        print(f"ID: {r[0]}, Amount: {r[1]}, Date: {r[2]}")
        
    conn.close()

if __name__ == '__main__':
    find_outlier()
