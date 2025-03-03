import express from "express";
import * as HomeController from "../controllers/app.controller.js";
import signUp from "../controllers/signup.controller.js";
import multer from "multer";
import { generateFileName, generateFolderName } from "../helpers/app.helper.js";
import fs from "node:fs";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folderName = generateFolderName(req);

    if (fs.existsSync("./profiles")) {
      fs.mkdirSync(`./profiles/${folderName}`);
    }
    cb(null, `./profiles/${folderName}`);
  },
  filename: function (req, file, cb) {
    generateFileName(file, cb);
  },
});

const router = express.Router();
const formData = multer({ storage });

router.get("/", HomeController.getHome);
router.post("/signup", formData.single("profileImage"), signUp);

export default router;
