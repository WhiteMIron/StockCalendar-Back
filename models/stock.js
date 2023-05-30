const DataTypes = require('sequelize');
const { Model } = DataTypes;

module.exports = class Stock extends Model {
    static init(sequelize) {
        return super.init(
            {
                name: {
                    type: DataTypes.STRING(30), // STRING, TEXT, BOOLEAN, INTEGER, FLOAT, DATETIME
                    allowNull: false, // 필수
                    unique: true, // 고유한 값
                },

                previous_close: {
                    type: DataTypes.STRING(100),
                    allowNull: false, // 필수
                },
                days_range: {
                    type: DataTypes.STRING(100),
                    allowNull: false, // 필수,
                },
                created_at: {},
            },
            {
                modelName: 'User',
                tableName: 'users',
                paranoid: false,
                charset: 'utf8',
                collate: 'utf8_general_ci', // 한글 저장
                sequelize,
            }
        );
    }
    static associate(db) {}
};
