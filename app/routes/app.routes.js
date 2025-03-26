import express from "express";
import {
  getClientListings,
  getSingleJobListing,
  jobRequest,
  deleteClientListings,
  editClientListings,
} from "../controllers/app.controller.js";
import multer from "multer";
import {
  generateFolderJobRequest,
  generateFileJobRequest,
} from "../helpers/app.helper.js";
import fs from "node:fs";

const router = express.Router();

const jobRequestStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!req.folderName) {
      req.folderName = generateFolderJobRequest(file);

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
    generateFileJobRequest(file, cb);
  },
});

const formData = multer();
const jobRequestData = multer({
  storage: jobRequestStorage,
});

router.post("/home/job_request", formData.none(), jobRequest);
router.post(
  "/client-home/add-jobs",
  jobRequestData.array("jobImage", 3),
  jobRequest
);

router.get("/client-home/job-listings", getClientListings);
router.get("/client-home/job-listings/:id", getSingleJobListing);
router.delete("/client-home/delete-listing", deleteClientListings);
router.patch(
  "/client-home/:id/edit-listing",
  jobRequestData.array("jobImage", 3),
  editClientListings
);

export default router;
