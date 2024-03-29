require('dotenv').config();

module.exports = {
    development: {
        username: 'root',
        password: process.env.MYSQL_PASSWORD,
        database: 'stock',
        host: 'svc.sel4.cloudtype.app',
        dialect: 'mariadb',
        port: '32175',

        timezone: '+09:00',
    },
    test: {
        username: 'root',
        password: process.env.MYSQL_PASSWORD,
        database: 'stock',
        host: '127.0.0.1',
        dialect: 'mysql',
        timezone: '+09:00',
    },
    production: {
        username: 'root',
        password: process.env.MYSQL_PASSWORD,
        database: 'stock',
        host: 'svc.sel4.cloudtype.app',
        dialect: 'mariadb',
        port: '32175',

        timezone: '+09:00',
    },
};
