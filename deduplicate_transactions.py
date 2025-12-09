
import sqlite3

def deduplicate():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    print("Deduplicating transactions (keeping 1 per Date+Client+Amount)...")
    
    # SQLite logic to delete duplicates
    # We delete rows that are NOT the minimum ID for their group
    query = '''
        DELETE FROM "Transaction"
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM "Transaction"
            GROUP BY fecha_inicio, clienteId, monto
        )
    '''
    
    cursor.execute(query)
    rows_deleted = cursor.rowcount
    print(f"Deleted {rows_deleted} duplicate rows.")
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    deduplicate()
