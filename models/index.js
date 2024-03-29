const Sequelize = require('sequelize');

const user = require('./user');
const stock = require('./stock');
const category = require('./category');
const interest = require('./interest');
const summary = require('./summary');

const env = process.env.NODE_ENV || 'development';
const config = require('../config/config')[env];
const db = {};

const sequelize = new Sequelize(config.database, config.username, config.password, config);

db.User = user;
db.Stock = stock;
db.Category = category;
db.Interest = interest;
db.Summary = summary;

Object.keys(db).forEach((modelName) => {
    db[modelName].init(sequelize);
});

Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
