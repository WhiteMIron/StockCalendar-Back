const DataTypes = require('sequelize');
const { Model } = DataTypes;

module.exports = class Category extends Model {
    static init(sequelize) {
        return super.init(
            {
                name: {
                    type: DataTypes.STRING(30), // STRING, TEXT, BOOLEAN, INTEGER, FLOAT, DATETIME
                    allowNull: false, // 필수
                    unique: true, // 고유한 값
                },
            },
            {
                modelName: 'Category',
                tableName: 'categorys',
                paranoid: false,
                charset: 'utf8',
                collate: 'utf8_general_ci', // 한글 저장
                sequelize,
            }
        );
    }
    static associate(db) {
        db.Category.hasMany(db.Stock, { as: 'category_id', foreignKey: 'category_id' });
        db.Category.belongsTo(db.User, { foreignKey: 'user_id' });
    }
};
