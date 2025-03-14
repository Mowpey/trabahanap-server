import express from "express";
import { getJobSeekerTags } from "../controllers/jobseekertag.controller.js";
import authenticateToken from "../middleware/auth.middleware.js";

const router = express.Router();

// ✅ Route to fetch the job seeker's job tags
router.get("/api/job-seeker/tags", authenticateToken, getJobSeekerTags);

export default router;
