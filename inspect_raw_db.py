
import sqlite3

def check_raw():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    print("Checking for NON-INTEGER dates...", flush=True)
    cursor.execute("SELECT id, fecha_inicio, typeof(fecha_inicio) FROM 'Transaction' WHERE typeof(fecha_inicio) != 'integer' LIMIT 5")
    rows = cursor.fetchall()
    
    if not rows:
        print("All dates are INTEGERS (Good).", flush=True)
    else:
        print(f"Found sample bad rows!", flush=True)
        for r in rows:
            print(f"ID: {r[0]}, Val: {r[1]}, Type: {r[2]}", flush=True)

    # Also check count
    cursor.execute("SELECT COUNT(*) FROM 'Transaction' WHERE typeof(fecha_inicio) = 'text'")
    text_count = cursor.fetchone()[0]
    print(f"Total Text Dates: {text_count}", flush=True)

    conn.close()

if __name__ == '__main__':
    check_raw()
