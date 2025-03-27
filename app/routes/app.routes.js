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
  generateFolderJobRequestName,
  generateFileJobRequestName,
  genFolderEdit,
  genFileEdit,
} from "../helpers/app.helper.js";
import fs from "node:fs";

const router = express.Router();

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

export default router;
