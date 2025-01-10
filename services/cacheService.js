const async = require("async");
const eventService = require("../services/eventService");
const Interactions = require("../models/surpriseInteractions.js");
let cachedEvent, cachedSurpriseGuest, cachedPopQuiz;

exports.init = async function () {
  // cachedEvent = await eventService.getLatestEventData();
  cachedSurpriseGuest = await cacheSurpriseGuest();
  cachedPopQuiz = await eventService.getLatestEvent("PopQuiz");

  // const changeStream = eventService.getChangeStream();
  // changeStream.on("change", async next => {
  // 	cachedEvent = await eventService.getLatestEventData();
  // });

  const changeStreamSPG = Interactions.watch();
  changeStreamSPG.on("change", async (next) => {
    cachedSurpriseGuest = await cacheSurpriseGuest();
  });

  const changeStreamEvents = eventService.getChangeStream();
  changeStreamEvents.on("change", async (next) => {
    cachedPopQuiz = await eventService.getLatestEvent("PopQuiz");
  });
};

exports.setCachedEvent = function (event) {
  cachedEvent = event;
};

exports.getCachedEvent = function () {
  return cachedEvent;
};

exports.getCachedSurpriseGuest = function () {
  return cachedSurpriseGuest;
};

exports.getCachedPopQuiz = function () {
  return cachedSurpriseGuest;
};

async function cacheSurpriseGuest() {
  let interactions = [
    { chara: "Lucifer", interactions: [] },
    { chara: "Mammon", interactions: [] },
    { chara: "Leviathan", interactions: [] },
    { chara: "Satan", interactions: [] },
    { chara: "Asmodeus", interactions: [] },
    { chara: "Beelzebub", interactions: [] },
    { chara: "Belphegor", interactions: [] },
    { chara: "Diavolo", interactions: [] },
    { chara: "Barbatos", interactions: [] },
    { chara: "Luke", interactions: [] },
    { chara: "Simeon", interactions: [] },
    { chara: "Solomon", interactions: [] },
  ];
  let interactionList = await Interactions.find({}).sort({ _id: 1 });
  interactions.forEach(function (obj) {
    obj.interactions = interactionList.filter(
      (int) => int.character === obj.chara
    );
  });
  return interactions;
}
