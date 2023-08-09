const DataTypes = require('sequelize');
const { Model } = DataTypes;

module.exports = class Interest extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                },

                stock_code: {
                    type: DataTypes.STRING(30),
                    allowNull: false, // 필수
                },
            },
            {
                modelName: 'Interest',
                tableName: 'interest',
                paranoid: false,
                charset: 'utf8',
                collate: 'utf8_general_ci', // 한글 저장
                sequelize,
            }
        );
    }
    static associate(db) {
        db.Interest.belongsTo(db.User, { foreignKey: 'user_id' });
        // db.Interest.belongsTo(db.Stock, { foreignKey: 'stock_id' });
        // db.Interest.hasMany(db.Stock, { as: 'interest_id', foreignKey: 'interest_id' });
    }
};
