import cryptoRandomString from "crypto-random-string";
import { PrismaClient } from "@prisma/client";

export const generateFolderJobRequestName = () => {
  let today = new Date(Date.now());
  today = today.toLocaleDateString().replaceAll("/", "");

  const folderName = cryptoRandomString({ length: 10 }) + "_" + today;
  return folderName;
};

export const generateFileJobRequestName = (file, cb) => {
  let today = new Date(Date.now());
  let splittedFile = file.originalname.split(".");

  today = today.toLocaleDateString().replaceAll("/", "");

  const fileOutput =
    cryptoRandomString({ length: 5 }) + "_" + today + "." + splittedFile[1];
  cb(null, fileOutput);
};

export const genFolderEdit = async (req) => {
  const prisma = new PrismaClient();

  const res = await prisma.jobRequest.findFirst({
    where: {
      id: req.params.id,
    },
    select: {
      jobImage: true,
    },
  });

  if (!res.jobImage || res.jobImage.length === 0) {
    return generateFolderJobRequestName();
  }

  return res.jobImage[0].split("/")[2];
};

export const genFileEdit = (file, cb) => {
  let today = new Date(Date.now());
  let splittedFile = file.originalname.split(".");
  today = today.toLocaleDateString().replaceAll("/", "");

  const fileOutput =
    cryptoRandomString({ length: 5 }) + "_" + today + "." + splittedFile[1];
  cb(null, fileOutput);
};
