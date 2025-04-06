import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createPosting = async (req, res) => {
  if (req.body.client) {
    const response = await prisma.post.create({
      data: {
        client: { connect: { id: req.body.client } },
        postContent: req.body.postContent,
        postImage: req.body.postImage ?? "",
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
        postImage: req.body.postImage ?? "",
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
        jobSeeker: { connect: { id: req.body.jobSeeker } }, //must be the id from jobseeker table not userId
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
