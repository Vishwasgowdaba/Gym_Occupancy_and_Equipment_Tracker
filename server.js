const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const JWT_SECRET = "supersecret"; // Change this in production

// Database Connection
mongoose.connect("mongodb://127.0.0.1:27017/gymTracker", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// User Schema
const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: String // "user" or "admin"
});
const User = mongoose.model("User", UserSchema);

// Gym Status (Live Data)
let gymData = {
    peopleCount: 10,
    equipment: {
        treadmill: "Available",
        dumbbells: "In Use",
        benchPress: "Available"
    }
};

// User Signup
app.post("/signup", async (req, res) => {
    const { username, password, role } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, role });
    await newUser.save();

    res.json({ message: "Signup successful! Please login." });
});

// User Login
app.post("/login", async (req, res) => {
    const { username, password, role } = req.body;
    const user = await User.findOne({ username, role });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ username, role }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ message: "Login successful", token });
});

// Admin Updates Gym Data
app.post("/update-gym", (req, res) => {
    const { peopleCount, equipment } = req.body;
    if (peopleCount !== undefined) gymData.peopleCount = peopleCount;
    if (equipment) Object.assign(gymData.equipment, equipment);

    io.emit("updateData", gymData);
    res.json({ message: "Gym data updated" });
});

// Socket.io for Real-time Updates
io.on("connection", (socket) => {
    console.log("🟢 User connected");
    socket.emit("updateData", gymData);
    socket.on("disconnect", () => console.log("🔴 User disconnected"));
});

// Start Server
const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
