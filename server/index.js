const express = require('express');
const moment = require('moment');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

const admin = require("firebase-admin");

const serviceAccount = require("./firebase-service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const IMG_DIR = "./db/imgs/";
const LOGS_FILE = "./db/HULECA-logs.json";

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
if (!fs.existsSync(LOGS_FILE)) fs.writeFileSync(LOGS_FILE, "[]", "utf8");

app.get('/', (req, res) => {
  res.send("MOMEEEENT");

  // setInterval(() => {
  //   const memoryUsage = process.memoryUsage();
  //   console.log(`Memory Usage:
  //   RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB
  //   Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB
  //   Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB
  //   External: ${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`);
  // }, 5000);
});

app.use('/imgs', express.static(IMG_DIR));

app.get('/logs', (req, res) => {
  const filePath = "./db/HULECA-logs.json";
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`File Read Error: ${err.message}`);
      return res.status(500).json({
        error: "Failed to read the file",
      });
    }
    
    try {
      const logs = JSON.parse(data);

      const formattedLogs = logs.map((log, index) => {
        console.log(`Log ${index + 1}`);
        console.log(`  - logID       : ${log.logID}`);
        console.log(`  - logLocation : ${log.logLocation}`);
        console.log(`  - logTime     : ${log.logTime}`);
        console.log(`  - logImage    : ${log.logImagePath}`);
        
        return {
          ...log,
          // logTime: moment().format('MM/DD/YYYY - h:mm a')
        };
      });
      
      res.json(formattedLogs);
    } catch (parseError) {
      console.error(`JSON Parse Error: ${parseError.message}`);
      res.status(500).json({
        error: "Failed to parse JSON",
      });
    }
  });
});


app.post("/violate", (req, res) => {
  const { logLocation, logImage, logTime } = req.body;
  // const { logLocation, logImage, logTime, userToken } = req.body;

  // if (!logLocation || !logImage || !userToken)
  if (!logLocation || !logImage ) {
    return res.status(400).json({
      error: "logLocation, logImage are required",
    });
  }

  const timestamp = moment().format("YYYYMMDD-HHmmss");
  const imageFilename = `violation-${timestamp}.jpg`;
  const imagePath = path.join(IMG_DIR, imageFilename);
  const base64Data = logImage.replace(/^data:image\/jpeg;base64,/, "");

  fs.writeFile(imagePath, base64Data, "base64", async (err) => {
    if (err) {
      console.error("Error saving image:", err);
      return res.status(500).json({ error: "Failed to save image" });
    }

    console.log(`✅ Image saved at: ${imagePath}`);

    fs.readFile(LOGS_FILE, "utf8", (readErr, data) => {
      let logs = [];
      let nextLogID = 1;
      if (!readErr && data) {
        try {
          logs = JSON.parse(data);
          if (logs.length > 0) {
            const lastID = logs[logs.length - 1].logID || 0;
            nextLogID = lastID + 1;
          }
        } catch (parseError) {
          console.error("Error parsing logs JSON:", parseError.message);
        }
      }

      const newLog = {
        logID: nextLogID,
        logTime: moment().format('MM/DD/YYYY - h:mm a'),
        logLocation,
        logImagePath: `/imgs/${imageFilename}`,
      };

      logs.push(newLog);

      fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2), "utf8", async (writeErr) => {
        if (writeErr) {
          console.error("Error writing to logs file:", writeErr);
          return res.status(500).json({ error: "Failed to save log" });
        }

        // Send Push Notification
        // const message = {
        //   token: userToken, // User's FCM token
        //   notification: {
        //     title: "Violation Logged",
        //     body: `New violation at ${logLocation}`,
        //   },
        //   data: {
        //     logLocation,
        //     logImagePath: `/imgs/${imageFilename}`,
        //   },
        // };

        // try {
        //   await admin.messaging().send(message);
        //   console.log("✅ Notification sent!");
        // } catch (error) {
        //   console.error("❌ Error sending notification:", error);
        // }

        res.status(201).json({
          message: "Violation logged successfully",
          log: newLog,
        });
      });
    });
  });
});

app.get('/numLog', (req, res) => {
  const filePath = "./db/HULECA-logs.json";
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`File Read Error: ${err.message}`);
      return res.status(500).json({
        error: "Failed to read the file",
      });
    }

    try {
      const logs = JSON.parse(data);

      if (Array.isArray(logs)) {
        res.json({ numLogs: logs.length });
      } else {
        res.status(500).json({
          error: "The JSON data is not an array",
        });
      }

    } catch (parseError) {
      console.error(`JSON Parse Error: ${parseError.message}`);
      res.status(500).json({
        error: "Failed to parse JSON",
      });
    }
  });
});

app.listen(PORT, "0.0.0.0" || "localhost" ,() => {
  console.log(`Listening to requests on http://${"192.168.100.6" || "localhost"}:${PORT}`);
});