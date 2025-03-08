import express from "express";
import appRouter from "./routes/app.routes.js";
import authRoutes from "./routes/auth.routes.js";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(authRoutes);
app.use(appRouter);

const PORT = 3000;
app.listen(PORT);
