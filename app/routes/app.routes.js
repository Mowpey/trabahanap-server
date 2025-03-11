import express from "express";
import { jobRequest } from "../controllers/app.controller.js";
import multer from "multer";

const router = express.Router();
const formData = multer();

router.post("/home/job_request", formData.none(), jobRequest);

export default router;
