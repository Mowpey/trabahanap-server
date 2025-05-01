import express from "express";
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getClientListings,
  getSingleJobListing,
  jobRequest,
  deleteClientListings,
  editClientListings,
  getJobRequests,
  getJobSeekerTags,
  getMyJobs,
  markJobAsCompleted,
  reviewnRating,
  searchJobs,
  getTopCategories,
} from "../controllers/app.controller.js";
import multer from "multer";
import {
  generateFolderJobRequestName,
  generateFileJobRequestName,
  genFolderEdit,
  genFileEdit,
} from "../helpers/app.helper.js";
import fs from "node:fs";
import authenticateToken from "../middleware/auth.middleware.js";
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jrPost = multer.diskStorage({
  destination: function (req, _file, cb) {
    if (!req.folderName) {
      req.folderName = generateFolderJobRequestName();

      const folderPath = `./assets/job_request_files/${req.folderName}`;

      if (!fs.existsSync("./assets/job_request_files")) {
        fs.mkdirSync("./assets/job_request_files", { recursive: true });
      }

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
    }

    cb(null, `./assets/job_request_files/${req.folderName}`);
  },
  filename: function (_req, file, cb) {
    generateFileJobRequestName(file, cb);
  },
});

const jrEdit = multer.diskStorage({
  destination: async function (req, _file, cb) {
    if (!req.folderName) {
      req.folderName = await genFolderEdit(req); //Always existing
      const folderPath = `./assets/job_request_files/${req.folderName}`;

      if (!fs.existsSync("./assets/job_request_files")) {
        fs.mkdirSync("./assets/job_request_files", { recursive: true });
      }

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
    }
    cb(null, `./assets/job_request_files/${req.folderName}`);
  },

  filename: function (_req, file, cb) {
    genFileEdit(file, cb);
  },
});

const formData = multer();
const jrp = multer({
  storage: jrPost,
});
const jre = multer({
  storage: jrEdit,
});

router.post("/home/job_request", formData.none(), jobRequest);
router.post("/client-home/add-jobs", jrp.array("jobImage", 3), jobRequest);

router.get("/client-home/job-listings", getClientListings);
router.get("/client-home/job-listings/:id", getSingleJobListing);
router.delete("/client-home/delete-listing", deleteClientListings);
router.patch(
  "/client-home/:id/edit-listing",
  jre.array("jobImage", 3),
  editClientListings
);
router.get("/api/job-requests", authenticateToken, getJobRequests);
router.get("/api/job-seeker/tags", authenticateToken, getJobSeekerTags);
router.get('/api/job-seeker/my-jobs', authenticateToken, getMyJobs);
router.post('/api/jobs/:jobId/complete', authenticateToken, markJobAsCompleted);
router.post("/api/jobrequest/verify/:id",authenticateToken,reviewnRating)
router.get('/api/jobs/search',authenticateToken, searchJobs);
router.get('/api/jobs/top-categories',authenticateToken, getTopCategories);
router.use('/uploads', express.static(
  path.join(__dirname, '../assets/job_request_files'),
  {
    maxAge: '1d',
    setHeaders: (res) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }
));
router.use('/uploads/messages', express.static(
  path.join(__dirname, '../assets/messages_files'), 
  {
    maxAge: '1d',
    setHeaders: (res) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }
));
router.use('/uploads/profiles', express.static(
  path.join(__dirname, '../assets/profiles'), 
  {
    maxAge: '1d',
    setHeaders: (res) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }
));
export default router;
