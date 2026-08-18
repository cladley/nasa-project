const { parse } = require("csv-parse");
const fs = require("node:fs");
const path = require("node:path");
const planets = require("./planets.mongo");

function loadPlanetsData() {
  return new Promise((resolve, reject) => {
    const savePromises = [];

    fs.createReadStream(
      path.join(__dirname, "..", "..", "data", "/kepler_data.csv"),
    )
      .pipe(parse({ columns: true, comment: "#" }))
      .on("data", async (data) => {
        if (isHabitablePlanet(data)) {
          savePromises.push(savePlanet(data));
        }
      })
      .on("error", (err) => {
        console.log(err);
        reject(err);
      })
      .on("end", async () => {
        await Promise.all(savePromises);
        const countPlanetsFound = (await getAllPlanets()).length;
        console.log(`${countPlanetsFound} habitable planets found!`);
        resolve();
      });
  });
}

function isHabitablePlanet(planet) {
  return (
    planet["koi_disposition"] === "CONFIRMED" &&
    planet["koi_insol"] > 0.36 &&
    planet["koi_insol"] < 1.11 &&
    planet["koi_prad"] < 1.6
  );
}

async function savePlanet(planet) {
  try {
    await planets.updateOne(
      {
        keplerName: planet.kepler_name,
      },
      {
        keplerName: planet.kepler_name,
      },
      {
        upsert: true,
      },
    );
  } catch (error) {
    console.error(`Could not save planet: ${error}`);
  }
}

async function getAllPlanets() {
  // Exclude _id and __v fields from the result
  return await planets.find(
    {},
    {
      _id: 0,
      __v: 0,
    },
  );
}

module.exports = {
  getAllPlanets,
  loadPlanetsData,
};
