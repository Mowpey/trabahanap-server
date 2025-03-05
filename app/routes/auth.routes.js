import express from "express";
import { login } from "../controllers/auth.controller.js";
import { getUserDetails } from "../controllers/user.controller.js";
import authenticateToken from "../middleware/auth.middleware.js";
import cors from "cors";
import multer from "multer";

const app = express();
const router = express.Router();
const formData = multer();
app.use(cors());

router.post("/login", formData.none(), login);

router.get("/user", authenticateToken, getUserDetails);

export default router;
