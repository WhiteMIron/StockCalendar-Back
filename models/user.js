const DataTypes = require('sequelize');
const { Model } = DataTypes;

module.exports = class User extends Model {
    static init(sequelize) {
        return super.init(
            {
                email: {
                    type: DataTypes.STRING(30), // STRING, TEXT, BOOLEAN, INTEGER, FLOAT, DATETIME
                    allowNull: false, // 필수
                    unique: true, // 고유한 값
                },

                password: {
                    type: DataTypes.STRING(100),
                    allowNull: false, // 필수
                },
            },
            {
                modelName: 'User',
                tableName: 'users',
                paranoid: true,
                charset: 'utf8',
                collate: 'utf8_general_ci', // 한글 저장
                sequelize,
            }
        );
    }
    static associate(db) {
        db.User.hasMany(db.Stock, { as: 'user_id', foreignKey: 'user_id' });
        db.User.hasMany(db.Summary, { foreignKey: 'user_id' });
    }
};
