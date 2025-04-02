import express from "express";
import appRouter from "./routes/app.routes.js";
import authRoutes from "./routes/auth.routes.js";
import jobRequestRoutes from "./routes/jobrequest.routes.js";
import jobSeekerRoutes from "./routes/jobseekertags.routes.js";
import communityRoutes from "./routes/community.routes.js";
import cors from "cors";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.static("../app"));
app.use(express.json());
app.use(authRoutes);
app.use(appRouter);
app.use("/api", jobRequestRoutes);
app.use(jobSeekerRoutes);
app.use(communityRoutes);

const PORT = 3000;
app.listen(PORT);
