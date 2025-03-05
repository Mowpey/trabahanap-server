import express from "express";
import appRouter from "./routes/app.routes.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();

app.use(authRoutes);
app.use(express.json());
app.use(appRouter);

const PORT = 3000;
app.listen(PORT);
