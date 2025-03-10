import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
dotenv.config();

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findFirst({
    where: { emailAddress: email },
  });
  const passwordMatch = bcrypt.compareSync(password, user.password);

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  if (!passwordMatch) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.emailAddress },
    process.env.JWT_SECRET,
    { expiresIn: "1m" },
  );

  res.json({ message: "Login successful", token, user });
};

export const signUp = async (req, res) => {
  if (req.body.userType == "job-seeker") {
    const user = await prisma.user.create({
      data: {
        firstName: req.body.firstName,
        middleName: req.body.middleName,
        lastName: req.body.lastName,
        suffixName: req.body.suffixName,
        gender: req.body.gender,
        birthday: new Date(req.body.birthday),
        age: parseInt(req.body.age),
        emailAddress: req.body.emailAddress,
        password: bcrypt.hashSync(req.body.password, 10),
        profileImage: req.file.path,
        bio: req.body.bio,
        barangay: req.body.barangay,
        street: req.body.street,
        houseNumber: req.body.houseNumber,
        userType: req.body.userType,
        jobSeeker: {
          create: {
            availability: true,
            hourlyRate: "",
            jobTags: req.body.jobTags.split(","),
            achievement: {
              create: {
                achievementName: "Starter",
                jobRequired: "None",
                requiredJobCount: 0,
                achievementIcon: "./assets/achievements/starter.png",
              },
            },
            milestone: {
              create: {
                milestoneTitle: "Start of the Journey",
                milestoneDescription: "Successfully created an account",
                jobsCompleted: 0,
                experienceLevel: "1",
              },
            },
          },
        },
      },
      include: {
        jobSeeker: true,
      },
    });
    console.log("Successful Upload of Job Seeker!", user);
    return;
  }

  const user = await prisma.user.create({
    data: {
      firstName: req.body.firstName,
      middleName: req.body.middleName,
      lastName: req.body.lastName,
      suffixName: req.body.suffixName,
      gender: req.body.gender,
      age: parseInt(req.body.age),
      birthday: new Date(req.body.birthday),
      emailAddress: req.body.emailAddress,
      password: bcrypt.hashSync(req.body.password, 10),
      profileImage: req.file.path,
      bio: req.body.bio,
      barangay: req.body.barangay,
      street: req.body.street,
      houseNumber: req.body.houseNumber,
      userType: req.body.userType,
    },
  });
  console.log("Successful Upload of Client!", user);
};
