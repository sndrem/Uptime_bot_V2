const botService = {
  checkSitesByCommand: (bot, res) => {
    const { sites } = bot.brain.data;
    if (sites.length === 0) {
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
  },
  checkConfig: res => {
    res.send(`Configen min er ${JSON.stringify(config)}`);
  },
  listSites: (bot, res) => {
    res.send(
      `Overvåker følgende sider: ${
        bot.brain.data.sites.length > 0
          ? bot.brain.data.sites.join(", ")
          : "Ingen. Legg til en side med kommandoen add <url>"
      }`
    );
  },
  addSite: (bot, res) => {
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
  },
  deleteSite: (bot, res) => {
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
                      Jeg overvåker foreløpig følgende sider: ${sites.join(
                        ", "
                      )}`);
      }
    } else {
      res.send("Vennligst oppgi en url jeg skal slutte å følge.");
    }
  }
};

module.exports = botService;
