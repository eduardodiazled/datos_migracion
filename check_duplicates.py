
import sqlite3

def check_duplicates():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    # Check for duplicates based on Date, Client, Amount
    # Note: Client is stored as ID (phone).
    query = '''
        SELECT 
            fecha_inicio,
            clienteId,
            monto,
            COUNT(*) as count
        FROM 'Transaction'
        GROUP BY fecha_inicio, clienteId, monto
        HAVING count > 1
        ORDER BY count DESC
        LIMIT 20
    '''
    
    cursor.execute(query)
    rows = cursor.fetchall()
    
    total_duplicates = 0
    if rows:
        print(f"Found potential duplicates (Top 20):")
        for r in rows:
            print(f"  Date: {r[0]}, Client: {r[1]}, Amount: {r[2]} -> Count: {r[3]}")
            total_duplicates += (r[3] - 1)
        
        # Get total count of extra rows
        cursor.execute('''
            SELECT SUM(count - 1)
            FROM (
                SELECT COUNT(*) as count
                FROM 'Transaction'
                GROUP BY fecha_inicio, clienteId, monto
                HAVING count > 1
            )
        ''')
        total_extra = cursor.fetchone()[0]
        print(f"\nTotal estimated duplicate rows to remove: {total_extra}")
    else:
        print("No duplicates found based on (Date, Client, Amount).")

    conn.close()

if __name__ == '__main__':
    check_duplicates()
