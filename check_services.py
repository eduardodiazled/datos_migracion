
import sqlite3

def check_services():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    print("Distinct Services in InventoryAccount:")
    cursor.execute("SELECT DISTINCT servicio FROM InventoryAccount")
    rows = cursor.fetchall()
    for r in rows:
        print(f"- {r[0]}")
        
    print("\nDistinct Services in SalesProfile:")
    cursor.execute("SELECT DISTINCT servicio FROM SalesProfile")
    # Wait, SalesProfile might NOT have 'servicio' column if it's on Account.
    # Let's check schema.
    # Actually, migration populated Account.servicio.
    
    conn.close()

if __name__ == '__main__':
    try:
        check_services()
    except Exception as e:
        print(e)
