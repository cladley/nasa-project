const axios = require("axios");
const launchesDB = require("./launches.mongo");
const planetsDB = require("./planets.mongo");

const SPACEX_API_URL =
  "https://ll.thespacedevs.com/2.3.0/launches/?format=json&limit=820&offset=0&search=SpaceX";

async function populateLaunches() {
  const response = await axios.get(SPACEX_API_URL);

  if (response.status !== 200) {
    console.log("Problem downloading launch data");
    throw new Error("Launch data download failed");
  }

  const launchResults = response.data.results;
  for (const launchItem of launchResults) {
    const launch = {
      flightNumber: launchItem.mission.id,
      mission: launchItem.name,
      rocket: launchItem.rocket.configuration.name,
      upcoming: launchItem.status.id === 1,
      success: launchItem.status.id === 3,
      customers: launchItem.mission.agencies[0]?.name,
      launchDate: launchItem.net,
    };

    await saveLaunch(launch);
  }
}

async function loadLaunchData() {
  const firstLaunch = await findLaunch({
    mission: "Falcon 1 | FalconSAT-2",
  });

  // Only hit the api and load data if the database
  // doesn't contain spacex data
  if (firstLaunch) {
    console.log("Launch data already loaded");
    return;
  } else {
    await populateLaunches();
    console.log("Launch data loaded");
  }
}

async function findLaunch(filter) {
  return await launchesDB.findOne(filter);
}

async function existsLaunchWithId(launchId) {
  return await findLaunch({ flightNumber: launchId });
}

async function abortLaunchById(launchId) {
  const aborted = await launchesDB.updateOne(
    {
      flightNumber: launchId,
    },
    {
      upcoming: false,
      success: false,
    },
  );

  return aborted.matchedCount === 1;
}

async function latestLaunchFlightNumber() {
  // Sort by desc so the the lastest flight number as the first one
  const launch = await launchesDB.findOne().sort("-flightNumber");

  if (!launch) return DEFAULT_FLIGHT_NUMBER;

  return launch.flightNumber;
}

async function getAllLaunches(skip, limit) {
  return await launchesDB
    .find({}, { _id: 0, __v: 0 })
    .sort({
      flightNumber: 1,
    })
    .skip(skip)
    .limit(limit);
}

async function saveLaunch(launch) {
  await launchesDB.findOneAndUpdate(
    {
      flightNumber: launch.flightNumber,
    },
    launch,
    {
      upsert: true,
    },
  );
}

async function scheduleNewLaunch(launch) {
  const planet = await planetsDB.findOne({ keplerName: launch.target });

  if (!planet) {
    throw new Error("No matching planet found");
  }

  const newFlightNumber = (await latestLaunchFlightNumber()) + 1;

  Object.assign(launch, {
    flightNumber: newFlightNumber,
    customers: ["ZTM", "NASA"],
    upcoming: true,
    success: true,
  });

  await saveLaunch(launch);
}

module.exports = {
  getAllLaunches,
  scheduleNewLaunch,
  existsLaunchWithId,
  abortLaunchById,
  loadLaunchData,
};
