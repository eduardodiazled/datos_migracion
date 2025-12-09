import pandas as pd
import sqlite3
import re
from fuzzywuzzy import process, fuzz
from datetime import datetime

# Configuration
DB_PATH = 'dev.db'
CONTACTS_CSV = 'contacts.csv'
TREINTA_CSV = 'treinta.csv'
NOTION_CSV = 'notion.csv'

def sanitize_phone(phone):
    if pd.isna(phone):
        return None
    # Remove non-digits
    clean = re.sub(r'\D', '', str(phone))
    # Remove leading 57 if present (Colombia)
    if clean.startswith('57') and len(clean) > 10:
        clean = clean[2:]
    return clean

def clean_name(name):
    if pd.isna(name):
        return "Unknown"
    # Remove common suffixes and emojis
    name = re.sub(r'\s*(Nfx|Disney|Streaming|🎬|📺).*$', '', str(name), flags=re.IGNORECASE)
    return name.strip()

def migrate():
    print("Starting Migration...")
    
    # 1. Connect to DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 2. Load Data (Mocking if files don't exist for dev)
    try:
        contacts = pd.read_csv(CONTACTS_CSV)
        treinta = pd.read_csv(TREINTA_CSV)
        notion = pd.read_csv(NOTION_CSV)
    except FileNotFoundError:
        print("CSV files not found. Please place contacts.csv, treinta.csv, and notion.csv in the root.")
        return

    print(f"Loaded {len(contacts)} contacts, {len(treinta)} transactions, {len(notion)} credentials.")

    # 3. Process Clients (Google Contacts)
    print("Processing Clients...")
    clients_to_insert = []
    
    # Assuming columns: 'Name', 'Phone 1 - Value'
    for _, row in contacts.iterrows():
        raw_name = row.get('Name', row.get('Given Name', 'Unknown'))
        raw_phone = row.get('Phone 1 - Value', row.get('Phone 1', ''))
        
        phone = sanitize_phone(raw_phone)
        name = clean_name(raw_name)
        
        if phone:
            clients_to_insert.append((phone, name, datetime.now(), datetime.now()))

    # Insert Clients (Ignore duplicates)
    cursor.executemany('''
        INSERT OR IGNORE INTO Client (celular, nombre, createdAt, updatedAt)
        VALUES (?, ?, ?, ?)
    ''', clients_to_insert)
    
    print(f"Inserted {cursor.rowcount} clients.")

    # 4. Process Inventory (Notion)
    # Assuming columns: 'Service', 'Email', 'Password', 'Profile', 'PIN'
    print("Processing Inventory...")
    
    # Group by Account (Email)
    accounts = notion.groupby('Email')
    
    for email, group in accounts:
        first = group.iloc[0]
        service = first.get('Service', 'Netflix')
        password = first.get('Password', '1234')
        
        # Create Account
        cursor.execute('''
            INSERT INTO InventoryAccount (servicio, tipo, email, password, createdAt, updatedAt)
            VALUES (?, 'ESTATICO', ?, ?, ?, ?)
        ''', (service, email, password, datetime.now(), datetime.now()))
        
        account_id = cursor.lastrowid
        
        # Create Profiles
        for _, row in group.iterrows():
            profile_name = row.get('Profile', 'Per 1')
            pin = str(row.get('PIN', ''))
            
            cursor.execute('''
                INSERT INTO SalesProfile (nombre_perfil, pin, estado, accountId, createdAt, updatedAt)
                VALUES (?, ?, 'LIBRE', ?, ?, ?)
            ''', (profile_name, pin, account_id, datetime.now(), datetime.now()))

    print("Inventory processed.")

    # 5. Process Transactions (Treinta) & Link
    print("Linking Transactions...")
    
    # Get all clients for matching
    cursor.execute("SELECT celular, nombre FROM Client")
    db_clients = cursor.fetchall()
    client_map = {c[1]: c[0] for c in db_clients} # Name -> Phone
    client_names = list(client_map.keys())
    
    for _, row in treinta.iterrows():
        t_name = clean_name(row.get('Cliente', ''))
        amount = row.get('Monto', 0)
        date_str = row.get('Fecha', datetime.now().strftime('%Y-%m-%d'))
        
        # Fuzzy Match Name
        match, score = process.extractOne(t_name, client_names, scorer=fuzz.token_sort_ratio)
        
        if score > 80:
            phone = client_map[match]
            
            # Create Transaction (Dummy profile assignment for now)
            cursor.execute('''
                INSERT INTO "Transaction" (clienteId, perfilId, estado_pago, fecha_inicio, fecha_vencimiento, monto, createdAt, updatedAt)
                VALUES (?, 1, 'PAGADO', ?, ?, ?, ?, ?)
            ''', (phone, date_str, date_str, amount, datetime.now(), datetime.now()))
            
    print("Transactions linked.")
    
    conn.commit()
    conn.close()
    print("Migration Complete!")

if __name__ == '__main__':
    migrate()
