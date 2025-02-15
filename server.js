const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 5500;

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/spiceandblissreserve", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Middleware for parsing form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session middleware setup
app.use(
  session({
    secret: "secret-key", // a secret key to sign the session cookie
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Use secure cookies in production (set secure: true when using https)
  })
);

// Serve static files (CSS, JS, images) from the root directory
app.use(express.static(__dirname));

// MongoDB Schema for Reservation
const reservationSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  date: Date,
  time: String,
  tableSize: Number,
  tableNumber: Number, // New field for table number
  paymentMethod: String,
  paymentStatus: String,
});

const Reservation = mongoose.model("Reservation", reservationSchema);

// Serve the main page (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Serve confirmation page (confirmation.html)
app.get("/confirmation", (req, res) => {
  res.sendFile(path.join(__dirname, "confirmation.html"));
});
function sendConfirmationEmail(
  name,
  email,
  date,
  time,
  tableSize,
  tableNumber
) {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "spiceandbliss25@gmail.com", // Replace with your Gmail
      pass: "eqbb swbv kkus mewk", // Use an App Password
    },
  });

  let mailOptions = {
    from: "spiceandbliss25@gmail.com",
    to: email,
    subject: "Reservation Confirmation - Spice and Bliss",
    html: `
      <h2>Reservation Confirmed</h2>
      <p>Dear ${name},</p>
      <p>Your table reservation at <strong>Spice and Bliss</strong> has been successfully confirmed.</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Time:</strong> ${time}</p>
      <p><strong>Table Size:</strong> ${tableSize} persons</p>
      <p><strong>Table Number:</strong> ${tableNumber}</p>
      <p>We look forward to serving you!</p>
      <p>Best Regards,<br>Spice and Bliss Team</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}

// Handle Reservations - POST route to save reservation details
app.post("/reserve", async (req, res) => {
  const { name, email, phone, date, time, tableSize, paymentMethod } = req.body;

  // Date Validation: Ensure at least 3 days in advance
  const today = new Date();
  const minDate = new Date();
  minDate.setDate(today.getDate() + 3);
  const selectedDate = new Date(date);

  if (selectedDate < minDate) {
    return res.send(`
    <script>
      alert("Invalid date selection");
      window.history.back();
    </script>
  `);
  }

  // **Fixed Time Validation:**
  const [selectedHour] = time.split(":").map(Number);
  if (selectedHour < 10 || selectedHour > 23) {
    return res.send(`
    <script>
      alert("Invalid time selection. Select a time between 10 AM and 9 PM.");
      window.history.back();
    </script>
  `);
  }

  // **Rest of the Code (Checking Table Availability, Assigning Table Number) Remains Same**

  // Check table availability and assign a table number
  const existingReservations = await Reservation.countDocuments({
    date,
    time,
    tableSize,
  });
  const tableLimits = { 2: 50, 4: 80, 6: 50, 12: 20 };
  if (existingReservations >= tableLimits[tableSize]) {
    return res
      .status(400)
      .json({ message: "No available slots for the selected table size." });
  }

  // Calculate table number dynamically
  // Find the highest table number already assigned for this date, time, and table size
  const lastReservation = await Reservation.findOne({ date, time, tableSize })
    .sort({ tableNumber: -1 }) // Sort in descending order to get the highest table number
    .limit(1);

  let tableNumber = lastReservation ? lastReservation.tableNumber + 1 : 1;

  // Save reservation to MongoDB
  const reservation = new Reservation({
    name,
    email,
    phone,
    date,
    time,
    tableSize,
    tableNumber, // Save the assigned table number
    paymentMethod,
    paymentStatus: "Pending",
  });
  await reservation.save();
  sendConfirmationEmail(name, email, date, time, tableSize, tableNumber);

  // Store reservation details in session (including table number)
  req.session.reservation = {
    name,
    email,
    phone,
    date,
    time,
    tableSize,
    tableNumber, // Include the table number in the session
    paymentMethod,
    paymentStatus: "Pending",
  };

  // Redirect based on payment method
  if (paymentMethod === "UPI") {
    res.redirect("/upi.html");
  } else {
    res.redirect("/card.html");
  }
});

// Payment Confirmation - Update payment status
app.post("/payment", async (req, res) => {
  // Update the payment status directly from session (no ID needed)
  const reservation = req.session.reservation;
  if (!reservation) {
    return res.status(404).send("Reservation not found.");
  }

  // Find reservation in the database and update payment status
  await Reservation.updateOne(
    {
      name: reservation.name,
      phone: reservation.phone,
      date: reservation.date,
    },
    { paymentStatus: "Completed" }
  );

  // Update session data
  req.session.reservation.paymentStatus = "Completed";

  res.status(200).send("Payment Confirmed.");
});

// Fetch reservation details from the session
app.get("/reservation", (req, res) => {
  const reservation = req.session.reservation;
  if (!reservation) {
    return res.status(404).send("Reservation not found.");
  }
  res.json(reservation);
});
const reviewSchema = new mongoose.Schema({
  name: String,
  rating: Number,
  review: String,
  date: { type: Date, default: Date.now },
});
const Review = mongoose.model("Review", reviewSchema);

// Serve reviews page
app.get("/reviews", (req, res) => {
  res.sendFile(path.join(__dirname, "reviews.html"));
});

// Submit review
app.post("/submit-review", async (req, res) => {
  try {
    const { name, rating, review } = req.body;
    const newReview = new Review({ name, rating, review });
    await newReview.save();
    res.status(200).send("Review saved.");
  } catch (error) {
    res.status(500).send("Error saving review.");
  }
});

// Get all reviews
app.get("/get-reviews", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ date: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).send("Error fetching reviews.");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
