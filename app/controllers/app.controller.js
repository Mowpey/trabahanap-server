import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export const getClient = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  res.json(user);
};

export const jobRequest = async (req, res) => {
  jwt.verify(token, secretOrPublicKey, options);

  const jobPost = await prisma.jobRequest.create({
    data: {},
  });

  res.send("Post request have ben done!");
};
