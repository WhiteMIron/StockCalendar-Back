const regex = /[^0-9 | . | % |+|-]/g;
const daysRangeRegex = /[^0-9 |.] /g;
const axios = require('axios');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');
const Decimal = require('decimal.js');
getHTML = async (code, page) => {
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

exports.parsing = async (code) => {
    const html = await getHTML(code);
    const content = iconv.decode(html.data, 'EUC-KR');
    const $ = cheerio.load(content);
    const name = $('#middle > div.h_company > div.wrap_company > h2 > a').text();
    const currentPrice = $('#_nowVal').text().replace(regex, '');
    const diffPercent = $('#_rate > span').text().replace(regex, '');
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
        diffPercent: diffPercent,
        previousClose: previousClose,
    };
    return info;
};

exports.calDiffPercent = (currentPrice, previousClose) => {
    if (currentPrice === previousClose) {
        return new Decimal(currentPrice - previousClose).toFixed(2);
    } else {
        return new Decimal(
            (Math.abs(previousClose - currentPrice) / previousClose) * 100
        ).toDecimalPlaces(2);
    }
};

exports.calDiffPrice = (currentPrice, previousClose) => {
    if (currentPrice >= previousClose) {
        return currentPrice - previousClose;
    } else {
        return previousClose - currentPrice;
    }
};
