const DataTypes = require('sequelize');
const { Model } = DataTypes;

module.exports = class Stock extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                },
                name: {
                    type: DataTypes.STRING(30), // STRING, TEXT, BOOLEAN, INTEGER, FLOAT, DATETIME
                    allowNull: false, // 필수
                    // 고유한 값
                },

                current_price: {
                    type: DataTypes.STRING(100),
                    allowNull: false, // 필수
                },

                previous_close: {
                    type: DataTypes.STRING(100),
                    allowNull: false, // 필수
                },
                days_range: {
                    type: DataTypes.STRING(100),
                    allowNull: false, // 필수,
                },

                register_date: {
                    type: DataTypes.STRING(100),
                    allowNull: false, // 필수,
                },
            },
            {
                modelName: 'Stock',
                tableName: 'stocks',
                paranoid: false,
                charset: 'utf8',
                collate: 'utf8_general_ci', // 한글 저장
                sequelize,
            }
        );
    }
    static associate(db) {
        // db.Stock.belongsTo(db.User, { foreignKey: 'user_id', sourceKey: 'id' });
        // db.Stock.belongsTo(db.Category, { foreignKey: 'category_id', sourceKey: 'id' });
        db.Stock.belongsTo(db.User, { foreignKey: 'user_id' });
        db.Stock.belongsTo(db.Category, { foreignKey: 'category_id' });

        // db.Stock.belongsTo(db.User);
        // db.Stock.belongsTo(db.Category);
    }
};
