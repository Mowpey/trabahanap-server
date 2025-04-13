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
  if (req.body.client) {
    const response = await prisma.like.create({
      data: {
        post: { connect: { id: req.body.post } },
        client: { connect: { id: req.body.client } },
        likedAt: new Date(Date.now()),
      },
    });
    console.log("Liked Post Number", req.body.post);
    res.status(200).json(response);
    return;
  }

  if (req.body.jobSeeker) {
    const response = await prisma.like.create({
      data: {
        post: { connect: { id: req.body.post } },
        jobSeeker: { connect: { id: req.body.jobSeeker } },
        likedAt: new Date(Date.now()),
      },
    });
    console.log("Liked Post Number", req.body.post);
    res.status(200).json(response);
    return;
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
