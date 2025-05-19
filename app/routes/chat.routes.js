import express from "express";
import {
  getClientProfile,
  getReviews,
  createChat,
  getUserChats,
  sendMessage,
  getMessages,
  getStatus,
  chatReject,
  chatApprove,
  getReadStatus,
  getJobSeekerTags,
  getUserProfile,
  blockUser,
  unblockUser,
  getBlockedUsers,
  isBlocked,
  getJobRequestBudget,
  getUsersWhoBlockedMe,
  reportValidation,
} from "../controllers/chat.controller.js";
import authenticateToken from "../middleware/auth.middleware.js";
import { storePushToken } from "../controllers/notification.controller.js";
const router = express.Router();

router.post("/api/chat/create", authenticateToken, createChat);
router.get("/api/chat", authenticateToken, getUserChats);
router.post("/api/messages/send", authenticateToken, sendMessage);
router.get("/api/messages/:chatId", authenticateToken, getMessages);
router.get("/chats/:chatId/status", authenticateToken, getStatus);
router.post("/chats/:chatId/approve", authenticateToken, chatApprove);
router.post("/chats/:chatId/reject", authenticateToken, chatReject);
router.get(
  "/api/message/read-status/:messageId",
  authenticateToken,
  getReadStatus
);
router.get("/api/job-seeker/:id/tags", authenticateToken, getJobSeekerTags);
router.get("/user/profile/:id/details", authenticateToken, getUserProfile);
router.get("/user/reviews/:id", authenticateToken, getReviews);
router.get("/api/clients/:id/profile", authenticateToken, getClientProfile);
router.post("/block", authenticateToken, blockUser);
router.delete("/block/:blockedId", authenticateToken, unblockUser);
router.get("/blocked", authenticateToken, getBlockedUsers);
router.get("/block/check/:userId", authenticateToken, isBlocked);
router.get("/job/:jobId/budget", authenticateToken, getJobRequestBudget);
router.post("/api/push-token", authenticateToken, storePushToken);
router.get("/users/:id/blocked-by", authenticateToken, getUsersWhoBlockedMe);
router.post("/api/report", authenticateToken, reportValidation);
export default router;
