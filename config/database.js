const Influx = require("influx");

const influx = new Influx.InfluxDB({
    host: process.env.INFLUX_HOST,
    database: process.env.INFLUX_DB || "homeassistant",
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

module.exports = influx;