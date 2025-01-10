const Interactions = require("../models/surpriseInteractions.js");

let cachedSurpriseGuest;

exports.init = async function () {
  cachedSurpriseGuest = await cacheSurpriseGuest();
  Interactions.watch().on("change", async () => {
    cachedSurpriseGuest = await cacheSurpriseGuest();
  });
};

exports.getCachedSurpriseGuest = function () {
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
  let interactionList = await Interactions.find({}).sort({ _id: 1 }).lean();
  interactions.forEach(function (obj) {
    obj.interactions = interactionList.filter(
      (int) => int.character === obj.chara,
    );
  });
  return interactions;
}
