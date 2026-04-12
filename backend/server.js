const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'societypay.sqlite');

app.use(cors());
app.use(express.json());

// Initialize Database connection
// Initialize Database connection & Auto-Seeder
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to SQLite database at', DB_PATH);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS flats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flat_number TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'Occupied'
            );
            
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flat_id INTEGER NOT NULL,
                payment_month INTEGER NOT NULL,
                payment_year INTEGER NOT NULL,
                maintenance_paid BOOLEAN DEFAULT 0,
                water_paid BOOLEAN DEFAULT 0,
                water_amount REAL DEFAULT 0.0,
                payment_method TEXT CHECK(payment_method IN ('UPI', 'Bank Transfer (ICICI)', 'Other')),
                paid_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(flat_id, payment_month, payment_year),
                FOREIGN KEY (flat_id) REFERENCES flats (id)
            );
        `, () => {
            // DATABASE UPGRADE: Safely add the new column if it doesn't exist yet
            db.run("ALTER TABLE flats ADD COLUMN is_assoc_member BOOLEAN DEFAULT 0", (err) => {
                // We ignore the error here because it just means the column already exists!
            });

            // AUTO-SEEDER
            const flatsToSeed = [];
            [0, 100, 200, 300].forEach(base => {
                for(let i=1; i<=9; i++) {
                    let num = (base + i).toString();
                    if (num.length === 1) num = '00' + num;
                    if (num.length === 2) num = '0' + num;
                    flatsToSeed.push(num);
                }
            });

            const stmt = db.prepare("INSERT OR IGNORE INTO flats (flat_number) VALUES (?)");
            flatsToSeed.forEach(flat => stmt.run(flat));
            stmt.finalize();
        });
    }
});

// Health check route
app.get('/', (req, res) => {
    res.json({ message: "SocietyPay API is running! 🚀" });
});

// --- NEW API ROUTE: Save Payment ---
app.post('/payments', (req, res) => {
    const { flatNumber, maintenancePaid, waterPaid, waterAmount, paymentMethod } = req.body;
    
    // Get current month and year
    const date = new Date();
    const month = date.getMonth() + 1; 
    const year = date.getFullYear();

    // 1. Ensure the Flat exists in the database
    db.run(`INSERT OR IGNORE INTO flats (flat_number) VALUES (?)`, [flatNumber], function(err) {
        
        // 2. Get the flat's internal ID
        db.get(`SELECT id FROM flats WHERE flat_number = ?`, [flatNumber], (err, flat) => {
            if (!flat) return res.status(500).json({ error: "Database error finding flat" });

            // 3. Attempt to insert the payment record
            const query = `INSERT INTO payments 
                (flat_id, payment_month, payment_year, maintenance_paid, water_paid, water_amount, payment_method)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
                
            db.run(query, [flat.id, month, year, maintenancePaid, waterPaid, waterAmount, paymentMethod], function(err) {
                if (err) {
                    // This catches the "UNIQUE" lock we set up in the schema!
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: `Payment already recorded for Flat ${flatNumber} this month.` });
                    }
                    return res.status(500).json({ error: "Failed to save payment." });
                }
                res.json({ message: "✅ Payment successfully recorded!" });
            });
        });
    });
});

// --- NEW API ROUTE: Admin Data Fetch ---
// In production, this pulls from your docker-compose environment variables
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

app.get('/admin/payments', (req, res) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    const query = `
        SELECT p.*, f.flat_number, f.is_assoc_member 
        FROM payments p JOIN flats f ON p.flat_id = f.id 
        ORDER BY p.payment_year DESC, p.payment_month DESC, p.created_at DESC
    `;
    db.all(query, [], (err, rows) => res.json(rows || []));
});

// --- NEW API ROUTE: Get Pending Flats for Current Month ---
app.get('/admin/pending', (req, res) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    const date = new Date();
    const query = `
        SELECT f.flat_number, f.status, f.is_assoc_member 
        FROM flats f LEFT JOIN payments p ON f.id = p.flat_id AND p.payment_month = ? AND p.payment_year = ?
        WHERE (p.id IS NULL OR p.maintenance_paid = 0 OR p.water_paid = 0) AND f.status = 'Occupied'
        ORDER BY f.flat_number ASC
    `;
    db.all(query, [date.getMonth() + 1, date.getFullYear()], (err, rows) => res.json(rows || []));
});

// --- NEW API ROUTE: Update Flat Status ---
app.post('/admin/flats/status', (req, res) => {
    const providedPassword = req.headers['x-admin-password'];
    if (providedPassword !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });

    const { flatNumber, status } = req.body;
    
    db.run(`UPDATE flats SET status = ? WHERE flat_number = ?`, [status, flatNumber], function(err) {
        if (err) return res.status(500).json({ error: "Database error." });
        res.json({ message: "Status updated successfully" });
    });
});

// --- NEW API ROUTE: Get Vacant Flats ---
app.get('/admin/flats/vacant', (req, res) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    db.all(`SELECT flat_number, status, is_assoc_member FROM flats WHERE status = 'Vacant' ORDER BY flat_number ASC`, [], (err, rows) => res.json(rows || []));
});

// NEW ROUTE: Toggle Association Member Status
app.post('/admin/flats/assoc', (req, res) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    const { flatNumber, isAssoc } = req.body;
    db.run(`UPDATE flats SET is_assoc_member = ? WHERE flat_number = ?`, [isAssoc ? 1 : 0, flatNumber], (err) => {
        if (err) return res.status(500).json({ error: "Database error." });
        res.json({ message: "Association status updated" });
    });
});
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
