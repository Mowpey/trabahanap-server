import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createPosting = async (req, res) => {
  if (req.body.client) {
    const response = await prisma.post.create({
      data: {
        client: { connect: { id: req.body.client } },
        postContent: req.body.postContent,
        postImage: req.file ? req.file.path : "",
        likeCount: parseInt(req.body.likeCount),
        commentCount: parseInt(req.body.commentCount),
        createdAt: new Date(Date.now()),
      },
    });
    console.log("Successfully made a community post!", response);
    res.status(200).json(response);

    return;
  }

  if (req.body.jobSeeker) {
    const response = await prisma.post.create({
      data: {
        jobSeeker: { connect: { id: req.body.jobSeeker } },
        postContent: req.body.postContent,
        postImage: req.file ? req.file.path : "",
        likeCount: parseInt(req.body.likeCount),
        commentCount: parseInt(req.body.commentCount),
        createdAt: new Date(Date.now()),
      },
    });
    console.log("Successfully made a community post!", response);
    res.status(200).json(response);

    return;
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

  if (req.body.userType === "jobSeeker") {
    const response = await prisma.like.create({
      data: {
        post: { connect: { id: req.body.postId } },
        jobSeeker: { connect: { id: req.body.userId } },
        likedAt: new Date(Date.now()),
      },
    });

    res.status(200).json(response);
    return;
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
    } else if (userType === "jobSeeker") {
      whereClause.jobSeekerId = userId;
    }

    const response = await prisma.like.findFirst({
      where: whereClause,
      select: {
        id: true,
        likedAt: true,
      },
    });

    res.status(200).json(response || { likedAt: null });
  } catch (error) {
    console.error("Error in checkIfLiked:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const userUnliked = async (req, res) => {
  try {
    const { postId, userId, userType } = req.body;

    // First find the like record
    const like = await prisma.like.findFirst({
      where: {
        postId,
        OR: [
          { clientId: userType === "client" ? userId : undefined },
          { jobSeekerId: userType === "jobSeeker" ? userId : undefined },
        ],
      },
    });

    if (!like) {
      return res.status(404).json({ message: "Like not found" });
    }

    // Delete the like record
    const response = await prisma.like.delete({
      where: { id: like.id },
    });

    // Update the post's like count
    await prisma.post.update({
      where: { id: postId },
      data: { likeCount: { decrement: 1 } },
    });

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in userUnliked:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const userCommented = async (req, res) => {
  const postExists = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!postExists) {
    return res
      .status(404)
      .json({ message: `Post with ID ${postId} not found.` });
  }

  if (req.body.client) {
    const createComment = await prisma.comment.create({
      data: {
        post: { connect: { id: req.body.post } },
        client: { connect: { id: req.body.client } },
        comment: req.body.comment,
        createdAt: new Date(Date.now()),
      },
    });
    console.log("Successfully created client comment!", createComment);
    res.status(200).json(createComment);
    return;
  }
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
