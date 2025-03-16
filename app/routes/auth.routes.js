import { login, signUp, decodeToken } from "../controllers/auth.controller.js";
import express from "express";
import multer from "multer";
import { generateFileName, generateFolderName } from "../helpers/app.helper.js";
import fs from "node:fs";

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

const router = express.Router();
const signUpData = multer({ storage: storage });

router.post("/login", login);
router.get("/decodeToken", decodeToken);
router.post("/signup", signUpData.single("profileImage"), signUp);

export default router;
