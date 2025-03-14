import express from "express";
import { getJobRequests } from "../controllers/jobrequest.controller.js";
import authenticateToken from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/job-requests", authenticateToken, getJobRequests);

export default router;
