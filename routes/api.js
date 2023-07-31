const { Op } = require('sequelize');
const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const { sequelize } = require('../models');
const { isNotLoggedIn, isLoggedIn } = require('./middlewares');
const User = require('../models/user');
const Stock = require('../models/stock');
const Category = require('../models/category');
const Interest = require('../models/interest');
const Summary = require('../models/summary');

const router = express.Router();

const axios = require('axios');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');

const regex = /[^0-9 | . | % | ,|+|-]/g;
const daysRangeRegex = /[^0-9 |.] /g;
const moment = require('moment');

const getHTML = async (code, page) => {
    const headers = {
        responseType: 'arraybuffer',
    };
    const url = 'https://finance.naver.com/item/sise.naver?code=';
    try {
        return await axios.get(url + code, headers);
    } catch (error) {
        console.log(error);
    }
};

const parsing = async (code) => {
    const html = await getHTML(code);
    const content = iconv.decode(html.data, 'EUC-KR');
    const $ = cheerio.load(content);
    const name = $('#middle > div.h_company > div.wrap_company > h2 > a').text();
    const currentPrice = $('#_nowVal').text().replace(regex, '');
    const daysRange = $('#_rate > span').text().replace(regex, '');
    const diffPrice = $('#_diff > span').text().replace(regex, '');
    const previousClose = $(
        '#content > div.section.inner_sub > div:nth-child(1) > table > tbody > tr:nth-child(3) > td:nth-child(4) > span'
    )
        .text()
        .replace(regex, '');

    let info = {
        name: name,
        diffPrice: diffPrice,
        currentPrice: currentPrice,
        daysRange: daysRange,
        previousClose: previousClose,
    };
    return info;
};

const cmpToday = async (date) => {
    let result = moment(moment().format('YYYY-MM-DD')).isSame(
        moment('2023/07/26'.replaceAll('/', '-'))
    );
    return result;
};

router.get('/test', async (req, res, next) => {
    try {
        console.log(await cmpToday('2023/07/26'));
        date = res.status(200).send();
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

//수정용
router.get('/interest', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { code } = req.query;
    let isInterest;

    try {
        const stock = await Stock.findOne({
            where: {
                user_id: user.id,
                user_id: 1,

                stock_code: code,
                interest_id: {
                    [Op.ne]: null, //값이 null인 걸 제외하고 찾아준다
                },
            },
        });
        if (isEmpty(stock)) {
            isInterest = false;
        } else {
            isInterest = true;
        }
        res.status(200).send({ isInterest: isInterest });
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
        const stock = await Stock.findAll({
            where: {
                user_id: user.id,
                register_date: date,
            },
            include: [
                {
                    model: Category,
                },
                { model: Interest },
            ],
        });

        res.status(200).send(stock);
    } catch (error) {
        console.error(error);
        next(error); // status 500}
    }
});

router.get('/stock-by-year-month', async (req, res, next) => {
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
        next(error); // status 500}
    }
});

router.post('/stock', isLoggedIn, async (req, res, next) => {
    const {
        code,
        categoryName,
        date,
        isInterest,
        diffPrice,
        currentPrice,
        daysRange,
        previousClose,
        news,
        issue,
    } = req.body;
    const { user } = req;
    let category;
    let info;
    let exInterest;
    let interestId;
    let exStock;
    try {
        info = await parsing(code);
        if (!cmpToday(date)) {
            info = {
                previousClose: previousClose,
                daysRange: daysRange,
                currentPrice: currentPrice,
                diffPrice: diffPrice,
            };
        }

        if (isEmpty(info.name)) {
            return res.status(403).send('잘못된 종목코드입니다.');
        }

        if (!isEmpty(categoryName)) {
            const exCategory = await Category.findOne({
                where: {
                    name: categoryName,
                },
            });
            if (!exCategory) {
                category = await Category.create({
                    name: categoryName,
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
            return res.status(403).send('이미 등록되어있는 주식입니다.');
        }
        exInterest = await Stock.findOne({
            where: {
                name: info.name,
                user_id: user.id,
                interest_id: {
                    [Op.ne]: null, //값이 null인 걸 제외하고 찾아준다
                },
            },
        });

        if (isInterest) {
            if (isEmpty(exInterest)) {
                interest = await Interest.create({});
                interestId = interest.id;
            } else {
                interestId = exInterest.interest_id;
            }
        } else {
            if (!isEmpty(exInterest)) {
                await Interest.destroy({
                    where: { id: exInterest.interest_id },
                });
            }
        }

        const stock = await Stock.create({
            name: info.name,
            stock_code: code,
            current_price: info.currentPrice,
            previous_close: info.previousClose,
            diff_price: info.diffPrice,
            days_range: info.daysRange,
            user_id: user.id,
            category_id: category.id,
            register_date: date,
            news: news,
            interest_id: interestId,
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
    const { id, categoryName, isInterest, news, issue } = req.body;
    const { user } = req;
    let category;
    let info;
    let exInterest;
    let interestId;
    let stock;
    try {
        const exCategory = await Category.findOne({
            where: {
                name: categoryName,
            },
        });
        if (!exCategory) {
            category = await Category.create({
                name: categoryName,
            });
        } else {
            category = exCategory;
        }

        exInterest = await Stock.findOne({
            where: {
                id: id,
                interest_id: {
                    [Op.ne]: null, //값이 null인 걸 제외하고 찾아준다
                },
            },
        });

        if (isInterest) {
            if (isEmpty(exInterest)) {
                interest = await Interest.create({});
                interestId = interest.id;
            } else {
                interestId = exInterest.interest_id;
            }
        } else {
            if (!isEmpty(exInterest)) {
                await Interest.destroy({
                    where: { id: exInterest.interest_id },
                });
            }
        }

        await Stock.update(
            {
                news: news,
                interest_id: interestId,
                category_id: category.id,
                issue: issue,
            },
            { where: { id: id } }
        );

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
