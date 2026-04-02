require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:3000", // React app URL
  credentials: true
}));

// 🔑 In-memory users (replace with DB later)
const users = [
  {
    id: 1,
    username: "admin",
    passwordHash: bcrypt.hashSync("password123", 10), // hashed password
    role: "admin"
  }
];

// Generate access token
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

// ✅ LOGIN
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  const token = generateAccessToken(user);

  res.cookie("token", token, {
    httpOnly: true,
    secure: false, // set true in production with HTTPS
    sameSite: "strict"
  });

  res.json({ message: "Login successful", role: user.role });
});

// ✅ Middleware to check token
function authenticate(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

// ✅ Protected route
app.get("/api/admin", authenticate, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json({ message: "Welcome Admin!", user: req.user });
});

// ✅ LOGOUT
app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

app.listen(4000, () => console.log("Backend running on http://localhost:4000"));
