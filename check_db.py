import sqlite3

DB_PATH = 'prisma/dev.db'

def check_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check Counts
    cursor.execute("SELECT COUNT(*) FROM Client")
    client_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM 'Transaction'")
    tx_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM InventoryAccount")
    account_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM SalesProfile")
    profile_count = cursor.fetchone()[0]
    
    print(f"Clients: {client_count}")
    print(f"Transactions: {tx_count}")
    print(f"Accounts: {account_count}")
    print(f"Profiles: {profile_count}")
    
    # Check Sum
    cursor.execute("SELECT SUM(monto) FROM 'Transaction'")
    total_sales = cursor.fetchone()[0]
    print(f"Total Sales (SQL): {total_sales}")
    
    # Check a few transactions
    print("\nSample Transactions:")
    cursor.execute("SELECT * FROM 'Transaction' LIMIT 5")
    for row in cursor.fetchall():
        print(row)

    conn.close()

if __name__ == '__main__':
    check_db()
