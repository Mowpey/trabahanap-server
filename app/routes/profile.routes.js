import express from "express";
import {
  getUserProfile,
  updateUserProfile,
  updateJobTags,
} from "../controllers/profile.controller.js";
import fs from "fs";
import path from "path";
import multer from "multer";

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "assets/profiles/";
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

router.get("/user/profile/:userId", getUserProfile);

router.patch(
  "/user/profile/edit/:userId",
  upload.single("profileImage"),
  updateUserProfile
);

router.patch("/user/profile/edit/job-tags/:userId", updateJobTags);

export default router;
