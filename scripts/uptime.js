// Description:
// 	This script checks a list of websites found in config/config.js and notifies the web admin via
// 	Slack if the sites are down. The bot runs a cronjob every minute to monitor the sites
//
// Configuration:
// 	You will need to set a valid HUBOT_SLACK_TOKEN provided by the Slack API to run this bot
//
// Commands:
//    bursdag - Returnerer hvem som har bursdag i dag i Bekk
//    check - Runs a check on all sites you are monitoring
//    config - Returns default config for Hubot
// 	  hubot which sites - Lists the sites you are currently watching
//    hubot add domain - Adds <domain> to the sites to monitor and check
// 	  hubot del domain - Deletes <domain> from the monitored sites

require("dotenv").config();
const isReachable = require("is-reachable");
const { CronJob } = require("cron");
const config = require("../config/config.js");
const logger = require("../config/logging.js");
let influx = null;
if (!isDevEnvironment()) {
  influx = require("../config/database.js");
}

function isDevEnvironment() {
  const env = process.env.ENV === "dev" ? process.env.ENV : "production";
  return "dev" === env;
}

module.exports = function(bot) {
  const tz = "Europe/Oslo";
  new CronJob("* * * * *", checkSites, null, true, tz);
  new CronJob("0 8 * * *", checkBirthday, null, true, tz);

  bot.brain.data.sites = config.sites || [];

  bot.hear(/check/i, res => {
    logger.info("Sjekker om nettsidene er oppe");
    const { sites } = bot.brain.data;
    if (sites.length === 0) {
      logger.info(
        "Det er ingen sider i databasen som skal sjekkes. Databasen er tom."
      );
      res.send(
        "Det er ingen sider i databasen som skal sjekkes. Legg til en side med kommandoen add <url>"
      );
      return;
    }
    res.send(
      `Sjekker ${
        sites.length > 1 ? `${sites.length} sider` : `${sites.length} side`
      }`
    );
    checkSites(true);
  });

  bot.hear(/bursdag/i, res => {
    checkBirthday(bot, res);
  });

  bot.respond(/config/i, res => {
    res.send(`Configen min er ${JSON.stringify(config)}`);
  });

  bot.respond(/(which sites|ws)/i, res => {
    res.send(
      `Overvåker følgende sider: ${
        bot.brain.data.sites.length > 0
          ? bot.brain.data.sites.join(", ")
          : "Ingen. Legg til en side med kommandoen add <url>"
      }`
    );
  });

  bot.respond(/add (.*)/i, res => {
    if (res.match[1]) {
      const url = res.match[1];
      const sites = bot.brain.data.sites;
      sites.push(url);
      bot.brain.data.sites = sites;
      res.send(
        `La til ${url}.\nOvervåker nå: ${sites.map(site => `${site}\n`)}`
      );
    } else {
      res.send(`Vennligst oppgi en url jeg skal overvåke.`);
    }
  });

  bot.respond(/del (.*)/i, res => {
    if (res.match[1]) {
      const url = res.match[1];
      const { sites } = bot.brain.data;
      const siteToDelete = sites.find(s => s === url);
      if (siteToDelete) {
        const updatedSites = sites.filter(s => s !== url);
        bot.brain.data.sites = updatedSites;
        res.send(
          `${url} er nå fjernet fra databasen. Overvåker nå ${updatedSites.join(
            ", "
          )}`
        );
      } else {
        res.send(`Fant ingen sider med url: ${url}. Enten eksisterer den ikke, eller så har du skrevet feil url.
					Jeg overvåker foreløpig følgende sider: ${sites.join(", ")}`);
      }
    } else {
      res.send("Vennligst oppgi en url jeg skal slutte å følge.");
    }
  });

  function registerSuccess(site) {
    if (!isDevEnvironment()) {
      try {
        influx.writePoints([
          {
            measurement: "uptime",
            tags: { uptime_bot: site },
            fields: {
              status_name: "success",
              status: true,
              status_number: 1,
              site_name: site
            }
          }
        ]);
      } catch (error) {
        logger.error(
          "Kunne ikke skrive oppetid til influx. Det kan være fordi databasen ikke finnes, eller influx-db-hosten er nede.",
          error
        );
      }
    }
  }

  function registerDowntime(site) {
    if (!isDevEnvironment()) {
      try {
        influx.writePoints([
          {
            measurement: "uptime",
            tags: { uptime_bot: site },
            fields: {
              status_name: "failure",
              status: false,
              status_number: 0,
              site_name: site
            }
          }
        ]);
      } catch (error) {
        logger.error(
          "Kunne ikke skrive nedetid til influx. Det kan være fordi databasen ikke finnes, eller influx-db-hosten er nede.",
          error
        );
      }
    }
  }

  function checkBirthday() {
    logger.info("Sjekker bursdager");
    bot
      .http("https://forside.bekk.no/api/birthdays")
      .header("Accept", "application/json")
      .get()((err, response, body) => {
      if (err) {
        logger.error("Kunne ikke hente bursdager", err);
        bot.messageRom(config.slackRoom, "Kunne ikke hente bursdager");
      }
      const parsed = parseBody(body, bot);
      if (parsed.length <= 0) {
        bot.messageRoom(config.slackRoom, "Ingen har bursdag i dag");
        return;
      }
      let bursdagsTekst = "Disse har bursdag i dag:\n";
      bursdagsTekst = JSON.parse(body)
        .map(
          person =>
            `${person["Image"]}\n ${person["Name"]} blir ${
              person["Age"]
            } år i dag :birthday:`
        )
        .join("\n");
      bot.messageRoom(config.slackRoom, bursdagsTekst);
    });
  }

  function parseBody(body, bot) {
    try {
      return JSON.parse(body);
    } catch (err) {
      bot.messageRom(
        config.slackRoom,
        "Kunne ikke parse response fra API til Bekk. Prøv igjen senere..."
      );
      logger.error("Kunne ikke parse body fra response", body);
      return [];
    }
  }

  function checkSites(checkByCommand) {
    const { sites } = bot.brain.data;
    if (sites.length <= 0) {
      bot.messageRoom(
        config.slackRoom,
        "Det er ingen sider i databasen som skal sjekkes."
      );
    } else {
      sites.forEach(site => {
        isReachable(site, {
          timeout: 1000 * config.noResponseTresholdInSeconds
        }).then(reachable => {
          const now = new Date();

          if (reachable) {
            if (checkByCommand) {
              bot.messageRoom(
                config.slackRoom,
                `:white_check_mark: ${site} er online: ${now}`
              );
              registerSuccess(site);
              return;
            }
          } else {
            bot.messageRoom(
              config.slackRoom,
              `${
                config.webAdminSlackName
              } :fire: ${site} er offline: ${now}. Du bør finne ut hvorfor :fire:`
            );
            registerDowntime(site);
          }
        });
      });
    }
  }
};
