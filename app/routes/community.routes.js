import express from "express";
import multer from "multer";
import cryptoRandomString from "crypto-random-string";
import {
  createPosting,
  userHasLiked,
  userCommented,
  getAllPosts,
  getUsername,
} from "../controllers/community.controller.js";

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, `./assets/community_images`);
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
const formData = multer({ storage: storage });

router.post(
  "/community/posts/create-post",
  formData.single("postImage"),
  createPosting
);
router.post("/community/posts/:postId/hasLiked", formData.none(), userHasLiked);
router.post("/community/:postId/comments", formData.none(), userCommented);
router.get("/community/posts", getAllPosts);
router.get("/community/getUsername", getUsername);

export default router;
