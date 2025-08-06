require('dotenv').config();
const express = require('express');
const moment = require('moment');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const { parse } = require('date-fns');
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const IMG_DIR = "./db/imgs/";
const LOGS_FILE = "./db/HULECA-logs.json";

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
if (!fs.existsSync(LOGS_FILE)) fs.writeFileSync(LOGS_FILE, "[]", "utf8");

app.get('/', (req, res) => {
  res.send("MOMEEEENT");
});


app.use('/imgs', express.static(path.join(__dirname, 'db/imgs')));

app.get('/logs', (req, res) => {
  const filePath = "./db/HULECA-logs.json";
  const filter = req.query.filter || "monthly";

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read the file" });
    }

    try {
      const logs = JSON.parse(data);
      const now = new Date();

      const filteredLogs = logs.filter(log => {
        const parsed = parseLogTime(log.logTime);
        if (!parsed) return false;

        switch (filter.toLowerCase()) {
          case "daily":
            return parsed.toDateString() === now.toDateString();
          case "weekly":
            return parsed.getFullYear() === now.getFullYear() && getWeekNumber(parsed) === getWeekNumber(now);
          case "monthly":
            return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth();
          case "yearly":
            return parsed.getFullYear() === now.getFullYear();
          default:
            return true;
        }
      });

      res.json(filteredLogs);

    } catch (parseError) {
      res.status(500).json({ error: "Failed to parse JSON" });
    }
  });
});

app.get('/logs/all', (req, res) => {
  const filePath = "./db/HULECA-logs.json";
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read the file" });
    }

    try {
      const logs = JSON.parse(data);
      res.json(logs);
    } catch (parseError) {
      res.status(500).json({ error: "Failed to parse JSON" });
    }
  });
});


function parseLogTime(logTimeStr) {
  try {
    const [datePart, timePart] = logTimeStr.split(" - ");
    const dateTimeStr = `${datePart} ${timePart}`;
    return new Date(dateTimeStr);
  } catch {
    return null;
  }
}

function getWeekNumber(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
}



app.post("/violate", (req, res) => {
  const { logLocation, logImage, logTime } = req.body;

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
  const filter = req.query.filter || "yearly"; // default filter

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`File Read Error: ${err.message}`);
      return res.status(500).json({ error: "Failed to read the file" });
    }

    try {
      const logs = JSON.parse(data);

      if (!Array.isArray(logs)) {
        return res.status(500).json({ error: "The JSON data is not an array" });
      }

      const now = new Date();
      const filteredLogs = logs.filter(log => {
        const parsedTime = parseLogTime(log.logTime);
        if (!parsedTime) return false;

        switch (filter.toLowerCase()) {
          case "daily":
            return parsedTime.toDateString() === now.toDateString();

          case "weekly":
            const currentWeek = getWeekNumber(now);
            const logWeek = getWeekNumber(parsedTime);
            return parsedTime.getFullYear() === now.getFullYear() && logWeek === currentWeek;

          case "monthly":
            return parsedTime.getFullYear() === now.getFullYear() &&
                   parsedTime.getMonth() === now.getMonth();

          case "yearly":
            return parsedTime.getFullYear() === now.getFullYear();

          default:
            return true;
        }
      });

      res.json({
        filter,
        numLogs: filteredLogs.length
      });

    } catch (parseError) {
      console.error(`JSON Parse Error: ${parseError.message}`);
      res.status(500).json({ error: "Failed to parse JSON" });
    }
  });
});

function parseLogTime(logTimeStr) {
  try {
    // Example format: "04/10/2025 - 4:33 am"
    const [datePart, timePart] = logTimeStr.split(" - ");
    const dateTimeStr = `${datePart} ${timePart}`;
    return new Date(dateTimeStr); // will work if locale supports this
  } catch {
    return null;
  }
}

function getWeekNumber(date) {
  const firstJan = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - firstJan) / (24 * 60 * 60 * 1000));
  return Math.ceil((dayOfYear + firstJan.getDay() + 1) / 7);
}

app.listen(PORT, "0.0.0.0" || "localhost" ,() => {
  console.log(`Listening to requests on http://localhost:${PORT}`);
});