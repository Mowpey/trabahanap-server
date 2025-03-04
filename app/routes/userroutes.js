import express from "express";
import { getUserDetails } from "../controllers/usercontroller.js";
import { authenticateToken } from "../middleware/authmiddleware.js";

const router = express.Router();

router.get("/user", authenticateToken, getUserDetails);

export default router;
