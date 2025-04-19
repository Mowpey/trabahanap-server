import express from "express";
import multer from "multer";
import cryptoRandomString from "crypto-random-string";
import {
  createPosting,
  userHasLiked,
  getAllPosts,
  getUsername,
  checkIfLiked,
  userUnliked,
  userCommented,
  getComments,
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
router.post("/community/posts/:postId/hasLiked", userHasLiked);
router.get("/community/posts/:postId/checkIfLiked", checkIfLiked);
router.delete("/community/posts/:postId/unlike", userUnliked);
router.get("/community/posts", getAllPosts);
router.get("/community/getUsername", getUsername);
router.post(
  "/community/posts/:postId/addComment",
  formData.none(),
  userCommented
);
router.get("/community/posts/:postId/getComments", getComments);

export default router;
