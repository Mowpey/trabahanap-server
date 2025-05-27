import express from "express";
import {
  getUserProfile,
  updateUserProfile,
  updateJobTags,
  getJobSeekerProfileByUserId,
  uploadCredential,
} from "../controllers/profile.controller.js";
import fs from "fs";
import path from "path";
import multer from "multer";
import authenticateToken from "../middleware/auth.middleware.js";

const router = express.Router();

// Disk storage configuration for profile image uploads
const diskStorage = multer.diskStorage({
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

// Memory storage for credential uploads - files will be in memory until we save them
const memoryStorage = multer.memoryStorage();

// Default upload with disk storage
const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

// Special upload for credentials that keeps files in memory
const memoryUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

router.get("/user/profile/:userId", getUserProfile);

router.patch(
  "/user/profile/edit/:userId",
  upload.single("profileImage"),
  updateUserProfile
);

router.patch("/user/profile/edit/job-tags/:userId", updateJobTags);

// New route for fetching job seeker profile details by User ID
router.get("/user/profile/:jobSeekerId/details", getJobSeekerProfileByUserId);
router.post(
  "/user/profile/upload-credential/:userId",
  authenticateToken,
  memoryUpload.array("credentialFile", 5),
  uploadCredential
);

export default router;
