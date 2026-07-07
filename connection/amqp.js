const amqp = require("amqplib");
const winston = require("winston");
const { generateCuid } = require("../services/cuidgenerator");
const logger = winston.createLogger({
    level: "info", // Minimum level of logs to be written
    format: winston.format.simple(), // Format of the log messages
    transports: [
        new winston.transports.File({ filename: "logs.log" }), // Specify the log file name
    ],
});

const RabbitSettings = {
    protocol: "amqp",
    hostname: process.env.AMQP_HOST,
    port: 5672,
    username: process.env.AMQP_USERNAME,
    password: process.env.AMQP_PASSWORD,
    authMechanism: "AMQPLAIN",
    vhost: "",
    exchange: "smartdoor",
    loggerQueue: "smartdoorlogger",
    queues: ["smartdoorlogger", "smartdoorgateway"],
};

class RabbitConnection {
    constructor() {
        RabbitConnection.createConnection();
        this.connection = null;
        this.channel = null;
    }

    static getInstance() {
        if (!RabbitConnection.instance) {
            RabbitConnection.instance = new RabbitConnection();
        }
        return RabbitConnection.instance;
    }

    //create connection to rabbitmq
    static async createConnection() {
        try {
            this.connection = await amqp.connect(
                `${RabbitSettings.protocol}://${RabbitSettings.username}:${RabbitSettings.password}@${RabbitSettings.hostname}/${RabbitSettings.vhost}`
                // `${RabbitSettings.protocol}://${RabbitSettings.hostname}`
            );
            
            this.connection.on("error", (err) => {
                console.error(" [!] RabbitMQ connection error:", err.message);
            });

            this.connection.on("close", () => {
                console.log(" [!] RabbitMQ connection closed. Reconnecting in 5s...");
                setTimeout(() => RabbitConnection.createConnection(), 5000);
            });

            this.channel = await this.connection.createChannel();
            
            this.channel.on("error", (err) => {
                console.error(" [!] RabbitMQ channel error:", err.message);
            });

            this.channel.on("close", () => {
                console.log(" [!] RabbitMQ channel closed.");
            });

            this.channel.assertExchange(RabbitSettings.exchange, "direct", {
                durable: true,
            });

            RabbitSettings.queues.forEach((data) => {
                this.channel.assertQueue(data, {
                    durable: true,
                });
            });

            console.log(" [i]: Connection to RabbitMQ established");
        } catch (error) {
            console.log(error);
        }
    }

    // send message to rabbitmq queue
    static async sendMessage(message, bindingKey) {
        try {
            const payload = {
                ...JSON.parse(message),
                messageId: generateCuid(),
                broadcastTimeAt: new Date(),
            };
            let msg = await this.channel.publish(
                RabbitSettings.exchange,
                bindingKey,
                Buffer.from(JSON.stringify(payload))
            );
            if (!this.channel) {
                await this.createConnection();
            }
            if (!this.channel) {
                throw new Error("RabbitMQ channel not initialized");
            }
            console.log(
                ` [x]: "${message}" has been send to "${bindingKey}" key`
            );
            logger.info(
                `AMQP - "${JSON.stringify(
                    payload
                )}" has been send to "${bindingKey}" key`
            );
            return msg;
        } catch (error) {
            console.log(error);
        }
    }

    // consume
    static async consumeMessage({ channel, queue, key, callbackFn }) {
        console.log(
            ` [i]: Listening to "${key}" event on "${channel}" channel`
        );
        channel.bindQueue(queue, RabbitSettings.exchange, key);
        channel.consume(queue, async (msg) => {
            if (msg !== null) {
                console.log(" [d]: Recieved", msg.content.toString());
                channel.ack(msg);
                logger.info(`AMQP - Recieved data "${msg.content.toString()}"`);

                // EXECUTE Callback Function To Do Something
                callbackFn(msg.content.toString());
            } else {
                console.log("Consumer cancelled by server");
            }
        });
    }
}

module.exports = { RabbitConnection };
