import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";


dotenv.config();
const prisma = new PrismaClient();
const SECRET_KEY = "A1B2C3D4"; 

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { emailAddress: email },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign({ id: user.id, email: user.emailAddress }, SECRET_KEY, { expiresIn: "1m" });

    res.json({ message: "Login successful", token, user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error" });
  }
};
