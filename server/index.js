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
      
      // Add logTime to each log
      const formattedLogs = logs.map((log, index) => {
        console.log(`Log ${index + 1}`);
        console.log(`  - logLocation : ${log.logLocation}`);
        console.log(`  - logTime     : ${moment().format('MMMM_Do_YYYY,_h:mm:ss_a')}`);
        console.log(`  - logImage    : ${log.logImagePath}`);
        
        return {
          ...log,
          logTime: moment().format('MMMM_Do_YYYY,_h:mm:ss_a')
        };
      });
      
      // Respond with the formatted logs
      // res.json(formattedLogs);
      res.json(logs);
    } catch (parseError) {
      console.error(`JSON Parse Error: ${parseError.message}`);
      res.status(500).json({
        error: "Failed to parse JSON",
      });
    }
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
      // Parse the JSON data
      const logs = JSON.parse(data);

      // Make sure the data is an array before getting the length
      if (Array.isArray(logs)) {
        // Return the length of the array (number of logs)
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


app.post('/violate', (req, res) => {
  const { logLocation, logImage } = req.body;

  if (!logLocation || !logImage) {
    return res.status(400).json({
      error: "logLocation and logImage are required"
    });
  }

  const timestamp = moment().format('YYYYMMDD-HHmmss'); // Remove spaces to avoid filename issues
  const imageFilename = `violation-${timestamp}.jpg`;
  const imagePath = path.join(IMG_DIR, imageFilename);

  // Remove Base64 header
  const base64Data = logImage.replace(/^data:image\/jpeg;base64,/, "");

  // ✅ **Write the image to the filesystem**
  fs.writeFile(imagePath, base64Data, "base64", (err) => {
    if (err) {
      console.error("Error saving image:", err);
      return res.status(500).json({ error: "Failed to save image" });
    }

    console.log(`✅ Image saved at: ${imagePath}`);

      // Create log entry
    const newLog = {
      logTime: moment().format("MMMM Do YYYY, h:mm:ss a"),
      logLocation,
      logImagePath: `/imgs/${imageFilename}` // Store relative path
    };

      // Read existing logs
    fs.readFile(LOGS_FILE, "utf8", (readErr, data) => {
      let logs = [];
      if (!readErr && data) {
        try {
          logs = JSON.parse(data);
        } catch (parseError) {
          console.error("Error parsing logs JSON:", parseError.message);
        }
      }

      logs.push(newLog);

          // Write updated logs
      fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2), "utf8", (writeErr) => {
        if (writeErr) {
          console.error("Error writing to logs file:", writeErr);
          return res.status(500).json({ error: "Failed to save log" });
        }

        res.status(201).json({
          message: "Violation logged successfully",
          log: newLog
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});