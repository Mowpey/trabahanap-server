import express from "express";
import http from "http"
import appRouter from "./routes/app.routes.js";
import authRoutes from "./routes/auth.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import { initializeSocketIO } from "./controllers/socket.io.controller.js";
import communityRoutes from "./routes/community.routes.js";
import cors from "cors";


const app = express();

app.use(cors({ origin: "*" }));
app.use(express.static("../app"));
app.use(express.json());

const httpServer = http.createServer(app);
const io = initializeSocketIO(httpServer);
app.set('socketio',io);


app.use(authRoutes);
app.use(appRouter);
app.use(chatRoutes);
app.use(communityRoutes);

const PORT = 3000;
httpServer.listen(PORT,() => {
    console.log('Server running on port ', PORT)
})
