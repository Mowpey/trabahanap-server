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
  const response = await prisma.post.delete({
    where: { id: req.body.id },
  });
  console.log("Successfully deleted your post!", response);
  res.status(204).json(response);
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
