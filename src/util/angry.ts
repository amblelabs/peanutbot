import config from "config.json";
import { type Message } from "discord.js";
import cache from "./cache";

const url =
  "http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/angry.png";

async function sendAngry(message: Message) {
  cache.uncache(url, (m) => {
    message.reply({
      content: config.fun.wrath.message,
      files: [m],
    });
  });
}
export default {
  sendAngry,
};
