const {
    parentPort,
    workerData
} = require("worker_threads");

const calculateFactorial = numArray => numArray.reduce((acc, val) => acc * val, 1n);
const calculateAndSend = numArray => parentPort.postMessage(calculateFactorial(numArray));
const numbers = workerData;
if (!numbers) {
    parentPort.once("message", numbers => calculateAndSend(numbers))
} else {
    calculateAndSend(numbers);
}