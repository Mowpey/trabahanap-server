import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

app.get("/", async (req, res) => {
  const users = await prisma.users.findMany();
  console.log(users);
  res.send(users);
});

app.listen(3000);
