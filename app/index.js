import express from "express";
import appRouter from "./routes/app.routes.js"
import jsonParser from "./middleware/json_parser.middleware.js";



const app = express();

//create a middleware for auth or insert the auth route here
app.use(jsonParser)
app.use(appRouter)


app.listen(3000);
