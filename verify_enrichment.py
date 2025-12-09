
import sqlite3

def check_enrichment():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    print("Checking for Enriched Transactions (Notion Data)...")
    
    # Check how many transactions have a specific service profile (not GENERICO)
    query = '''
        SELECT sp.nombre_perfil, COUNT(*) 
        FROM 'Transaction' t
        JOIN SalesProfile sp ON t.perfilId = sp.id
        WHERE sp.nombre_perfil != 'PERFIL_GENERICO'
        GROUP BY sp.nombre_perfil
        ORDER BY COUNT(*) DESC
        LIMIT 10
    '''
    cursor.execute(query)
    rows = cursor.fetchall()
    
    if rows:
        print("Top Enriched Profiles:")
        for r in rows:
            print(f"  {r[0]}: {r[1]} transactions")
    else:
        print("⚠ No enriched profiles found (Everything is GENERICO?).")

    # Check for 0-value operational records
    cursor.execute("SELECT COUNT(*) FROM 'Transaction' WHERE monto = 0")
    zero_count = cursor.fetchone()[0]
    print(f"\nOperational Records (Amount 0) created from Notion: {zero_count}")
    
    conn.close()

if __name__ == '__main__':
    check_enrichment()
