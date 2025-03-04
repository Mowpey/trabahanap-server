import jwt from "jsonwebtoken";


const JWT_SECRET = 'A1B2C3D4'
export const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(403).json({ error: "Access denied. No token provided." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: "Invalid or expired token" });

    req.user = user;
    next();
  });
};
