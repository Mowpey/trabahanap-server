import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createPosting = async (req, res) => {
  try {
    if (req.body.client) {
      const response = await prisma.post.create({
        data: {
          client: { connect: { id: req.body.client } },
          postContent: req.body.postContent,
          postImage: req.file ? req.file.path : "",
          likeCount: parseInt(req.body.likeCount) || 0,
          commentCount: parseInt(req.body.commentCount) || 0,
          createdAt: new Date(Date.now()),
        },
      });
      console.log("Successfully made a community post!", response);
      return res.status(200).json(response);
    }

    if (req.body.jobSeeker) {
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { userId: req.body.jobSeeker },
        select: { id: true },
      });

      if (!jobSeeker) {
        return res
          .status(404)
          .json({ message: "JobSeeker not found for the provided userId" });
      }

      const response = await prisma.post.create({
        data: {
          jobSeeker: { connect: { id: jobSeeker.id } },
          postContent: req.body.postContent,
          postImage: req.file ? req.file.path : "",
          likeCount: parseInt(req.body.likeCount) || 0,
          commentCount: parseInt(req.body.commentCount) || 0,
          createdAt: new Date(Date.now()),
        },
      });
      console.log("Successfully made a community post!", response);
      return res.status(200).json(response);
    }

    return res
      .status(400)
      .json({ message: "Client or JobSeeker User ID must be provided" });
  } catch (error) {
    console.error("Error creating post:", error);
    if (error.code === "P2025") {
      return res.status(404).json({
        message: "Referenced record (Client or JobSeeker) not found.",
      });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deletePosting = async (req, res) => {
  const { postId } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Delete all likes associated with the post
      await tx.like.deleteMany({
        where: { postId: postId },
      });

      // Step 2: Delete all comments associated with the post
      // First, delete all comments that are replies (have a parentCommentId)
      await tx.comment.deleteMany({
        where: {
          postId: postId,
          parentCommentId: { not: null },
        },
      });

      // Then, delete all top-level comments for this post (parentCommentId is null)
      await tx.comment.deleteMany({
        where: {
          postId: postId,
          parentCommentId: null,
        },
      });

      // Step 3: Finally, delete the post itself
      const deletedPost = await tx.post.delete({
        where: { id: postId },
      });

      return deletedPost;
    });

    console.log(
      "Successfully deleted post, associated likes, and comments!",
      result
    );
    res.status(204).send(); // Send 204 No Content for successful deletion
  } catch (error) {
    console.error("Error deleting post:", error);
    if (error.code === "P2025") {
      // P2025: Record to delete not found.
      return res.status(404).json({ message: "Post not found." });
    }
    // For other errors, including P2014 if relation constraints are still an issue
    res
      .status(500)
      .json({ message: "Failed to delete post.", error: error.message });
  }
};

export const editPosting = async (req, res) => {
  try {
    const { postId } = req.params;
    const { postContent } = req.body; // Text content from form body

    const dataToUpdate = {
      postContent, // Always update postContent based on req.body
    };

    if (req.file) {
      // A new image file was uploaded
      // req.file.path usually contains the path to the stored file.
      // Adjust this based on your multer storage configuration and how you serve/store image URLs.
      // For example, if your files are in 'public/images' and served from '/images',
      // and req.file.filename gives 'image.jpg', you might use `/images/${req.file.filename}`.
      // Using req.file.path directly if it stores the correct relative URL or path.
      dataToUpdate.postImage = req.file.path;
    } else {
      // No new file was uploaded. Check if 'postImage' was sent in req.body.
      // This allows for explicitly clearing the image or providing a URL directly.
      if (req.body.hasOwnProperty("postImage")) {
        if (req.body.postImage === "" || req.body.postImage === null) {
          // Client explicitly wants to remove the image
          dataToUpdate.postImage = null;
        } else {
          // Client sent a non-empty string for postImage (e.g., an existing URL or a new one not via file upload)
          dataToUpdate.postImage = req.body.postImage;
        }
      }
      // If req.file is null AND req.body.postImage is not provided (or not in hasOwnProperty check),
      // dataToUpdate.postImage will not be set, and Prisma will not change the existing image field.
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: dataToUpdate,
    });

    console.log("Successfully edited post!", updatedPost);
    res.status(200).json(updatedPost);
  } catch (error) {
    console.error("Error editing post:", error);
    if (error.code === "P2025") {
      // Prisma's "Record to update not found"
      return res.status(404).json({ message: "Post not found" });
    }
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const userHasLiked = async (req, res) => {
  try {
    if (req.body.userType === "client") {
      const response = await prisma.like.create({
        data: {
          post: { connect: { id: req.body.postId } },
          client: { connect: { id: req.body.userId } },
          likedAt: new Date(Date.now()),
        },
      });

      await prisma.post.update({
        where: { id: req.body.postId },
        data: { likeCount: { increment: 1 } },
      });

      res.status(200).json(response);
      return;
    }

    if (req.body.userType === "job-seeker") {
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { userId: req.body.userId },
        select: { id: true },
      });

      if (!jobSeeker) {
        return res
          .status(404)
          .json({ message: "JobSeeker not found for the provided userId" });
      }

      const response = await prisma.like.create({
        data: {
          post: { connect: { id: req.body.postId } },
          jobSeeker: { connect: { id: jobSeeker.id } },
          likedAt: new Date(Date.now()),
        },
      });

      await prisma.post.update({
        where: { id: req.body.postId },
        data: { likeCount: { increment: 1 } },
      });

      res.status(200).json(response);
      return;
    }

    return res.status(400).json({ message: "Invalid user type" });
  } catch (error) {
    console.error("Error in userHasLiked:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Post or user not found" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const checkIfLiked = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, userType } = req.query;

    if (!postId || !userId || !userType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let whereClause = { postId };

    if (userType === "client") {
      whereClause.clientId = userId;
    } else if (userType === "job-seeker") {
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!jobSeeker) {
        return res.status(404).json({ message: "JobSeeker not found" });
      }

      whereClause.jobSeekerId = jobSeeker.id;
    }

    const response = await prisma.like.findFirst({
      where: whereClause,
    });

    res.status(200).json(response || { likedAt: null });
  } catch (error) {
    console.error("Error in checkIfLiked:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const userUnliked = async (req, res) => {
  try {
    const { postId, userId, userType } = req.body;

    if (!postId || !userId || !userType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let whereClause = { postId };

    if (userType === "client") {
      whereClause.clientId = userId;
    } else if (userType === "job-seeker") {
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!jobSeeker) {
        return res.status(404).json({ message: "JobSeeker not found" });
      }

      whereClause.jobSeekerId = jobSeeker.id;
    }

    const like = await prisma.like.findFirst({
      where: whereClause,
    });

    if (!like) {
      return res.status(404).json({ message: "Like not found" });
    }

    const response = await prisma.like.delete({
      where: { id: like.id },
    });

    await prisma.post.update({
      where: { id: postId },
      data: { likeCount: { decrement: 1 } },
    });

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in userUnliked:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const userCommented = async (req, res) => {
  try {
    const { postId, comment, userId, userType, parentCommentId } = req.body;

    if (!postId || !comment || !userId || !userType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const postExists = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!postExists) {
      return res.status(404).json({ message: "Post not found" });
    }

    let commentData = {
      post: { connect: { id: postId } },
      comment: comment.comment || comment,
      createdAt: new Date(Date.now()),
    };

    if (parentCommentId) {
      commentData.parentComment = { connect: { id: parentCommentId } };
    }

    if (userType === "client") {
      commentData.client = { connect: { id: userId } };
    } else if (userType === "job-seeker") {
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!jobSeeker) {
        return res.status(404).json({ message: "JobSeeker not found" });
      }

      commentData.jobSeeker = { connect: { id: jobSeeker.id } };
    } else {
      return res.status(400).json({ message: "Invalid user type" });
    }

    const response = await prisma.comment.create({ data: commentData });

    if (!parentCommentId) {
      await prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error in userCommented:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Parent comment not found" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getComments = async (req, res) => {
  const { postId } = req.params;
  const comments = await prisma.comment.findMany({
    where: { postId },
    include: {
      client: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          profileImage: true,
        },
      },
      jobSeeker: {
        include: {
          user: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
      },
    },
  });
  res.status(200).json(comments);
};

export const getUsername = async (req, res) => {
  const userNames = {};

  for (const obj of req.query.ids) {
    const user = await prisma.user.findUnique({
      where: { id: obj.userId },
      select: {
        firstName: true,
        middleName: true,
        lastName: true,
        profileImage: true,
      },
    });

    if (user) {
      userNames[obj.userId] = {
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        profileImage: user.profileImage,
      };
    } else {
      const jobSeeker = await prisma.jobSeeker.findUnique({
        where: { id: obj.userId },
        include: {
          user: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
      });

      if (jobSeeker?.user) {
        userNames[obj.userId] = {
          firstName: jobSeeker.user.firstName,
          middleName: jobSeeker.user.middleName,
          lastName: jobSeeker.user.lastName,
          profileImage: jobSeeker.user.profileImage,
        };
      }
    }
  }

  res.status(200).json(userNames);
};

export const getAllPosts = async (req, res) => {
  const posts = await prisma.post.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
  res.status(200).json(posts);
};

export const editComment = async (req, res) => {
  try {
    const { commentId } = req.params; // postId is available but not strictly needed if commentId is unique
    const { text } = req.body; // Expecting the new comment content in req.body.text

    if (typeof text !== "string") {
      return res
        .status(400)
        .json({ message: "Invalid comment content. 'text' must be a string." });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { comment: text }, // Update the 'comment' field in the DB with the value from 'text'
    });

    console.log("Successfully edited comment!", updatedComment);
    res.status(200).json(updatedComment);
  } catch (error) {
    console.error("Error editing comment:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Comment not found" });
    }
    // Added error.message to the response for better debugging
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const deleteComment = async (req, res) => {
  console.log(req);

  try {
    const { commentId } = req.params;

    const deletedComment = await prisma.comment.delete({
      where: { id: commentId },
    });

    console.log("Successfully deleted comment!", deletedComment);
    res.status(200).json(deletedComment);
  } catch (error) {
    console.error("Error deleting comment:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Comment not found" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const userLikedComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    // Assuming req.user.id contains the authenticated user's ID
    // Adjust if your auth middleware stores it differently (e.g., req.auth.userId)
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Check if the comment exists first (optional, but good practice)
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check if the user has already liked this comment
      const existingLike = await tx.commentLike.findUnique({
        where: {
          userId_commentId: {
            // For the @@unique([userId, commentId]) constraint
            userId: userId,
            commentId: commentId,
          },
        },
      });

      if (existingLike) {
        // If the like already exists, throw an error that will be caught
        // by the P2002 handler in the outer catch block.
        const err = new Error("Comment already liked by this user.");
        err.code = "P2002"; // Mimic Prisma's error code for unique constraint violation
        throw err;
      }

      // If no existing like, proceed to create one
      const newLike = await tx.commentLike.create({
        data: {
          commentId: commentId,
          userId: userId,
        },
      });

      // Increment the like count on the comment
      const updatedComment = await tx.comment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
      });

      return { newLike, updatedComment };
    });

    res.status(201).json({
      message: "Comment liked successfully",
      like: result.newLike,
      comment: result.updatedComment,
    });
  } catch (error) {
    console.error("Error liking comment:", error);
    if (error.code === "P2002") {
      // Unique constraint failed (already liked)
      return res
        .status(409)
        .json({ message: "Comment already liked by this user" });
    }
    if (error.code === "P2025") {
      // Record to update not found (comment deleted during transaction)
      return res.status(404).json({ message: "Comment not found" });
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const userUnlikedComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id; // Adjust if your auth middleware stores it differently

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find the like to ensure it exists before trying to delete
      const existingLike = await tx.commentLike.findUnique({
        where: {
          userId_commentId: {
            // This is the default name for the @@unique constraint
            userId: userId,
            commentId: commentId,
          },
        },
      });

      if (!existingLike) {
        // If the like doesn't exist, maybe we don't decrement or throw an error
        // For now, let's inform the user the like wasn't found for them
        // Or, you could choose to silently succeed if the goal is just to ensure it's unliked
        throw new Error("NOT_LIKED_BY_USER"); // Custom error to catch below
      }

      // Delete the like
      await tx.commentLike.delete({
        where: {
          id: existingLike.id, // Delete by the like's own ID
        },
      });

      // Decrement the like count on the comment
      // Ensure likeCount doesn't go below 0, though it shouldn't if logic is correct
      const updatedComment = await tx.comment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true, id: true }, // Select only what's needed
      });

      return updatedComment;
    });

    res.status(200).json({
      message: "Comment unliked successfully",
      comment: result,
    });
  } catch (error) {
    console.error("Error unliking comment:", error);
    if (error.message === "NOT_LIKED_BY_USER" || error.code === "P2025") {
      // P2025 can occur if the comment was deleted, or if the like was already deleted
      return res.status(404).json({
        message: "Comment not liked by this user or comment not found",
      });
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const checkIfLikedComment = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.id;

  console.log(`checkIfLikedComment: Attempting to check like status for commentId='${commentId}', userId='${userId}'`);

  try {
    if (!userId) {
      console.warn(`checkIfLikedComment: User not authenticated or req.user.id is undefined for commentId='${commentId}'.`);
      return res.status(401).json({ message: "User not authenticated" });
    }

    const likeRecord = await prisma.commentLike.findFirst({
      where: {
        userId,
        commentId,
      },
    });

    if (likeRecord) {
      console.log(`checkIfLikedComment: Like record FOUND for commentId='${commentId}', userId='${userId}'. Responding with isLiked: true.`);
      res.status(200).json({ isLiked: true, likedAt: likeRecord.likedAt });
    } else {
      console.log(`checkIfLikedComment: No like record found for commentId='${commentId}', userId='${userId}'. Responding with isLiked: false.`);
      res.status(200).json({ isLiked: false, likedAt: null });
    }
  } catch (error) {
    console.error(`Error in checkIfLikedComment for commentId='${commentId}', userId='${userId}':`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
