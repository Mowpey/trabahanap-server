import { login, signUp, decodeToken } from "../controllers/auth.controller.js";
import express from "express";
import multer from "multer";
import cryptoRandomString from "crypto-random-string";

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, `./assets/profiles`);
  },
  filename: function (_req, file, cb) {
    cb(
      null,
      `${cryptoRandomString({ length: 20 })}.${file.originalname
        .split(".")
        .pop()}`
    );
  },
});

const router = express.Router();
const signUpData = multer({ storage: storage });

router.post("/login", login);
router.get("/decodeToken", decodeToken);
router.post("/signup", signUpData.single("profileImage"), signUp);

export default router;
