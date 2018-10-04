// Description:
//	This script checks a list of websites found in config/config.js and notifies the web admin via
//	Slack if the sites are down. The bot runs a cronjob every minute to monitor the sites

// Configuration:
//	You will need to set a valid HUBOT_SLACK_TOKEN provided by the Slack API to run this bot

// Commands:
//	hubot which sites - Lists the sites you are currently watching
//	check - Runs a check on all sites you are monitoring
//  hubot add <domain> - Adds <domain> to the sites to monitor and check
// 	hubot del <domain> - Deletes <domain> from the monitored sites
require("dotenv").config();
const isReachable = require("is-reachable");
const CronJob = require("cron").CronJob;
const config = require("../config/config.js");
const skyss = require("../tools/skyss.js");
const moment = require("moment");
const Influx = require("influx");
const influx = new Influx.InfluxDB({
  host: process.env.INFLUX_HOST,
  database: process.env.INFLUX_DB,
  schema: [
    {
      measurement: "uptime",
      fields: {
        status_name: Influx.FieldType.STRING,
        site_name: Influx.FieldType.STRING,
        status: Influx.FieldType.BOOLEAN,
        status_number: Influx.FieldType.INTEGER
      },
      tags: ["uptime_bot"]
    }
  ]
});

module.exports = function(bot) {
  const tz = "Europe/Oslo";
  new CronJob("* * * * *", checkSites, null, true, tz);

  bot.brain.data.sites = config.sites || [];

  bot.hear(/check/i, res => {
    const { sites } = bot.brain.data;
    if (sites.length === 0) {
      res.send(
        "Det er ingen sider i databasen som skal sjekkes. Legg til en side med kommandoen add <url>"
      );
      return;
    }
    res.send(
      `Sjekker ${
        sites.length > 1 ? sites.length + " sider" : sites.length + " side"
      }`
    );
    checkSites(true);
  });

  bot.respond(/(which sites|ws)/i, res => {
    console.log(bot.brain);
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
      let sites = bot.brain.data.sites;
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
      let { sites } = bot.brain.data;
      let siteToDelete = sites.find(s => s === url);
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

  bot.respond(/sonos say (.*)/i, res => {
    const command = res.match[1];
    talkViaSonos(bot, command);
  });

  bot.respond(/(neste bybane|nbb)/i, res => {
    res.send("Finner ut når neste bybane går.");
    skyss.getNextBybane().then(data => {
      const now = moment().format("HH:mm");
      const startTime = data[0].start;
      talkViaSonos(
        bot,
        `Klokken er nå ${now}. Neste bybane går klokken ${startTime} fra Brann Stadion til Byparken.`
      );
      res.send(
        `Klokken er nå ${now}. Neste bybane går kl. ${startTime} fra Brann Stadion til Byparken.`
      );
    });
  });

  bot.respond(/nosay (neste bybane|nbb)/i, res => {
    res.send("Finner ut når neste bybane går.");
    skyss.getNextBybane().then(data => {
      const now = moment().format("HH:mm");
      const startTime = data[0].start;
      res.send(
        `Klokken er nå ${now}. Neste bybane går kl. ${startTime} fra Brann Stadion til Byparken.`
      );
    });
  });

  function talkViaSonos(bot, command) {
    bot.http(`http://192.168.1.61:5005/sayall/${command}/nb-no/40`).get()(
      function(err, response, body) {
        if (err) {
          res.send(`Jeg kunne dessverre ikke si ${res.match[1]}`);
        }
      }
    );
  }

  function registerSuccess(site) {
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
  }

  function registerDowntime(site) {
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
        isReachable(site, { timeout: 60000 * 3 }).then(reachable => {
          const now = new Date();
          let successFull = bot.brain.data.success ? bot.brain.data.success : 0;
          if (reachable) {
            if (checkByCommand) {
              bot.messageRoom(
                config.slackRoom,
                `:white_check_mark: ${site} er online: ${now}`
              );
              registerSuccess(site);
              return;
            }

            if (successFull >= 60) {
              bot.messageRoom(
                config.slackRoom,
                `:white_check_mark: ${site} er online: ${now} and har vært online i 60 minutter`
              );
              bot.brain.data.success = 0;
              registerSuccess(site);
            } else {
              bot.brain.data.success = successFull++;
              registerSuccess(site);
            }
          } else {
            bot.messageRoom(
              config.slackRoom,
              `${
                config.webAdminSlackName
              } :fire: ${site} er offline: ${now}. Du bør finne ut hvorfor :fire:`
            );
            registerDowntime(site);
            bot.brain.data.success = 0;
          }
        });
      });
    }
  }
};
