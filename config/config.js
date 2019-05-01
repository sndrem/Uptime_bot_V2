const config = {
  sites: [
    "http://www.mathopen.no",
    "http://www.moldeklev.no",
    "http://faresonen.ddns.net:8001/#/"
  ],
  webAdminSlackName: "@sndrem",
  slackRoom: "web-admin",
  noResponseTresholdInSeconds: 30,
  bysykkelStativer: [
    {
      id: "511",
      name: "Henrik Ibsens gate/Eika"
    },
    {
      id: "452",
      name: "Vippetangen Vest"
    },
    {
      id: "623",
      name: "7 Juni Plassen"
    },
    {
      id: "404",
      name: "Oslo Handelsgym"
    },
    {
      id: "533",
      name: "Sørvest for Slottsparken/Pascal"
    }
  ]
};

module.exports = config;
