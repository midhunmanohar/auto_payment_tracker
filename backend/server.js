const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const multer = require('multer');
const fs = require('fs');

const cron = require('node-cron');

// ==========================================
// --- TELEGRAM BOT CONFIGURATION ---
// ==========================================
const TELEGRAM_BOT_TOKEN = '8728072022:AAHfRYizn_M4Du_C5YOv_WMjGUza60FiCy8'; 
const TELEGRAM_CHAT_ID = '-1003938639931'; // e.g., -1001234567890

async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
//        console.log("Attempting to send Telegram message to:", TELEGRAM_CHAT_ID);
        
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        const data = await res.json();
//        console.log("TELEGRAM RESPONSE:", data); // This is the golden ticket!
    } catch (err) {
        console.error("TELEGRAM CRASH:", err);
    }
}

// Create a 'receipts' folder safely inside your persistent data directory
const receiptsDir = path.join(__dirname, 'data', 'receipts');
if (!fs.existsSync(receiptsDir)){
    fs.mkdirSync(receiptsDir, { recursive: true });
}

// Teach multer how to save the files (Naming them: FlatNumber-Timestamp.jpg)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, receiptsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, req.body.flatNumber + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// Allow the frontend to view these saved images later
app.use('/receipts', express.static(receiptsDir));

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
                payment_method TEXT CHECK(payment_method IN ('UPI', 'Bank Transfer (ICICI)', 'Other','UPI (Assoc Acc)','Bank Transfer (Assoc Acc)')),
                paid_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(flat_id, payment_month, payment_year),
                FOREIGN KEY (flat_id) REFERENCES flats (id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                announcement TEXT DEFAULT ''
            );

            -- NEW: The True Billing Ledger
            CREATE TABLE IF NOT EXISTS monthly_bills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flat_id INTEGER NOT NULL,
                billing_month INTEGER NOT NULL,
                billing_year INTEGER NOT NULL,
                maintenance_due REAL DEFAULT 2500,
                water_due REAL DEFAULT 0.0,
                total_due REAL DEFAULT 0.0,
                status TEXT DEFAULT 'Pending', 
                receipt_image_path TEXT,
                phone_number TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(flat_id, billing_month, billing_year),
                FOREIGN KEY (flat_id) REFERENCES flats (id)
            );
        `, () => {
            // DATABASE UPGRADES: Safely add new columns if they don't exist
            db.run("ALTER TABLE flats ADD COLUMN is_assoc_member BOOLEAN DEFAULT 0", () => {});
            
            // NEW: Add the maintenance fee setting to the existing table
            db.run("ALTER TABLE settings ADD COLUMN base_maintenance_fee REAL DEFAULT 2500", () => {});

            // NEW: Ensure the settings row actually exists so we can update it later
            db.run("INSERT OR IGNORE INTO settings (id, announcement, base_maintenance_fee) VALUES (1, '', 2500)");

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

// --- UPDATED API ROUTE: Save Payment (Strict Validation) ---
app.post('/payments', (req, res) => {
    const { flatNumber, maintenancePaid, waterPaid, waterAmount, paymentMethod } = req.body;
    
    // NEW LOCK: Prevent empty submissions
    if (!maintenancePaid && !waterPaid) {
        return res.status(400).json({ error: "Please mark at least Maintenance or Water Bill as paid." });
    }
    
    const date = new Date();
    const month = date.getMonth() + 1; 
    const year = date.getFullYear();

    // 1. Check if the Flat exists in our official seeded database
    db.get(`SELECT id FROM flats WHERE flat_number = ?`, [flatNumber], (err, flat) => {
        if (err) return res.status(500).json({ error: "Database error finding flat" });

        // THE LOCK: If the flat isn't found in the 36 valid flats, reject the submission entirely
        if (!flat) {
            return res.status(400).json({ 
                error: `Invalid Flat Number: ${flatNumber}. Please enter a valid flat (e.g., 001-009, 101-109, etc.).` 
            });
        }

        // 2. Attempt to insert the payment record
        const query = `INSERT INTO payments 
            (flat_id, payment_month, payment_year, maintenance_paid, water_paid, water_amount, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
        db.run(query, [flat.id, month, year, maintenancePaid, waterPaid, waterAmount, paymentMethod], function(err) {
            if (err) {
                // NEW: Smart Recovery - If they already paid, look up their existing record and give them the ID back
                if (err.message.includes('UNIQUE constraint failed')) {
                    db.get(`SELECT id FROM payments WHERE flat_id = ? AND payment_month = ? AND payment_year = ?`, 
                    [flat.id, month, year], (lookupErr, existingPayment) => {
                        if (lookupErr || !existingPayment) {
                            return res.status(400).json({ error: `Payment already recorded for Flat ${flatNumber} this month.` });
                        }
                        const monthStr = month.toString().padStart(2, '0');
                        const receiptId = `TXN-${year}${monthStr}-${existingPayment.id}`;
                        return res.status(400).json({ 
                            error: `Flat ${flatNumber} already paid this month. Reference ID: ${receiptId}` 
                        });
                    });
                    return; // Stop execution here so we don't send multiple responses
                }
                return res.status(500).json({ error: "Failed to save payment." });
            }
            
            // Generate the Reference ID for a successful new payment
            const monthStr = month.toString().padStart(2, '0');
            const receiptId = `TXN-${year}${monthStr}-${this.lastID}`;
            
            res.json({ message: `✅ Payment recorded! Reference ID: ${receiptId}` });
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

app.put('/admin/payments/:id', (req, res) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });

    const paymentId = req.params.id;
    const { maintenancePaid, waterPaid, waterAmount, paymentMethod } = req.body;

    const query = `
        UPDATE payments 
        SET maintenance_paid = ?, water_paid = ?, water_amount = ?, payment_method = ?
        WHERE id = ?
    `;

    db.run(query, [maintenancePaid, waterPaid, waterAmount, paymentMethod, paymentId], function(err) {
        if (err) return res.status(500).json({ error: "Database error." });
        res.json({ message: "Payment updated successfully" });
    });
});

// --- NEW API ROUTES: Global Announcement ---

// PUBLIC: For the resident frontend to fetch the notice
app.get('/announcement', (req, res) => {
    db.get(`SELECT announcement FROM settings WHERE id = 1`, [], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ announcement: row ? row.announcement : "" });
    });
});

// PROTECTED: For the Admin to update the notice
app.post('/admin/announcement', (req, res) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    const { announcement } = req.body;
    db.run(`UPDATE settings SET announcement = ? WHERE id = 1`, [announcement], (err) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ message: "Announcement updated!" });
    });
});
// ==========================================
// --- NEW: TRUE BILLING SYSTEM API ROUTES ---
// ==========================================

// 1. Get Global Settings (Maintenance Fee)
app.get('/admin/settings', (req, res) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    db.get(`SELECT base_maintenance_fee FROM settings WHERE id = 1`, [], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(row || { base_maintenance_fee: 2500 });
    });
});

// 2. Update Global Settings
app.post('/admin/settings', (req, res) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    const { base_maintenance_fee } = req.body;
    db.run(`UPDATE settings SET base_maintenance_fee = ? WHERE id = 1`, [base_maintenance_fee], (err) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ message: "Settings updated successfully!" });
    });
});

// 3. Generate Monthly Bills (The "Magic" Button)
app.post('/admin/generate-bills', (req, res) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    const { month, year } = req.body;

    // First, get the current maintenance fee from settings
    db.get(`SELECT base_maintenance_fee FROM settings WHERE id = 1`, [], (err, setting) => {
        const fee = setting ? setting.base_maintenance_fee : 2500;

        // Next, get all occupied flats
        db.all(`SELECT id FROM flats WHERE status = 'Occupied'`, [], (err, flats) => {
            if (err) return res.status(500).json({ error: "Error fetching flats" });

            // Insert a blank bill for every occupied flat IF one doesn't already exist
            // (The UNIQUE constraint in the DB prevents duplicate bills from being created)
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO monthly_bills 
                (flat_id, billing_month, billing_year, maintenance_due, total_due) 
                VALUES (?, ?, ?, ?, ?)
            `);
            
            flats.forEach(flat => {
                stmt.run([flat.id, month, year, fee, fee]); // Total starts as just the maintenance fee
            });
            
            stmt.finalize(() => {
                res.json({ message: `Successfully generated bills for ${month}/${year}` });
            });
        });
    });
});

// 4. Fetch Bills for a Specific Month
app.get('/admin/monthly-bills', (req, res) => {
    const { month, year } = req.query;
    db.all(`
        SELECT b.*, f.flat_number, f.is_vacant 
        FROM monthly_bills b
        JOIN flats f ON b.flat_id = f.id
        WHERE b.billing_month = ? AND b.billing_year = ?
        ORDER BY f.flat_number ASC
    `, [month, year], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

// 5. Update a Specific Bill (Adding Water Amount)
app.put('/admin/monthly-bills/:id', (req, res) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    
    const billId = req.params.id;
    const { water_due, total_due } = req.body;
    
    db.run(`UPDATE monthly_bills SET water_due = ?, total_due = ? WHERE id = ?`, 
        [water_due, total_due, billId], 
        function(err) {
            if (err) return res.status(500).json({ error: "Database error" });
            res.json({ message: "Bill updated successfully" });
        }
    );
});

// Toggle Vacancy Status for a Flat
app.put('/admin/flats/:flatNumber/vacancy', (req, res) => {
    const { is_vacant } = req.body;
    db.run(`UPDATE flats SET is_vacant = ? WHERE flat_number = ?`, [is_vacant ? 1 : 0, req.params.flatNumber], function(err) {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ message: "Vacancy updated" });
    });
});
// ==========================================
// --- NEW: RESIDENT BILLING API ROUTES ---
// ==========================================

// 1. Fetch a flat's bill for the current month
app.get('/resident/bill/:flat', (req, res) => {
    const flatNumber = req.params.flat;
    const date = new Date();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Step 1: Safely find the Flat ID first (No JOINs!)
    db.get(`SELECT id, flat_number FROM flats WHERE flat_number = ?`, [flatNumber], (err, flat) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!flat) return res.status(404).json({ error: "Invalid Flat Number" });

        // Step 2: Use db.all to fetch the bill to avoid the sqlite3 memory crash
        db.all(`
            SELECT * FROM monthly_bills 
            WHERE flat_id = ? AND billing_month = ? AND billing_year = ?
        `, [flat.id, month, year], (err, rows) => {
            if (err) return res.status(500).json({ error: "Database error" });
            
            const bill = rows.length > 0 ? rows[0] : null;
            if (!bill) return res.status(404).json({ error: "No bill generated for this month yet. Please check back later." });
            
            // Attach the flat number so the frontend can display it cleanly
            bill.flat_number = flat.flat_number;
            res.json(bill);
        });
    });
});

// 2. Submit payment screenshot and phone number
app.post('/resident/pay', upload.single('receipt'), (req, res) => {
    const { billId, flatNumber, phoneNumber } = req.body;
    
    const receiptPath = req.file ? '/receipts/' + req.file.filename : null;
    if (!receiptPath) return res.status(400).json({ error: "Receipt screenshot is required." });

    db.run(`
        UPDATE monthly_bills 
        SET status = 'Paid', phone_number = ?, receipt_image_path = ? 
        WHERE id = ?
    `, [phoneNumber, receiptPath, billId], function(err) {
        if (err) return res.status(500).json({ error: "Database error" });
        
        // NEW: Fire the Telegram notification!
        sendTelegramMessage(`✅ <b>Payment Received</b>\nFlat <b>${flatNumber}</b> has just uploaded their payment receipt.`);

        res.json({ message: "✅ Payment submitted successfully! The Admin will review your receipt." });
    });
});

// ==========================================
// --- SCHEDULED TASKS (CRON JOBS) ---
// ==========================================

// Run every morning at 7:00 AM IST
cron.schedule('0 7 * * *', () => {
    const date = new Date();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    db.all(`
        SELECT f.flat_number 
        FROM monthly_bills b
        JOIN flats f ON b.flat_id = f.id
        WHERE b.billing_month = ? AND b.billing_year = ? AND b.status != 'Paid' AND f.is_vacant = 0
        ORDER BY f.flat_number ASC
    `, [month, year], (err, rows) => {
        if (err) return;
        
        // If everyone paid, don't send a message!
        if (!rows || rows.length === 0) {
            sendTelegramMessage(`🎉 <b>Daily Update</b>\nAll occupied flats have paid for ${month}/${year}!`);
            return;
        }
        
        // Format the list of flats
        const unpaidFlats = rows.map(r => r.flat_number).join(', ');
        
        const message = `🔔 <b>Daily Payment Reminder</b>\nMonth: ${month}/${year}\n\nThe following occupied flats are pending payment:\n<b>${unpaidFlats}</b>`;
        
        sendTelegramMessage(message);
    });
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
