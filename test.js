const Decimal = require('decimal.js');

const calDiffPercent = (currentPrice, previousClose) => {
    if (currentPrice === previousClose) {
        return new Decimal(currentPrice - previousClose).toFixed(2);
    } else {
        return new Decimal(
            (Math.abs(previousClose - currentPrice) / previousClose) * 100
        ).toDecimalPlaces(2);
    }
};

const result = calDiffPercent(173500, 169000);
x = new Decimal(0);
console.log(result);

num = 1000000;
console.log(num.toLocaleString());
