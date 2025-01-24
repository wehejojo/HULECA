const express = require('express');
const moment = require('moment');
const cors = require('cors');
const fs = require('fs');
const app = express();

const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send("MOMEEEENT");
});

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
        console.log(`  - logTime     : ${moment().format('MMMM Do YYYY, h:mm:ss a')}`);
        
        // Return a new object with logTime added
        return {
          ...log,
          logTime: moment().format('MMMM Do YYYY, h:mm:ss a')
        };
      });

      // Respond with the formatted logs
      res.json(formattedLogs);
    } catch (parseError) {
      console.error(`JSON Parse Error: ${parseError.message}`);
      res.status(500).json({
        error: "Failed to parse JSON",
      });
    }
  });
});

app.post('/violate', (req, res) => {
  const filePath = "./db/HULECA-logs.json";

  // Destructure logLocation and logImagePath from the request body
  const { logLocation, logImagePath } = req.body;

  if (!logLocation || !logImagePath) {
    return res.status(400).json({
      error: "Both logLocation and logImagePath are required",
    });
  }

  // Create a new log entry
  const newLog = {
    logTime: moment().format('MMMM Do YYYY, h:mm:ss a'),
    logLocation,
    logImagePath,
  };

  // Read the existing logs
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`File Read Error: ${err.message}`);
      return res.status(500).json({
        error: "Failed to read the log file",
      });
    }

    try {
      const logs = JSON.parse(data || "[]"); // Parse existing logs or initialize with an empty array
      logs.push(newLog); // Add the new log

      // Write the updated logs back to the file
      fs.writeFile(filePath, JSON.stringify(logs, null, 2), 'utf8', (writeErr) => {
        if (writeErr) {
          console.error(`File Write Error: ${writeErr.message}`);
          return res.status(500).json({
            error: "Failed to write to the log file",
          });
        }

        res.status(201).json({
          message: "Log added successfully",
          log: newLog,
        });
      });
    } catch (parseError) {
      console.error(`JSON Parse Error: ${parseError.message}`);
      res.status(500).json({
        error: "Failed to parse existing logs",
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Moment is currently momenting on port: ${PORT}`);
});
