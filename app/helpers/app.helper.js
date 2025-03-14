import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const generateFileName = (file, cb) => {
  let today = new Date(Date.now());
  let time = new Date(Date.now());
  let splittedFile = file.originalname.split(".");

  today = today.toLocaleDateString().replaceAll("/", "-");
  time = time.getHours() + "-" + time.getMinutes() + "-" + time.getSeconds();

  const fileOutput =
    splittedFile[0] + "-" + today + "-" + time + "." + splittedFile[1];
  cb(null, fileOutput);
};

export const generateFolderName = (req) => {
  let today = new Date(Date.now());
  let time = new Date(Date.now());

  today = today.toLocaleDateString().replaceAll("/", "-");
  time = time.getHours() + "-" + time.getMinutes() + "-" + time.getSeconds();

  const folderName = req.body.lastName + "-" + today + "-" + time;
  return folderName;
};

export const generateFolderJobRequest = (file) => {
  let today = new Date(Date.now());
  let time = new Date(Date.now());

  today = today.toLocaleDateString().replaceAll("/", "-");
  time = time.getHours() + "-" + time.getMinutes() + "-" + time.getSeconds();

  const folderName = file.fieldname + "-" + today + "-" + time;
  return folderName;
};

export const generateFileJobRequest = (file, cb) => {
  let today = new Date(Date.now());
  let time = new Date(Date.now());

  let splittedFile = file.originalname.split(".");

  today = today.toLocaleDateString().replaceAll("/", "-");
  time = time.getHours() + "-" + time.getMinutes() + "-" + time.getSeconds();

  const fileOutput =
    file.fieldname + "-" + today + "-" + time + "." + splittedFile[1];
  cb(null, fileOutput);
};
