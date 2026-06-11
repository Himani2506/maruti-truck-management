const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const  {pool } = require("./db/setup"); // your existing pg pool

const SECRET = process.env.JWT_SECRET || "change-this-secret";

// POST /auth/signup
const signup = async (req, res) => {
  const { username, password, role = "viewer" } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });
  if (!["admin", "viewer"].includes(role))
    return res.status(400).json({ error: "Role must be admin or viewer" });

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role",
      [username, password_hash, role]
    );
    res.status(201).json({ message: "User created", user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Username already exists" });
    res.status(500).json({ error: "Signup failed" });
  }
};

// POST /auth/login
const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { sub: user.username, role: user.role, id: user.id },
      SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
};

// Middleware: any logged-in user
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(header.split(" ")[1], SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Middleware: admin only
const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    next();
  });
};

module.exports = { login, signup, requireAuth, requireAdmin };