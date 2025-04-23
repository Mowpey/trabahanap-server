import express from "express";
import { getReviews,createChat,getUserChats,sendMessage,getMessages,getStatus,chatReject,chatApprove,getReadStatus,getJobSeekerTags,getUserProfile} from "../controllers/chat.controller.js";
import authenticateToken from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/api/chat/create", authenticateToken, createChat);
router.get("/api/chat", authenticateToken, getUserChats);
router.post("/api/messages/send", authenticateToken, sendMessage);
router.get("/api/messages/:chatId",authenticateToken,getMessages);
router.get('/chats/:chatId/status',authenticateToken,getStatus);
router.post('/chats/:chatId/approve',authenticateToken,chatApprove);
router.post('/chats/:chatId/reject',authenticateToken,chatReject);
router.get('/api/message/read-status/:messageId',authenticateToken,getReadStatus);
router.get('/api/job-seeker/:id/tags', authenticateToken, getJobSeekerTags);
router.get('/user/profile/:id/details',authenticateToken ,getUserProfile);
router.get('/user/reviews/:id',authenticateToken ,getReviews);
export default router;
