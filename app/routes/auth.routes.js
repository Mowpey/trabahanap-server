import express from "express";
import { login } from "../controllers/auth.controller.js";
import { getUserDetails } from "../controllers/user.controller.js";
import authenticateToken from "../middleware/auth.middleware.js";
import multer from "multer";

const router = express.Router();
const formData = multer();

router.post("/login", formData.none(), login);

router.get("/user", authenticateToken, getUserDetails);

export default router;
