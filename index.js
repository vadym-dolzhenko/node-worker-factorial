const os = require("os");
const path = require("path");
const {
  Worker
} = require("worker_threads");
const inquirer = require("inquirer");
const ora = require("ora");
const _ = require("lodash");

const userCPUCount = os.cpus().length;
const NS_PER_SEC = 1e9;
const workerPath = path.resolve("factorial-worker.js");

const getSegments = number => {
  const numbers = [];
  for (let i = 1n; i <= number; i++) {
    numbers.push(i);
  }
  const segmentSize = Math.ceil(numbers.length / userCPUCount);

  return _.chunk(numbers, segmentSize);
};

const calculateFactorialWithWorker = number => {
  const segments = getSegments(number);
  const promises = segments.map(
    segment =>
    new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        workerData: segment,
      });
      worker.on("message", resolve);
      worker.on("error", reject);
      worker.on("exit", code => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    })
  );

  return Promise.all(promises).then(results => {
    return results.reduce((acc, val) => acc * val, 1n);
  });
};

const prepareWorkerPool = number => {
  const segments = getSegments(number);
  const promises = segments.map(
    () =>
    new Promise((resolve, reject) => {
      const worker = new Worker(workerPath);
      worker.on("online", () => resolve(worker));
      worker.on("error", reject);
      worker.on("exit", code => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    })
  );
  return Promise.all(promises);
};

const calculateFactorialWithWorkerPool = (number, workers) => {
  const segments = getSegments(number);
  const promises = workers.map(
    (worker, key) =>
    new Promise((resolve, reject) => {
      worker.on("message", resolve);
      worker.on("error", reject);
      worker.postMessage(segments[key])
    })
  );

  return Promise.all(promises).then(results => {
    return results.reduce((acc, val) => acc * val, 1n);
  });
};

const calculatFactorial = (number) => {
  const numbers = [];
  for (let i = 1n; i <= number; i++) {
    numbers.push(i);
  }
  return numbers.reduce((acc, val) => acc * val, 1n);
};

const benchmarkFactorial = async (inputNumber, factFun, label, pool) => {
  const spinner = ora(`Calculating with ${label}..`).start();
  const startTime = process.hrtime();
  await factFun(BigInt(inputNumber), pool);
  const diffTime = process.hrtime(startTime);
  const time = diffTime[0] * NS_PER_SEC + diffTime[1];
  spinner.succeed(`${label} result done in: ${Math.floor(time / 1000000)}`);
  return time;
};

const run = async () => {
  const {
    inputNumber
  } = await inquirer.prompt([{
    type: "input",
    name: "inputNumber",
    message: "Calculate factorial for:",
    default: 10,
  }, ]);

  const timeWorker = await benchmarkFactorial(inputNumber, calculateFactorialWithWorker, "Worker");
  const workers = await prepareWorkerPool(BigInt(inputNumber));
  const timePool = await benchmarkFactorial(inputNumber, calculateFactorialWithWorkerPool, "Worker pool", workers);
  const timeMain = await benchmarkFactorial(inputNumber, calculatFactorial, "Main");
  const diff1 = timeMain - timeWorker;
  console.log(`Difference between main and worker: ${Math.floor(diff1 / 1000000)}ms`);
  const diff2 = timeWorker - timePool;
  console.log(`Difference between worker and pool: ${Math.floor(diff2 / 1000000)}ms`);
  const diff3 = timeMain - timePool;
  console.log(`Difference between main and pool: ${Math.floor(diff3 / 1000000)}ms`);
};

run();