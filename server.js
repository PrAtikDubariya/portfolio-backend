const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Twilio setup
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Validate phone number in E.164 format
function isValidE164(number) {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(number);
}

// Simple email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Send SMS via Twilio
function sendSMS(number, message) {
  return twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: number
  });
}

// Send Email via Nodemailer with HTML formatting
async function sendEmail(email, subject, message) {
  let transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="color: #2e6da4;">${subject}</h2>
      <p>${message}</p>
      <hr />
      <p style="font-size: 0.9em;">Thanks & Regards,<br><strong>${process.env.SMTP_SENDER_NAME}</strong></p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${process.env.SMTP_SENDER_NAME}" <${process.env.MAIL_USER}>`,
    to: email,
    subject: subject,
    text: message,
    html: htmlMessage
  });
}

app.get('/download-resume', (req, res) => {
  const filePath = path.join(__dirname, 'my-resume.pdf');
  res.download(filePath, 'my-resume.pdf', (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(500).send('Could not download the file.');
    }
  });
});

// Route
app.post('/notify', async (req, res) => {
  const { name, number, email, message } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required and must be a non-empty string.' });
  }

  if (number && !isValidE164(number)) {
    return res.status(400).json({ error: 'Invalid phone number format. Must be E.164 format.' });
  }

  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  const userMessage = message || 'Hello from backend!';

  // Compose owner message with name, email, phone, and message
  const ownerMessage = `
    New message from portfolio contact form:

    Name: ${name}
    Email: ${email || 'Not provided'}
    Phone Number: ${number || 'Not provided'}

    Message:
    ${userMessage}
      `.trim();

  // Thank you message to user
  const thankYouMessage = `Hi ${name}, thank you for reaching out! I will get back to you shortly.`;

  try {
    // Send message to owner (SMS and email)
    if (process.env.YOUR_PHONE) {
      await sendSMS(process.env.YOUR_PHONE, ownerMessage);
    }
    if (process.env.YOUR_EMAIL) {
      await sendEmail(process.env.YOUR_EMAIL, `New Message from Portfolio`, ownerMessage);
    }

    // Send thank you email to user
    if (email) {
      await sendEmail(email, `Thank you for contacting ${process.env.SMTP_SENDER_NAME}`, thankYouMessage);
    }

    return res.json({ status: 'Messages sent successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send messages.' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
