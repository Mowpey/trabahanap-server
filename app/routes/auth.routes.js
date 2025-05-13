import {
  login,
  signUp,
  decodeToken,
  storeOTP,
  verifyOtpOnly,
  verifyApplicant,
} from "../controllers/auth.controller.js";
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
router.post("/store-otp", storeOTP);
router.post("/verify-otp", verifyOtpOnly);
router.post(
  "/signup",
  signUpData.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "idValidationFrontImage", maxCount: 1 },
    { name: "idValidationBackImage", maxCount: 1 },
  ]),
  signUp
);

router.post(
  "/verify-applicant",
  signUpData.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "idValidationFrontImage", maxCount: 1 },
    { name: "idValidationBackImage", maxCount: 1 },
  ]),
  verifyApplicant
);

export default router;
