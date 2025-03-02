import express from "express";
import * as HomeController from "../controllers/app.controller.js";
import signUp from "../controllers/signup.controller.js";
import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    let today = new Date(Date.now());
    let time = new Date(Date.now());
    let splitFile = file.originalname.split(".");

    today = today.toLocaleDateString().replaceAll("/", "-");
    time = time.getHours() + "-" + time.getMinutes() + "-" + time.getSeconds();

    const fileOutput =
      splitFile[0] + "-" + today + "-" + time + "." + splitFile[1];
    cb(null, fileOutput);
  },
});

const router = express.Router();
const formData = multer({ storage });

router.get("/", HomeController.getHome);
router.post("/signup", formData.single("profileImage"), signUp);

export default router;
