const { Op } = require('sequelize');
const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const { sequelize } = require('../models/index');
const { isNotLoggedIn, isLoggedIn } = require('./middlewares');
const User = require('../models/user');
const Stock = require('../models/stock');
const Category = require('../models/category');
const Interest = require('../models/interest');
const Summary = require('../models/summary');

const router = express.Router();
const { getWhereClause } = require('../util/search');
const { parsing, calDiffPercent, calDiffPrice } = require('../util/stock');
const { cmpToday, isEmpty } = require('../util/common');

router.get('/record-all-search', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { startDate } = req.query;
    try {
        let stocks = await Stock.findAll({
            attributes: ['register_date'],
            where: {
                user_id: user.id,
                register_date: {
                    [Op.like]: '%' + startDate + '%',
                },
            },
        });
        stocks = _.uniqBy(stocks, 'register_date');
        res.status(200).send(stocks);
    } catch (error) {
        next(error);
    }
});

router.get('/word-search', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { word } = req.query;
    let stocks;

    try {
        if (!isEmpty(word)) {
            stocks = await Stock.findAll({
                attributes: ['name', 'register_date'],
                where: {
                    user_id: user.id,
                    name: {
                        [Op.and]: [sequelize.literal(getWhereClause(word, 'name'))],
                    },
                },
            });
        }
        res.status(200).send(stocks);
    } catch (error) {
        next(error);
    }
});

router.get('/stock-search', async (req, res, next) => {
    const { user } = req;
    try {
        let stocks = await Stock.findAll({
            attributes: ['register_date'],
            where: {
                user_id: user.id,
            },
        });
        stocks = _.uniqBy(stocks, 'register_date');
        res.status(200).send(stocks);
    } catch (error) {
        next(error);
    }
});

router.get('/check-interest', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { code } = req.query;

    try {
        const stock = await Stock.findOne({
            attributes: {
                include: [
                    [
                        sequelize.literal(`
                      (SELECT CASE WHEN id IS NOT NULL THEN TRUE ELSE FALSE END FROM interest WHERE interest.stock_code = stock.stock_code LIMIT 1)
                    `),
                        'isInterest',
                    ],
                ],
            },
            where: {
                user_id: user.id,
                stock_code: code,
            },
        });

        res.status(200).send(stock);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

// 관심체크된 종목들의 카테고리 조회
router.get('/category', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    try {
        const category = await Category.findAll({
            attributes: [
                'id',
                'name',
                [sequelize.fn('COUNT', sequelize.col('Stocks.id')), 'stockCount'],
            ],

            include: [
                {
                    model: Stock,
                    attributes: [],
                    where: {
                        user_id: user.id,
                    },
                },
            ],
            group: ['Category.id'],
            raw: true,
        });

        res.status(200).send(category);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.get('/test', async (req, res, next) => {
    res.status(200).send('hi');
});

router.get('/all-category', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    try {
        const query = `
        SELECT C.id, C.name  AS name FROM categorys AS C LEFT OUTER JOIN stocks AS S 
        ON C.id = S.category_id WHERE C.user_id = :userId
        GROUP BY C.id
        
           `;

        const categoryResult = await sequelize.query(query, {
            replacements: { userId: user.id },
            type: sequelize.QueryTypes.SELECT,
        });

        res.status(200).send(categoryResult);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.put('/category/:id', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { categoryName } = req.body;
    const { id } = req.params;

    try {
        await Category.update(
            {
                name: categoryName,
            },
            { where: { id: id, user_id: user.id } }
        );

        const category = await Category.findOne({
            where: {
                id: id,
            },
        });

        res.status(200).send(category);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.delete('/category/:id', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { id } = req.params;

    try {
        await Category.destroy({ where: { id: id, user_id: user.id } });
        res.status(200).send('ok');
    } catch (error) {
        next(error);
    }
});

router.get('/stock-in-category', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { categoryName } = req.query;
    try {
        const query = `
        SELECT S.stock_code, S.name, C.name as category_name
        FROM categorys C
        RIGHT OUTER JOIN stocks S ON C.id = S.category_id
        WHERE C.user_id=:userId and C.name = :categoryName
        GROUP BY S.stock_code, S.name, C.name;
    `;

        const stock = await sequelize.query(query, {
            replacements: { userId: user.id, categoryName: categoryName },
            type: sequelize.QueryTypes.SELECT,
        });

        res.status(200).send(stock);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.get('/specific-stock-all', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { code, categoryName } = req.query;
    const numPerPage = parseInt(req.query.numPerPage);
    const offset = parseInt(req.query.offset);
    try {
        const countQuery = `
            SELECT COUNT(*) AS totalCount
            FROM categorys C
            LEFT OUTER JOIN stocks S ON C.id = S.category_id
            WHERE S.user_id = :userId
            AND S.stock_code = :code
            AND C.name = :categoryName
        `;

        const query = `
            SELECT S.*, C.name AS category_name
            FROM categorys C
            LEFT OUTER JOIN stocks S ON C.id = S.category_id
            WHERE S.user_id = :userId
            AND S.stock_code = :code
            AND C.name = :categoryName
            ORDER BY S.register_date desc
            LIMIT  :numPerPage
            OFFSET :offset
            `;

        const stock = await sequelize.query(query, {
            replacements: {
                userId: user.id,
                code: code,
                categoryName: categoryName,
                numPerPage: numPerPage,
                offset: offset * numPerPage,
            },
            type: sequelize.QueryTypes.SELECT,
        });

        const totalCountResult = await sequelize.query(countQuery, {
            replacements: {
                userId: 1,
                code: code,
                categoryName: categoryName,
            },
            type: sequelize.QueryTypes.SELECT,
        });

        const totalCount = totalCountResult[0].totalCount;

        const result = {
            totalCount: totalCount,
            stock: stock,
        };
        res.status(200).send(result);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

// 특정 종목 페이징네이션 데이터

router.get('/specific-interest-stock-all', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { code, categoryName } = req.query;
    const numPerPage = parseInt(req.query.numPerPage);
    const offset = parseInt(req.query.offset);
    try {
        const countQuery = `
            SELECT COUNT(*) AS totalCount
            FROM categorys C
            LEFT OUTER JOIN stocks S ON C.id = S.category_id
            LEFT OUTER JOIN interest I ON S.stock_code = I.stock_code
            WHERE S.user_id = :userId
            AND S.stock_code = :code
            AND C.name = :categoryName
            AND I.stock_code IS NOT null;
        `;

        const query = `
            SELECT S.*, C.name AS category_name
            FROM categorys C
            LEFT OUTER JOIN stocks S ON C.id = S.category_id
            LEFT OUTER JOIN interest I ON S.stock_code = I.stock_code
            WHERE S.user_id = :userId
            AND S.stock_code = :code
            AND C.name = :categoryName
            AND I.stock_code IS NOT null
            ORDER BY S.register_date desc
            LIMIT  :numPerPage
            OFFSET :offset
            `;

        const stock = await sequelize.query(query, {
            replacements: {
                userId: user.id,
                code: code,
                categoryName: categoryName,
                numPerPage: numPerPage,
                offset: offset * numPerPage,
            },
            type: sequelize.QueryTypes.SELECT,
        });

        const totalCountResult = await sequelize.query(countQuery, {
            replacements: {
                userId: 1,
                code: code,
                categoryName: categoryName,
            },
            type: sequelize.QueryTypes.SELECT,
        });

        const totalCount = totalCountResult[0].totalCount;

        const result = {
            totalCount: totalCount,
            stock: stock,
        };
        res.status(200).send(result);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.get('/interest-category', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    try {
        const query = `
               SELECT C.id, C.name, COUNT(DISTINCT S.name) AS stockCount
               FROM categorys C
               LEFT OUTER JOIN stocks S ON C.id = S.category_id
               LEFT OUTER JOIN interest I ON S.stock_code = I.stock_code
               WHERE S.user_id = :userId
               AND I.stock_code IS NOT null             
               GROUP BY C.id;
              `;

        const category = await sequelize.query(query, {
            replacements: { userId: user.id },
            type: sequelize.QueryTypes.SELECT,
        });

        res.status(200).send(category);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.get('/interest-stock-in-category', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { categoryName } = req.query;
    try {
        const query = `
        SELECT S.stock_code, S.name, C.name as category_name
        FROM categorys C
        LEFT OUTER JOIN stocks S ON C.id = S.category_id
        LEFT OUTER JOIN interest I ON S.stock_code = I.stock_code
        WHERE C.user_id=:userId and C.name = :categoryName
        AND I.stock_code IS NOT null   
        GROUP BY S.stock_code, S.name, C.name;
    `;

        const stock = await sequelize.query(query, {
            replacements: { userId: user.id, categoryName: categoryName },
            type: sequelize.QueryTypes.SELECT,
        });

        res.status(200).send(stock);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.get('/summary', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { date } = req.query;

    try {
        const summary = await Summary.findOne({
            where: {
                user_id: user.id,
                date: date,
            },
        });

        res.status(200).send(summary);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.post('/summary', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { content, date } = req.body;
    let summary;
    try {
        const exSummary = await Summary.findOne({
            where: {
                user_id: user.id,
                date: date,
            },
        });

        if (exSummary) {
            await Summary.update({ content: content }, { where: { id: exSummary.id } });

            summary = await Summary.findOne({
                where: {
                    user_id: user.id,
                    date: date,
                },
            });
        } else {
            summary = await Summary.create({
                user_id: user.id,
                date: date,
                content: content,
            });
        }
        res.status(201).send(summary);
    } catch (error) {
        console.error(error);
        next(error); // status 500
    }
});

router.get('/stock', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { date } = req.query;

    try {
        const query = `
        SELECT S.*, C.name AS category_name,
          (SELECT CASE WHEN id IS NOT NULL THEN TRUE ELSE FALSE END 
          FROM interest WHERE interest.stock_code = S.stock_code LIMIT 1) AS isInterest
        FROM STOCKS S 
        LEFT OUTER JOIN categorys C ON  S.category_id  = C.id 
        LEFT OUTER JOIN interest I ON S.stock_code = I.stock_code
        WHERE S.user_id = :userId
        AND S.register_date = :date
        ORDER BY S.createdAt desc
    `;

        const replacements = {
            userId: user.id,
            date: date,
        };

        const stock = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT,
        });

        res.status(200).send(stock);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.post('/stock', isLoggedIn, async (req, res, next) => {
    const { code, categoryName, date, isInterest, news, issue, currentPrice, previousClose } =
        req.body;
    const { user } = req;
    let category;
    let info;
    let exInterest;
    let interestId;
    let exStock;
    try {
        info = await parsing(code);
        if (!cmpToday(date)) {
            info.previousClose = previousClose;
            info.currentPrice = currentPrice;
            info.diffPercent = calDiffPercent(currentPrice, previousClose) + '%';
            info.diffPrice = calDiffPrice(currentPrice, previousClose);
        }

        console.log(info);
        if (isEmpty(info.name)) {
            return res.status(403).send('잘못된 종목코드입니다.');
        }

        if (!isEmpty(categoryName)) {
            const exCategory = await Category.findOne({
                where: {
                    name: categoryName,
                    user_id: user.id,
                },
            });
            if (!exCategory) {
                category = await Category.create({
                    name: categoryName,
                    user_id: user.id,
                });
            } else {
                category = exCategory;
            }
        }
        exStock = await Stock.findOne({
            where: {
                name: info.name,
                register_date: date,
            },
            include: [
                {
                    model: User,
                    where: {
                        id: user.id,
                    },
                },
            ],
        });
        if (exStock) {
            return res.status(403).send('이미 등록되어있는 종목입니다.');
        }
        exInterest = await Interest.findOne({
            where: {
                stock_code: code,
                user_id: user.id,
            },
        });

        if (isInterest) {
            if (isEmpty(exInterest)) {
                interest = await Interest.create({
                    stock_code: code,
                    user_id: user.id,
                });
            }
        } else {
            if (!isEmpty(exInterest)) {
                await Interest.destroy({
                    where: { stock_code: code, user_id: user.id },
                });
            }
        }

        const stock = await Stock.create({
            name: info.name,
            stock_code: code,

            current_price: info.currentPrice,
            diff_price: info.diffPrice,
            diff_percent: info.diffPercent,
            previous_close: info.previousClose,
            user_id: user.id,
            category_id: category.id,
            register_date: date,
            news: news,
            issue: issue,
        });
        const data = stock.get({ plain: true });
        data.category_name = category.get({ plain: true }).name;
        data.category_id = category.get({ plain: true }).id;

        if (isInterest) {
            data.isInterest = true;
        } else {
            data.isInterest = false;
        }
        res.status(201).send(data);
    } catch (error) {
        next(error);
    }
});

router.delete('/stock/:id', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { id } = req.params;
    try {
        await Stock.destroy({ where: { id: id, user_id: user.id } });
        res.status(200).send('ok');
    } catch (error) {
        next(error);
    }
});

router.put('/stock', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const {
        id,
        stockCode,
        categoryName,
        isInterest,
        news,
        issue,
        currentPrice,
        previousClose,
        date,
    } = req.body;
    let category;
    let exInterest;
    let stock;
    try {
        const exCategory = await Category.findOne({
            where: {
                name: categoryName,
                user_id: user.id,
            },
        });
        if (!exCategory) {
            category = await Category.create({
                name: categoryName,
                user_id: user.id,
            });
        } else {
            category = exCategory;
        }

        exInterest = await Interest.findOne({
            where: {
                stock_code: stockCode,
                user_id: user.id,
            },
        });

        if (isInterest) {
            if (isEmpty(exInterest)) {
                interest = await Interest.create({
                    stock_code: stockCode,
                    user_id: user.id,
                });
            }
        } else {
            if (!isEmpty(exInterest)) {
                await Interest.destroy({
                    where: { stock_code: stockCode, user_id: user.id },
                });
            }
        }

        if (!cmpToday(date)) {
            await Stock.update(
                {
                    current_price: currentPrice,
                    diff_price: calDiffPrice(currentPrice, previousClose),
                    diff_percent: calDiffPercent(currentPrice, previousClose) + '%',
                    previous_close: previousClose,
                    news: news,
                    issue: issue,
                    category_id: category.id,
                },
                { where: { id: id, user_id: user.id } }
            );
        } else {
            await Stock.update(
                {
                    news: news,
                    issue: issue,
                    category_id: category.id,
                },
                { where: { id: id, user_id: user.id } }
            );
        }

        const query = `
            SELECT S.*, C.name AS category_name,
              (SELECT CASE WHEN id IS NOT NULL THEN TRUE ELSE FALSE END
              FROM interest WHERE interest.stock_code = S.stock_code LIMIT 1) AS isInterest
            FROM stocks S
            LEFT OUTER JOIN categorys C ON  S.category_id  = C.id
            LEFT OUTER JOIN interest I ON S.stock_code = I.stock_code
            WHERE S.user_id = :userId
            AND S.id = :id
        `;

        const replacements = {
            userId: user.id,
            id: id,
        };

        const stockResult = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT,
        });
        stock = stockResult[0];

        res.status(200).send(stock);
    } catch (error) {
        next(error);
    }
});

router.get('/total-count-info', async (req, res, next) => {
    const { user } = req;
    try {
        const query = `
        SELECT 
        (SELECT COUNT(id) FROM stocks WHERE user_id=:userId) AS stockTotalCount, 
        (SELECT COUNT(id) FROM interest WHERE user_id=:userId) AS interestTotalCount
       `;

        const totalCountInfoResult = await sequelize.query(query, {
            replacements: { userId: user.id },
            type: sequelize.QueryTypes.SELECT,
        });

        const CategoryResult = await Category.findAndCountAll({
            where: {
                user_id: user.id,
            },
        });

        res.status(200).send({
            stockTotalCount: totalCountInfoResult[0].stockTotalCount,
            interestTotalCount: totalCountInfoResult[0].interestTotalCount,
            categoryTotalCount: CategoryResult.count,
        });
    } catch (error) {
        next(error);
    }
});

router.get('/users', (req, res, next) => {
    return res.json(req.user || false);
});
router.post('/users', isNotLoggedIn, async (req, res, next) => {
    try {
        const exUser = await User.findOne({
            where: {
                email: req.body.email,
            },
        });
        if (exUser) {
            return res.status(403).send('이미 사용 중인 아이디입니다.');
        }
        const hashedPassword = await bcrypt.hash(req.body.password, 12);

        await User.create({
            email: req.body.email,
            password: hashedPassword,
        });

        res.status(201).send('ok');
    } catch (error) {
        console.error(error);
        next(error); // status 500
    }
});

router.post('/users/login', isNotLoggedIn, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error(err);
            return next(err);
        }
        if (info) {
            return res.status(401).send(info.reason);
        }
        return req.login(user, async (loginErr) => {
            if (loginErr) {
                console.error(loginErr);
                return next(loginErr);
            }

            const user = await User.findOne({
                where: { id: user.id },
                attributes: ['id', 'email'],
            });

            console.log(user);

            return res.status(200).json(
                await User.findOne({
                    where: { id: user.id },
                    attributes: ['id', 'email'],
                })
            );
        });
    })(req, res, next);
});

router.post('/users/logout', isLoggedIn, (req, res) => {
    req.logout();
    req.session.destroy();
    res.send('ok');
});

module.exports = router;
