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
const { cmpToday } = require('../util/common');

//record 페이지 로딩시 데이터 있는 거 반환하는 용도
router.get('/record-all-search', async (req, res, next) => {
    const { user } = req;
    const { startDate } = req.query;
    console.log(startDate);
    try {
        const { user } = req;
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
const isEmpty = function (value) {
    if (
        value == '' ||
        value == null ||
        value == undefined ||
        (value != null && typeof value == 'object' && !Object.keys(value).length)
    ) {
        return true;
    } else {
        return false;
    }
};

//수정용 ?
//관심종목 메뉴 조회용
// router.get('/interest', async (req, res, next) => {
//     const { user } = req;
//     const { code } = req.query;
//     let isInterest;

//     try {
//         const stock = await Stock.findOne({
//             where: {
//                 user_id: user.id,
//                 stock_code: code,
//                 interest_id: {
//                     [Op.ne]: null, //값이 null인 걸 제외하고 찾아준다
//                 },
//             },
//         });
//         if (isEmpty(stock)) {
//             isInterest = false;
//         } else {
//             isInterest = true;
//         }
//         res.status(200).send({ isInterest: isInterest });
//     } catch (error) {
//         console.error(error);
//         next(error); // status 500}
//     }
// });

router.get('/check-interest', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { code } = req.query;

    try {
        const stock = await Stock.findOne({
            attributes: {
                include: [
                    [
                        sequelize.literal(`
                      (SELECT CASE WHEN id IS NOT NULL THEN TRUE ELSE FALSE END FROM Interest WHERE Interest.stock_code = Stock.stock_code LIMIT 1)
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

// 전 종목들의 카테고리 조회
// router.get('/category', isLoggedIn, async (req, res, next) => {
//     const { user } = req;
//     console.log('요청들어옴');
//     try {
//         const category = await Category.findAll({
//             attributes: [
//                 'id',
//                 'name',
//                 [sequelize.fn('COUNT', sequelize.col('Stocks.id')), 'stockCount'],
//             ],

//             include: [
//                 {
//                     model: Stock,
//                     attributes: [],
//                     where: {
//                         user_id: user.id,
//                     },
//                 },
//             ],
//             group: ['Category.id'],
//             raw: true,
//         });

//         res.status(200).send(category);
//     } catch (error) {
//         console.error(error);
//         next(error); // status 500}
//     }
// });

router.get('/interest-category', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    try {
        const query = `
               SELECT C.id, C.name, COUNT(DISTINCT S.name) AS stockCount
               FROM CATEGORYS C
               LEFT OUTER JOIN STOCKS S ON C.id = S.category_id
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

// 특정 종목 페이징네이션 데이터

// attributes: {
//     include: [
//         [
//             sequelize.literal(`
//           (SELECT CASE WHEN id IS NOT NULL THEN TRUE ELSE FALSE END FROM Interest WHERE Interest.stock_code = Stock.stock_code LIMIT 1)
//         `),
//             'isInterest',
//         ],
//     ],
// },

router.get('/specific-stock-all', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { code, offset, numPerPage, categoryName } = req.query;

    try {
        const { count, rows: stock } = await Stock.findAndCountAll({
            // attributes: {
            //     include: [
            //         [
            //             sequelize.literal(`
            //               (SELECT CASE WHEN id IS NOT NULL THEN TRUE ELSE FALSE END FROM Interest WHERE Interest.stock_code = Stock.stock_code LIMIT 1)
            //             `),
            //             'isInterest',
            //         ],
            //     ],
            // },

            where: {
                user_id: user.id,
                stock_code: code,
            },
            include: [
                {
                    model: Category,
                    attributes: ['id', 'name'],
                    where: {
                        name: categoryName,
                    },
                },
            ],
            order: [['register_date', 'desc']],
            limit: parseInt(numPerPage),
            offset: parseInt(offset),
        });

        // const query = `
        // SELECT S.*, C.*
        // FROM CATEGORYS C
        // LEFT OUTER JOIN STOCKS S ON C.id = S.category_id
        // LEFT OUTER JOIN interest I ON S.stock_code = I.stock_code
        // WHERE S.user_id = :userId
        // AND S.stock_code = :code
        // AND I.stock_code IS NOT null
        // ORDER BY S.register_date desc;
        // `;

        // const stock = await sequelize.query(query, {
        //     replacements: { userId: user.id, code: code },
        //     type: sequelize.QueryTypes.SELECT,
        // });

        const result = {
            totalCount: count,
            stock: stock,
        };

        // const result = {
        //     totalCount: stock.length,
        //     stock: stock,
        // };
        res.status(200).send(result);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

//카테고리  - 관심 종목 조회 interest-by-category Istock으로 받으면 되고

router.get('/interest-by-category', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { categoryName } = req.query;
    try {
        const query = `
        SELECT S.stock_code, S.name, C.name as category_name
        FROM CATEGORYS C
        LEFT OUTER JOIN STOCKS S ON C.id = S.category_id
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

//카테고리 - 종목 조회  stock-by-category Istock으로 받으면 되고

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
        const stock = await Stock.findAll({
            attributes: {
                include: [
                    [
                        sequelize.literal(`
                      (SELECT CASE WHEN id IS NOT NULL THEN TRUE ELSE FALSE END FROM Interest WHERE Interest.stock_code = Stock.stock_code LIMIT 1)
                    `),
                        'isInterest',
                    ],
                ],
            },
            where: {
                user_id: user.id,
                register_date: date,
            },
            include: [
                {
                    model: Category,
                    attributes: ['id', 'name'],
                },
            ],
            order: [['register_date', 'desc']],
        });

        res.status(200).send(stock);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.get('/stock-by-year-month', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { date } = req.query;

    try {
        const stock = await Stock.findAll({
            where: {
                user_id: user.id,
                register_date: {
                    [Op.like]: '%' + date + '%',
                },
            },
        });

        res.status(200).send(stock);
    } catch (error) {
        console.error(error);
        next(error); // status 500
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
        data.Category = category.get({ plain: true });
        if (isInterest) {
            data.isInterest = true;
        } else {
            data.isInterest = false;
        }
        console.log(data);
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

        stock = await Stock.findOne({
            where: {
                id: id,
            },
        });

        const data = stock.get({ plain: true });
        data.Category = category.get({ plain: true });
        if (isInterest) {
            data.isInterest = true;
        } else {
            data.isInterest = false;
        }
        res.status(200).send(data);
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
