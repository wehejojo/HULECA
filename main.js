/*jshint esversion:6*/

$(function () {
    const { InferenceEngine, CVImage } = inferencejs;
    const inferEngine = new InferenceEngine();

    const video = $("video")[0];

    var workerId;
    var cameraMode = "environment";
    var currentLocation = "";

    const startVideoStreamPromise = navigator.mediaDevices
        .getUserMedia({
            audio: false,
            video: {
                facingMode: cameraMode
            }
        })
        .then(function (stream) {
            return new Promise(function (resolve) {
                video.srcObject = stream;
                video.onloadeddata = function () {
                    video.play();
                    resolve();
                };
            });
        });

    const loadModelPromise = new Promise(function (resolve, reject) {
        inferEngine
            .startWorker("huleca", "1", "rf_gecQFLREvjcZx7wQdKNrJXR2WmA3")
            .then(function (id) {
                workerId = id;
                resolve();
            })
            .catch(reject);
    });

    Promise.all([startVideoStreamPromise, loadModelPromise]).then(function () {
        $("body").removeClass("loading");
        resizeCanvas();
        getLocation();
        detectFrame();
    });

    var canvas, ctx;
    const font = "16px sans-serif";

    function videoDimensions(video) {
        // Ratio of the video's intrisic dimensions
        var videoRatio = video.videoWidth / video.videoHeight;

        // The width and height of the video element
        var width = video.offsetWidth,
            height = video.offsetHeight;

        // The ratio of the element's width to its height
        var elementRatio = width / height;

        // If the video element is short and wide
        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            // It must be tall and thin, or exactly equal to the original ratio
            height = width / videoRatio;
        }

        return {
            width: width,
            height: height
        };
    }

    $(window).resize(function () {
        resizeCanvas();
    });

    const resizeCanvas = function () {
        $("canvas").remove();

        canvas = $("<canvas/>");

        ctx = canvas[0].getContext("2d");

        var dimensions = videoDimensions(video);

        console.log(
            video.videoWidth,
            video.videoHeight,
            video.offsetWidth,
            video.offsetHeight,
            dimensions
        );

        canvas[0].width = video.videoWidth;
        canvas[0].height = video.videoHeight;

        canvas.css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2
        });

        $("body").append(canvas);
    };

    var alertTimeout;
    var isAlertTriggered = false;

    const renderPredictions = function (predictions) {
        var scale = 1;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        let cigaretteDetected = false;

        predictions.forEach(function (prediction) {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            if(prediction.class.toLowerCase() === "cigarette")
                cigaretteDetected = true;

            // Draw the bounding box.
            ctx.strokeStyle = prediction.color;
            ctx.lineWidth = 4;
            ctx.strokeRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                width / scale,
                height / scale
            );

            // Draw the label background.
            ctx.fillStyle = prediction.color;
            const textWidth = ctx.measureText(prediction.class).width;
            const textHeight = parseInt(font, 10); // base 10
            ctx.fillRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                textWidth + 4,
                textHeight + 2
            );
        });

        predictions.forEach(function (prediction) {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            // Draw the text last to ensure it's on top.
            ctx.font = font;
            ctx.textBaseline = "top";
            ctx.fillStyle = "#000000";
            ctx.fillText(
                prediction.class,
                (x - width / 2) / scale + 4,
                (y - height / 2) / scale + 1
            );
        });

        if (cigaretteDetected && !isAlertTriggered){
            isAlertTriggered = true;
            alertTimeout = setTimeout(() => {
                alert("Cigarette Detected! Enforcers have been informed");
                fetchLogs();
                isAlertTriggered = false;
            }, 3000);
        } else if (!cigaretteDetected) {
            clearTimeout(alertTimeout);
            isAlertTriggered = false;
        }
    };

    // const sendSMStext = async (mobile_number) => {
    //     const corsProxy = "https://cors-anywhere.herokuapp.com/";
    //     const url = `${corsProxy}https://api.semaphore.co/api/v4/messages`;
        
    //     const data = {
    //         api_key: "04648b74c298c5ba55fa87412f85fbd9",
    //         number: mobile_number,
    //         message: "Cigarette Detected at Moment!!",
    //         sendername: "DeWag"
    //     };

    //     try {
    //         const res = await fetch(
    //             url, {
    //                 method: "POST",
    //                 headers: {
    //                     "Content-Type": "appplication/json"
    //                 },
    //                 body: JSON.stringify(data)
    //             }
    //         );

    //         if (!res.ok)
    //             throw new Error("Cannot send SMS");

    //         const result = await res.json();
    //         console.log(`SMS Successfully Sent to ${mobile_number}: ${result}`);
    //     } catch (err) {
    //         console.error("Error Sending SMS: ", err)
    //     }
    // };

    const fetchLogs = async () => {
        try{
            const response = axios.get("http://localhost:3001/logs");
            console.log(response.data);
        } catch(error) {
            console.error("Error:", error.message);
        }
    };

    const getLocation = () => {
        if(navigator.geolocation){
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    currentLocation = { latitude, longitude };
                },
                (err) => { console.error(`Error getting location: ${err.message}`); }
            );
        }
    };

    const logViolation = async (imgPath) => {
        if (!currentLocation.latitude && !currentLocation.longitude){
            console.error("Location is not available. Call getLocation() first.");
            return;
        }

        try {
            const logData = {
                logLocation: `${currentLocation.latitude}, ${currentLocation.longitude}`,
                logImagePath: `${imgPath}`
            };
            const response = await axios.post("http://localhost:3001/violate", logData);
            console.log("Log added successfully:", response.data);
        } catch (error) {
            console.error("Error posting violation log:", error.message);
        }
    };

    var prevTime;
    var pastFrameTimes = [];
    const detectFrame = function () {
        if (!workerId) return requestAnimationFrame(detectFrame);

        const image = new CVImage(video);
        inferEngine
            .infer(workerId, image)
            .then(function (predictions) {
                requestAnimationFrame(detectFrame);
                renderPredictions(predictions);

                if (prevTime) {
                    pastFrameTimes.push(Date.now() - prevTime);
                    if (pastFrameTimes.length > 30) pastFrameTimes.shift();

                    var total = 0;
                    _.each(pastFrameTimes, function (t) {
                        total += t / 1000;
                    });

                    var fps = pastFrameTimes.length / total;
                    $("#fps").text(Math.round(fps));
                }
                prevTime = Date.now();
            })
            .catch(function (e) {
                console.log("CAUGHT", e);
                requestAnimationFrame(detectFrame);
            });
    };
});