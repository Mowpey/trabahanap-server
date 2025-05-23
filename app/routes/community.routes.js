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
  deletePosting,
  editPosting,
  editComment,
  deleteComment,
  userLikedComment,
  userUnlikedComment,
  checkIfLikedComment,
} from "../controllers/community.controller.js";
import authenticateToken from "../middleware/auth.middleware.js";

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
router.delete("/community/posts/:postId/delete", deletePosting);
router.put(
  "/community/posts/:postId/edit",
  formData.single("postImage"),
  editPosting
);
router.put("/community/posts/:postId/comments/:commentId/edit", editComment);
router.delete(
  "/community/posts/:postId/comments/:commentId/delete",
  deleteComment
);
router.post(
  "/community/posts/:postId/comments/:commentId/like",
  authenticateToken,
  userLikedComment
);
router.post(
  "/community/posts/:postId/comments/:commentId/unlike",
  authenticateToken,
  userUnlikedComment
);

router.get(
  "/community/posts/:postId/comments/:commentId/check-like",
  authenticateToken,
  checkIfLikedComment
);

export default router;
