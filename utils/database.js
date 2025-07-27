// utils/database.js

const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

// [NEW] กำหนดค่าคงที่สำหรับเส้นทางไฟล์ข้อมูลเดิมและไฟล์ฐานข้อมูลใหม่
const dbFilePath = path.join(process.cwd(), 'doujinshi.sqlite');
const mangasJsonPath = path.join(process.cwd(), 'mangas.json');
const usersJsonPath = path.join(process.cwd(), 'users.json');

// [NEW] สร้าง instance ของฐานข้อมูล
// verbose: console.log จะแสดงคำสั่ง SQL ที่รันทุกครั้ง (ดีมากสำหรับ Debug)
const db = new Database(dbFilePath, { verbose: console.log });

/**
 * [NEW] ฟังก์ชันสำหรับสร้าง Table และย้ายข้อมูลจาก JSON มายัง SQLite (ถ้าจำเป็น)
 * ฟังก์ชันนี้จะทำงานแค่ครั้งแรกที่เซิร์ฟเวอร์เริ่มทำงานและไม่พบ Table ที่ต้องการ
 */
function initializeDatabase() {
    console.log('Initializing database...');

    // ตรวจสอบว่า Table 'mangas' มีอยู่หรือไม่
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'mangas'").get();

    if (!tableCheck) {
        console.log('Tables not found. Creating new tables and migrating data...');

        // สร้าง Table 'users'
        db.exec(`
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                bookmarks TEXT DEFAULT '[]',
                readProgress TEXT DEFAULT '{}'
            )
        `);

        // สร้าง Table 'mangas'
        db.exec(`
            CREATE TABLE mangas (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT,
                coverUrl TEXT,
                description TEXT,
                chapters TEXT DEFAULT '[]',
                views INTEGER DEFAULT 0,
                likes INTEGER DEFAULT 0,
                addedDate TEXT NOT NULL,
                reviews TEXT DEFAULT '[]',
                tags TEXT DEFAULT '[]',
                reviewCount INTEGER DEFAULT 0,
                averageRating REAL DEFAULT 0
            )
        `);
        
        console.log('Tables created successfully.');

        // ย้ายข้อมูลจากไฟล์ JSON (ถ้ามี)
        migrateDataFromJsons();

    } else {
        console.log('Database tables already exist.');
    }
}

/**
 * [NEW] ฟังก์ชันสำหรับอ่านข้อมูลจากไฟล์ JSON และนำเข้าสู่ฐานข้อมูล SQLite
 */
function migrateDataFromJsons() {
    // Migrate Users
    if (fs.existsSync(usersJsonPath)) {
        try {
            const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
            if (Array.isArray(usersData) && usersData.length > 0) {
                const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, username, email, password, bookmarks, readProgress) VALUES (?, ?, ?, ?, ?, ?)');
                const insertManyUsers = db.transaction((users) => {
                    for (const user of users) {
                        insertUser.run(
                            user.id,
                            user.username,
                            user.email,
                            user.password,
                            JSON.stringify(user.bookmarks || []),
                            JSON.stringify(user.readProgress || {})
                        );
                    }
                });
                insertManyUsers(usersData);
                console.log(`Migrated ${usersData.length} users from users.json`);
            }
        } catch (error) {
            console.error('Error migrating users from JSON:', error.message);
        }
    }

    // Migrate Mangas
    if (fs.existsSync(mangasJsonPath)) {
        try {
            const mangasData = JSON.parse(fs.readFileSync(mangasJsonPath, 'utf8'));
            if (Array.isArray(mangasData) && mangasData.length > 0) {
                 const insertManga = db.prepare('INSERT OR IGNORE INTO mangas (id, title, author, coverUrl, description, chapters, views, likes, addedDate, reviews, tags, reviewCount, averageRating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                const insertManyMangas = db.transaction((mangas) => {
                    for (const manga of mangas) {
                        insertManga.run(
                            manga.id,
                            manga.title,
                            manga.author,
                            manga.coverUrl,
                            manga.description,
                            JSON.stringify(manga.chapters || []),
                            manga.views || 0,
                            manga.likes || 0,
                            manga.addedDate,
                            JSON.stringify(manga.reviews || []),
                            JSON.stringify(manga.tags || []),
                            manga.reviewCount || 0,
                            manga.averageRating || 0
                        );
                    }
                });
                insertManyMangas(mangasData);
                console.log(`Migrated ${mangasData.length} mangas from mangas.json`);
            }
        } catch (error) {
            console.error('Error migrating mangas from JSON:', error.message);
        }
    }
}


// [NEW] Export ตัวแปร db และฟังก์ชัน initializeDatabase
// เพื่อให้ไฟล์อื่นสามารถนำไปใช้งานได้
module.exports = {
    db,
    initializeDatabase
};