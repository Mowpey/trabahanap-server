import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const jobRequest = async (req, res) => {
  console.log("Checking the files", req.files);
  console.log("Checking the body", req.body);

  // const jobPost = await prisma.jobRequest.create({
  //   data: {
  //     client: { connect: { id: req.body.user.id } },
  //     jobTitle: req.body.jobTitle,
  //     jobDescription: req.body.jobDescription,
  //     category: req.body.category,
  //     jobLocation: req.body.jobLocation,
  //     jobStatus: "open",
  //     budget: req.body.budget,
  //     jobStartDuration: new Date(Date.now()), //temporarily while waiting for the commit
  //     jobEndDuration: new Date(Date.now()), //temporarily while waiting for the commit
  //     jobImage: req.files.path,
  //     jobRating: 0,
  //     jobReview: "",
  //     acceptedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
  //     completedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
  //     verifiedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
  //   },
  // });

  // res.json(jobPost);
  res.send(req.body);
};
