import express from "express";
import appRouter from "./routes/app.routes.js"
import jsonParser from "./middleware/json_parser.middleware.js";
import cors from "cors";
import authRoutes from "./routes/authroutes.js";
import userRoutes from "./routes/userroutes.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(jsonParser)
app.use(authRoutes); 
app.use(userRoutes); 
app.use(appRouter)


const PORT = 3000;
app.listen(PORT);
