import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";
import csv from "csv-parser";

const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cards = {};
const actions = [];

// cards.csv 読み込み
fs.createReadStream("cards.csv")
  .pipe(csv())
  .on("data", row => {
    cards[row.id] = {
      name: row.name,
      type: row.type,
      cost: Number(row.cost),
      hp: Number(row.hp),
      sp: Number(row.sp),
      actions: []
    };
  })
  .on("end", () => {
    fs.createReadStream("actions.csv")
      .pipe(csv())
      .on("data", row => {
        actions.push(row);
      })
      .on("end", async () => {
        for (const a of actions) {
          cards[a.cardId].actions.push({
            name: a.name,
            cost: Number(a.cost),
            range: a.range,
            dmg: a.dmg ? Number(a.dmg) : undefined,
            spDmg: a.spDmg ? Number(a.spDmg) : undefined,
            rate: Number(a.rate),
            draw: a.draw ? Number(a.draw) : undefined
          });
        }

        for (const id in cards) {
          await setDoc(doc(db, "cards", id), cards[id]);
          console.log(`uploaded ${id}`);
        }
      });
  });