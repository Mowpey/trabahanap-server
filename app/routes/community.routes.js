import express from "express";
import multer from "multer";
import { createPosting } from "../controllers/community.controller.js";

const router = express.Router();
const formData = multer();

router.post("/community/posts", formData.none(), createPosting);

export default router;
