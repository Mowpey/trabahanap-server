import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";

const prisma = new PrismaClient();

export const jobRequest = async (req, res) => {
  if (req.body.jobSeeker) {
    const jobPost = await prisma.jobRequest.create({
      data: {
        client: { connect: { id: req.body.client } },
        jobSeeker: { connect: { id: req.body.jobSeeker } },
        jobTitle: req.body.jobTitle,
        jobDescription: req.body.jobDescription,
        category: req.body.category,
        jobLocation: req.body.jobLocation,
        jobStatus: "open",
        budget: req.body.budget,
        jobDuration: req.body.jobDuration,
        jobImage: req.files.map((file) => file.path),
        jobRating: 0,
        jobReview: "",
        acceptedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
        completedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
        verifiedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
      },
    });
    console.log("Successfully posted the job request", jobPost);
    res.status(201).json(jobPost);

    return;
  }

  const jobPost = await prisma.jobRequest.create({
    data: {
      client: { connect: { id: req.body.client } },
      jobTitle: req.body.jobTitle,
      jobDescription: req.body.jobDescription,
      category: req.body.category,
      jobLocation: req.body.jobLocation,
      jobStatus: "open",
      budget: req.body.budget,
      jobDuration: req.body.jobDuration,
      jobImage: req.files.map((file) => file.path),
      jobRating: 0,
      jobReview: "",
      acceptedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
      completedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
      verifiedAt: new Date(Date.now()), //temporarily when there is still no connection with job seekers
    },
  });

  console.log("Successfully posted the job request", jobPost);
  res.status(201).json(jobPost);
};

export const getClientListings = async (req, res) => {
  const response = await prisma.jobRequest.findMany({
    where: { clientId: req.query.client },
  });

  res.json(response);
};

export const getSingleJobListing = async (req, res) => {
  const response = await prisma.jobRequest.findFirst({
    where: { id: req.query.jobID },
  });

  res.json(response);
};

export const deleteClientListings = async (req, res) => {
  const response = await prisma.jobRequest.delete({
    where: { id: req.query.jobID },
  });

  if (response && response.jobImage > 0) {
    const parseDir = response.jobImage[0].split("/");
    parseDir.pop();
    const finalParsing = parseDir.join("/");

    fs.rm(finalParsing, { recursive: true });
  }

  res.status(200).json(`Successfully deleted job ID ${req.query.jobID}`);
};

export const editClientListings = async (req, res) => {
  let final_images = [];
  const folderPath =
    req.files && req.files.length > 0 ? req.files[0].destination : "";

  if (req.body.jobImage) {
    if (Array.isArray(req.body.jobImage)) {
      req.body.jobImage.forEach((imgURI) => final_images.push(imgURI));
    } else {
      final_images.push(req.body.jobImage);
    }
  }

  if (req.files.length > 0) {
    req.files.map((file) => final_images.push(file.path));
  }

  if (folderPath) {
    const existingImages = await fs.readdir(folderPath);
    existingImages.forEach((existing_img) => {
      if (!final_images.map((x) => x.split("/").pop()).includes(existing_img)) {
        fs.unlink(`${folderPath}/${existing_img}`);
      }
    });
  }

  const response = await prisma.jobRequest.update({
    where: { id: req.body.id },
    data: {
      jobTitle: req.body.jobTitle,
      jobDescription: req.body.description,
      category: req.body.category,
      budget: req.body.budget,
      jobDuration: req.body.jobDuration,
      jobLocation: req.body.jobLocation,
      jobImage: final_images,
    },
  });

  console.log("Successfully Edited Job Request!", response);
  res.status(200).json(response);
};

export const getJobRequests = async (req, res) => {
  try {
    const jobRequests = await prisma.jobRequest.findMany({
      where: {
        jobStatus: "open",
      },
      include: { client: true },
    });

    res.json(jobRequests);
  } catch (error) {
    console.error("Error fetching job requests:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getJobSeekerTags = async (req, res) => {
  try {
    const jobSeekerId = req.user.id; // Adjust based on your auth setup
    
    const jobSeeker = await prisma.jobSeeker.findUnique({
      where: { id: jobSeekerId },
      select: {
        jobTags: true
      }
    });

    if (!jobSeeker) {
      return res.status(404).json({ error: "Job seeker not found" });
    }

    res.json({ jobTags: jobSeeker.jobTags || [] });
  } catch (error) {
    console.error("Error fetching job seeker tags:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getMyJobs = async (req, res) => {
  try {
    // Get job seeker ID from auth token or session
    const jobSeekerId = req.user.id; // Adjust based on your auth setup
    
    const myJobs = await prisma.jobRequest.findMany({
      where: {
        jobSeekerId: jobSeekerId,
        jobStatus: {
          in: ["accepted", "pending"] // Only show accepted/pending jobs
        }
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        datePosted: "desc"
      }
    });

    res.json(myJobs);
  } catch (error) {
    console.error("Error fetching job seeker's jobs:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const markJobAsCompleted = async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobSeekerId = req.user.id; // Adjust based on your auth setup

    // Verify job exists and belongs to this job seeker
    const job = await prisma.jobRequest.findFirst({
      where: {
        id: jobId,
        jobSeekerId: jobSeekerId
      }
    });

    if (!job) {
      return res.status(404).json({ error: "Job not found or not assigned to you" });
    }

    // Update job status
    const updatedJob = await prisma.jobRequest.update({
      where: { id: jobId},
      data: {
        jobStatus: "completed",
        completedAt: new Date()
      },
      include: {
        client: true
      }
    });

    res.json(updatedJob);
  } catch (error) {
    console.error("Error marking job as completed:", error);
    res.status(500).json({ error: "Server error" });
  }
};    