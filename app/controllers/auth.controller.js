import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import otpGenerator from "otp-generator";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();
dotenv.config();

// Create in-memory OTP store
const otpStore = new Map();

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify email configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error("Nodemailer configuration error:", error);
  } else {
    console.log("Nodemailer is ready to send messages");
  }
});

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findFirst({
    where: { emailAddress: email },
  });

  const passwordMatch = bcrypt.compareSync(password, user.password);
  // const passwordMatch = password == user.password;

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  if (!passwordMatch) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.emailAddress },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ message: "Login successful", token, user });
};

export const signUp = async (req, res) => {
  if (req.body.userType === "job-seeker") {
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
        profileImage: req.files ? req.files.profileImage[0].path : "",
        idValidationFrontImage: req.files
          ? req.files.idValidationFrontImage[0].path
          : "",
        idValidationBackImage: req.files
          ? req.files.idValidationBackImage[0].path
          : "",
        idType: req.body.idType,
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
                achievementName: "Created First Account",
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
    res.json(user);
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
      profileImage: req.files ? req.files.profileImage[0].path : "",
      idValidationFrontImage: req.files
        ? req.files.idValidationFrontImage[0].path
        : "",
      idValidationBackImage: req.files
        ? req.files.idValidationBackImage[0].path
        : "",
      idType: req.body.idType,
      bio: req.body.bio,
      barangay: req.body.barangay,
      street: req.body.street,
      houseNumber: req.body.houseNumber,
      userType: req.body.userType,
    },
  });
  console.log("Successful Upload of Client!", user);
  res.json(user);
};

export const decodeToken = async (req, res) => {
  const decodedToken = jwt.verify(req.query.token, process.env.JWT_SECRET);
  try {
    const getTokenData = await prisma.user.findUnique({
      where: {
        id: decodedToken.id,
      },
    });
    res.json(getTokenData);
  } catch (error) {
    res.status(500).send("JWT must be provided");
  }
};

export const storeOTP = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  console.log(`Received request to store OTP for ${email}`);

  try {
    // Generate 6-digit numeric OTP
    const otp = otpGenerator.generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    console.log(`Generated OTP: [${otp}] for ${email}`);

    // Hash the OTP
    const otpHash = await bcrypt.hash(otp, 10);
    console.log(`Generated hash for ${email}: [${otpHash}]`);

    // Set expiry for 10 minutes
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Store in memory
    otpStore.set(email, { hash: otpHash, expires: otpExpires });
    console.log(
      `Stored temporary OTP hash for ${email}. Expires: ${otpExpires.toISOString()}`
    );

    // Send OTP via email
    const mailOptions = {
      from: `"Trabahanap App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Trabahanap Signup Verification Code",
      text: `Your verification code for signup is: ${otp}. It will expire in 10 minutes.`,
      html: `<p>Your verification code for signup is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Signup OTP email sent to ${email}`);

    res.status(200).json({
      message:
        "OTP sent to your email address. Please use it to complete signup.",
    });
  } catch (error) {
    console.error(`Error in storeOTP for ${email}:`, error);
    otpStore.delete(email);
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
};

export const verifyOtpOnly = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res
      .status(400)
      .json({ success: false, error: "Email and OTP are required" });
  }

  // Convert OTP to string and trim whitespace
  const trimmedOtp = String(otp).trim();

  console.log(`Received verification request for ${email}`);
  console.log(`Raw OTP: [${otp}], type: ${typeof otp}`);
  console.log(`Trimmed OTP: [${trimmedOtp}], type: ${typeof trimmedOtp}`);

  try {
    const storedOtpData = otpStore.get(email);

    if (!storedOtpData) {
      console.log(`Verify attempt for ${email}: No temporary OTP found.`);
      return res.status(401).json({
        success: false,
        error: "Invalid or expired OTP request. Please request an OTP first.",
      });
    }

    console.log(
      `Found stored OTP data for ${email}. Hash: [${storedOtpData.hash}], Expires: ${storedOtpData.expires}`
    );

    if (new Date() > storedOtpData.expires) {
      console.log(`Verify attempt for ${email}: Temporary OTP expired.`);
      otpStore.delete(email);
      return res.status(401).json({
        success: false,
        error: "OTP has expired. Please request a new one.",
      });
    }

    // Use trimmed OTP for comparison
    console.log(`Comparing trimmed OTP [${trimmedOtp}] with stored hash`);
    const isMatch = await bcrypt.compare(trimmedOtp, storedOtpData.hash);
    console.log(`bcrypt.compare result: ${isMatch}`);

    if (!isMatch) {
      console.log(`Verify attempt for ${email}: Invalid OTP provided.`);
      return res
        .status(401)
        .json({ success: false, error: "Invalid OTP provided." });
    }

    console.log(`Temporary OTP verification successful for ${email}`);
    res.json({ success: true, message: "OTP verified successfully." });
  } catch (error) {
    console.error(`Error during OTP-only verification for ${email}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to verify OTP. Please try again.",
    });
  }
};
