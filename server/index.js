require('dotenv').config();
const express = require('express');
const moment = require('moment');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
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
        return {
          ...log,
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