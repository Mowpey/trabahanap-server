import express from "express";
import multer from "multer";
import {
  createPosting,
  userHasLiked,
  userCommented,
} from "../controllers/community.controller.js";

const router = express.Router();
const formData = multer();

router.post(
  "/community/posts/create-post",
  formData.single("postImage"),
  createPosting
);
router.post("/community/posts/:postId/hasLiked", formData.none(), userHasLiked);
router.post("/community/:postId/comments", formData.none(), userCommented);

export default router;
