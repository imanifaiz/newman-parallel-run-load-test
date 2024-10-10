const path = require('path');
const async = require('async');
const newman = require('newman');
const fs = require('fs');  // File system module for logging

// Helper function to format date and time as d-m-Y H:i:s
const formatDate = (date) => {
    const pad = (n) => (n < 10 ? '0' : '') + n;
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const PARALLEL_RUN_COUNT = 10;
const logFilePath = path.join(__dirname, 'newman_run_log.txt'); // Log file path

// Helper function to append logs to a file
const appendLog = (data) => {
    fs.appendFileSync(logFilePath, data + '\n', (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
};

const parametersForTestRun = {
    collection: path.join(__dirname, 'postman_collection.json'), // your collection
    reporters: 'cli'
};

parallelCollectionRun = function (done) {
    const startTime = new Date(); // Capture start time
    const formattedStartTime = formatDate(startTime);
    console.log(`Run started at: ${formattedStartTime}`);
    
    newman.run(parametersForTestRun, function (err, summary) {
        const endTime = new Date(); // Capture end time
        const duration = (endTime - startTime) / 1000; // Calculate duration in seconds
        const formattedEndTime = formatDate(endTime);
        
        console.log(`Run ended at: ${formattedEndTime} and took ${duration} seconds`);

        const allRequests = [];
        summary.run.executions.forEach(execution => {
            const responseCode = execution.response.code;
            allRequests.push({
                name: execution.item.name,
                status: responseCode,
                responseTime: execution.response.responseTime,
                success: String(responseCode).startsWith('2'), // Determine if it's a success
                error: execution.response.status,
            });
        });

        // Pass the results along
        done(err, { summary, allRequests, duration, startTime, endTime });
    });

};

let commands = [];
for (let index = 0; index < PARALLEL_RUN_COUNT; index++) {
    commands.push(parallelCollectionRun);
}

// Runs the Postman collection in parallel
async.parallel(
    commands,
    (err, results) => {
        err && console.error(err);

        let allResponses = [];  // Collect all responses from all runs

        results.forEach(function (result, index) {
            const requests = result.allRequests;
            const startTime = formatDate(result.startTime);
            const endTime = formatDate(result.endTime);
            const duration = result.duration;

            // Log information for each run
            const runLogMessage = `Run #${index + 1} started at ${startTime} and finished in ${duration} seconds (Ended at ${endTime}).`;
            console.info(runLogMessage);
            appendLog(runLogMessage);  // Append to log file

            requests.forEach(request => {
                const statusText = request.success ? "Success" : "Failure";
                const requestLogMessage = `${statusText}: Request "${request.name}" - Status: ${request.status}, Response Time: ${request.responseTime}ms.`;
                console.info(requestLogMessage);
                appendLog(requestLogMessage);  // Append to log file
				appendLog('');  // Empty line
            });

            allResponses = allResponses.concat(requests);
        });

		// Append separators after each run
		appendLog('');  // Empty line
		appendLog('****************************************************************************************************************************************');  // Separator
		appendLog('');  // Another empty line
		

        // Summary of all requests
        console.log("\nSummary of all requests:");
        let successCount = 0, failureCount = 0;
        allResponses.forEach((response, i) => {
            if (response.success) {
                successCount++;
            } else {
                failureCount++;
            }
            console.log(`${i + 1}. Request "${response.name}" - Status: ${response.status}, Response Time: ${response.responseTime}ms`);
        });

        console.log(`\nTotal successful requests: ${successCount}`);
        console.log(`Total failed requests: ${failureCount}`);
    }
);

