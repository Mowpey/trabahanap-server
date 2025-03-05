import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
dotenv.config();

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({
    where: { emailAddress: email },
  });
  const passwordMatch = bcrypt.compareSync(password, user.password);

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  if (!passwordMatch) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.emailAddress },
    process.env.JWT_SECRET,
    { expiresIn: "1m" },
  );

  res.json({ message: "Login successful", token, user });
};
