
import sqlite3
from collections import Counter
import re

def inspect_potential_expenses():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    # 2024 Timestamp range
    start_2024 = 1704067200000
    end_2024 = 1735689600000
    
    print("Scanning POSITIVE transactions in 2024 for suspicious keywords...")
    cursor.execute("SELECT clienteId, monto, id FROM 'Transaction' WHERE monto > 0 AND fecha_inicio >= ? AND fecha_inicio < ?", (start_2024, end_2024))
    rows = cursor.fetchall()
    
    # Get client names
    client_ids = [r[0] for r in rows]
    placeholders = ','.join('?' for _ in client_ids)
    
    # This is inefficient for 4000 rows, but SQLite is fast.
    # Better: Join with Client table.
    
    cursor.execute(f"""
        SELECT c.nombre, t.monto, t.id 
        FROM 'Transaction' t
        JOIN Client c ON t.clienteId = c.celular
        WHERE t.monto > 0 AND t.fecha_inicio >= ? AND t.fecha_inicio < ?
    """, (start_2024, end_2024))
    
    results = cursor.fetchall()
    
    words = Counter()
    suspicious_keywords = ['pago', 'cancel', 'nomina', 'arriendo', 'servicios', 'luz', 'agua', 'gas', 'internet', 'plan', 'comision', 'impuesto', 'retencion', 'proveedor', 'suscripcion', 'mensualidad']
    
    suspicious_txs = []
    
    for name, amount, tx_id in results:
        name_lower = name.lower()
        
        # Count words
        for w in name_lower.split():
            if len(w) > 3:
                words[w] += 1
        
        # Check suspicious
        for kw in suspicious_keywords:
            if kw in name_lower:
                suspicious_txs.append((kw, name, amount, tx_id))
    
    print("\n--- Most Frequent Words in Impact Descriptions (Top 20) ---")
    for w, count in words.most_common(20):
        print(f"{w}: {count}")
        
    print("\n--- Potential Hidden Expenses Found (Sorted by Value) ---")
    suspicious_txs.sort(key=lambda x: x[2], reverse=True)
    
    count = 0
    for kw, name, amount, tx_id in suspicious_txs:
        # Ignore "Luz/Gas" if it looks like a name (e.g. Luz Maria)
        if kw in ['luz', 'gas', 'pago', 'pagada']:
             continue 
             
        print(f"[{kw.upper()}] {name[:60]}... : ${amount:,.0f} (ID: {tx_id})")
        count += 1
        if count > 50: break
            
    conn.close()

if __name__ == '__main__':
    inspect_potential_expenses()
