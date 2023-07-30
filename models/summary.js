const DataTypes = require('sequelize');
const { Model } = DataTypes;

module.exports = class Summary extends Model {
    static init(sequelize) {
        return super.init(
            {
                date: {
                    type: DataTypes.STRING(1000), // STRING, TEXT, BOOLEAN, INTEGER, FLOAT, DATETIME
                    allowNull: false, // 필수
                },

                content: {
                    type: DataTypes.STRING(1000), // STRING, TEXT, BOOLEAN, INTEGER, FLOAT, DATETIME
                    allowNull: true, // 필수
                },
            },
            {
                modelName: 'Summary',
                tableName: 'summarys',
                paranoid: false,
                charset: 'utf8',
                collate: 'utf8_general_ci', // 한글 저장
                sequelize,
            }
        );
    }
    static associate(db) {
        db.Summary.belongsTo(db.User, { foreignKey: 'user_id' });
    }
};
