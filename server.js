require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure required directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BUNDLES_DIR = path.join(UPLOADS_DIR, 'bundles');
const COVERS_DIR = path.join(UPLOADS_DIR, 'covers');
const DATA_FILE = path.join(__dirname, 'db.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(BUNDLES_DIR)) fs.mkdirSync(BUNDLES_DIR);
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR);

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));
// Serve covers statically so landing page can fetch them
app.use('/uploads/covers', express.static(COVERS_DIR));

// DB Helpers (simple JSON file database)
function readDB() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = { bundles: [], purchases: [], tokens: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading database file:", err);
    return { bundles: [], purchases: [], tokens: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'coverImage') {
      cb(null, COVERS_DIR);
    } else {
      cb(null, BUNDLES_DIR);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// API Routes

// 1. Get current course bundle (returns the latest uploaded bundle)
app.get('/api/bundle', (req, res) => {
  const db = readDB();
  if (db.bundles.length === 0) {
    return res.status(404).json({ error: "No course bundles available yet. Please upload one in the admin dashboard." });
  }
  // Return the latest bundle
  const latest = db.bundles[db.bundles.length - 1];
  
  // Return public metadata (exclude internal filename)
  const publicMetadata = {
    id: latest.id,
    title: latest.title,
    description: latest.description,
    price: latest.price,
    features: latest.features,
    coverImage: latest.coverImage ? `/uploads/covers/${path.basename(latest.coverImage)}` : null,
    uploadDate: latest.uploadDate
  };
  
  res.json(publicMetadata);
});

// 1b. Get all course bundles
app.get('/api/bundles', (req, res) => {
  const db = readDB();
  const publicBundles = db.bundles.map(b => ({
    id: b.id,
    title: b.title,
    description: b.description,
    price: b.price,
    features: b.features,
    coverImage: b.coverImage ? `/uploads/covers/${path.basename(b.coverImage)}` : null,
    uploadDate: b.uploadDate
  }));
  res.json(publicBundles);
});

// 2. Upload course bundle (Admin only, uses basic security for demo/local use)
app.post('/api/admin/upload', upload.fields([
  { name: 'bundleFile', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), (req, res) => {
  try {
    const { title, description, price, features } = req.body;
    
    if (!req.files || !req.files.bundleFile) {
      return res.status(400).json({ error: "Course bundle file is required." });
    }

    const bundleFile = req.files.bundleFile[0];
    const coverFile = req.files.coverImage ? req.files.coverImage[0] : null;

    // Parse features (comma separated or JSON array)
    let parsedFeatures = [];
    if (features) {
      try {
        parsedFeatures = JSON.parse(features);
      } catch (e) {
        parsedFeatures = features.split(',').map(f => f.trim()).filter(Boolean);
      }
    }

    const db = readDB();
    const newBundle = {
      id: uuidv4(),
      title: title || 'Unnamed Course Bundle',
      description: description || '',
      price: parseFloat(price) || 0,
      features: parsedFeatures,
      fileName: bundleFile.filename,
      originalName: bundleFile.originalname,
      coverImage: coverFile ? coverFile.filename : null,
      uploadDate: new Date().toISOString(),
      downloads: 0
    };

    db.bundles.push(newBundle);
    writeDB(db);

    res.status(201).json({ success: true, bundle: newBundle });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Server error during upload: " + error.message });
  }
});

// 3. Checkout / Payment
app.post('/api/checkout', async (req, res) => {
  const { bundleId, email, name } = req.body;
  if (!bundleId) {
    return res.status(400).json({ error: "Bundle ID is required." });
  }

  const db = readDB();
  const bundle = db.bundles.find(b => b.id === bundleId);
  if (!bundle) {
    return res.status(404).json({ error: "Bundle not found." });
  }

  const PHONEPE_MID = process.env.PHONEPE_MID;
  const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;
  const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";
  const PHONEPE_HOST = process.env.PHONEPE_HOST || "https://api.phonepe.com/apis/hermes";

  // Check if PhonePe credentials are configuration active
  if (PHONEPE_MID && PHONEPE_SALT_KEY) {
    // REAL PHONEPE TRANSACTION GATEWAY INTEGRATION
    const merchantTransactionId = "TXN" + Date.now();
    const amountInPaise = Math.round(bundle.price * 100);

    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host');
    const redirectUrl = `${protocol}://${host}/api/phonepe/callback?bundleId=${bundle.id}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;

    const payPayload = {
      merchantId: PHONEPE_MID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: "USER_" + email.replace(/[^a-zA-Z0-9]/g, "_"),
      amount: amountInPaise,
      redirectUrl: redirectUrl,
      redirectMode: "POST",
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(payPayload), 'utf8').toString('base64');
    const stringToSign = base64Payload + "/pg/v1/pay" + PHONEPE_SALT_KEY;
    const sha256Checksum = crypto.createHash('sha256').update(stringToSign).digest('hex');
    const xVerifyHeader = sha256Checksum + "###" + PHONEPE_SALT_INDEX;

    try {
      const response = await axios.post(`${PHONEPE_HOST}/pg/v1/pay`, {
        request: base64Payload
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerifyHeader
        }
      });

      if (response.data.success) {
        const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;
        return res.json({
          success: true,
          redirectUrl: redirectUrl
        });
      } else {
        return res.status(400).json({ error: "Failed to initialize payment with PhonePe." });
      }
    } catch (err) {
      console.error("PhonePe Pay Error:", err.response ? err.response.data : err.message);
      return res.status(500).json({ error: "Payment gateway error: " + err.message });
    }
  }

  // FALLBACK TO SIMULATED SANDBOX PAYMENTS
  const purchaseId = uuidv4();
  const purchase = {
    id: purchaseId,
    bundleId: bundle.id,
    bundleTitle: bundle.title,
    amount: bundle.price,
    customerName: name || 'Guest Customer',
    customerEmail: email || 'guest@example.com',
    timestamp: new Date().toISOString()
  };

  db.purchases.push(purchase);

  // Generate a secure download token
  const downloadToken = uuidv4();
  const tokenRecord = {
    token: downloadToken,
    bundleId: bundle.id,
    purchaseId: purchaseId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes expiration
    maxDownloads: 3,
    downloadCount: 0
  };

  db.tokens.push(tokenRecord);
  writeDB(db);

  res.json({
    success: true,
    message: "Payment processed successfully (Sandbox)!",
    downloadToken: downloadToken,
    downloadUrl: `/download/${downloadToken}`
  });
});

// 3b. PhonePe Callback/Status Check Endpoint
app.post('/api/phonepe/callback', async (req, res) => {
  const { bundleId, email, name } = req.query;
  const { merchantId, transactionId } = req.body;

  const PHONEPE_MID = process.env.PHONEPE_MID;
  const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;
  const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";
  const PHONEPE_HOST = process.env.PHONEPE_HOST || "https://api.phonepe.com/apis/hermes";

  if (!transactionId) {
    return res.status(400).send("<h1>Payment transaction reference missing.</h1>");
  }

  // Calculate Checksum for status check API
  const stringToSign = `/pg/v1/status/${PHONEPE_MID}/${transactionId}` + PHONEPE_SALT_KEY;
  const sha256Checksum = crypto.createHash('sha256').update(stringToSign).digest('hex');
  const xVerifyHeader = sha256Checksum + "###" + PHONEPE_SALT_INDEX;

  try {
    const statusResponse = await axios.get(`${PHONEPE_HOST}/pg/v1/status/${PHONEPE_MID}/${transactionId}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerifyHeader,
        'X-MERCHANT-ID': PHONEPE_MID
      }
    });

    if (statusResponse.data.success && statusResponse.data.data.responseCode === "SUCCESS") {
      // Payment Successful! Save purchase record and generate download credentials
      const db = readDB();
      const bundle = db.bundles.find(b => b.id === bundleId);
      
      if (!bundle) {
        return res.status(404).send("<h1>Purchased bundle not found.</h1>");
      }

      const purchaseId = uuidv4();
      const purchase = {
        id: purchaseId,
        bundleId: bundle.id,
        bundleTitle: bundle.title,
        amount: bundle.price,
        customerName: decodeURIComponent(name),
        customerEmail: decodeURIComponent(email),
        timestamp: new Date().toISOString()
      };
      db.purchases.push(purchase);

      const downloadToken = uuidv4();
      db.tokens.push({
        token: downloadToken,
        bundleId: bundle.id,
        purchaseId: purchaseId,
        createdAt: Date.now(),
        expiresAt: Date.now() + (15 * 60 * 1000), // Valid for 15 minutes
        maxDownloads: 3,
        downloadCount: 0
      });
      writeDB(db);

      // Redirect user back to storefront success screen
      return res.redirect(`/?payment_status=success&token=${downloadToken}&title=${encodeURIComponent(bundle.title)}`);
    } else {
      return res.redirect('/?payment_status=failed');
    }
  } catch (err) {
    console.error("PhonePe Verification Error:", err.message);
    return res.status(500).send("<h1>Error verifying payment transaction status with PhonePe.</h1>");
  }
});

// 4. Secure File Download Route
app.get('/download/:token', (req, res) => {
  const { token } = req.params;
  const db = readDB();

  // Clean expired tokens from database to save space
  const now = Date.now();
  db.tokens = db.tokens.filter(t => t.expiresAt > now);

  const tokenRecord = db.tokens.find(t => t.token === token);
  if (!tokenRecord) {
    return res.status(403).send("<h1>Download link is expired or invalid.</h1><p>Please contact support if you need assistance.</p>");
  }

  if (tokenRecord.downloadCount >= tokenRecord.maxDownloads) {
    return res.status(403).send("<h1>Download limit exceeded.</h1><p>You have already downloaded this file the maximum number of times.</p>");
  }

  const bundle = db.bundles.find(b => b.id === tokenRecord.bundleId);
  if (!bundle) {
    return res.status(404).send("<h1>File not found.</h1>");
  }

  // Update token stats and total download count
  tokenRecord.downloadCount += 1;
  bundle.downloads = (bundle.downloads || 0) + 1;
  writeDB(db);

  // If Google Drive link is configured, redirect directly to it
  if (bundle.driveUrl) {
    return res.redirect(bundle.driveUrl);
  }

  const filePath = path.join(BUNDLES_DIR, bundle.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("<h1>Course file does not exist on the server.</h1>");
  }

  // Set file headers and stream download (fallback for local files)
  res.setHeader('Content-Description', 'File Transfer');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${bundle.originalName}"`);
  res.setHeader('Content-Transfer-Encoding', 'binary');
  res.setHeader('Expires', '0');
  res.setHeader('Cache-Control', 'must-revalidate');
  res.setHeader('Pragma', 'public');
  res.setHeader('Content-Length', fs.statSync(filePath).size);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// 5. Admin Stats Endpoint
app.get('/api/admin/stats', (req, res) => {
  const db = readDB();
  
  const totalRevenue = db.purchases.reduce((acc, curr) => acc + curr.amount, 0);
  const totalDownloads = db.bundles.reduce((acc, curr) => acc + (curr.downloads || 0), 0);
  
  res.json({
    totalBundles: db.bundles.length,
    totalSales: db.purchases.length,
    totalRevenue: totalRevenue,
    totalDownloads: totalDownloads,
    bundles: db.bundles.map(b => ({
      id: b.id,
      title: b.title,
      price: b.price,
      downloads: b.downloads || 0,
      uploadDate: b.uploadDate,
      originalName: b.originalName
    })),
    purchases: db.purchases.slice(-20) // send last 20 purchases
  });
});

app.listen(PORT, () => {
  console.log(`Course Bundle Sales app running on http://localhost:${PORT}`);
});
