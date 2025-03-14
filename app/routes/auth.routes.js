import { login, signUp, decodeToken } from "../controllers/auth.controller.js";
import express from "express";
import multer from "multer";
import {
  generateFileName,
  generateFolderName,
  generateFolderJobRequest,
  generateFileJobRequest,
} from "../helpers/app.helper.js";
import fs from "node:fs";
import { jobRequest } from "../controllers/app.controller.js";

const storage = multer.diskStorage({
  destination: function (req, _file, cb) {
    const folderName = generateFolderName(req);

    if (fs.existsSync("./assets/profiles")) {
      fs.mkdirSync(`./assets/profiles/${folderName}`);
    }
    cb(null, `./assets/profiles/${folderName}`);
  },
  filename: function (_req, file, cb) {
    generateFileName(file, cb);
  },
});

const jobRequestStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!req.folderName) {
      req.folderName = generateFolderJobRequest(file);

      const folderPath = `./assets/job_request_files/${req.folderName}`;

      if (!fs.existsSync("./assets/job_request_files")) {
        fs.mkdirSync("./assets/job_request_files", { recursive: true });
      }

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
    }

    cb(null, `./assets/job_request_files/${req.folderName}`);
  },
  filename: function (_req, file, cb) {
    generateFileJobRequest(file, cb);
  },
});

const router = express.Router();
const signUpData = multer({ storage: storage });
// const jobRequestData = multer({ dest: "./assets/job_request_files" });
const jobRequestData = multer({ storage: jobRequestStorage });

router.post("/login", login);
router.get("/decodeToken", decodeToken);
router.post("/signup", signUpData.single("profileImage"), signUp);
router.post(
  "/client-home/add-jobs",
  jobRequestData.array("jobImage", 3),
  jobRequest,
);

export default router;
