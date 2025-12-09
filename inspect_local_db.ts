
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'

async function inspect() {
    const db = await open({
        filename: path.join(process.cwd(), 'dev.db'),
        driver: sqlite3.Database
    })

    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'")
    console.log('Tables:', tables.map(t => t.name))

    for (const t of tables) {
        if (t.name === 'sqlite_sequence' || t.name === '_prisma_migrations') continue
        const count = await db.get(`SELECT COUNT(*) as c FROM "${t.name}"`)
        console.log(`${t.name} Count: ${count.c}`)
    }

    await db.close()
}

inspect()
