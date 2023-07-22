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

const router = express.Router();

const axios = require('axios');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');

const regex = /[^0-9 | . | % |]/g;
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

    const previousClose = $(
        '#content > div.section.inner_sub > div:nth-child(1) > table > tbody > tr:nth-child(3) > td:nth-child(4) > span'
    )
        .text()
        .replace(regex, '');

    let info = {
        name: name,
        currentPrice: currentPrice,
        daysRange: daysRange,
        previousClose: previousClose,
    };
    return info;
};

router.post('/test', async (req, res, next) => {
    const { code, categoryName } = req.body;
    let category;
    try {
        info = await parsing(code);

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
        const exUser = await User.findOne({
            where: {
                email: 'test2@test.com',
            },
        });

        const exStock = await Stock.findOne({
            where: {
                name: info.name,
                register_date: moment().format('YYYY/MM/DD'),
            },
            include: [
                {
                    model: User,
                    where: {
                        email: 'test2@test.com',
                    },
                },
            ],
        });
        if (exStock) {
            return res.status(403).send('이미 등록되어있는 주식입니다.');
        }

        const stock = await Stock.create({
            name: info.name,
            current_price: info.currentPrice,
            previous_close: info.previousClose,
            days_range: info.daysRange,
            user_id: exUser.id,
            category_id: category.id,
            register_date: moment().format('YYYY/MM/DD'),
        });
        res.status(201).send(stock);
    } catch (error) {
        next(error);
    }
});

router.get('/stock', async (req, res, next) => {
    const stock = await Stock.findAll({
        where: {
            user_id: 2,
            register_date: moment().format('YYYY/MM/DD'),
        },
    });
    res.status(200).send(stock);
});

router.post('/stock', isNotLoggedIn, async (req, res, next) => {
    const { code, categoryName } = req.body;
    const { user } = req;
    let category;
    try {
        info = await parsing(code);

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
        const exUser = await User.findOne({
            where: {
                email: user.email,
            },
        });

        const exStock = await Stock.findOne({
            where: {
                name: info.name,
                register_date: moment().format('YYYY/MM/DD'),
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
            current_price: info.currentPrice,
            previous_close: info.previousClose,
            days_range: info.daysRange,
            user_id: exUser.id,
            category_id: category.id,
            register_date: moment().format('YYYY/MM/DD'),
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
