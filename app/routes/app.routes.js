import express from "express"
import * as HomeController from "../controllers/app.controller.js"
import signUp from "../controllers/signup.controller.js"
import multer from "multer"


const router = express.Router()
const formData = multer()



router.get("/", HomeController.getHome)
router.post("/signup", formData.array(), signUp)


export default router
