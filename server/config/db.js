import mongoose from "mongoose";

const DATABASE_NAME = "silent";
const DEFAULT_MONGO_URI = `mongodb://127.0.0.1:27017/${DATABASE_NAME}`;

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;

    if (!uri && process.env.NODE_ENV === "production") {
      throw new Error(
        "MONGO_URI is missing in production. Please set it in the Vercel dashboard.",
      );
    }

    const conn = await mongoose.connect(uri || DEFAULT_MONGO_URI, {
      dbName: DATABASE_NAME,
      serverSelectionTimeoutMS: 3000, // Fail within 3 seconds for serverless
    });

    console.log(
      `MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`,
    );
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
  }
};

export default connectDB;
