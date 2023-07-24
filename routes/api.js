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

const router = express.Router();

const axios = require('axios');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');

const regex = /[^0-9 | . | % | ,|+|-]/g;
const daysRangeRegex = /[^0-9 |.] /g;
const moment = require('moment');

const headers = {
    responseType: 'arraybuffer',
};
const url = 'https://finance.naver.com/item/sise.naver?code=';

const getHTML = async (code) => {
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

router.get('/interest', async (req, res, next) => {
    const { user } = req;
    const { code } = req.query;
    let interest;
    if (isEmpty(code)) {
        interest = await interest.findAll({
            where: {
                user_id: user.id,
                stock_id: stock.id,
            },
            include: [
                {
                    model: User,
                    where: {
                        email: user.email,
                    },
                },
            ],
        });
    } else {
        interest = await interest.findOne({
            where: {
                user_id: user.id,
            },
            include: [
                {
                    model: Stock,
                    where: {
                        stock_code: code,
                    },
                },
            ],
        });
    }
    //종목코드로 조회하는게 있어야할듯?

    res.status(200).send(stock);
});

router.post('/interest', async (req, res, next) => {
    const { code } = req.body;
    // const { user } = req;
    let category;

    try {
        // const stock = await Stock.findOne({
        //     where: {
        //         name: info.name,
        //     },
        //     include: [
        //         {
        //             model: User,
        //             where: {
        //                 email: user.email,
        //             },
        //         },
        //     ],
        // });
        const exInterest = await Interest.findOne({
            where: {
                user_id: 1,
                stock_id: 1,
            },
        });
        if (exInterest) {
            res.status(403).send('이미 관심등록된 종목입니다.');
        } else {
            const interest = await Interest.create({
                user_id: 1,
                stock_id: 1,
            });
            res.status(201).send();
        }
    } catch (error) {
        next(error);
    }
});

router.get('/stock', isLoggedIn, async (req, res, next) => {
    const { user } = req;
    const { date } = req.query;
    const stock = await Stock.findAll({
        where: {
            user_id: user.id,
            register_date: date,
        },
    });

    res.status(200).send(stock);
});

router.post('/stock', isLoggedIn, async (req, res, next) => {
    const { code, categoryName, date, isInterest } = req.body;
    const { user } = req;
    let category;
    try {
        info = await parsing(code);
        if (isEmpty(info.name)) {
            return res.status(403).send('잘못된 종목코드입니다.');
        }
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
        const exStock = await Stock.findOne({
            where: {
                name: info.name,
                register_date: date,
            },
            include: [
                {
                    model: User,
                    where: {
                        email: user.email,
                    },
                },
            ],
        });
        if (exStock) {
            return res.status(403).send('이미 등록되어있는 주식입니다.');
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
        });
        res.status(201).send(stock);
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
        const user = await User.create({
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
